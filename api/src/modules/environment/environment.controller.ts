import {PasswordCredential, RequiredResourceAccess} from "@microsoft/microsoft-graph-types";
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
} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from '@nestjs/swagger';
import {ResourceOwnerGuard} from "../../common/guards/resource-owner.guard";
import {AuditEventService} from "../audit-event/audit-event.service";
import {PontifexAuditEvent} from "../audit-event/entities/audit-event.entity";
// import {AzureAdAuthGuard} from "../../common/guards/azure-ad-auth.guard";
import {PontifexPassword} from "../password/entities/password.entity";
import {PontifexPermissionRequest} from "../permission-request/entities/permision-request.entity";
import {PermissionRequestService} from "../permission-request/permission-request.service";
import {PontifexAadService} from "../pontifex-aad/pontifex-aad.service";
import {RoleService} from "../role/role.service";
import {ScopeService} from "../scope/scope.service";
import {UserService} from '../user/user.service';
import {EnvironmentUpdatePermissionsRequest, Permission} from "./dtos/update-permission-request.dto";
import {AddPasswordDto, PontifexEnvironment, UpdateEnvironmentDto} from './entities/environment.entity';
import {EnvironmentService} from './environment.service';

@ApiTags('environments')
@Controller('environments')
@UseGuards(ResourceOwnerGuard) // TODO: add auth guard
@ApiBearerAuth()
export class EnvironmentController {
    constructor(private readonly environmentService: EnvironmentService,
                private readonly pontifexService: PontifexAadService,
                private readonly permissionRequestService: PermissionRequestService,
                private readonly roleService: RoleService,
                private readonly scopeService: ScopeService,
                private readonly auditService: AuditEventService,
                private readonly userService: UserService) {
    }


    @Get(':id')
    @ApiOperation({summary: 'Get environment by ID'})
    @ApiResponse({status: 200, description: 'Returns the environment'})
    @ApiResponse({status: 404, description: 'Environment not found'})
    async getEnvironment(@Param('id') id: string) {
        return await this.environmentService.get(id);
    }

    @Get(':id/roles')
    @ApiOperation({summary: 'Get all roles for an environment'})
    @ApiResponse({status: 200, description: 'Returns all roles for the environment'})
    @ApiResponse({status: 404, description: 'Environment not found'})
    async getEnvironmentRoles(@Param('id') id: string) {
        const groupedRoles = await this.environmentService.getGroupedRoles(id);
        return groupedRoles;
    }

    @Get(':id/scopes')
    @ApiOperation({summary: 'Get all scopes for an environment'})
    @ApiResponse({status: 200, description: 'Returns all scopes for the environment'})
    @ApiResponse({status: 404, description: 'Environment not found'})
    async getEnvironmentScopes(@Param('id') id: string) {
        const groupedScopes = await this.environmentService.getGroupedScopes(id);
        return groupedScopes;
    }

    @Put(':id')
    @ApiOperation({summary: 'Update an environment'})
    @ApiResponse({status: 200, description: 'Environment updated successfully'})
    @ApiResponse({status: 404, description: 'Environment not found'})
    async updateEnvironment(
        @Param('id') id: string,
        @Body() updateEnvironmentDto: UpdateEnvironmentDto
    ) {
        // Get the current environment
        const {environment} = await this.environmentService.get(id);

        // Update the environment with the new values
        const updatedEnvironment: PontifexEnvironment = {
            ...environment,
            ...updateEnvironmentDto,
        };

        const result = await this.environmentService.update(updatedEnvironment);
        return {environment: result};
    }

    @Delete(':id')
    @ApiOperation({summary: 'Delete an environment'})
    @ApiResponse({status: 200, description: 'Environment deleted successfully'})
    @ApiResponse({status: 404, description: 'Environment not found'})
    async deleteEnvironment(@Param('id') id: string) {
        await this.environmentService.delete(id);
        return {id};
    }

