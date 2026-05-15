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
