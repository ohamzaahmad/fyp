from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from datetime import datetime

from . import models, serializers
from .permissions import IsTeacherUser, IsAdminUser


class FacultyViewSet(viewsets.ModelViewSet):
    queryset = models.Faculty.objects.all()
    serializer_class = serializers.FacultySerializer


class BuildingViewSet(viewsets.ModelViewSet):
    queryset = models.Building.objects.all()
    serializer_class = serializers.BuildingSerializer


class RoomViewSet(viewsets.ModelViewSet):
    queryset = models.Room.objects.all()
    serializer_class = serializers.RoomSerializer


class CourseLoadViewSet(viewsets.ModelViewSet):
    queryset = models.CourseLoad.objects.all()
    serializer_class = serializers.CourseLoadSerializer


class ScheduleEntryViewSet(viewsets.ModelViewSet):
    queryset = models.ScheduleEntry.objects.all()
    serializer_class = serializers.ScheduleEntrySerializer


class SolverRunView(APIView):
    """Trigger the solver. Tries to enqueue a Celery task, falls back to synchronous run."""

    def post(self, request):
        try:
            # try to enqueue a Celery task
            from .tasks import generate_timetable
            task = generate_timetable.delay()
            return Response({'task_id': task.id}, status=status.HTTP_202_ACCEPTED)
        except Exception:
            # fallback: run solver synchronously
            try:
                from solver.solver import solve_timetable
                ok = solve_timetable()
                return Response({'status': 'completed' if ok else 'failed'})
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CurrentUserView(APIView):
    """Returns basic information about the currently authenticated user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        data = {
            'username': getattr(user, 'username', ''),
            'email': getattr(user, 'email', ''),
            'is_staff': getattr(user, 'is_staff', False),
            'is_superuser': getattr(user, 'is_superuser', False),
        }

        # Include faculty profile when available
        try:
            faculty = models.Faculty.objects.filter(user=user).first()
            if faculty:
                data['faculty'] = serializers.FacultySerializer(faculty).data
        except Exception:
            pass

        return Response(data)


class TeacherOnlyView(APIView):
    """Example endpoint restricted to teacher accounts (faculty linked to user)."""

    permission_classes = [IsTeacherUser]

    def get(self, request):
        return Response({'ok': True, 'message': 'Hello, teacher: access granted.'})


class AdminOnlyView(APIView):
    """Example endpoint restricted to admin/staff users."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({'ok': True, 'message': 'Hello, admin: access granted.'})


class MasterMapView(APIView):
    """Returns the NexusMasterMap structure expected by the frontend.

    Structure:
    {
      <buildingId>: {
         id, name, floors: { <floorId>: { id, number, rooms: { <roomId>: { id, name, capacity, sessions: [...] }}}}
      }
    }
    """

    permission_classes = [AllowAny]

    def get(self, request):
        # Initialize map with all rooms so empty rooms are included
        result = {}

        rooms = models.Room.objects.select_related('floor__building').all()
        for room in rooms:
            building = room.floor.building
            bkey = f'building-{building.pk}'
            fkey = f'floor-{room.floor.pk}'
            rkey = f'room-{room.pk}'

            if bkey not in result:
                result[bkey] = {'id': bkey, 'name': building.name, 'floors': {}}

            if fkey not in result[bkey]['floors']:
                result[bkey]['floors'][fkey] = {'id': fkey, 'number': room.floor.number, 'rooms': {}}

            result[bkey]['floors'][fkey]['rooms'][rkey] = {
                'id': rkey,
                'name': room.name,
                'capacity': room.capacity,
                'sessions': [],
            }

        entries = models.ScheduleEntry.objects.select_related('course_load__faculty', 'room__floor__building', 'room')
        for entry in entries.all():
            room = entry.room
            if not room:
                continue
            building = room.floor.building
            bkey = f'building-{building.pk}'
            fkey = f'floor-{room.floor.pk}'
            rkey = f'room-{room.pk}'

            # Defensive: ensure keys exist
            if bkey not in result:
                result[bkey] = {'id': bkey, 'name': building.name, 'floors': {}}
            if fkey not in result[bkey]['floors']:
                result[bkey]['floors'][fkey] = {'id': fkey, 'number': room.floor.number, 'rooms': {}}
            if rkey not in result[bkey]['floors'][fkey]['rooms']:
                result[bkey]['floors'][fkey]['rooms'][rkey] = {
                    'id': rkey,
                    'name': room.name,
                    'capacity': room.capacity,
                    'sessions': [],
                }

            cl = entry.course_load
            faculty_id = f'faculty-{cl.faculty.pk}' if cl and cl.faculty else None
            session = {
                'id': f'entry-{entry.pk}',
                'subjectCode': cl.subject_code if cl else None,
                'subjectName': getattr(cl, 'subject_name', None) if cl else None,
                'batchId': cl.batch_id if cl else None,
                'facultyId': faculty_id,
                'roomId': rkey,
                'startTime': entry.start_time.strftime('%H:%M'),
                'durationMinutes': entry.duration_minutes,
                'isLocked': entry.is_locked,
            }

            result[bkey]['floors'][fkey]['rooms'][rkey]['sessions'].append(session)

        return Response(result)


