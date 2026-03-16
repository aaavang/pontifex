import {Injectable} from '@nestjs/common';
import {ResourceNotFoundException} from "../../common/exceptions/resource-not-found.exception";
import {PontifexAuditEvent, PontifexAuditEventFromGremlin} from "../audit-event/entities/audit-event.entity";
import {PontifexEnvironmentFromGremlin} from "../environment/entities/environment.entity";
import {GraphQueryService} from "../gremlin/graph-query.service";
import {GremlinService} from "../gremlin/gremlin.service";
import {PontifexGroupFromGremlin} from "../group/entities/group.entity";
import {PontifexUserFromGremlin} from "../user/entities/user.entity";
import {
    PontifexApplication,
    PontifexApplicationBundle,
    PontifexApplicationFromGremlin
} from "./entities/application.entity";

@Injectable()
export class ApplicationService {
    constructor(private readonly gremlinService: GremlinService,
                private readonly graphQueryService: GraphQueryService) {
    }

    async delete(id: string): Promise<void> {
        if (!id) {
            throw new Error('id cannot be empty or undefined');
        }
        await this.gremlinService.dropVertex(id, 'application');
    }

    async get(id: string): Promise<PontifexApplicationBundle> {
        if (!id) {
            throw new Error('id cannot be empty or undefined');
        }

        const {vertex, connections} = await this.gremlinService.getVertexAndChildren(id, id, 'application');

        if (!vertex) {
            throw new ResourceNotFoundException('Application');
        }

        console.log(`Retrieved application with ID: ${id}`, JSON.stringify(vertex));
        console.log("Connections:", JSON.stringify(connections));

        return {
            application: PontifexApplicationFromGremlin(vertex),
            environments: connections?.contains?.environment?.map(PontifexEnvironmentFromGremlin) ?? [],
            owners: connections?.['owned by']?.user?.map(PontifexUserFromGremlin) ?? [],
            ownerGroups: connections?.['owned by']?.group?.map(PontifexGroupFromGremlin) ?? [],
        };
    }

    async getAllByUser(userId: string): Promise<PontifexApplication[]> {
        return this.graphQueryService.getApplicationsForUser(userId);
    }

    async getAll(): Promise<any[]> {
        const apps = await this.gremlinService.getAllVerticesOfType('application');
        return apps.map(PontifexApplicationFromGremlin);
    }

    async setOwningGroup(id: string, groupId: string): Promise<void> {
        if (!groupId) {
            throw new Error('id cannot be empty or undefined');
        }

        await this.gremlinService.upsertVertex({
                                                   id: id,
                                                   pk: id,
                                                   updatedProperties: {
                                                       owningGroup: groupId,
                                                   },
                                               });
    }

    async update(application: PontifexApplication): Promise<void> {
        return await this.gremlinService.upsertVertex<PontifexApplication>({
                                                                               id: application.id,
                                                                               pk: application.id,
                                                                               defaultProperties: {
                                                                                   type: 'application',
                                                                                   creator: application.creator,
                                                                               },
                                                                               updatedProperties: {
                                                                                   name: application.name,
                                                                                   description: application.description,
                                                                               },
                                                                           });
    }

    async addUserOwnerAssociation(appId: string, ownerId: string): Promise<void> {
        const userToAppEdge = {
            label: 'owns',
            sourceVertexId: ownerId,
            sourceVertexPk: ownerId,
            destinationVertexId: appId,
            destinationVertexPk: appId,
        };

        const appToUserEdge = {
            label: 'owned by',
            sourceVertexId: appId,
            sourceVertexPk: appId,
            destinationVertexId: ownerId,
            destinationVertexPk: ownerId,
        };

        await this.gremlinService.upsertEdge(userToAppEdge);
        await this.gremlinService.upsertEdge(appToUserEdge);
    }

    async removeUserOwnerAssociation(appId: string, ownerId: string): Promise<void> {
        await this.gremlinService.dropEdge(`${ownerId}.${ownerId}-owns-${appId}.${appId}`);
        await this.gremlinService.dropEdge(`${appId}.${appId}-owned by-${ownerId}.${ownerId}`);
    }

    async getAuditEvents(appId: string): Promise<PontifexAuditEvent[]> {
        const query = `g.V(vid).repeat(out('contains', 'requests permission', 'has event')).until(has('type', 'audit-event')).dedup()`;
        const bindings = {vid: appId};

        const result = await this.gremlinService.submit(query, bindings);
        return result._items.map(PontifexAuditEventFromGremlin);
    }

    /**
     * Check if an identity (user or app) owns this application — directly, or via a group they own or belong to.
     */
    async isOwnedBy(appId: string, identityId: string): Promise<boolean> {
        const query = `g.V(vid)
            .union(
                fold().unfold(),
                out("owns").has("type", "group"),
                out("member of")
            )
            .out("owns").has("type", "application").hasId(appId)
            .limit(1)`;
        const result = await this.gremlinService.submit(query, {vid: identityId, appId});
        return result._items.length > 0;
    }

    async searchByPrefix(prefix: string): Promise<PontifexApplication[]> {
        const query = "g.V().has('type', 'application').has('name', TextP.startingWith(prefix))";
        const bindings = {prefix};

        const result = await this.gremlinService.submit(query, bindings);
        return result._items.map(PontifexApplicationFromGremlin);
    }
}