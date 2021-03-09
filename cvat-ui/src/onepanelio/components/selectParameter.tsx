// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT

/* eslint-disable jsx-a11y/label-has-associated-control */

import React from 'react';

import { Select } from 'antd';

import { WorkflowParameter } from '../common/workflowParameter';
import { ParameterChangeCallback, ParameterChangeEvent } from './parameters';

interface Props {
    parameter: WorkflowParameter;
    value: string;
    onChange?: ParameterChangeCallback;
}

// Given an input of parameters and the selected paramter
// render all of the parameters.
export default class SelectParameter extends React.PureComponent<Props, {}> {
    constructor(props: Props) {
        super(props);

        this.handleParameterChange = this.handleParameterChange.bind(this);
    }

    private handleParameterChange(event: ParameterChangeEvent): void {
        const { onChange } = this.props;

        if (!onChange) {
            return;
        }

        onChange(event);
    }

    public render(): JSX.Element {
        const { parameter, value } = this.props;

        let placeholder = parameter.display_name;
        if (!placeholder || placeholder === '') {
            placeholder = parameter.name;
        }

        return (
            <div>
                <label className='cvat-text-color ant-form-item-label'>
                    {placeholder}
                    :
                </label>
                <Select
                    placeholder={parameter.display_name ? parameter.display_name : ''}
                    style={{ width: '100%' }}
                    defaultValue={value}
                    onChange={(event: any) => {
                        this.handleParameterChange({
                            parameter,
                            value: event,
                            source: event,
                        });
                    }}
                >
                    {parameter.options.map((param: any) => (
                        <Select.Option value={param.value} key={param.value}>
                            {param.name}
                        </Select.Option>
                    ))}
                </Select>
            </div>
        );
    }
}
