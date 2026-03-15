import {AppRole} from "@microsoft/microsoft-graph-types";
import {vertexToObject} from "../../../common/utils/vertex";
import {PontifexEnvironment} from "../../environment/entities/environment.entity";
import {PontifexPermissionRequest} from "../../permission-request/entities/permision-request.entity";

export interface PontifexRole {
    id: string
    name: string // app registration name + dev/stage/prod
    sensitive: boolean
    description: string
}

export interface Sensitive {
    sensitive?: boolean;
}

export type SensitiveAppRole = AppRole & Sensitive;

export interface PontifexRoleBundle {
    role: PontifexRole
    environment: PontifexEnvironment
    requests?: PontifexPermissionRequest[]
}

export function PontifexARoleFromGremlin(vertex: any): PontifexRole {
    const obj = vertexToObject(vertex)
    return {
        id: obj["id"],
        name: obj["name"],
        sensitive: obj["sensitive"] ?? false,
        description: obj["description"] ?? ""
    }
}