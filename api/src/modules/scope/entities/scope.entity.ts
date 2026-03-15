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
    return {
        id: vertex["id"],
        name: vertex["properties"]["name"][0]["value"],
        displayName: vertex["properties"]["displayName"]?.[0]["value"],
        description: vertex["properties"]["description"]?.[0]["value"],
    };
}
