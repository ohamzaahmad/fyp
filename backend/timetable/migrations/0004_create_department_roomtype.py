from django.db import migrations, models


def create_initial_departments_and_roomtypes(apps, schema_editor):
    Department = apps.get_model('timetable', 'Department')
    RoomType = apps.get_model('timetable', 'RoomType')
    Faculty = apps.get_model('timetable', 'Faculty')
    Room = apps.get_model('timetable', 'Room')

    # Known historical choices (kept in DepartmentChoices)
    choices = [
        ('CS', 'Computer Science'),
        ('PH', 'Physics'),
        ('MATH', 'Mathematics'),
        ('ARTS', 'Arts'),
        ('ENG', 'Engineering'),
    ]
    for code, name in choices:
        Department.objects.update_or_create(code=code, defaults={'name': name})

    # Ensure any departments present in Faculty rows are present
    try:
        vals = Faculty.objects.values_list('department', flat=True).distinct()
        for v in vals:
            if not v:
                continue
            if not Department.objects.filter(code=v).exists():
                Department.objects.create(code=v, name=str(v))
    except Exception:
        # ignore if table not populated yet
        pass

    # Populate room types from Room.ROOM_TYPES and existing room rows
    known_room_types = [('Lec', 'Lecture'), ('Lab', 'Laboratory')]
    for code, name in known_room_types:
        RoomType.objects.update_or_create(code=code, defaults={'name': name})

    try:
        distinct = Room.objects.values_list('room_type', flat=True).distinct()
        for rt in distinct:
            if not rt:
                continue
            if not RoomType.objects.filter(code=rt).exists():
                RoomType.objects.create(code=rt, name=rt)
    except Exception:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('timetable', '0003_alter_timetableconstraint_break_end_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Department',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=10, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='RoomType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=10, unique=True)),
                ('name', models.CharField(max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.RunPython(create_initial_departments_and_roomtypes),
    ]
