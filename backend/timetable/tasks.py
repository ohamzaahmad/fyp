from celery import shared_task


@shared_task(bind=True)
def generate_timetable(self, constraints=None):
    """Celery task wrapper for the solver.

    `constraints` is expected to be a JSON-serializable dict with optional
    keys like `breakStart`, `breakEnd`, `maxDailyClasses`, `gapPenalty`.
    """
    try:
        from solver.solver import solve_timetable
        result = solve_timetable(constraints=constraints)
        return {'ok': bool(result)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
