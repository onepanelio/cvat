# Copyright (C) 2020 Onepanel Inc.
#
# SPDX-License-Identifier: MIT

from __future__ import print_function

import os, json
import tempfile
from django.http import JsonResponse
from django.http import HttpResponse, HttpResponseNotFound
from rest_framework.response import Response

from cvat.apps.authentication.decorators import login_required
from cvat.apps.onepanelio.models import OnepanelAuth
from cvat.apps.engine import annotation
import cvat.apps.dataset_manager.task as DatumaroTask
from cvat.apps.engine.models import Task as TaskModel
from cvat.apps.engine.log import slogger
from rest_framework import status
from datetime import datetime
import onepanel.core.api
from onepanel.core.api.rest import ApiException
from onepanel.core.api.models import Parameter
from rest_framework.decorators import api_view
import yaml

def onepanel_authorize(request):
    auth_token = OnepanelAuth.get_auth_token(request)
    # auth_token = os.getenv('ONEPANEL_AUTHORIZATION')
    configuration = onepanel.core.api.Configuration(
        host = os.getenv('ONEPANEL_API_URL'),
        api_key = { 'authorization': auth_token})
    configuration.api_key_prefix['authorization'] = 'Bearer'
    return configuration

def authenticate_cloud_storage():
    """ Set appropriate env vars before importing boto3

    """
    with open("/etc/onepanel/artifactRepository") as file:
        data = yaml.load(file, Loader=yaml.FullLoader)

    cloud_provider = None
    if "s3" in list(data.keys()):
        cloud_provider = "s3"
    elif "gcs" in list(data.keys()):
        cloud_provider = "gcs"
    elif "az" in list(data.keys()):
        cloud_provider = "az"

    if cloud_provider == "s3":

        with open(os.path.join("/etc/onepanel", data[cloud_provider]['accessKeySecret']['key'])) as file:
            access_key = yaml.load(file, Loader=yaml.FullLoader)

        with open(os.path.join("/etc/onepanel", data[cloud_provider]['secretKeySecret']['key'])) as file:
            secret_key = yaml.load(file, Loader=yaml.FullLoader)

        #set env vars
        os.environ['AWS_ACCESS_KEY_ID'] = access_key
        os.environ['AWS_SECRET_ACCESS_KEY'] = secret_key

    elif cloud_provider == "gcs":
        #set env vars
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.join("/etc/onepanel", data[cloud_provider]['serviceAccountKeySecret']['key'])

    elif cloud_provider == "az":
        pass

    else:
        raise ValueError("Invalid cloud provider. Should be from ['s3', 'gcs', az']")

    return data[cloud_provider]['bucket'], cloud_provider, data[cloud_provider]['endpoint']

@api_view(['POST'])
def get_available_dump_formats(request):
    data = DatumaroTask.get_export_formats()
    formats = []
    for d in data:
        formats.append({'name':d['name'], 'tag':d['tag']})
    return JsonResponse({'dump_formats': formats})

@api_view(['POST'])
def get_workflow_templates(request):

    configuration = onepanel_authorize(request)

    # Enter a context with an instance of the API client
    with onepanel.core.api.ApiClient(configuration) as api_client:
        # Create an instance of the API class
        api_instance = onepanel.core.api.WorkflowTemplateServiceApi(api_client)
        namespace = os.getenv('ONEPANEL_RESOURCE_NAMESPACE')  # str |
    page_size = 100 # int |  (optional)
    page = 1 # int |  (optional)
    try:
        api_response = api_instance.list_workflow_templates(namespace, page_size=page_size, page=page, labels=os.getenv('ONEPANEL_CVAT_WORKFLOWS_LABEL','key=used-by,value=cvat'))
        return JsonResponse(api_response.to_dict())
    except ApiException as e:
        print("Exception when calling WorkflowTemplateServiceApi->list_workflow_templates: %s\n" % e)



