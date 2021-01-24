import getCore from 'cvat-core-wrapper';
import { WorkflowTemplate, WorkflowTemplates } from "../createAnnotationModal/interfaces";

const core = getCore();
const baseUrl = core.config.backendAPI.slice(0, -7);

export const OnepanelApi = {
    async getNodePool() {
        return core.server.request(`${baseUrl}/onepanelio/get_node_pool`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
    },

    async listWorkflowTemplateVersions(workflowTemplateUid: string) {
        return core.server.request(`${baseUrl}/onepanelio/workflow_templates/${workflowTemplateUid}/versions`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
    },

    async getWorkflowTemplate(workflowTemplateUid: string, version: string = '0') {
        return core.server.request(`${baseUrl}/onepanelio/workflow_templates/${workflowTemplateUid}/versions/${version}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
    },

    async executeWorkflow(taskInstanceId: string, payload: any) {
        return core.server.request(`${baseUrl}/onepanelio/execute_workflow/${taskInstanceId}`, {
            method: 'POST',
            data: payload,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    },

    async getBaseModel(workflowTemplateUid: string, sysRefModel: string = "") {
        return await core.server.request(`${baseUrl}/onepanelio/get_base_model`, {
            method: 'POST',
            data: {
                uid: workflowTemplateUid,
                sysRefModel: sysRefModel,
            },
            headers: {
                'Content-Type': 'application/json',
            },
        });
    },

    async getOutputPath(id: string, workflowTemplateUid: string) {
        return core.server.request(`${baseUrl}/onepanelio/get_output_path/${id}`, {
            method: 'POST',
            data: { uid: workflowTemplateUid },
            headers: {
                'Content-Type': 'application/json',
            },
        });
    },

    async getAnnotationPath(id: string, workflowTemplateUid: string) {
        return core.server.request(`${baseUrl}/onepanelio/get_annotation_path/${id}`, {
            method: 'POST',
            data: { uid: workflowTemplateUid },
            headers: {
                'Content-Type': 'application/json',
            },
        });
    },

    async getAvailableDumpFormats() {
        return core.server.request(`${baseUrl}/onepanelio/get_available_dump_formats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
    },

    async getObjectCounts(id: string) {
        return core.server.request(`${baseUrl}/onepanelio/get_object_counts/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
};
