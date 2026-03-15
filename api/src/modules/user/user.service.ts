import {Injectable} from "@nestjs/common";
import {ResourceNotFoundException} from "../../common/exceptions/resource-not-found.exception";
import {PontifexApplicationFromGremlin} from "../application/entities/application.entity";
import {GremlinService} from "../gremlin/gremlin.service";
import {PontifexGroupFromGremlin} from "../group/entities/group.entity";
import {PontifexUser, PontifexUserBundle, PontifexUserFromGremlin} from "./entities/user.entity";

@Injectable()
export class UserService {
    constructor(private readonly gremlinService: GremlinService) {
    }

    async get(id: string): Promise<PontifexUserBundle> {
        const {vertex, connections} = await this.gremlinService.getVertexAndChildren(id, id, 'user');

        if (!vertex) {
            throw new ResourceNotFoundException("User")
        }
        
        const bundle: PontifexUserBundle = {
            memberGroups: connections?.["member of"]?.group?.map(PontifexGroupFromGremlin) ?? [],
            ownedApplications: connections?.["owns"]?.application?.map(PontifexApplicationFromGremlin) ?? [],
            ownerGroups: connections?.["owns"]?.group?.map(PontifexGroupFromGremlin) ?? [],
            pendingPermissionRequests: [], // TODO: refactor this to use PermissionRequestService
            groupedPendingPermissionRequests: {}, // TODO: refactor this to use PermissionRequestService
            user: PontifexUserFromGremlin(vertex)
        }

        return bundle
    }

    async update(user: PontifexUser): Promise<PontifexUser> {
        const vertex = await this.gremlinService.upsertVertex({
                                                                  id: user.id,
                                                                  pk: user.id,
                                                                  defaultProperties: {
                                                                      type: "user",
                                                                      name: user.name,
                                                                      email: user.email,
                                                                      normalizedName: user.name.toLowerCase()
                                                                  }
                                                              })

        return PontifexUserFromGremlin(vertex)
    }

    async delete(id: string): Promise<void> {
        await this.gremlinService.dropVertex(id, 'user')
    }

    async searchByPrefix(prefix: string): Promise<PontifexUser[]> {
        const query = "g.V().has('type', 'user').or(has('normalizedName', TextP.startingWith(prefix)), has('email', TextP.startingWith(prefix)))"
        const bindings = {
            prefix: prefix.toLowerCase()
        }

        const result = await this.gremlinService.submit(query, bindings)
        return result._items.map(PontifexUserFromGremlin)
    }
}