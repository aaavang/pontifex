import {Injectable} from "@nestjs/common";
import {ResourceNotFoundException} from "../../common/exceptions/resource-not-found.exception";
import {PontifexEnvironmentFromGremlin} from "../environment/entities/environment.entity";
import {GremlinService} from "../gremlin/gremlin.service";
import {PontifexPassword, PontifexPasswordBundle, PontifexPasswordFromGremlin} from "./entities/password.entity";

@Injectable()
export class PasswordService {
    constructor(private readonly gremlinService: GremlinService) {
    }

    async get(id: string): Promise<PontifexPasswordBundle> {
        if (!id) {
            throw new Error("id cannot be empty or undefined")
        }

        const {vertex, connections} = await this.gremlinService.getVertexAndChildren(id, id, "password")

        if (!vertex) {
            throw new ResourceNotFoundException('Password')
        }

        return {
            password: PontifexPasswordFromGremlin(vertex),
            environment: PontifexEnvironmentFromGremlin(connections["is password for"]!.environment![0]),
        }
    }

    async delete(id: string): Promise<void> {
        await this.gremlinService.dropVertex(id, 'password')
    }

    async create(password: PontifexPassword): Promise<void> {
        await this.gremlinService.upsertVertex<PontifexPassword>({
                                                                     id: password.id,
                                                                     pk: password.id,
                                                                     defaultProperties: {
                                                                         type: "password"
                                                                     },
                                                                     updatedProperties: {
                                                                         start: password.start,
                                                                         end: password.end,
                                                                         password: password.password,
                                                                         displayName: password.displayName
                                                                     }
                                                                 })
    }
}