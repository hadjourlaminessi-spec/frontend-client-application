import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartPage from "../CartPage";
import { CartProvider, useCart } from "../../../lib/cart";
import type { Product } from "../../../types/api";

jest.mock("keycloak-js");

const mockProduct: Product = {
  id: "p1",
  name: "Laptop Pro",
  price: 999,
  category: "Informatique",
};

const mockProduct2: Product = {
  id: "p2",
  name: "Headphones",
  price: 49,
  category: "Audio",
};

// Helper component that pre-populates the cart
function CartPageWithItems({
  products,
  goToOrders,
}: {
  products: Product[];
  goToOrders: (id?: string) => void;
}) {
  const { dispatch } = useCart();
  React.useEffect(() => {
    products.forEach((p) => dispatch({ type: "ADD", product: p }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <CartPage goToOrders={goToOrders} />;
}

function renderEmptyCart(goToOrders = jest.fn()) {
  return render(
    <CartProvider>
      <CartPage goToOrders={goToOrders} />
    </CartProvider>
  );
}

function renderCartWithItems(
  products: Product[] = [mockProduct],
  goToOrders = jest.fn()
) {
  return {
    goToOrders,
    ...render(
      <CartProvider>
        <CartPageWithItems products={products} goToOrders={goToOrders} />
      </CartProvider>
    ),
  };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("CartPage", () => {
  it("shows empty state when cart is empty", () => {
    renderEmptyCart();
    expect(screen.getByText("Votre panier est vide")).toBeInTheDocument();
    expect(
      screen.getByText("Ajoutez des produits depuis le catalogue")
    ).toBeInTheDocument();
  });

  it("displays cart items with product details", async () => {
    renderCartWithItems([mockProduct, mockProduct2]);
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });
    expect(screen.getByText("Headphones")).toBeInTheDocument();
  });

  it("displays total price", async () => {
    renderCartWithItems([mockProduct, mockProduct2]);
    await waitFor(() => {
      expect(screen.getByText("Total")).toBeInTheDocument();
    });
  });

  it("increments quantity when + is clicked", async () => {
    const user = userEvent.setup();
    renderCartWithItems();
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    const plusBtn = screen.getByText("+");
    await user.click(plusBtn);

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("decrements quantity when − is clicked (removes at 0)", async () => {
    const user = userEvent.setup();
    renderCartWithItems();
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    const minusBtn = screen.getByText("−");
    await user.click(minusBtn);

    // Item should be removed, showing empty state
    await waitFor(() => {
      expect(screen.getByText("Votre panier est vide")).toBeInTheDocument();
    });
  });

  it("creates order when 'Créer la commande' is clicked", async () => {
    const user = userEvent.setup();
    const goToOrders = jest.fn();
    const orderResponse = {
      id: "order-123",
      user_id: "",
      products: [{ product_id: "p1", quantity: 1 }],
      total_price: 999,
      status: "CREATED",
      created_at: "2024-01-01",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(orderResponse)),
    });

    renderCartWithItems([mockProduct], goToOrders);
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    const orderBtn = screen.getByText("Créer la commande");
    await user.click(orderBtn);

    await waitFor(() => {
      expect(goToOrders).toHaveBeenCalledWith("order-123");
    });
  });

  it("shows error when order creation fails", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ message: "Server Error" })),
    });

    renderCartWithItems();
    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    const orderBtn = screen.getByText("Créer la commande");
    await user.click(orderBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Erreur lors de la création de la commande/)
      ).toBeInTheDocument();
    });
  });
});
