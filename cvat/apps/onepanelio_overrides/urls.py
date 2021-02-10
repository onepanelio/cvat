# Copyright (C) 2021 Onepanel Inc.
#
# SPDX-License-Identifier: MIT

from django.urls import path, include
from . import views
from rest_framework import routers
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

router = routers.DefaultRouter(trailing_slash=False)
router.register('tasks', views.TaskViewSet)

urlpatterns = [
    path('api/v1/', include((router.urls, 'cvat'), namespace='v1'))
]
