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
    return {
        id: vertex["id"],
        name: vertex["properties"]["name"][0]["value"],
        normalizedName: vertex["properties"]["normalizedName"][0]["value"]
    }
}