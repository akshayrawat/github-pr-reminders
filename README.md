# GitHub PR Reminders

Posts a daily Slack message listing all open pull requests waiting for review across your GitHub organization.

Runs as a GitHub Action on a cron schedule — no servers, no infrastructure.

## How It Works

Every weekday at 7:30 PM PT (configurable), the action:

1. Fetches all repos in your GitHub org
2. Finds open PRs that have assigned reviewers
3. Filters out draft PRs and PRs labeled `suppress-pr-reminder`
4. Groups PRs by reviewer and maps GitHub usernames to Slack handles
5. Posts a single message to your Slack channel

Example message:

```
🔍 PRs waiting for review

@alice (alice):
• repo-name#123: Fix login bug
• repo-name#456: Add tests

@bob (bob):
• other-repo#789: Update docs
```

If the queue is empty, it posts: `🎉 No PRs waiting for review! The queue is empty.`

## Use as a GitHub Action

### 1. Configure the GitHub-to-Slack user mapping

Edit `config/users.json` to map GitHub usernames to Slack user IDs:

```json
{
  "github-username": "U01SLACKID",
  "another-user": "U02SLACKID"
}
```

To find a Slack user ID: open their profile in Slack, click the three dots menu, and select "Copy member ID".

Unmapped users will still appear in the message (as `username (no Slack mapping)`) but won't get an @-mention.

### 2. Create a Slack bot

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Under **OAuth & Permissions**, add the `chat:write` scope
3. Install the app to your workspace
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
5. Invite the bot to the channel where you want reminders posted

### 3. Create a GitHub Personal Access Token

Create a [fine-grained personal access token](https://github.com/settings/tokens?type=beta) or a classic PAT with `repo` scope that has access to all repos in your org.

### 4. Add secrets and variables to the repo

Go to your repo's **Settings > Secrets and variables > Actions**:

**Secrets:**
| Name | Value |
|------|-------|
| `ORG_GITHUB_TOKEN` | Your GitHub PAT |
| `SLACK_BOT_TOKEN` | Your Slack bot token (`xoxb-...`) |

**Variables:**
| Name | Value |
|------|-------|
| `SLACK_CHANNEL` | The Slack channel ID (e.g. `C01ABCDEF`) |
| `GITHUB_ORG` | Your GitHub org name (e.g. `my-org`) |

To find a Slack channel ID: right-click the channel name, "View channel details", and find it at the bottom.

### 5. Add the workflow

Create or update a workflow in the repo that will run the action:

```yaml
name: PR Review Reminders

on:
  schedule:
    - cron: '30 3 * * 1-5'
  workflow_dispatch:

jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/github-pr-reminders@v1
        with:
          github_token: ${{ secrets.ORG_GITHUB_TOKEN }}
          slack_bot_token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack_channel: ${{ vars.SLACK_CHANNEL }}
          github_org: ${{ vars.GITHUB_ORG }}
```

`users_map_path` defaults to `config/users.json`. Override it if your mapping file lives elsewhere.

### 6. Test it

Go to the repo's **Actions** tab, select "PR Review Reminders", and click **Run workflow** to trigger a manual run.

## Changing the Schedule

Edit the cron expression in `.github/workflows/pr-reminders.yml`:

```yaml
on:
  schedule:
    - cron: '30 3 * * 1-5'  # 7:30 PM PT, weekdays
```

The cron schedule is in UTC. Use [crontab.guru](https://crontab.guru) to build your expression.

## Suppressing Reminders for a PR

Add the `suppress-pr-reminder` label to any PR you want excluded from the daily message.

## Development

Requires [Bun](https://bun.sh).

```bash
bun install
bun test
```

To run locally (use GitHub Actions-style input env vars):

```bash
INPUT_GITHUB_TOKEN=... \
INPUT_SLACK_BOT_TOKEN=... \
INPUT_SLACK_CHANNEL=... \
INPUT_GITHUB_ORG=... \
bun run src/index.ts
```

## Releasing

1. Run `bun install`
2. Build the action: `bun run build` (commits `dist/index.js`)
3. Commit `dist/`
4. Tag a release (e.g. `v1.0.0`) and move `v1` to the same commit
