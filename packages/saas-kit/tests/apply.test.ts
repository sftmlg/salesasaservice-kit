import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type ApplyFlags, NOT_COMPARED, parseApplyInput, runApply } from "../src/apply.js";
import { SaasClient } from "../src/client.js";
import { ConfigError, ConfirmationRequiredError, LegalActRefusedError, SaasError } from "../src/errors.js";
import { FakePlatform, listing, priceLabel, product } from "./products-page-fixture.js";

const DRY: ApplyFlags = { confirm: false, legalAct: false, publish: false };
const LIVE: ApplyFlags = { confirm: true, legalAct: true, publish: false };

function entry(key: string, title: string, product_: object = {}, listing_: object = {}) {
  return {
    key,
    product: {
      title,
      kind: "service",
      pricePerBlockEuros: "1500",
      unit: "piece",
      billingPeriod: "one_time",
      ...product_,
    },
    listing: { region: "Region A", commissionMode: "percent", commissionValue: "10", ...listing_ },
  };
}

const file = (entries: object[]) => JSON.stringify(entries);

function setup(platform = new FakePlatform()) {
  return { platform, client: new SaasClient({ baseUrl: "https://x.test", fetch: platform.fetch }) };
}

describe("apply guards", () => {
  it("prints a diff and sends no mutation by default (a bare apply must never write)", async () => {
    const { platform, client } = setup();
    const result = await runApply(client, file([entry("a", "Alpha")]), DRY);
    expect(result).toMatchObject({ mode: "dry-run", sent: 0 });
    expect(platform.mutations).toEqual([]);
    expect(platform.getCount).toBe(1);
  });

  it("states in the dry-run which fields never decide an update (silent blind spots would read as 'unchanged')", async () => {
    const { client } = setup();
    const result = await runApply(client, file([entry("a", "Alpha")]), DRY);
    expect(result).toMatchObject({ notCompared: NOT_COMPARED });
    expect(NOT_COMPARED).toContain("description");
  });

  it("refuses --confirm without --legal-act before any request (a confirmed write is a legal act)", async () => {
    const { platform, client } = setup();
    await expect(
      runApply(client, file([entry("a", "Alpha")]), { ...DRY, confirm: true }),
    ).rejects.toBeInstanceOf(LegalActRefusedError);
    expect(platform.requests).toEqual([]);
  });

  it("refuses --legal-act without --confirm before any request (the flag alone must not authorise the write)", async () => {
    const { platform, client } = setup();
    await expect(
      runApply(client, file([entry("a", "Alpha")]), { ...DRY, legalAct: true }),
    ).rejects.toBeInstanceOf(ConfirmationRequiredError);
    expect(platform.requests).toEqual([]);
  });

  it("is not reachable over MCP: no tool, no import in the server or the tool table (apply publishes in the account holder's name)", () => {
    for (const name of ["server.ts", "tools.ts", "mcp-server.ts"]) {
      const source = readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
      expect(source, name).not.toMatch(/apply|runApply/i);
    }
  });
});

describe("apply input", () => {
  it.each([
    ["not JSON", "{oops"],
    ["not an array", "{}"],
    ["no key", file([{ product: { title: "A" }, listing: {} }])],
    ["an empty title", file([entry("a", "   ")])],
    ["a listing that carries productId", file([entry("a", "Alpha", {}, { productId: "x" })])],
    ["a product that carries an id", file([entry("a", "Alpha", { id: "x" })])],
    ["a product that carries a productId", file([entry("a", "Alpha", { productId: "x" })])],
    ["a listing that carries an id", file([entry("a", "Alpha", {}, { id: "x" })])],
    ["a key outside key, product and listing", file([{ ...entry("a", "Alpha"), id: "x" }])],
    ["a repeated key", file([entry("a", "Alpha"), entry("a", "Beta")])],
    ["a repeated title", file([entry("a", "Alpha"), entry("b", " Alpha ")])],
  ])("rejects %s before any request (bad input must not reach the platform)", async (_name, text) => {
    const { platform, client } = setup();
    await expect(runApply(client, text, LIVE)).rejects.toBeInstanceOf(ConfigError);
    expect(platform.requests).toEqual([]);
  });

  it("never lets an id in the file steer a write to another record (the dry run planned Alpha, the write updated Beta)", async () => {
    const platform = new FakePlatform(
      [product(1, "Alpha", { priceLabel: priceLabel("900", "piece", "one_time") }), product(2, "Beta")],
      [listing(1, "Alpha", { commission: "5 %" }), listing(2, "Beta")],
    );
    const text = file([
      entry("a", "Alpha", { id: platform.products[1]?.id }, { id: platform.listings[1]?.id }),
    ]);
    await expect(runApply(setup(platform).client, text, LIVE)).rejects.toBeInstanceOf(ConfigError);
    expect(platform.mutations).toEqual([]);
  });

  it("keeps extra product fields untouched for the platform to validate (the kit does not know the full schema)", () => {
    const [parsed] = parseApplyInput(file([entry("a", "Alpha", { tags: ["x"] })]));
    expect(parsed?.product).toMatchObject({ tags: ["x"] });
  });
});

