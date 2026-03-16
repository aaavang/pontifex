import {Injectable, Logger} from "@nestjs/common";
import {ResourceNotFoundException} from "../../common/exceptions/resource-not-found.exception";
import {PontifexApplicationFromGremlin} from "../application/entities/application.entity";
import {GremlinService} from "../gremlin/gremlin.service";
import {PontifexAadService} from "../pontifex-aad/pontifex-aad.service";
import {PontifexUserFromGremlin} from "../user/entities/user.entity";
import {PontifexGroup, PontifexGroupBundle, PontifexGroupFromGremlin} from "./entities/group.entity";

export interface GroupSyncResult {
    membersAdded: string[];
    membersRemoved: string[];
    ownersAdded: string[];
    ownersRemoved: string[];
}

@Injectable()
export class GroupService {
    private readonly logger = new Logger(GroupService.name);

    constructor(
        private readonly gremlinService: GremlinService,
        private readonly pontifexAadService: PontifexAadService,
    ) {}

    async create(name: string, creatorId: string): Promise<PontifexGroup> {
        // Create the group in Azure AD
        const aadGroup = await this.pontifexAadService.Instance.group.create(name);

        // Create the group vertex in Gremlin
        const group = await this.ensureVertex(aadGroup.id!, aadGroup.displayName!);

        // Set the creator as owner
        await this.addOwner(aadGroup.id!, creatorId);

        return group;
    }

    async ensureGroup(name: string, description?: string): Promise<{ group: PontifexGroup; aadGroupId: string }> {
        const aad = this.pontifexAadService.Instance;

        let aadGroup = await aad.group.getByDisplayName(name);

        if (!aadGroup) {
            this.logger.log(`Creating ${name} group in Azure AD`);
            aadGroup = await aad.group.create(name, description);
            this.logger.log(`Created ${name} group with id ${aadGroup.id}`);
        } else {
            this.logger.log(`${name} group already exists in Azure AD (${aadGroup.id})`);
        }

        const group = await this.ensureVertex(aadGroup.id!, aadGroup.displayName!);

        return {group, aadGroupId: aadGroup.id!};
    }

    async ensureVertex(aadGroupId: string, displayName: string): Promise<PontifexGroup> {
        await this.gremlinService.upsertVertex<PontifexGroup>({
            id: aadGroupId,
            pk: aadGroupId,
            defaultProperties: {
                type: 'group',
            },
            updatedProperties: {
                name: displayName,
                normalizedName: displayName.toLowerCase(),
            },
        });

        return {
            id: aadGroupId,
            name: displayName,
            normalizedName: displayName.toLowerCase(),
        };
    }

    async get(id: string): Promise<PontifexGroupBundle> {
        const {vertex, connections} = await this.gremlinService.getVertexAndChildren(id, id, 'group');

        if (!vertex) {
            throw new ResourceNotFoundException('Group');
        }

        return {
            group: PontifexGroupFromGremlin(vertex),
            owners: connections?.['owned by']?.user?.map(PontifexUserFromGremlin) ?? [],
            members: connections?.['has member']?.user?.map(PontifexUserFromGremlin) ?? [],
            ownedApplications: connections?.['owns']?.application?.map(PontifexApplicationFromGremlin) ?? [],
        };
    }

    async delete(id: string): Promise<void> {
        await this.gremlinService.dropVertex(id, 'group');
    }

    async addOwner(groupId: string, userId: string): Promise<void> {
        await this.gremlinService.upsertEdge({
            label: 'owns',
            sourceVertexId: userId,
            sourceVertexPk: userId,
            destinationVertexId: groupId,
            destinationVertexPk: groupId,
        });
        await this.gremlinService.upsertEdge({
            label: 'owned by',
            sourceVertexId: groupId,
            sourceVertexPk: groupId,
            destinationVertexId: userId,
            destinationVertexPk: userId,
        });
    }

    async removeOwner(groupId: string, userId: string): Promise<void> {
        await this.gremlinService.dropEdge(`${userId}.${userId}-owns-${groupId}.${groupId}`);
        await this.gremlinService.dropEdge(`${groupId}.${groupId}-owned by-${userId}.${userId}`);
    }

    async addMember(groupId: string, userId: string): Promise<void> {
        await this.gremlinService.upsertEdge({
            label: 'member of',
            sourceVertexId: userId,
            sourceVertexPk: userId,
            destinationVertexId: groupId,
            destinationVertexPk: groupId,
        });
        await this.gremlinService.upsertEdge({
            label: 'has member',
            sourceVertexId: groupId,
            sourceVertexPk: groupId,
            destinationVertexId: userId,
            destinationVertexPk: userId,
        });
    }

    async removeMember(groupId: string, userId: string): Promise<void> {
        await this.gremlinService.dropEdge(`${userId}.${userId}-member of-${groupId}.${groupId}`);
        await this.gremlinService.dropEdge(`${groupId}.${groupId}-has member-${userId}.${userId}`);
    }

    async searchByPrefix(prefix: string): Promise<PontifexGroup[]> {
        const query = "g.V().has('type', 'group').has('normalizedName', TextP.startingWith(prefix))";
        const bindings = {prefix: prefix.toLowerCase()};

        const result = await this.gremlinService.submit(query, bindings);
        return result._items.map(PontifexGroupFromGremlin);
    }

    async sync(groupId: string): Promise<GroupSyncResult> {
        const aad = this.pontifexAadService.Instance;

        // Fetch current state from AAD
        const [aadMembers, aadOwners] = await Promise.all([
            aad.group.getMembers(groupId),
            aad.group.getOwners(groupId),
        ]);

        const aadMemberIds = new Set(aadMembers.map(m => m.id!));
        const aadOwnerIds = new Set(aadOwners.map(o => o.id!));

        // Fetch current state from Gremlin
        const bundle = await this.get(groupId);
        const gremlinMemberIds = new Set(bundle.members.map(m => m.id));
        const gremlinOwnerIds = new Set(bundle.owners.map(o => o.id));

        const result: GroupSyncResult = {
            membersAdded: [],
            membersRemoved: [],
            ownersAdded: [],
            ownersRemoved: [],
        };

        // Sync members: add new, remove stale
        for (const id of aadMemberIds) {
            if (!gremlinMemberIds.has(id)) {
                await this.addMember(groupId, id);
                result.membersAdded.push(id);
            }
        }
        for (const id of gremlinMemberIds) {
            if (!aadMemberIds.has(id)) {
                await this.removeMember(groupId, id);
                result.membersRemoved.push(id);
            }
        }

        // Sync owners: add new, remove stale
        for (const id of aadOwnerIds) {
            if (!gremlinOwnerIds.has(id)) {
                await this.addOwner(groupId, id);
                result.ownersAdded.push(id);
            }
        }
        for (const id of gremlinOwnerIds) {
            if (!aadOwnerIds.has(id)) {
                await this.removeOwner(groupId, id);
                result.ownersRemoved.push(id);
            }
        }

        this.logger.log(
            `Synced group ${groupId}: ` +
            `members +${result.membersAdded.length}/-${result.membersRemoved.length}, ` +
            `owners +${result.ownersAdded.length}/-${result.ownersRemoved.length}`,
        );

        return result;
    }
}
