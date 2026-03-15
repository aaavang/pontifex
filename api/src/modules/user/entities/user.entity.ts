import {vertexToObject} from "../../../common/utils/vertex";
import {PontifexApplication} from "../../application/entities/application.entity";
import {PontifexGroup} from "../../group/entities/group.entity";
import {PontifexPermissionRequest} from "../../permission-request/entities/permision-request.entity";

export interface PontifexUser {
    id: string
    name: string
    email: string
    normalizedName: string
}

export interface PontifexUserBundle {
    user: PontifexUser
    memberGroups: PontifexGroup[]
    ownerGroups: PontifexGroup[]
    ownedApplications: PontifexApplication[]
    pendingPermissionRequests: PontifexPermissionRequest[]
    groupedPendingPermissionRequests: Record<string, PontifexPermissionRequest[]>
}

export function PontifexUserFromGremlin(vertex: any): PontifexUser {

    const obj = vertexToObject(vertex)
    try {
        return {
            id: obj["id"],
            name: obj["name"],
            email: obj["email"],
            normalizedName: obj["normalizedName"]
        }
    } catch (e) {
        throw new Error(`Failed to parse user from gremlin: ${JSON.stringify(vertex, null, 4)}}`)
    }
}