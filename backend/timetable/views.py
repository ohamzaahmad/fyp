import csv
import io
import uuid
import re
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from datetime import datetime
from django.utils import timezone
from django.db.models import Sum

from . import models, serializers
from .permissions import IsTeacherUser, IsAdminUser
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = models.Department.objects.all().order_by('name')
    serializer_class = serializers.DepartmentSerializer

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]
        return [IsAdminUser()]

    def create(self, request, *args, **kwargs):
        # Allow creating a department with an initial number of floors by passing `floors` in payload
        floors = request.data.get('floors')
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        department = serializer.save()
        try:
            n = int(floors) if floors is not None else 0
        except Exception:
            n = 0
        if n and n > 0:
            created = []
            for num in range(1, n + 1):
                f = models.Floor.objects.create(department=department, number=num)
                created.append(f)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class FloorViewSet(viewsets.ModelViewSet):
    queryset = models.Floor.objects.all().order_by('department', 'number')
    serializer_class = serializers.FloorSerializer


class RoomViewSet(viewsets.ModelViewSet):
    queryset = models.Room.objects.all().order_by('floor', 'name')
    serializer_class = serializers.RoomSerializer


class CourseViewSet(viewsets.ModelViewSet):
    queryset = models.Course.objects.all().order_by('course_id')
    serializer_class = serializers.CourseSerializer


class BatchViewSet(viewsets.ModelViewSet):
    queryset = models.Batch.objects.all().order_by('name')
    serializer_class = serializers.BatchSerializer


class FacultyViewSet(viewsets.ModelViewSet):
    queryset = models.Faculty.objects.all().order_by('name')
    serializer_class = serializers.FacultySerializer


class CourseAssignmentViewSet(viewsets.ModelViewSet):
    queryset = models.CourseAssignment.objects.all()
    serializer_class = serializers.CourseAssignmentSerializer


class ScheduleEntryViewSet(viewsets.ModelViewSet):
    queryset = models.ScheduleEntry.objects.all()
    serializer_class = serializers.ScheduleEntrySerializer


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username_field = self.username_field
        identifier = (attrs.get(username_field, '') or '').strip()
        if identifier and '@' in identifier:
            User = get_user_model()
            user = User.objects.filter(email__iexact=identifier).order_by('pk').first()
            if user:
                attrs[username_field] = getattr(user, username_field)
        return super().validate(attrs)


class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenObtainPairSerializer


class SolverRunView(APIView):
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


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        user = request.user
        data = {
            'username': getattr(user, 'username', ''),
            'email': getattr(user, 'email', ''),
            'is_staff': getattr(user, 'is_staff', False),
            'is_superuser': getattr(user, 'is_superuser', False),
        }
        try:
            faculty = models.Faculty.objects.filter(user=user).first()
            if faculty:
                data['faculty'] = serializers.FacultySerializer(faculty).data
        except Exception:
            pass
        return Response(data)


