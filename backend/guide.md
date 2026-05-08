This guide is for building a professional, university-grade backend in **VS Code** using **Django**, **PostgreSQL**, and **Google OR-Tools**. 

This follows the "Resource Optimization" architecture required to handle 500+ teachers and the "Student Gap" problem.

---

### Phase 1: Environment & Project Initialization
1.  **Project Setup:**
    *   Create a virtual environment: `python -m venv venv`.
    *   Install core dependencies:
        ```bash
        pip install django djangorestframework django-cors-headers djangorestframework-simplejwt psycopg2-binary ortools celery redis weasyprint
        ```
2.  **Django Config:**
    *   Set up a custom User model in `users/models.py` to handle roles (`IS_ADMIN`, `IS_TEACHER`).
    *   Configure `settings.py` for **PostgreSQL**, **CORS** (to allow React), and **SimpleJWT**.

---

### Phase 2: Database Schema (Relational Source of Truth)
In your `models.py`, implement these specific relationships to mirror the UAF complexity:

1.  **`Department`**: `id`, `name`, `code`.
2.  **`Room`**: `id`, `building`, `floor`, `room_number`, `capacity`, `room_type` (Lab/Theory).
3.  **`Faculty`**: `id`, `user` (FK to User), `department`, `priority_tier` (1, 2, 3), `max_daily_load`.
4.  **`Batch`**: `id`, `name`, `semester`, `section`, `shift` (Morning/Evening).
5.  **`CourseLoad`**: (Crucial table) 
    *   Connects `Subject`, `Faculty`, and `Batch`. 
    *   Fields: `weekly_hours`, `preferred_duration` (e.g., 60m or 90m sessions).
6.  **`TimetableEntry`**:
    *   `courseload` (FK), `room` (FK), `day` (Mon-Fri).
    *   `start_time` (TimeField), `end_time` (TimeField).
    *   `is_locked` (BooleanField) - If true, the AI cannot move this entry.

---

### Phase 3: JWT & Role-Based Access Control (RBAC)
1.  **Authentication:** Use `rest_framework_simplejwt`.
2.  **Permissions:** Create a `permissions.py` file:
    *   `IsAdminUser`: Grants access to `GenerateTimetable` and `BulkImport`.
    *   `IsTeacherUser`: Grants access to `MySchedule` and `PreferenceSubmission`.
    *   `AllowAny`: Used for the Student view (Public access by Batch ID).

---

### Phase 4: The AI Optimization Engine (The "Brain")
Create a directory `api/solver/` and implement the logic using **Google OR-Tools (CP-SAT)**.

**1. The "Interval" Variable:**
Instead of slots, create an "Interval Variable" for every class in the `CourseLoad`:
`model.NewIntervalVar(start, duration, end, name)`

**2. Hard Constraints (The "No-Clash" Math):**
*   **Teacher/Room/Batch Non-Overlap:** 
    Use `model.AddNoOverlap(intervals_list)` for every Teacher ID, Room ID, and Batch ID.
*   **Fixed Breaks:** 
    Add a constraint that no `TimetableEntry` interval can overlap with the `GlobalBreak` interval defined in your settings.

**3. Soft Constraints (The "Gap Minimizer" Math):**
To solve the 8 AM - 6 PM problem:
*   For every Batch, create a "Presence" variable for every hour of the day.
*   **Penalty Logic:** `Penalty = (Last_Class_End - First_Class_Start) - Total_Class_Minutes`. 
*   The AI will minimize this gap, forcing classes to "cluster" together.

---

### Phase 5: Asynchronous Task Management
Because solving for 500+ teachers takes minutes, you cannot run this in a standard API view.
1.  **Celery Integration:** Create a `tasks.py`.
2.  **Function:** `generate_university_timetable(task_id)`.
    *   This function pulls data from PostgreSQL, runs the OR-Tools solver, and saves the results back to `TimetableEntry`.
3.  **Status Tracking:** React will poll an endpoint `GET /api/task-status/<id>/` to show the progress bar.

---

### Phase 6: Professional Export Engine
1.  **UAF-Style PDF:** Use **WeasyPrint**.
2.  **Logic:** 
    *   Create an HTML template that replicates the UAF Landscape grid.
    *   The Django view fetches all `TimetableEntry` items, groups them by `Building` and `Floor`, and renders them into the template.
    *   Return a `FileResponse` with `content_type='application/pdf'`.

---

### Instructions for VS Code Development:
*   **Type Hinting:** Use Python type hints (`def solve(data: List[dict]) -> bool:`) to ensure your interval math is error-free.
*   **Django Debug Toolbar:** Install this to monitor PostgreSQL query performance when loading the 100-department master grid.
*   **Migrations:** Always run `python manage.py makemigrations` and `migrate` after changing the `CourseLoad` or `TimetableEntry` structures.

---

### What to tell your Teacher:
"The backend is a **Service-Oriented Architecture**. We use **Django** as the data manager, **PostgreSQL** for relational integrity, and **Google OR-Tools** as a Constraint Programming solver. Security is handled via **JWT** with a strict **RBAC** model. The most innovative part of the backend is the **Interval-based Collision Detection**, which handles flexible class timings and automatically minimizes student idle time through a weighted penalty system."