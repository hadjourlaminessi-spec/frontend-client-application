import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrdersPage from "../OrdersPage";
import { CartProvider } from "../../../lib/cart";
import type { Order, Product } from "../../../types/api";

jest.mock("keycloak-js");

const mockOrders: Order[] = [
  {
    id: "order-001",
    user_id: "user-1",
    products: [{ product_id: "p1", quantity: 2, name: "Laptop", price: 999 }],
    total_price: 1998,
    status: "CREATED",
    created_at: "2024-06-15T10:30:00Z",
  },
  {
    id: "order-002",
    user_id: "user-1",
    products: [{ product_id: "p2", quantity: 1, name: "Mouse", price: 29 }],
    total_price: 29,
    status: "PAID",
    created_at: "2024-06-14T08:00:00Z",
  },
  {
    id: "order-003",
    user_id: "user-1",
    products: [{ product_id: "p3", quantity: 3 }],
    total_price: 150,
    status: "FAILED",
    created_at: "2024-06-13T14:00:00Z",
  },
];

const mockProducts: Product[] = [
  { id: "p1", name: "Laptop", price: 999, category: "Informatique" },
  { id: "p2", name: "Mouse", price: 29, category: "Périphériques" },
  { id: "p3", name: "Tablet", price: 50, category: "Tablettes" },
];

function renderOrders(highlightOrderId: string | null = null) {
  return render(
    <CartProvider>
      <OrdersPage highlightOrderId={highlightOrderId} />
    </CartProvider>
  );
}

let fetchCallIndex = 0;

function setupDefaultFetch() {
  fetchCallIndex = 0;
  global.fetch = jest.fn().mockImplementation(() => {
    const currentCall = fetchCallIndex++;
    if (currentCall === 0) {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify(mockOrders)),
      });
    } else {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify(mockProducts)),
      });
    }
  });
}

