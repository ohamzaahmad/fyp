import csv
import io
import uuid
import re
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import Table, TableStyle
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from datetime import datetime, time as dt_time
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum
from django.conf import settings
from django.core.exceptions import PermissionDenied

from . import models, serializers
from .permissions import IsTeacherUser, IsAdminUser, IsTeacherOrAdmin
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
    
    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]
        return [IsAdminUser()]
    
    def retrieve(self, request, *args, **kwargs):
        """Support retrieving batches by numeric PK or by name (case-insensitive).

        The frontend currently passes batch names (e.g. `newbatch`) to `/batches/{id}/`.
        By default DRF looks up by PK and will return 404 for a non-numeric value.
        This method first tries to interpret the lookup as an integer PK and falls
        back to a case-insensitive name lookup.
        """
        lookup_value = kwargs.get('pk')
        if lookup_value is None:
            return super().retrieve(request, *args, **kwargs)
        # Try numeric PK first
        instance = None
        try:
            pk = int(lookup_value)
            instance = self.get_queryset().get(pk=pk)
        except Exception:
            # Fallback to name lookup (case-insensitive)
            instance = self.get_queryset().filter(name__iexact=lookup_value).first()
            if instance is None:
                return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class BatchDiagnosticView(APIView):
    permission_classes = [AllowAny]

    def get_batch(self, batch_value):
        try:
            return models.Batch.objects.get(pk=int(batch_value))
        except Exception:
            return get_object_or_404(models.Batch, name__iexact=str(batch_value))

    def get(self, request, batch_id, *args, **kwargs):
        batch = self.get_batch(batch_id)
        entries = (
            models.ScheduleEntry.objects
            .select_related('assignment__course', 'assignment__teacher', 'room')
            .filter(assignment__batch=batch)
            .order_by('day_of_week', 'start_time')
        )

        total_sessions = entries.count()
        total_minutes = sum((e.duration_minutes or 0) for e in entries)

        gaps = []
        day_continuities = []
        for day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']:
            day_entries = [e for e in entries if e.day_of_week == day]
            if not day_entries:
                continue
            day_entries.sort(key=lambda e: e.start_time)

            day_total = 0
            day_windows = []
            prev_end = None
            for entry in day_entries:
                start_m = entry.start_time.hour * 60 + entry.start_time.minute
                end_m = start_m + (entry.duration_minutes or 0)
                day_total += entry.duration_minutes or 0
                day_windows.append((start_m, end_m))
                if prev_end is not None and start_m > prev_end:
                    gap_minutes = start_m - prev_end
                    gaps.append({
                        'day': day,
                        'start': prev_end,
                        'end': start_m,
                        'gapMinutes': gap_minutes,
                    })
                prev_end = max(prev_end or 0, end_m)

            if day_windows:
                min_start = min(s for s, _ in day_windows)
                max_end = max(e for _, e in day_windows)
                span = max_end - min_start
                if span > 0:
                    day_continuities.append(round((day_total / span) * 100, 1))

        continuity = round(sum(day_continuities) / len(day_continuities), 1) if day_continuities else 100.0

        return Response({
            'id': batch.pk,
            'name': batch.name,
            'semester': batch.semester,
            'shift': batch.shift,
            'department': batch.department_id,
            'courses': list(batch.courses.values_list('id', flat=True)),
            'continuity': continuity,
            'sessions': total_sessions,
            'total_minutes': total_minutes,
            'gaps': gaps,
        })


