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
    return {
        id: vertex["id"],
        name: vertex["properties"]["name"][0]["value"],
        envId: vertex["properties"]["envId"][0]["value"],
        appRoleId: vertex["properties"]["appRoleId"][0]["value"],
        claimValue: vertex["properties"]["claimValue"]?.[0]["value"] ?? "",
        appRoleAssignmentId: vertex["properties"]["appRoleAssignmentId"][0]["value"],
        groupId: vertex["properties"]["groupId"][0]["value"],
        description: vertex["properties"]["description"]?.[0]["value"] ?? ""
    }
}