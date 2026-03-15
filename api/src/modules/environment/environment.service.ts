import {AppRole, PermissionScope} from "@microsoft/microsoft-graph-types";
import {forwardRef, Inject, Injectable} from "@nestjs/common";
import {v4 as uuid} from "uuid"
import {delay} from "../../common/utils/delay";
import {omit} from "../../common/utils/obj";
import {ApplicationUpdateRolesRequest} from "../application/dtos/application-update-roles-request.dto";
import {PontifexApplicationFromGremlin} from "../application/entities/application.entity";
import {AuditEventService} from "../audit-event/audit-event.service";
import {PontifexAuditEvent} from "../audit-event/entities/audit-event.entity";
import {GremlinService} from "../gremlin/gremlin.service";
import {PontifexPassword, PontifexPasswordFromGremlin} from "../password/entities/password.entity";
import {PasswordService} from "../password/password.service";
import {PontifexPermissionRequestFromGremlin} from "../permission-request/entities/permision-request.entity";
import {PermissionRequestService} from "../permission-request/permission-request.service";
import {PontifexAadService} from "../pontifex-aad/pontifex-aad.service";
import {PontifexARoleFromGremlin, PontifexRole, SensitiveAppRole} from "../role/entities/role.entity";
import {RoleService} from "../role/role.service";
import {PontifexScope, PontifexScopeFromGremlin} from "../scope/entities/scope.entity";
import {ScopeService} from "../scope/scope.service";
import {PontifexTokenGroupFromGremlin} from "../token-group/entities/token-group.entity";
import {
    PontifexEnvironment,
    PontifexEnvironmentBundle,
    PontifexEnvironmentFromGremlin
} from "./entities/environment.entity";

@Injectable()
export class EnvironmentService {
    constructor(private readonly gremlinService: GremlinService,
                private readonly passwordService: PasswordService,
                private readonly pontifexAadService: PontifexAadService,
                private readonly roleService: RoleService,
                private readonly scopeService: ScopeService,
                @Inject(forwardRef(
                    () => PermissionRequestService)) private permissionRequestService: PermissionRequestService,
                private readonly auditEventService: AuditEventService) {
    }

    async addApplicationAssociation(
        appId: string,
        environmentId: string
    ): Promise<void> {
        const appToEnvEdge = {
            destinationVertexId: environmentId,
            destinationVertexPk: environmentId,
            label: 'contains',
            sourceVertexId: appId,
            sourceVertexPk: appId,
        };

        const envToAppEdge = {
            destinationVertexId: appId,
            destinationVertexPk: appId,
            label: 'contained by',
            sourceVertexId: environmentId,
            sourceVertexPk: environmentId,
        };

        await this.gremlinService.upsertEdge(appToEnvEdge);
        await this.gremlinService.upsertEdge(envToAppEdge);
    }

    async addRoleAssociation(
        environmentId: string,
        roleId: string,
        edgeStatus: string
    ): Promise<void> {
        const envToRoleEdge = {
            destinationVertexId: roleId,
            destinationVertexPk: roleId,
            label: 'consumes',
            sourceVertexId: environmentId,
            sourceVertexPk: environmentId,
            properties: {
                status: edgeStatus,
            },
        };

        const roleToEnvEdge = {
            destinationVertexId: environmentId,
            destinationVertexPk: environmentId,
            label: 'consumed by',
            sourceVertexId: roleId,
            sourceVertexPk: roleId,
            properties: {
                status: edgeStatus,
            },
        };

        await this.gremlinService.upsertEdge(envToRoleEdge);
        await this.gremlinService.upsertEdge(roleToEnvEdge);
    }