class BatchTimetableExportView(APIView):
    permission_classes = [AllowAny]

    def get_batch(self, batch_value):
        try:
            return models.Batch.objects.get(pk=int(batch_value))
        except Exception:
            return get_object_or_404(models.Batch, name__iexact=str(batch_value))

    def _format_time(self, value):
        if not value:
            return ''
        if hasattr(value, 'hour') and hasattr(value, 'minute'):
            return f'{value.hour}:{value.minute:02d}'
        return str(value)

    def _build_pdf(self, batch):
        from reportlab.pdfgen import canvas

        buffer = io.BytesIO()
        page_width, page_height = landscape(A4)
        pdf = canvas.Canvas(buffer, pagesize=landscape(A4))

        sessions = (
            models.ScheduleEntry.objects
            .select_related('assignment__course', 'assignment__teacher', 'room')
            .filter(assignment__batch=batch)
            .order_by('day_of_week', 'start_time')
        )

        grouped = {day: [] for day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
        for entry in sessions:
            grouped.setdefault(entry.day_of_week, []).append(entry)

        display_days = [day for day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] if grouped.get(day)]

        def day_label(day_code):
            return {
                'Mon': 'Monday',
                'Tue': 'Tuesday',
                'Wed': 'Wednesday',
                'Thu': 'Thursday',
                'Fri': 'Friday',
                'Sat': 'Saturday',
                'Sun': 'Sunday',
            }.get(day_code, day_code)

        def session_time(entry):
            start = self._format_time(entry.start_time)
            end_hour = entry.start_time.hour + ((entry.start_time.minute + entry.duration_minutes) // 60)
            end_minute = (entry.start_time.minute + entry.duration_minutes) % 60
            end = f'{end_hour}:{end_minute:02d}'
            return f'{start} - {end}'

        rows = []
        rows.append(['Time Table', '', '', ''])
        rows.append([f'Batch: {batch.name} | Semester {batch.semester} | Shift {batch.shift} | Department {batch.department.name}', '', '', ''])

        for day in display_days:
            rows.append([day_label(day), '', '', ''])
            rows.append(['TIME', 'SUBJECT', 'PLACE', 'TEACHERS'])
            for entry in grouped.get(day, []):
                course = entry.assignment.course if entry.assignment else None
                teacher = entry.assignment.teacher if entry.assignment else None
                rows.append([
                    session_time(entry),
                    getattr(course, 'course_id', '') or getattr(course, 'name', ''),
                    getattr(entry.room, 'name', '') if entry.room else '',
                    getattr(teacher, 'name', '') if teacher else '',
                ])

        table = Table(rows, colWidths=[page_width * 0.18, page_width * 0.34, page_width * 0.24, page_width * 0.24], repeatRows=0)

        style = TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('SPAN', (0, 1), (-1, 1)),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F81BD')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#D9E2F3')),
            ('TEXTCOLOR', (0, 1), (-1, 1), colors.HexColor('#1F2937')),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#D9E2F3')),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
            ('GRID', (0, 1), (-1, -1), 0.4, colors.HexColor('#AAB7C4')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
        ])

        row_index = 2
        for day in display_days:
            style.add('SPAN', (0, row_index), (-1, row_index))
            style.add('BACKGROUND', (0, row_index), (-1, row_index), colors.HexColor('#2F75B5'))
            style.add('TEXTCOLOR', (0, row_index), (-1, row_index), colors.white)
            style.add('FONTNAME', (0, row_index), (-1, row_index), 'Helvetica-Bold')
            row_index += 1
            style.add('BACKGROUND', (0, row_index), (-1, row_index), colors.HexColor('#EAF1FB'))
            row_index += 1 + len(grouped.get(day, []))

        table.setStyle(style)

        available_width = page_width - 36
        available_height = page_height - 72
        font_size = 8
        while font_size >= 5:
            table.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), font_size), ('LEADING', (0, 0), (-1, -1), font_size + 1)]))
            width, height = table.wrap(available_width, available_height)
            if height <= available_height:
                break
            font_size -= 1

        pdf.setTitle(f'{batch.name} Timetable')
        pdf.setAuthor('NexusTime')
        pdf.drawString(18, page_height - 18, '')

        width, height = table.wrap(available_width, available_height)
        x = 18
        y = page_height - 28 - height
        table.drawOn(pdf, x, max(18, y))
        pdf.showPage()
        pdf.save()
        buffer.seek(0)
        return buffer.getvalue()

    def get(self, request, batch_id, *args, **kwargs):
        batch = self.get_batch(batch_id)
        pdf_bytes = self._build_pdf(batch)
        filename = f'{batch.name}-timetable.pdf'
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class FacultyViewSet(viewsets.ModelViewSet):
    queryset = models.Faculty.objects.all().order_by('name')
    serializer_class = serializers.FacultySerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        data = self.get_serializer(instance).data

        entries_qs = (
            models.ScheduleEntry.objects
            .select_related('assignment__course', 'assignment__batch', 'room')
            .filter(assignment__teacher=instance)
            .order_by('day_of_week', 'start_time')
        )

        entries = []
        for entry in entries_qs:
            assign = entry.assignment
            course = getattr(assign, 'course', None)
            batch = getattr(assign, 'batch', None)
            room = getattr(entry, 'room', None)
            entries.append({
                'id': f'entry-{entry.pk}',
                'day_of_week': entry.day_of_week,
                'startTime': entry.start_time.strftime('%H:%M') if entry.start_time else None,
                'durationMinutes': entry.duration_minutes,
                'subjectCode': getattr(course, 'course_id', '') if course else '',
                'subjectName': getattr(course, 'name', '') if course else '',
                'batchId': getattr(batch, 'name', '') if batch else '',
                'roomId': f'room-{room.pk}' if room else None,
                'roomName': getattr(room, 'name', '') if room else '',
                'facultyId': f'faculty-{instance.pk}',
                'teacherId': str(instance.pk),
            })

        data['entries'] = entries
        return Response(data)


