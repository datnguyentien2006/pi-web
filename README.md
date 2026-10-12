# Pi Web

[中文文档](./README.zh-CN.md)

Local web UI for the [pi coding agent](https://github.com/badlogic/pi-mono). pi-web reads your local pi session files and gives you a browser workspace for session browsing, real-time chat, model configuration, skill management, and project file preview.

The same pi session in CLI and pi-web: structured tool calls, readable Markdown, session browsing, and cleaner results.

This project is a UI/UX redesign and desktop adaptation based on the original version by @agegr. Original project: [pi-web original version](https://github.com/agegr/pi-web)


## Desktop app (Windows)

This fork also builds into a standalone Windows desktop application — no Node.js or pi CLI install required. The pi coding engine and all LLM provider SDKs are bundled inside the `.exe`.

**Build it yourself:**

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
```

Open <http://localhost:30141> in your browser.

### Development mode

```bash
npm run dev
```

Starts the Next.js dev server on <http://localhost:30141> with hot reload.

---

## Configuration

### Model providers

Configure providers in `~/.pi/agent/models.json`:

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        {
          "id": "qwen2.5-coder:7b",
          "name": "Qwen2.5 Coder 7B (Local)",
          "contextWindow": 32768,
          "maxTokens": 8192
        }
      ]
    },
    "groq": {
      "baseUrl": "https://api.groq.com/openai/v1",
      "api": "openai-completions",
      "apiKey": "$GROQ_API_KEY",
      "compat": {
        "supportsDeveloperRole": true,
        "supportsReasoningEffort": true
      },
      "models": [
        {
          "id": "openai/gpt-oss-120b",
          "name": "GPT-OSS 120B (Groq)",
          "contextWindow": 131072,
          "maxTokens": 65536
        }
      ]
    }
  }
}
```

Set the default model in `~/.pi/agent/settings.json`:

```json
{
  "defaultProvider": "groq",
  "defaultModel": "openai/gpt-oss-120b"
}
```

Environment variables go in `~/.bashrc`:

```bash
export GROQ_API_KEY="gsk_..."
export OPENROUTER_API_KEY="sk-or-..."
```

### Port

The default port is `30141`. Change it in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev -p 30141",
    "start": "next start -p 30141"
  }
}
```

---

## Keyboard Shortcuts

### Chat input

| Key | Action |
| --- | --- |
| `Enter` | Send message |
| `Shift+Enter` / `Ctrl+J` | New line |
| `Ctrl+A` | Move to line start |
| `Ctrl+E` | Move to line end |
| `Ctrl+W` | Delete word backward |
| `Ctrl+U` | Delete to line start |
| `Ctrl+K` | Delete to line end |
| `Ctrl+Y` | Paste last deleted text |
| `/` | Slash commands |
| `@` | Reference files |

### Session sidebar

| Key | Action |
| --- | --- |
| `Ctrl+1..9` | Switch to workspace N |
| `Ctrl+N` | New session |
| Click logo | Toggle π digits display |

---

## Development

### Project structure

```text
pi-web/
├── app/                  # Next.js App Router (pages + API routes)
│   ├── api/              #   Backend endpoints
│   ├── layout.tsx        #   Global layout
│   ├── page.tsx          #   Main page entry
│   └── globals.css       #   Global styles + theme tokens
├── components/           # Reusable React components
├── hooks/                # Client-side hooks
├── lib/                  # Shared logic (session reader, RPC, file access)
├── desktop/              # Electron packaging (optional)
├── bin/                  # CLI entry points
├── public/               # Static assets
├── docs/                 # Documentation
└── package.json
```

### Scripts

```bash
npm run dev      # Dev server with hot reload
npm run build    # Production build
npm start        # Run production build
npm run lint     # ESLint
```

### Tech stack

- Next.js 16 (App Router, Webpack)
- React 19
- TypeScript 5
- Tailwind CSS 4
- pi-coding-agent (agent runtime + session management)
- react-markdown + react-syntax-highlighter (message rendering)

---

## Desktop App (Optional)

The repo includes Electron packaging in `desktop/`. To build a desktop bundle:

```bash
npm run desktop:build
```

Output goes to `desktop/dist/` (ignored by Git). Platform-specific:

- **macOS:** `.dmg` (arm64 + x64)
- **Windows:** `.exe` installer
- **Linux:** `.AppImage`

---

## Architecture

Pi Web is a thin web layer around pi-coding-agent:

```text
Browser (Next.js UI)
        │
        ▼
  HTTP / SSE
        │
        ▼
Next.js API routes  ──►  pi-coding-agent (Node process)
        │                        │
        │                        ▼
        │                 Session files (~/.pi/agent/sessions/)
        │                 Model registry (~/.pi/agent/models.json)
        │                 Skills / plugins (~/.pi/agent/skills/)
        ▼
  Static file serving (public/)
```

- **No separate backend** — API routes run inside Next.js
- **No database** — sessions live as JSON files on disk
- **No auth** — designed for local use only

---

## Credits

- Original project: [tingwdsj/pi-web](https://github.com/tingwdsj/pi-web) by [@tingwdsj](https://github.com/tingwdsj)
- Agent runtime: [pi-coding-agent](https://github.com/earendil-works/pi-coding-agent)
- This fork: [@datnguyentien2006](https://github.com/datnguyentien2006)

Special thanks to the upstream contributors for the original architecture and feature set.

---

## License

MIT — same as the upstream project.