    @Post(':id/addPassword')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Add a password to an environment'})
    @ApiResponse({status: 201, description: 'Password added successfully'})
    @ApiResponse({status: 404, description: 'Environment not found'})
    async addPassword(
        @Param('id') id: string,
        @Body() body: AddPasswordDto
    ) {

        const password: PasswordCredential = await this.pontifexService.Instance.application.addPassword(id, body)

        const pontifexPassword: PontifexPassword = {
            displayName: body.displayName,
            end: password.endDateTime!,
            id: password.keyId!,
            password: password.secretText!,
            start: password.startDateTime!
        }

        await this.environmentService.addPassword(id, pontifexPassword);
        return {id: pontifexPassword.id};
    }

    @Delete('passwords/:id')
    @ApiOperation({summary: 'Remove a password from an environment'})
    @ApiResponse({status: 200, description: 'Password removed successfully'})
    @ApiResponse({status: 404, description: 'Password not found'})
    async removePassword(@Param('id') id: string) {
        await this.environmentService.removePassword(id);
        return {id};
    }

    @Post(':id/roles/:roleId')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Associate an role with an environment'})
    @ApiResponse({status: 201, description: 'Role associated successfully'})
    @ApiResponse({status: 404, description: 'Environment or role not found'})
    async addRoleAssociation(
        @Param('id') id: string,
        @Param('roleId') roleId: string,
        @Query('status') status: string = 'approved'
    ) {
        await this.environmentService.addRoleAssociation(id, roleId, status);
        return {id, roleId, status};
    }

    @Post(':id/scopes/:scopeId')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({summary: 'Associate a scope with an environment'})
    @ApiResponse({status: 201, description: 'Scope associated successfully'})
    @ApiResponse({status: 404, description: 'Environment or scope not found'})
    async addScopeAssociation(
        @Param('id') id: string,
        @Param('scopeId') scopeId: string,
        @Query('status') status: string = 'approved'
    ) {
        await this.environmentService.addScopeAssociation(id, scopeId, status);
        return {id, scopeId, status};
    }

    @Get(':id/permissionRequests')
    async getPermissionRequests(@Param('id') id: string) {
        const environment = await this.environmentService.get(id);

        return {
            inboundPermissionRequests: environment.inboundPermissionRequests,
            outboundPermissionRequests: environment.outboundPermissionRequests
        }
    }

