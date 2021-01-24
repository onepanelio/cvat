import React from 'react';
import {
    Row,
    Col,
} from 'antd';

import { SelectParameter } from './selectParameter';
import { TextAreaParameter } from './textareaParameter';
import { TextInputParameter } from './textinputParamter';
import { WorkflowParameter } from '../common/workflowParameter';

export type ParameterValues = { [key: string]: any };
export type ParameterChangeCallback = (event: ParameterChangeEvent) => void;

export interface ParameterChangeEvent {
    parameter: WorkflowParameter;
    value: any;
    source: any;
}

interface Props {
    parameters: WorkflowParameter[];
    handleParameterChange?: ParameterChangeCallback;
    handleParameterValuesChange?: (newValues: ParameterValues) => void;
}

interface State {
    parameterValues: { [key:string]: any };
}

export class Parameters extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            parameterValues: {}
        };

        this.handleParameterChange = this.handleParameterChange.bind(this);
    }

    componentWillReceiveProps(nextProps: Props) {
        this.setState(prevState => { 

            const selectedParameters: {[key:string]: any} = {};
            for( const parameter of nextProps.parameters) {
                selectedParameters[parameter.name] = parameter.value;
            }

            return  {
                parameterValues: selectedParameters
            }
        });
    }

    private handleParameterChange(event: ParameterChangeEvent) {
        const { handleParameterChange, handleParameterValuesChange } = this.props;

        this.setState(prevState => {
            const parameterMap = { ...prevState.parameterValues };
            parameterMap[event.parameter.name] = event.value;

            if (handleParameterValuesChange) {
                handleParameterValuesChange(parameterMap);
            }

            return {
                parameterValues: parameterMap
            }
        });

        if (handleParameterChange) {
            handleParameterChange(event);
        }
    }

    public render(): JSX.Element {
        const { parameters } = this.props;
        const { parameterValues } = this.state;

        const parameterMap = parameterValues;

        const formattedParameters = [];
        for(const parameter of parameters) {
            formattedParameters.push({
                ...parameter,
                type: parameter.type ? parameter.type.toLocaleLowerCase() : 'input.text'
            });
        }

        return (
            <div>
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
            </div>
        );
    }
}