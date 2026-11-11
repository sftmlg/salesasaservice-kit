import { z } from "zod";
import type { SaasClient } from "./client.js";
import { applyMode } from "./confirm.js";
import { ConfigError, SaasError } from "./errors.js";
import { fetchProductsPage, type ListingRow, type ProductRow, type ProductsPage } from "./products-page.js";

const entrySchema = z.object({
  key: z.string().min(1),
  product: z.looseObject({ title: z.string().refine((value) => value.trim() !== "", "title is empty") }),
  listing: z
    .record(z.string(), z.unknown())
    .refine(
      (listing) => !("productId" in listing),
      "listing must not carry productId, it comes from the product",
    ),
});

export type ApplyEntry = z.infer<typeof entrySchema>;

export interface Change {
  field: string;
  from: string | null;
  to: string;
}

export type Action = "create" | "update" | "unchanged";

export interface PlanPart {
  action: Action;
  id: string | null;
  changes: Change[];
}

export interface PlanEntry {
  key: string;
  title: string;
  product: PlanPart;
  listing: PlanPart;
  publish: boolean;
}

export interface ApplyFlags {
  confirm: boolean;
  legalAct: boolean;
  publish: boolean;
}

export type ApplyResult =
  | { mode: "dry-run"; sent: 0; plan: PlanEntry[]; notCompared: string }
  | { mode: "apply"; steps: string[]; plan: PlanEntry[] };

export const NOT_COMPARED =
  "Only fields the products page shows decide whether an update is needed: product kind, price, unit and billing period; listing title override, region, commission mode and value. Every other field you give (description, category, approval mode, tags, terms, text overrides) is sent when the record is created or updated for another reason, but a change in it alone is not detected.";

const sameText = (current: string, wanted: string) => current.trim() === wanted.trim();

function sameNumber(current: string, wanted: string): boolean {
  if (Number.isNaN(Number(wanted))) throw new ConfigError(`"${wanted}" is not a number`, { code: "CONFIG" });
  return Number(current) === Number(wanted);
}

function change(
  field: string,
  from: string | null | undefined,
  desired: unknown,
  same: (current: string, wanted: string) => boolean = sameText,
): Change[] {
  if (from === undefined || (typeof desired !== "string" && typeof desired !== "number")) return [];
  const wanted = String(desired);
  return from !== null && same(from, wanted) ? [] : [{ field, from, to: wanted }];
}

function assertReadable(label: string | null, parsed: unknown, what: string): void {
  if (label !== null && parsed === null) {
    throw new ConfigError(`${what} shows a label the kit cannot read, so it cannot be compared`, {
      code: "UNREADABLE_LABEL",
    });
  }
}

function productChanges(existing: ProductRow, desired: Record<string, unknown>): Change[] {
  assertReadable(existing.priceLabel, existing.price, `product "${existing.title}"`);
  const unit = desired["unit"] === "" ? undefined : desired["unit"];
  const period = desired["billingPeriod"] === "" ? undefined : desired["billingPeriod"];
  return [
    ...change("kind", existing.kind, desired["kind"]),
    ...change("pricePerBlockEuros", existing.price, desired["pricePerBlockEuros"], sameNumber),
    ...change("unit", existing.unit ?? (existing.unitLabel === null ? null : undefined), unit),
    ...change(
      "billingPeriod",
      existing.billingPeriod ?? (existing.priceLabel === null ? null : undefined),
      period,
    ),
  ];
}

function listingChanges(existing: ListingRow, desired: Record<string, unknown>): Change[] {
  assertReadable(existing.commissionLabel, existing.commissionMode, `listing "${existing.title}"`);
  return [
    ...change("titleOverride", existing.title, desired["titleOverride"]),
    ...change("region", existing.region, desired["region"]),
    ...change("commissionMode", existing.commissionMode, desired["commissionMode"]),
    ...change("commissionValue", existing.commissionValue, desired["commissionValue"], sameNumber),
  ];
}

export function parseApplyInput(text: string): ApplyEntry[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    throw new ConfigError("the apply file is not valid JSON", { code: "CONFIG", cause });
  }
  const parsed = z.array(entrySchema).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ConfigError(
      `the apply file must be an array of {key, product, listing}: ${issue?.path.join(".") ?? ""} ${issue?.message ?? ""}`,
      { code: "CONFIG" },
    );
  }
  assertUnique(
    parsed.data.map((entry) => entry.key),
    "key",
  );
  assertUnique(
    parsed.data.map((entry) => entry.product.title.trim()),
    "product title",
  );
  return parsed.data;
}

function assertUnique(values: string[], what: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new ConfigError(`the apply file has the ${what} "${value}" twice`, { code: "CONFIG" });
    }
    seen.add(value);
  }
}

function single<T>(rows: T[], what: string, title: string): T | undefined {
  if (rows.length > 1) {
    throw new ConfigError(
      `${rows.length} ${what} carry the title "${title}": matching by title is ambiguous`,
      {
        code: "AMBIGUOUS_TITLE",
      },
    );
  }
  return rows[0];
}

