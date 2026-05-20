import secrets
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.core.mail import send_mail

from . import models


@receiver(post_save, sender=models.Faculty)
def create_user_for_faculty(sender, instance, created, **kwargs):
    """Ensure a linked `User` exists when a Faculty is created via admin or other paths.

    This will create a Django `User` with a generated temporary password and
    set `must_change_password=True`. It will attempt to email the temp
    password to the faculty's email (silently failing if email not configured).
    """
    if not created:
        return

    if instance.user:
        return

    User = get_user_model()
    base_username = 'teacher'
    if instance.email:
        base_username = instance.email.split('@')[0]
    elif instance.name:
        base_username = instance.name.split()[0].lower()

    username = base_username
    i = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{i}"
        i += 1

    temp_password = secrets.token_urlsafe(9)
    user = User.objects.create(username=username, email=instance.email or '')
    user.set_password(temp_password)
    user.save()

    instance.user = user
    instance.must_change_password = True
    instance.save(update_fields=['user', 'must_change_password'])

    # Try to email the temporary password if an email is configured for the faculty.
    if instance.email:
        try:
            send_mail(
                subject='Your account has been created',
                message=(f'An account for you was created on NexusTime.\n'
                         f'Username: {user.username}\nTemporary password: {temp_password}\n'
                         'Please change your password on first login.'),
                from_email=None,
                recipient_list=[instance.email],
                fail_silently=True,
            )
        except Exception:
            # Do not raise — emailing is best-effort
            pass
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.dispatch import receiver

try:
    from .sse import emit_analytics_event
except Exception:
    emit_analytics_event = None


@receiver(user_logged_in)
def handle_user_logged_in(sender, request, user, **kwargs):
    try:
        if emit_analytics_event:
            emit_analytics_event('user_logged_in', f'User logged in: {getattr(user, "pk", None)}',
                                 {'username': getattr(user, 'username', None)}, user_id=getattr(user, 'pk', None))
    except Exception:
        pass


@receiver(user_logged_out)
def handle_user_logged_out(sender, request, user, **kwargs):
    try:
        if emit_analytics_event:
            emit_analytics_event('user_logged_out', f'User logged out: {getattr(user, "pk", None)}',
                                 {'username': getattr(user, 'username', None)}, user_id=getattr(user, 'pk', None))
    except Exception:
        pass
