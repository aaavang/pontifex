export class UpdateApplicationRequest {
    description?: string;
    environments: string[];
}

export function isUpdateApplicationRequest(
    obj: any
): obj is UpdateApplicationRequest {
    return (
        obj.environments !== undefined &&
        Array.isArray(obj.environments) &&
        obj.environments.every((x: any) => typeof x === "string")
    );
}