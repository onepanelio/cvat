// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT
import getCore from 'cvat-core-wrapper';
import { createAction, ThunkAction, ActionUnion } from './functions';
import { WorkflowTemplate } from './interfaces';

const core = getCore();
const baseURL = core.config.backendAPI.slice(0, -7);

export enum CreateAnnotationActionTypes {
    OPEN_NEW_ANNOTATION_DIALOG = 'SHOW_NEW_ANNOTATION_DIALOG',
    GET_WORKFLOW_TEMPLATES_SUCCESS = 'GET_WORKFLOW_TEMPLATES_SUCCESS',
    GET_WORKFLOW_TEMPLATES_ERROR = 'GET_WORKFLOW_TEMPLATES_ERROR',
    HIDE_FETCHING_WORKFLOW_TEMPLATE = 'HIDE_FETCHING_WORKFLOW_TEMPLATE',
    CLOSE_NEW_ANNOTATION_DIALOG = 'CLOSE_NEW_ANNOTATION_DIALOG',
    GET_BASE_MODEL = 'GET_BASE_MODEL',
}
export type CreateAnnotationActions = ActionUnion<typeof createAnnotationAction>;

export const createAnnotationAction = {
    openNewAnnotationDialog: (taskInstance: any) =>
        createAction(CreateAnnotationActionTypes.OPEN_NEW_ANNOTATION_DIALOG, {
            taskInstance,
        }),

    getWorflowTemplatesSuccess: (workflowTemplates: WorkflowTemplate[]) =>
        createAction(CreateAnnotationActionTypes.GET_WORKFLOW_TEMPLATES_SUCCESS, { workflowTemplates }),
    getWorflowTemplatesError: () =>
        createAction(CreateAnnotationActionTypes.GET_WORKFLOW_TEMPLATES_ERROR, { workflowTemplates: [] }),
    hideFetchingWorkflow: () => createAction(CreateAnnotationActionTypes.HIDE_FETCHING_WORKFLOW_TEMPLATE),
    closeNewAnnotationDialog: () => createAction(CreateAnnotationActionTypes.CLOSE_NEW_ANNOTATION_DIALOG),
    getBaseModelList: (baseModelList: string[]) =>
        createAction(CreateAnnotationActionTypes.GET_BASE_MODEL, {
            baseModelList,
        }),
};

export function getBaseModelsAsync(taskInstance: any, modelType: string): ThunkAction {
    return async (dispatch): Promise<void> => {
        try {
            const { keys } = await core.server.request(`${baseURL}/onepanelio/get_base_model`, {
                method: 'POST',
                data: { model_type: modelType },
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            dispatch(createAnnotationAction.getBaseModelList(keys || []));
        } catch (e) {
            dispatch(createAnnotationAction.getWorflowTemplatesError());
        }
    };
}

export function getWorkflowTemplateAsync(taskInstance: any): ThunkAction {
    return async (dispatch): Promise<void> => {
        try {
            dispatch(createAnnotationAction.openNewAnnotationDialog(taskInstance));
            const response = await core.server.request(`${baseURL}/onepanelio/workflow_templates`, {
                method: 'GET',
            });
            dispatch(createAnnotationAction.hideFetchingWorkflow());
            if (response.count) {
                const workflowTemplates: WorkflowTemplate[] = response.workflow_templates.map((workflow: any) => ({
                    uid: workflow.uid,
                    name: workflow.name,
                    version: workflow.version === 'none' || workflow.version == null ? '0' : workflow.version,
                }));
                dispatch(createAnnotationAction.getWorflowTemplatesSuccess(workflowTemplates));
            }
        } catch (e) {
            dispatch(createAnnotationAction.getWorflowTemplatesError());
        }
    };
}

export type CreateAnnotationAction = ActionUnion<typeof createAnnotationAction>;