    @Patch(':id/permissions')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({summary: 'Update permissions for an environment'})
    @ApiResponse({status: 204, description: 'Permissions updated successfully'})
    @ApiResponse({status: 404, description: 'Environment not found'})
    async updatePermissions(
        @Param('id') id: string,
        @Body() body: EnvironmentUpdatePermissionsRequest,
        @Req() req: any
    ) {
        console.log('body', body)
        const targetEnvironment = await this.environmentService.get(body.targetEnvironmentId)
        const currentApp = await this.pontifexService.Instance.application.get(id);
        const requiredResourceAccess = currentApp.requiredResourceAccess;
        console.log('current requiredResourceAccess', requiredResourceAccess);

        const permissionsByAppId = body.permissions.reduce(
            (dict, permission) => {
                if (permission.applicationObjectId in dict) {
                    dict[permission.applicationObjectId].push(permission);
                } else {
                    dict[permission.applicationObjectId] = [permission];
                }

                return dict;
            },
            {} as Record<string, Permission[]>
        );

        const requiredResourceAccessToKeep = requiredResourceAccess?.filter(
            // if the access isn't targeted at the current app, ignore it
            rra => targetEnvironment.environment.clientId !== rra.resourceAppId!
        ) ?? []

        console.log("permissionsByAppId", permissionsByAppId);

        const newRequiredResources: RequiredResourceAccess[] = [...requiredResourceAccessToKeep];
        console.log('newRequiredResources', newRequiredResources);

        for (const [objectId, permissions] of Object.entries(permissionsByAppId)) {
            console.log(`looking up AAD app ${objectId}`);
            const app = await this.pontifexService.Instance.application.get(objectId);

            newRequiredResources.push({
                                          resourceAppId: app.appId!,
                                          resourceAccess: permissions.map((permission) => ({
                                              id: permission.id,
                                              type: permission.type,
                                          })),
                                      });
        }

        console.log(
            `updating ${id} with new required resources`,
            JSON.stringify(newRequiredResources, null, 2)
        );

        try {
            // remove roles that aren't present anymore
            await this.pontifexService.Instance.application.update(id, {
                requiredResourceAccess: newRequiredResources,
            });

            console.log(
                `updated AAD for app ID, ${id}, with required resources, ${JSON.stringify(
                    newRequiredResources
                )}`
            );

            const {environment, permissionRequests} = await this.environmentService.get(
                id
            );
            for (const permissionRequest of permissionRequests) {
                const {sourceEnvironment, targetRole, targetScope} =
                    await this.permissionRequestService.get(permissionRequest.id);

                // todo: there's a better way to handle the difference in logic for Role vs Scope
                if (targetRole) {
                    console.log(
                        `is ${targetRole.id} in ${JSON.stringify(newRequiredResources)}`
                    );
                    if (
                        !newRequiredResources.some((rr) => rr.resourceAccess?.some(ra => ra.id === targetRole.id))
                    ) {
                        console.log(
                            `deleting permission request, ${permissionRequest.id}, requesting access from ${sourceEnvironment.name} to ${targetRole.name}`
                        );
                        // delete this permission request
                        await this.permissionRequestService.delete(permissionRequest.id);
                    }
                } else if (targetScope) {
                    console.log(
                        `is ${targetScope.id} in ${JSON.stringify(newRequiredResources)}`
                    );
                    if (
                        !newRequiredResources.some((rr) => rr.resourceAccess?.some(ra => ra.id === targetScope.id))
                    ) {
                        console.log(
                            `deleting permission request, ${permissionRequest.id}, requesting access from ${sourceEnvironment.name} to ${targetScope.name}`
                        );
                        // delete this permission request
                        await this.permissionRequestService.delete(permissionRequest.id);
                    }
                }
            }

            // try to create new PontifexPermissionRequests, ignoring any that already exist
            const newPermissions = newRequiredResources
                .filter(
                    (nrr) => nrr.resourceAppId !== "00000003-0000-0000-c000-000000000000"
                )
                .map<PontifexPermissionRequest[]>((requiredResource) =>
                                                      requiredResource.resourceAccess!.map<PontifexPermissionRequest>(
                                                          (resourceAccess) => ({
                                                              id: `${id}.${resourceAccess.id}`,
                                                              requestor: req.user.oid as string,
                                                              createDate: new Date().toISOString(),
                                                              status: "PENDING",
                                                              // TODO: !! there's a better way to do this
                                                              permissionType: resourceAccess.type!,
                                                              targetPermissionId: 'temp', // temporary until we can look up the target permission id
                                                              targetPermissionName: 'temp', // temporary until we can look up the target permission name
                                                              sourceEnvironmentId: environment.id,
                                                              sourceEnvironmentName: environment.name,
                                                              targetEnvironmentId: 'temp',
                                                              targetEnvironmentName: 'temp'
                                                          })
                                                      )
                )
                .flat()
                .filter(
                    (newPermissionRequest) =>
                        !permissionRequests.some((pr) => pr.id === newPermissionRequest.id)
                );

            for (const permissionRequest of newPermissions) {
                if (permissionRequest.permissionType === "Role") {
                    const targetRole = await this.roleService.get(
                        permissionRequest.id.split(".")[1]
                    );
                    permissionRequest.targetPermissionId = targetRole.role.id
                    permissionRequest.targetPermissionName = targetRole.role.name
                    permissionRequest.targetEnvironmentId = targetRole.environment.id
                    permissionRequest.targetEnvironmentName = targetRole.environment.name
                    console.log(
                        `Creating permission request for ${environment.name} to ${targetRole.role.name}`
                    );
                    const pr = await this.permissionRequestService.create(
                        permissionRequest,
                        environment,
                        targetRole.environment,
                        targetRole.role
                    );
                    console.log(
                        `Created permission request ${pr.id} for ${environment.name} to ${targetRole.role.name}`
                    );
                    console.log(`looking up user ${req.user.oid}`);
                    const {user: requestingUser} = await this.userService.get(
                        req.user.oid as string
                    );
                    console.log(`found user ${requestingUser.id}`);

                    console.log(`looking up owners of ${targetRole.role.id}`);
                    const roleOwners = await this.roleService.getOwners(
                        targetRole.role.id
                    );
                    console.log(
                        `found owners ${roleOwners.map((owner) => owner.id).join(", ")}`
                    );

                    console.log(
                        `sending emails to ${roleOwners
                            .map((owner) => owner.id)
                            .join(", ")}`
                    );

                    // TODO: wire up emails
                    // await sendRequestEmails(
                    //     permissionRequest,
                    //     requestingUser,
                    //     roleOwners,
                    //     environment,
                    //     targetRole.endpoint
                    // );

                    if (roleOwners.some((owner) => owner.id === requestingUser.id)) {
                        console.log(
                            `User ${requestingUser.id} is an owner of ${targetRole.role.id}, approving request`
                        );
                        await this.permissionRequestService.updateStatus(pr.id, "APPROVED");
                        pr.status = "APPROVED";
                        // TODO: wire up emails
                        // await sendRequestStatusUpdateEmails(
                        //     pr,
                        //     requestingUser,
                        //     roleOwners,
                        //     environment,
                        //     targetRole.endpoint
                        // );
                    }
                } else if (permissionRequest.permissionType === "Scope") {
                    const targetScope = await this.scopeService.get(
                        permissionRequest.id.split(".")[1]
                    );
                    permissionRequest.targetPermissionId = targetScope.scope.id
                    permissionRequest.targetPermissionName = targetScope.scope.name
                    permissionRequest.targetEnvironmentId = targetScope.environment.id
                    permissionRequest.targetEnvironmentName = targetScope.environment.name
                    console.log(
                        `Creating permission request for ${environment.name} to ${targetScope.scope.name}`
                    );
                    const pr = await this.permissionRequestService.create(
                        permissionRequest,
                        environment,
                        targetScope.environment,
                        targetScope.scope
                    );
                    console.log(
                        `Created permission request ${pr.id} for ${environment.name} to ${targetScope.scope.name}`
                    );
                    console.log(`looking up user ${req.user.oid}`);
                    const {user: requestingUser} = await this.userService.get(
                        req.user.oid as string
                    );
                    console.log(`found user ${requestingUser.id}`);

                    console.log(`looking up owners of ${targetScope.scope.id}`);
                    const scopeOwners = await this.scopeService.getOwners(
                        targetScope.scope.id
                    );
                    console.log(
                        `found owners ${scopeOwners.map((owner) => owner.id).join(", ")}`
                    );

                    // context.log(
                    //   `sending emails to ${scopeOwners
                    //     .map((owner) => owner.id)
                    //     .join(", ")}`
                    // );
                    // await sendRequestEmails(
                    //   permissionRequest,
                    //   requestingUser,
                    //   scopeOwners,
                    //   environment,
                    //   targetScope.scope
                    // );

                    if (scopeOwners.some((owner) => owner.id === requestingUser.id)) {
                        console.log(
                            `User ${requestingUser.id} is an owner of ${targetScope.scope.id}, approving request`
                        );
                        await this.permissionRequestService.updateStatus(pr.id, "APPROVED");
                        pr.status = "APPROVED";
                        // await sendRequestStatusUpdateEmails(
                        //   pr,
                        //   requestingUser,
                        //   scopeOwners,
                        //   environment,
                        //   targetScope.scope
                        // );
                    }
                }
            }

            const event: PontifexAuditEvent = {
                action: "UPDATE_ENVIRONMENT_PERMISSIONS",
                value: JSON.stringify(newRequiredResources),
                associatedUserId: req.user.oid as string,
                targetResourceId: id,
            };
            await this.auditService.publishEvent(event);
        } catch (e) {
            console.error(
                `got error when adding permissions to application ${id}`,
                e
            );
            throw e
        }
    };
}