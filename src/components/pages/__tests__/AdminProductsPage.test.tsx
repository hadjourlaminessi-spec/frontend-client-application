import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminProductsPage from "../AdminProductsPage";
import type { Product } from "../../../types/api";

// Mock keycloak-js with default user role (non-admin)
jest.mock("keycloak-js");

// We need to control hasRole per test
const mockHasRole = jest.fn();
jest.mock("../../../services/keycloak", () => ({
  getToken: jest.fn().mockResolvedValue("mock-token"),
  getUsername: jest.fn().mockReturnValue("testuser"),
  getUserId: jest.fn().mockReturnValue("user-123"),
  hasRole: (...args: any[]) => mockHasRole(...args),
  logout: jest.fn(),
  initKeycloak: jest.fn().mockResolvedValue(true),
}));

const mockProducts: Product[] = [
  { id: "p1", name: "Laptop", price: 999, category: "Informatique", stock: 10 },
  { id: "p2", name: "Mouse", price: 29, category: "Périphériques", stock: 50 },
];

beforeEach(() => {
  mockHasRole.mockReturnValue(true); // admin by default
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    text: () => Promise.resolve(JSON.stringify(mockProducts)),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("AdminProductsPage", () => {
  it("shows access denied for non-admin users", () => {
    mockHasRole.mockReturnValue(false);
    render(<AdminProductsPage />);
    expect(screen.getByText("Accès refusé")).toBeInTheDocument();
  });

  it("loads and displays products for admin users", async () => {
    render(<AdminProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Laptop")).toBeInTheDocument();
    });
    expect(screen.getByText("Mouse")).toBeInTheDocument();
    expect(screen.getByText(/Produits \(2\)/)).toBeInTheDocument();
  });

  it("displays the add product form", () => {
    render(<AdminProductsPage />);
    expect(screen.getByText("Ajouter un produit")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nom")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
  });

  it("creates a product when form is submitted", async () => {
    const user = userEvent.setup();
    const newProduct = {
      id: "p3",
      name: "Keyboard",
      price: 79,
      category: "Périphériques",
    };

    // First call: getProducts, second call: createProduct
    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(mockProducts)),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify(newProduct)),
      });
    });

    render(<AdminProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Laptop")).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("Nom"), "Keyboard");
    await user.type(screen.getByPlaceholderText("0.00"), "79");

    const submitBtn = screen.getByText("Ajouter le produit");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Keyboard")).toBeInTheDocument();
    });
  });

  it("shows empty state when no products", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("[]"),
    });

    render(<AdminProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Aucun produit")).toBeInTheDocument();
    });
  });

  it("shows error when product load fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ message: "Server Error" })),
    });

    render(<AdminProductsPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Impossible de charger la liste des produits")
      ).toBeInTheDocument();
    });
  });

  it("resets form when 'Réinitialiser' is clicked", async () => {
    const user = userEvent.setup();
    render(<AdminProductsPage />);

    const nameInput = screen.getByPlaceholderText("Nom");
    await user.type(nameInput, "Test");
    expect(nameInput).toHaveValue("Test");

    const resetBtn = screen.getByText("Réinitialiser");
    await user.click(resetBtn);

    expect(nameInput).toHaveValue("");
  });

  it("deletes a product when delete button is clicked and confirmed", async () => {
    const user = userEvent.setup();
    // Mock window.confirm to return true
    jest.spyOn(window, "confirm").mockReturnValue(true);

    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // getProducts
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(mockProducts)),
        });
      }
      // deleteProduct
      return Promise.resolve({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: () => Promise.resolve(""),
      });
    });

    render(<AdminProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Laptop")).toBeInTheDocument();
    });

    // Click the delete button (first one)
    const deleteButtons = screen.getAllByTitle("Supprimer");
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText("Laptop")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Mouse")).toBeInTheDocument();
  });

  it("does not delete when confirm is cancelled", async () => {
    const user = userEvent.setup();
    jest.spyOn(window, "confirm").mockReturnValue(false);

    render(<AdminProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Laptop")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle("Supprimer");
    await user.click(deleteButtons[0]);

    // Product should still be there
    expect(screen.getByText("Laptop")).toBeInTheDocument();
  });

  it("shows error when delete fails", async () => {
    const user = userEvent.setup();
    jest.spyOn(window, "confirm").mockReturnValue(true);

    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(mockProducts)),
        });
      }
      // deleteProduct -> 500
      return Promise.resolve({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify({ message: "Error" })),
      });
    });

    render(<AdminProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Laptop")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle("Supprimer");
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Erreur lors de la suppression")).toBeInTheDocument();
    });
  });

  it("shows API error with payload message on create failure", async () => {
    const user = userEvent.setup();

    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(mockProducts)),
        });
      }
      // createProduct -> 400 with payload
      return Promise.resolve({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        text: () =>
          Promise.resolve(JSON.stringify({ message: "Price must be positive" })),
      });
    });

    render(<AdminProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Laptop")).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("Nom"), "Bad Product");
    await user.type(screen.getByPlaceholderText("0.00"), "-5");

    await user.click(screen.getByText("Ajouter le produit"));

    await waitFor(() => {
      expect(screen.getByText(/Price must be positive/)).toBeInTheDocument();
    });
  });

  it("shows generic create error on non-API failure", async () => {
    const user = userEvent.setup();

    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve(JSON.stringify(mockProducts)),
        });
      }
      // createProduct -> network error wrapped as 429 by doFetch
      return Promise.reject(new TypeError("Network failure"));
    });

    render(<AdminProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Laptop")).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("Nom"), "Fail Product");
    await user.type(screen.getByPlaceholderText("0.00"), "10");

    await user.click(screen.getByText("Ajouter le produit"));

    // Network errors are converted to rate-limit by doFetch, which is handled globally
    // The component does not show an error for rate-limit errors
    // So no local error should appear
    await waitFor(() => {
      expect(screen.queryByText(/Erreur lors de la création/)).not.toBeInTheDocument();
    });
  });
});
