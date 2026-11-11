import { describe, expect, it } from "vitest";
import { SaasClient } from "../src/client.js";
import { NotSignedInError, UnexpectedResponseError } from "../src/errors.js";
import {
  fetchProductsPage,
  loadPageLabels,
  PRODUCTS_PAGE,
  parseCommissionLabel,
  parsePriceLabel,
  parseProductsPage,
} from "../src/products-page.js";
import { MemorySessionStore } from "../src/session-store.js";
import { fakeFetch } from "./helpers.js";
import { listing, priceLabel, product, productsPageHtml } from "./products-page-fixture.js";

const NBSP = " ";

describe("price and commission labels", () => {
  it("reads a label whose euro sign follows a non-breaking space (the live page uses U+00A0, a plain-space pattern parsed none of 22 prices)", () => {
    expect(parsePriceLabel(priceLabel("1500", "piece", "one_time"))).toMatchObject({
      price: "1500",
      unit: "piece",
      billingPeriod: "one_time",
    });
  });

  it("turns the grouping dot and decimal comma into a plain decimal (12.500,50 must not become 12.5 or 12500,50)", () => {
    expect(parsePriceLabel(priceLabel("12500.50", "hour", "per_month"))).toMatchObject({
      price: "12500.50",
      unit: "hour",
      billingPeriod: "per_month",
    });
  });

  it("keeps an unmapped unit label visible and its key null (a new unit must not be guessed into a wrong key)", () => {
    const label = `5${NBSP}€ / unknown-unit, ${Object.keys(loadPageLabels().billingPeriods)[0]}`;
    expect(parsePriceLabel(label)).toMatchObject({ unit: null, unitLabel: "unknown-unit", price: "5" });
  });

  it("returns nulls for a label it cannot read instead of a half-parsed price", () => {
    expect(parsePriceLabel("on request")).toEqual({
      price: null,
      unit: null,
      unitLabel: null,
      billingPeriod: null,
    });
    expect(parsePriceLabel(null).price).toBeNull();
  });

  it("tells a percent commission from a fixed one and reads neither from free text (a fixed amount must not be reported as percent)", () => {
    expect(parseCommissionLabel(`10${NBSP}%`)).toEqual({ mode: "percent", value: "10" });
    expect(parseCommissionLabel(`2.500${NBSP}€`)).toEqual({ mode: "fixed", value: "2500" });
    expect(parseCommissionLabel("negotiable")).toEqual({ mode: null, value: null });
  });

  it("loads page labels for every billing period the platform offers (a missing label would parse a period as null)", () => {
    expect(Object.values(loadPageLabels().billingPeriods).sort()).toEqual(["one_time", "per_month"]);
  });
});

describe("parseProductsPage", () => {
  const products = [product(1, "Alpha"), product(2, "Beta", { priceLabel: null, itemType: "proposal" })];
  const listings = [listing(1, "Alpha")];

  it("finds the rows when the flight data is split into chunks mid-row and holds a multi-byte text row (a character count instead of a byte count loses the props row)", () => {
    for (const chunkSize of [1, 7, 37, 500]) {
      const page = parseProductsPage(productsPageHtml(products, listings, chunkSize));
      expect(page.products.map((row) => row.title)).toEqual(["Alpha", "Beta"]);
      expect(page.listings).toHaveLength(1);
    }
  });

  it("links a listing to the product of its title and ignores a proposal of the same title (the listing would be created under an AI proposal)", () => {
    const withProposal = [product(1, "Alpha", { itemType: "proposal" }), product(2, "Alpha")];
    const page = parseProductsPage(productsPageHtml(withProposal, listings));
    expect(page.listings[0]?.productId).toBe(withProposal[1]?.id);
  });

  it("leaves productId null when two products share a title (guessing one would write to the wrong record)", () => {
    const page = parseProductsPage(productsPageHtml([product(1, "Alpha"), product(2, "Alpha")], listings));
    expect(page.listings[0]?.productId).toBeNull();
  });

  it("unescapes a title that starts with a dollar sign (the flight format writes $$5 for $5)", () => {
    const page = parseProductsPage(productsPageHtml([product(1, "$$5 setup")], []));
    expect(page.products[0]?.title).toBe("$5 setup");
  });

  it("fails on a flight reference in a field it reads instead of using the reference text as a title", () => {
    const html = productsPageHtml([product(1, "$L99")], []);
    expect(() => parseProductsPage(html)).toThrow(UnexpectedResponseError);
  });

  it("reports the field names and no row values when a row has the wrong shape (page data must not reach error output)", () => {
    const broken = { ...product(1, "SECRET-TITLE"), listingCount: "many" } as unknown as ReturnType<
      typeof product
    >;
    let thrown: unknown;
    try {
      parseProductsPage(productsPageHtml([broken], []));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(UnexpectedResponseError);
    expect(String((thrown as Error).message)).toContain("listingCount");
    expect(String((thrown as Error).message)).not.toContain("SECRET-TITLE");
  });

  it("fails with a shape error when the page has no products and listings arrays (a redesigned page must not read as an empty account)", () => {
    expect(() => parseProductsPage("<html>nothing</html>")).toThrow(UnexpectedResponseError);
  });
});

describe("fetchProductsPage", () => {
  function clientFor(reply: Parameters<typeof fakeFetch>[0]) {
    const { fetch, calls } = fakeFetch(reply);
    const store = new MemorySessionStore();
    store.save({ session: "COOKIE-VALUE" });
    return { calls, client: new SaasClient({ baseUrl: "https://x.test", fetch, store }) };
  }

  it("reads the page with one GET carrying the session and sends nothing else (the catalogue command must stay read-only)", async () => {
    const { client, calls } = clientFor(() => productsPageHtml([product(1, "Alpha")], []));
    await fetchProductsPage(client);
    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      `GET ${PRODUCTS_PAGE}`,
    ]);
    expect(calls[0]?.headers.get("cookie")).toContain("session=");
    expect(calls[0]?.body).toBeUndefined();
  });

  it("maps a redirect to the login to NotSignedInError and names only the path (a callback token in the query must not be printed)", async () => {
    const { client } = clientFor(() => ({ status: 307, location: "/de/login?callback=SECRET-TOKEN" }));
    const error = await fetchProductsPage(client).catch((caught) => caught);
    expect(error).toBeInstanceOf(NotSignedInError);
    expect(error.message).toContain("/de/login");
    expect(error.message).not.toContain("SECRET-TOKEN");
  });

  it("fails on a server error instead of parsing an error page as an empty catalogue", async () => {
    const { client } = clientFor(() => ({ status: 500, body: "<html>oops</html>" }));
    await expect(fetchProductsPage(client)).rejects.toMatchObject({ code: "PAGE_HTTP", httpStatus: 500 });
  });
});