    async addScopeAssociation(
        environmentId: string,
        scopeId: string,
        edgeStatus: string
    ): Promise<void> {
        const envToScopeEdge = {
            destinationVertexId: scopeId,
            destinationVertexPk: scopeId,
            label: 'consumes',
            sourceVertexId: environmentId,
            sourceVertexPk: environmentId,
            properties: {
                status: edgeStatus,
            },
        };

        const scopeToEnvEdge = {
            destinationVertexId: environmentId,
            destinationVertexPk: environmentId,
            label: 'consumed by',
            sourceVertexId: scopeId,
            sourceVertexPk: scopeId,
            properties: {
                status: edgeStatus,
            },
        };

        await this.gremlinService.upsertEdge(envToScopeEdge);
        await this.gremlinService.upsertEdge(scopeToEnvEdge);
    }

    async get(id: string): Promise<PontifexEnvironmentBundle> {
        if (!id) {
            throw new Error('id cannot be empty or undefined');
        }

        const {vertex, connections} = await this.gremlinService.getVertexAndChildren(id, id, 'environment');

        if (!vertex) {
            throw new Error('Environment not found');
        }
        
        return {
            environment: PontifexEnvironmentFromGremlin(vertex),
            application: PontifexApplicationFromGremlin(connections['contained by']!.application![0]),
            roles: connections['contains']?.role?.map(PontifexARoleFromGremlin) ?? [],
            scopes: connections['contains']?.scope?.map(PontifexScopeFromGremlin) ?? [],
            permissionRequests: connections['requests permission']?.permissionRequest?.map(
                PontifexPermissionRequestFromGremlin) ?? [],
            outboundPermissionRequests: connections['requests permission']?.permissionRequest?.map(
                PontifexPermissionRequestFromGremlin) ?? [],
            inboundPermissionRequests: connections['request source']?.permissionRequest?.map(
                PontifexPermissionRequestFromGremlin) ?? [],
            passwords: connections['has password']?.password?.map(PontifexPasswordFromGremlin) ?? [],
            tokenGroups: connections['has token group']?.tokenGroup?.map(PontifexTokenGroupFromGremlin) ?? [],
        };
    }

    async getAllForApplication(appId: string): Promise<PontifexEnvironment[]> {
        const query = 'g.V(vid).out("contains").has("type", "environment")';
        const bindings = {vid: appId};

        const result = await this.gremlinService.submit(query, bindings);
        return result._items.map(PontifexEnvironmentFromGremlin);
    }

    async update(environment: PontifexEnvironment): Promise<PontifexEnvironment> {
        const vertex = await this.gremlinService.upsertVertex<PontifexEnvironment>({
                                                                                       id: environment.id,
                                                                                       pk: environment.id,
                                                                                       defaultProperties: {
                                                                                           type: 'environment',
                                                                                           name: environment.name,
                                                                                           level: environment.level,
                                                                                           clientId: environment.clientId,
                                                                                       },
                                                                                       updatedProperties: {
                                                                                           spaRedirectUrls: environment.spaRedirectUrls?.join(
                                                                                               ',') || '',
                                                                                           webRedirectUrls: environment.webRedirectUrls?.join(
                                                                                               ',') || '',
                                                                                       },
                                                                                   });

        return PontifexEnvironmentFromGremlin(vertex);
    }

    async delete(id: string): Promise<void> {
        if (!id) {
            throw new Error('id cannot be empty or undefined');
        }

        await this.gremlinService.dropVertex(id, 'environment');
    }

    async addPassword(environmentId: string, password: PontifexPassword): Promise<void> {
        // Create password vertex
        await this.passwordService.create(password)

        // Create edges between environment and password
        const envToPasswordEdge = {
            destinationVertexId: password.id,
            destinationVertexPk: password.id,
            label: 'has password',
            sourceVertexId: environmentId,
            sourceVertexPk: environmentId,
        };

        const passwordToEnvEdge = {
            destinationVertexId: environmentId,
            destinationVertexPk: environmentId,
            label: 'is password for',
            sourceVertexId: password.id,
            sourceVertexPk: password.id,
        };

        await this.gremlinService.upsertEdge(envToPasswordEdge);
        await this.gremlinService.upsertEdge(passwordToEnvEdge);
    }

