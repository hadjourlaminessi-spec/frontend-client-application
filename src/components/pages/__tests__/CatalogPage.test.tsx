import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CatalogPage from "../CatalogPage";
import { CartProvider } from "../../../lib/cart";
import type { Product } from "../../../types/api";

jest.mock("keycloak-js");

const mockProducts: Product[] = [
  { id: "p1", name: "Laptop Pro", price: 1299, category: "Informatique", stock: 25 },
  { id: "p2", name: "Wireless Headphones", price: 79, category: "Audio", stock: 5 },
  { id: "p3", name: "Smartphone X", price: 899, category: "Smartphones" },
];

function renderCatalog() {
  return render(
    <CartProvider>
      <CatalogPage />
    </CartProvider>
  );
}

beforeEach(() => {
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

describe("CatalogPage", () => {
  it("renders loading skeletons initially", () => {
    renderCatalog();
    // Skeleton cards are rendered during loading
    const skeletons = document.querySelectorAll(".skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays products after loading", async () => {
    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });
    expect(screen.getByText("Wireless Headphones")).toBeInTheDocument();
    expect(screen.getByText("Smartphone X")).toBeInTheDocument();
  });

  it("displays product count", async () => {
    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText(/3 produits disponibles/)).toBeInTheDocument();
    });
  });

  it("displays stock warnings for low-stock items", async () => {
    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText(/Plus que 5 en stock/)).toBeInTheDocument();
    });
    expect(screen.getByText(/25 en stock/)).toBeInTheDocument();
  });

  it("adds product to cart when 'Ajouter' is clicked", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    const addButtons = screen.getAllByText("Ajouter");
    await user.click(addButtons[0]);

    // Toast should appear
    await waitFor(() => {
      expect(screen.getByText(/ajouté au panier/)).toBeInTheDocument();
    });

    // Button should switch to "Ajouté"
    expect(screen.getByText("Ajouté")).toBeInTheDocument();
  });

  it("shows error state when API fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ message: "Internal Server Error" })),
    });

    renderCatalog();
    await waitFor(() => {
      expect(
        screen.getByText(/Le catalog-service a retourné des erreurs/)
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no products found", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("[]"),
    });

    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText("Aucun produit trouvé")).toBeInTheDocument();
    });
  });

  it("submits search form with filters", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    // Type in search input
    const searchInput = screen.getByPlaceholderText("Nom du produit...");
    await user.type(searchInput, "Laptop");

    // Click search button
    const searchBtn = screen.getByText("Rechercher");
    await user.click(searchBtn);

    // Fetch should have been called again with query params
    await waitFor(() => {
      const lastCall = (global.fetch as jest.Mock).mock.calls;
      const lastUrl = lastCall[lastCall.length - 1][0];
      expect(lastUrl).toContain("name=Laptop");
    });
  });

  it("resets filters when 'Réinitialiser' is clicked", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Nom du produit...");
    await user.type(searchInput, "Laptop");

    const resetBtn = screen.getByText("Réinitialiser");
    await user.click(resetBtn);

    expect(searchInput).toHaveValue("");
  });

  it("filters by category when category select changes", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue("Tous");
    await user.selectOptions(select, "Audio");

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const lastUrl = calls[calls.length - 1][0];
      expect(lastUrl).toContain("category=Audio");
    });
  });

  it("handles API error with array payload (validation errors)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      text: () =>
        Promise.resolve(
          JSON.stringify([
            { path: "minPrice", msg: "must be positive" },
            { path: "maxPrice", msg: "must be greater than minPrice" },
          ])
        ),
    });

    renderCatalog();
    await waitFor(() => {
      expect(
        screen.getByText(/Le catalog-service a retourné des erreurs/)
      ).toBeInTheDocument();
    });
    // Error toasts should show individual validation errors
    expect(screen.getByText(/must be positive/)).toBeInTheDocument();
    expect(screen.getByText(/must be greater than minPrice/)).toBeInTheDocument();
  });

  it("handles API error with nested errors array", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      text: () =>
        Promise.resolve(
          JSON.stringify({
            errors: [{ path: "name", msg: "required" }],
          })
        ),
    });

    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText(/required/)).toBeInTheDocument();
    });
  });

  it("handles API error with string payload", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify("Something went wrong")),
    });

    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  it("handles API error with object msg field", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      text: () =>
        Promise.resolve(JSON.stringify({ msg: "Bad request from catalog" })),
    });

    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText("Bad request from catalog")).toBeInTheDocument();
    });
  });

  it("handles API error with object without msg (JSON stringified)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      text: () =>
        Promise.resolve(JSON.stringify({ code: 42, detail: "unknown" })),
    });

    renderCatalog();
    await waitFor(() => {
      expect(
        screen.getByText(/Le catalog-service a retourné des erreurs/)
      ).toBeInTheDocument();
    });
  });

  it("displays product description when available", async () => {
    const productsWithDesc = [
      { id: "p1", name: "Laptop", price: 999, category: "Informatique", description: "A great laptop" },
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(productsWithDesc)),
    });

    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText("A great laptop")).toBeInTheDocument();
    });
  });

  it("filters by min/max price", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    const minInput = screen.getByPlaceholderText("0");
    const maxInput = screen.getByPlaceholderText("9999");
    await user.type(minInput, "100");
    await user.type(maxInput, "1000");

    await user.click(screen.getByText("Rechercher"));

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const lastUrl = calls[calls.length - 1][0];
      expect(lastUrl).toContain("minPrice=100");
      expect(lastUrl).toContain("maxPrice=1000");
    });
  });

  it("displays singular 'produit disponible' for 1 product", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () =>
        Promise.resolve(
          JSON.stringify([{ id: "p1", name: "Solo", price: 10, category: "Audio" }])
        ),
    });

    renderCatalog();
    await waitFor(() => {
      expect(screen.getByText(/1 produit disponible$/)).toBeInTheDocument();
    });
  });
});
