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

const payments = [
  {
    id: "pay-001",
    orderId: "order-001",
    userId: "user-123",
    amount: 999,
    status: "SUCCESS",
    createdAt: "2024-06-15T11:00:00Z",
  },
  {
    id: "pay-002",
    orderId: "order-002",
    userId: "user-123",
    amount: 149,
    status: "FAILED",
    createdAt: "2024-06-16T09:00:00Z",
  },
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
function isPayment(url: string) { return url.includes("localhost:8082"); }

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Integration: Payment Page", () => {
  it("navigates to payments page and displays transactions", async () => {
    const user = userEvent.setup();

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (isPayment(url)) {
        return jsonResponse(payments);
      }
      if (isCatalog(url)) {
        return jsonResponse(products);
      }
      return jsonResponse([]);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Paiements"));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Historique des paiements" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("2 transactions")).toBeInTheDocument();
    });
  });

  it("shows error when payment service is unavailable", async () => {
    const user = userEvent.setup();

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (isPayment(url)) {
        return jsonResponse({ message: "Service unavailable" }, 500);
      }
      if (isCatalog(url)) {
        return jsonResponse(products);
      }
      return jsonResponse([]);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Laptop Pro")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Paiements"));

    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les paiements/)).toBeInTheDocument();
    });
  });
});
