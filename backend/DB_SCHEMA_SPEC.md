# NexusTime AI: Database Schema (Django Models)

Based on the UAF Master Timetable requirements and the React frontend architecture, here is the recommended database schema for your Django/PostgreSQL backend.

## 1. Faculty Model (Faculty Registry)
```python
from django.db import models

class Department(models.TextChoices):
    CS = 'Computer Science', 'Computer Science'
    PHYSICS = 'Physics', 'Physics'
    MATH = 'Mathematics', 'Mathematics'
    ARTS = 'Arts', 'Arts'
    ENGINEERING = 'Engineering', 'Engineering'

class Faculty(models.Model):
    name = models.CharField(max_length=255)
    department = models.CharField(max_length=50, choices=Department.choices)
    tier = models.IntegerField(default=3)  # 1: Hard Constraint, 3: Soft Preference
    email = models.EmailField(unique=True)
    
    # JSON list of HH:mm strings for requested slots
    requested_slots = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name
```

## 2. Infrastructure Models (Buildings & Rooms)
```python
class Building(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True) # e.g., 'MB' for Main Block

class Floor(models.Model):
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name='floors')
    number = models.IntegerField()

class Room(models.Model):
    ROOM_TYPES = [('Lec', 'Lecture'), ('Lab', 'Laboratory')]
    
    floor = models.ForeignKey(Floor, on_delete=models.CASCADE, related_name='rooms')
    name = models.CharField(max_length=50) # e.g., 'R#1'
    capacity = models.IntegerField()
    room_type = models.CharField(max_length=10, choices=ROOM_TYPES, default='Lec')

    @property
    def full_name(self):
        return f"{self.floor.building.name} - {self.name}"
```

## 3. Course Load Model (Source of Truth)
```python
class CourseLoad(models.Model):
    subject_code = models.CharField(max_length=20) # e.g., CS-506-T
    subject_name = models.CharField(max_length=255)
    batch_id = models.CharField(max_length=50) # e.g., BSCS-6th-M3
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE)
    weekly_hours = models.IntegerField(default=3)
```

## 4. Schedule Entry Model (The Allocation Interval)
```python
class ScheduleEntry(models.Model):
    course_load = models.ForeignKey(CourseLoad, on_delete=models.CASCADE)
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True)
    day_of_week = models.CharField(max_length=10) # Mon, Tue, etc.
    start_time = models.TimeField()
    duration_minutes = models.IntegerField(default=100)
    is_locked = models.BooleanField(default=False)

    class Meta:
        # Prevent obvious direct overlaps at DB level
        unique_together = ['room', 'day_of_week', 'start_time']
```

## 5. Python Interval-Overlap Validation Function
Used in the AI solver and API views to check constraints.

```python
def check_interval_overlap(start1, dur1, start2, dur2):
    """
    Validation logic for non-fixed slots.
    Input: start times (datetime.time) and durations (int minutes)
    """
    from datetime import datetime, timedelta
    
    # Convert to minutes from midnight for easy math
    m1_start = start1.hour * 60 + start1.minute
    m1_end = m1_start + dur1
    
    m2_start = start2.hour * 60 + start2.minute
    m2_end = m2_start + dur2
    
    # Overlap exists if max(start) < min(end)
    return max(m1_start, m2_start) < min(m1_end, m2_end)
```
