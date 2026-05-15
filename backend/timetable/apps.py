from django.apps import AppConfig


class TimetableConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'timetable'
    def ready(self):
        # Import signal handlers so they register on app ready
        try:
            import timetable.signals  # noqa: F401
        except Exception:
            pass
