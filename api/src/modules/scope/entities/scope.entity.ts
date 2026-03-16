import {vertexToObject} from "../../../common/utils/vertex";
import {PontifexEnvironment} from "../../environment/entities/environment.entity";
import {PontifexPermissionRequest} from "../../permission-request/entities/permision-request.entity";

export interface PontifexScope {
    id: string;
    name: string;
    displayName: string;
    description: string;
}

export interface PontifexScopeBundle {
    scope: PontifexScope;
    environment: PontifexEnvironment;
    requests?: PontifexPermissionRequest[];
}

export function PontifexScopeFromGremlin(
    vertex: any
): PontifexScope {
    const obj = vertexToObject(vertex);
    return {
        id: obj["id"],
        name: obj["name"],
        displayName: obj["displayName"],
        description: obj["description"] ?? "",
    };
}
