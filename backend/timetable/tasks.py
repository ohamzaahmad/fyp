from celery import shared_task


@shared_task(bind=True)
def generate_timetable(self):
    """Placeholder task that calls the solver module."""
    try:
        from solver.solver import solve_timetable
        result = solve_timetable()
        return {'ok': bool(result)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
