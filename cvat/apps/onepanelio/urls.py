# Copyright (C) 2020 Onepanel Inc.
#
# SPDX-License-Identifier: MIT

from django.urls import path
from . import views

urlpatterns = [
    path('get_workflow_templates', views.get_workflow_templates),
    path('get_node_pool', views.get_node_pool),
    path('get_object_counts/<int:pk>', views.get_object_counts),
    path('get_base_model', views.get_base_model),
    path('execute_workflow/<int:pk>', views.execute_training_workflow),
    path('get_workflow_parameters', views.get_workflow_parameters),
    path('get_available_dump_formats', views.get_available_dump_formats),
    path('get_output_path/<int:pk>', views.generate_output_path),
    path('get_annotation_path/<int:pk>', views.generate_dataset_path),
]
