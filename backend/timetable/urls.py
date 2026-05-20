from django.urls import path, include
from rest_framework import routers
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from .views import EmailOrUsernameTokenObtainPairView
from .views import (
    DepartmentViewSet,
    FloorViewSet,
    RoomViewSet,
    CourseViewSet,
    BatchViewSet,
    FacultyViewSet,
    CourseAssignmentViewSet,
    ScheduleEntryViewSet,
    BatchDiagnosticView,
    SolverRunView,
    CurrentUserView,
    MasterMapView,
    TeacherScheduleExportView,
    ChangePasswordView,
    TimetableMoveView,
    TimetableGenerateView,
    SystemConfigurationView,
    LogoUploadView,
    AnalyticsSummaryView,
    BulkImportView,
    TimetableMergeView,
    TimetableCompactView,
    BatchTimetableExportView,
    ScheduleAdjustmentRequestViewSet,
)
from .sse import analytics_sse_view

router = routers.DefaultRouter()
router.register(r'departments', DepartmentViewSet)
router.register(r'floors', FloorViewSet)
router.register(r'rooms', RoomViewSet)
router.register(r'courses', CourseViewSet)
router.register(r'batches', BatchViewSet)
router.register(r'faculties', FacultyViewSet)
router.register(r'assignments', CourseAssignmentViewSet)
router.register(r'entries', ScheduleEntryViewSet)
router.register(r'adjustment-requests', ScheduleAdjustmentRequestViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('auth/token/', EmailOrUsernameTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('faculties/<str:faculty_id>/export/', TeacherScheduleExportView.as_view(), name='teacher-schedule-export'),
    path('batches/<str:batch_id>/diagnostic/', BatchDiagnosticView.as_view(), name='batch-diagnostic'),
    path('batches/<str:batch_id>/export/', BatchTimetableExportView.as_view(), name='batch-export-pdf'),
    path('solver/generate/', SolverRunView.as_view(), name='solver-generate'),
    path('timetable/master-map/', MasterMapView.as_view(), name='timetable-master-map'),
    path('timetable/<str:entry_id>/move/', TimetableMoveView.as_view(), name='timetable-move'),
    path('timetable/generate/', TimetableGenerateView.as_view(), name='timetable-generate'),
    path('timetable/settings/', SystemConfigurationView.as_view(), name='timetable-settings'),
    path('timetable/upload-logo/', LogoUploadView.as_view(), name='timetable-upload-logo'),
    path('analytics/summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
    path('analytics/stream/', analytics_sse_view, name='analytics-stream'),
    path('timetable/compact/', TimetableCompactView.as_view(), name='timetable-compact'),
    path('timetable/bulk-upload/', BulkImportView.as_view(), name='timetable-bulk-upload'),
    path('timetable/merge/', TimetableMergeView.as_view(), name='timetable-merge'),
]
