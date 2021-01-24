import React from 'react';

import { WorkflowParameter } from '../common/workflowParameter';
import { ParameterChangeCallback, ParameterChangeEvent } from './parameters'

import {
    Select, 
} from 'antd';

interface Props {
    parameter: WorkflowParameter;
    value: string;
    onChange?: ParameterChangeCallback
}

interface State {

}

// Given an input of parameters and the selected paramter
// render all of the parameters.
export class SelectParameter extends React.PureComponent<Props, State> {
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
            <div>
                <label className='cvat-text-color ant-form-item-label'>{ parameter.display_name ? parameter.display_name : parameter.name }:</label>
                {
                    <Select
                        placeholder={parameter.display_name ? parameter.display_name : ''}
                        style={{ width: '100%' }}
                        defaultValue={value}
                        onChange={(event: any) => {
                            this.handleParameterChange({
                                parameter,
                                value: event,
                                source: event,
                            })
                        }}
                    >
                    {
                        parameter.options.map((param: any) =>
                            <Select.Option value={param.value} key={param.value}>
                                {param.name}
                            </Select.Option>
                        )
                    }
                    </Select>
                }
            </div>
        )
    }
}