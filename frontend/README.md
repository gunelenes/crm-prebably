# Frontend

React 19 + Vite 8 + Tailwind CSS 4 SPA that consumes the FastAPI backend under `/api`.

See the [root README](../README.md) for the full architecture, feature list and deployment notes.

## Scripts

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # serve the production build locally
npm run lint     # ESLint (flat config in eslint.config.js)
```

## Configuration

The API base URL is a hard-coded constant (see `src/api.js` / `src/App.jsx`) pointing at the Railway production host. For local development, change it to `http://localhost:8000/api`.

Auth state lives in `src/AuthContext.jsx` — JWT is stored in `localStorage` and attached to every request via Axios interceptors.

## Structure

- `src/pages/` — route-level screens (dashboard, contacts, advertising, payments, seminar-forms, parameters, public forms, etc.).
- `src/components/` — shared UI (Sidebar, ContactPanel, modals, spinners, theme toggle).
- `src/ThemeContext.jsx` — light/dark mode toggle persisted in `localStorage`.
- `src/utils.js` — formatting helpers.

All UI copy is Turkish to match the deployment.
