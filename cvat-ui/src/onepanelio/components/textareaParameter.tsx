import React from 'react';
import { WorkflowParameter } from '../common/workflowParameter';
import { ParameterChangeCallback, ParameterChangeEvent } from './parameters'

import { Input } from 'antd';
const { TextArea } = Input;

interface Props {
    parameter: WorkflowParameter
    value?: string
    onChange?: ParameterChangeCallback
}

interface State {}

export class TextAreaParameter extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.handleParameterChange = this.handleParameterChange.bind(this);
    }

    private handleParameterChange(event: ParameterChangeEvent) {
        const { onChange } = this.props;

        if (!onChange) {
            return;
        }

        onChange(event);
    }

    public render(): JSX.Element {
        const { parameter, value } = this.props;

        return (
            <TextArea
                autoSize={{ minRows: 5, maxRows: 5 }}
                name={parameter.name}
                value={value}
                placeholder={parameter.display_name ? parameter.display_name : ''}
                onChange={(event: any) => {
                    this.handleParameterChange({
                        parameter,
                        value: event.target.value,
                        source: event,
                    });
                }}
            />
        )
    }
}