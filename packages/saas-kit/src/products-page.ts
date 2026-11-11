import { readFileSync } from "node:fs";
import { z } from "zod";
import type { SaasClient } from "./client.js";
import { NotSignedInError, UnexpectedResponseError } from "./errors.js";

export const PRODUCTS_PAGE = "/de/business-partner/products-services";

export type BillingPeriod = "one_time" | "per_month";
export type CommissionMode = "percent" | "fixed";

export interface ProductRow {
  id: string;
  itemType: string;
  title: string;
  kind: string;
  priceLabel: string | null;
  price: string | null;
  unit: string | null;
  unitLabel: string | null;
  billingPeriod: BillingPeriod | null;
  listingCount: number;
}

export interface ListingRow {
  id: string;
  productId: string | null;
  productTitle: string;
  title: string;
  kind: string;
  status: string;
  priceLabel: string | null;
  price: string | null;
  unit: string | null;
  unitLabel: string | null;
  billingPeriod: BillingPeriod | null;
  region: string;
  commissionLabel: string | null;
  commissionMode: CommissionMode | null;
  commissionValue: string | null;
}

export interface ProductsPage {
  products: ProductRow[];
  listings: ListingRow[];
}

const FLIGHT_PUSH = /self\.__next_f\.push\((\[.*?\])\)<\/script>/gs;
const NEWLINE = 10;
const PRICE_LABEL = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))? € \/ (.+), (.+)$/;
const COMMISSION_LABEL = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))? (%|€)$/;
export const PAGE_LABELS_FILE = new URL("../data/page-labels.json", import.meta.url);

const labelsSchema = z.object({
  measured: z.string(),
  billingPeriods: z.record(z.string(), z.enum(["one_time", "per_month"])),
  units: z.record(z.string(), z.string()),
});

export function loadPageLabels(file: URL = PAGE_LABELS_FILE) {
  return labelsSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

const PAGE_LABELS = loadPageLabels();

const flightText = z
  .string()
  .refine((value) => !/^\$(?!\$)./.test(value), "unresolved flight reference")
  .transform((value) => (value.startsWith("$$") ? value.slice(1) : value));

const productSchema = z.object({
  id: flightText,
  itemType: flightText,
  title: flightText,
  kind: flightText,
  priceLabel: flightText.nullish(),
  listingCount: z.number(),
});

const listingSchema = z.object({
  id: flightText,
  title: flightText,
  productTitle: flightText,
  kind: flightText,
  status: flightText,
  priceLabel: flightText.nullish(),
  region: flightText.nullish(),
  commission: flightText.nullish(),
});

function pushedFlight(html: string): Buffer {
  const parts: string[] = [];
  for (const match of html.matchAll(FLIGHT_PUSH)) {
    let push: unknown;
    try {
      push = JSON.parse(match[1] ?? "");
    } catch (cause) {
      throw new UnexpectedResponseError("a flight chunk of the products page is not JSON", {
        code: "PAGE_SHAPE",
        cause,
      });
    }
    if (Array.isArray(push) && push[0] === 1 && typeof push[1] === "string") parts.push(push[1]);
  }
  return Buffer.from(parts.join(""), "utf8");
}

function readHexUntil(
  bytes: Buffer,
  start: number,
  stop: string,
): { value: number; end: number } | undefined {
  const end = bytes.indexOf(stop, start, "latin1");
  if (end < 0) return undefined;
  const text = bytes.subarray(start, end).toString("latin1");
  return /^[0-9a-f]+$/.test(text) ? { value: Number.parseInt(text, 16), end } : undefined;
}

function nextRow(bytes: Buffer, start: number): { text: string; next: number } | undefined {
  const idEnd = readHexUntil(bytes, start, ":");
  if (!idEnd) return undefined;
  const bodyStart = idEnd.end + 1;
  if (bytes[bodyStart] === "T".charCodeAt(0)) {
    const length = readHexUntil(bytes, bodyStart + 1, ",");
    if (!length) return undefined;
    return { text: "", next: length.end + 1 + length.value };
  }
  const newline = bytes.indexOf(NEWLINE, bodyStart);
  const end = newline < 0 ? bytes.length : newline;
  return { text: bytes.subarray(bodyStart, end).toString("utf8"), next: end + 1 };
}

function tryParse(text: string): { value: unknown } | undefined {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return undefined;
  }
}

