# Distributed Issue Tracker (`dit`)

An issue tracker that lives directly in your Git repository.

## Why `dit`?

Traditional issue trackers often suffer from major deficiencies:

1.  **Online Dependence:** Most issue trackers are centralized and require an internet connection. `dit` is distributed and offline-first, just like Git. You can manage your issues while on a plane, a train, or in a remote cabin.
2.  **State Mismatch:** Issue state is often disconnected from the code state. An issue might be "closed" in `main` but still "open" in a release branch. `dit` stores issue state directly in your repository, meaning issue changes are tied to your commits and branches. When you merge a branch, you merge the fixes *and* the issue updates.
3.  **Subjective Prioritization:** Traditional trackers rely on static labels (High/Med/Low) that are subjective and prone to inflation - eventually, everything becomes "High Priority." `dit` replaces these rigid buckets with a **Bayesian consensus engine**. Instead of a single manager deciding what matters, the engine aggregates rankings from every contributor to calculate a dynamic "True Priority." It weighs every opinion to produce a confidence-adjusted score, mathematically distinguishing between *true consensus* (everyone agrees) and *contention* (high disagreement). This ensures your backlog reflects the collective intelligence of the team, not just the loudest voice.
## Key Features

-   🚀 **Distributed & Offline-First:** Your issue database is embedded in your repo.
-   🌿 **Branch-Aware:** Issue status evolves with your code across branches and merges.
-   💻 **Dual Interface:** Use the high-performance CLI for quick tasks or the interactive Web Dashboard for a richer experience.
-   📊 **Collaborative Ranking:** Drag-to-rank issues and let the system combine everyone’s votes into a global priority list with confidence estimates.
-   📜 **Issue History:** Track every change to an issue or comment with integrated version history.
-   📎 **Rich Media Support:** Attach files and paste images directly into issues and comments via the web dashboard.
-   ⌨️ **Keyboard Shortcuts:** Efficiently navigate and manage issues with intuitive keyboard commands (e.g., `/` to search, `c` for new).
-   👤 **User Profiles & Avatars:** Visualize authors and assignees with customized local profiles and avatars.
-   📥 **GitHub Import:** Easily migrate your existing GitHub issues, comments, and user metadata.
-   📄 **Human-Readable:** Data is stored in YAML, making it easy to inspect, search, and version control.
-   🔑 **Passkey Support:** Securely authenticate with the web interface using modern WebAuthn passkeys.
-   🔐 **GitHub Device Login (Web):** Optional GitHub device-flow login for the web UI.
-   🟡 **Change Tracking:** Instantly see uncommitted changes to issues with visual "dirty" indicators in both CLI and Web.

## Installation

### Prerequisites

-   **Node.js** (v18 or later recommended)
-   **Git**

### Setup

You can install `dit` globally using npm:

```bash
npm install -g @kered/dit
```

Or using yarn:

```bash
yarn global add @kered/dit
```

## Quick Start

1.  **Initialize your first issue:**
    ```bash
    dit new
    ```
    If it's your first time, `dit` will guide you through a quick one-time profile setup.

2.  **List open issues:**
    ```bash
    dit ls
    ```

3.  **Launch the web interface:**
    ```bash
    dit web
    ```
    Visit `http://localhost:1337` to browse and manage issues in your browser.

4.  **(Optional) Enable GitHub login for the web UI:**
    ```bash
    dit web auth
    ```
    This stores your GitHub OAuth app client ID in `.dit/oauth/github.yaml`. The client ID is **not secret** and does not grant access by itself; it simply enables the device-flow login button in the web UI. It is safe to commit this file, even in a public repo.

4.  **Rank issues (web):**
    Open the Issues page, click **Rank**, and drag items from Unranked to Ranked. Saved rankings are aggregated with others to compute a consistent priority ordering and confidence estimates.

## CLI Commands

-   `dit new [issue|template]` - Create a new issue or a new issue template.
-   `dit ls [--all]` - List all issues in the current branch.
-   `dit view <id>` - View details and comments for a specific issue.
-   `dit edit <id>` - Edit an existing issue.
-   `dit comment <id>` - Add a comment to an issue.
-   `dit import [github-url] [--all] [--users] [--verbose]` - Import issues and comments from GitHub. Use `--all` for closed issues, and `--users` to only sync user metadata/avatars.
-   `dit web` - Launch the interactive local web dashboard.
-   `dit web passkey` - Create a passkey for secure browser authentication.
-   `dit web auth` - Store GitHub OAuth client ID for web device-flow login.

## How it Works

`dit` stores all issue data in a hidden `.dit` directory at the root of your repository:

```text
.dit/
├── issues/
│   └── YYYY/
│       └── MM/
│           └── DD/
│               └── <slug>-<id>/
│               ├── meta.yaml
│               ├── description.md
│               └── comments/
│                   └── <comment-id>.yaml
└── templates/
    └── <template-name>.md
```

Optional GitHub web auth configuration and tokens:

```text
.dit/
├── oauth/
│   └── github.yaml        # GitHub OAuth app client_id (not secret)
└── secrets/
    └── github/
        └── <username>.yaml # Per-user GitHub access tokens
```

Important: `.dit/secrets/` is **local-only** and ignored by Git. It is not meant to be committed or shared.

Because these files are part of your repository, they are versioned alongside your code. When you run `dit new` or `dit comment`, the files are automatically staged (`git add`) so they can be included in your next commit.

## Ranking Model

The ranking UI is built for collaborative prioritization. Each saved ranking is treated as a multiplayer “match” where issues compete for priority. A factor-graph-based Bayesian inference model aggregates all rankings to estimate a global priority (the ordering) and confidence (how stable that ordering is). Agreement across rankings raises confidence; disagreement lowers it.

## Development

-   **Build:** `yarn build`
-   **Start (Dev):** `yarn start`
-   **Test:** `yarn test`

## License

[GPL-3.0-or-later](LICENSE)