@api_view(['POST'])
def get_workflow_parameters(request):
    """This function should return a list/dict of parameters for selected workflow.
    Additionally, use default values to pre-populate fields.

    """
    # read workflow_uid and workflow_version from request payload
    global all_parameters
    form_data = request.data

    configuration = onepanel_authorize(request)

    # Enter a context with an instance of the API client
    with onepanel.core.api.ApiClient(configuration) as api_client:
        # Create an instance of the API class
        api_instance = onepanel.core.api.WorkflowTemplateServiceApi(api_client)
        namespace = os.getenv('ONEPANEL_RESOURCE_NAMESPACE')  # str |
    try:
        api_response = api_instance.get_workflow_template2(namespace, uid=form_data['uid'], version=form_data['version'])
        all_parameters = api_response.to_dict()['parameters']
        public_parameters = [p for p in all_parameters if p['visibility'] == 'public']
        return JsonResponse({'parameters':public_parameters})
    except ApiException as e:
        print("Exception when calling WorkflowTemplateServiceApi->list_workflow_templates: %s\n" % e)

@api_view(['POST'])
def get_node_pool(request):
    configuration = onepanel_authorize(request)

    # Enter a context with an instance of the API client
    with onepanel.core.api.ApiClient(configuration) as api_client:
        # Create an instance of the API class
        api_instance = onepanel.core.api.ConfigServiceApi(api_client)

    try:
        api_response = api_instance.get_config()
        return JsonResponse({'node_pool':api_response.to_dict()['node_pool']})
    except ApiException as e:
        print("Exception when calling ConfigServiceApi->get_config: %s\n" % e)

@api_view(['POST'])
def get_object_counts(request, pk):
    # db_task = self.get_object()
    data = annotation.get_task_data_custom(pk, request.user)
    return Response(data)

def generate_output_path(uid, pk):
    time = datetime.now()
    stamp = time.strftime("%m%d%Y%H%M%S")
    db_task = TaskModel.objects.get(pk=pk)
    dir_name = db_task.name + '/' + form_data['uid'] + '/' + stamp
    prefix = os.getenv('ONEPANEL_SYNC_DIRECTORY', 'workflow-data') + '/' + os.getenv('ONEPANEL_WORKFLOW_MODEL_DIR','output')
    output = prefix + '/' + dir_name + '/'
    return Response({'name':output})

def generate_dataset_path(uid, pk):
    time = datetime.now()
    stamp = time.strftime("%m%d%Y%H%M%S")
    db_task = TaskModel.objects.get(pk=pk)
    dir_name = db_task.name + '/' + stamp
    prefix = 'annotation-dump'
    output = prefix + '/' + dir_name + '/'
    return Response({'name':output})

@api_view(['POST'])
def get_model_keys(request):
    try:
        form_data = request.data
        # bucket_name = authenticate_cloud_storage()
        checkpoints = [i[0] for i in os.walk(os.getenv('CVAT_SHARE_DIR', '/share') + '/' + os.getenv('ONEPANEL_WORKFLOW_MODEL_DIR', 'output')) if form_data['uid']+'/' in i[0]]
        if form_data['sysRefModel']:
            checkpoint_paths = [os.path.join(*[os.getenv('ONEPANEL_SYNC_DIRECTORY', 'workflow-data')]+c.split("/")[-5:]) for c in checkpoints]
            checkpoint_path_filtered = [c for c in checkpoint_paths if len(c.split("/")) == 6 and c.startswith(os.getenv('ONEPANEL_SYNC_DIRECTORY', 'workflow-data')+'/'+os.getenv('ONEPANEL_WORKFLOW_MODEL_DIR', 'output')) and form_data['sysRefModel'] in c]
        else:
            checkpoint_paths = [os.path.join(*[os.getenv('ONEPANEL_SYNC_DIRECTORY', 'workflow-data')]+c.split("/")[-4:]) for c in checkpoints]
            checkpoint_path_filtered = [c for c in checkpoint_paths if len(c.split("/")) == 5 and c.startswith(os.getenv('ONEPANEL_SYNC_DIRECTORY', 'workflow-data')+'/'+os.getenv('ONEPANEL_WORKFLOW_MODEL_DIR', 'output'))]
        checkpoint_path_ordered = [os.getenv('ONEPANEL_RESOURCE_NAMESPACE')+'/' + os.getenv('ONEPANEL_SYNC_DIRECTORY')+'/'+'/'.join(i.split('/')[1:]) for i in checkpoint_path_filtered]
        # since this updated paths (11/27/2020) are corresponding to cloud storage, we cant sort it based on time
        # checkpoint_path_ordered.sort(key=os.path.getmtime, reverse=True)
        return Response({'keys':checkpoint_path_ordered})
    except:
        return Response({'keys':[]})


