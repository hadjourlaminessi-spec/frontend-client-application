import { ApiError, isRateLimitError } from "../api";

// Mock keycloak-js at the module level
jest.mock("keycloak-js");

describe("ApiError", () => {
  it("creates an error with status and payload", () => {
    const err = new ApiError(404, { message: "Not Found" });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(404);
    expect(err.payload).toEqual({ message: "Not Found" });
    expect(err.message).toBe("Not Found");
  });

  it("uses custom message when provided", () => {
    const err = new ApiError(500, null, "Server down");
    expect(err.message).toBe("Server down");
  });

  it("falls back to generic message when no payload message", () => {
    const err = new ApiError(500, null);
    expect(err.message).toBe("API Error 500");
  });
});

describe("isRateLimitError", () => {
  it("returns true for ApiError with status 429", () => {
    const err = new ApiError(429, null);
    expect(isRateLimitError(err)).toBe(true);
  });

  it("returns false for ApiError with other status", () => {
    const err = new ApiError(500, null);
    expect(isRateLimitError(err)).toBe(false);
  });

  it("returns false for non-ApiError", () => {
    expect(isRateLimitError(new Error("oops"))).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError("string")).toBe(false);
  });
});

describe("catalogService", () => {
  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("getProducts calls fetch and returns products array", async () => {
    const products = [
      { id: "1", name: "Laptop", price: 999, category: "Informatique" },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(products)),
    });

    // Dynamic import to get fresh module with mocked fetch
    const { catalogService } = await import("../api");
    const result = await catalogService.getProducts();
    expect(result).toEqual(products);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("getProducts passes query params for filters", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("[]"),
    });

    const { catalogService } = await import("../api");
    await catalogService.getProducts({
      name: "laptop",
      category: "Informatique",
      minPrice: 100,
      maxPrice: 2000,
    });

    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toContain("name=laptop");
    expect(url).toContain("category=Informatique");
    expect(url).toContain("minPrice=100");
    expect(url).toContain("maxPrice=2000");
  });

  it("getProducts throws ApiError on invalid payload", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ error: "bad" })),
    });

    const { catalogService } = await import("../api");
    await expect(catalogService.getProducts()).rejects.toThrow(
      "Invalid payload from catalog service"
    );
  });

  it("createProduct sends POST with payload", async () => {
    const created = {
      id: "new-1",
      name: "Mouse",
      price: 29,
      category: "Périphériques",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(created)),
    });

    const { catalogService } = await import("../api");
    const result = await catalogService.createProduct({
      name: "Mouse",
      price: 29,
      category: "Périphériques",
    });

    expect(result).toEqual(created);
    const opts = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({
      name: "Mouse",
      price: 29,
      category: "Périphériques",
    });
  });

  it("deleteProduct sends DELETE", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: () => Promise.resolve(""),
    });

    const { catalogService } = await import("../api");
    await catalogService.deleteProduct("abc-123");

    const opts = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(opts.method).toBe("DELETE");
    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toContain("abc-123");
  });
});

describe("orderService", () => {
  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("createOrder sends POST and returns order", async () => {
    const order = {
      id: "o1",
      user_id: "u1",
      products: [],
      total_price: 100,
      status: "CREATED",
      created_at: "2024-01-01",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(order)),
    });

    const { orderService } = await import("../api");
    const result = await orderService.createOrder({
      user_id: "u1",
      products: [{ product_id: "p1", quantity: 2 }],
    });

    expect(result).toEqual(order);
    const opts = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(opts.method).toBe("POST");
  });

  it("getOrders returns array of orders", async () => {
    const orders = [
      {
        id: "o1",
        user_id: "u1",
        products: [],
        total_price: 50,
        status: "PAID",
        created_at: "2024-01-01",
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(orders)),
    });

    const { orderService } = await import("../api");
    const result = await orderService.getOrders();
    expect(result).toEqual(orders);
  });

  it("getOrder returns single order", async () => {
    const order = {
      id: "o1",
      user_id: "u1",
      products: [],
      total_price: 50,
      status: "PAID",
      created_at: "2024-01-01",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(order)),
    });

    const { orderService } = await import("../api");
    const result = await orderService.getOrder("o1");
    expect(result).toEqual(order);
  });

  it("createOrder re-throws on error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ message: "fail" })),
    });

    const { orderService } = await import("../api");
    await expect(
      orderService.createOrder({ user_id: "u1", products: [] })
    ).rejects.toMatchObject({ status: 500 });
  });

  it("getOrders re-throws on error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("{}"),
    });

    const { orderService } = await import("../api");
    await expect(orderService.getOrders()).rejects.toMatchObject({ status: 500 });
  });

  it("getOrder re-throws on error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("{}"),
    });

    const { orderService } = await import("../api");
    await expect(orderService.getOrder("x")).rejects.toMatchObject({ status: 404 });
  });

  it("updateOrderStatus re-throws on error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("{}"),
    });

    const { orderService } = await import("../api");
    await expect(
      orderService.updateOrderStatus("o1", "PAID")
    ).rejects.toMatchObject({ status: 500 });
  });

  it("updateOrderStatus sends PATCH", async () => {
    const updated = {
      id: "o1",
      user_id: "u1",
      products: [],
      total_price: 50,
      status: "PAID",
      created_at: "2024-01-01",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(updated)),
    });

    const { orderService } = await import("../api");
    const result = await orderService.updateOrderStatus("o1", "PAID");
    expect(result.status).toBe("PAID");
    const opts = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body)).toEqual({ status: "PAID" });
  });
});

