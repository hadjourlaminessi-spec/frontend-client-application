jest.mock("keycloak-js");

describe("http module", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("buildUrl", () => {
    it("returns dev proxy paths when NODE_ENV is development", () => {
      process.env.NODE_ENV = "development";
      const { buildUrl } = require("../http");

      expect(buildUrl("CATALOG", "")).toBe("/api/catalog");
      expect(buildUrl("ORDERS", "")).toBe("/api/orders");
      expect(buildUrl("PAYMENT", "")).toBe("/api/payments");
    });

    it("appends path in dev mode", () => {
      process.env.NODE_ENV = "development";
      const { buildUrl } = require("../http");

      expect(buildUrl("CATALOG", "?name=test")).toBe("/api/catalog?name=test");
      expect(buildUrl("ORDERS", "/order-123")).toBe("/api/orders/order-123");
    });

    it("returns config URLs when NODE_ENV is production", () => {
      process.env.NODE_ENV = "production";
      const { buildUrl } = require("../http");

      expect(buildUrl("CATALOG")).toBe("http://localhost:4000");
      expect(buildUrl("ORDERS")).toBe("http://localhost:8000");
      expect(buildUrl("PAYMENT")).toBe("http://localhost:8082");
    });

    it("concatenates base and path in production", () => {
      process.env.NODE_ENV = "production";
      const { buildUrl } = require("../http");

      expect(buildUrl("CATALOG", "/products")).toBe(
        "http://localhost:4000/products"
      );
    });

    it("cleans trailing slash from base before joining path", () => {
      process.env.NODE_ENV = "production";
      process.env.REACT_APP_CATALOG = "http://catalog.example.com/";
      const { buildUrl } = require("../http");

      expect(buildUrl("CATALOG", "/products")).toBe(
        "http://catalog.example.com/products"
      );
    });
  });

  describe("doFetch", () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("injects Authorization and tracing headers", async () => {
      process.env.NODE_ENV = "test";
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve('"ok"'),
      });

      const { doFetch } = require("../http");
      await doFetch("http://example.com/api");

      const callHeaders = (global.fetch as jest.Mock).mock.calls[0][1].headers;
      expect(callHeaders).toHaveProperty("Authorization");
      expect(callHeaders.Authorization).toMatch(/^Bearer /);
      expect(callHeaders).toHaveProperty("X-Correlation-ID");
      expect(callHeaders).toHaveProperty("traceparent");
    });

    it("parses JSON response", async () => {
      process.env.NODE_ENV = "test";
      const data = { foo: "bar" };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify(data)),
      });

      const { doFetch } = require("../http");
      const result = await doFetch("http://example.com/api");
      expect(result).toEqual(data);
    });

    it("returns text when content-type is not JSON", async () => {
      process.env.NODE_ENV = "test";
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        text: () => Promise.resolve("plain text"),
      });

      const { doFetch } = require("../http");
      const result = await doFetch("http://example.com/api");
      expect(result).toBe("plain text");
    });

    it("throws ApiError on non-ok response", async () => {
      process.env.NODE_ENV = "test";
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify({ message: "Not Found" })),
      });

      const { doFetch } = require("../http");
      await expect(doFetch("http://example.com/api")).rejects.toMatchObject({
        status: 404,
      });
    });

    it("dispatches rate-limit event on 429 response", async () => {
      process.env.NODE_ENV = "test";
      const dispatchSpy = jest.spyOn(window, "dispatchEvent");
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve("{}"),
      });

      const { doFetch } = require("../http");
      await expect(doFetch("http://example.com/api")).rejects.toMatchObject({
        status: 429,
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "api:rate-limit" })
      );
      dispatchSpy.mockRestore();
    });

    it("dispatches rate-limit event and throws ApiError(429) on network error", async () => {
      process.env.NODE_ENV = "test";
      const dispatchSpy = jest.spyOn(window, "dispatchEvent");
      (global.fetch as jest.Mock).mockRejectedValue(
        new TypeError("Failed to fetch")
      );

      const { doFetch } = require("../http");
      await expect(doFetch("http://example.com/api")).rejects.toMatchObject({
        status: 429,
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "api:rate-limit" })
      );
      dispatchSpy.mockRestore();
    });
  });
});
