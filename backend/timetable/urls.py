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
    SolverRunView,
    CurrentUserView,
    MasterMapView,
    TimetableMoveView,
    TimetableGenerateView,
    SystemConfigurationView,
    AnalyticsSummaryView,
    BulkImportView,
)

router = routers.DefaultRouter()
router.register(r'departments', DepartmentViewSet)
router.register(r'floors', FloorViewSet)
router.register(r'rooms', RoomViewSet)
router.register(r'courses', CourseViewSet)
router.register(r'batches', BatchViewSet)
router.register(r'faculties', FacultyViewSet)
router.register(r'assignments', CourseAssignmentViewSet)
router.register(r'entries', ScheduleEntryViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('auth/token/', EmailOrUsernameTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('solver/generate/', SolverRunView.as_view(), name='solver-generate'),
    path('timetable/master-map/', MasterMapView.as_view(), name='timetable-master-map'),
    path('timetable/<str:entry_id>/move/', TimetableMoveView.as_view(), name='timetable-move'),
    path('timetable/generate/', TimetableGenerateView.as_view(), name='timetable-generate'),
    path('timetable/settings/', SystemConfigurationView.as_view(), name='timetable-settings'),
    path('analytics/summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
    path('timetable/bulk-upload/', BulkImportView.as_view(), name='timetable-bulk-upload'),
]
