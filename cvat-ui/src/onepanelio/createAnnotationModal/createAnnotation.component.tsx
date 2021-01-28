// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React from 'react';

import {
    Row,
    Col,
    Modal,
    Select,
    notification,
    Input,
    Button,
    Spin
} from 'antd';

import { WorkflowTemplate, ExecuteWorkflowPayload, DefaultSysParams } from './interfaces';
import { OnepanelApi } from "../api/onepanelApi";
import { ParameterValues, ParameterChangeEvent } from '../components/parameters';
import { SelectParameter } from '../components/selectParameter';
import { TextAreaParameter } from '../components/textareaParameter';
import { TextInputParameter } from '../components/textinputParamter';
import { WorkflowParameter } from '../common/workflowParameter';

interface Props {
    visible: boolean;
    taskInstance: any;
    baseModelList: string[];
    workflowTemplates: WorkflowTemplate[];
    fetchingWorkflowTemplates: boolean;
    closeDialog(): void;
    getBaseModelList(taskInstance: any, modelType: string): void;
}

interface State {
    isLoading: boolean,
    confirmingSubmitWorkflow: boolean;
    submittingWorkflow: boolean;
    gettingParameters: boolean;
    selectedWorkflowTemplate?: WorkflowTemplate;
    workflowParameters: WorkflowParameter[];
    selectedWorkflowParam: ParameterValues;
    selectedFinetuneCheckpoint?: string;
    showDumpFormatHint: boolean;
    submitEnabled: boolean;
    cancelEnabled: boolean;
}

const InitialState = {
    isLoading: true,
    submittingWorkflow: false,
    confirmingSubmitWorkflow: false,
    gettingParameters: false,
    selectedWorkflowTemplate: undefined,
    workflowParameters: [],
    selectedWorkflowParam: {},
    selectedFinetuneCheckpoint: undefined,
    showDumpFormatHint: false,
    submitEnabled: false,
    cancelEnabled: true,
    parameterValues: {},
}

