import { describe, it, expect } from "bun:test";
import { groupByReviewer, formatMessage } from "./slack";

const userMap = { alice: "U01ALICE", bob: "U02BOB" };

describe("groupByReviewer", () => {
  it("groups PRs by each requested reviewer", () => {
    const prs = [
      { number: 1, title: "PR one", repo: "api", requested_reviewers: [{ login: "alice" }, { login: "bob" }], draft: false, labels: [], html_url: "https://github.com/my-org/api/pull/1" },
      { number: 2, title: "PR two", repo: "web", requested_reviewers: [{ login: "alice" }], draft: false, labels: [], html_url: "https://github.com/my-org/web/pull/2" },
    ];
    const grouped = groupByReviewer(prs);
    expect(grouped["alice"]).toHaveLength(2);
    expect(grouped["bob"]).toHaveLength(1);
  });
});

describe("formatMessage", () => {
  it("formats message grouped by reviewer with Slack mentions", () => {
    const grouped = {
      alice: [
        { number: 1, title: "Fix bug", repo: "api", html_url: "https://github.com/my-org/api/pull/1", requested_reviewers: [{ login: "alice" }], draft: false, labels: [] },
      ],
    };
    const message = formatMessage(grouped, userMap, "my-org");
    expect(message).toContain("<@U01ALICE>");
    expect(message).toContain("suppress-pr-reminder");
    expect(message).toContain("<https://github.com/my-org/api/pull/1|api#1>");
    expect(message).toContain("Fix bug");
  });

  it("shows placeholder for unmapped users", () => {
    const grouped = {
      charlie: [
        { number: 3, title: "Add docs", repo: "web", html_url: "https://github.com/my-org/web/pull/3", requested_reviewers: [{ login: "charlie" }], draft: false, labels: [] },
      ],
    };
    const message = formatMessage(grouped, userMap, "my-org");
    expect(message).toContain("Unmapped reviewer");
    expect(message).not.toContain("<@");
  });

  it("returns celebratory message when no PRs", () => {
    const message = formatMessage({}, userMap, "my-org");
    expect(message).toContain("No PRs waiting for review");
  });
});
