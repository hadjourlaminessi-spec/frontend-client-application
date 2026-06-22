import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

jest.mock("keycloak-js");

jest.mock("../services/keycloak", () => ({
  __esModule: true,
  getToken: jest.fn().mockResolvedValue("mock-token"),
  getUsername: () => "testuser",
  getUserId: () => "user-123",
  hasRole: () => true,
  logout: jest.fn(),
  initKeycloak: jest.fn().mockResolvedValue(true),
}));

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    text: () => Promise.resolve("[]"),
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("App", () => {
  it("renders with CatalogPage by default", async () => {
    jest.useRealTimers();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Catalogue" })).toBeInTheDocument();
    });
  });

  it("renders sidebar navigation", () => {
    render(<App />);
    expect(screen.getByText("ShopMicro")).toBeInTheDocument();
    expect(screen.getByText("Panier")).toBeInTheDocument();
    expect(screen.getByText("Commandes")).toBeInTheDocument();
    expect(screen.getByText("Paiements")).toBeInTheDocument();
  });

  it("navigates to CartPage when Panier is clicked", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText("Panier"));

    await waitFor(() => {
      expect(screen.getByText("Votre panier est vide")).toBeInTheDocument();
    });
  });

  it("navigates to OrdersPage when Commandes is clicked", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText("Commandes"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Commandes" })).toBeInTheDocument();
    });
  });

  it("navigates to PaymentPage when Paiements is clicked", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText("Paiements"));

    await waitFor(() => {
      expect(screen.getByText("Historique des paiements")).toBeInTheDocument();
    });
  });

  it("navigates to AdminProductsPage when Admin is clicked", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText("Admin"));

    await waitFor(() => {
      expect(screen.getByText("Gestion des produits")).toBeInTheDocument();
    });
  });

  it("shows RateLimitBanner on api:rate-limit event and auto-hides", async () => {
    render(<App />);

    act(() => {
      window.dispatchEvent(new CustomEvent("api:rate-limit"));
    });

    expect(
      screen.getByText(/nombre de requêtes maximales/)
    ).toBeInTheDocument();
    expect(screen.getByText("Fermer")).toBeInTheDocument();

    // Auto-hides after 8 seconds
    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect(screen.queryByText(/nombre de requêtes maximales/)).not.toBeInTheDocument();
  });

  it("hides RateLimitBanner when Fermer is clicked", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();
    render(<App />);

    act(() => {
      window.dispatchEvent(new CustomEvent("api:rate-limit"));
    });

    expect(screen.getByText(/nombre de requêtes maximales/)).toBeInTheDocument();

    await user.click(screen.getByText("Fermer"));

    expect(screen.queryByText(/nombre de requêtes maximales/)).not.toBeInTheDocument();
  });

  it("goToOrders navigates from cart to orders with highlighted order", async () => {
    jest.useRealTimers();
    const user = userEvent.setup();

    // Mock products for catalog
    const products = [
      { id: "p1", name: "Test Product", price: 50, category: "Informatique" },
    ];

    let fetchCallCount = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      fetchCallCount++;
      // First calls: catalog getProducts, later: createOrder, then orders page loads
      if (fetchCallCount <= 2) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(products)),
        });
      }
      // createOrder
      return Promise.resolve({
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        text: () =>
          Promise.resolve(
            JSON.stringify({
              id: "order-highlighted",
              user_id: "user-123",
              products: [{ product_id: "p1", quantity: 1 }],
              total_price: 50,
              status: "CREATED",
              created_at: "2024-01-01",
            })
          ),
      });
    });

    render(<App />);

    // Wait for catalog to load and add a product
    await waitFor(() => {
      expect(screen.getByText("Test Product")).toBeInTheDocument();
    });

    // Add product to cart
    await user.click(screen.getByText("Ajouter"));

    // Go to cart
    await user.click(screen.getByText("Panier"));
    await waitFor(() => {
      expect(screen.getByText("Créer la commande")).toBeInTheDocument();
    });

    // Create order -> should navigate to orders page
    await user.click(screen.getByText("Créer la commande"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Commandes" })).toBeInTheDocument();
    });
  });
});
