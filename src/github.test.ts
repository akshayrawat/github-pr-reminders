import { describe, it, expect } from "bun:test";
import { filterPRs } from "./github";

describe("filterPRs", () => {
  it("excludes draft PRs", () => {
    const prs = [
      { number: 1, title: "Draft PR", draft: true, requested_reviewers: [{ login: "alice" }], labels: [], created_at: "2025-11-15T00:00:00Z" },
      { number: 2, title: "Ready PR", draft: false, requested_reviewers: [{ login: "alice" }], labels: [], created_at: "2025-11-15T00:00:00Z" },
    ];
    const result = filterPRs(prs, new Set(["alice"]), new Date("2025-10-01T00:00:00Z"));
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(2);
  });

  it("excludes PRs with suppress-pr-reminder label", () => {
    const prs = [
      { number: 1, title: "Suppressed", draft: false, requested_reviewers: [{ login: "alice" }], labels: [{ name: "suppress-pr-reminder" }], created_at: "2025-11-15T00:00:00Z" },
      { number: 2, title: "Normal", draft: false, requested_reviewers: [{ login: "alice" }], labels: [], created_at: "2025-11-15T00:00:00Z" },
    ];
    const result = filterPRs(prs, new Set(["alice"]), new Date("2025-10-01T00:00:00Z"));
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(2);
  });

  it("excludes PRs with no requested reviewers in the allowlist", () => {
    const prs = [
      { number: 1, title: "No reviewers", draft: false, requested_reviewers: [], labels: [], created_at: "2025-11-15T00:00:00Z" },
      { number: 2, title: "Has reviewer", draft: false, requested_reviewers: [{ login: "alice" }], labels: [], created_at: "2025-11-15T00:00:00Z" },
    ];
    const result = filterPRs(prs, new Set(["alice"]), new Date("2025-10-01T00:00:00Z"));
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(2);
  });

  it("excludes PRs older than cutoff date", () => {
    const prs = [
      { number: 1, title: "Old PR", draft: false, requested_reviewers: [{ login: "alice" }], labels: [], created_at: "2025-06-01T00:00:00Z" },
      { number: 2, title: "New PR", draft: false, requested_reviewers: [{ login: "alice" }], labels: [], created_at: "2025-12-01T00:00:00Z" },
    ];
    const result = filterPRs(prs, new Set(["alice"]), new Date("2025-10-01T00:00:00Z"));
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(2);
  });

  it("filters requested reviewers to allowlist", () => {
    const prs = [
      {
        number: 1,
        title: "Mixed reviewers",
        draft: false,
        requested_reviewers: [{ login: "alice" }, { login: "bob" }],
        labels: [],
        created_at: "2025-11-15T00:00:00Z",
      },
    ];
    const result = filterPRs(prs, new Set(["alice"]), new Date("2025-10-01T00:00:00Z"));
    expect(result).toHaveLength(1);
    expect(result[0].requested_reviewers).toHaveLength(1);
    expect(result[0].requested_reviewers[0].login).toBe("alice");
  });
});
