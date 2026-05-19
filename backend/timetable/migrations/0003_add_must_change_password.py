from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('timetable', '0002_scheduleadjustmentrequest'),
    ]

    operations = [
        migrations.AddField(
            model_name='faculty',
            name='must_change_password',
            field=models.BooleanField(default=True),
        ),
    ]
