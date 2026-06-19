import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";

jest.mock("keycloak-js");

jest.mock("../../services/keycloak", () => ({
  __esModule: true,
  getToken: jest.fn().mockResolvedValue("mock-token"),
  getUsername: () => "testuser",
  getUserId: () => "user-123",
  hasRole: () => true,
  logout: jest.fn(),
  initKeycloak: jest.fn().mockResolvedValue(true),
}));

const products = [
  { id: "p1", name: "Laptop Pro", price: 999, category: "Informatique" },
];

const createdOrder = {
  id: "order-pay-001",
  user_id: "user-123",
  products: [{ product_id: "p1", quantity: 1, name: "Laptop Pro", price: 999 }],
  total_price: 999,
  status: "CREATED",
  created_at: "2024-06-15T10:30:00Z",
};

function jsonResponse(data: any, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

/** URL matching: test env uses http://localhost:{port} (not /api/ proxy) */
function isCatalog(url: string) { return url.includes("localhost:4000"); }
function isOrders(url: string) { return url.includes("localhost:8000"); }
function isPayment(url: string) { return url.includes("localhost:8082"); }

function setupFetch(paymentResult: "success" | "fail500") {
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    // POST to payments = createPayment
    if (isPayment(url) && opts?.method === "POST") {
      if (paymentResult === "fail500") {
        return jsonResponse({ message: "Server Error" }, 500);
      }
      return jsonResponse(
        {
          id: "pay-001",
          orderId: "order-pay-001",
          userId: "user-123",
          amount: 999,
          status: "SUCCESS",
          createdAt: "2024-06-15T11:00:00Z",
        },
        201
      );
    }
    // POST to orders = createOrder
    if (isOrders(url) && opts?.method === "POST") {
      return jsonResponse(createdOrder, 201);
    }
    // PATCH to orders = updateOrderStatus
    if (isOrders(url) && opts?.method === "PATCH") {
      return jsonResponse({ ...createdOrder, status: "PAID" });
    }
    // GET orders
    if (isOrders(url)) {
      return jsonResponse([createdOrder]);
    }
    // GET catalog/products
    if (isCatalog(url)) {
      return jsonResponse(products);
    }
    return jsonResponse([]);
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Integration: Commande → Paiement", () => {
  it("pays an order successfully and status changes to Payée", async () => {
    const user = userEvent.setup();
    setupFetch("success");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    await user.click(screen.getAllByText("Ajouter")[0]);

    await user.click(screen.getByText("Panier"));
    await waitFor(() => {
      expect(screen.getByText("Créer la commande")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Créer la commande"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Commandes" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Payer/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Payer/));

    await waitFor(() => {
      expect(screen.getByText("Paiement accepté")).toBeInTheDocument();
    });

    expect(screen.getByText("Payée")).toBeInTheDocument();
  });

  it("shows error when payment fails (500 - service unavailable)", async () => {
    const user = userEvent.setup();
    setupFetch("fail500");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    await user.click(screen.getAllByText("Ajouter")[0]);
    await user.click(screen.getByText("Panier"));
    await waitFor(() => {
      expect(screen.getByText("Créer la commande")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Créer la commande"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Commandes" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Payer/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Payer/));

    await waitFor(() => {
      expect(screen.getByText(/payment-service indisponible/)).toBeInTheDocument();
    });

    expect(screen.getAllByText("En attente").length).toBeGreaterThanOrEqual(1);
  });

  it("navigates directly to orders page and pays a CREATED order", async () => {
    const user = userEvent.setup();
    setupFetch("success");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Catalogue" })).toBeInTheDocument();
    });

    await user.click(screen.getByText("Commandes"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Commandes" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText("En attente").length).toBeGreaterThanOrEqual(1);
    });

    // Expand the order by clicking its card header (not stat-card headers)
    const orderHeader = Array.from(document.querySelectorAll(".card-header")).find(
      (h) => h.closest(".card") && !h.closest(".stat-card")
    );
    expect(orderHeader).toBeTruthy();
    await user.click(orderHeader!);

    await waitFor(() => {
      expect(screen.getByText(/Payer/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Payer/));

    await waitFor(() => {
      expect(screen.getByText("Paiement accepté")).toBeInTheDocument();
    });
    expect(screen.getByText("Payée")).toBeInTheDocument();
  });
});
