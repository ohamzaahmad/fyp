from django.conf import settings
from django.http import JsonResponse


class MustChangePasswordMiddleware:
    """Blocks API access for users who must change their password on first login.

    Allows token endpoints, the change-password endpoint and `auth/me` so the
    frontend can detect the flag and guide the user to change their password.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            user = getattr(request, 'user', None)
            if not user or not getattr(user, 'is_authenticated', False):
                return self.get_response(request)

            # staff and superusers bypass this check
            if getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False):
                return self.get_response(request)

            # Allow certain paths so user can authenticate and change password
            allowed = [
                '/api/auth/token/',
                '/api/auth/token/refresh/',
                '/api/auth/token/verify/',
                '/api/auth/change-password/',
                '/api/auth/me/',
            ]

            path = request.path or ''
            for p in allowed:
                if path.startswith(p):
                    return self.get_response(request)

            # Allow admin and static/media
            if path.startswith('/admin/') or path.startswith(settings.STATIC_URL) or path.startswith(settings.MEDIA_URL):
                return self.get_response(request)

            # Check faculty flag
            try:
                from .models import Faculty
                if Faculty.objects.filter(user=user, must_change_password=True).exists():
                    return JsonResponse({'detail': 'Password change required.'}, status=403)
            except Exception:
                # If anything goes wrong, allow request through to avoid blocking unintentionally
                return self.get_response(request)

        except Exception:
            pass

        return self.get_response(request)
