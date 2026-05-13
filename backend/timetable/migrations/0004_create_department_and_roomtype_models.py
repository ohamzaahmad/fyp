# Generated migration to create Department and RoomType models and populate defaults
from django.db import migrations, models


def populate_defaults(apps, schema_editor):
    Department = apps.get_model('timetable', 'Department')
    RoomType = apps.get_model('timetable', 'RoomType')

    # Seed departments from previous choices
    defaults = [
        ('CS', 'Computer Science'),
        ('PH', 'Physics'),
        ('MATH', 'Mathematics'),
        ('ARTS', 'Arts'),
        ('ENG', 'Engineering'),
    ]
    for code, name in defaults:
        Department.objects.get_or_create(code=code, defaults={'name': name})

    # Seed room types
    rtypes = [
        ('Lec', 'Lecture'),
        ('Lab', 'Laboratory'),
    ]
    for code, name in rtypes:
        RoomType.objects.get_or_create(code=code, defaults={'name': name})


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
        migrations.RunPython(populate_defaults, reverse_code=migrations.RunPython.noop),
    ]
