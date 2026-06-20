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

function jsonResponse(data: any, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function isCatalog(url: string) { return url.includes("localhost:4000"); }

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Integration: Admin Products", () => {
  it("navigates to admin page, creates a product and sees it in the list", async () => {
    const user = userEvent.setup();
    const newProduct = { id: "p3", name: "Clavier Mécanique", price: 89, category: "Informatique" };

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (isCatalog(url) && opts?.method === "POST") {
        return jsonResponse(newProduct, 201);
      }
      if (isCatalog(url) && opts?.method === "GET") {
        return jsonResponse(products);
      }
      return jsonResponse([]);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Admin"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Gestion des produits" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("Nom"), "Clavier Mécanique");
    await user.type(screen.getByPlaceholderText("0.00"), "89");

    await user.click(screen.getByText("Ajouter le produit"));

    await waitFor(() => {
      expect(screen.getByText("Clavier Mécanique")).toBeInTheDocument();
    });
  });

  it("navigates to admin page and deletes a product", async () => {
    const user = userEvent.setup();

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (isCatalog(url) && opts?.method === "DELETE") {
        return jsonResponse(null, 204);
      }
      if (isCatalog(url) && opts?.method === "GET") {
        return jsonResponse(products);
      }
      return jsonResponse([]);
    });

    window.confirm = jest.fn().mockReturnValue(true);

    render(<App />);

    await user.click(screen.getByText("Admin"));

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle("Supprimer");
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText("Laptop Pro")).not.toBeInTheDocument();
    });
  });

  it("shows error when product creation fails", async () => {
    const user = userEvent.setup();

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (isCatalog(url) && opts?.method === "POST") {
        return jsonResponse({ message: "Validation error" }, 400);
      }
      if (isCatalog(url) && opts?.method === "GET") {
        return jsonResponse(products);
      }
      return jsonResponse([]);
    });

    render(<App />);

    await user.click(screen.getByText("Admin"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Gestion des produits" })).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("Nom"), "Test");
    await user.type(screen.getByPlaceholderText("0.00"), "10");

    await user.click(screen.getByText("Ajouter le produit"));

    await waitFor(() => {
      expect(screen.getByText(/Erreur API/)).toBeInTheDocument();
    });
  });

  it("shows error when delete fails", async () => {
    const user = userEvent.setup();

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (isCatalog(url) && opts?.method === "DELETE") {
        return jsonResponse({ message: "Server Error" }, 500);
      }
      if (isCatalog(url) && opts?.method === "GET") {
        return jsonResponse(products);
      }
      return jsonResponse([]);
    });

    window.confirm = jest.fn().mockReturnValue(true);

    render(<App />);

    await user.click(screen.getByText("Admin"));

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle("Supprimer");
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Erreur lors de la suppression")).toBeInTheDocument();
    });
  });

  it("shows error when catalog service returns an error", async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (isCatalog(url)) {
        return jsonResponse({ message: "Service unavailable" }, 500);
      }
      return jsonResponse([]);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Le catalog-service a retourné des erreurs/)).toBeInTheDocument();
    });
  });
});
