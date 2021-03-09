// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT

export interface WorkflowTemplate {
    uid: string;
    version: string;
    name: string;
}

export interface NodePoolResponse {
    label: string;
    options: NodePoolParameters[];
    hint: string | null;
    display_name: string | null;
}

export interface NodePoolParameters {
    name: string;
    value: string;
}

export interface DefaultSysParams {
    hint: string | null;
    display_name: string | null;
    options?: any;
    value?: string | null;
}

export interface DumpFormats {
    name: string;
    tag: string;
}

export interface ExecuteWorkflowPayload {
    workflow_template: string;
    parameters: any;
}