beforeEach(() => {
  setupDefaultFetch();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("OrdersPage", () => {
  it("renders loading skeletons initially", () => {
    renderOrders();
    const skeletons = document.querySelectorAll(".skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays orders after loading", async () => {
    renderOrders();
    await waitFor(() => {
      expect(screen.getByText(/3 commandes/)).toBeInTheDocument();
    });
  });

  it("displays order status stats", async () => {
    renderOrders();
    await waitFor(() => {
      expect(screen.getByText(/3 commandes/)).toBeInTheDocument();
    });
    const statCards = document.querySelectorAll(".stat-card");
    expect(statCards.length).toBe(3);
    expect(screen.getAllByText("En attente").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Payées")).toBeInTheDocument();
    expect(screen.getByText("Échouées")).toBeInTheDocument();
  });

  it("shows empty state when no orders", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("[]"),
    });

    renderOrders();
    await waitFor(() => {
      expect(screen.getByText("Aucune commande")).toBeInTheDocument();
    });
  });

  it("shows error state on API failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ message: "Server Error" })),
    });

    renderOrders();
    await waitFor(() => {
      expect(
        screen.getByText(/Impossible de charger les commandes/)
      ).toBeInTheDocument();
    });
  });

  it("highlights order when highlightOrderId matches", async () => {
    renderOrders("order-001");
    await waitFor(() => {
      expect(screen.getByText("Nouvelle")).toBeInTheDocument();
    });
  });

  it("expands order details when header is clicked", async () => {
    const user = userEvent.setup();
    renderOrders();
    await waitFor(() => {
      expect(screen.getByText(/3 commandes/)).toBeInTheDocument();
    });

    // order-002 (PAID) is collapsed — click its header to expand
    const orderHeaders = document.querySelectorAll(".card-header");
    // Find the PAID order header (contains "Payée" badge)
    const paidHeader = Array.from(orderHeaders).find((h) =>
      h.textContent?.includes("Payée")
    );
    expect(paidHeader).toBeTruthy();

    await user.click(paidHeader!);

    // Should now show the product table with "Mouse"
    await waitFor(() => {
      expect(screen.getByText("user_id")).toBeInTheDocument();
    });
  });

  it("shows 'Payer' button for CREATED orders and handles successful payment", async () => {
    const user = userEvent.setup();
    // Only one CREATED order
    const singleCreatedOrder: Order[] = [
      {
        id: "order-pay-test",
        user_id: "user-1",
        products: [{ product_id: "p1", quantity: 1, name: "Laptop", price: 999 }],
        total_price: 999,
        status: "CREATED",
        created_at: "2024-06-15T10:30:00Z",
      },
    ];

    let callIdx = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        // getOrders
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(singleCreatedOrder)),
        });
      }
      if (callIdx === 2) {
        // getProducts
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(mockProducts)),
        });
      }
      if (callIdx === 3) {
        // createPayment -> SUCCESS
        return Promise.resolve({
          ok: true,
          status: 201,
          headers: new Headers({ "content-type": "application/json" }),
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: "pay-1",
                orderId: "order-pay-test",
                userId: "user-1",
                amount: 999,
                status: "SUCCESS",
                createdAt: "2024-06-15T11:00:00Z",
              })
            ),
        });
      }
      // updateOrderStatus
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: () =>
          Promise.resolve(
            JSON.stringify({ ...singleCreatedOrder[0], status: "PAID" })
          ),
      });
    });

    renderOrders("order-pay-test");

    await waitFor(() => {
      expect(screen.getByText(/Payer/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Payer/));

    await waitFor(() => {
      expect(screen.getByText("Paiement accepté")).toBeInTheDocument();
    });
  });

  it("shows error when payment service fails (500)", async () => {
    const user = userEvent.setup();
    const singleCreatedOrder: Order[] = [
      {
        id: "order-fail",
        user_id: "user-1",
        products: [{ product_id: "p1", quantity: 1, name: "Laptop", price: 999 }],
        total_price: 999,
        status: "CREATED",
        created_at: "2024-06-15T10:30:00Z",
      },
    ];

    let callIdx = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(singleCreatedOrder)),
        });
      }
      if (callIdx === 2) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(mockProducts)),
        });
      }
      // createPayment -> 500
      return Promise.resolve({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify({ message: "Server Error" })),
      });
    });

    renderOrders("order-fail");

    await waitFor(() => {
      expect(screen.getByText(/Payer/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Payer/));

    await waitFor(() => {
      expect(screen.getByText(/payment-service indisponible/)).toBeInTheDocument();
    });
  });

  it("shows error when payment is blocked (403 velocity_exceeded)", async () => {
    const user = userEvent.setup();
    const singleCreatedOrder: Order[] = [
      {
        id: "order-blocked",
        user_id: "user-1",
        products: [{ product_id: "p1", quantity: 1, name: "Laptop", price: 999 }],
        total_price: 999,
        status: "CREATED",
        created_at: "2024-06-15T10:30:00Z",
      },
    ];

    let callIdx = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(singleCreatedOrder)),
        });
      }
      if (callIdx === 2) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(mockProducts)),
        });
      }
      // createPayment -> 403 velocity_exceeded
      return Promise.resolve({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        text: () =>
          Promise.resolve(
            JSON.stringify({ reason: "velocity_exceeded: too many attempts" })
          ),
      });
    });

    renderOrders("order-blocked");

    await waitFor(() => {
      expect(screen.getByText(/Payer/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Payer/));

    await waitFor(() => {
      expect(screen.getByText(/trop de tentatives/)).toBeInTheDocument();
    });
  });

  it("shows error when payment is blocked (403 amount_exceeded)", async () => {
    const user = userEvent.setup();
    const singleCreatedOrder: Order[] = [
      {
        id: "order-amount",
        user_id: "user-1",
        products: [{ product_id: "p1", quantity: 1 }],
        total_price: 99999,
        status: "CREATED",
        created_at: "2024-06-15T10:30:00Z",
      },
    ];

    let callIdx = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(singleCreatedOrder)),
        });
      }
      if (callIdx === 2) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(mockProducts)),
        });
      }
      // 403 amount_exceeded
      return Promise.resolve({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        text: () =>
          Promise.resolve(
            JSON.stringify({ reason: "amount_exceeded: limit reached" })
          ),
      });
    });

    renderOrders("order-amount");

    await waitFor(() => {
      expect(screen.getByText(/Payer/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Payer/));

    await waitFor(() => {
      expect(screen.getByText(/montant dépasse la limite/)).toBeInTheDocument();
    });
  });

  it("shows generic 403 error for unknown reason", async () => {
    const user = userEvent.setup();
    const singleCreatedOrder: Order[] = [
      {
        id: "order-generic403",
        user_id: "user-1",
        products: [{ product_id: "p1", quantity: 1 }],
        total_price: 100,
        status: "CREATED",
        created_at: "2024-06-15T10:30:00Z",
      },
    ];

    let callIdx = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(singleCreatedOrder)),
        });
      }
      if (callIdx === 2) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(mockProducts)),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify({ reason: "other_reason" })),
      });
    });

    renderOrders("order-generic403");

    await waitFor(() => {
      expect(screen.getByText(/Payer/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Payer/));

    await waitFor(() => {
      expect(screen.getByText(/système de sécurité/)).toBeInTheDocument();
    });
  });
});
