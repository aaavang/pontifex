import {vertexToObject} from "../../../common/utils/vertex";
import {PontifexEnvironment} from "../../environment/entities/environment.entity";

export interface PontifexTokenGroup {
    id: string
    name: string
    envId: string
    appRoleId: string
    appRoleAssignmentId: string
    groupId: string
    claimValue: string
    description: string
}

export interface PontifexTokenGroupBundle {
    tokenGroup: PontifexTokenGroup
    environment: PontifexEnvironment
}

export function PontifexTokenGroupFromGremlin(vertex: any): PontifexTokenGroup {
    const obj = vertexToObject(vertex)
    return {
        id: obj["id"],
        name: obj["name"],
        envId: obj["envId"],
        appRoleId: obj["appRoleId"] ?? "",
        appRoleAssignmentId: obj["appRoleAssignmentId"] ?? "",
        groupId: obj["groupId"],
        claimValue: obj["claimValue"] ?? "",
        description: obj["description"] ?? ""
    }
}
