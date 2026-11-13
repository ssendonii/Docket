# Docket — Meeting Agenda Architect

Docket transforms uploaded documents (`.docx`, `.pdf`, `.md`, `.txt`, `.csv`, `.json`, and other plain-text files) or pasted notes into structured, time-boxed meeting agendas with topic summaries, stakeholder assignments, and prioritized action items.

## Key Capabilities

- **Multi-Format Document Ingestion**: Parses `.docx` via `mammoth`, analyzes `.pdf` natively via Gemini multimodal input, and reads Markdown, CSV, JSON, and plain-text files.
- **Exact Time-Boxing & Rebalancing**: Allocates minutes across topics to match your total meeting time, tracks over/under budget deltas, and supports one-click proportional rebalancing.
- **Action Items & Stakeholder Roster**: Aggregates all tasks across topics into a filterable action-items table and summarizes stakeholder involvement across the meeting.
- **Iframe-Safe PDF & Markdown Export**: Generates multi-page formatted PDF reports client-side via `jspdf`, exports clean Markdown packets, and stores recent agendas locally in the browser.

## Version History

### 1.1.0 — 2026-11-12
- Added server-side AI resilience helper (`generateWithRetryAndFallback`) with an 18-second per-model timeout (`withTimeout`), `ThinkingLevel.LOW` for fast structured JSON generation, and automatic failover from `gemini-3.8-flash` to `gemini-3.1-flash-lite` on `503`/`429`/`404`/timeout errors.
- Added defensive markdown fence stripping (`stripMarkdownJsonFences`) and clean upstream error formatting on the Express server.
- Added `safeFetchJson` on the frontend to read raw response text before parsing JSON and surface clear user-facing errors if a proxy returns HTML or times out.
- Replaced `window.print()`-only export with client-side multi-page PDF generation (`jspdf`) plus confirmation banner, only invoking `window.print()` when `window.self === window.top`.
- Synchronized `package.json` version (`1.1.0`) with `README.md` and displayed the active version in the app header.

### 1.0.0 — 2026-11-12
- Initial release of Docket with `.docx`/`.pdf`/`.md`/text upload, Gemini structured agenda generation, proportional timeline bar, inline topic editing, action items table, stakeholder matrix, and local history.