    async removePassword(passwordId: string): Promise<void> {
        await this.gremlinService.dropVertex(passwordId, 'password');
    }

    async getGroupedRoles(id: string): Promise<Record<string, PontifexRole[]>> {
        const query = `
      g.V(vid).out('requests permission').out('request target').has('type', 'role').group().by(out('contained by').values('id'))
    `;
        const bindings = {vid: id};

        const result = await this.gremlinService.submit(query, bindings);
        const results = result._items[0];

        const envIdToRoles: Record<string, PontifexRole[]> = {};

        for (const key of Object.keys(results)) {
            envIdToRoles[key] = Array.isArray(results[key])
                ? results[key].map(PontifexARoleFromGremlin)
                : [PontifexARoleFromGremlin(results[key])];
        }

        return envIdToRoles;
    }

    async getGroupedScopes(id: string): Promise<Record<string, PontifexScope[]>> {
        const query = `
      g.V(vid).out('requests permission').out('request target').has('type', 'scope').group().by(out('contained by').values('id'))
    `;
        const bindings = {vid: id};

        const result = await this.gremlinService.submit(query, bindings);
        const results = result._items[0];

        const envIdToScopes: Record<string, PontifexScope[]> = {};

        for (const key of Object.keys(results)) {
            envIdToScopes[key] = Array.isArray(results[key])
                ? results[key].map(PontifexScopeFromGremlin)
                : [PontifexScopeFromGremlin(results[key])];
        }

        return envIdToScopes;
    }

