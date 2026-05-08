NexusTime Backend

This folder contains a Django backend scaffold for the NexusTime timetable project.

Quick start (development):

1. Create and activate a virtual environment:

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Unix
source venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env` and set environment variables (optional for PostgreSQL).

4. Run migrations and start the dev server:

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Endpoints are mounted under `/api/` (see `timetable` app). The solver endpoint is `/api/solver/generate/` (enqueue or run solver).
