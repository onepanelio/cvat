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

const { TextArea } = Input;
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
    submittingWorkflow: boolean;
    gettingParameters: boolean;
    selectedWorkflowTemplate?: WorkflowTemplate;
    workflowParameters: WorkflowParameter[];
    selectedWorkflowParam: ParameterValues;
    sysAnnotationPath: DefaultSysParams;
    selectedFinetuneCheckpoint?: string;
    showDumpFormatHint: boolean;
    submitEnabled: boolean;
}

const InitialState = {
    isLoading: true,
    submittingWorkflow: false,
    gettingParameters: false,
    selectedWorkflowTemplate: undefined,
    workflowParameters: [],
    selectedWorkflowParam: {},
    sysAnnotationPath: {
        hint: null,
        display_name: "",
        value: ""
    },
    selectedFinetuneCheckpoint: undefined,
    showDumpFormatHint: false,
    submitEnabled: false,
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
        const { closeDialog } = this.props;
        const key = `open${Date.now()}`;
        const btn = (
            <div className="cvat-new-anno-modal-submit-notification-btn">
                <Button
                    type="primary"
                    size="small"
                    onClick={() => {
                        notification.close(key);
                        closeDialog();
                    }}
                >
                    cancel
                </Button>
                <Button
                    type="primary"
                    size="small"
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
                message: 'Are you sure?',
                description: `There aren’t any annotations in this task.
                If you workflow depends on this data it may throw an error. Do you want to continue?`,
                duration: 0,
                btn,
                key,
            });
        } else if (count < 100) {
            notification.open({
                message: 'Are you sure?',
                description: `Number of annotations is less than 100.
                Deep learning models work better with large datasets. Are you sure you want to continue?`,
                duration: 0,
                btn,
                key,
            });
        } else {
            this.onExecuteWorkflow();
        }
    }

    private async onExecuteWorkflow(): Promise<void> {
        const {
            taskInstance,
            closeDialog,
        } = this.props;
        const {
            selectedWorkflowTemplate,
            selectedWorkflowParam,
            sysAnnotationPath,
        } = this.state;

        if (!selectedWorkflowTemplate) {

            // TODO error
            return;
        }

        this.setState({
            submittingWorkflow: true,
        })

        let finalPayload: ExecuteWorkflowPayload = {
            workflow_template: selectedWorkflowTemplate.uid,
            parameters: selectedWorkflowParam,
        }

        if (sysAnnotationPath) {
            finalPayload.parameters["cvat-annotation-path"] = sysAnnotationPath.value;
        }

        try {
            let successResp = await OnepanelApi.executeWorkflow(taskInstance.id, finalPayload);
        
            notification.open({
                message: 'Execute Workflow',
                duration: 0,
                description: this.ExecuteSuccessMessage(selectedWorkflowTemplate.uid, successResp.url)
            });

            closeDialog();
        } catch (e) {
            this.setState({
                submittingWorkflow: false,
                submitEnabled: true
            });

            notification.error({
                message: 'Error',
                duration: 0,
                description: 'There was an error executing the workflow'
            });
        }
    }

    private async onWorkflowTemplateChange(value: string) {
        if (!value) {
            return;
        }

        const {
            taskInstance,
            workflowTemplates,
        } = this.props;

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
            const parameters = workflowTemplate.parameters.filter( (parameter: WorkflowParameter) => parameter.visibility === 'public');

            let workflowParamsArr = parameters, workflowParamNameValue = {};
            const sysAnnotationPath = parameters.find((param: WorkflowParameter) => param.name === "cvat-annotation-path");

            if (sysAnnotationPath) {
                const sysAnnotationPathResp = await OnepanelApi.getAnnotationPath(taskInstance.id, data.uid);
                this.setState({
                    sysAnnotationPath: {
                        display_name: sysAnnotationPath.display_name ? sysAnnotationPath.display_name : sysAnnotationPath.name,
                        hint: sysAnnotationPath.hint,
                        value: sysAnnotationPathResp.name
                    }
                });
            } else {
                this.setState({
                    sysAnnotationPath: InitialState.sysAnnotationPath
                })
            }

            workflowParamsArr = parameters.filter((param: WorkflowParameter) => {
                if (param.name !== "cvat-annotation-path") {
                    workflowParamNameValue = {
                        ...workflowParamNameValue,
                        [param.name]: param.value
                    }
                    return true;
                }
                return false;
            });

            this.setState({
                gettingParameters: false,
                submitEnabled: true,
                workflowParameters: workflowParamsArr,
                selectedWorkflowParam: { ...workflowParamNameValue },
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
                                parameter.type === "input.text" &&
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

                {
                    this.state.sysAnnotationPath.value ?
                        <Row type='flex' align='middle'>
                            <Col span={24}>
                                <label className='cvat-text-color ant-form-item-label'>{this.state.sysAnnotationPath.display_name}:</label>
                                <TextArea
                                    autoSize={{ minRows: 1, maxRows: 4 }}
                                    value={this.state.sysAnnotationPath.value || ""}
                                    onChange={(event) => this.setState({
                                        sysAnnotationPath: {
                                            ...this.state.sysAnnotationPath,
                                            value: event.target.value
                                        }
                                    })}
                                />
                                {
                                    this.state.sysAnnotationPath.hint ?
                                        <div
                                            style={{ fontSize: "12px", marginLeft: "10px", color: "#716f6f" }}
                                            dangerouslySetInnerHTML={{__html: this.state.sysAnnotationPath.hint}}
                                        ></div> :
                                        null
                                }
                            </Col>
                        </Row> : null
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

        const checkSubmitEnable = () => {
            if (this.props.fetchingWorkflowTemplates) {
                return false;
            }

            if (this.state.gettingParameters) {
                return false;
            }

            if (this.state.submittingWorkflow) {
                return false;
            }

            return true;
        }

        const footerButtons = [
            <Button key="back" onClick={(): void => {
                this.setState(InitialState);
                closeDialog();
            }}>
                Close
            </Button>,
            <Button key="submit" type="primary" disabled={!this.state.submitEnabled} onClick={(): void => {
                this.setState({
                    submitEnabled: checkSubmitEnable()
                })
                this.handleSubmit();
                this.setState({
                    submitEnabled: checkSubmitEnable()
                })
            }}>
                Submit
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

    // ---- TODO error methods and notifications
    private showErrorNotification = (error: any): void => {
        notification.error({
            message: 'Execute Workflow failed.',
            description: `Execute workflow failed (Error code: ${error.code}). Please try again later`,
            duration: 5,
        });
    }

    private ExecuteSuccessMessage(name: string, url: string): JSX.Element {
        return (
            <div>
                {name} workflow has been executed. Please check the workflow for logs.
                <br />
                Visit this url for more information: <a href={url} target='_blank'>{url}</a>
            </div>
        )
    }
}
