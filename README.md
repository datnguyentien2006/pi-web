cd ~/pi-web
cat > README.md << 'EOF'
# Pi Web

> A browser-based interface for the [Pi coding agent](https://github.com/earendil-works/pi-coding-agent) — browse sessions, chat with AI models, and manage project files from a local web UI.

**English** | [Tiếng Việt](README.vi.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)

---

## ⚠️ Fork Notice

This is a **personal fork** of [`agegr/pi-web`](https://github.com/agegr/pi-web) (originally [`tingwdsj/pi-web`](https://github.com/tingwdsj/pi-web)).

### What's different from upstream

| Change | Description |
| --- | --- |
| 🌐 **English UI** | Complete translation from the original Chinese interface |
| 🎨 **Aqua theme** | Cool blue-gray surface with a teal accent (replaces the warm terracotta palette) |
| ☑️ **Bulk session management** | Select multiple sessions → delete in batch or export as ZIP |
| 🗂️ **Workspaces** | Organize projects into named workspaces with reorder, edit, and keyboard shortcuts |
| 🖼️ **New logo** | Teal-gradient π mark, matching the new theme |
| 📄 **Cleaner repo** | Removed Chinese docs, unused lockfiles, and legacy files |

Original work and architecture by [@tingwdsj](https://github.com/tingwdsj). All credit to the upstream project.

---

## Screenshots

> Add screenshots by placing images in `docs/screenshots/`.

| Main interface | Chat view | Bulk select mode |
| --- | --- | --- |
| ![Main UI](docs/screenshots/main-ui.png) | ![Chat](docs/screenshots/chat.png) | ![Select](docs/screenshots/select-mode.png) |

If you haven't added screenshots yet, delete this section or comment out the table above.

---

## Features

### Core
- **Multi-provider support** — Ollama (local), Groq, OpenRouter, xAI, Anthropic, and any OpenAI-compatible endpoint
- **Streaming responses** — real-time token display with tokens/sec indicator
- **Session browser** — sidebar with running/unread indicators, relative timestamps, and fork tree
- **File explorer** — tree view with type-aware icons; click to preview in the right panel
- **Built-in file viewer** — syntax highlighting for 30+ languages, markdown preview, image/PDF/DOCX/XLSX rendering
- **Branch navigation** — fork a conversation from any message, switch between branches
- **Skills & plugins** — install, upload (ZIP), enable/disable from the UI
- **Worktree support** — manage git worktrees per project

### This fork adds
- **English translation** — every UI string, error message, and prompt is in English
- **Aqua theme** — light and dark variants, with a fresh teal accent
- **Bulk session management** — checkbox select mode with batch delete and ZIP export
- **Workspaces panel** — group projects, reorder with drag-and-drop, switch with `Ctrl+1..9`
- **Auto-open browser** — optional wrapper script that launches the app in your default browser

---

## Quick Start

### Requirements

- **Node.js** ≥ 22.19.0
- **npm** ≥ 10
- **[Pi coding agent](https://github.com/earendil-works/pi-coding-agent)** installed globally

### Install

```bash
# 1. Clone
git clone https://github.com/datnguyentien2006/pi-web.git
cd pi-web

# 2. Install dependencies
npm install

# 3. Build (production)
npm run build

# 4. Install globally
npm install -g .

# 5. Run
pi-web
