from django.conf import settings
from django.db import models


class DepartmentChoices(models.TextChoices):
    CS = 'CS', 'Computer Science'
    PHYSICS = 'PH', 'Physics'
    MATH = 'MATH', 'Mathematics'
    ARTS = 'ARTS', 'Arts'
    ENGINEERING = 'ENG', 'Engineering'


class Faculty(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    department = models.CharField(max_length=50, choices=DepartmentChoices.choices)
    tier = models.IntegerField(default=3)
    email = models.EmailField(unique=True)
    requested_slots = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name
    
    class Meta:
        # Database previously used `teacher` table name in some migration
        # histories; map the current `Faculty` model to that existing
        # table to remain compatible with the sqlite DB state.
        db_table = 'timetable_teacher'


class Building(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True)

    def __str__(self):
        return f"{self.code} - {self.name}"


class Floor(models.Model):
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name='floors')
    number = models.IntegerField()

    def __str__(self):
        return f"{self.building.code} - Floor {self.number}"


class Room(models.Model):
    ROOM_TYPES = [('Lec', 'Lecture'), ('Lab', 'Laboratory')]

    floor = models.ForeignKey(Floor, on_delete=models.CASCADE, related_name='rooms')
    name = models.CharField(max_length=50)
    capacity = models.IntegerField()
    room_type = models.CharField(max_length=10, choices=ROOM_TYPES, default='Lec')

    @property
    def full_name(self):
        return f"{self.floor.building.name} - {self.name}"

    def __str__(self):
        return f"{self.full_name} ({self.capacity})"


class Department(models.Model):
    """Persisted departments to allow CRUD from admin and API.

    We keep `DepartmentChoices` for existing code using choice values; the
    `Department` model stores persistent department rows (code, name).
    """
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


class RoomType(models.Model):
    """Optional persisted room types. Existing `Room.ROOM_TYPES` values are
    used as a fallback when no DB types exist.
    """
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CourseLoad(models.Model):
    subject_code = models.CharField(max_length=20)
    subject_name = models.CharField(max_length=255)
    batch_id = models.CharField(max_length=50)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='course_loads')
    weekly_hours = models.IntegerField(default=3)

    def __str__(self):
        return f"{self.subject_code} - {self.subject_name} [{self.batch_id}]"

    class Meta:
        # Older migrations renamed CourseLoad -> Batch producing
        # `timetable_batch` table. Use this db_table to remain
        # compatible with the current database without running
        # destructive migrations.
        db_table = 'timetable_batch'


class ScheduleEntry(models.Model):
    DAY_CHOICES = [
        ('Mon', 'Monday'),
        ('Tue', 'Tuesday'),
        ('Wed', 'Wednesday'),
        ('Thu', 'Thursday'),
        ('Fri', 'Friday'),
        ('Sat', 'Saturday'),
        ('Sun', 'Sunday'),
    ]

    course_load = models.ForeignKey(CourseLoad, on_delete=models.CASCADE, related_name='entries')
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, related_name='entries')
    day_of_week = models.CharField(max_length=3, choices=DAY_CHOICES)
    start_time = models.TimeField()
    duration_minutes = models.IntegerField(default=100)
    is_locked = models.BooleanField(default=False)

    class Meta:
        unique_together = ['room', 'day_of_week', 'start_time']

    def __str__(self):
        return f"{self.course_load} @ {self.room} on {self.day_of_week} {self.start_time}"


class TimetableConstraint(models.Model):
    """Persisted runtime solver constraints. The frontend may POST these
    to store operator-approved overrides that the solver will read when
    generating timetables.
    """
    break_start = models.TimeField(null=True, blank=True, help_text='Local time when a fixed break starts (HH:MM)')
    break_end = models.TimeField(null=True, blank=True, help_text='Local time when a fixed break ends (HH:MM)')
    max_daily_classes = models.IntegerField(null=True, blank=True, help_text='Soft limit for classes per batch per day')
    gap_penalty = models.FloatField(default=1.0, help_text='Weight for the gap-minimization objective')
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"TimetableConstraint[{self.pk}] gap={self.gap_penalty} break={self.break_start}-{self.break_end}"