class TeacherScheduleExportView(APIView):
    permission_classes = [IsTeacherOrAdmin]

    def _resolve_faculty(self, faculty_value):
        try:
            return models.Faculty.objects.get(pk=int(faculty_value))
        except Exception:
            return get_object_or_404(models.Faculty, name__iexact=str(faculty_value))

    def get(self, request, faculty_id, *args, **kwargs):
        faculty = self._resolve_faculty(faculty_id)
        user = request.user
        if not (user.is_staff or user.is_superuser):
            user_faculty = models.Faculty.objects.filter(user=user).first()
            if not user_faculty or user_faculty.pk != faculty.pk:
                return Response({'detail': 'Not permitted.'}, status=status.HTTP_403_FORBIDDEN)

        from reportlab.pdfgen import canvas

        buffer = io.BytesIO()
        page_width, page_height = landscape(A4)
        pdf = canvas.Canvas(buffer, pagesize=landscape(A4))

        entries = (
            models.ScheduleEntry.objects
            .select_related('assignment__course', 'assignment__batch', 'room')
            .filter(assignment__teacher=faculty)
            .order_by('day_of_week', 'start_time')
        )

        rows = [['Teacher Weekly Schedule', '', '', '', '']]
        rows.append([f'Teacher: {faculty.name} | Department: {faculty.department.name}', '', '', '', ''])
        rows.append(['DAY', 'TIME', 'COURSE', 'BATCH', 'ROOM'])

        for entry in entries:
            course = entry.assignment.course if entry.assignment else None
            batch = entry.assignment.batch if entry.assignment else None
            room = entry.room
            rows.append([
                entry.day_of_week,
                f'{entry.start_time.strftime("%H:%M")} - {((entry.start_time.hour * 60 + entry.start_time.minute + entry.duration_minutes) // 60):02d}:{((entry.start_time.hour * 60 + entry.start_time.minute + entry.duration_minutes) % 60):02d}',
                getattr(course, 'course_id', '') or getattr(course, 'name', ''),
                getattr(batch, 'name', ''),
                getattr(room, 'name', '') if room else '',
            ])

        table = Table(rows, colWidths=[page_width * 0.12, page_width * 0.20, page_width * 0.28, page_width * 0.22, page_width * 0.18], repeatRows=3)
        table.setStyle(TableStyle([
            ('SPAN', (0, 0), (-1, 0)),
            ('SPAN', (0, 1), (-1, 1)),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#E2E8F0')),
            ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#CBD5E1')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, 2), colors.HexColor('#0F172A')),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTNAME', (0, 0), (-1, 2), 'Helvetica-Bold'),
            ('GRID', (0, 2), (-1, -1), 0.4, colors.HexColor('#94A3B8')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
        ]))

        pdf.setTitle(f'{faculty.name} Weekly Schedule')
        width, height = table.wrap(page_width - 36, page_height - 72)
        table.drawOn(pdf, 18, max(18, page_height - 32 - height))
        pdf.showPage()
        pdf.save()
        buffer.seek(0)

        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{faculty.name}-week-schedule.pdf"'
        return response


class ScheduleAdjustmentRequestViewSet(viewsets.ModelViewSet):
    queryset = models.ScheduleAdjustmentRequest.objects.select_related('teacher', 'teacher__department', 'related_entry', 'related_entry__assignment__course', 'related_entry__assignment__batch', 'related_entry__room', 'reviewed_by')
    serializer_class = serializers.ScheduleAdjustmentRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS', 'POST'):
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        faculty = models.Faculty.objects.filter(user=user).first()
        return qs.filter(teacher=faculty) if faculty else qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        faculty = models.Faculty.objects.filter(user=user).first()
        if not faculty:
            raise PermissionDenied('Only teacher accounts can submit adjustment requests.')
        serializer.save(teacher=faculty)

    def perform_update(self, serializer):
        instance = serializer.save()
        if self.request.user.is_staff or self.request.user.is_superuser:
            instance.reviewed_by = self.request.user
            if instance.status in (models.ScheduleAdjustmentRequest.STATUS_APPROVED, models.ScheduleAdjustmentRequest.STATUS_REJECTED):
                instance.reviewed_at = timezone.now()
            instance.save(update_fields=['reviewed_by', 'reviewed_at', 'updated_at'])

    def perform_destroy(self, instance):
        instance.delete()


class CourseAssignmentViewSet(viewsets.ModelViewSet):
    queryset = models.CourseAssignment.objects.all()
    serializer_class = serializers.CourseAssignmentSerializer


class ScheduleEntryViewSet(viewsets.ModelViewSet):
    queryset = models.ScheduleEntry.objects.all()
    serializer_class = serializers.ScheduleEntrySerializer
    
    def perform_create(self, serializer):
        instance = serializer.save()
        try:
            from .sse import emit_analytics_event
            data = self.get_serializer(instance).data
            emit_analytics_event('entry_created', f"Entry created {data.get('id')}", data)
        except Exception:
            pass

    def perform_update(self, serializer):
        instance = serializer.save()
        try:
            from .sse import emit_analytics_event
            data = self.get_serializer(instance).data
            emit_analytics_event('entry_updated', f"Entry updated {data.get('id')}", data)
        except Exception:
            pass

    def perform_destroy(self, instance):
        try:
            from .sse import emit_analytics_event
            data = self.get_serializer(instance).data
            instance.delete()
            emit_analytics_event('entry_deleted', f"Entry deleted {data.get('id')}", data)
        except Exception:
            try:
                instance.delete()
            except Exception:
                pass


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
            try:
                from .sse import emit_analytics_event
                emit_analytics_event('solver_enqueued', f'Solver enqueued: {task.id}', {'task_id': task.id})
            except Exception:
                pass
            return Response({'task_id': task.id}, status=status.HTTP_202_ACCEPTED)
        except Exception:
            try:
                from solver.solver import solve_timetable
                ok = solve_timetable()
                try:
                    from .sse import emit_analytics_event
                    emit_analytics_event('solver_completed', 'Solver ran inline', {'success': ok})
                except Exception:
                    pass
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

            if rkey not in result[dkey]['floors'][fkey]['rooms']:
                result[dkey]['floors'][fkey]['rooms'][rkey] = {
                    'id': rkey,
                    'name': room.name,
                    'capacity': room.capacity,
                    'days': {d: [] for d in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']},
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
                result[dkey]['floors'][fkey]['rooms'][rkey] = {
                    'id': rkey, 
                    'name': room.name, 
                    'capacity': room.capacity, 
                    'days': {d: [] for d in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                }

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
                'day_of_week': entry.day_of_week,
                'isLocked': entry.is_locked,
                'isMerged': entry.is_merged,
            }
            result[dkey]['floors'][fkey]['rooms'][rkey]['days'][entry.day_of_week].append(session)

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
            'day_of_week': entry.day_of_week,
            'isLocked': entry.is_locked,
            'isMerged': entry.is_merged,
        }
        try:
            from .sse import emit_analytics_event
            emit_analytics_event('entry_moved', f"Entry moved {resp.get('id')}", resp)
        except Exception:
            pass
        return Response(resp)


class TimetableMergeView(APIView):
    permission_classes = [IsAuthenticated]
    def patch(self, request):
        entry_ids = request.data.get('entry_ids', [])
        if not entry_ids:
            return Response({'error': 'no entry ids provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        pks = []
        for eid in entry_ids:
            try:
                pk = int(eid.split('-', 1)[1]) if isinstance(eid, str) and eid.startswith('entry-') else int(eid)
                pks.append(pk)
            except Exception:
                continue
        
        if not pks:
            return Response({'error': 'no valid entry ids found'}, status=status.HTTP_400_BAD_REQUEST)
            
        models.ScheduleEntry.objects.filter(pk__in=pks).update(is_merged=True)
        return Response({'status': 'success', 'merged_count': len(pks)})


class TimetableGenerateView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        constraints = request.data.get('constraints')
        try:
            from .tasks import generate_timetable
            task = generate_timetable.delay(constraints)
            try:
                from .sse import emit_analytics_event
                emit_analytics_event('timetable_generate_enqueued', f'Timetable generate enqueued: {task.id}', {'task_id': task.id})
            except Exception:
                pass
            return Response({'task_id': task.id}, status=status.HTTP_202_ACCEPTED)
        except Exception:
            try:
                from solver.solver import solve_timetable
                ok = solve_timetable(constraints=constraints)
                try:
                    from .sse import emit_analytics_event
                    emit_analytics_event('timetable_generate_completed', 'Timetable generated inline', {'success': ok})
                except Exception:
                    pass
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

            # Build a load distribution measured in minutes of teaching per department per time-bucket
            bucket_minutes = int(getattr(settings, 'ANALYTICS_BUCKET_MINUTES', 60))
            day_start_hour = int(getattr(settings, 'ANALYTICS_DAY_START_HOUR', 8))
            day_end_hour = int(getattr(settings, 'ANALYTICS_DAY_END_HOUR', 18))
            slot_starts = list(range(day_start_hour * 60, (day_end_hour + 1) * 60, bucket_minutes))
            times = [f"{(m // 60):02d}:{(m % 60):02d}" for m in slot_starts]

            dept_objs = list(models.Department.objects.all())
            series = []
            dept_index_map = {}
            for di, d in enumerate(dept_objs):
                dept_index_map[d.pk] = di
                series.append({'department': d.name, 'values': [0 for _ in times]})

            for e in entries_list:
                try:
                    room = e.room
                    if not room or not room.floor or not room.floor.department:
                        continue
                    dept_pk = room.floor.department.pk
                    idx = dept_index_map.get(dept_pk)
                    if idx is None:
                        continue

                    session_start = (e.start_time.hour * 60 + e.start_time.minute) if e.start_time else 0
                    session_end = session_start + (e.duration_minutes or 0)

                    for si, slot_start in enumerate(slot_starts):
                        slot_end = slot_start + bucket_minutes
                        overlap = max(0, min(session_end, slot_end) - max(session_start, slot_start))
                        if overlap > 0:
                            series[idx]['values'][si] += overlap
                except Exception:
                    continue

            return Response({
                'systemEfficiency': system_efficiency,
                'roomUtilization': room_utilization,
                'facultySatisfaction': faculty_satisfaction,
                'batchContinuity': batch_continuity,
                'totalSessions': total_sessions,
                'totalMinutes': total_minutes,
                'lastOptimized': None,
                'load_distribution': {
                    'times': times,
                    'series': series,
                },
                'logs': [],
                'feed': [],
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


class LogoUploadView(APIView):
    """Accepts a multipart upload for the system logo and returns a public URL."""
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        logo = request.FILES.get('logo')
        if not logo:
            return Response({'error': 'no logo file provided'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from django.core.files.storage import default_storage
            from django.core.files.base import ContentFile
            import os

            save_path = os.path.join('logos', logo.name)
            path = default_storage.save(save_path, ContentFile(logo.read()))
            # Build an absolute URL so Django REST URLField validation accepts it
            rel_url = default_storage.url(path)
            abs_url = request.build_absolute_uri(rel_url)
            return Response({'logo_url': abs_url})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TimetableCompactView(APIView):
    """Persist a request to compact/compress a batch's schedule (audit log + SSE emit).

    This endpoint records the user's request and reports the number of affected entries.
    The actual compression algorithm is intentionally left out; an orchestrator or
    background worker could perform structural changes later.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        batch_ident = request.data.get('batchId') or request.data.get('batch') or request.data.get('batch_id')
        day = request.data.get('day') or None
        if not batch_ident:
            return Response({'error': 'batchId is required'}, status=status.HTTP_400_BAD_REQUEST)

        batch = None
        try:
            batch = models.Batch.objects.get(pk=int(batch_ident))
        except Exception:
            batch = models.Batch.objects.filter(name=batch_ident).first()

        if not batch:
            return Response({'error': 'batch not found'}, status=status.HTTP_404_NOT_FOUND)

        # Support three modes: preview (compute plan), queue (enqueue background task), apply (deprecated: apply inline)
        mode = (request.data.get('mode') or request.query_params.get('mode') or 'queue').lower()
        from .tasks import _compute_compact_plan, compact_schedule_task

        # Compute a proposal so we can report affected entries without performing heavy work inline
        plan = _compute_compact_plan(batch.pk, day)

        if mode == 'preview':
            return Response({'status': 'preview', **plan})

        # Queue background task (recommended)
        if mode in ('queue', 'queued', 'background'):
            try:
                task = compact_schedule_task.delay(batch.pk, day, request.user.pk if request.user and request.user.is_authenticated else None)
                # Persist audit record for enqueue
                try:
                    models.AnalyticsFeed.objects.create(
                        event_type='compact_schedule_queued',
                        message=f'Compact schedule enqueued for batch {batch.name}',
                        payload={'batch_id': batch.pk, 'batch_name': batch.name, 'day': day, 'task_id': str(task.id)},
                        user=request.user if request.user.is_authenticated else None,
                    )
                except Exception:
                    pass
                try:
                    from .sse import emit_analytics_event
                    emit_analytics_event('compact_enqueued', f'Compact enqueued for {batch.name}', {'task_id': task.id, 'batch': batch.pk}, user_id=(request.user.pk if request.user and request.user.is_authenticated else None))
                except Exception:
                    pass
                return Response({'status': 'queued', 'task_id': task.id, 'affected_entries': plan.get('affected_entries', 0)}, status=status.HTTP_202_ACCEPTED)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Fallback: apply inline (keep for compatibility, but not recommended)
        if mode == 'apply':
            # apply inline by delegating to the background task synchronously
            try:
                result = compact_schedule_task.apply(args=(batch.pk, day, request.user.pk if request.user and request.user.is_authenticated else None))
                return Response({'status': 'completed', **(result.get() or {})})
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'error': 'invalid mode'}, status=status.HTTP_400_BAD_REQUEST)

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
