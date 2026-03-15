import {vertexToObject} from "../../../common/utils/vertex";
import {PontifexUser} from "../../user/entities/user.entity";
import {PontifexApplication} from "../../application/entities/application.entity";

export interface PontifexGroup {
    id: string
    name: string
    normalizedName: string
}

export interface PontifexGroupBundle {
    group: PontifexGroup
    owners: PontifexUser[]
    members: PontifexUser[]
    ownedApplications: PontifexApplication[]
}

export function PontifexGroupFromGremlin(vertex: any): PontifexGroup {
    const obj = vertexToObject(vertex)
    return {
        id: obj["id"],
        name: obj["name"],
        normalizedName: obj["normalizedName"]
    }
}