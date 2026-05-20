Deployment guide — Render (backend) + Vercel (frontend)

This guide walks you through deploying the backend to Render (Docker) and the frontend to Vercel. It includes step-by-step instructions, required environment variables, and troubleshooting notes so you can deploy successfully the first time.

Prerequisites
- A Git hosting provider (GitHub recommended) with this repository pushed to a branch (e.g., `main`).
- Render account (https://render.com) and Vercel account (https://vercel.com).
- Optional: AWS S3 (or other object storage) for media files — Render's filesystem is ephemeral.

High-level overview
- Backend: Docker image built from `backend/Dockerfile`, deployed on Render as a web service + a worker service for Celery. Uses a managed Postgres DB and (recommended) a managed Redis instance.
- Frontend: Vite app built and deployed on Vercel from `frontend/` using `npm run build`, output `dist/`.

Step-by-step: Backend (Render)

1. Connect repository to Render
   - In Render dashboard, create a new service → `Connect a repository` → select your repo and branch (e.g., `main`).
   - Choose `Docker` as the environment and set `Dockerfile` path to `backend/Dockerfile` (you can also import `render.yaml` to create services automatically).

2. Create managed Postgres
   - In Render Dashboard create a new Database → Postgres. Render will provide a `DATABASE_URL` environment variable for the DB.

3. (Recommended) Create a Redis instance
   - On Render, create a new Redis add-on (or external Redis) and copy the connection URL (e.g., `redis://:<password>@<host>:6379/0`).

4. Configure the web service environment variables
   - In service settings, set these env vars (Render UI or `render.yaml`):
     - `DJANGO_SECRET_KEY`: a secure random string (required)
     - `DJANGO_DEBUG`: `False`
   - `DJANGO_ALLOWED_HOSTS`: `fyp-brkr.onrender.com`
   - `DJANGO_CSRF_TRUSTED_ORIGINS`: `https://fyp-brkr.onrender.com`
     - `DATABASE_URL`: Render Postgres `DATABASE_URL` (Render usually sets this automatically)
     - `REDIS_URL`: the Redis add-on URL (required if you use Redis for Celery)
     - Optional tuning: `GUNICORN_WORKERS` (default 2), `DJANGO_SECURE_SSL_REDIRECT` (True)

5. Configure the worker service (Celery)
   - Create a second Render service of type Worker or use `render.yaml`'s worker entry. Use the same Dockerfile. Set env vars as for web service and set `CELERY_CONCURRENCY` to control worker parallelism.

6. Startup behavior and `start.sh`
   - The container runs `backend/start.sh`: it runs `migrate`, `collectstatic`, then starts Gunicorn. This automates migrations on first start. If you prefer manual control, run migrations from Render Shell instead of relying on the startup script.

7. Static files and media
   - `collectstatic` copies static files into `STATIC_ROOT` and WhiteNoise serves them.
   - IMPORTANT: Render's filesystem is ephemeral. Any uploaded media in `MEDIA_ROOT` will not persist across deploys or restarts. Use external storage (S3/DigitalOcean Spaces) for production media and configure `DEFAULT_FILE_STORAGE` accordingly.

8. Deploy & verify
   - Deploy the web service. Check Logs in Render — look for successful `migrate` and `collectstatic` runs.
   - If migrations fail, open a Shell from Render and run:

```bash
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

9. Health checks
   - `render.yaml` includes a basic HTTP health check. Consider adding an explicit endpoint `/api/health/` and point the health check at it.

Step-by-step: Frontend (Vercel)

1. Link repository
   - In Vercel, create a new project → Import Git Repository → select this repo.

2. Configure the project
   - Set Framework Preset to `Other` (Vite works as a static build). Set Root Directory to `frontend/`.
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. Environment variables
   - The frontend expects `VITE_API_URL` (also respects localStorage key `nexus_api_base`). In Vercel set:
   - `VITE_API_URL` = `https://fyp-brkr.onrender.com/api`

4. Deploy and verify
   - Deploy the Vercel project. After deployment, visit the site and test login using the superuser created on the backend.

Local testing (optional)
You can test locally with Docker Compose (requires Docker). Example `docker-compose.yml` for local testing:

```yaml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: nexustime
      POSTGRES_USER: nexus
      POSTGRES_PASSWORD: nexuspwd
    ports:
      - '5432:5432'

  redis:
    image: redis:7
    ports:
      - '6379:6379'

  web:
    build:
      context: .
      dockerfile: backend/Dockerfile
    environment:
      DATABASE_URL: postgres://nexus:nexuspwd@db:5432/nexustime
      REDIS_URL: redis://redis:6379/0
      DJANGO_SECRET_KEY: devsecret
      DJANGO_DEBUG: 'True'
    ports:
      - '8000:8000'
    depends_on:
      - db
      - redis

  worker:
    build:
      context: .
      dockerfile: backend/Dockerfile
    command: celery -A nexustime worker --loglevel=INFO
    environment:
      DATABASE_URL: postgres://nexus:nexuspwd@db:5432/nexustime
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - db
      - redis

```

Run locally:
```bash
docker compose up --build
# then open http://localhost:8000
```

Common issues & troubleshooting
- Missing `DJANGO_SECRET_KEY` or `DJANGO_DEBUG` set to `True` in production — ensure `DJANGO_DEBUG=false`.
- Database connection failures: verify `DATABASE_URL` or `POSTGRES_*` env vars and that the DB accepts connections from the container.
- Psycopg2 build errors locally: use the prebuilt `psycopg2-binary` (already present) or install `libpq-dev` (Dockerfile installs needed build deps).
- Redis/Celery: if Celery fails to connect, confirm `REDIS_URL` is set and reachable by both web and worker services.
- Collectstatic errors: ensure static files exist and WhiteNoise is installed; check logs for file errors.
- Media persistence: uploads will be lost unless you configure external object storage.

Extras & suggestions
- Pin versions in `backend/requirements.txt` for reproducible builds.
- Consider adding a `docker-compose.prod.yml` for staging tests.
- Add Sentry or another error tracker for production monitoring.

If you'd like, I can:
- pin `dj-database-url` and `django-redis` to specific versions in `requirements.txt`,
- add a sample `docker-compose.yml` file to the repo, or
- create a GitHub Actions workflow to auto-deploy to Render and Vercel on push.