def dump_training_data(uid, db_task, stamp, dump_format, cloud_prefix, request):

    project = DatumaroTask.TaskProject.from_task(
        TaskModel.objects.get(pk=uid), db_task.owner.username)

    # read artifactRepository to find out cloud provider and get access for upload

    bucket_name, cloud_provider, endpoint = authenticate_cloud_storage()

    data = DatumaroTask.get_export_formats()
    formats = {d['name']:d['tag'] for d in data}
    if dump_format not in formats.values():
        dump_format = "cvat_tfrecord"

    # dataset_name = os.getenv('ONEPANEL_RESOURCE_UID').replace(' ', '_') + '_' + db_task.name + "_" + dump_format + "_" + stamp

    with tempfile.TemporaryDirectory() as test_dir:

        project.export(dump_format, test_dir, save_images=True)

        if cloud_provider == "s3":

            import boto3
            from botocore.exceptions import ClientError
            from botocore.client import Config
            from s3transfer import TransferConfig, S3Transfer

            if endpoint != 's3.amazonaws.com':
                if not endpoint.startswith('http'):
                    endpoint = 'https://'+endpoint
                s3_client = boto3.client('s3', endpoint_url=endpoint)
            else:
                s3_client = boto3.client('s3')

            transfer_config = TransferConfig(
                multipart_threshold=9999999999999999,
                max_concurrency=10,
                num_download_attempts=10,
            )
            transfer = S3Transfer(s3_client, transfer_config)

            for root,dirs,files in os.walk(test_dir):
                for file in files:
                    upload_dir = root.replace(test_dir, "")
                    if upload_dir.startswith("/"):
                        upload_dir = upload_dir[1:]
                    if not cloud_prefix.endswith("/"):
                        cloud_prefix += "/"
                    root_file = os.path.join(root, file)
                    ns_cloud_prefix = os.path.join(os.getenv('ONEPANEL_RESOURCE_NAMESPACE') + '/' + cloud_prefix, upload_dir, file)
                    slogger.glob.info("upload_file_debug {} {}".format(root_file, bucket_name,ns_cloud_prefix))
                    transfer.upload_file(root_file, bucket_name, ns_cloud_prefix)

        elif cloud_provider == "gcs":
            from google.cloud import storage
            storage_client = storage.Client()
            bucket = storage_client.bucket(bucket_name)

            for root, dirs, files in os.walk(test_dir):
                for file in files:
                    upload_dir = root.replace(test_dir, "")
                    if upload_dir.startswith("/"):
                        upload_dir = upload_dir[1:]
                    if not cloud_prefix.endswith("/"):
                        cloud_prefix += "/"
                    blob = bucket.blob(os.path.join(os.getenv('ONEPANEL_RESOURCE_NAMESPACE') + '/'+cloud_prefix, upload_dir, file))
                    blob.upload_from_filename(os.path.join(root, file))

        elif cloud_provider == "az":
            pass

        else:
            raise ValueError("Invalid cloud provider! Should be from ['s3','gcs','az']")



