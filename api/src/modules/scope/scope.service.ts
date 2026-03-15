import {PermissionScope} from "@microsoft/microsoft-graph-types";
import {Injectable} from "@nestjs/common";
import {ResourceNotFoundException} from "../../common/exceptions/resource-not-found.exception";
import {PontifexEnvironmentFromGremlin} from "../environment/entities/environment.entity";
import {GremlinEdge} from "../gremlin/entities/gremlin.entity";
import {GremlinService} from "../gremlin/gremlin.service";
import {
    PontifexPermissionRequest,
    PontifexPermissionRequestFromGremlin
} from "../permission-request/entities/permision-request.entity";
import {PontifexUser, PontifexUserFromGremlin} from "../user/entities/user.entity";
import {PontifexScope, PontifexScopeBundle, PontifexScopeFromGremlin} from "./entities/scope.entity";

@Injectable()
export class ScopeService {
    constructor(private readonly gremlinService: GremlinService) {
    }

    async addApplicationAssociation(scope: PontifexScope, appId: string): Promise<void> {
        const appToScopeEdge: GremlinEdge = {
            destinationVertexId: scope.id,
            destinationVertexPk: scope.id,
            label: "contains",
            sourceVertexId: appId,
            sourceVertexPk: appId,
        };
        const scopeToAppEdge: GremlinEdge = {
            destinationVertexId: appId,
            destinationVertexPk: appId,
            label: "contained by",
            sourceVertexId: scope.id,
            sourceVertexPk: scope.id,
        };
        await this.gremlinService.upsertEdge(appToScopeEdge);
        await this.gremlinService.upsertEdge(scopeToAppEdge);
    }

    async get(id: string): Promise<PontifexScopeBundle> {
        const {vertex, connections} = await this.gremlinService.getVertexAndChildren(id, id, "scope");

        if (!vertex) {
            throw new ResourceNotFoundException('Scope');
        }

        return {
            scope: PontifexScopeFromGremlin(vertex),
            environment: PontifexEnvironmentFromGremlin(connections["contained by"]!.environment![0]),
            requests: connections["requests permission"]?.permissionRequest?.map(
                PontifexPermissionRequestFromGremlin) ?? []

        }
    }

    async getAllConsumers(id: string): Promise<PontifexUser[]> {
        const {connections} = await this.gremlinService.getVertexAndChildren(id, id, "scope");
        return (
            connections["consumed by"]?.map(PontifexEnvironmentFromGremlin) ?? []
        );
    }

    async getOwners(id: string): Promise<PontifexUser[]> {
        const query = `
                g.V(vid)
                .out('contained by')
                .out('contained by')
                .out('owned by')
            `;
        const bindings = {
            vid: id,
            pk: id,
        };

        const res = await this.gremlinService.submit(query, bindings);

        const owners: PontifexUser[] = [];

        for (const item of res._items) {
            console.log("item type", item["properties"]["type"][0]["value"]);
            if (item["properties"]["type"][0]["value"] == "user") {
                console.log("adding user");
                owners.push(PontifexUserFromGremlin(item));
            } else if (item["properties"]["type"][0]["value"] == "group") {
                const groupId = item["id"];
                console.log("adding members of group with id", groupId);

                const groupQuery = `
                        g.V(vid)
                        .out('has member')
                       `;
                const groupRes = await this.gremlinService.submit(groupQuery, {vid: groupId});
                console.log("found members", groupRes._items);
                owners.push(...groupRes._items.map(PontifexUserFromGremlin));
            }
        }

        return owners;
    }

    async getPermissionRequests(id: string): Promise<PontifexPermissionRequest[]> {
        const query = 'g.V(vid).out("requests permission")';

        const bindings = {
            vid: id,
        };

        const res = await this.gremlinService.submit(query, bindings);

        return res._items.map(PontifexPermissionRequestFromGremlin);
    }

    async update(scope: PontifexScope): Promise<PontifexScope> {
        const vertex = await this.gremlinService.upsertVertex<PontifexScope>({
                                                                                 id: scope.id,
                                                                                 pk: scope.id,
                                                                                 defaultProperties: {
                                                                                     type: "scope",
                                                                                     name: scope.name,
                                                                                 },
                                                                                 updatedProperties: {
                                                                                     displayName: scope.displayName,
                                                                                     description: scope.description,
                                                                                 },
                                                                             });

        console.log("upserted scope vertex", vertex);

        return PontifexScopeFromGremlin(vertex);
    }

    async delete(id: string): Promise<void> {
        await this.gremlinService.dropVertex(id, 'scope');
    }

    async syncScopes(id: any, scopes: PermissionScope[]) {
        const pontifexScopes = scopes.map<PontifexScope>((scope) => {
            return {
                id: scope.id,
                name: scope.value,
                displayName: scope.userConsentDisplayName,
                description: scope.userConsentDescription,
            } as PontifexScope;
        });
        for (const scope of pontifexScopes) {
            await this.update(scope);
            await this.addApplicationAssociation(scope, id);
        }
    }
}