from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Run the CP-SAT timetable solver and persist results."

    def add_arguments(self, parser):
        parser.add_argument('--time-limit', type=int, default=60, help='Time limit in seconds')
        parser.add_argument('--horizon', type=int, default=12 * 60, help='Horizon in minutes')

    def handle(self, *args, **options):
        time_limit = options['time_limit']
        horizon = options['horizon']
        self.stdout.write(f"Running solver (time_limit={time_limit}, horizon={horizon})")

        # Import the solver here so Django settings are configured by manage.py
        try:
            from solver.solver import solve_timetable
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Failed to import solver: {e}"))
            return

        try:
            success = solve_timetable(time_limit_seconds=time_limit, horizon=horizon)
            if success:
                self.stdout.write(self.style.SUCCESS("Solver completed and persisted results."))
            else:
                self.stderr.write(self.style.ERROR("Solver failed or found no solution."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Solver raised an exception: {e}"))
