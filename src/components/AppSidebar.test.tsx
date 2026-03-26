import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AppSidebar from "./AppSidebar";

vi.mock("@/lib/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/contexts/ShiftContext", () => ({
  useShift: vi.fn(),
}));

vi.mock("@/lib/pos-api", () => ({
  getHelpRequests: vi.fn(async () => []),
  getLocalHelpRequests: vi.fn(() => []),
}));

const { useAuth } = await import("@/lib/auth-context");
const { useShift } = await import("@/contexts/ShiftContext");

function renderSidebar(pathname: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>
        <AppSidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when logged out", () => {
    (useAuth as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      user: null,
      logout: vi.fn(),
    });
    (useShift as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({ isOpen: false });

    renderSidebar("/dashboard");
    // No navigation items should be present.
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
  });

  it("renders owner navigation when role is owner", async () => {
    (useAuth as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      user: { id: "u1", name: "Owner", role: "owner" },
      logout: vi.fn(),
    });
    (useShift as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({ isOpen: false });

    renderSidebar("/dashboard");

    expect(await screen.findByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/alerts & help/i)).toBeInTheDocument();
    expect(screen.getByText(/users & roles/i)).toBeInTheDocument();
  });

  it("renders cashier navigation when role is cashier", () => {
    (useAuth as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      user: { id: "u2", name: "Cashier", role: "cashier" },
      logout: vi.fn(),
    });
    // Prevent the OpenShift dialog from opening and aria-hiding the nav.
    (useShift as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({ isOpen: true });

    renderSidebar("/pos");

    expect(screen.getByText(/pos terminal/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sales history/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /help \/ support/i })).toBeInTheDocument();
  });
});

