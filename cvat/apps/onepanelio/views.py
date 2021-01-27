# Copyright (C) 2020 Onepanel Inc.
#
# SPDX-License-Identifier: MIT

from __future__ import print_function

import os
import yaml
import tempfile
from datetime import datetime

from django.http import JsonResponse

from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view

from cvat.apps.engine import annotation
from cvat.apps.engine.models import Task
from cvat.apps.engine.log import slogger
from cvat.apps.onepanelio.models import OnepanelAuth
import cvat.apps.dataset_manager.task as DatumaroTask

import onepanel.core.api
from onepanel.core.api.rest import ApiException
from onepanel.core.api.models import Parameter

import boto3
import botocore
from s3transfer import TransferConfig, S3Transfer


def onepanel_authorize(request):
    auth_token = OnepanelAuth.get_auth_token(request)
    configuration = onepanel.core.api.Configuration(
        host=os.getenv('ONEPANEL_API_URL'),
        api_key={'authorization': auth_token})
    configuration.api_key_prefix['authorization'] = 'Bearer'
    return configuration


def create_s3_client():
    with open('/etc/onepanel/artifactRepository') as file:
        data = yaml.load(file, Loader=yaml.FullLoader)

    with open(os.path.join('/etc/onepanel', data['s3']['accessKeySecret']['key'])) as file:
        access_key = yaml.load(file, Loader=yaml.FullLoader)

    with open(os.path.join('/etc/onepanel', data['s3']['secretKeySecret']['key'])) as file:
        secret_key = yaml.load(file, Loader=yaml.FullLoader)

    # set env vars
    os.environ['AWS_ACCESS_KEY_ID'] = access_key
    os.environ['AWS_SECRET_ACCESS_KEY'] = secret_key

    endpoint = data['s3']['endpoint']
    insecure = data['s3']['insecure']
    bucket_name = data['s3']['bucket']

    if endpoint != 's3.amazonaws.com':
        if insecure:
            endpoint = 'http://' + endpoint
        else:
            endpoint = 'https://' + endpoint
        s3_client = boto3.client('s3', endpoint_url=endpoint)
    else:
        s3_client = boto3.client('s3')

    return s3_client, bucket_name


@api_view(['POST'])
def get_available_dump_formats(request):
    data = DatumaroTask.get_export_formats()
    formats = []
    for d in data:
        formats.append({'name': d['name'], 'tag': d['tag']})
    return JsonResponse({'dump_formats': formats})


@api_view(['GET'])
def list_workflow_templates(request):
    configuration = onepanel_authorize(request)

    with onepanel.core.api.ApiClient(configuration) as api_client:
        api_instance = onepanel.core.api.WorkflowTemplateServiceApi(api_client)
        namespace = os.getenv('ONEPANEL_RESOURCE_NAMESPACE')
        labels = os.getenv('ONEPANEL_CVAT_WORKFLOWS_LABEL', 'key=used-by,value=cvat')
        page_size = 100
        page = 1

        try:
            api_response = api_instance.list_workflow_templates(namespace, page_size=page_size, page=page,
                                                                labels=labels)
            return JsonResponse(api_response.to_dict())
        except ApiException as e:
            print("Exception when calling WorkflowTemplateServiceApi->list_workflow_templates: %s\n" % e)


@api_view(['GET'])
def list_workflow_template_versions(request, workflow_template_uid):
    configuration = onepanel_authorize(request)

    with onepanel.core.api.ApiClient(configuration) as api_client:
        api_instance = onepanel.core.api.WorkflowTemplateServiceApi(api_client)
        namespace = os.getenv('ONEPANEL_RESOURCE_NAMESPACE')

        try:
            api_response = api_instance.list_workflow_template_versions(namespace, workflow_template_uid)
            return JsonResponse(api_response.to_dict())
        except ApiException as e:
            print("Exception when calling WorkflowTemplateServiceApi->list_workflow_template_versions %s\n" % e)


@api_view(['GET'])
def get_workflow_template(request, workflow_template_uid, version):
    configuration = onepanel_authorize(request)

    with onepanel.core.api.ApiClient(configuration) as api_client:
        api_instance = onepanel.core.api.WorkflowTemplateServiceApi(api_client)
        namespace = os.getenv('ONEPANEL_RESOURCE_NAMESPACE')

        try:
            api_response = api_instance.get_workflow_template2(namespace, uid=workflow_template_uid, version=version)

            return JsonResponse(api_response.to_dict())
        except ApiException as e:
            print("Exception when calling WorkflowTemplateServiceApi->get_workflow_template: %s\n" % e)


@api_view(['POST'])
def get_node_pool(request):
    configuration = onepanel_authorize(request)

    # Enter a context with an instance of the API client
    with onepanel.core.api.ApiClient(configuration) as api_client:
        # Create an instance of the API class
        api_instance = onepanel.core.api.ConfigServiceApi(api_client)

    try:
        api_response = api_instance.get_config()
        return JsonResponse({'node_pool': api_response.to_dict()['node_pool']})
    except ApiException as e:
        print('Exception when calling ConfigServiceApi->get_config: %s\n' % e)


@api_view(['POST'])
def get_object_counts(request, pk):
    # db_task = self.get_object()
    data = annotation.get_task_data_custom(pk, request.user)
    return Response(data)


