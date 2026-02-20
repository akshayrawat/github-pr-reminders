# GitHub PR Reminders

Post a daily Slack message listing open pull requests waiting for review across your GitHub organization.

This runs as a GitHub Action on a schedule, so there are no servers to manage.

## What It Does

Each run:

1. Searches **open PRs created in the last 3 months** (newest first)
2. Excludes PRs labeled `suppress-pr-reminder`
3. Keeps only PRs that have requested reviewers **present in your `config/users.json` mapping**
4. Limits to **up to 100 PRs** per run
5. Groups PRs by reviewer and posts a single Slack message

If there are no matching PRs, it posts:

```
🎉 No PRs waiting for review! The queue is empty.
```

## Quick Start

### 1. Configure the reviewer allowlist and Slack mapping

Edit `config/users.json` to map GitHub usernames to Slack user IDs. This file also acts as the **reviewer allowlist** (only PRs with reviewers in this list are included).

```json
{
  "github-username": "U01SLACKID",
  "another-user": "U02SLACKID"
}
```

To find a Slack user ID: open the user profile, click the three dots menu, and select "Copy member ID".

### 2. Create a Slack bot

1. Create a Slack app
2. Under **OAuth & Permissions**, add the `chat:write` scope
3. Install the app to your workspace
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
5. Invite the bot to the channel where you want reminders posted

### 3. Create a GitHub token

Create a GitHub token with access to all repos in your org (fine-grained or classic with `repo` scope).

### 4. Add secrets and variables

In **Settings > Secrets and variables > Actions**:

**Secrets**

| Name | Value |
| --- | --- |
| `ORG_GITHUB_TOKEN` | GitHub token |
| `SLACK_BOT_TOKEN` | Slack bot token (`xoxb-...`) |

**Variables**

| Name | Value |
| --- | --- |
| `SLACK_CHANNEL` | Slack channel ID (e.g. `C01ABCDEF`) |
| `GITHUB_ORG` | GitHub org name (e.g. `my-org`) |

### 5. Add the workflow

```yaml
name: PR Review Reminders

on:
  schedule:
    - cron: '30 3 * * 1-5'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pr-review-reminders
  cancel-in-progress: true

jobs:
  remind:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/github-pr-reminders@v1
        with:
          github_token: ${{ secrets.ORG_GITHUB_TOKEN }}
          slack_bot_token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack_channel: ${{ vars.SLACK_CHANNEL }}
          github_org: ${{ vars.GITHUB_ORG }}
```

## Action Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `github_token` | yes | | GitHub token with access to org repos |
| `slack_bot_token` | yes | | Slack bot token |
| `slack_channel` | yes | | Slack channel ID |
| `github_org` | yes | | GitHub org name |
| `users_map_path` | no | `config/users.json` | Path to GitHub-to-Slack mapping (also reviewer allowlist) |

## Behavior Notes

- The action looks at **PRs created in the last 3 months**.
- It only includes PRs whose **requested reviewers are present in `config/users.json`**.
- It processes **up to 100 PRs** per run (newest first). Older PRs and excess results are ignored.
- The `suppress-pr-reminder` label always excludes a PR.

## Changing the Schedule

Edit the cron expression in `.github/workflows/pr-reminders.yml`.

The schedule is in UTC.

## Development

Requires Bun.

```bash
bun install
bun test
```

To run locally (GitHub Actions input env vars):

```bash
INPUT_GITHUB_TOKEN=... \
INPUT_SLACK_BOT_TOKEN=... \
INPUT_SLACK_CHANNEL=... \
INPUT_GITHUB_ORG=... \
INPUT_USERS_MAP_PATH=config/users.json \
bun run src/index.ts
```

## Releasing

1. `bun install`
2. `bun run build` (generates `dist/index.js`)
3. Commit `dist/`
4. Tag a release (e.g. `v1.0.0`) and move `v1` to the same commit
