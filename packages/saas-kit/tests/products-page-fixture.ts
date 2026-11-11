import { loadPageLabels } from "../src/products-page.js";
import { fakeFetch, okReply, type Recorded, trpcError } from "./helpers.js";

const NBSP = " ";
const labels = loadPageLabels();

function labelFor(table: Record<string, string>, key: string): string {
  const found = Object.entries(table).find(([, value]) => value === key);
  if (!found) throw new Error(`no page label for ${key}`);
  return found[0];
}

export function priceLabel(amount: string, unit: string, period: string): string {
  const [whole = "", fraction] = amount.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const text = fraction ? `${grouped},${fraction}` : grouped;
  return `${text}${NBSP}€ / ${labelFor(labels.units, unit)}, ${labelFor(labels.billingPeriods, period)}`;
}

export interface FixtureProduct {
  id: string;
  title: string;
  itemType: "product" | "proposal";
  kind: string;
  priceLabel: string | null;
  listingCount: number;
}

export interface FixtureListing {
  id: string;
  title: string;
  productTitle: string;
  kind: string;
  status: string;
  priceLabel: string | null;
  region: string;
  commission: string;
}

export const uuid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

export function product(
  index: number,
  title: string,
  overrides: Partial<FixtureProduct> = {},
): FixtureProduct {
  return {
    id: uuid(index),
    title,
    itemType: "product",
    kind: "service",
    priceLabel: priceLabel("1500", "piece", "one_time"),
    listingCount: 0,
    ...overrides,
  };
}

export function listing(
  index: number,
  title: string,
  overrides: Partial<FixtureListing> = {},
): FixtureListing {
  return {
    id: uuid(1000 + index),
    title,
    productTitle: title,
    kind: "service",
    status: "published",
    priceLabel: priceLabel("1500", "piece", "one_time"),
    region: "Region A",
    commission: `10${NBSP}%`,
    ...overrides,
  };
}

function flightRows(products: FixtureProduct[], listings: FixtureListing[]): string {
  const text = "héllo→wörld";
  const props = {
    products,
    listings,
    notice: "$L99",
    canManage: true,
    hrefs: { newProduct: "/x" },
  };
  return [
    `1:I["chunk",[],"default"]\n`,
    `2:T${Buffer.byteLength(text).toString(16)},${text}`,
    `3:["$","$L42",null,${JSON.stringify(props)}]\n`,
    `4:HL["/css",{"as":"style"}]\n`,
  ].join("");
}

export function productsPageHtml(
  products: FixtureProduct[],
  listings: FixtureListing[],
  chunkSize = 37,
): string {
  const flight = flightRows(products, listings);
  const pushes: string[] = [];
  for (let start = 0; start < flight.length; start += chunkSize) {
    pushes.push(
      `<script>self.__next_f.push([1,${JSON.stringify(flight.slice(start, start + chunkSize))}])</script>`,
    );
  }
  return `<!DOCTYPE html><html><body>${pushes.join("")}</body></html>`;
}

export interface Mutation {
  procedure: string;
  input: Record<string, unknown>;
}

export class FakePlatform {
  readonly mutations: Mutation[] = [];
  readonly requests: Recorded[] = [];
  failOn: string | undefined;
  private counter = 100;

  constructor(
    public products: FixtureProduct[] = [],
    public listings: FixtureListing[] = [],
  ) {}

  private readonly handle = (req: Recorded) => {
    this.requests.push(req);
    if (req.method === "GET") return { body: productsPageHtml(this.products, this.listings) };
    const procedure = new URL(req.url).pathname.replace("/api/trpc/", "");
    const input = (JSON.parse(req.body ?? "{}") as Record<string, Record<string, unknown>>)["0"] ?? {};
    if (procedure === this.failOn) return trpcError("INTERNAL_SERVER_ERROR", 500, "boom");
    this.mutations.push({ procedure, input });
    this.record(procedure, input);
    return okReply({ success: true });
  };

  readonly fetch = fakeFetch(this.handle).fetch;

  private record(procedure: string, input: Record<string, unknown>): void {
    const title = String(input["title"] ?? "");
    if (procedure === "products.create") {
      const label = priceLabel(
        String(input["pricePerBlockEuros"] ?? "1"),
        String(input["unit"] ?? "piece"),
        String(input["billingPeriod"] ?? "one_time"),
      );
      this.products.push(product(this.counter++, title, { priceLabel: label }));
    } else if (procedure === "listings.create") {
      const owner = this.products.find((row) => row.id === input["productId"]);
      this.listings.push(
        listing(this.counter++, owner?.title ?? "", {
          status: "draft",
          region: String(input["region"] ?? ""),
          commission: `${String(input["commissionValue"] ?? "0")}${NBSP}%`,
        }),
      );
    } else if (procedure === "listings.publish") {
      const row = this.listings.find((candidate) => candidate.id === input["id"]);
      if (row) row.status = "published";
    }
  }

  get getCount(): number {
    return this.requests.filter((req) => req.method === "GET").length;
  }
}
