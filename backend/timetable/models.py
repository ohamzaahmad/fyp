from django.conf import settings
from django.db import models


class Department(models.TextChoices):
    CS = 'CS', 'Computer Science'
    PHYSICS = 'PH', 'Physics'
    MATH = 'MATH', 'Mathematics'
    ARTS = 'ARTS', 'Arts'
    ENGINEERING = 'ENG', 'Engineering'


class Faculty(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=255)
    department = models.CharField(max_length=50, choices=Department.choices)
    tier = models.IntegerField(default=3)
    email = models.EmailField(unique=True)
    requested_slots = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name


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


class CourseLoad(models.Model):
    subject_code = models.CharField(max_length=20)
    subject_name = models.CharField(max_length=255)
    batch_id = models.CharField(max_length=50)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='course_loads')
    weekly_hours = models.IntegerField(default=3)

    def __str__(self):
        return f"{self.subject_code} - {self.subject_name} [{self.batch_id}]"


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
