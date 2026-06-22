import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "../Sidebar";
import { CartProvider } from "../../../lib/cart";

jest.mock("keycloak-js");

const mockKeycloak = {
  hasRole: jest.fn() as jest.Mock,
  logout: jest.fn() as jest.Mock,
};

jest.mock("../../../services/keycloak", () => ({
  __esModule: true,
  getToken: jest.fn().mockResolvedValue("mock-token"),
  getUsername: () => "testuser",
  getUserId: () => "user-123",
  hasRole: (...args: any[]) => mockKeycloak.hasRole(...args),
  logout: (...args: any[]) => mockKeycloak.logout(...args),
  initKeycloak: jest.fn().mockResolvedValue(true),
}));

function renderSidebar(page = "catalog" as any, setPage = jest.fn()) {
  return {
    setPage,
    ...render(
      <CartProvider>
        <Sidebar page={page} setPage={setPage} />
      </CartProvider>
    ),
  };
}

beforeEach(() => {
  mockKeycloak.hasRole.mockReturnValue(false);
});

describe("Sidebar", () => {
  it("renders brand text", () => {
    renderSidebar();
    expect(screen.getByText("ShopMicro")).toBeInTheDocument();
    expect(screen.getByText("E-Commerce Platform")).toBeInTheDocument();
  });

  it("renders navigation items", () => {
    renderSidebar();
    expect(screen.getByText("Catalogue")).toBeInTheDocument();
    expect(screen.getByText("Panier")).toBeInTheDocument();
    expect(screen.getByText("Commandes")).toBeInTheDocument();
    expect(screen.getByText("Paiements")).toBeInTheDocument();
  });

  it("hides Admin link for non-admin users", () => {
    mockKeycloak.hasRole.mockReturnValue(false);
    renderSidebar();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows Admin link for admin users", () => {
    mockKeycloak.hasRole.mockReturnValue(true);
    renderSidebar();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("navigates when a nav item is clicked", async () => {
    const user = userEvent.setup();
    const { setPage } = renderSidebar();

    await user.click(screen.getByText("Commandes"));
    expect(setPage).toHaveBeenCalledWith("orders");
  });

  it("highlights current active page", () => {
    renderSidebar("orders");
    const ordersBtn = screen.getByText("Commandes").closest("button");
    expect(ordersBtn).toHaveClass("active");
  });

  it("displays username", () => {
    renderSidebar();
    expect(screen.getByText("testuser")).toBeInTheDocument();
  });

  it("has a logout button", () => {
    renderSidebar();
    expect(screen.getByText("Deconnexion")).toBeInTheDocument();
  });

  it("calls logout when button is clicked", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByText("Deconnexion"));
    expect(mockKeycloak.logout).toHaveBeenCalled();
  });
});