def generate_output_path(uid, pk):
    time = datetime.now()
    stamp = time.strftime('%m%d%Y%H%M%S')
    db_task = Task.objects.get(pk=pk)
    dir_name = db_task.name + '/' + form_data['uid'] + '/' + stamp
    prefix = os.getenv('ONEPANEL_SYNC_DIRECTORY', 'workflow-data') + '/' + os.getenv('ONEPANEL_WORKFLOW_MODEL_DIR',
                                                                                     'output')
    output = prefix + '/' + dir_name + '/'
    return Response({'name': output})


@api_view(['GET'])
def generate_dataset_path(uid, pk):
    time = datetime.now()
    stamp = time.strftime('%m%d%Y%H%M%S')
    db_task = Task.objects.get(pk=pk)
    dir_name = db_task.name + '/' + stamp
    prefix = 'annotation-dump'
    output = prefix + '/' + dir_name + '/'
    return Response({'name': output})


@api_view(['POST'])
def get_base_model(request):
    return Response({'keys': []})


def upload_annotation_data(uid, db_task, form_data, object_storage_prefix):
    s3_client, bucket_name = create_s3_client()

    parameters = form_data['parameters']
    cvat_finetune_checkpoint = ''.join(parameters.get('cvat-finetune-checkpoint', '').split())
    if cvat_finetune_checkpoint != '':
        results = s3_client.list_objects(Bucket=bucket_name, Prefix=cvat_finetune_checkpoint)
        if not 'Contents' in results:
            raise botocore.exceptions.ClientError(error_response={'Error': {}}, operation_name=None)

    project = DatumaroTask.TaskProject.from_task(
        Task.objects.get(pk=uid), db_task.owner.username)

    data = DatumaroTask.get_export_formats()
    formats = {d['name']: d['tag'] for d in data}
    dump_format = parameters.get('dump-format', '')
    if dump_format not in formats.values():
        dump_format = 'cvat_tfrecord'

    with tempfile.TemporaryDirectory(dir=os.getenv('CVAT_DATA_DIR', '/cvat/data')) as tmp_dir:
        project.export(dump_format, tmp_dir, save_images=True)

        # read artifactRepository to find out cloud provider and get access for upload
        TB = 1024 ** 4
        transfer_config = TransferConfig(
            multipart_threshold=1 * TB,
            max_concurrency=10,
            num_download_attempts=10,
        )
        transfer = S3Transfer(s3_client, transfer_config)

        for root, dirs, files in os.walk(tmp_dir):
            for file in files:
                upload_dir = root.replace(tmp_dir, '')
                if upload_dir.startswith('/'):
                    upload_dir = upload_dir[1:]
                root_file = os.path.join(root, file)
                file_object = os.path.join(object_storage_prefix, upload_dir, file)
                transfer.upload_file(root_file, bucket_name, file_object)


@api_view(['POST'])
def execute_training_workflow(request, pk):
    """
        Executes workflow selected by User.
    """
    form_data = request.data
    slogger.glob.info('Form data without preprocessing {} {}'.format(form_data, type(form_data)))

    parameters = form_data['parameters']
    workflow_template_uid = form_data['workflow_template']

    db_task = Task.objects.get(pk=pk)
    db_labels = db_task.label_set.prefetch_related('attributespec_set').all()
    db_labels = {db_label.id: db_label.name for db_label in db_labels}
    num_classes = len(db_labels.values())

    time = datetime.now()
    stamp = time.strftime('%m%d%Y%H%M%S')

    # dump annotations into object storage
    annotations_object_storage_prefix = os.getenv('CVAT_ANNOTATIONS_OBJECT_STORAGE_PREFIX') + str(
        db_task.id) + '/' + stamp + '/'
    if 'cvat-annotation-path' in parameters:
        try:
            upload_annotation_data(int(pk), db_task, form_data, annotations_object_storage_prefix)
        except botocore.exceptions.ClientError as e:
            return JsonResponse({'message':'Checkpoint path does not exist in object storage.'}, status=status.HTTP_404_NOT_FOUND)

    configuration = onepanel_authorize(request)
    # Enter a context with an instance of the API client
    with onepanel.core.api.ApiClient(configuration) as api_client:
        # Create an instance of the API class
        api_instance = onepanel.core.api.WorkflowServiceApi(api_client)
        namespace = os.getenv('ONEPANEL_RESOURCE_NAMESPACE')
        params = []
        for p_name, p_value in parameters.items():
            if p_name in ['cvat-annotation-path', 'cvat-num-classes']:
                continue
            params.append(Parameter(name=p_name, value=p_value))

        if 'cvat-annotation-path' in parameters:
            params.append(Parameter(name='cvat-annotation-path', value=annotations_object_storage_prefix))
        if 'cvat-num-classes' in parameters:
            params.append(Parameter(name='cvat-num-classes', value=str(num_classes)))

        body = onepanel.core.api.CreateWorkflowExecutionBody(parameters=params,
                                                             workflow_template_uid=workflow_template_uid,
                                                             labels=[{'key': 'workspace-uid',
                                                                      'value': os.getenv('ONEPANEL_RESOURCE_UID')},
                                                                     {'key': 'cvat-job-id', 'value': str(pk)}])
        try:
            api_response = api_instance.create_workflow_execution(namespace, body)
            return Response(data=api_response.to_dict()['metadata'], status=status.HTTP_200_OK)
        except ApiException as e:
            slogger.glob.exception(
                'Exception when calling WorkflowServiceApi->create_workflow_execution: {}\n'.format(e))
            return Response(data='error occurred', status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response(status=status.HTTP_200_OK)
