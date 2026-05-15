from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('timetable', '0006_course_department_systemconfiguration_working_days'),
    ]

    operations = [
        migrations.CreateModel(
            name='AnalyticsFeed',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(max_length=100)),
                ('message', models.TextField(blank=True)),
                ('payload', models.JSONField(default=dict, blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, null=True, blank=True)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
