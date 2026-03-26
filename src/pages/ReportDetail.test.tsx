import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ReportDetail from "./ReportDetail";

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

describe("ReportDetail", () => {
  it("redirects to /reports for unknown report slug", () => {
    render(
      <MemoryRouter initialEntries={["/reports/__missing__"]}>
        <Routes>
          <Route path="/reports" element={<div>ReportsIndex</div>} />
          <Route path="/reports/:reportSlug" element={<ReportDetail />} />
          <Route path="*" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    // Navigate should land us on /reports.
    expect(screen.getByText("ReportsIndex")).toBeInTheDocument();
  });

  it("renders report title for known report slug", () => {
    render(
      <MemoryRouter initialEntries={["/reports/daily-sales"]}>
        <Routes>
          <Route path="/reports/:reportSlug" element={<ReportDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /daily sales summary/i })).toBeInTheDocument();
  });
});

