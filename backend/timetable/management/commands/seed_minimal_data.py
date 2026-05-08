from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction


class Command(BaseCommand): # type: ignore
    help = "Create minimal seed data for testing the solver. Idempotent."

    def handle(self, *args, **options):
        with transaction.atomic():
            User = get_user_model()
            user, created = User.objects.get_or_create(
                username="seed_teacher",
                defaults={"email": "seed_teacher@example.com"},
            )
            if created:
                user.set_password("password")
                user.save()

            # Import models here so this module can be imported without Django settings
            from timetable import models

            faculty, fcreated = models.Faculty.objects.get_or_create(
                email="seed_teacher@example.com",
                defaults={
                    "user": user,
                    "name": "Seed Teacher",
                    "department": models.Department.CS,
                    "tier": 1,
                },
            )
            if faculty.user is None:
                faculty.user = user
                faculty.save()

            building, _ = models.Building.objects.get_or_create(
                code="B1", defaults={"name": "Seed Building"}
            )

            floor, _ = models.Floor.objects.get_or_create(building=building, number=1)

            room, _ = models.Room.objects.get_or_create(
                floor=floor, name="Room 101", defaults={"capacity": 30}
            )

            course_load, _ = models.CourseLoad.objects.get_or_create(
                subject_code="SEED101",
                batch_id="BatchA",
                defaults={
                    "subject_name": "Seed Course",
                    "faculty": faculty,
                    "weekly_hours": 2,
                },
            )

            self.stdout.write(self.style.SUCCESS("Seed data created or already exists."))
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction


class Command(BaseCommand):
    help = "Create minimal seed data for local testing (building, floor, room, faculty, courseload)."

    def handle(self, *args, **options):
        User = get_user_model()
        from timetable import models

        with transaction.atomic():
            # Create or get a test user
            user, u_created = User.objects.get_or_create(
                username='seed_teacher',
                defaults={'email': 'teacher@example.com'},
            )
            if u_created:
                user.set_password('password')
                user.save()

            # Create faculty linked to the user
            faculty, f_created = models.Faculty.objects.get_or_create(
                email=user.email,
                defaults={
                    'user': user,
                    'name': 'Seed Teacher',
                    'department': models.Department.CS,
                },
            )

            building, b_created = models.Building.objects.get_or_create(
                code='B1', defaults={'name': 'Seed Building'}
            )

            floor, floor_created = models.Floor.objects.get_or_create(
                building=building, number=1
            )

            room, room_created = models.Room.objects.get_or_create(
                floor=floor, name='101', defaults={'capacity': 30, 'room_type': 'Lec'}
            )

            course, c_created = models.CourseLoad.objects.get_or_create(
                subject_code='SEED101',
                subject_name='Seed Subject',
                batch_id='BatchA',
                defaults={'faculty': faculty, 'weekly_hours': 2},
            )

            self.stdout.write(self.style.SUCCESS('Seed data created or already exists:'))
            self.stdout.write(f'  user: {user.username} (created={u_created})')
            self.stdout.write(f'  faculty: {faculty.email} (created={f_created})')
            self.stdout.write(f'  building: {building.code} (created={b_created})')
            self.stdout.write(f'  floor: {floor.number} (created={floor_created})')
            self.stdout.write(f'  room: {room.name} (created={room_created})')
            self.stdout.write(f'  course: {course.subject_code} (created={c_created})')
