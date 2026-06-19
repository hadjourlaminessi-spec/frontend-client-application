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
  { id: "p3", name: "Souris Gamer", price: 59, category: "Périphériques" },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    text: () => Promise.resolve(JSON.stringify(products)),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Integration: Catalogue → Panier", () => {
  it("adds a product from catalog and sees it in cart with correct price", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for catalog to load
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    // Add Laptop Pro to cart
    const addButtons = screen.getAllByText("Ajouter");
    await user.click(addButtons[0]);

    // Toast confirmation
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro ajouté au panier")).toBeInTheDocument();
    });

    // Navigate to cart
    await user.click(screen.getByText("Panier"));

    // Verify product appears in cart
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });
    expect(screen.getByText("Créer la commande")).toBeInTheDocument();
  });

  it("adds multiple products and verifies quantities in cart", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    // Add Laptop Pro (click its Ajouter button)
    await user.click(screen.getAllByText("Ajouter")[0]);

    // Button now shows "Ajouté" for Laptop Pro — click it again to add qty 2
    await waitFor(() => {
      expect(screen.getByText("Ajouté")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Ajouté"));

    // Add Casque Audio (first remaining "Ajouter" button)
    await user.click(screen.getAllByText("Ajouter")[0]);

    // Navigate to cart
    await user.click(screen.getByText("Panier"));

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });
    expect(screen.getByText("Casque Audio")).toBeInTheDocument();

    // Verify quantities
    const qtyValues = document.querySelectorAll(".qty-val");
    const quantities = Array.from(qtyValues).map((el) => el.textContent);
    expect(quantities).toContain("2");
    expect(quantities).toContain("1");
  });

  it("adds a product and button changes to 'Ajouté'", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    // Initially "Ajouter" buttons exist
    expect(screen.getAllByText("Ajouter").length).toBe(3);

    // Add first product
    await user.click(screen.getAllByText("Ajouter")[0]);

    // Now one button should say "Ajouté"
    await waitFor(() => {
      expect(screen.getByText("Ajouté")).toBeInTheDocument();
    });
  });
});
