"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var core2 = __toESM(require("@actions/core"));

// src/github.ts
var import_octokit = require("octokit");
var SUPPRESS_LABEL = "suppress-pr-reminder";
var MAX_RESULTS = 100;
var MONTHS_BACK = 3;
function monthsAgoDate(monthsBack) {
  const now = /* @__PURE__ */ new Date();
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() - monthsBack);
  return date;
}
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
function parseRepoFromUrl(url) {
  const match = url.match(/repos\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error(`Unable to parse repository from URL: ${url}`);
  }
  return { owner: match[1], repo: match[2] };
}
function filterPRs(prs, allowlist, cutoffDate) {
  return prs.map((pr) => ({
    ...pr,
    requested_reviewers: pr.requested_reviewers.filter((reviewer) => allowlist.has(reviewer.login))
  })).filter(
    (pr) => !pr.draft && pr.requested_reviewers.length > 0 && !pr.labels.some((label) => label.name === SUPPRESS_LABEL) && new Date(pr.created_at) >= cutoffDate
  );
}
async function fetchRecentPRs(token, org, reviewerAllowlist) {
  const octokit = new import_octokit.Octokit({ auth: token });
  const cutoffDate = monthsAgoDate(MONTHS_BACK);
  const query = `org:${org} is:pr is:open created:>=${formatDate(cutoffDate)} -label:${SUPPRESS_LABEL}`;
  const search = await octokit.rest.search.issuesAndPullRequests({
    q: query,
    sort: "created",
    order: "desc",
    per_page: MAX_RESULTS,
    page: 1
  });
  const results = [];
  const items = search.data.items.slice(0, MAX_RESULTS);
  for (const item of items) {
    if (!item.pull_request || !item.repository_url) {
      continue;
    }
    const { owner, repo } = parseRepoFromUrl(item.repository_url);
    try {
      const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: item.number
      });
      const candidate = {
        number: pr.number,
        title: pr.title,
        draft: pr.draft,
        requested_reviewers: pr.requested_reviewers,
        labels: pr.labels,
        html_url: pr.html_url,
        created_at: pr.created_at
      };
      const filtered = filterPRs([candidate], reviewerAllowlist, cutoffDate);
      if (filtered.length === 0) {
        continue;
      }
      results.push({ ...filtered[0], repo });
    } catch (error) {
      console.warn(`Warning: Failed to fetch PR details for ${owner}/${repo}#${item.number}:`, error);
    }
  }
  return results;
}

// src/slack.ts
var import_web_api = require("@slack/web-api");
function groupByReviewer(prs) {
  const grouped = {};
  for (const pr of prs) {
    for (const reviewer of pr.requested_reviewers) {
      if (!grouped[reviewer.login]) {
        grouped[reviewer.login] = [];
      }
      grouped[reviewer.login].push(pr);
    }
  }
  return grouped;
}
function formatMessage(grouped, userMap, org) {
  const reviewers = Object.keys(grouped);
  if (reviewers.length === 0) {
    return "\u{1F389} No PRs waiting for review! The queue is empty.";
  }
  let message = "\u{1F50D} *PRs waiting for review*\n";
  for (const reviewer of reviewers.sort()) {
    const slackId = userMap[reviewer];
    const mention = slackId ? `<@${slackId}> (${reviewer})` : `${reviewer} (no Slack mapping)`;
    message += `
*${mention}:*
`;
    for (const pr of grouped[reviewer]) {
      const url = pr.html_url || `https://github.com/${org}/${pr.repo}/pull/${pr.number}`;
      message += `\u2022 <${url}|${pr.repo}#${pr.number}>: ${pr.title}
`;
    }
  }
  return message;
}
async function postToSlack(token, channel, text) {
  const client = new import_web_api.WebClient(token);
  await client.chat.postMessage({ channel, text });
}

// src/config.ts
var core = __toESM(require("@actions/core"));
var import_promises = require("fs/promises");
var import_node_path = __toESM(require("path"));
var DEFAULT_USERS_MAP_PATH = "config/users.json";
function resolveUsersMapPath(usersMapPath) {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  return import_node_path.default.isAbsolute(usersMapPath) ? usersMapPath : import_node_path.default.join(workspace, usersMapPath);
}
async function readUsersMap(usersMapPath) {
  const resolvedPath = resolveUsersMapPath(usersMapPath);
  let raw;
  try {
    raw = await (0, import_promises.readFile)(resolvedPath, "utf8");
  } catch (error) {
    throw new Error(`Users map file not found at ${usersMapPath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Users map at ${usersMapPath} is not valid JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Users map at ${usersMapPath} must be a JSON object mapping GitHub usernames to Slack IDs`);
  }
  const map = parsed;
  for (const [key, value] of Object.entries(map)) {
    if (typeof value !== "string") {
      throw new Error(`Users map value for ${key} must be a string`);
    }
  }
  return map;
}
async function loadConfig() {
  const githubToken = core.getInput("github_token", { required: true });
  const slackToken = core.getInput("slack_bot_token", { required: true });
  const slackChannel = core.getInput("slack_channel", { required: true });
  const org = core.getInput("github_org", { required: true });
  const usersMapPath = core.getInput("users_map_path") || DEFAULT_USERS_MAP_PATH;
  const userMap = await readUsersMap(usersMapPath);
  return {
    githubToken,
    slackToken,
    slackChannel,
    org,
    userMap
  };
}

// src/index.ts
async function run() {
  const { githubToken, slackToken, slackChannel, org, userMap } = await loadConfig();
  core2.setSecret(githubToken);
  core2.setSecret(slackToken);
  const reviewerAllowlist = new Set(Object.keys(userMap));
  if (reviewerAllowlist.size === 0) {
    core2.warning("User mapping is empty; no PRs will match reviewer allowlist.");
  }
  core2.info(`Fetching open PRs for org: ${org}`);
  const prs = await fetchRecentPRs(githubToken, org, reviewerAllowlist);
  core2.info(`Found ${prs.length} PRs waiting for review`);
  const grouped = groupByReviewer(prs);
  const message = formatMessage(grouped, userMap, org);
  core2.info("Posting to Slack...");
  core2.info(message);
  await postToSlack(slackToken, slackChannel, message);
  core2.info("Done!");
}
run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  core2.setFailed(message);
});
