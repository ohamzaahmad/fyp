from django.contrib import admin
from . import models


@admin.register(models.Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('code', 'name')


@admin.register(models.Floor)
class FloorAdmin(admin.ModelAdmin):
    list_display = ('department', 'number')


@admin.register(models.Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'floor', 'capacity', 'room_type')


@admin.register(models.Course)
class CourseAdmin(admin.ModelAdmin):
    def department_list(self, obj):
        return ', '.join([d.name for d in obj.department.all()])
    department_list.short_description = 'Departments'
    list_display = ('course_id', 'name', 'department_list')


@admin.register(models.Batch)
class BatchAdmin(admin.ModelAdmin):
    list_display = ('name', 'department', 'semester', 'shift')


@admin.register(models.Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ('name', 'department', 'tier', 'email')


@admin.register(models.ScheduleAdjustmentRequest)
class ScheduleAdjustmentRequestAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'related_entry', 'requested_day', 'requested_time', 'status', 'created_at', 'reviewed_at')
    list_filter = ('status', 'requested_day', 'created_at')
    search_fields = ('teacher__name', 'reason', 'admin_notes')


@admin.register(models.CourseAssignment)
class CourseAssignmentAdmin(admin.ModelAdmin):
    list_display = ('course', 'batch', 'teacher', 'weekly_hours', 'type')


@admin.register(models.ScheduleEntry)
class ScheduleEntryAdmin(admin.ModelAdmin):
    list_display = ('assignment', 'room', 'day_of_week', 'start_time', 'duration_minutes', 'is_locked')


@admin.register(models.TimetableConstraint)
class TimetableConstraintAdmin(admin.ModelAdmin):
    list_display = ('id', 'break_start', 'break_end', 'max_daily_classes', 'gap_penalty', 'created_by', 'created_at')

@admin.register(models.SystemConfiguration)
class SystemConfigurationAdmin(admin.ModelAdmin):
    list_display = ('id', 'app_name', 'org_name', 'academic_term', 'updated_at')
