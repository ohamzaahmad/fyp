from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Set predictable test passwords for seeded teacher users (alice, bob)'

    def handle(self, *args, **options):
        User = get_user_model()
        usernames = ['alice', 'bob']
        pw = 'teacher123'
        for u in User.objects.filter(username__in=usernames):
            u.set_password(pw)
            u.save()
            self.stdout.write(self.style.SUCCESS(f'Set password for {u.username}'))

        self.stdout.write(self.style.SUCCESS('Test passwords set.'))
