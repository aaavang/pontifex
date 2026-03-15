import {vertexToObject} from "../../../common/utils/vertex";
import {PontifexEnvironment} from "../../environment/entities/environment.entity";
import {PontifexGroup} from "../../group/entities/group.entity";
import {PontifexUser} from "../../user/entities/user.entity";

export interface PontifexApplication {
    id: string
    name: string // human-friendly
    creator: string
    description: string
}

export interface PontifexApplicationBundle {
    application: PontifexApplication
    environments: PontifexEnvironment[]
    owners: PontifexUser[]
    ownerGroups: PontifexGroup[]
}

export function PontifexApplicationFromGremlin(vertex: any): PontifexApplication {
    const obj = vertexToObject(vertex);
    try {
        return {
            creator: obj["creator"],
            id: obj["id"],
            name: obj["name"],
            description: obj["description"] ?? ""
        }
    } catch (e) {
        throw new Error(`Failed to parse user from gremlin: ${JSON.stringify(vertex, null, 4)}}`)
    }
}