describe("paymentService", () => {
  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("createPayment normalizes camelCase response to snake_case", async () => {
    const backendResponse = {
      id: "pay1",
      orderId: "o1",
      userId: "u1",
      amount: 100,
      status: "SUCCESS",
      createdAt: "2024-01-01T00:00:00Z",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(backendResponse)),
    });

    const { paymentService } = await import("../api");
    const result = await paymentService.createPayment({
      order_id: "o1",
      user_id: "u1",
      amount: 100,
    });

    expect(result.order_id).toBe("o1");
    expect(result.user_id).toBe("u1");
    expect(result.created_at).toBe("2024-01-01T00:00:00Z");
  });

  it("getPayments normalizes array of payments", async () => {
    const backendResponse = [
      {
        id: "pay1",
        orderId: "o1",
        userId: "u1",
        amount: 50,
        status: "SUCCESS",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(backendResponse)),
    });

    const { paymentService } = await import("../api");
    const result = await paymentService.getPayments();
    expect(result).toHaveLength(1);
    expect(result[0].order_id).toBe("o1");
    expect(result[0].user_id).toBe("u1");
  });

  it("createPayment handles snake_case response", async () => {
    const backendResponse = {
      id: "pay2",
      order_id: "o2",
      user_id: "u2",
      amount: 200,
      status: "FAILED",
      created_at: "2024-02-01T00:00:00Z",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(backendResponse)),
    });

    const { paymentService } = await import("../api");
    const result = await paymentService.createPayment({
      order_id: "o2",
      user_id: "u2",
      amount: 200,
    });

    expect(result.order_id).toBe("o2");
    expect(result.user_id).toBe("u2");
    expect(result.created_at).toBe("2024-02-01T00:00:00Z");
  });

  it("getPayments handles snake_case response", async () => {
    const backendResponse = [
      {
        id: "pay2",
        order_id: "o2",
        user_id: "u2",
        amount: 75,
        status: "FAILED",
        created_at: "2024-02-01T00:00:00Z",
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(backendResponse)),
    });

    const { paymentService } = await import("../api");
    const result = await paymentService.getPayments();
    expect(result[0].order_id).toBe("o2");
    expect(result[0].created_at).toBe("2024-02-01T00:00:00Z");
  });

  it("getPayments handles non-array response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ not: "array" })),
    });

    const { paymentService } = await import("../api");
    const result = await paymentService.getPayments();
    expect(result).toEqual([]);
  });

  it("getPayment handles snake_case response", async () => {
    const backendResponse = {
      id: "pay2",
      order_id: "o2",
      user_id: "u2",
      amount: 100,
      status: "SUCCESS",
      created_at: "2024-02-01T00:00:00Z",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(backendResponse)),
    });

    const { paymentService } = await import("../api");
    const result = await paymentService.getPayment("pay2");
    expect(result.order_id).toBe("o2");
    expect(result.created_at).toBe("2024-02-01T00:00:00Z");
  });

  it("createPayment re-throws on error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("{}"),
    });

    const { paymentService } = await import("../api");
    await expect(
      paymentService.createPayment({ order_id: "o1", user_id: "u1", amount: 10 })
    ).rejects.toMatchObject({ status: 500 });
  });

  it("getPayments re-throws on error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("{}"),
    });

    const { paymentService } = await import("../api");
    await expect(paymentService.getPayments()).rejects.toMatchObject({ status: 500 });
  });

  it("getPayment re-throws on error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("{}"),
    });

    const { paymentService } = await import("../api");
    await expect(paymentService.getPayment("x")).rejects.toMatchObject({ status: 404 });
  });

  it("getPayment normalizes single payment", async () => {
    const backendResponse = {
      id: "pay1",
      orderId: "o1",
      userId: "u1",
      amount: 100,
      status: "FAILED",
      createdAt: "2024-01-01T00:00:00Z",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(backendResponse)),
    });

    const { paymentService } = await import("../api");
    const result = await paymentService.getPayment("pay1");
    expect(result.status).toBe("FAILED");
    expect(result.order_id).toBe("o1");
  });
});
