from rest_framework import serializers
from . import models


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Department
        fields = '__all__'


class FloorSerializer(serializers.ModelSerializer):
    department_name = serializers.ReadOnlyField(source='department.name')

    class Meta:
        model = models.Floor
        fields = '__all__'


class RoomSerializer(serializers.ModelSerializer):
    floor_number = serializers.ReadOnlyField(source='floor.number')
    department_name = serializers.ReadOnlyField(source='floor.department.name')

    class Meta:
        model = models.Room
        fields = '__all__'


class CourseSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(queryset=models.Department.objects.all(), many=True)

    class Meta:
        model = models.Course
        fields = '__all__'


class BatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Batch
        fields = '__all__'


class FacultySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Faculty
        fields = '__all__'


class ScheduleAdjustmentRequestSerializer(serializers.ModelSerializer):
    teacher_name = serializers.ReadOnlyField(source='teacher.name')
    teacher_email = serializers.ReadOnlyField(source='teacher.email')
    course_code = serializers.ReadOnlyField(source='related_entry.assignment.course.course_id')
    course_name = serializers.ReadOnlyField(source='related_entry.assignment.course.name')
    batch_name = serializers.ReadOnlyField(source='related_entry.assignment.batch.name')
    room_name = serializers.ReadOnlyField(source='related_entry.room.name')

    class Meta:
        model = models.ScheduleAdjustmentRequest
        fields = [
            'id',
            'teacher',
            'teacher_name',
            'teacher_email',
            'related_entry',
            'course_code',
            'course_name',
            'batch_name',
            'room_name',
            'requested_day',
            'requested_time',
            'reason',
            'status',
            'admin_notes',
            'reviewed_by',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]
        # Allow admins to update `status` (approve/reject). Other fields remain read-only.
        read_only_fields = ['id', 'teacher', 'teacher_name', 'teacher_email', 'admin_notes', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at']


class CourseAssignmentSerializer(serializers.ModelSerializer):
    course_name = serializers.ReadOnlyField(source='course.name')
    batch_name = serializers.ReadOnlyField(source='batch.name')
    teacher_name = serializers.ReadOnlyField(source='teacher.name')

    class Meta:
        model = models.CourseAssignment
        fields = '__all__'


class ScheduleEntrySerializer(serializers.ModelSerializer):
    assignment_details = CourseAssignmentSerializer(source='assignment', read_only=True)

    class Meta:
        model = models.ScheduleEntry
        fields = '__all__'


class TimetableConstraintSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TimetableConstraint
        fields = ['id', 'break_start', 'break_end', 'max_daily_classes', 'gap_penalty', 'metadata', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']

class SystemConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.SystemConfiguration
        fields = '__all__'
        read_only_fields = ['id', 'updated_at', 'updated_by']
