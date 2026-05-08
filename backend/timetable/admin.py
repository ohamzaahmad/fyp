from django.contrib import admin
from . import models


@admin.register(models.Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ('name', 'department', 'tier', 'email')


@admin.register(models.Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = ('code', 'name')


@admin.register(models.Floor)
class FloorAdmin(admin.ModelAdmin):
    list_display = ('building', 'number')


@admin.register(models.Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'capacity', 'room_type')


@admin.register(models.CourseLoad)
class CourseLoadAdmin(admin.ModelAdmin):
    list_display = ('subject_code', 'subject_name', 'batch_id', 'faculty', 'weekly_hours')


@admin.register(models.ScheduleEntry)
class ScheduleEntryAdmin(admin.ModelAdmin):
    list_display = ('course_load', 'room', 'day_of_week', 'start_time', 'duration_minutes', 'is_locked')
