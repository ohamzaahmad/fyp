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
