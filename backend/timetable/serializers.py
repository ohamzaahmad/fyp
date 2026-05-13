from rest_framework import serializers
from . import models


class FacultySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Faculty
        fields = '__all__'


class BuildingSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Building
        fields = '__all__'


class FloorSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Floor
        fields = '__all__'


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Room
        fields = '__all__'


class CourseLoadSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.CourseLoad
        fields = '__all__'


class ScheduleEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ScheduleEntry
        fields = '__all__'


class TimetableConstraintSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.TimetableConstraint
        fields = ['id', 'break_start', 'break_end', 'max_daily_classes', 'gap_penalty', 'metadata', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Department
        fields = ['id', 'code', 'name', 'created_at']


class RoomTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.RoomType
        fields = ['id', 'code', 'name', 'created_at']


class DepartmentModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Department
        fields = ['id', 'code', 'name']


class RoomTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.RoomType
        fields = ['id', 'code', 'name']
