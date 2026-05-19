import secrets
import datetime
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from timetable import models


class Command(BaseCommand):
    help = 'Seed development data for NexusTime (safe to run multiple times)'

    def handle(self, *args, **options):
        User = get_user_model()

        # 1) Create admin user
        admin_username = 'admin'
        admin_email = 'admin@example.com'
        admin_password = 'admin'
        if not User.objects.filter(username=admin_username).exists():
            User.objects.create_superuser(admin_username, admin_email, admin_password)
            self.stdout.write(self.style.SUCCESS(f'Created superuser {admin_username}/{admin_password}'))
        else:
            self.stdout.write('Superuser already exists')

        # 2) Create a sample department / floor / room
        dept, _ = models.Department.objects.get_or_create(code='CS', defaults={'name': 'Computer Science'})
        floor, _ = models.Floor.objects.get_or_create(department=dept, number=1)
        room, _ = models.Room.objects.get_or_create(floor=floor, name='Room 101', defaults={'capacity': 60, 'room_type': 'Lec'})

        # 3) Create a sample course and batch
        course, _ = models.Course.objects.get_or_create(course_id='CS-101', defaults={'name': 'Intro to Computer Science'})
        batch, created = models.Batch.objects.get_or_create(name='BSCS-2026-A', defaults={'department': dept, 'semester': 1, 'shift': 'M'})
        if created and batch.department_id != dept.pk:
            batch.department = dept
            batch.save()

        # 4) Create teachers and linked users (capture temp passwords)
        teachers_info = [
            {'name': 'Dr. Alice', 'email': 'alice@example.com', 'tier': 1},
            {'name': 'Dr. Bob', 'email': 'bob@example.com', 'tier': 2},
        ]

        created_teachers = []
        for t in teachers_info:
            username = (t['email'].split('@')[0]) if t.get('email') else t['name'].split()[0].lower()
            temp_password = secrets.token_urlsafe(8)

            if User.objects.filter(username=username).exists():
                user = User.objects.get(username=username)
                # We won't change password if user already exists
                temp_password = '<existing>'
            else:
                user = User.objects.create_user(username=username, email=t.get('email') or '', password=temp_password)

            # Create or update Faculty and attach user (avoid signal creating duplicate user)
            faculty, fac_created = models.Faculty.objects.get_or_create(email=t.get('email'), defaults={
                'user': user,
                'name': t['name'],
                'department': dept,
                'tier': t['tier'],
            })
            if not fac_created:
                faculty.user = user
                faculty.name = t['name']
                faculty.department = dept
                faculty.tier = t['tier']
                faculty.save()

            faculty.must_change_password = True
            faculty.save(update_fields=['must_change_password'])
            faculty.can_teach.add(course)

            created_teachers.append({'faculty': faculty, 'user': user, 'temp_password': temp_password})
            self.stdout.write(self.style.SUCCESS(f'Prepared teacher {faculty.name} (user={user.username})'))

        # 5) Create one course assignment and one schedule entry
        primary_faculty = created_teachers[0]['faculty']
        assignment, _ = models.CourseAssignment.objects.get_or_create(course=course, batch=batch, teacher=primary_faculty, defaults={'weekly_hours': 3, 'type': 'T'})
        start_time = datetime.time(hour=9, minute=0)
        entry, _ = models.ScheduleEntry.objects.get_or_create(assignment=assignment, room=room, day_of_week='Mon', start_time=start_time, defaults={'duration_minutes': 60})
        self.stdout.write(self.style.SUCCESS('Created sample assignment and schedule entry'))

        # 6) Summary and validation
        self.stdout.write('\n--- Summary ---')
        self.stdout.write(f'Departments: {models.Department.objects.count()}')
        self.stdout.write(f'Rooms: {models.Room.objects.count()}')
        self.stdout.write(f'Courses: {models.Course.objects.count()}')
        self.stdout.write(f'Batches: {models.Batch.objects.count()}')
        self.stdout.write(f'Faculty: {models.Faculty.objects.count()}')
        self.stdout.write(f'Users: {User.objects.count()}')

        # Validate created teachers have linked users and must_change_password set
        for t in created_teachers:
            f = t['faculty']
            u = t['user']
            pw_ok = False
            if t['temp_password'] != '<existing>':
                pw_ok = u.check_password(t['temp_password'])
            self.stdout.write(self.style.SUCCESS(f'Faculty {f.name}: user={u.username} pw-valid={pw_ok} must_change_password={f.must_change_password}'))

        self.stdout.write(self.style.SUCCESS('Seeding complete'))
