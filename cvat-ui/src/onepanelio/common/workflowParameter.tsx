// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT

export interface WorkflowParameter {
    type: string;
    name: string;
    value: string;
    required: boolean | null;
    options: any;
    hint: string | null;
    display_name: string | null;
    visibility: string;
}
