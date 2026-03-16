import {Application, PermissionScope, RequiredResourceAccess, ServicePrincipal} from "@microsoft/microsoft-graph-types";
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Put,
    Query,
    Req,
    UseGuards
} from "@nestjs/common";
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from '@nestjs/swagger';
import {v4 as uuid} from "uuid"
import {RequireResourceOwner} from "../../common/decorators/resource-owner.decorator";
import {InvalidStateException} from "../../common/exceptions/invalid-state.exception";
import {ResourceOwnerGuard} from "../../common/guards/resource-owner.guard";
import {PontifexIdentity} from "../../common/types/identity";
import {omit} from "../../common/utils/obj";
import {CreateEnvironmentDto, PontifexEnvironment} from "../environment/entities/environment.entity";
import {EnvironmentService} from "../environment/environment.service";
import {PontifexAadService} from "../pontifex-aad/pontifex-aad.service";
import {PontifexRole, SensitiveAppRole} from "../role/entities/role.entity";
import {RoleService} from "../role/role.service";
import {PontifexScope} from "../scope/entities/scope.entity";
import {ScopeService} from "../scope/scope.service";
import {PONTIFEX_MANAGED_TAG} from "../system-settings/entities/pontifex-app-setting.entity";
import {ApplicationService} from "./application.service";
import {CreateApplicationRequest} from "./dtos/application-create-request.dto";
import {UpdateApplicationRequest} from "./dtos/application-update-request.dto";
import {ApplicationUpdateRolesRequest} from "./dtos/application-update-roles-request.dto";
import {ApplicationUpdateScopesRequest} from "./dtos/application-update-scopes-request.dto";
import {PontifexApplication} from "./entities/application.entity";
import {delay} from "../../common/utils/delay";

@ApiTags('applications')
@Controller('applications')
@UseGuards(ResourceOwnerGuard) // TODO: add auth guard
@ApiBearerAuth()
export class ApplicationController {
    constructor(private readonly applicationService: ApplicationService,
                private readonly environmentService: EnvironmentService,
                private readonly roleService: RoleService,
                private readonly scopeService: ScopeService,
                private readonly pontifexAadService: PontifexAadService) {
    }