describe("apply planning", () => {
  it("plans creates for a missing product and its listing", async () => {
    const { client } = setup();
    const result = await runApply(client, file([entry("a", "Alpha")]), DRY);
    expect(result.plan[0]).toMatchObject({ product: { action: "create" }, listing: { action: "create" } });
  });

  it("treats a numerically equal price as unchanged (1500.00 against the label 1.500 must not update every run)", async () => {
    const platform = new FakePlatform([product(1, "Alpha")], [listing(1, "Alpha")]);
    const result = await runApply(
      setup(platform).client,
      file([entry("a", "Alpha", { pricePerBlockEuros: "1500.00" })]),
      DRY,
    );
    expect(result.plan[0]).toMatchObject({
      product: { action: "unchanged" },
      listing: { action: "unchanged" },
    });
  });

  it("matches a title ignoring surrounding spaces (a trailing space must not create a duplicate product)", async () => {
    const platform = new FakePlatform([product(1, "Alpha")], [listing(1, "Alpha")]);
    const result = await runApply(setup(platform).client, file([entry("a", "Alpha ")]), DRY);
    expect(result.plan[0]?.product.action).toBe("unchanged");
  });

  it("does not match an AI proposal of the same title (updating a proposal as a product is a different record)", async () => {
    const platform = new FakePlatform([product(1, "Alpha", { itemType: "proposal", priceLabel: null })]);
    const result = await runApply(setup(platform).client, file([entry("a", "Alpha")]), DRY);
    expect(result.plan[0]?.product.action).toBe("create");
  });

  it("reports price, unit, billing period and commission as from/to changes", async () => {
    const platform = new FakePlatform(
      [product(1, "Alpha", { priceLabel: priceLabel("900", "hour", "per_month") })],
      [listing(1, "Alpha", { commission: "5 %" })],
    );
    const result = await runApply(setup(platform).client, file([entry("a", "Alpha")]), DRY);
    const fields = (part: { changes: { field: string }[] }) => part.changes.map((change) => change.field);
    expect(fields(result.plan[0]?.product ?? { changes: [] })).toEqual([
      "pricePerBlockEuros",
      "unit",
      "billingPeriod",
    ]);
    expect(fields(result.plan[0]?.listing ?? { changes: [] })).toEqual(["commissionValue"]);
    expect(result.plan[0]?.listing.changes[0]).toEqual({ field: "commissionValue", from: "5", to: "10" });
  });

  it("treats an empty titleOverride as no override (the listing showing the product title must not update on every run)", async () => {
    const platform = new FakePlatform([product(1, "Alpha")], [listing(1, "Alpha")]);
    const result = await runApply(
      setup(platform).client,
      file([entry("a", "Alpha", {}, { titleOverride: "" })]),
      LIVE,
    );
    expect(result.plan[0]?.listing.action).toBe("unchanged");
    expect(platform.mutations).toEqual([]);
  });

  it("plans clearing a shown override when titleOverride is empty (clearing must still be detected)", async () => {
    const platform = new FakePlatform(
      [product(1, "Alpha")],
      [listing(1, "Alpha", { title: "Special offer" })],
    );
    const result = await runApply(
      setup(platform).client,
      file([entry("a", "Alpha", {}, { titleOverride: "" })]),
      DRY,
    );
    expect(result.plan[0]?.listing.changes).toEqual([
      { field: "titleOverride", from: "Special offer", to: "" },
    ]);
  });

  it("stops on two products of one title without sending anything (matching by title would be a guess)", async () => {
    const platform = new FakePlatform([product(1, "Alpha"), product(2, "Alpha")]);
    await expect(runApply(setup(platform).client, file([entry("a", "Alpha")]), LIVE)).rejects.toMatchObject({
      code: "AMBIGUOUS_TITLE",
    });
    expect(platform.mutations).toEqual([]);
  });

  it("stops on a price label it cannot read instead of writing over it (an unreadable label must not count as changed)", async () => {
    const platform = new FakePlatform([product(1, "Alpha", { priceLabel: "on request" })]);
    await expect(runApply(setup(platform).client, file([entry("a", "Alpha")]), LIVE)).rejects.toMatchObject({
      code: "UNREADABLE_LABEL",
    });
    expect(platform.mutations).toEqual([]);
  });

  it("rejects a non-numeric price in the file (NaN compares unequal and would update on every run)", async () => {
    const platform = new FakePlatform([product(1, "Alpha")], [listing(1, "Alpha")]);
    await expect(
      runApply(setup(platform).client, file([entry("a", "Alpha", { pricePerBlockEuros: "ten" })]), DRY),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});

describe("apply writes", () => {
  it("creates the product, then the listing under the id read back from the page (the create answer was never observed, so no id may be taken from it)", async () => {
    const { platform, client } = setup();
    const result = await runApply(client, file([entry("a", "Alpha")]), LIVE);
    expect(platform.mutations.map((mutation) => mutation.procedure)).toEqual([
      "products.create",
      "listings.create",
    ]);
    const created = platform.products[0];
    expect(platform.mutations[1]?.input).toMatchObject({ productId: created?.id, region: "Region A" });
    expect(platform.mutations[0]?.input).not.toHaveProperty("id");
    expect(result).toMatchObject({ mode: "apply", steps: ["products.create a", "listings.create a"] });
  });

  it("updates a changed product with its id and all given fields, and a changed listing with id and productId", async () => {
    const platform = new FakePlatform(
      [product(1, "Alpha", { priceLabel: priceLabel("900", "piece", "one_time") })],
      [listing(1, "Alpha", { commission: "5 %" })],
    );
    await runApply(setup(platform).client, file([entry("a", "Alpha")]), LIVE);
    expect(platform.mutations.map((mutation) => mutation.procedure)).toEqual([
      "products.update",
      "listings.update",
    ]);
    expect(platform.mutations[0]?.input).toMatchObject({
      id: platform.products[0]?.id,
      title: "Alpha",
      pricePerBlockEuros: "1500",
    });
    expect(platform.mutations[1]?.input).toMatchObject({
      id: platform.listings[0]?.id,
      productId: platform.products[0]?.id,
    });
  });

  it("sends nothing for records that already match, even with both flags", async () => {
    const platform = new FakePlatform([product(1, "Alpha")], [listing(1, "Alpha")]);
    await runApply(setup(platform).client, file([entry("a", "Alpha")]), LIVE);
    expect(platform.mutations).toEqual([]);
  });

  it("never publishes without --publish (a created listing stays a draft)", async () => {
    const { platform, client } = setup();
    await runApply(client, file([entry("a", "Alpha")]), LIVE);
    expect(platform.mutations.map((mutation) => mutation.procedure)).not.toContain("listings.publish");
    expect(platform.listings[0]?.status).toBe("draft");
  });

  it("with --publish publishes the new draft listing by the id read back and skips a listing that is already published", async () => {
    const platform = new FakePlatform([product(1, "Alpha")], [listing(1, "Alpha")]);
    await runApply(setup(platform).client, file([entry("a", "Alpha"), entry("b", "Beta")]), {
      ...LIVE,
      publish: true,
    });
    const published = platform.mutations.filter((mutation) => mutation.procedure === "listings.publish");
    expect(published).toHaveLength(1);
    expect(published[0]?.input).toEqual({ id: platform.listings[1]?.id });
    expect(platform.listings.map((row) => row.status)).toEqual(["published", "published"]);
  });

  it("shows the planned publish in the dry-run and sends nothing", async () => {
    const { platform, client } = setup();
    const result = await runApply(client, file([entry("a", "Alpha")]), { ...DRY, publish: true });
    expect(result.plan[0]?.publish).toBe(true);
    expect(platform.mutations).toEqual([]);
  });

  it("reports the completed steps when a later write fails and sends nothing after it (a half-applied run must say where it stopped)", async () => {
    const platform = new FakePlatform();
    platform.failOn = "listings.create";
    const error = await runApply(
      setup(platform).client,
      file([entry("a", "Alpha"), entry("b", "Beta")]),
      LIVE,
    ).catch((caught) => caught);
    expect(error).toBeInstanceOf(SaasError);
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).toContain("products.create a");
    expect(error.message).toContain("products.create b");
    expect(platform.mutations.map((mutation) => mutation.procedure)).toEqual([
      "products.create",
      "products.create",
    ]);
  });

  it("is idempotent on a second run: the records created by the first run are found by title and nothing is sent again", async () => {
    const platform = new FakePlatform();
    const { client } = setup(platform);
    await runApply(client, file([entry("a", "Alpha")]), { ...LIVE, publish: true });
    const sent = platform.mutations.length;
    await runApply(client, file([entry("a", "Alpha")]), { ...LIVE, publish: true });
    expect(platform.mutations).toHaveLength(sent);
  });
});
