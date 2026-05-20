import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nexustime.settings')
django.setup()

from django.contrib.auth import get_user_model
from timetable import models

User = get_user_model()

def main():
    print('--- Verification Report ---')
    print('Departments:', models.Department.objects.count())
    print('Rooms:', models.Room.objects.count())
    print('Courses:', models.Course.objects.count())
    print('Batches:', models.Batch.objects.count())
    print('Faculty records:', models.Faculty.objects.count())
    print('Users:', User.objects.count())

    for username in ['alice', 'bob']:
        u = User.objects.filter(username=username).first()
        if not u:
            print(f'User {username}: NOT FOUND')
            continue
        ok = u.check_password('teacher123')
        print(f'User {username}: found, password_match= {ok}')

    print('\nFaculty details:')
    for f in models.Faculty.objects.all():
        print(f'- {f.name} email={f.email} user={(f.user.username if f.user else None)} must_change_password={f.must_change_password}')

if __name__ == '__main__':
    main()
