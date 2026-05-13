from django.urls import path, include
from rest_framework import routers
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from .views import EmailOrUsernameTokenObtainPairView
from .views import (
    FacultyViewSet,
    BuildingViewSet,
    RoomViewSet,
    DepartmentViewSet,
    RoomTypeViewSet,
    CourseLoadViewSet,
    ScheduleEntryViewSet,
    SolverRunView,
    CurrentUserView,
    TeacherOnlyView,
    AdminOnlyView,
    MasterMapView,
    TimetableMoveView,
    TimetableGenerateView,
    TimetableConstraintsView,
    AnalyticsSummaryView,
    AnalyticsLoadDistributionView,
    AnalyticsFeedView,
    AnalyticsLogsView,
    TeacherScheduleView,
    BulkImportView,
    BatchDiagnosticView,
    DepartmentsListView,
    RoomTypesListView,
    FacultyListView,
)

router = routers.DefaultRouter()
router.register(r'faculties', FacultyViewSet)
router.register(r'buildings', BuildingViewSet)
router.register(r'rooms', RoomViewSet)
router.register(r'departments', DepartmentViewSet)
router.register(r'room-types', RoomTypeViewSet)
router.register(r'course-loads', CourseLoadViewSet)
router.register(r'entries', ScheduleEntryViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # JWT token endpoints
    path('auth/token/', EmailOrUsernameTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),

    # Protected example endpoints
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('auth/teacher-only/', TeacherOnlyView.as_view(), name='teacher-only'),
    path('auth/admin-only/', AdminOnlyView.as_view(), name='admin-only'),
    path('solver/generate/', SolverRunView.as_view(), name='solver-generate'),

    # Frontend-friendly timetable endpoints
    path('timetable/master-map/', MasterMapView.as_view(), name='timetable-master-map'),
    path('timetable/<str:entry_id>/move/', TimetableMoveView.as_view(), name='timetable-move'),
    path('timetable/generate/', TimetableGenerateView.as_view(), name='timetable-generate'),
    path('timetable/constraints/', TimetableConstraintsView.as_view(), name='timetable-constraints'),
    path('analytics/summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
    path('analytics/load-distribution/', AnalyticsLoadDistributionView.as_view(), name='analytics-load-distribution'),
    path('analytics/feed/', AnalyticsFeedView.as_view(), name='analytics-feed'),
    path('analytics/logs/', AnalyticsLogsView.as_view(), name='analytics-logs'),
    path('teacher/me/schedule/', TeacherScheduleView.as_view(), name='teacher-schedule'),
    path('timetable/bulk-upload/', BulkImportView.as_view(), name='timetable-bulk-upload'),
    path('diagnostics/batch/<str:batch_id>/', BatchDiagnosticView.as_view(), name='batch-diagnostic'),

    # Simple lookup endpoints used by the frontend
    path('faculty/', FacultyListView.as_view(), name='faculty-list'),
]
