# GitHub PR Reminders

Post a daily Slack message listing open pull requests waiting for review across your GitHub organization.

Runs as a GitHub Action on a schedule, so there are no servers to manage.

## Use This Action

### 1. Add the reviewer allowlist + Slack mapping

Create `config/users.json` in the repo where the workflow runs. This file maps GitHub usernames to Slack user IDs and also acts as the **reviewer allowlist** (only PRs with reviewers in this list are included).

```json
{
  "github-username": "U01SLACKID",
  "another-user": "U02SLACKID"
}
```

To find a Slack user ID: open the user profile in Slack, click the three dots menu, and select "Copy member ID".

### 2. Create a Slack bot

1. Create a Slack app
2. Under **OAuth & Permissions**, add the `chat:write` scope
3. Install the app to your workspace
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
5. Invite the bot to the channel where you want reminders posted

### 3. Create a GitHub App

Create a GitHub App owned by your organization and grant the following **read** permissions:

- **Pull requests**: Read
- **Contents**: Read
- **Metadata**: Read

Install the app **org-wide** (recommended) or on **selected repos** if you want to limit scope.

#### Required secrets

- `GITHUB_APP_ID` — the App ID
- `GITHUB_APP_PRIVATE_KEY` — the private key (in PEM format)

### 4. Add secrets and variables

In **Settings > Secrets and variables > Actions**:

**Secrets**

| Name | Value |
| --- | --- |
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key |
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

      - name: Mint GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ secrets.GITHUB_APP_ID }}
          private-key: ${{ secrets.GITHUB_APP_PRIVATE_KEY }}

      - uses: your-org/github-pr-reminders@v1
        with:
          github_token: ${{ steps.app-token.outputs.token }}
          slack_bot_token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack_channel: ${{ vars.SLACK_CHANNEL }}
          github_org: ${{ vars.GITHUB_ORG }}
```

## Configuration

**Action inputs**

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `github_token` | yes | | GitHub token with access to org repos |
| `slack_bot_token` | yes | | Slack bot token |
| `slack_channel` | yes | | Slack channel ID |
| `github_org` | yes | | GitHub org name |
| `users_map_path` | no | `config/users.json` | Path to GitHub-to-Slack mapping (also reviewer allowlist) |

## How It Works

Each run:

1. Searches open PRs **created in the last 3 months** (newest first)
2. Excludes PRs labeled `suppress-pr-reminder`
3. Excludes draft PRs
4. Keeps only PRs with requested reviewers present in `config/users.json`
5. Limits to **up to 100 PRs** per run
6. Groups PRs by reviewer and posts a single Slack message

If there are no matching PRs, it posts:

```
🎉 No PRs waiting for review! The queue is empty.
```

## Notes and Limits

- The GitHub Search API is used, and results are capped at 100 per run.
- PRs older than 3 months are ignored.
- Only reviewers in `config/users.json` are considered. PRs whose requested reviewers are not in the mapping are excluded.
- The `suppress-pr-reminder` label always excludes a PR.

## Changing the Schedule

Edit the cron expression in `.github/workflows/pr-reminders.yml`. The schedule is in UTC.

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
