from django.urls import path, include
from rest_framework import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    FacultyViewSet,
    BuildingViewSet,
    RoomViewSet,
    CourseLoadViewSet,
    ScheduleEntryViewSet,
    SolverRunView,
    CurrentUserView,
    TeacherOnlyView,
    AdminOnlyView,
    MasterMapView,
    TimetableMoveView,
    TimetableGenerateView,
    DepartmentsListView,
    FacultyListView,
)

router = routers.DefaultRouter()
router.register(r'faculties', FacultyViewSet)
router.register(r'buildings', BuildingViewSet)
router.register(r'rooms', RoomViewSet)
router.register(r'course-loads', CourseLoadViewSet)
router.register(r'entries', ScheduleEntryViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # JWT token endpoints
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Protected example endpoints
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('auth/teacher-only/', TeacherOnlyView.as_view(), name='teacher-only'),
    path('auth/admin-only/', AdminOnlyView.as_view(), name='admin-only'),
    path('solver/generate/', SolverRunView.as_view(), name='solver-generate'),

    # Frontend-friendly timetable endpoints
    path('timetable/master-map/', MasterMapView.as_view(), name='timetable-master-map'),
    path('timetable/<str:entry_id>/move/', TimetableMoveView.as_view(), name='timetable-move'),
    path('timetable/generate/', TimetableGenerateView.as_view(), name='timetable-generate'),

    # Simple lookup endpoints used by the frontend
    path('departments/', DepartmentsListView.as_view(), name='departments-list'),
    path('faculty/', FacultyListView.as_view(), name='faculty-list'),
]
