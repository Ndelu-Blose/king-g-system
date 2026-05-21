import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ReportDetail from "./ReportDetail";

vi.mock("@/lib/pos-api", () => ({
  getAllProducts: vi.fn(async () => []),
  getTransactionsFromApi: vi.fn(async () => []),
}));

vi.mock("@/contexts/InventoryContext", () => ({
  useInventory: vi.fn(() => ({ inventory: [] })),
}));

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function renderWithProviders(ui: React.ReactElement, initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries} future={routerFuture}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

describe("ReportDetail", () => {
  it("redirects to /reports for unknown report slug", () => {
    renderWithProviders(
      <Routes>
        <Route path="/reports" element={<div>ReportsIndex</div>} />
        <Route path="/reports/:reportSlug" element={<ReportDetail />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>,
      ["/reports/__missing__"],
    );

    expect(screen.getByText("ReportsIndex")).toBeInTheDocument();
  });

  it("renders report title for known report slug", () => {
    renderWithProviders(
      <Routes>
        <Route path="/reports/:reportSlug" element={<ReportDetail />} />
      </Routes>,
      ["/reports/daily-sales"],
    );

    expect(screen.getByRole("heading", { name: /daily sales summary/i })).toBeInTheDocument();
  });
});
