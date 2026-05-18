from rest_framework import permissions
from .models import Faculty


class IsAdminUser(permissions.BasePermission):
    """Grants access to Django staff/superuser accounts."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


class IsTeacherUser(permissions.BasePermission):
    """Grants access to users linked to a `Faculty` record (teacher role)."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return Faculty.objects.filter(user=user).exists()


class IsTeacherOrAdmin(permissions.BasePermission):
    """Grants access to teacher-linked users and staff/admin users."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_staff or user.is_superuser:
            return True
        return Faculty.objects.filter(user=user).exists()