export default class ModelNewAnnotationModalComponent extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);
        this.state = InitialState;

        this.onWorkflowTemplateChange = this.onWorkflowTemplateChange.bind(this);
        this.handleParameterChange = this.handleParameterChange.bind(this);
    }

    public componentDidUpdate(prevProps: Props, prevState: State): void {
        const { visible } = this.props;

        if (!prevProps.visible && visible) {
            this.setState(InitialState);
        }
    }

    private async handleSubmit(): Promise<void> {
        if (this.state.confirmingSubmitWorkflow) {
            return;
        }

        this.setState({
            submitEnabled: false,
            confirmingSubmitWorkflow: true
        });

        const { taskInstance } = this.props;

        const {
            shapes,
            tracks,
        } = await OnepanelApi.getObjectCounts(taskInstance.id);

        if (tracks.length) {
            return this.onExecuteWorkflow();
        }

        this.onSubmitNotifications(shapes.length);
    }

    private onSubmitNotifications(count: number): void {
        const key = `open${Date.now()}`;
        const onClose = () => {
            this.setState({
                cancelEnabled: true,
                submitEnabled: true,
                confirmingSubmitWorkflow: false
            });
        };

        const btn = (
            <div className="cvat-new-anno-modal-submit-notification-btn fix-ant-spacing">
                <Button
                    size="small"
                    onClick={() => {
                        notification.close(key);
                        onClose();
                    }}
                >
                    Cancel
                </Button>
                <Button
                    type="primary"
                    size="small"
                    className="fix-ant-spacing"
                    onClick={() => {
                        this.onExecuteWorkflow();
                        notification.close(key);
                    }}
                >
                    Confirm
                </Button>
            </div>
        );

        if (count == 0) {
            notification.open({
                message: 'Number of annotations is less than 100',
                description: `Deep learning models work better with large datasets. Are you sure you want to continue?`,
                duration: 0,
                btn,
                key,
                onClose
            });

            this.setState({
                cancelEnabled: false
            });
        } else if (count < 100) {
            notification.open({
                message: 'Are you sure?',
                description: `Number of annotations is less than 100.
                Deep learning models work better with large datasets. Are you sure you want to continue?`,
                duration: 0,
                btn,
                key,
                onClose
            });


            this.setState({
                cancelEnabled: false
            });
        } else {
            this.onExecuteWorkflow();
        }
    }

    private async onExecuteWorkflow(): Promise<void> {
        if (this.state.submittingWorkflow) {
            return;
        }

        const {
            taskInstance,
            closeDialog,
        } = this.props;

        const {
            selectedWorkflowTemplate,
            selectedWorkflowParam,
        } = this.state;

        if (!selectedWorkflowTemplate) {
            return;
        }

        this.setState({
            submittingWorkflow: true,
            submitEnabled: false,
            confirmingSubmitWorkflow: false
        })

        let finalPayload: ExecuteWorkflowPayload = {
            workflow_template: selectedWorkflowTemplate.uid,
            parameters: selectedWorkflowParam,
        }

        try {
            let successResp = await OnepanelApi.executeWorkflow(taskInstance.id, finalPayload);
        
            notification.open({
                message: 'Training Workflow is running',
                duration: 0,
                description: this.executeSuccessMessage(selectedWorkflowTemplate.uid, successResp.url)
            });

            this.setState({
                submittingWorkflow: false,
                confirmingSubmitWorkflow: false,
                cancelEnabled: true,
                submitEnabled: true
            });

            closeDialog();
        } catch (e) {     
            this.setState({
                submittingWorkflow: false,
                confirmingSubmitWorkflow: false,
                submitEnabled: true,
                cancelEnabled: true
            });

            let description = 'There was an error executing the training Workflow';

            if (e.data.message) {
                description = e.data.message;
            }

            notification.error({
                message: 'Error',
                duration: 0,
                description: description
            });
        }
    }

    private async onWorkflowTemplateChange(value: string) {
        if (!value) {
            return;
        }

        const { workflowTemplates } = this.props;
        const data = workflowTemplates.find(workflow => workflow.uid === value)
        // WorkflowTemplate not found by input value
        if(!data) {
            return;
        }

        this.setState({
            selectedWorkflowTemplate: data,
            gettingParameters: true,
            submitEnabled: false
        })

        try {
            const workflowTemplate = await OnepanelApi.getWorkflowTemplate(value);

            const workflowParamNameValue: { [key: string]: any } = {};
            for (const param of workflowTemplate.parameters) {
                workflowParamNameValue[param.name] = param.value;
            }

            this.setState({
                gettingParameters: false,
                submitEnabled: true,
                workflowParameters: workflowTemplate.parameters,
                selectedWorkflowParam: workflowParamNameValue,
            });
        } catch (error) {
            this.showErrorNotification(error);
            this.setState({
                isLoading: false,
                submittingWorkflow: false,
                gettingParameters: false,
                submitEnabled: true,
            });
        }
    }

    private handleParameterChange(event: ParameterChangeEvent) {
        const parameterMap = { ...this.state.selectedWorkflowParam };
        parameterMap[event.parameter.name] = event.value;

        this.setState(prevState => {
            const parameterMap = { ...prevState.selectedWorkflowParam };
            parameterMap[event.parameter.name] = event.value;

            return {
                selectedWorkflowParam: parameterMap
            }
        });
    }

    private renderModelSelector(): JSX.Element {
        const { workflowTemplates } = this.props;
        const { workflowParameters, selectedWorkflowParam } = this.state;
        const parameterMap = selectedWorkflowParam;

        const formattedParameters = [];
        for(const parameter of workflowParameters) {
            if (parameter.visibility !== 'public') {
                continue;
            }

            formattedParameters.push({
                ...parameter,
                type: parameter.type ? parameter.type.toLocaleLowerCase() : 'input.text'
            });
        }

        return (
            <React.Fragment>
                <Row type='flex' align='middle'>
                    <Col span={24}>
                        <label className='cvat-text-color ant-form-item-label'>Select Workflow template:</label>
                        <Select
                            placeholder='Select a Workflow template'
                            style={{ width: '100%' }}
                            onChange={this.onWorkflowTemplateChange}
                        >
                            {
                                workflowTemplates.map((workflow: WorkflowTemplate) =>
                                    <Select.Option value={workflow.uid} key={workflow.uid}>
                                        {workflow.name}
                                    </Select.Option>
                                )
                            }
                        </Select>
                    </Col>
                </Row>

                {
                    formattedParameters.map( (parameter, index) => (
                        <Row type='flex' align='middle' key={index}>
                            <Col span={24}>
                            {
                                parameter.type.startsWith('input.') &&
                                    <TextInputParameter 
                                        parameter={parameter}
                                        value={parameterMap[parameter.name]}
                                        onChange={this.handleParameterChange}
                                    />
                            }
                            {
                                parameter.type === "textarea.textarea" &&
                                    <TextAreaParameter 
                                        parameter={parameter}
                                        value={parameterMap[parameter.name]}
                                        onChange={this.handleParameterChange}
                                    />
                            }
                            {
                                (parameter.type === "select.select" || parameter.type === "select.nodepool" ) && 
                                <SelectParameter 
                                    parameter={parameter} 
                                    value={parameterMap[parameter.name]}
                                    onChange={this.handleParameterChange}
                                />
                            }
                            {
                                parameter.hint ?
                                    <div
                                        style={{ fontSize: "12px", marginLeft: "10px", color: "#716f6f" }}
                                        dangerouslySetInnerHTML={{__html: parameter.hint}}
                                    ></div> :
                                    null
                            }
                            </Col>
                        </Row>
                    ))
                }
            </React.Fragment>
        );
    }

    private renderContent(): JSX.Element {
        return (
            <div className='cvat-run-model-dialog'>
                {this.renderModelSelector()}
            </div>
        );
    }

    private footerComponent(): JSX.Element[] {
        const {
            closeDialog,
            fetchingWorkflowTemplates
        } = this.props;

        const footerElements = [];
        if (this.state.submittingWorkflow) {
            footerElements.push(
                <span key={"message"} style={{ float: 'left', paddingTop: '5px', color: '#1890ff', }}>
                    <Spin /> &nbsp; &nbsp;
                    {`Executing ${this.state.selectedWorkflowTemplate!.uid} workflow...`}
                </span>
            )
        }

        if (this.state.gettingParameters) {
            footerElements.push(
                <span key={"paramMessage"} style={{ float: 'left', paddingTop: '5px', color: '#1890ff', }}>
                    <Spin /> &nbsp; &nbsp;
                    {`Getting workflow parameters...`}
                </span>
            )
        } 

        if (fetchingWorkflowTemplates) {
            footerElements.push(
                <span key={"fetchMessage"} style={{ float: 'left', paddingTop: '5px', color: '#1890ff', }}>
                    <Spin /> &nbsp; &nbsp;
                    {`Getting workflow templates...`}
                </span>
            )
        }

        const footerButtons = [
            <Button key="back" disabled={!this.state.cancelEnabled} onClick={(): void => {
                if (!this.state.cancelEnabled) {
                    return;
                }
                
                this.setState(InitialState);
                closeDialog();
            }}>
                Close
            </Button>,
            <Button key="submit" type="primary" disabled={!this.state.submitEnabled} onClick={(): void => {
                this.handleSubmit();
            }}>
                Execute Workflow
            </Button>,
        ]
        return [
            ...footerElements,
            ...footerButtons
        ]
    }

    public render(): JSX.Element | false {
        const { visible } = this.props;

        return (
            visible && (
                <Modal
                    closable={false}
                    footer={this.footerComponent()}
                    title={'Execute training Workflow'}
                    visible
                    width="50%"
                >
                    {this.renderContent()}
                </Modal>
            )
        );
    }

    private showErrorNotification = (error: any): void => {
        notification.error({
            message: 'Failed to execute Workflow',
            description: `Execute workflow failed (Error code: ${error.code}). Please try again later`,
            duration: 5,
        });
    }

    private executeSuccessMessage(name: string, url: string): JSX.Element {
        return (            
            <div>
                <div className="workflow-executed-message">
                    Training Workflow <strong>{name}</strong> is running.
                </div>
                <Button type="primary" ghost href={url} target='_blank'>Open Workflow details</Button>
            </div>
        )
    }
}
