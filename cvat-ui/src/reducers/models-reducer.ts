// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT

import { BoundariesActions, BoundariesActionTypes } from 'actions/boundaries-actions';
import { ModelsActionTypes, ModelsActions } from 'actions/models-actions';
import {
    CreateAnnotationActionTypes,
    CreateAnnotationActions,
} from 'onepanelio/createAnnotationModal/createAnnotation.action';
import { AuthActionTypes, AuthActions } from 'actions/auth-actions';
import { ModelsState, Model } from './interfaces';

const defaultState: ModelsState = {
    initialized: false,
    fetching: false,
    creatingStatus: '',
    interactors: [],
    detectors: [],
    trackers: [],
    reid: [],
    visibleRunWindows: false,
    activeRunTask: null,
    inferences: {},
    visibleNewAnnotationWindows: false,
    activeNewAnnotationTask: null,
    baseModelList: [],
    workflowTemplates: [],
    fetchingWorkflowTemplates: false,
};

export default function (
    state = defaultState,
    action: ModelsActions | AuthActions | BoundariesActions | CreateAnnotationActions,
): ModelsState {
    switch (action.type) {
        case ModelsActionTypes.GET_MODELS: {
            return {
                ...state,
                initialized: false,
                fetching: true,
            };
        }
        case ModelsActionTypes.GET_MODELS_SUCCESS: {
            return {
                ...state,
                interactors: action.payload.models.filter((model: Model) => ['interactor'].includes(model.type)),
                detectors: action.payload.models.filter((model: Model) => ['detector'].includes(model.type)),
                trackers: action.payload.models.filter((model: Model) => ['tracker'].includes(model.type)),
                reid: action.payload.models.filter((model: Model) => ['reid'].includes(model.type)),
                initialized: true,
                fetching: false,
            };
        }
        case ModelsActionTypes.GET_MODELS_FAILED: {
            return {
                ...state,
                initialized: true,
                fetching: false,
            };
        }
        case ModelsActionTypes.SHOW_RUN_MODEL_DIALOG: {
            return {
                ...state,
                visibleRunWindows: true,
                activeRunTask: action.payload.taskInstance,
            };
        }
        case ModelsActionTypes.CLOSE_RUN_MODEL_DIALOG: {
            return {
                ...state,
                visibleRunWindows: false,
                activeRunTask: null,
            };
        }
        case CreateAnnotationActionTypes.OPEN_NEW_ANNOTATION_DIALOG: {
            return {
                ...state,
                visibleNewAnnotationWindows: true,
                activeNewAnnotationTask: action.payload.taskInstance,
                fetchingWorkflowTemplates: true,
            };
        }
        case CreateAnnotationActionTypes.GET_WORKFLOW_TEMPLATES_SUCCESS: {
            return {
                ...state,
                workflowTemplates: action.payload.workflowTemplates,
            };
        }
        case CreateAnnotationActionTypes.GET_WORKFLOW_TEMPLATES_ERROR: {
            return {
                ...state,
                workflowTemplates: [],
            };
        }
        case CreateAnnotationActionTypes.HIDE_FETCHING_WORKFLOW_TEMPLATE: {
            return {
                ...state,
                fetchingWorkflowTemplates: false,
            };
        }
        case CreateAnnotationActionTypes.GET_BASE_MODEL: {
            return {
                ...state,
                baseModelList: action.payload.baseModelList,
            };
        }
        case CreateAnnotationActionTypes.CLOSE_NEW_ANNOTATION_DIALOG: {
            return {
                ...state,
                visibleNewAnnotationWindows: false,
                activeNewAnnotationTask: null,
            };
        }
        case ModelsActionTypes.GET_INFERENCE_STATUS_SUCCESS: {
            const { inferences } = state;

            if (action.payload.activeInference.status === 'finished') {
                return {
                    ...state,
                    inferences: Object.fromEntries(
                        Object.entries(inferences).filter(([key]): boolean => +key !== action.payload.taskID),
                    ),
                };
            }

            const update: any = {};
            update[action.payload.taskID] = action.payload.activeInference;

            return {
                ...state,
                inferences: {
                    ...state.inferences,
                    ...update,
                },
            };
        }
        case ModelsActionTypes.GET_INFERENCE_STATUS_FAILED: {
            const { inferences } = state;
            delete inferences[action.payload.taskID];

            return {
                ...state,
                inferences: { ...inferences },
            };
        }
        case ModelsActionTypes.CANCEL_INFERENCE_SUCCESS: {
            const { inferences } = state;
            delete inferences[action.payload.taskID];

            return {
                ...state,
                inferences: { ...inferences },
            };
        }
        case BoundariesActionTypes.RESET_AFTER_ERROR:
        case AuthActionTypes.LOGOUT_SUCCESS: {
            return { ...defaultState };
        }
        default: {
            return state;
        }
    }
}