function planEntry(entry: ApplyEntry, page: ProductsPage, publish: boolean): PlanEntry {
  const title = entry.product.title.trim();
  const product = single(
    page.products.filter((row) => row.itemType === "product" && row.title.trim() === title),
    "products",
    title,
  );
  const listing = single(
    page.listings.filter((row) => row.productTitle.trim() === title),
    "listings",
    title,
  );
  if (!product && listing) {
    throw new ConfigError(`a listing titled "${title}" exists without a product of that title`, {
      code: "AMBIGUOUS_TITLE",
    });
  }
  const productChange = product ? productChanges(product, entry.product) : [];
  const listingChange = listing ? listingChanges(listing, entry.listing) : [];
  return {
    key: entry.key,
    title,
    product: part(product?.id, productChange),
    listing: part(listing?.id, listingChange),
    publish: publish && (listing === undefined || listing.status !== "published"),
  };
}

function part(id: string | undefined, changes: Change[]): PlanPart {
  if (id === undefined) return { action: "create", id: null, changes: [] };
  return { action: changes.length > 0 ? "update" : "unchanged", id, changes };
}

class Writer {
  readonly steps: string[] = [];
  constructor(private readonly client: SaasClient) {}

  async send(procedure: string, key: string, input: unknown): Promise<void> {
    try {
      await this.client.mutate(procedure, input, { confirm: true, legalAct: true });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      throw new SaasError(
        `${procedure} failed for "${key}" after ${this.steps.length} completed step(s) [${this.steps.join(", ")}]: ${detail}. Run apply again to continue: records are matched by title, so finished steps are not repeated`,
        { code: cause instanceof SaasError ? cause.code : "APPLY_FAILED", cause },
      );
    }
    this.steps.push(`${procedure} ${key}`);
  }
}

function idByTitle(rows: { title: string; id: string }[], title: string, what: string): string {
  const found = rows.find((row) => row.title.trim() === title);
  if (!found) {
    throw new SaasError(`the ${what} "${title}" is not on the products page after it was written`, {
      code: "NOT_FOUND_AFTER_WRITE",
    });
  }
  return found.id;
}

async function writeProducts(writer: Writer, entries: ApplyEntry[], plan: PlanEntry[]): Promise<void> {
  for (const [index, entry] of entries.entries()) {
    const item = plan[index];
    if (item?.product.action === "create") {
      await writer.send("products.create", item.key, entry.product);
    } else if (item?.product.action === "update") {
      await writer.send("products.update", item.key, { id: item.product.id, ...entry.product });
    }
  }
}

async function writeListings(
  writer: Writer,
  entries: ApplyEntry[],
  plan: PlanEntry[],
  page: ProductsPage,
): Promise<void> {
  for (const [index, entry] of entries.entries()) {
    const item = plan[index];
    if (!item || item.listing.action === "unchanged") continue;
    const productId =
      item.product.id ??
      idByTitle(
        page.products.filter((row) => row.itemType === "product"),
        item.title,
        "product",
      );
    if (item.listing.action === "create") {
      await writer.send("listings.create", item.key, { productId, ...entry.listing });
    } else {
      await writer.send("listings.update", item.key, { id: item.listing.id, productId, ...entry.listing });
    }
  }
}

async function publishListings(writer: Writer, plan: PlanEntry[], page: ProductsPage): Promise<void> {
  for (const item of plan.filter((candidate) => candidate.publish)) {
    const listing = page.listings.find((row) => row.productTitle.trim() === item.title);
    if (!listing) {
      throw new SaasError(`the listing of "${item.title}" is not on the products page`, {
        code: "NOT_FOUND_AFTER_WRITE",
      });
    }
    if (listing.status !== "published") await writer.send("listings.publish", item.key, { id: listing.id });
  }
}

async function execute(
  client: SaasClient,
  entries: ApplyEntry[],
  plan: PlanEntry[],
  page: ProductsPage,
): Promise<string[]> {
  const writer = new Writer(client);
  await writeProducts(writer, entries, plan);
  const created = plan.some((item) => item.product.action === "create");
  const afterProducts = created ? await fetchProductsPage(client) : page;
  await writeListings(writer, entries, plan, afterProducts);
  if (plan.some((item) => item.publish)) {
    const listed = plan.some((item) => item.listing.action === "create");
    await publishListings(writer, plan, listed ? await fetchProductsPage(client) : afterProducts);
  }
  return writer.steps;
}

export async function runApply(client: SaasClient, text: string, flags: ApplyFlags): Promise<ApplyResult> {
  const mode = applyMode(flags);
  const entries = parseApplyInput(text);
  const page = await fetchProductsPage(client);
  const plan = entries.map((entry) => planEntry(entry, page, flags.publish));
  if (mode === "dry-run") return { mode, sent: 0, plan, notCompared: NOT_COMPARED };
  return { mode, steps: await execute(client, entries, plan, page), plan };
}