    private async updateAppRolesWithRetry(id: string, appRoles: AppRole[], maxAttempts = 10, intervalMs = 3000) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await this.pontifexAadService.Instance.application.update(id, {appRoles});
            } catch (error) {
                const isNotPropagated = error?.code === 'CannotDeleteOrUpdateEnabledEntitlement'
                    || error?.body?.includes?.('CannotDeleteOrUpdateEnabledEntitlement');
                if (isNotPropagated && attempt < maxAttempts) {
                    console.log(`AAD role update not yet propagated (attempt ${attempt}/${maxAttempts}), retrying in ${intervalMs}ms...`);
                    await delay(intervalMs);
                    continue;
                }
                throw error;
            }
        }
    }

    async removeRoles(id: string, existingAppRoles: SensitiveAppRole[], rolesToRemove: AppRole[]) {
        const appRoles: AppRole[] = []

        for (const role of rolesToRemove) {
            const prs = await this.roleService.getPermissionRequests(role.id!)
            for (const pr of prs) {
                await this.permissionRequestService.delete(pr.id)
            }
        }

        existingAppRoles.forEach(role => {
            if (rolesToRemove.some(r => r.value === role.value)) {
                appRoles.push({
                                  ...omit(role, "sensitive"),
                                  isEnabled: false
                              })
            } else {
                appRoles.push({
                                  ...omit(role, 'sensitive')
                              })
            }
        })

        // first disable the roles to remove
        await this.updateAppRolesWithRetry(id, appRoles)

        // then remove them from AAD
        const filteredRoles = appRoles.filter(role => !rolesToRemove.some(r => r.value === role.value));
        await this.updateAppRolesWithRetry(id, filteredRoles)

        // then remove them from cosmosdb
        rolesToRemove.forEach(role => this.roleService.delete(role.id!))
    }

    async syncRoles(id: any, roles: SensitiveAppRole[]) {
        const strippedRoles = roles.map<PontifexRole>((role) => {
            return {
                id: role.id,
                name: role.displayName,
                sensitive: role.sensitive,
                description: role.description ?? "",
            } as PontifexRole;
        });
        for (const role of strippedRoles) {
            await this.roleService.update(role);
            await this.roleService.addApplicationAssociation(role, id);
        }
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
            await this.scopeService.update(scope);
            await this.scopeService.addApplicationAssociation(scope, id);
        }
    }

    async updateEnvironmentRoles(id: string, request: ApplicationUpdateRolesRequest) {
        console.log(`Updating roles for environment ${id} with request:`, request)
        const environmentAppRegistration = await this.pontifexAadService.Instance.application.get(id)

        const newAppRoles: SensitiveAppRole[] = request.roles.map(role => ({
            allowedMemberTypes: ["Application"],
            description: role.description ?? "",
            displayName: role.displayName,
            id: uuid(),
            value: role.claimValue,
            sensitive: role.sensitive ?? false
        }))
        console.log("New app roles to add:", newAppRoles)

        const existingAppRoles = environmentAppRegistration.appRoles as SensitiveAppRole[] ?? []
        console.log("Existing app roles:", existingAppRoles)

        for (const role of existingAppRoles) {
            if (role.allowedMemberTypes![0] === "User") {
                continue
            }

            const bundle = await this.roleService.get(role.id!)
            role.sensitive = bundle.role.sensitive ?? false
        }

        const rolesToAdd = newAppRoles.filter(role => !existingAppRoles.some(r => r.displayName === role.displayName))
        const rolesToRemove = existingAppRoles.filter(
            role => role.allowedMemberTypes![0] !== "User" && !newAppRoles.some(
                r => r.displayName === role.displayName))
        const rolesToUpdate = existingAppRoles.filter(
            role => role.allowedMemberTypes![0] !== "User" && newAppRoles.some(
                r => r.displayName === role.displayName && (r.sensitive !== role.sensitive || r.description !== role.description)))
        const userRolesToKeep = existingAppRoles.filter(role => role.allowedMemberTypes![0] === "User")
        console.log("Roles to add:", rolesToAdd.map(role => role.displayName).join(','))
        console.log("Roles to remove:", rolesToRemove.map(role => role.displayName).join(','))
        console.log("Roles to update:", rolesToUpdate.map(role => role.displayName).join(','))
        console.log("User roles to keep:", userRolesToKeep.map(role => role.displayName).join(','))

        // remove roles that aren't present anymore
        if (rolesToRemove.length > 0) {
            await this.removeRoles(id, existingAppRoles, rolesToRemove)
        }

        const updatedAppRoles = existingAppRoles.filter(role => !rolesToRemove.includes(role)).concat(rolesToAdd)
        console.log(`Updating app roles to be: ${updatedAppRoles.map(role => role.displayName).join(',')}`)

        if (rolesToAdd.length > 0) {
            const mappedRoles = updatedAppRoles.map(role => {
                const isNew = rolesToAdd.includes(role)
                if (isNew) {
                    return {
                        ...omit(role, "sensitive"),
                        description: role.description ? role.description : `role to call ${role.displayName}`,
                    }
                }
                // Existing roles must be sent unchanged to avoid CannotDeleteOrUpdateEnabledEntitlement
                return omit(role, "sensitive")
            })
            await this.updateAppRolesWithRetry(id, mappedRoles as AppRole[])
            await this.syncRoles(id, rolesToAdd)
        }

        if (rolesToUpdate.length > 0) {
            for (const role of rolesToUpdate) {
                const newRole = newAppRoles.find(r => r.displayName === role.displayName)!

                const newPontifexRole = {
                    id: role.id, // the newAppRole id is a new uuid, so we need to use the existing id
                    name: newRole.displayName,
                    sensitive: newRole.sensitive,
                    description: newRole.description ?? ""
                } as PontifexRole
                await this.roleService.update(newPontifexRole)
            }
        }

        const event: PontifexAuditEvent = {
            action: 'UPDATE_APPLICATION_ROLES',
            value: JSON.stringify(request.roles),
            // associatedUserId: context.jwtToken.oid as string, TODO: investigate if making this provider request scoped is worth it
            targetResourceId: id
        }
        await this.auditEventService.publishEvent(event)
    }
}