class MasterMapView(APIView):
    """Returns the NexusMasterMap structure expected by the frontend.
    Aggregated by Department -> Floor -> Room.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        result = {}
        rooms = models.Room.objects.select_related('floor__department').all()
        for room in rooms:
            dept = room.floor.department
            dkey = f'dept-{dept.pk}'
            fkey = f'floor-{room.floor.pk}'
            rkey = f'room-{room.pk}'

            if dkey not in result:
                result[dkey] = {'id': dkey, 'name': dept.name, 'floors': {}}

            if fkey not in result[dkey]['floors']:
                result[dkey]['floors'][fkey] = {'id': fkey, 'number': room.floor.number, 'rooms': {}}

            result[dkey]['floors'][fkey]['rooms'][rkey] = {
                'id': rkey,
                'name': room.name,
                'capacity': room.capacity,
                'sessions': [],
            }

        entries = models.ScheduleEntry.objects.select_related('assignment__teacher', 'assignment__course', 'assignment__batch', 'room__floor__department', 'room')
        for entry in entries.all():
            room = entry.room
            if not room: continue
            dept = room.floor.department
            dkey = f'dept-{dept.pk}'
            fkey = f'floor-{room.floor.pk}'
            rkey = f'room-{room.pk}'

            if dkey not in result:
                result[dkey] = {'id': dkey, 'name': dept.name, 'floors': {}}
            if fkey not in result[dkey]['floors']:
                result[dkey]['floors'][fkey] = {'id': fkey, 'number': room.floor.number, 'rooms': {}}
            if rkey not in result[dkey]['floors'][fkey]['rooms']:
                result[dkey]['floors'][fkey]['rooms'][rkey] = {'id': rkey, 'name': room.name, 'capacity': room.capacity, 'sessions': []}

            assign = entry.assignment
            session = {
                'id': f'entry-{entry.pk}',
                'subjectCode': assign.course.course_id,
                'subjectName': assign.course.name,
                'batchId': assign.batch.name,
                'facultyId': f'faculty-{assign.teacher.pk}',
                'roomId': rkey,
                'startTime': entry.start_time.strftime('%H:%M'),
                'durationMinutes': entry.duration_minutes,
                'isLocked': entry.is_locked,
            }
            result[dkey]['floors'][fkey]['rooms'][rkey]['sessions'].append(session)

        return Response(result)


class TimetableMoveView(APIView):
    permission_classes = [IsAuthenticated]
    def patch(self, request, entry_id):
        try:
            pk = int(entry_id.split('-', 1)[1]) if isinstance(entry_id, str) and entry_id.startswith('entry-') else int(entry_id)
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
                room_pk = int(room_id.split('-', 1)[1]) if isinstance(room_id, str) and room_id.startswith('room-') else int(room_id)
                entry.room = models.Room.objects.get(pk=room_pk)
            except Exception:
                return Response({'error': 'invalid room id'}, status=status.HTTP_400_BAD_REQUEST)

        entry.save()
        assign = entry.assignment
        resp = {
            'id': f'entry-{entry.pk}',
            'subjectCode': assign.course.course_id,
            'subjectName': assign.course.name,
            'batchId': assign.batch.name,
            'facultyId': f'faculty-{assign.teacher.pk}',
            'roomId': f'room-{entry.room.pk}' if entry.room else None,
            'startTime': entry.start_time.strftime('%H:%M'),
            'durationMinutes': entry.duration_minutes,
            'isLocked': entry.is_locked,
        }
        return Response(resp)


class TimetableGenerateView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        constraints = request.data.get('constraints')
        try:
            from .tasks import generate_timetable
            task = generate_timetable.delay(constraints)
            return Response({'task_id': task.id}, status=status.HTTP_202_ACCEPTED)
        except Exception:
            try:
                from solver.solver import solve_timetable
                ok = solve_timetable(constraints=constraints)
                return Response({'status': 'completed' if ok else 'failed'})
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AnalyticsSummaryView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        try:
            rooms_count = models.Room.objects.count() or 0
            entries_qs = models.ScheduleEntry.objects.select_related('assignment__teacher', 'assignment__batch', 'room').all()
            total_sessions = entries_qs.count()
            total_minutes = entries_qs.aggregate(total=Sum('duration_minutes'))['total'] or 0

            day_minutes = 10 * 60
            room_utilization = round((total_minutes / (rooms_count * day_minutes) * 100), 1) if rooms_count else 0.0

            conflicts_count = 0
            faculty_conflict_set = set()
            entries_list = list(entries_qs)
            by_faculty = {}
            for s in entries_list:
                fac = s.assignment.teacher.pk if s.assignment and s.assignment.teacher else None
                if fac is None: continue
                by_faculty.setdefault(fac, []).append(s)

            for fac_pk, sess in by_faculty.items():
                days = {}
                for e in sess: days.setdefault(e.day_of_week, []).append(e)
                for day, day_sess in days.items():
                    day_sess.sort(key=lambda x: x.start_time)
                    prev_end = None
                    for ds in day_sess:
                        start_m = ds.start_time.hour * 60 + ds.start_time.minute
                        end_m = start_m + (ds.duration_minutes or 0)
                        if prev_end is not None and start_m < prev_end:
                            conflicts_count += 1
                            faculty_conflict_set.add(fac_pk)
                        prev_end = max(prev_end or 0, end_m)

            system_efficiency = round((1 - (conflicts_count / total_sessions)) * 100, 1) if total_sessions else 100.0
            total_faculty = models.Faculty.objects.count() or 1
            faculty_satisfaction = round(max(0.0, 100 - (len(faculty_conflict_set) / total_faculty * 100)), 1)

            from collections import defaultdict
            batch_map = defaultdict(list)
            for s in entries_list:
                bid = s.assignment.batch.pk if s.assignment and s.assignment.batch else None
                if bid: batch_map[bid].append(s)

            conts = []
            for bid, sess in batch_map.items():
                starts = []
                total = 0
                for ss in sess:
                    st = ss.start_time.hour * 60 + ss.start_time.minute
                    en = st + (ss.duration_minutes or 0)
                    starts.append((st, en))
                    total += ss.duration_minutes or 0
                if not starts: continue
                min_start = min(s[0] for s in starts)
                max_end = max(s[1] for s in starts)
                span = max_end - min_start
                cont = (total / span * 100) if span > 0 else 100.0
                conts.append(cont)

            batch_continuity = round(sum(conts) / len(conts), 1) if conts else 100.0

            return Response({
                'systemEfficiency': system_efficiency,
                'roomUtilization': room_utilization,
                'facultySatisfaction': faculty_satisfaction,
                'batchContinuity': batch_continuity,
                'totalSessions': total_sessions,
                'totalMinutes': total_minutes,
                'lastOptimized': None,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BulkImportView(APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        try:
            created_entries = 0
            errors = []
            rows = []
            if 'file' in request.FILES:
                f = request.FILES['file']
                data = f.read().decode('utf-8')
                reader = csv.DictReader(io.StringIO(data))
                for r in reader: rows.append({k.strip(): v.strip() for k, v in r.items()})
            elif request.data.get('rows'):
                rows = request.data.get('rows')
            else:
                return Response({'error': 'no file or rows provided'}, status=status.HTTP_400_BAD_REQUEST)

            for i, row in enumerate(rows):
                try:
                    row_norm = {k.lower().strip(): v for k, v in row.items()}
                    faculty_name = row_norm.get('facultyname') or row_norm.get('faculty')
                    course_id = row_norm.get('courseid') or row_norm.get('subjectcode')
                    batch_name = row_norm.get('batchname') or row_norm.get('batchid')
                    day = row_norm.get('day') or 'Mon'
                    start_time = row_norm.get('starttime')
                    duration = int(row_norm.get('duration') or 60)
                    room_name = row_norm.get('roomname') or row_norm.get('roomid')

                    if not course_id or not batch_name or not start_time:
                        errors.append({'row': i + 1, 'error': 'missing course, batch, or start_time'})
                        continue

                    course = models.Course.objects.filter(course_id__iexact=course_id).first()
                    batch = models.Batch.objects.filter(name__iexact=batch_name).first()
                    teacher = models.Faculty.objects.filter(name__iexact=faculty_name).first()

                    if not course or not batch or not teacher:
                        errors.append({'row': i + 1, 'error': 'could not resolve course, batch, or teacher'})
                        continue

                    assignment, _ = models.CourseAssignment.objects.get_or_create(
                        course=course, batch=batch, teacher=teacher, defaults={'weekly_hours': 3}
                    )

                    room = models.Room.objects.filter(name__iexact=room_name).first()
                    st = datetime.strptime(start_time.strip(), '%H:%M').time()
                    models.ScheduleEntry.objects.create(
                        assignment=assignment, room=room, day_of_week=day, start_time=st, duration_minutes=duration
                    )
                    created_entries += 1
                except Exception as e:
                    errors.append({'row': i + 1, 'error': str(e)})

            return Response({'created_entries': created_entries, 'errors': errors})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TimetableConstraintsView(APIView):
    permission_classes = [IsAdminUser]
    def get(self, request):
        latest = models.TimetableConstraint.objects.first()
        if not latest:
            data = {'break_start': '13:00', 'break_end': '13:40', 'max_daily_classes': 6, 'gap_penalty': 1.0}
        else:
            data = serializers.TimetableConstraintSerializer(latest).data
        return Response(data)

    def post(self, request):
        ser = serializers.TimetableConstraintSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = ser.save(created_by=request.user)
        return Response(serializers.TimetableConstraintSerializer(obj).data, status=status.HTTP_201_CREATED)

class SystemConfigurationView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminUser()]

    def get(self, request):
        config, created = models.SystemConfiguration.objects.get_or_create(id=1)
        return Response(serializers.SystemConfigurationSerializer(config).data)

    def post(self, request):
        config, created = models.SystemConfiguration.objects.get_or_create(id=1)
        ser = serializers.SystemConfigurationSerializer(config, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        obj = ser.save(updated_by=request.user)
        return Response(serializers.SystemConfigurationSerializer(obj).data)
