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
  { id: "p2", name: "Casque Audio", price: 149, category: "Audio" },
];

const createdOrder = {
  id: "order-new-001",
  user_id: "user-123",
  products: [
    { product_id: "p1", quantity: 1, unit_price: 999 },
    { product_id: "p2", quantity: 2, unit_price: 149 },
  ],
  total_price: 1297,
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

function setupUrlBasedFetch(overrides?: { createOrder?: "fail" }) {
  (global.fetch as jest.Mock).mockImplementation((url: string, opts?: any) => {
    if (isOrders(url) && opts?.method === "POST") {
      if (overrides?.createOrder === "fail") {
        return jsonResponse({ message: "Server Error" }, 500);
      }
      return jsonResponse(createdOrder, 201);
    }
    if (isOrders(url)) {
      return jsonResponse([createdOrder]);
    }
    if (isCatalog(url)) {
      return jsonResponse(products);
    }
    return jsonResponse([]);
  });
}

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (isCatalog(url)) {
      return jsonResponse(products);
    }
    return jsonResponse([]);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Integration: Panier → Commande", () => {
  it("creates an order from cart and navigates to orders page with CREATED status", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    await user.click(screen.getAllByText("Ajouter")[0]); // Laptop Pro
    await user.click(screen.getAllByText("Ajouter")[0]); // Casque Audio

    await user.click(screen.getByText("Panier"));

    await waitFor(() => {
      expect(screen.getByText("Créer la commande")).toBeInTheDocument();
    });

    expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    expect(screen.getByText("Casque Audio")).toBeInTheDocument();

    setupUrlBasedFetch();

    await user.click(screen.getByText("Créer la commande"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Commandes" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Nouvelle")).toBeInTheDocument();
    });

    expect(screen.getAllByText("En attente").length).toBeGreaterThanOrEqual(1);
  });

  it("shows an error when order creation fails", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    await user.click(screen.getAllByText("Ajouter")[0]);

    await user.click(screen.getByText("Panier"));

    await waitFor(() => {
      expect(screen.getByText("Créer la commande")).toBeInTheDocument();
    });

    setupUrlBasedFetch({ createOrder: "fail" });

    await user.click(screen.getByText("Créer la commande"));

    await waitFor(() => {
      expect(
        screen.getByText(/Erreur lors de la création de la commande/)
      ).toBeInTheDocument();
    });
  });

  it("clears the cart after successful order creation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    await user.click(screen.getAllByText("Ajouter")[0]);

    await user.click(screen.getByText("Panier"));
    await waitFor(() => {
      expect(screen.getByText("Créer la commande")).toBeInTheDocument();
    });

    setupUrlBasedFetch();

    await user.click(screen.getByText("Créer la commande"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Commandes" })).toBeInTheDocument();
    });

    await user.click(screen.getByText("Panier"));

    await waitFor(() => {
      expect(screen.getByText("Votre panier est vide")).toBeInTheDocument();
    });
  });
});
