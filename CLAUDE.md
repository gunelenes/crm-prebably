# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`backend/`)
- Install: `pip install -r requirements.txt` (use the checked-in `venv/` if present).
- Run locally: `uvicorn app.main:socket_app --reload` — note the entry point is `socket_app` (Socket.IO-wrapped ASGI), **not** `app`. Using `app.main:app` will silently break realtime events and CORS.
- Production (Railway): `Procfile` runs `uvicorn app.main:socket_app --host 0.0.0.0 --port $PORT`.
- Env vars required at boot (`backend/.env`, see `.env.example`): `DATABASE_URL`, `INSTAGRAM_TOKEN`, `WEBHOOK_VERIFY_TOKEN`. `database.py` **raises on import** if `DATABASE_URL` is missing.
- No test suite, no linter configured for backend.

### Frontend (`frontend/`)
- `npm install`, `npm run dev`, `npm run build`, `npm run preview`, `npm run lint` (ESLint flat config in `eslint.config.js`).
- The API base URL is **hardcoded** in `src/App.jsx` to the Railway production host (`const API = "https://crm-prebably-production.up.railway.app/api"`). To point at a local backend, edit that constant.

## Architecture

### Backend (FastAPI + Socket.IO + SQLAlchemy)
- `app/main.py` builds the ASGI stack in a specific order that must be preserved: `FastAPI` app → wrapped by `socketio.ASGIApp` → wrapped by `CORSMiddleware`. The final object is `socket_app` (the deploy target). The `socketio.AsyncServer` instance is stored on `app.state.sio` and also imported directly from `app.main` by webhook handlers to emit events — circular-import-safe because the emit happens lazily inside request handlers.
- `Base.metadata.create_all(bind=engine)` runs at import time of `app/main.py`. There is no migrations framework (Alembic etc.); schema changes happen by editing models and relying on `create_all` — which does **not** alter existing tables. Schema changes to existing columns require manual SQL.
- `app/database.py` forcibly rewrites `DATABASE_URL` to use the `pg8000` driver regardless of what scheme the env var declares (`postgres://`, `postgresql://`, or anything containing `psycopg2`/`asyncpg`). The connection pool is tuned for Railway: `pool_pre_ping=True`, `pool_recycle=300`. Don't switch drivers without also updating `requirements.txt` — `pg8000` is the only pinned PG driver.
- All models live in a single file: `app/models/__init__.py`. The domain is a small CRM around messaging contacts: `Status`, `Contact`, `Conversation`, `Message`, `ActivityLog`, `Reminder`, `QuickReply`. `Contact.purchase_potential` is a Postgres ENUM with Turkish values (`'düşük'|'orta'|'yüksek'`) — changing those values requires a manual `ALTER TYPE`.
- Routers are mounted under `/api` in `main.py`: `webhook`, `messages`, `quick_replies`, `statuses`, `contacts`. Each router uses `Depends(get_db)` for session injection.
- `app/services/` exists but is empty. Business logic currently lives inline in the router files (e.g., the inbound-message-handling logic is in `webhook.save_message`, including auto-creating a Contact, assigning the "İlk Mesaj" Status, writing an `ActivityLog`, and emitting `new_message` over Socket.IO).
- `app/config.py` defaults `DATABASE_URL` to a local MySQL URL, but `database.py` ignores that default and reads `os.getenv("DATABASE_URL")` directly. The config-module fallback is effectively dead code; trust the env var.

### Instagram integration
- Only **Instagram Messaging** is wired end-to-end. WhatsApp env vars exist in config but no router handles WhatsApp.
- `GET /api/webhook` is the Meta verification handshake (checks `hub.verify_token` against `WEBHOOK_VERIFY_TOKEN`).
- `POST /api/webhook` ingests Instagram messaging events. Inbound text creates/updates Contact + Conversation + Message, then `sio.emit("new_message", ...)`. Outbound echoes from our own page ID are skipped by comparing `sender.id == entry.id`.
- `POST /api/sync-conversations` backfills via the Graph API. It hard-codes the page ID `17841401244343060` and a backfill cutoff of `datetime(2026, 5, 15)` — both are literals you may need to change. Pagination stops once a message older than the cutoff is seen.
- `GET /api/conversations/{id}/window` enforces Meta's 24-hour customer-care messaging window. The frontend gates the reply UI on this endpoint's `open` flag; preserve that behavior when touching either side.

### Frontend (React 19 + Vite + Tailwind v4)
- The entire UI is one file: `src/App.jsx` (~750 lines). All pages (`MessagesPage`, `QuickRepliesPage`, `StatusesPage`), modals (`ReminderModal`, `StatusModal`), and the right-rail `ContactPanel` are inline components. There is no router — page switching is local state (`page`) in the top-level `App`.
- Data flow: `App` polls `GET /api/conversations` every 10s via a debounced `fetchConversations` (`fetchTimeoutRef`, 500ms trailing debounce), polls `/api/reminders/active` every 60s, and runs `POST /api/sync-conversations` every 5 minutes. Initial sync on mount is intentionally disabled (see the `// doSync(); ← BU SATIRI SİL` comment). A `socket.io-client` dependency is installed but the live socket wiring is not yet present in `App.jsx` — new realtime work should add it rather than relying on polling.
- All UI text is in Turkish. Keep new copy in Turkish to match the rest of the app.
- Tailwind v4 is enabled via the `@tailwindcss/vite` plugin in `vite.config.js`; there is no `tailwind.config.js`. The single CSS entry is `src/index.css` (one line that imports Tailwind).

### Deployment
- Both apps deploy to Railway. Backend uses the `Procfile`; frontend uses `nixpacks.toml` (only specifies `npm install`, build/start come from package.json defaults).
- The `.env` is gitignored but `backend/.env.example` documents the required keys.
