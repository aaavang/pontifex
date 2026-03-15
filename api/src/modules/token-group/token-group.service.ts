import {Injectable} from "@nestjs/common";
import {AppRole} from "@microsoft/microsoft-graph-types";
import {v4 as uuid} from "uuid";
import {GremlinService} from "../gremlin/gremlin.service";
import {PontifexAadService} from "../pontifex-aad/pontifex-aad.service";
import {PontifexTokenGroup, PontifexTokenGroupFromGremlin} from "./entities/token-group.entity";

export interface CreateTokenGroupDto {
    name: string;
    claimValue: string;
    groupId: string;
    description?: string;
}

@Injectable()
export class TokenGroupService {
    constructor(
        private readonly gremlinService: GremlinService,
        private readonly pontifexAadService: PontifexAadService,
    ) {}

    async create(environmentId: string, clientId: string, dto: CreateTokenGroupDto): Promise<PontifexTokenGroup> {
        const aad = this.pontifexAadService.Instance;

        // Look up the AAD app registration and service principal by clientId
        const appRegistration = await aad.application.getByAppId(clientId);
        if (!appRegistration) {
            throw new Error(`AAD application not found for clientId: ${clientId}`);
        }

        const servicePrincipal = await aad.servicePrincipal.getByAppId(clientId);

        // Ensure the app role exists for this claimValue
        const existingRoles: AppRole[] = appRegistration.appRoles ?? [];
        let appRole = existingRoles.find(r => r.value === dto.claimValue);

        if (!appRole) {
            appRole = {
                allowedMemberTypes: ['Application', 'User'],
                description: dto.description || `Role for ${dto.claimValue}`,
                displayName: dto.name,
                id: uuid(),
                isEnabled: true,
                value: dto.claimValue,
            };
            await aad.application.update(appRegistration.id!, {
                appRoles: [...existingRoles, appRole],
            });
        }

        // Assign the group to the app role on the service principal
        const assignment = await aad.group.addAppRoleAssignment(
            dto.groupId,
            servicePrincipal.id!,
            appRole.id!,
        );

        // Create the token group vertex in Gremlin
        const tokenGroupId = uuid();
        const vertex = await this.gremlinService.upsertVertex<PontifexTokenGroup>({
            id: tokenGroupId,
            pk: tokenGroupId,
            defaultProperties: {
                type: 'tokenGroup',
                name: dto.name,
                envId: environmentId,
                groupId: dto.groupId,
                claimValue: dto.claimValue,
                description: dto.description ?? '',
                appRoleId: appRole.id!,
                appRoleAssignmentId: assignment.id!,
            },
        });

        // Wire environment <-> token group edges
        await this.gremlinService.upsertEdge({
            label: 'has token group',
            sourceVertexId: environmentId,
            sourceVertexPk: environmentId,
            destinationVertexId: tokenGroupId,
            destinationVertexPk: tokenGroupId,
        });
        await this.gremlinService.upsertEdge({
            label: 'is user token group for',
            sourceVertexId: tokenGroupId,
            sourceVertexPk: tokenGroupId,
            destinationVertexId: environmentId,
            destinationVertexPk: environmentId,
        });

        return PontifexTokenGroupFromGremlin(vertex);
    }

    async createWithKnownIds(
        tokenGroupId: string,
        environmentId: string,
        clientId: string,
        dto: CreateTokenGroupDto,
    ): Promise<void> {
        const aad = this.pontifexAadService.Instance;

        const appRegistration = await aad.application.getByAppId(clientId);
        if (!appRegistration) {
            throw new Error(`AAD application not found for clientId: ${clientId}`);
        }

        const servicePrincipal = await aad.servicePrincipal.getByAppId(clientId);

        const existingRoles: AppRole[] = appRegistration.appRoles ?? [];
        let appRole = existingRoles.find(r => r.value === dto.claimValue);

        if (!appRole) {
            appRole = {
                allowedMemberTypes: ['Application', 'User'],
                description: dto.description || `Role for ${dto.claimValue}`,
                displayName: dto.name,
                id: uuid(),
                isEnabled: true,
                value: dto.claimValue,
            };
            await aad.application.update(appRegistration.id!, {
                appRoles: [...existingRoles, appRole],
            });
        }

        let assignmentId = '';
        try {
            const assignment = await aad.group.addAppRoleAssignment(
                dto.groupId,
                servicePrincipal.id!,
                appRole.id!,
            );
            assignmentId = assignment.id!;
        } catch (error) {
            // Tolerate "Permission being assigned already exists" for idempotent bootstrap
            if (error?.body?.includes?.('already exists') || error?.message?.includes?.('already exists')) {
                assignmentId = '';
            } else {
                throw error;
            }
        }

        await this.gremlinService.upsertVertex<{ type: string; name: string; envId: string; groupId: string; claimValue: string; description: string; appRoleId: string; appRoleAssignmentId: string }>({
            id: tokenGroupId,
            pk: tokenGroupId,
            defaultProperties: {
                type: 'tokenGroup',
                name: dto.name,
                envId: environmentId,
                groupId: dto.groupId,
                claimValue: dto.claimValue,
                description: dto.description ?? '',
            },
            updatedProperties: {
                appRoleId: appRole.id!,
                ...(assignmentId ? {appRoleAssignmentId: assignmentId} : {}),
            },
        });

        await this.gremlinService.upsertEdge({
            label: 'has token group',
            sourceVertexId: environmentId,
            sourceVertexPk: environmentId,
            destinationVertexId: tokenGroupId,
            destinationVertexPk: tokenGroupId,
        });
        await this.gremlinService.upsertEdge({
            label: 'is user token group for',
            sourceVertexId: tokenGroupId,
            sourceVertexPk: tokenGroupId,
            destinationVertexId: environmentId,
            destinationVertexPk: environmentId,
        });
    }
}
