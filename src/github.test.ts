import { describe, it, expect } from "bun:test";
import { filterPRs } from "./github";

describe("filterPRs", () => {
  it("excludes draft PRs", () => {
    const prs = [
      { number: 1, title: "Draft PR", draft: true, requested_reviewers: [{ login: "alice" }], labels: [] },
      { number: 2, title: "Ready PR", draft: false, requested_reviewers: [{ login: "alice" }], labels: [] },
    ];
    const result = filterPRs(prs);
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(2);
  });

  it("excludes PRs with suppress-pr-reminder label", () => {
    const prs = [
      { number: 1, title: "Suppressed", draft: false, requested_reviewers: [{ login: "alice" }], labels: [{ name: "suppress-pr-reminder" }] },
      { number: 2, title: "Normal", draft: false, requested_reviewers: [{ login: "alice" }], labels: [] },
    ];
    const result = filterPRs(prs);
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(2);
  });

  it("excludes PRs with no requested reviewers", () => {
    const prs = [
      { number: 1, title: "No reviewers", draft: false, requested_reviewers: [], labels: [] },
      { number: 2, title: "Has reviewer", draft: false, requested_reviewers: [{ login: "alice" }], labels: [] },
    ];
    const result = filterPRs(prs);
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(2);
  });
});
