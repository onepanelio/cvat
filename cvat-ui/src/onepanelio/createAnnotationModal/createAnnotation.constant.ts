export const getModelNames = () => (
    [
        {
            label: 'frcnn-nas-coco',
        },
        {
            label: 'frcnn-res101-coco',
        },
        {
            label: 'frcnn-res101-low',
        },
        {
            label: 'frcnn-res50-coco',
        },
        {
            label: 'ssd-mobilenet-v2-coco',
        },
        {
            label: 'ssd-mobilenet-v1-coco2',
        },
        {
            label: 'ssdlite-mobilenet-coco',
        }
    ]
)

export const getMachineNames = () => (
    [
        {
            label: 'CPU: 4, RAM: 16GB',
            value: 'cpu'
        },
        {
            label: 'GPU: 1 (Tesla K80), CPU: 4, RAM: 26GB',
            value: 'gpu-4-26-1k80'
        },


    ]
)