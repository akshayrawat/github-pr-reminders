import * as core from "@actions/core";
import { fetchRecentPRs } from "./github";
import { groupByReviewer, formatMessage, postToSlack } from "./slack";
import { loadConfig } from "./config";

async function run() {
  const { githubToken, slackToken, slackChannel, org, userMap } = await loadConfig();

  core.setSecret(githubToken);
  core.setSecret(slackToken);

  const reviewerAllowlist = new Set(Object.keys(userMap));
  if (reviewerAllowlist.size === 0) {
    core.warning("User mapping is empty; no PRs will match reviewer allowlist.");
  }

  core.info(`Fetching open PRs for org: ${org}`);
  const prs = await fetchRecentPRs(githubToken, org, reviewerAllowlist);
  core.info(`Found ${prs.length} PRs waiting for review`);

  const grouped = groupByReviewer(prs);
  const message = formatMessage(grouped, userMap, org);

  core.info("Posting to Slack...");
  core.info(message);
  await postToSlack(slackToken, slackChannel, message);
  core.info("Done!");
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
});