    private async createServicePrincipalWithRetry(appId: string, maxAttempts = 10, intervalMs = 2000): Promise<ServicePrincipal> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await this.pontifexAadService.Instance.servicePrincipal.create(appId);
            } catch (error) {
                const isNotPropagated = error?.body?.includes?.('NoBackingApplicationObject')
                    || error?.message?.includes?.('does not reference a valid application object');
                if (isNotPropagated && attempt < maxAttempts) {
                    console.log(`AAD app not yet propagated for SP creation (attempt ${attempt}/${maxAttempts}), retrying in ${intervalMs}ms...`);
                    await delay(intervalMs);
                    continue;
                }
                throw error;
            }
        }
        throw new Error(`Failed to create service principal for ${appId} after ${maxAttempts} attempts`);
    }

    @Get()
    @ApiOperation({summary: 'Get all applications'})
    @ApiResponse({status: 200, description: 'Returns all applications the user has access to'})
    async getApplications(@Req() req: any) {
        const apps = await this.applicationService.getAll();

        return {
            applications: apps
        };
    }

    @Get('search')
    @ApiOperation({summary: 'Search applications by prefix'})
    @ApiResponse({status: 200, description: 'Returns applications matching the prefix'})
    async searchApplications(@Query('prefix') prefix: string) {
        const apps = await this.applicationService.searchByPrefix(prefix);
        return {applications: apps};
    }

    @Get('owned')
    @ApiOperation({summary: 'Get applications owned by the current user'})
    @ApiResponse({status: 200, description: 'Returns applications owned by the current user'})
    async getOwnedApplications(@Req() req) {
        const apps = await this.applicationService.getAllByUser(req.user.id);
        return {applications: apps};
    }

    @Get(':id')
    @ApiOperation({summary: 'Get application by ID'})
    @ApiResponse({status: 200, description: 'Returns the application'})
    @ApiResponse({status: 404, description: 'Application not found'})
    async getApplicationById(@Param('id') id: string) {
        return await this.applicationService.get(id);
    }

    @Get(':id/audit-events')
    @RequireResourceOwner({resourceType: 'APPLICATION', queryParameterKey: 'id'})
    @ApiOperation({summary: 'Get audit events for an application'})
    @ApiResponse({status: 200, description: 'Returns audit events for the application'})
    @ApiResponse({status: 404, description: 'Application not found'})
    async getApplicationAuditEvents(@Param('id') id: string) {
        const events = await this.applicationService.getAuditEvents(id);
        return {events};
    }

    @Get(':id/audit')
    @RequireResourceOwner({resourceType: 'APPLICATION', queryParameterKey: 'id'})
    @ApiOperation({summary: 'Get audit events for an application'})
    @ApiResponse({status: 200, description: 'Returns audit events for the application'})
    @ApiResponse({status: 404, description: 'Application not found'})
    async getApplicationAudit(@Param('id') id: string) {
        const events = await this.applicationService.getAuditEvents(id);
        return {events};
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Create a new application'})
    @ApiResponse({status: 201, description: 'Application created successfully'})
    async createApplication(@Body() body: CreateApplicationRequest, @Req() req) {
        const identity = req.user as PontifexIdentity;

        // Add creator information
        const pontifexApp = {
            creator: identity.id,
            id: uuid(),
            name: body.applicationName,
            loginEnabled: true,
            description: body.description ?? "",
        } as PontifexApplication

        // Create the application
        await this.applicationService.update(pontifexApp);

        // Add the creator as an owner
        await this.applicationService.addUserOwnerAssociation(pontifexApp.id, identity.id);

        const userReadRequiredResourceAccess: RequiredResourceAccess = {
            resourceAppId: "00000003-0000-0000-c000-000000000000",
            resourceAccess: [
                {id: "e1fe6dd8-ba31-4d61-89e7-88639da4683d", type: "Scope"}
            ]
        }

        for (const environment of body.environments) {
            const newApp: Application = {
                displayName: `${body.applicationName}-${environment}`,
                tags: [PONTIFEX_MANAGED_TAG],
                notes: JSON.stringify({pontifexAppId: pontifexApp.id, pontifexAppName: pontifexApp.name}),
                api: {
                    requestedAccessTokenVersion: 2 // tell AAD to use v2 OAuth2 tokens
                },
                requiredResourceAccess: [userReadRequiredResourceAccess]
            };

            console.log("Creating AAD application:", newApp.displayName);
            const application = await this.pontifexAadService.Instance.application.create(newApp)

            console.log("Creating service principal for application:", application.appId);
            const principal = await this.createServicePrincipalWithRetry(application.appId!)

            // TODO: Figure out how to properly grant User.Read
            // console.log("Granting User.Read permission to service principal:", principal.id);
            // await this.pontifexAadService.Instance.oauth2.grantPermission(principal.id!,
            //                                                               'cb8c853a-b547-4797-9529-07971ecab8a9',
            //                                                               "User.Read")
            const pontifexEnvironment: PontifexEnvironment = {
                id: application.id!,
                name: application.displayName!,
                level: environment,
                clientId: application.appId!,
                spaRedirectUrls: [],
                webRedirectUrls: []
            }

            console.log("Creating Pontifex environment record for environment:", pontifexEnvironment.name);
            const env = await this.environmentService.update(pontifexEnvironment)

            console.log("Associating environment with Pontifex application:", pontifexApp.name);
            await this.environmentService.addApplicationAssociation(pontifexApp.id, env.id)
        }

        return pontifexApp;
    }

    @Patch(':id')
    @RequireResourceOwner({resourceType: 'APPLICATION', queryParameterKey: 'id'})
    @ApiOperation({summary: 'Update an application'})
    @ApiResponse({status: 200, description: 'Application updated successfully'})
    @ApiResponse({status: 404, description: 'Application not found'})
    async updateApplication(@Param('id') id: string, @Body() body: UpdateApplicationRequest) {
        const appBundle = await this.applicationService.get(id);

        const envsToAdd = body.environments.filter(
            (env) => !appBundle.environments?.some((env2) => env2.level === env)
        );
        const envsToDestroy = appBundle.environments?.filter(
            (env) => !body.environments.some((env2) => env2 === env.level)
        ) ?? [];

        let scopesToAdd: Record<string, PontifexScope> = {};
        let rolesToAdd: Record<string, PontifexRole> = {};
        for (const envId of appBundle.environments ?? []) {
            const env = await this.environmentService.get(envId.id);
            for (const envScope of env.scopes) {
                scopesToAdd[envScope.name] = envScope;
            }

            for (const envRole of env.roles) {
                rolesToAdd[envRole.name] = envRole;
            }
        }

        const userReadRequiredResourceAccess: RequiredResourceAccess = {
            resourceAppId: "00000003-0000-0000-c000-000000000000",
            resourceAccess: [
                {id: "e1fe6dd8-ba31-4d61-89e7-88639da4683d", type: "Scope"},
            ],
        };

        for (const environment of envsToAdd) {
            const application = await this.pontifexAadService.Instance.application.create({
                                                                                              displayName: `${appBundle.application.name}-${environment}`,
                                                                                              tags: [PONTIFEX_MANAGED_TAG],
                                                                                              notes: JSON.stringify({pontifexAppId: appBundle.application.id, pontifexAppName: appBundle.application.name}),
                                                                                              api: {
                                                                                                  requestedAccessTokenVersion: 2, // tell AAD to use v2 OAuth2 tokens
                                                                                              },
                                                                                              requiredResourceAccess: [userReadRequiredResourceAccess],
                                                                                          });

            const principal = await this.createServicePrincipalWithRetry(application.appId!);
            await this.pontifexAadService.Instance.oauth2.grantPermission(
                principal.id!,
                "cb8c853a-b547-4797-9529-07971ecab8a9",
                "User.Read"
            );

            const pontifexEnvironment: PontifexEnvironment = {
                id: application.id!,
                name: application.displayName!,
                level: environment,
                clientId: application.appId!,
                spaRedirectUrls: [],
                webRedirectUrls: [],
            };
            const env = await this.environmentService.update(pontifexEnvironment);
            await this.environmentService.addApplicationAssociation(
                appBundle.application.id,
                env.id
            );

            const scopes: PermissionScope[] = Array.from(Object.values(scopesToAdd)).map(
                (scope) =>
                    ({
                        type: "User",
                        id: uuid(),
                        adminConsentDisplayName: scope.displayName,
                        adminConsentDescription: scope.description,
                        userConsentDisplayName: scope.displayName,
                        userConsentDescription: scope.description,
                        value: scope.name,
                        isEnabled: true,
                    } as PermissionScope)
            );
            if (scopes.length > 0) {
                const identifierUris =
                    application.identifierUris && application.identifierUris.length > 0
                        ? application.identifierUris
                        : [`api://${application.appId}`];

                const scopesResp = await this.pontifexAadService.Instance.application.update(application.id!, {
                    api: {
                        oauth2PermissionScopes: scopes,
                    },
                    identifierUris,
                });

                await this.scopeService.syncScopes(application.id, scopes);
            }

            const roles = Array.from(Object.values(rolesToAdd)).map(
                (role) =>
                    ({
                        allowedMemberTypes: ["Application"],
                        description: role.description,
                        displayName: role.name,
                        id: uuid(),
                        value: role.name,
                        sensitive: role.sensitive,
                    } as SensitiveAppRole)
            );
            if (roles.length > 0) {
                const rolesResp = await this.pontifexAadService.Instance.application.update(application.id!, {
                    appRoles: roles.map((role) => ({
                        ...omit(role, "sensitive"),
                        description: role.description
                            ? role.description
                            : `role to call ${role.displayName}`,
                    })),
                });

                await this.roleService.syncRoles(application.id, roles);
            }
        }

        return {id};
    }

    @Put(':id/owners')
    @RequireResourceOwner({resourceType: 'APPLICATION', queryParameterKey: 'id'})
    @ApiOperation({summary: 'Update application owners'})
    @ApiResponse({status: 200, description: 'Application owners updated successfully'})
    @ApiResponse({status: 404, description: 'Application not found'})
    async updateApplicationOwners(
        @Param('id') id: string,
        @Body() body: { ownerIds: string[] }
    ) {
        const app = await this.applicationService.get(id)

        const ownerIds = [...app.owners.map(owner => owner.id), ...app.ownerGroups.map(group => group.id)]

        const ownersToRemove = ownerIds.filter(existingOwnerId => !body.ownerIds.includes(existingOwnerId))
        const ownerIdsToAdd = body.ownerIds.filter(
            newOwnerId => !ownerIds.some(existingOwnerId => existingOwnerId === newOwnerId))

        for (const ownerId of ownerIdsToAdd) {
            await this.applicationService.addUserOwnerAssociation(id, ownerId)
        }

        for (const ownerId of ownersToRemove) {
            await this.applicationService.removeUserOwnerAssociation(id, ownerId)
        }
    }

    @Delete(':id')
    @RequireResourceOwner({resourceType: 'APPLICATION', queryParameterKey: 'id'})
    @ApiOperation({summary: 'Delete an application'})
    @ApiResponse({status: 200, description: 'Application deleted successfully'})
    @ApiResponse({status: 404, description: 'Application not found'})
    async deleteApplication(@Param('id') id: string) {
        await this.applicationService.delete(id);
        return {id};
    }


    /**
     * Roles
     */
    @Get(':applicationId/roles/:roleId')
    @ApiOperation({summary: 'Get role by ID'})
    @ApiResponse({status: 200, description: 'Returns the role'})
    @ApiResponse({status: 404, description: 'Role not found'})
    async getRole(@Param('applicationId') applicationId: string, @Param('roleId') roleId: string) {
        return await this.roleService.get(roleId);
    }

    @Patch(':applicationId/roles')
    @RequireResourceOwner({resourceType: 'APPLICATION', queryParameterKey: 'applicationId'})
    @ApiOperation({summary: 'Update application roles'})
    @ApiResponse({status: 200, description: 'Update was successful'})
    @ApiResponse({status: 404, description: 'Application not found'})
    async updateApplicationRoles(@Param("applicationId") applicationId: string,
                                 @Body() body: ApplicationUpdateRolesRequest) {
        const pontifexApp = await this.applicationService.get(applicationId)

        // First pass: validate that no roles with approved permission requests are being removed
        for (const env of pontifexApp.environments ?? []) {
            const environmentAppRegistration = await this.pontifexAadService.Instance.application.get(env.id)
            const newAppRoles: SensitiveAppRole[] = body.roles.map(role => ({
                allowedMemberTypes: ["Application"],
                description: role.description ?? "",
                displayName: role.displayName,
                id: uuid(),
                value: role.claimValue,
                sensitive: role.sensitive ?? false
            }))

            const existingAppRoles = environmentAppRegistration.appRoles as SensitiveAppRole[] ?? []

            const rolesToRemove = existingAppRoles.filter(
                role => role.allowedMemberTypes![0] !== "User" && !newAppRoles.some(
                    r => r.displayName === role.displayName))

            for (const role of rolesToRemove) {
                const prs = await this.roleService.getPermissionRequests(role.id!)
                if (prs.some(pr => pr.status === "APPROVED")) {
                    throw new InvalidStateException(
                        `cannot remove role '${role.value}' because it has approved permission requests.  You must first reject all approved requests for this role, or have the client withdraw them.`)
                }
            }
        }

        // Second pass: apply the role updates to each environment
        for (const env of pontifexApp.environments ?? []) {
            await this.environmentService.updateEnvironmentRoles(env.id, body);
        }
    }


    /**
     * Scopes
     */
    @Patch(':appId/scopes')
    @RequireResourceOwner({resourceType: 'APPLICATION', queryParameterKey: 'appId'})
    @ApiOperation({summary: 'Update application scopes'})
    @ApiResponse({status: 200, description: 'Update was successful'})
    @ApiResponse({status: 404, description: 'Application not found'})
    async updateApplicationScopes(@Param("appId") appId: string,
                                  @Body() body: ApplicationUpdateScopesRequest) {
        const pontifexApp = await this.applicationService.get(appId)

        for (const env of pontifexApp.environments ?? []) {
            await this.environmentService.updateEnvironmentScopes(env.id, body.scopes);
        }
    }


    /**
     * Environments
     */
    @Get(':appId/environments')
    @ApiOperation({summary: 'Get all environments for an application'})
    @ApiResponse({status: 200, description: 'Returns all environments for the application'})
    async getEnvironmentsForApplication(@Param('appId') appId: string) {
        const environments = await this.environmentService.getAllForApplication(appId);
        return {environments};
    }

    @Post(':appId/environments')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Create an environment for an application'})
    @ApiResponse({status: 201, description: 'Environment created successfully'})
    async createEnvironment(
        @Param('appId') appId: string,
        @Body() createEnvironmentDto: CreateEnvironmentDto
    ) {
        // Generate a unique ID for the environment
        // TODO: this comes from aad
        const environmentId = `environment-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        const environment: PontifexEnvironment = {
            id: environmentId,
            name: createEnvironmentDto.name,
            level: createEnvironmentDto.level,
            clientId: createEnvironmentDto.clientId,
            spaRedirectUrls: createEnvironmentDto.spaRedirectUrls || [],
            webRedirectUrls: createEnvironmentDto.webRedirectUrls || [],
        };

        const createdEnvironment = await this.environmentService.update(environment);
        await this.environmentService.addApplicationAssociation(appId, environmentId);

        return {environment: createdEnvironment};
    }

}