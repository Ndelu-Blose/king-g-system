import { describe, it, expect } from "vitest";
import { getReportBySlug, reportList } from "./report-config";

describe("report-config", () => {
  it("getReportBySlug returns a report for known slug", () => {
    const report = getReportBySlug("daily-sales");
    expect(report).toBeTruthy();
    expect(report?.slug).toBe("daily-sales");
  });

  it("getReportBySlug returns undefined for unknown slug", () => {
    expect(getReportBySlug("__missing__")).toBeUndefined();
  });

  it("reportList has unique slugs", () => {
    const slugs = reportList.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

