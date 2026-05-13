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


class FacultyViewSet(viewsets.ModelViewSet):
    queryset = models.Faculty.objects.all()
    serializer_class = serializers.FacultySerializer


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allow users to authenticate using either username or email in the same field.

    If the provided identifier looks like an email and a user with that email exists,
    we replace the username field with the actual username before validation.
    """
    def validate(self, attrs):
        username_field = self.username_field
        identifier = (attrs.get(username_field, '') or '').strip()
        if identifier and '@' in identifier:
            User = get_user_model()
            # Use filter + first() to avoid MultipleObjectsReturned
            user = User.objects.filter(email__iexact=identifier).order_by('pk').first()
            if user:
                # Replace the identifier with the user's username for authentication
                attrs[username_field] = getattr(user, username_field)
        return super().validate(attrs)


class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenObtainPairSerializer


class BuildingViewSet(viewsets.ModelViewSet):
    queryset = models.Building.objects.all()
    serializer_class = serializers.BuildingSerializer


class RoomViewSet(viewsets.ModelViewSet):
    queryset = models.Room.objects.all()
    serializer_class = serializers.RoomSerializer


class DepartmentViewSet(viewsets.ModelViewSet):
    """CRUD for persisted departments. GET is public; writes require admin."""
    queryset = models.Department.objects.all().order_by('name')
    serializer_class = serializers.DepartmentSerializer

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]
        return [IsAdminUser()]


class RoomTypeViewSet(viewsets.ModelViewSet):
    """CRUD for persisted room types. GET is public; writes require admin."""
    queryset = models.RoomType.objects.all().order_by('name')
    serializer_class = serializers.RoomTypeSerializer

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]
        return [IsAdminUser()]


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
        # Accept optional constraints payload in the request body. If provided
        # it will be forwarded to the task; otherwise the task/solver may read
        # the latest persisted constraints from the database.
        constraints = request.data.get('constraints')
        try:
            from .tasks import generate_timetable
            # pass constraints as a JSON-serializable dict to the Celery task
            task = generate_timetable.delay(constraints)
            return Response({'task_id': task.id}, status=status.HTTP_202_ACCEPTED)
        except Exception:
            # fallback to synchronous run (use constraints if provided)
            try:
                from solver.solver import solve_timetable
                ok = solve_timetable(constraints=constraints)
                return Response({'status': 'completed' if ok else 'failed'})
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DepartmentsListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Prefer persisted Department rows when available, fallback to choices
        try:
            qs = models.Department.objects.all()
            if qs.exists():
                out = [{'id': d.pk, 'code': d.code, 'name': d.name} for d in qs]
                return Response(out)
        except Exception:
            pass

        try:
            data = [{'code': code, 'label': label} for code, label in models.DepartmentChoices.choices]
        except Exception:
            data = []
        return Response(data)

    def post(self, request):
        # Allow admins to create persistent departments
        if not request.user or not request.user.is_staff:
            return Response({'error': 'admin required'}, status=status.HTTP_403_FORBIDDEN)
        code = request.data.get('code')
        name = request.data.get('name')
        if not code or not name:
            return Response({'error': 'code and name required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            obj, created = models.Department.objects.get_or_create(code=code, defaults={'name': name})
            return Response({'id': obj.pk, 'code': obj.code, 'name': obj.name}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


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


class TimetableConstraintsView(APIView):
    """Simple admin-only endpoint to persist and read runtime solver constraints.

    GET returns the latest saved constraint set (or defaults). POST creates
    a new constraint record (admin only).
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        try:
            latest = models.TimetableConstraint.objects.first()
            if not latest:
                # return sensible defaults
                data = {
                    'break_start': '13:00',
                    'break_end': '13:40',
                    'max_daily_classes': 6,
                    'gap_penalty': 1.0,
                }
            else:
                data = serializers.TimetableConstraintSerializer(latest).data
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        try:
            ser = serializers.TimetableConstraintSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            obj = ser.save(created_by=request.user)
            return Response(serializers.TimetableConstraintSerializer(obj).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AnalyticsSummaryView(APIView):
    """Provide a lightweight summary used by the Dashboard UI."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            rooms_count = models.Room.objects.count() or 0
            entries_qs = models.ScheduleEntry.objects.select_related('course_load__faculty', 'room').all()
            total_sessions = entries_qs.count()
            total_minutes = entries_qs.aggregate(total=Sum('duration_minutes'))['total'] or 0

            # Room utilization (assume 8:00-18:00 working window = 600 minutes)
            day_minutes = 10 * 60
            room_utilization = round((total_minutes / (rooms_count * day_minutes) * 100), 1) if rooms_count else 0.0

            # Detect simple faculty conflicts (overlapping sessions)
            conflicts_count = 0
            faculty_conflict_set = set()
            entries_list = list(entries_qs)
            by_faculty = {}
            for s in entries_list:
                fac = s.course_load.faculty.pk if s.course_load and s.course_load.faculty else None
                if fac is None:
                    continue
                by_faculty.setdefault(fac, []).append(s)

            for fac_pk, sess in by_faculty.items():
                days = {}
                for e in sess:
                    days.setdefault(e.day_of_week, []).append(e)
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

            # Batch continuity: average of (total_class_minutes / span) across batches
            from collections import defaultdict
            batch_map = defaultdict(list)
            for s in entries_list:
                bid = s.course_load.batch_id if s.course_load else None
                if bid:
                    batch_map[bid].append(s)

            conts = []
            for bid, sess in batch_map.items():
                starts = []
                total = 0
                for ss in sess:
                    st = ss.start_time.hour * 60 + ss.start_time.minute
                    en = st + (ss.duration_minutes or 0)
                    starts.append((st, en))
                    total += ss.duration_minutes or 0
                if not starts:
                    continue
                min_start = min(s[0] for s in starts)
                max_end = max(s[1] for s in starts)
                span = max_end - min_start
                cont = (total / span * 100) if span > 0 else 100.0
                conts.append(cont)

            batch_continuity = round(sum(conts) / len(conts), 1) if conts else 100.0

            data = {
                'systemEfficiency': system_efficiency,
                'roomUtilization': room_utilization,
                'facultySatisfaction': faculty_satisfaction,
                'batchContinuity': batch_continuity,
                'totalSessions': total_sessions,
                'totalMinutes': total_minutes,
                'lastOptimized': None,
            }
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AnalyticsLoadDistributionView(APIView):
    """Return session counts per department across hourly timeslots for the dashboard chart."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Define hourly slots from 08:00 to 17:00 (10 slots)
            slots = list(range(8, 18))
            times = [f"{h:02d}:00" for h in slots]

            # Gather departments from Faculty rows (fallback to DepartmentChoices)
            facs = models.Faculty.objects.all()
            dept_set = set()
            fac_dept_map = {}
            for f in facs:
                code = getattr(f, 'department', None) or 'UNK'
                dept_set.add(code)
                fac_dept_map[f.pk] = code

            if not dept_set:
                # fallback to declared choices
                try:
                    dept_set = {c[0] for c in models.DepartmentChoices.choices}
                except Exception:
                    dept_set = {'CS'}

            departments = sorted(list(dept_set))

            # Initialize counts
            series = {d: [0] * len(slots) for d in departments}

            entries = models.ScheduleEntry.objects.select_related('course_load__faculty').all()
            for e in entries:
                cl = getattr(e, 'course_load', None)
                if not cl or not cl.faculty:
                    continue
                dept = fac_dept_map.get(cl.faculty.pk) or getattr(cl.faculty, 'department', 'UNK')
                hour = e.start_time.hour
                if hour in slots and dept in series:
                    idx = slots.index(hour)
                    series[dept][idx] += 1

            out_series = [{'department': d, 'values': series[d]} for d in departments]
            return Response({'times': times, 'series': out_series})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AnalyticsFeedView(APIView):
    """Combined feed for recent analytics logs and constraint changes used by the live feed panel."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Use existing log generation for scheduling conflicts
            entries_qs = models.ScheduleEntry.objects.select_related('course_load__faculty', 'room').all()
            entries_list = list(entries_qs)
            logs = []

            # Simple faculty conflict messages (reuse logic from AnalyticsLogsView)
            by_fac = {}
            for e in entries_list:
                fac = e.course_load.faculty if e.course_load and e.course_load.faculty else None
                if fac:
                    by_fac.setdefault(fac.pk, []).append(e)
            for fac_pk, sess in by_fac.items():
                for day in set([s.day_of_week for s in sess]):
                    day_sess = [s for s in sess if s.day_of_week == day]
                    day_sess.sort(key=lambda x: x.start_time)
                    prev_end = None
                    for s in day_sess:
                        st = s.start_time.hour * 60 + s.start_time.minute
                        en = st + (s.duration_minutes or 0)
                        if prev_end is not None and st < prev_end:
                            fac = s.course_load.faculty
                            logs.append({'time': s.start_time.strftime('%H:%M'), 'msg': f'Teacher Conflict: {fac.name} in overlapping sessions', 'type': 'error'})
                        prev_end = max(prev_end or 0, en)

            # Recent constraint changes
            constraints = list(models.TimetableConstraint.objects.order_by('-created_at')[:10])
            for c in constraints:
                ts = c.created_at.strftime('%H:%M') if c.created_at else ''
                logs.append({'time': ts, 'msg': f'Constraint updated (gap_penalty={c.gap_penalty})', 'type': 'info'})

            # Sort by time descending-like (best effort by string time)
            logs_sorted = sorted(logs, key=lambda x: x.get('time', ''), reverse=True)
            return Response({'feed': logs_sorted[:50]})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AnalyticsLogsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Build a lightweight conflict log for the dashboard
        try:
            entries_qs = models.ScheduleEntry.objects.select_related('course_load__faculty', 'room').all()
            entries_list = list(entries_qs)
            logs = []

            # Room overlaps
            rooms = models.Room.objects.all()
            for room in rooms:
                room_entries = [e for e in entries_list if e.room and e.room.pk == room.pk]
                by_day = {}
                for e in room_entries:
                    by_day.setdefault(e.day_of_week, []).append(e)
                for day, day_list in by_day.items():
                    day_list.sort(key=lambda x: x.start_time)
                    prev_end = None
                    for e in day_list:
                        start_m = e.start_time.hour * 60 + e.start_time.minute
                        end_m = start_m + (e.duration_minutes or 0)
                        if prev_end is not None and start_m < prev_end:
                            logs.append({'time': e.start_time.strftime('%H:%M'), 'msg': f'Room overlap in {room.name}', 'type': 'error'})
                        prev_end = max(prev_end or 0, end_m)

            # Faculty conflicts
            by_fac = {}
            for e in entries_list:
                fac = e.course_load.faculty if e.course_load and e.course_load.faculty else None
                if fac:
                    by_fac.setdefault(fac.pk, []).append(e)
            for fac_pk, sess in by_fac.items():
                for day in set([s.day_of_week for s in sess]):
                    day_sess = [s for s in sess if s.day_of_week == day]
                    day_sess.sort(key=lambda x: x.start_time)
                    prev_end = None
                    for s in day_sess:
                        st = s.start_time.hour * 60 + s.start_time.minute
                        en = st + (s.duration_minutes or 0)
                        if prev_end is not None and st < prev_end:
                            fac = s.course_load.faculty
                            logs.append({'time': s.start_time.strftime('%H:%M'), 'msg': f'Faculty Conflict: {fac.name} has overlapping sessions', 'type': 'error'})
                        prev_end = max(prev_end or 0, en)

            # Trim and return latest 50 logs
            return Response({'logs': logs[:50]})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RoomTypesListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Prefer persisted room types, fallback to Room.ROOM_TYPES
        try:
            qs = models.RoomType.objects.all()
            if qs.exists():
                out = [{'id': r.pk, 'code': r.code, 'name': r.name} for r in qs]
                return Response(out)
        except Exception:
            pass

        try:
            data = [{'code': code, 'label': label} for code, label in models.Room.ROOM_TYPES]
        except Exception:
            data = []
        return Response(data)

    def post(self, request):
        if not request.user or not request.user.is_staff:
            return Response({'error': 'admin required'}, status=status.HTTP_403_FORBIDDEN)
        code = request.data.get('code')
        name = request.data.get('name')
        if not code or not name:
            return Response({'error': 'code and name required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            obj, created = models.RoomType.objects.get_or_create(code=code, defaults={'name': name})
            return Response({'id': obj.pk, 'code': obj.code, 'name': obj.name}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TeacherScheduleView(APIView):
    """Return the schedule for the requesting teacher (or a specified faculty pk for admins)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            faculty = None
            # Admins can pass ?faculty_pk=123 to inspect another faculty
            if request.user.is_staff or request.user.is_superuser:
                fp = request.query_params.get('faculty_pk')
                if fp:
                    try:
                        faculty = models.Faculty.objects.get(pk=int(fp))
                    except Exception:
                        faculty = None

            if not faculty:
                faculty = models.Faculty.objects.filter(user=request.user).first()
            if not faculty:
                return Response({'error': 'no faculty profile found for user'}, status=status.HTTP_404_NOT_FOUND)

            entries = models.ScheduleEntry.objects.filter(course_load__faculty=faculty).select_related('course_load', 'room').order_by('day_of_week', 'start_time')
            out = []
            for e in entries:
                out.append({
                    'id': f'entry-{e.pk}',
                    'subjectCode': e.course_load.subject_code if e.course_load else None,
                    'subjectName': e.course_load.subject_name if e.course_load else None,
                    'batchId': e.course_load.batch_id if e.course_load else None,
                    'roomId': f'room-{e.room.pk}' if e.room else None,
                    'day': e.day_of_week,
                    'startTime': e.start_time.strftime('%H:%M'),
                    'durationMinutes': e.duration_minutes,
                    'isLocked': e.is_locked,
                })
            return Response({'faculty': {'id': f'faculty-{faculty.pk}', 'name': faculty.name}, 'entries': out})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BulkImportView(APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        """Accept CSV uploads or JSON arrays to create CourseLoads and ScheduleEntry rows.

        Expected columns (case-insensitive): facultyName, subjectCode, batchId, day, startTime, duration, roomId
        """
        try:
            created_courses = 0
            created_entries = 0
            errors = []

            rows = []
            if 'file' in request.FILES:
                f = request.FILES['file']
                data = f.read().decode('utf-8')
                reader = csv.DictReader(io.StringIO(data))
                for r in reader:
                    rows.append({k.strip(): v.strip() for k, v in r.items()})
            elif request.data.get('rows'):
                rows = request.data.get('rows')
            else:
                return Response({'error': 'no file or rows provided'}, status=status.HTTP_400_BAD_REQUEST)

            for i, row in enumerate(rows):
                try:
                    # normalize keys
                    row_norm = {k.lower().strip(): v for k, v in row.items()}
                    faculty_name = row_norm.get('facultyname') or row_norm.get('faculty') or row_norm.get('faculty name')
                    subject_code = row_norm.get('subjectcode') or row_norm.get('course id') or row_norm.get('subject')
                    batch_id = row_norm.get('batchid') or row_norm.get('section') or row_norm.get('batch')
                    day = row_norm.get('day') or 'Mon'
                    start_time = row_norm.get('starttime') or row_norm.get('starting time')
                    duration = int(row_norm.get('duration') or row_norm.get('durationminutes') or 60)
                    roomid = row_norm.get('roomid') or row_norm.get('location') or row_norm.get('room')

                    if not subject_code or not batch_id or not start_time:
                        errors.append({'row': i + 1, 'error': 'missing required fields'})
                        continue

                    # resolve or create faculty
                    faculty = None
                    if faculty_name:
                        faculty = models.Faculty.objects.filter(name__iexact=faculty_name).first()
                    if not faculty:
                        # create placeholder faculty
                        email = f"imported_{uuid.uuid4().hex[:8]}@example.invalid"
                        faculty = models.Faculty.objects.create(name=faculty_name or f'Imported {uuid.uuid4().hex[:6]}', department=models.Department.CS, email=email)
                        created_courses += 0

                    # resolve or create courseload
                    cl = models.CourseLoad.objects.filter(subject_code__iexact=subject_code, batch_id__iexact=batch_id, faculty=faculty).first()
                    if not cl:
                        cl = models.CourseLoad.objects.create(subject_code=subject_code, subject_name=subject_code, batch_id=batch_id, faculty=faculty, weekly_hours=3)
                        created_courses += 1

                    # resolve room
                    room_obj = None
                    if roomid:
                        m = re.match(r'room-(\d+)', roomid)
                        if m:
                            room_obj = models.Room.objects.filter(pk=int(m.group(1))).first()
                        elif roomid.isdigit():
                            room_obj = models.Room.objects.filter(pk=int(roomid)).first()
                        else:
                            room_obj = models.Room.objects.filter(name__iexact=roomid).first()

                    # parse day
                    ds = day.strip().lower()[:3]
                    day_map = {'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu', 'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun'}
                    dow = day_map.get(ds, 'Mon')

                    # parse start_time
                    try:
                        st = datetime.strptime(start_time.strip(), '%H:%M').time()
                    except Exception:
                        errors.append({'row': i + 1, 'error': 'invalid start_time'})
                        continue

                    entry = models.ScheduleEntry.objects.create(course_load=cl, room=room_obj, day_of_week=dow, start_time=st, duration_minutes=duration, is_locked=False)
                    created_entries += 1
                except Exception as e:
                    errors.append({'row': i + 1, 'error': str(e)})

            return Response({'created_course_loads': created_courses, 'created_entries': created_entries, 'errors': errors})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BatchDiagnosticView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            entries = list(models.ScheduleEntry.objects.filter(course_load__batch_id__iexact=batch_id).select_related('course_load'))
            if not entries:
                return Response({'batch': batch_id, 'sessions': 0, 'total_minutes': 0, 'gaps': [], 'continuity': 100.0})

            # compute total minutes and gaps per day
            from collections import defaultdict
            by_day = defaultdict(list)
            total_minutes = 0
            for e in entries:
                total_minutes += e.duration_minutes or 0
                by_day[e.day_of_week].append(e)

            gaps = []
            for day, sess in by_day.items():
                sess.sort(key=lambda x: x.start_time)
                for i in range(len(sess) - 1):
                    s1 = sess[i]
                    s2 = sess[i + 1]
                    end1 = s1.start_time.hour * 60 + s1.start_time.minute + (s1.duration_minutes or 0)
                    start2 = s2.start_time.hour * 60 + s2.start_time.minute
                    gap = start2 - end1
                    if gap > 0:
                        gaps.append({'day': day, 'start': end1, 'end': start2, 'gapMinutes': gap})

            # continuity: total_minutes / (span across earliest start to latest end) averaged across days
            conts = []
            for day, sess in by_day.items():
                starts = [s.start_time.hour * 60 + s.start_time.minute for s in sess]
                ends = [s.start_time.hour * 60 + s.start_time.minute + (s.duration_minutes or 0) for s in sess]
                span = max(ends) - min(starts) if starts and ends else 0
                cont = (sum(s.duration_minutes or 0 for s in sess) / span * 100) if span > 0 else 100.0
                conts.append(cont)

            continuity = round(sum(conts) / len(conts), 1) if conts else 100.0

            return Response({'batch': batch_id, 'sessions': len(entries), 'total_minutes': total_minutes, 'gaps': gaps, 'continuity': continuity})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
