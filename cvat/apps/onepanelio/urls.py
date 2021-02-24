# Copyright (C) 2020 Onepanel Inc.
#
# SPDX-License-Identifier: MIT

from django.urls import path, include
from . import views, views_overrides
from rest_framework import routers
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi


router = routers.DefaultRouter(trailing_slash=False)
router.register('tasks', views_overrides.TaskViewSet)

urlpatterns = [
    path('workflow_templates', views.list_workflow_templates),
    path('workflow_templates/<slug:workflow_template_uid>/versions', views.list_workflow_template_versions),
    path('workflow_templates/<slug:workflow_template_uid>/versions/<slug:version>', views.get_workflow_template),
    path('get_node_pool', views.get_node_pool),
    path('get_object_counts/<int:pk>', views.get_object_counts),
    path('get_base_model', views.get_base_model),
    path('execute_workflow/<int:pk>', views.execute_training_workflow),
    path('get_available_dump_formats', views.get_available_dump_formats),
    path('get_output_path/<int:pk>', views.generate_output_path),
    path('get_annotation_path/<int:pk>', views.generate_dataset_path),

    path('api/v1/', include(router.urls))
]