@api_view(['POST'])
def create_annotation_model(request, pk):
    """
        Executes workflow selected by User.
    """
    global all_parameters
    all_parameter_names = [p['name'] for p in all_parameters]
    db_task = TaskModel.objects.get(pk=pk)
    db_labels = db_task.label_set.prefetch_related('attributespec_set').all()
    db_labels = {db_label.id:db_label.name for db_label in db_labels}
    num_classes = len(db_labels.values())

    form_data = request.data
    slogger.glob.info("Form data without preprocessing {} {}".format(form_data, type(form_data)))

    # form_args = form_data['arguments']
    time = datetime.now()
    stamp = time.strftime("%m%d%Y%H%M%S")

    # cloud_prefix = os.getenv('ONEPANEL_RESOURCE_NAMESPACE')+ '/annotation-dump/'

    # dump training data on cloud
    # if 'cvat-annotation-path' in form_data['parameters']:
    annotation_path = 'annotation-dump' + '/' + db_task.name + '/' + stamp + '/'
    if 'cvat-model' in all_parameter_names:
        output_path = os.getenv('ONEPANEL_SYNC_DIRECTORY' ,'workflow-data') + '/' + os.getenv('ONEPANEL_WORKFLOW_MODEL_DIR','output') + '/' + db_task.name + '/' + form_data['workflow_template'] + '/' + form_data['parameters']['cvat-model']
    else:
        output_path = os.getenv('ONEPANEL_SYNC_DIRECTORY' ,'workflow-data') + '/' + os.getenv('ONEPANEL_WORKFLOW_MODEL_DIR','output') + '/' + db_task.name + '/' + form_data['workflow_template']

    if 'cvat-annotation-path' in all_parameter_names:
        dump_training_data(int(pk), db_task, stamp, form_data['dump_format'], annotation_path, request)

    time = datetime.now()
    stamp = time.strftime("%m%d%Y%H%M%S")

    configuration = onepanel_authorize(request)

    # Enter a context with an instance of the API client
    with onepanel.core.api.ApiClient(configuration) as api_client:
        # Create an instance of the API class
        api_instance = onepanel.core.api.WorkflowServiceApi(api_client)
        namespace = os.getenv('ONEPANEL_RESOURCE_NAMESPACE') # str |
        params = []
        for p_name, p_value in form_data['parameters'].items():
            if p_name in ['cvat-annotation-path','cvat-output-path']:
                continue
            params.append(Parameter(name=p_name, value=p_value))

        if 'cvat-annotation-path' in all_parameter_names:
            params.append(Parameter(name='cvat-annotation-path', value=annotation_path))
        if 'cvat-output-path' in all_parameter_names:
            params.append(Parameter(name='cvat-output-path', value=output_path))
        if 'dump-format' in all_parameter_names:
            params.append(Parameter(name='dump-format', value=form_data['dump_format']))
        if 'cvat-num-classes' in all_parameter_names:
            if form_data['workflow_template'] == 'maskrcnn-training':
                params.append(Parameter(name='cvat-num-classes', value=str(num_classes+1)))
            else:
                params.append(Parameter(name='cvat-num-classes', value=str(num_classes)))

        body = onepanel.core.api.CreateWorkflowExecutionBody(parameters=params,
        workflow_template_uid = form_data['workflow_template'], labels=[{'key':'workspace-uid','value':os.getenv('ONEPANEL_RESOURCE_UID')},{'key':'cvat-job-id','value':str(pk)}])
        try:
            api_response = api_instance.create_workflow_execution(namespace, body)
            return Response(data=api_response.to_dict()['metadata'], status=status.HTTP_200_OK)
        except ApiException as e:
            slogger.glob.exception("Exception when calling WorkflowServiceApi->create_workflow_execution: {}\n".format(e))
            return Response(data="error occured", status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response(status=status.HTTP_200_OK)