class TimetableMoveView(APIView):
    """Move a class (ScheduleEntry) to a new start time and/or room.

    PATCH /api/timetable/<entry_id>/move/
    Body: { startTime: 'HH:MM', roomId?: 'room-<pk>' }
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, entry_id):
        # Accept IDs like 'entry-12' or raw numeric ids
        try:
            if isinstance(entry_id, str) and entry_id.startswith('entry-'):
                pk = int(entry_id.split('-', 1)[1])
            else:
                pk = int(entry_id)
        except Exception:
            return Response({'error': 'invalid entry id'}, status=status.HTTP_400_BAD_REQUEST)

        entry = get_object_or_404(models.ScheduleEntry, pk=pk)

        start_time_str = request.data.get('startTime')
        room_id = request.data.get('roomId')

        if not start_time_str and not room_id:
            return Response({'error': 'no changes provided'}, status=status.HTTP_400_BAD_REQUEST)

        if start_time_str:
            try:
                entry.start_time = datetime.strptime(start_time_str, '%H:%M').time()
            except Exception:
                return Response({'error': 'invalid time format, expected HH:MM'}, status=status.HTTP_400_BAD_REQUEST)

        if room_id:
            try:
                if isinstance(room_id, str) and room_id.startswith('room-'):
                    room_pk = int(room_id.split('-', 1)[1])
                else:
                    room_pk = int(room_id)
                room = models.Room.objects.get(pk=room_pk)
                entry.room = room
            except Exception:
                return Response({'error': 'invalid room id'}, status=status.HTTP_400_BAD_REQUEST)

        entry.save()

        # Return a frontend-friendly session representation
        cl = entry.course_load
        resp = {
            'id': f'entry-{entry.pk}',
            'subjectCode': cl.subject_code if cl else None,
            'subjectName': getattr(cl, 'subject_name', None) if cl else None,
            'batchId': cl.batch_id if cl else None,
            'facultyId': f'faculty-{cl.faculty.pk}' if cl and cl.faculty else None,
            'roomId': f'room-{entry.room.pk}' if entry.room else None,
            'startTime': entry.start_time.strftime('%H:%M'),
            'durationMinutes': entry.duration_minutes,
            'isLocked': entry.is_locked,
        }

        return Response(resp)


class TimetableGenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            from .tasks import generate_timetable
            task = generate_timetable.delay()
            return Response({'task_id': task.id}, status=status.HTTP_202_ACCEPTED)
        except Exception:
            try:
                from solver.solver import solve_timetable
                ok = solve_timetable()
                return Response({'status': 'completed' if ok else 'failed'})
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DepartmentsListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            data = [label for _, label in models.Department.choices]
        except Exception:
            data = []
        return Response(data)


class FacultyListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = models.Faculty.objects.all()
        out = []
        for f in qs:
            out.append({
                'id': f'faculty-{f.pk}',
                'name': f.name,
                'department': f.get_department_display() if hasattr(f, 'get_department_display') else f.department,
                'tier': f.tier,
                'requestedSlots': f.requested_slots or [],
            })
        return Response(out)
