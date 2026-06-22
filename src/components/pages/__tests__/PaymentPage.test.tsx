import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import PaymentPage from "../PaymentPage";

jest.mock("keycloak-js");

const mockPayments = [
  {
    id: "pay-1",
    orderId: "o1",
    userId: "u1",
    amount: 150,
    status: "SUCCESS",
    createdAt: "2024-06-15T10:00:00Z",
  },
  {
    id: "pay-2",
    orderId: "o2",
    userId: "u1",
    amount: 50,
    status: "FAILED",
    createdAt: "2024-06-14T08:00:00Z",
  },
  {
    id: "pay-3",
    orderId: "o3",
    userId: "u1",
    amount: 200,
    status: "SUCCESS",
    createdAt: "2024-06-13T14:00:00Z",
  },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    text: () => Promise.resolve(JSON.stringify(mockPayments)),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("PaymentPage", () => {
  it("renders loading state initially", () => {
    render(<PaymentPage />);
    const skeletons = document.querySelectorAll(".skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays payment statistics after loading", async () => {
    render(<PaymentPage />);
    await waitFor(() => {
      expect(screen.getByText("Transactions")).toBeInTheDocument();
    });
    expect(screen.getByText("Acceptées")).toBeInTheDocument();
    expect(screen.getByText("Refusées")).toBeInTheDocument();
    expect(screen.getByText("Volume traité")).toBeInTheDocument();
  });

  it("displays correct stat values", async () => {
    render(<PaymentPage />);
    await waitFor(() => {
      // 3 transactions total
      expect(screen.getByText("3")).toBeInTheDocument();
    });
    // 2 success, 1 failed
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("displays payment table with rows", async () => {
    render(<PaymentPage />);
    await waitFor(() => {
      expect(screen.getByText(/Transactions \(3\)/)).toBeInTheDocument();
    });
    // Check payment IDs are in the table
    expect(screen.getByText("pay-1")).toBeInTheDocument();
    expect(screen.getByText("pay-2")).toBeInTheDocument();
    expect(screen.getByText("pay-3")).toBeInTheDocument();
  });

  it("shows SUCCESS and FAILED badges in the table", async () => {
    render(<PaymentPage />);
    await waitFor(() => {
      expect(screen.getByText(/Transactions \(3\)/)).toBeInTheDocument();
    });
    // Badges are rendered with icons inside <span class="badge">
    const successBadges = document.querySelectorAll(".badge-success");
    const failedBadges = document.querySelectorAll(".badge-danger");
    expect(successBadges.length).toBe(2);
    expect(failedBadges.length).toBe(1);
  });

  it("shows empty state when no payments", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("[]"),
    });

    render(<PaymentPage />);
    await waitFor(() => {
      expect(screen.getByText("Aucun paiement")).toBeInTheDocument();
    });
  });

  it("shows error when API fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ message: "Server Error" })),
    });

    render(<PaymentPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/Impossible de charger les paiements/)
      ).toBeInTheDocument();
    });
  });

  it("shows simulation notice", async () => {
    render(<PaymentPage />);
    expect(screen.getByText("Mode simulation")).toBeInTheDocument();
  });
});
