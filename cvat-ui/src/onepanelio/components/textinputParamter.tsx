import React from 'react';

import { WorkflowParameter } from '../common/workflowParameter';
import { ParameterChangeCallback, ParameterChangeEvent } from './parameters'

import { Input } from 'antd';

interface Props {
    parameter: WorkflowParameter
    value?: string
    onChange?: ParameterChangeCallback
}

interface State {}

export class TextInputParameter extends React.PureComponent<Props, State> {
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

        let placeholder = parameter.display_name;
        if (!placeholder || placeholder == '') {
            placeholder = parameter.name;
        }

        let inputType = 'text';
        if (parameter.type !== 'input.text') {
            const typeParts = parameter.type.split('.');
            if (typeParts.length > 1) {
                inputType = typeParts[1];
            }
        }

        return (
            <div>
              <label className='cvat-text-color ant-form-item-label'>{placeholder}:</label>
              <Input
                    name={parameter.name}
                    value={value}
                    type={inputType}
                    onChange={(event: any) => {
                        this.handleParameterChange({
                            parameter,
                            value: event.target.value,
                            source: event,
                        });
                    }}
                />
            </div>
        )
    }
}