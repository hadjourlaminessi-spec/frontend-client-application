import React from "react";
import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "../cart";
import type { Product } from "../../types/api";

const mockProduct: Product = {
  id: "p1",
  name: "Laptop",
  price: 999,
  category: "Informatique",
};

const mockProduct2: Product = {
  id: "p2",
  name: "Headphones",
  price: 49,
  category: "Audio",
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

describe("Cart (useCart + CartProvider)", () => {
  it("starts with an empty cart", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.state.items).toHaveLength(0);
    expect(result.current.total).toBe(0);
    expect(result.current.count).toBe(0);
  });

  it("ADD adds a product with quantity 1", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.dispatch({ type: "ADD", product: mockProduct }));
    expect(result.current.state.items).toHaveLength(1);
    expect(result.current.state.items[0].quantity).toBe(1);
    expect(result.current.count).toBe(1);
    expect(result.current.total).toBe(999);
  });

  it("ADD same product increments quantity", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.dispatch({ type: "ADD", product: mockProduct }));
    act(() => result.current.dispatch({ type: "ADD", product: mockProduct }));
    expect(result.current.state.items).toHaveLength(1);
    expect(result.current.state.items[0].quantity).toBe(2);
    expect(result.current.count).toBe(2);
    expect(result.current.total).toBe(1998);
  });

  it("ADD different products creates separate entries", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.dispatch({ type: "ADD", product: mockProduct }));
    act(() => result.current.dispatch({ type: "ADD", product: mockProduct2 }));
    expect(result.current.state.items).toHaveLength(2);
    expect(result.current.count).toBe(2);
    expect(result.current.total).toBe(999 + 49);
  });

  it("REMOVE removes a product by id", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.dispatch({ type: "ADD", product: mockProduct }));
    act(() => result.current.dispatch({ type: "ADD", product: mockProduct2 }));
    act(() => result.current.dispatch({ type: "REMOVE", id: "p1" }));
    expect(result.current.state.items).toHaveLength(1);
    expect(result.current.state.items[0].product.id).toBe("p2");
  });

  it("SET_QTY updates quantity", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.dispatch({ type: "ADD", product: mockProduct }));
    act(() => result.current.dispatch({ type: "SET_QTY", id: "p1", qty: 5 }));
    expect(result.current.state.items[0].quantity).toBe(5);
    expect(result.current.total).toBe(999 * 5);
  });

  it("SET_QTY with qty <= 0 removes the item", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.dispatch({ type: "ADD", product: mockProduct }));
    act(() => result.current.dispatch({ type: "SET_QTY", id: "p1", qty: 0 }));
    expect(result.current.state.items).toHaveLength(0);
  });

  it("CLEAR empties the cart", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.dispatch({ type: "ADD", product: mockProduct }));
    act(() => result.current.dispatch({ type: "ADD", product: mockProduct2 }));
    act(() => result.current.dispatch({ type: "CLEAR" }));
    expect(result.current.state.items).toHaveLength(0);
    expect(result.current.total).toBe(0);
    expect(result.current.count).toBe(0);
  });

  it("throws when useCart is used outside CartProvider", () => {
    // Suppress console.error for this test
    const spy = jest.spyOn(console, "error").mockImplementation();
    expect(() => {
      renderHook(() => useCart());
    }).toThrow("useCart outside CartProvider");
    spy.mockRestore();
  });
});
