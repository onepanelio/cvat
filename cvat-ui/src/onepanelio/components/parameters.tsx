import { WorkflowParameter } from '../common/workflowParameter';

export type ParameterValues = { [key: string]: any };
export type ParameterChangeCallback = (event: ParameterChangeEvent) => void;

export interface ParameterChangeEvent {
    parameter: WorkflowParameter;
    value: any;
    source: any;
}