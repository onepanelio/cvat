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