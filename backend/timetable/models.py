import uuid
from django.db import models
from django.conf import settings


class Department(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


class Floor(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='floors')
    number = models.IntegerField()

    def __str__(self):
        return f"{self.department.code} - Floor {self.number}"


class Room(models.Model):
    ROOM_TYPES = [('Lec', 'Lecture'), ('Lab', 'Laboratory')]
    floor = models.ForeignKey(Floor, on_delete=models.CASCADE, related_name='rooms')
    name = models.CharField(max_length=50)
    capacity = models.IntegerField()
    room_type = models.CharField(max_length=10, choices=ROOM_TYPES, default='Lec')

    @property
    def full_name(self):
        return f"{self.floor.department.name} - {self.name}"

    def __str__(self):
        return f"{self.full_name} ({self.capacity})"


class Course(models.Model):
    course_id = models.CharField(max_length=20, unique=True)  # e.g., CS-501
    name = models.CharField(max_length=255)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='courses')

    def __str__(self):
        return f"{self.course_id} - {self.name}"


class Batch(models.Model):
    SHIFT_CHOICES = [('M', 'Morning'), ('E', 'Evening')]
    name = models.CharField(max_length=100)  # e.g., BSSE-2023-A
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='batches')
    semester = models.IntegerField(default=1)
    shift = models.CharField(max_length=1, choices=SHIFT_CHOICES, default='M')
    courses = models.ManyToManyField(Course, related_name='batches')

    def __str__(self):
        return f"{self.name} (Sem {self.semester}) [{self.shift}]"


class Faculty(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='faculty')
    tier = models.IntegerField(default=3)
    email = models.EmailField(unique=True)
    requested_slots = models.JSONField(default=list, blank=True)
    can_teach = models.ManyToManyField(Course, related_name='teachers')

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'timetable_teacher'


class CourseAssignment(models.Model):
    TYPE_CHOICES = [('T', 'Theory'), ('P', 'Practical')]
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='assignments')
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='assignments')
    teacher = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='assignments')
    weekly_hours = models.IntegerField(default=3)
    type = models.CharField(max_length=1, choices=TYPE_CHOICES, default='T')

    def __str__(self):
        return f"{self.course.course_id} for {self.batch.name} by {self.teacher.name}"


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

    assignment = models.ForeignKey(CourseAssignment, on_delete=models.CASCADE, related_name='entries')
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, related_name='entries')
    day_of_week = models.CharField(max_length=3, choices=DAY_CHOICES)
    start_time = models.TimeField()
    duration_minutes = models.IntegerField(default=100)
    is_locked = models.BooleanField(default=False)

    class Meta:
        unique_together = ['room', 'day_of_week', 'start_time']

    def __str__(self):
        return f"{self.assignment} @ {self.room} on {self.day_of_week} {self.start_time}"


class TimetableConstraint(models.Model):
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

class SystemConfiguration(models.Model):
    app_name = models.CharField(max_length=100, default='NexusTime')
    org_name = models.CharField(max_length=100, default='University of Agriculture')
    academic_term = models.CharField(max_length=100, default='Fall 2026')
    logo_url = models.URLField(max_length=500, null=True, blank=True, help_text='URL to the institution logo')
    
    break_start = models.TimeField(null=True, blank=True, help_text='Local time when a fixed break starts (HH:MM)')
    break_end = models.TimeField(null=True, blank=True, help_text='Local time when a fixed break ends (HH:MM)')
    max_daily_classes = models.IntegerField(default=6, help_text='Soft limit for classes per batch per day')
    gap_penalty = models.FloatField(default=1.0, help_text='Weight for the gap-minimization objective')

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name_plural = 'System Configuration'

    def __str__(self):
        return "Global System Configuration"
