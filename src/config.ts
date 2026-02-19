import * as core from "@actions/core";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type UserMap = Record<string, string>;

export interface ActionConfig {
  githubToken: string;
  slackToken: string;
  slackChannel: string;
  org: string;
  userMap: UserMap;
}

export const DEFAULT_USERS_MAP_PATH = "config/users.json";

function resolveUsersMapPath(usersMapPath: string): string {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  return path.isAbsolute(usersMapPath) ? usersMapPath : path.join(workspace, usersMapPath);
}

export async function readUsersMap(usersMapPath: string): Promise<UserMap> {
  const resolvedPath = resolveUsersMapPath(usersMapPath);

  let raw: string;
  try {
    raw = await readFile(resolvedPath, "utf8");
  } catch (error) {
    throw new Error(`Users map file not found at ${usersMapPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Users map at ${usersMapPath} is not valid JSON`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Users map at ${usersMapPath} must be a JSON object mapping GitHub usernames to Slack IDs`);
  }

  const map = parsed as Record<string, unknown>;
  for (const [key, value] of Object.entries(map)) {
    if (typeof value !== "string") {
      throw new Error(`Users map value for ${key} must be a string`);
    }
  }

  return map as UserMap;
}

export async function loadConfig(): Promise<ActionConfig> {
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
    userMap,
  };
}
