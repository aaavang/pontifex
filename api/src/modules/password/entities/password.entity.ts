import {vertexToObject} from "../../../common/utils/vertex";
import {PontifexEnvironment} from "../../environment/entities/environment.entity";

export interface PontifexPassword {
    id: string
    displayName: string
    start: string
    end: string
    password: string
}

export interface PontifexPasswordBundle {
    password: PontifexPassword
    environment: PontifexEnvironment
}

export function PontifexPasswordFromGremlin(vertex: any): PontifexPassword {
    const obj = vertexToObject(vertex);
    return {
        id: obj["id"],
        displayName: obj["displayName"],
        start: obj["start"],
        end: obj["end"],
        password: obj["password"],
    }
}