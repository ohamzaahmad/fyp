# UniScheduler

<p align="center">
  <img src="frontend/public/project.png" alt="UniScheduler Logo" width="96" />
</p>

UniScheduler is a university timetable and scheduling application that helps administrators, teachers and students manage class sessions, rooms, teachers, and automated scheduling/adjustments. This repository contains a Django REST Framework backend and a React + Vite frontend.

**Table of Contents**

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Architecture & Layout](#architecture--layout)
- [Prerequisites](#prerequisites)
- [Local Setup (Backend)](#local-setup-backend)
- [Local Setup (Frontend)](#local-setup-frontend)
- [Development Workflow](#development-workflow)
- [Testing & Linting](#testing--linting)
- [Production Build & Deploy](#production-build--deploy)
- [Data and Migrations](#data-and-migrations)
- [Important Files / Paths](#important-files--paths)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License & Contact](#license--contact)


## Project Overview

UniScheduler provides:

- A web-based timetable grid and printable timetables.
- Centralized schedule data (`masterMap`) and normalized session entries.
- Tools for suggestions, merging/unmerging sessions, conflict detection, and automated schedule generation.
- Admin interfaces for adjustments and room/teacher management.

This repository was organized to separate the API/backend (Django) and the frontend (React + Vite). The frontend communicates with the backend over REST endpoints and listens for server-sent events for live analytics updates.


## Key Features

- Visual timetable grid with printable export
- Teacher and batch timetables
- Merge/unmerge session candidates and conflicts handling
- Lock/unlock sessions and persist changes to backend
- Search, locate-in-grid and navigation that highlights target sessions
- Onboarding/joyride guide (non-blocking auto-start behavior)
- SSE-driven analytics feed (throttled on the client to reduce API load)


## Architecture & Layout

- Backend: Django + Django REST Framework
  - `backend/` — Django project root (manage.py, settings, apps)
  - `backend/nexustime/` — Django project config
  - `backend/timetable/` — timetable app: models, views, serializers, migrations

- Frontend: React + TypeScript + Vite
  - `frontend/` — React app
  - `frontend/src/` — source code
  - Key frontend modules: `components/`, `context/` (DataContext), `services/` (api, timetableLogic)

- Database
  - Default development DB: `backend/db.sqlite3`


## Prerequisites

- Node.js (16+) and npm or pnpm
- Python 3.10+ (or as per your environment)
- pip and virtualenv / venv recommended
- (Optional) PostgreSQL for production


## Local Setup (Backend)

1. Create and activate a Python virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
```

2. Install Python dependencies:

```powershell
pip install -r backend/requirements.txt
```

3. Configure environment variables (example)

- `DJANGO_SECRET_KEY` — set a secret key
- `DATABASE_URL` — optional (for non-sqlite setups)
- `DEBUG` — true/false

You can use a `.env` loader in your local environment or pass variables in your shell.

4. Apply migrations and (optionally) seed data:

```powershell
cd backend
python manage.py migrate
# optional seed helpers
python manage.py loaddata initial_data.json  # if available
python manage.py runserver
```

Notes:
- There are management commands under `backend/timetable/management/commands/` such as `seed_data.py` and `set_test_passwords.py` that help bootstrap local dev data.


## Local Setup (Frontend)

1. Install Node dependencies and run dev server:

```powershell
cd frontend
npm install
npm run dev
# or for production build
npm run build
```

2. Environment Variables (frontend)

Create `.env` or `.env.local` in the `frontend` folder to configure API base URL and feature flags. Example variables used in the project:

- `VITE_API_BASE` — base URL for API calls (e.g. `http://localhost:8000/api`)
- `VITE_ANALYTICS_FEED_LIMIT` — number of SSE feed items to keep in memory


## Development Workflow

- Backend run:

```powershell
cd backend
python manage.py runserver
```

- Frontend run:

```powershell
cd frontend
npm run dev
# open http://localhost:5173 (or the port Vite shows)
```

- Common actions:
  - Make migrations: `python manage.py makemigrations` then `migrate`.
  - Seed test data: `python manage.py seed_data` (if provided).
  - Update translations or static assets as needed.


## Testing & Linting

- Frontend TypeScript check / lint:

```powershell
cd frontend
npm run lint
# or run tsc directly
npm run tsc
```

- Backend tests (if provided):

```powershell
cd backend
python manage.py test
```


## Production Build & Deploy

- Frontend production build:

```powershell
cd frontend
npm run build
# deploy the `dist/` contents to your static hosting or serve via Django's staticfiles
```

- Backend deploy steps (brief):
  - Configure production settings, secret key, database (Postgres recommended), and static file serving.
  - Run `collectstatic` and apply database migrations.
  - Use Gunicorn / Daphne and a reverse proxy (Nginx) in front for best results.


## Data and Migrations

- Database file (dev): `backend/db.sqlite3`
- Backup copies may be present in `backend/db.sqlite3.bak_*`
- Migration backups are kept in `backend/migration_backups/`


## Important Files / Paths

- Backend:
  - `backend/manage.py`
  - `backend/requirements.txt`
  - `backend/nexustime/settings.py`
  - `backend/timetable/models.py` — core schedule models
  - `backend/timetable/views.py` — API endpoints

- Frontend:
  - `frontend/src/App.tsx` — main app routing & state
  - `frontend/src/context/DataContext.tsx` — application data provider (masterMap, sessions)
  - `frontend/src/services/api.ts` — API wrapper
  - `frontend/src/components/timetable/` — timetable UI components


## Customizations & Notes

- Logo and branding:
  - Place the project logo at `backend/media/logos/logo.png` (used by README display) or in the frontend public folder (`frontend/public/logo.png`) to be referenced by the app and documentation.
  - The app title and favicon are wired to `systemSettings` and will update the browser document title and favicon at runtime when `systemSettings` contains branding fields.

- Jump-to-session navigation: The app uses a custom `nexus:jump-to-session` event and `localStorage.nexus_jump_to_session` to navigate and highlight sessions across components; see `frontend/src/components/timetable/TimetableGrid.tsx` and `frontend/src/App.tsx` for details.

- SSE & analytics: The frontend listens to an SSE channel for analytics updates. Throttle logic exists to consolidate rapid SSE messages and avoid summary endpoint over-fetching.


## Troubleshooting

- TypeScript errors on build:
  - Run `npm run tsc` to see the specific errors. Many fixes are simple: add explicit types, fix imports, or update `tsconfig.json` paths.

- Backend 403 when creating adjustment requests:
  - Ensure the server is restarted after backend code changes.
  - Verify Authorization headers and the `related_entry` payload format. The backend supports `related_entry` as `entry-<id>` or numeric IDs for admin-created requests.

- Too many summary API calls:
  - Confirm frontend throttling is active (recent patches added a 5s min interval) or reduce SSE frequency from the server.


## Contributing

We welcome contributions. A suggested workflow:

1. Fork the repo and create a feature branch.
2. Run the dev servers and reproduce your changes locally.
3. Add tests (where applicable) and lint/format code.
4. Create a pull request describing the change and motivation.

Coding conventions and tips:
- Keep the `DataContext` consistent: update both `classes` and `masterMap` when mutating schedule entries.
- Use normalization helpers in `frontend/src/lib/utils.ts` to avoid id mismatches (e.g., `faculty-<id>` vs numeric ids).


## License & Contact

Add your preferred license here. For example, to use MIT:

```
MIT License
```

For questions or help, contact the project maintainer or open an issue in the repository.


---

_Last updated: May 2026_
