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
