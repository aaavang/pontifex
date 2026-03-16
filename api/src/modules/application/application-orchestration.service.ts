import {AppRole} from "@microsoft/microsoft-graph-types";
import {Injectable} from "@nestjs/common";
import {v4 as uuid} from "uuid";
import {InvalidStateException} from "../../common/exceptions/invalid-state.exception";
import {delay} from "../../common/utils/delay";
import {omit} from "../../common/utils/obj";
import {AuditEventService} from "../audit-event/audit-event.service";
import {PontifexAuditEvent} from "../audit-event/entities/audit-event.entity";
import {EnvironmentService} from "../environment/environment.service";
import {GremlinService} from "../gremlin/gremlin.service";
import {PasswordService} from "../password/password.service";
import {PermissionRequestService} from "../permission-request/permission-request.service";
import {PontifexAadService} from "../pontifex-aad/pontifex-aad.service";
import {PontifexRole, SensitiveAppRole} from "../role/entities/role.entity";
import {RoleService} from "../role/role.service";
import {ScopeService} from "../scope/scope.service";
import {ApplicationService} from "./application.service";
import {ApplicationUpdateRolesRequest} from "./dtos/application-update-roles-request.dto";

@Injectable()
export class ApplicationOrchestrationService {
    constructor(
        private readonly applicationService: ApplicationService,
        private readonly environmentService: EnvironmentService,
        private readonly permissionRequestService: PermissionRequestService,
        private readonly passwordService: PasswordService,
        private readonly pontifexAadService: PontifexAadService,
        private readonly roleService: RoleService,
        private readonly scopeService: ScopeService,
        private readonly gremlinService: GremlinService,
        private readonly auditEventService: AuditEventService,
    ) {
    }

    async deleteApplication(id: string): Promise<void> {
        if (!id) {
            throw new Error('id cannot be empty or undefined');
        }

        const app = await this.applicationService.get(id);

        for (const env of app.environments) {
            const environment = await this.environmentService.get(env.id)

            const numberOfApprovedPrs = environment.inboundPermissionRequests.filter(
                pr => pr.status === "APPROVED").length;
            if (numberOfApprovedPrs > 0) {
                throw new InvalidStateException(
                    `Cannot delete application with environments with approved permission requests.  There are ${numberOfApprovedPrs} PRs in '${environment.environment.name}' that need to be rejected first.`)
            }
        }

        // delete each environment
        for (const env of app.environments) {
            const environment = await this.environmentService.get(env.id)

            // Clean up AAD resources — tolerate 404s since the AAD app may already be gone
            try {
                await this.pontifexAadService.Instance.application.get(env.id)

                // wipe out required resource access (outbound prs)
                console.log('updating required resource access to empty', env.id)
                await this.pontifexAadService.Instance.application.update(env.id, {
                    requiredResourceAccess: []
                })
                console.log('required resource access updated to empty', env.id)
            } catch (error) {
                if (error?.statusCode === 404) {
                    console.log(`AAD application ${env.id} already deleted, skipping AAD cleanup`)
                } else {
                    throw error
                }
            }

            // delete each prs
            console.log('deleting outbound permission requests', env.id)
            for (const pr of environment.outboundPermissionRequests) {
                console.log('deleting outbound permission request', pr.id)
                await this.permissionRequestService.delete(pr.id)
            }
            console.log('outbound permission requests deleted', env.id)

            // reject each inbound pr
            console.log('deleting inbound permission requests', env.id)
            for (const pr of environment.inboundPermissionRequests) {
                console.log('rejecting inbound permission request', pr.id)
                await this.permissionRequestService.updateStatus(pr.id, "REJECTED")
                console.log('deleting inbound permission request', pr.id)
                await this.permissionRequestService.delete(pr.id)
            }
            console.log('inbound permission requests deleted', env.id)

            console.log('deleting passwords', env.id)
            for (const pw of environment.passwords) {
                console.log('deleting password', pw.id)
                await this.passwordService.delete(pw.id)
            }
            console.log('passwords deleted', env.id)

            console.log('deleting aad application (environment)', env.id)
            try {
                await this.pontifexAadService.Instance.application.delete(env.id)
                console.log('aad application (environment) deleted', env.id)
            } catch (error) {
                if (error?.statusCode === 404) {
                    console.log(`AAD application ${env.id} already deleted, skipping`)
                } else {
                    throw error
                }
            }

            console.log('deleting environment', env.id)
            await this.environmentService.delete(env.id)
            console.log('environment deleted', env.id)
        }

        console.log('deleting application', id)
        await this.gremlinService.dropVertex(id, 'application');
        console.log('application deleted', id)
    }

    async updateApplicationRoles(applicationId: string, body: ApplicationUpdateRolesRequest): Promise<void> {
        const pontifexApp = await this.applicationService.get(applicationId);

        // First pass: validate that no roles with approved permission requests are being removed
        for (const env of pontifexApp.environments ?? []) {
            const environmentAppRegistration = await this.pontifexAadService.Instance.application.get(env.id);
            const newAppRoles: SensitiveAppRole[] = body.roles.map(role => ({
                allowedMemberTypes: ["Application"],
                description: role.description ?? "",
                displayName: role.displayName,
                id: uuid(),
                value: role.claimValue,
                sensitive: role.sensitive ?? false
            }));

            const existingAppRoles = environmentAppRegistration.appRoles as SensitiveAppRole[] ?? [];

            const rolesToRemove = existingAppRoles.filter(
                role => role.allowedMemberTypes![0] !== "User" && !newAppRoles.some(
                    r => r.displayName === role.displayName));

            for (const role of rolesToRemove) {
                const prs = await this.roleService.getPermissionRequests(role.id!);
                if (prs.some(pr => pr.status === "APPROVED")) {
                    throw new InvalidStateException(
                        `cannot remove role '${role.value}' because it has approved permission requests.  You must first reject all approved requests for this role, or have the client withdraw them.`);
                }
            }
        }

        // Second pass: apply the role updates to each environment (with PR cleanup)
        for (const env of pontifexApp.environments ?? []) {
            await this.updateEnvironmentRoles(env.id, body);
        }
    }

    async removeRolesWithCleanup(id: string, existingAppRoles: SensitiveAppRole[], rolesToRemove: AppRole[]): Promise<void> {
        // Clean up permission requests for roles being removed
        for (const role of rolesToRemove) {
            const prs = await this.roleService.getPermissionRequests(role.id!)
            for (const pr of prs) {
                await this.permissionRequestService.delete(pr.id)
            }
        }

        // Delegate the AAD and Gremlin role removal to EnvironmentService
        await this.environmentService.removeRoles(id, existingAppRoles, rolesToRemove)
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
            await this.removeRolesWithCleanup(id, existingAppRoles, rolesToRemove)
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
            await this.environmentService.syncRoles(id, rolesToAdd)
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
}
