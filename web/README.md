# VGyan Teacher Dashboard

React + TypeScript + Vite dashboard for teachers: class overview, at-risk watchlist, student directory, reading and writing submissions, frequently missed words, teacher notes, and the anonymised research CSV export.

## Run

```bash
npm install
cp .env.example .env.local   # optional
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck (`tsc -b`) and production build to `dist/` |
| `npm run lint` | Oxlint |

## Data source

All data goes through [`src/api/dashboard.ts`](src/api/dashboard.ts).

- `VITE_API_BASE_URL` **empty** (default): demo mode on the bundled data in `src/data/mockData.ts`. Notes are kept in memory only.
- `VITE_API_BASE_URL` **set**: the dashboard calls the backend, sending `Authorization: Bearer <token>` from `localStorage["vgyan.teacher.token"]` when present.

Proposed endpoints (responses use the shapes in [`src/types.ts`](src/types.ts)):

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/teacher/me` | `Teacher` with `assignedClasses` |
| GET | `/teacher/students` | `Student[]` for the teacher's classes, with recent attempts |
| GET | `/teacher/missed-words` | `MissedWord[]` |
| GET | `/teacher/comments` | `TeacherComment[]` |
| POST | `/teacher/comments` | Body `{ studentId, text, category }` → saved `TeacherComment` |

Teacher login is not built yet; it depends on how the backend issues teacher tokens.

## Deploy

`.github/workflows/web-deploy.yml` builds and publishes the dashboard to GitHub Pages on every push to `main` that touches `web/` (or run it by hand from the Actions tab). It runs in demo mode with a "sample data" banner until the repository variable `VITE_API_BASE_URL` is set under Settings → Secrets and variables → Actions → Variables.

## Research export

The CSV export includes only students whose consent status is `active`, and only the Participant ID (no names or student IDs).
