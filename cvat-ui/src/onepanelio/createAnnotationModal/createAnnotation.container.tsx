// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { connect } from 'react-redux';

// import ModelRunnerModalComponent from 'components/model-runner-modal/model-runner-modal';
import ModelNewAnnotationModalComponent from './createAnnotation.component';
import {
    CombinedState,
} from 'reducers/interfaces';
import { WorkflowTemplate } from './interfaces';
import {
    createAnnotationAction,
    getBaseModelsAsync,
} from './createAnnotation.action';


interface StateToProps {
    taskInstance: any;
    visible: boolean;
    baseModelList: string[];
    workflowTemplates: WorkflowTemplate[];
    fetchingWorkflowTemplates: boolean;
}

interface DispatchToProps {
    closeDialog(): void;
    getBaseModelList(taskInstance: any, modelType: string): void;
}

function mapStateToProps(state: CombinedState): StateToProps {
    const { models } = state;

    return {
        taskInstance: models.activeNewAnnotationTask,
        visible: models.visibleNewAnnotationWindows,
        baseModelList: models.baseModelList,
        workflowTemplates: models.workflowTemplates,
        fetchingWorkflowTemplates: models.fetchingWorkflowTemplates,
    };
}

function mapDispatchToProps(dispatch: any): DispatchToProps {
    return ({
        closeDialog(): void {
            dispatch(createAnnotationAction.closeNewAnnotationDialog());
        },
        getBaseModelList(taskInstance, modelType): void {
            dispatch(getBaseModelsAsync(taskInstance, modelType));
        }
    });
}


function ModelNewAnnotationModalContainer(props: StateToProps & DispatchToProps): JSX.Element {
    return (
        <ModelNewAnnotationModalComponent {...props} />
    );
}

export default connect(
    mapStateToProps,
    mapDispatchToProps,
)(ModelNewAnnotationModalContainer);
