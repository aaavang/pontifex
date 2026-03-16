import {Injectable} from "@nestjs/common";
import {ResourceNotFoundException} from "../../common/exceptions/resource-not-found.exception";
import {mapToObject} from "../../common/utils/obj";
import {vertexToObject} from "../../common/utils/vertex";
import {PontifexEnvironment, PontifexEnvironmentFromGremlin} from "../environment/entities/environment.entity";
import {GremlinEdge} from "../gremlin/entities/gremlin.entity";
import {GremlinService} from "../gremlin/gremlin.service";
import {
    PontifexPermissionRequest,
    PontifexPermissionRequestFromGremlin
} from "../permission-request/entities/permision-request.entity";
import {PontifexUser, PontifexUserFromGremlin} from "../user/entities/user.entity";
import {PontifexARoleFromGremlin, PontifexRole, PontifexRoleBundle, SensitiveAppRole} from "./entities/role.entity";

@Injectable()
export class RoleService {
    constructor(private readonly gremlinService: GremlinService) {
    }

    async get(id: string): Promise<PontifexRoleBundle> {
        const {vertex, connections} = await this.gremlinService.getVertexAndChildren(id, id, "role");
        if (!vertex) {
            throw new ResourceNotFoundException('Role')
        }

        console.log('vertex', JSON.stringify(vertex));
        console.log('connections', JSON.stringify(mapToObject(connections)));

        return {
            role: PontifexARoleFromGremlin(vertex),
            environment: PontifexEnvironmentFromGremlin(connections["contained by"]!.environment![0]),
            requests: connections["requests permission"]?.permissionRequest?.map(
                PontifexPermissionRequestFromGremlin) ?? [],
        }
    }

    async addApplicationAssociation(role: PontifexRole, appId: string): Promise<void> {
        const appToRoleEdge: GremlinEdge = {
            destinationVertexId: role.id,
            destinationVertexPk: role.id,
            label: "contains",
            sourceVertexId: appId,
            sourceVertexPk: appId
        }

        const roleToAppEdge: GremlinEdge = {
            destinationVertexId: appId,
            destinationVertexPk: appId,
            label: "contained by",
            sourceVertexId: role.id,
            sourceVertexPk: role.id
        }

        await this.gremlinService.upsertEdge(appToRoleEdge)
        await this.gremlinService.upsertEdge(roleToAppEdge)
    }

    async getAllConsumers(id: string): Promise<PontifexEnvironment[]> {
        const {connections} = await this.gremlinService.getVertexAndChildren(id, id, "role")
        return connections["consumed by"]?.map(PontifexEnvironmentFromGremlin) ?? []
    }

    async getOwners(vid: string): Promise<PontifexUser[]> {
        const query = `
                g.V(vid)
                .out('contained by')
                .out('contained by')
                .out('owned by')
            `
        const bindings = {
            vid,
            pk: vid
        }

        const res = await this.gremlinService.submit(query, bindings)

        const owners: PontifexUser[] = []

        for (const item of res._items) {
            const obj = vertexToObject(item)
            if (obj['type'] == "user") {
                console.log("adding user")
                owners.push(PontifexUserFromGremlin(item))
            } else if (obj['type'] == "group") {
                const groupId = item["id"];
                console.log("adding members of group with id", groupId)

                const groupQuery = `
                        g.V(vid)
                        .out('has member')
                       `
                const groupRes = await this.gremlinService.submit(groupQuery, {vid: groupId})
                console.log("found members", groupRes._items)
                owners.push(...groupRes._items.map(PontifexUserFromGremlin))
            }
        }
        return owners
    }

    async getPermissionRequests(vid: string): Promise<PontifexPermissionRequest[]> {
        const query = 'g.V(vid).out("requests permission")'

        const bindings = {
            vid,
        }

        const res = await this.gremlinService.submit(query, bindings)

        return res._items.map(PontifexPermissionRequestFromGremlin)
    }

    async update(role: PontifexRole): Promise<PontifexRole> {
        const vertex = await this.gremlinService.upsertVertex<PontifexRole>({
                                                                                id: role.id,
                                                                                pk: role.id,
                                                                                defaultProperties: {
                                                                                    type: "role",
                                                                                    name: role.name
                                                                                },
                                                                                updatedProperties: {
                                                                                    sensitive: role.sensitive,
                                                                                    description: role.description
                                                                                }
                                                                            })

        console.log("upserted role vertex", JSON.stringify(vertex))

        return PontifexARoleFromGremlin(vertex)
    }

    async delete(id: string): Promise<void> {
        await this.gremlinService.dropVertex(id, 'role')
    }

    async syncRoles(id: any, roles: SensitiveAppRole[]) {
        const pontifexRoles = roles.map<PontifexRole>((role) => {
            return {
                id: role.id,
                name: role.displayName,
                sensitive: role.sensitive,
                description: role.description ?? "",
            } as PontifexRole;
        });
        for (const role of pontifexRoles) {
            await this.update(role);
            await this.addApplicationAssociation(role, id);
        }
    }
}