function jsonRows(bytes: Buffer): unknown[] {
  const rows: unknown[] = [];
  let position = 0;
  while (position < bytes.length) {
    const row = nextRow(bytes, position);
    if (!row) {
      position = bytes.indexOf(NEWLINE, position) + 1 || bytes.length;
      continue;
    }
    position = row.next;
    const parsed = tryParse(row.text);
    if (parsed) rows.push(parsed.value);
  }
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findProps(root: unknown): { products: unknown[]; listings: unknown[] } | undefined {
  const pending: unknown[] = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (Array.isArray(node)) {
      pending.push(...node);
    } else if (isRecord(node)) {
      if (Array.isArray(node["products"]) && Array.isArray(node["listings"])) {
        return { products: node["products"], listings: node["listings"] };
      }
      pending.push(...Object.values(node));
    }
  }
  return undefined;
}

function plainSpaces(label: string): string {
  return label.replace(/[\u00a0\u202f]/g, " ");
}

function decimal(whole: string, fraction: string | undefined): string {
  const digits = whole.replaceAll(".", "");
  return fraction ? `${digits}.${fraction}` : digits;
}

export function parsePriceLabel(label: string | null | undefined): {
  price: string | null;
  unit: string | null;
  unitLabel: string | null;
  billingPeriod: BillingPeriod | null;
} {
  const match = label ? PRICE_LABEL.exec(plainSpaces(label)) : null;
  if (!match) return { price: null, unit: null, unitLabel: null, billingPeriod: null };
  const unitLabel = match[3] ?? "";
  return {
    price: decimal(match[1] ?? "", match[2]),
    unit: PAGE_LABELS.units[unitLabel] ?? null,
    unitLabel,
    billingPeriod: PAGE_LABELS.billingPeriods[match[4] ?? ""] ?? null,
  };
}

export function parseCommissionLabel(label: string | null | undefined): {
  mode: CommissionMode | null;
  value: string | null;
} {
  const match = label ? COMMISSION_LABEL.exec(plainSpaces(label)) : null;
  if (!match) return { mode: null, value: null };
  return { mode: match[3] === "%" ? "percent" : "fixed", value: decimal(match[1] ?? "", match[2]) };
}

function toProduct(raw: unknown): ProductRow {
  const row = productSchema.parse(raw);
  return {
    id: row.id,
    itemType: row.itemType,
    title: row.title,
    kind: row.kind,
    priceLabel: row.priceLabel ?? null,
    ...parsePriceLabel(row.priceLabel),
    listingCount: row.listingCount,
  };
}

function productIdFor(products: ProductRow[], title: string): string | null {
  const matches = products.filter((product) => product.itemType === "product" && product.title === title);
  return matches.length === 1 ? (matches[0]?.id ?? null) : null;
}

function toListing(raw: unknown, products: ProductRow[]): ListingRow {
  const row = listingSchema.parse(raw);
  const commission = parseCommissionLabel(row.commission);
  return {
    id: row.id,
    productId: productIdFor(products, row.productTitle),
    productTitle: row.productTitle,
    title: row.title,
    kind: row.kind,
    status: row.status,
    priceLabel: row.priceLabel ?? null,
    ...parsePriceLabel(row.priceLabel),
    region: row.region ?? "",
    commissionLabel: row.commission ?? null,
    commissionMode: commission.mode,
    commissionValue: commission.value,
  };
}

export function parseProductsPage(html: string): ProductsPage {
  const rows = jsonRows(pushedFlight(html));
  const props = rows.map(findProps).find((found) => found !== undefined);
  if (!props) {
    throw new UnexpectedResponseError(
      `the products page has an unknown shape: ${rows.length} flight rows, none holding both a products and a listings array`,
      { code: "PAGE_SHAPE" },
    );
  }
  try {
    const products = props.products.map(toProduct);
    return { products, listings: props.listings.map((raw) => toListing(raw, products)) };
  } catch (cause) {
    const fields = cause instanceof z.ZodError ? cause.issues.map((issue) => issue.path.join(".")) : [];
    throw new UnexpectedResponseError(
      `the products page rows do not have the expected fields (${[...new Set(fields)].join(", ")})`,
      { code: "PAGE_SHAPE", cause },
    );
  }
}

export async function fetchProductsPage(client: SaasClient): Promise<ProductsPage> {
  const res = await client.http(PRODUCTS_PAGE, { accept: "text/html" });
  const redirected = res.status >= 300 && res.status < 400;
  if (redirected || res.status === 401 || res.status === 403) {
    const target = res.location ? new URL(res.location, client.baseUrl).pathname : "nowhere";
    throw new NotSignedInError(
      `the products page answered HTTP ${res.status} towards ${target}: run login first`,
      { code: "NOT_SIGNED_IN", httpStatus: res.status },
    );
  }
  if (res.status !== 200) {
    throw new UnexpectedResponseError(`the products page answered HTTP ${res.status}`, {
      code: "PAGE_HTTP",
      httpStatus: res.status,
    });
  }
  return parseProductsPage(res.text);
}
