import {Injectable, Logger} from "@nestjs/common";
import * as fs from "fs";
import * as Handlebars from "handlebars";
import * as path from "path";
import {ResourceNotFoundException} from "../../common/exceptions/resource-not-found.exception";
import {EmailService} from "../email/email.service";
import {PontifexEnvironment, PontifexEnvironmentFromGremlin} from "../environment/entities/environment.entity";
import {GremlinService} from "../gremlin/gremlin.service";
import {PontifexAadService} from "../pontifex-aad/pontifex-aad.service";
import {PontifexARoleFromGremlin, PontifexRole} from "../role/entities/role.entity";
import {RoleService} from "../role/role.service";
import {PontifexScope, PontifexScopeFromGremlin} from "../scope/entities/scope.entity";
import {ScopeService} from "../scope/scope.service";
import {PontifexUser} from "../user/entities/user.entity";
import {
    PontifexPermissionRequest,
    PontifexPermissionRequestBundle,
    PontifexPermissionRequestFromGremlin
} from "./entities/permision-request.entity";

@Injectable()
export class PermissionRequestService {
    private readonly logger = new Logger(PermissionRequestService.name);

    constructor(private readonly gremlinService: GremlinService,
                private readonly pontifexService: PontifexAadService,
                private readonly roleService: RoleService,
                private readonly scopeService: ScopeService,
                private readonly emailService: EmailService) {
    }

    async get(id: string): Promise<PontifexPermissionRequestBundle> {
        const {vertex, connections} =
            await this.gremlinService.getVertexAndChildren<PontifexPermissionRequest>(
                id,
                id,
                "permissionRequest"
            );

        if (!vertex) {
            throw new ResourceNotFoundException("PermissionRequest");
        }

        return {
            permissionRequest: PontifexPermissionRequestFromGremlin(vertex),
            sourceEnvironment: connections?.["request source"]?.environment?.map(
                PontifexEnvironmentFromGremlin
            )[0]!,
            targetRole: connections?.["request target"]?.role?.map(
                PontifexARoleFromGremlin
            )[0]!,
            targetScope: connections?.["request target"]?.scope?.map(
                PontifexScopeFromGremlin
            )[0]!,
        };
    }

    async create(request: PontifexPermissionRequest,
                 sourceEnvironment: PontifexEnvironment,
                 targetEnvironment: PontifexEnvironment,
                 targetResource: PontifexRole | PontifexScope): Promise<PontifexPermissionRequest> {
        const res = await this.gremlinService.upsertVertex<PontifexPermissionRequest>({
                                                                                          id: request.id,
                                                                                          pk: request.id,
                                                                                          defaultProperties: {
                                                                                              type: "permissionRequest",
                                                                                              requestor: request.requestor,
                                                                                              createDate: request.createDate,
                                                                                              status: request.status,
                                                                                              permissionType: request.permissionType,
                                                                                              targetPermissionId: targetResource.id,
                                                                                              targetPermissionName: targetResource.name,
                                                                                              sourceEnvironmentId: sourceEnvironment.id,
                                                                                              sourceEnvironmentName: sourceEnvironment.name,
                                                                                              targetEnvironmentId: targetEnvironment.id,
                                                                                              targetEnvironmentName: targetEnvironment.name,
                                                                                          },
                                                                                      });

        // env->request
        await this.gremlinService.upsertEdge({
                                                 destinationVertexId: request.id,
                                                 destinationVertexPk: request.id,
                                                 label: "requests permission",
                                                 sourceVertexId: sourceEnvironment.id,
                                                 sourceVertexPk: sourceEnvironment.id,
                                             });

        // request->env
        await this.gremlinService.upsertEdge({
                                                 destinationVertexId: sourceEnvironment.id,
                                                 destinationVertexPk: sourceEnvironment.id,
                                                 label: "request source",
                                                 sourceVertexId: request.id,
                                                 sourceVertexPk: request.id,
                                             });

        // role|scope->request
        await this.gremlinService.upsertEdge({
                                                 destinationVertexId: request.id,
                                                 destinationVertexPk: request.id,
                                                 label: "requests permission",
                                                 sourceVertexId: targetResource.id,
                                                 sourceVertexPk: targetResource.id,
                                             });

        // request->role|scope
        await this.gremlinService.upsertEdge({
                                                 destinationVertexId: targetResource.id,
                                                 destinationVertexPk: targetResource.id,
                                                 label: "request target",
                                                 sourceVertexId: request.id,
                                                 sourceVertexPk: request.id,
                                             });

        return PontifexPermissionRequestFromGremlin(res);
    }

    async upsert(request: PontifexPermissionRequest): Promise<PontifexPermissionRequest> {
        let updatedProperties = {status: request.status};
        if (request.roleAssignmentId) {
            updatedProperties["roleAssignmentId"] = request.roleAssignmentId;
        }
        if (request.scopeAssignmentId) {
            updatedProperties["scopeAssignmentId"] = request.scopeAssignmentId;
        }

        const res = await this.gremlinService.upsertVertex<PontifexPermissionRequest>({
                                                                                          id: request.id,
                                                                                          pk: request.id,
                                                                                          defaultProperties: {
                                                                                              type: "permissionRequest",
                                                                                              requestor: request.requestor,
                                                                                              createDate: request.createDate,
                                                                                              permissionType: request.permissionType,
                                                                                          },
                                                                                          updatedProperties: updatedProperties,
                                                                                      });

        return PontifexPermissionRequestFromGremlin(res);
    }

    async updateStatus(id: string, status: "PENDING" | "APPROVED" | "REJECTED"): Promise<PontifexPermissionRequest> {
        const bundle: PontifexPermissionRequestBundle = await this.get(id);
        if (!bundle) {
            throw new ResourceNotFoundException("PermissionRequest");
        }

        let targetEnvironment: string;
        if (bundle.targetRole) {
            const endpointBundle = await this.roleService.get(
                bundle.targetRole.id
            );
            targetEnvironment = endpointBundle.environment.id;
        } else if (bundle.targetScope) {
            const scopeBundle = await this.scopeService.get(
                bundle.targetScope.id
            );
            targetEnvironment = scopeBundle.environment.id;
        }

        const clientApp = await this.pontifexService.Instance.application.get(
            bundle.sourceEnvironment.id
        );
        const clientServicePrincipal = await this.pontifexService.Instance.servicePrincipal.getByAppId(
            clientApp.appId!
        );
        const resourceApp = await this.pontifexService.Instance.application.get(targetEnvironment!);
        const resourceServicePrincipal =
            await this.pontifexService.Instance.servicePrincipal.getByAppId(resourceApp.appId!);

        bundle.permissionRequest.status = status;

        switch (status) {
            case "PENDING":
                break;
            case "APPROVED":
                if (bundle.targetRole) {
                    const roleAssignmentId =
                        await this.pontifexService.Instance.servicePrincipal.grantPermission(
                            clientServicePrincipal.id!,
                            resourceServicePrincipal.id!,
                            bundle.targetRole.id
                        );

                    console.log(
                        `granted permission and received roleAssignmentId, ${roleAssignmentId}`
                    );

                    bundle.permissionRequest.roleAssignmentId = roleAssignmentId;
                } else if (bundle.targetScope) {
                    console.log(
                        `granting delegated permission for ${clientServicePrincipal} to ${resourceServicePrincipal.id} ${bundle.targetScope.name}`
                    );
                    const permissionGrantId = await this.pontifexService.Instance.oauth2.grantPermission(
                        clientServicePrincipal.id!,
                        resourceServicePrincipal.id!,
                        bundle.targetScope.name
                    );

                    console.log(
                        `granted permission and received permission grant ${permissionGrantId}`
                    );
                    bundle.permissionRequest.scopeAssignmentId = permissionGrantId;
                }

                break;
            case "REJECTED":
                if (bundle.permissionRequest.roleAssignmentId) {
                    console.log(
                        `revoking permission ${resourceServicePrincipal.id} ${bundle.permissionRequest.roleAssignmentId}`
                    );
                    if (
                        bundle.permissionRequest.roleAssignmentId &&
                        bundle.permissionRequest.roleAssignmentId !== ""
                    ) {
                        console.log("calling AAD to revoke");
                        await this.pontifexService.Instance.servicePrincipal.revokePermission(
                            resourceServicePrincipal.id!,
                            bundle.permissionRequest.roleAssignmentId
                        );
                        bundle.permissionRequest.roleAssignmentId = "";
                    }
                } else if (bundle.permissionRequest.scopeAssignmentId) {
                    console.log(
                        `revoking permission ${resourceServicePrincipal.id} ${bundle.permissionRequest.scopeAssignmentId}`
                    );
                    if (
                        bundle.permissionRequest.scopeAssignmentId &&
                        bundle.permissionRequest.scopeAssignmentId !== ""
                    ) {
                        console.log("calling AAD to revoke");
                        const clientApp = await this.pontifexService.Instance.application.get(
                            bundle.sourceEnvironment.id
                        );
                        const clientServicePrincipal =
                            await this.pontifexService.Instance.servicePrincipal.getByAppId(clientApp.appId!);
                        console.log(
                            `revoking permission for environment ${resourceServicePrincipal.id} and delegated permission ${bundle.permissionRequest.scopeAssignmentId}`
                        );
                        await this.pontifexService.Instance.oauth2.revokePermission(
                            clientServicePrincipal.id!,
                            resourceServicePrincipal.id!,
                            bundle.targetScope!.name
                        );
                        bundle.permissionRequest.scopeAssignmentId = "";
                    }
                }
                break;
        }

        await this.upsert(bundle.permissionRequest);

        // Send status update email to the requestor
        const permissionName = bundle.targetRole?.name ?? bundle.targetScope?.name ?? '';
        const permissionType = bundle.permissionRequest.permissionType;
        await this.sendStatusUpdateEmail({
            permissionRequestId: id,
            requestorEmail: bundle.permissionRequest.requestor,
            status,
            sourceName: bundle.sourceEnvironment.name,
            sourceEnvironmentId: bundle.sourceEnvironment.id,
            targetName: bundle.permissionRequest.targetEnvironmentName,
            targetEnvironmentId: targetEnvironment!,
            permissionName,
            permissionType,
        });

        return bundle.permissionRequest;
    }

    async sendRequestCreatedEmail(params: {
        permissionRequestId: string;
        requestor: PontifexUser;
        ownerEmails: string[];
        sourceEnvironment: PontifexEnvironment;
        targetEnvironmentId: string;
        targetEnvironmentName: string;
        permissionName: string;
        permissionType: string;
    }): Promise<void> {
        if (params.ownerEmails.length === 0) return;

        const html = this.renderTemplate('permission-request-created.html', {
            permissionRequestId: params.permissionRequestId,
            requestorName: params.requestor.name,
            requestorEmail: params.requestor.email,
            sourceName: params.sourceEnvironment.name,
            sourceEnvironmentId: params.sourceEnvironment.id,
            targetName: params.targetEnvironmentName,
            targetEnvironmentId: params.targetEnvironmentId,
            permissionName: params.permissionName,
            permissionType: params.permissionType,
            appUrl: 'https://app.pontifex.localhost:8443',
        });

        await this.emailService.send({
            to: params.ownerEmails,
            subject: `[Pontifex] New permission request: ${params.sourceEnvironment.name} → ${params.targetEnvironmentName}`,
            html,
        });
    }

    async sendStatusUpdateEmail(params: {
        permissionRequestId: string;
        requestorEmail: string;
        status: string;
        sourceName: string;
        sourceEnvironmentId: string;
        targetName: string;
        targetEnvironmentId: string;
        permissionName: string;
        permissionType: string;
    }): Promise<void> {
        const html = this.renderTemplate('permission-request-status-update.html', {
            permissionRequestId: params.permissionRequestId,
            sourceName: params.sourceName,
            sourceEnvironmentId: params.sourceEnvironmentId,
            targetName: params.targetName,
            targetEnvironmentId: params.targetEnvironmentId,
            permissionName: params.permissionName,
            permissionType: params.permissionType,
            status: params.status,
            statusLower: params.status.toLowerCase(),
            appUrl: 'https://app.pontifex.localhost:8443',
        });

        await this.emailService.send({
            to: params.requestorEmail,
            subject: `[Pontifex] Permission request ${params.status.toLowerCase()}: ${params.sourceName} → ${params.targetName}`,
            html,
        });
    }

    private renderTemplate(templateName: string, context: Record<string, string>): string {
        const templatePath = path.join(__dirname, 'templates', templateName);
        const source = fs.readFileSync(templatePath, 'utf-8');
        const template = Handlebars.compile(source);
        return template(context);
    }

    async getPendingForUser(userId: string): Promise<PontifexPermissionRequest[]> {
        const query = `g.V(vid)
            .union(fold().unfold(), out("owns").has("type", "group"), out("member of"))
            .out('owns')
            .out('contains')
            .out('contains')
            .out('requests permission')
            .has('status', 'PENDING')
            .dedup()`; // it's important to dedup here because a user can be a member of multiple groups that own the same application
        const bindings = {vid: userId};

        const result = await this.gremlinService.submit(query, bindings);

        return result._items.map(PontifexPermissionRequestFromGremlin);
    }

    async getGroupedPendingForUser(userId: string): Promise<Record<string, PontifexPermissionRequest[]>> {
        // get all the pending prs, but then group them by the target applications' id
        const query = `g.V(vid)
            .union(fold().unfold(), out("owns").has("type", "group"), out("member of"))
            .out('owns')
            .out('contains')
            .out('contains')
            .out('requests permission')
            .has('status', 'PENDING')
            .dedup()
            .group()
            .by(out('request target').out('contained by').values('id'))`;
        const bindings = {vid: userId};

        const result = await this.gremlinService.submit(query, bindings);
        const resultMap: Record<string, any> = result._items[0];

        // for each application id, map the list of JSON objects to PontifexPermissionRequests
        for (const key in resultMap) {
            resultMap[key] = resultMap[key].map(
                PontifexPermissionRequestFromGremlin
            );
        }

        return resultMap;
    }

    async delete(id: string): Promise<void> {
        const bundle: PontifexPermissionRequestBundle = await this.get(id);
        const requestingEnv = bundle.sourceEnvironment;

        // Attempt AAD cleanup — tolerate 404s since the AAD app may already be deleted
        try {
            const requestingApp = await this.pontifexService.Instance.application.get(requestingEnv.id);

            let targetEnvironment: string;
            if (bundle.targetRole) {
                const endpointBundle = await this.roleService.get(
                    bundle.targetRole.id
                );
                targetEnvironment = endpointBundle.environment.id;
            } else if (bundle.targetScope) {
                const scopeBundle = await this.scopeService.get(
                    bundle.targetScope.id
                );
                targetEnvironment = scopeBundle.environment.id;
            }

            console.log(`looking up resourceAppId for ${targetEnvironment!}`);
            const resourceApp = await this.pontifexService.Instance.application.get(targetEnvironment!);

            console.log(
                `looking up resourceServicePrincipal for ${resourceApp.appId}`
            );
            const resourceServicePrincipal =
                await this.pontifexService.Instance.servicePrincipal.getByAppId(resourceApp.appId!);

            if (bundle.permissionRequest.status === "APPROVED") {
                if (
                    bundle.permissionRequest.roleAssignmentId &&
                    bundle.permissionRequest.roleAssignmentId !== ""
                ) {
                    console.log(
                        `revoking permission for environment ${resourceServicePrincipal.id} and roleAssignment ${bundle.permissionRequest.roleAssignmentId}`
                    );
                    await this.pontifexService.Instance.servicePrincipal.revokePermission(
                        resourceServicePrincipal.id!,
                        bundle.permissionRequest.roleAssignmentId
                    );
                    bundle.permissionRequest.roleAssignmentId = undefined;
                } else if (
                    bundle.permissionRequest.scopeAssignmentId &&
                    bundle.permissionRequest.scopeAssignmentId !== ""
                ) {
                    const clientApp = await this.pontifexService.Instance.application.get(
                        bundle.sourceEnvironment.id
                    );
                    const clientServicePrincipal =
                        await this.pontifexService.Instance.servicePrincipal.getByAppId(clientApp.appId!);

                    console.log(
                        `revoking permission for environment ${resourceServicePrincipal.id} and delegated permission ${bundle.permissionRequest.scopeAssignmentId}`
                    );
                    await this.pontifexService.Instance.oauth2.revokePermission(
                        clientServicePrincipal.id!,
                        resourceServicePrincipal.id!,
                        bundle.targetScope!.name
                    );
                    bundle.permissionRequest.scopeAssignmentId = undefined;
                }
            }

            const requiredResourceAccess = requestingApp.requiredResourceAccess!.find(
                (rra) => rra.resourceAppId === targetEnvironment
            );

            if (requiredResourceAccess) {
                const requiredResourceAccessId =
                    bundle.targetRole?.id ?? bundle.targetScope?.id;

                console.log(
                    `removing required resource access for ${requestingEnv.id} and ${requiredResourceAccessId}`
                );
                const newResourceAccess = requiredResourceAccess.resourceAccess!.filter(
                    (ra) => ra.id !== requiredResourceAccessId
                );
                console.log(
                    `new resource access for ${requestingEnv.id} and ${requiredResourceAccessId}`,
                    newResourceAccess
                );
                requiredResourceAccess.resourceAccess = newResourceAccess;
            }

            console.log(`removing required resource access for ${requestingEnv.id}`);
            const filteredRequiredResourceAccess =
                requestingApp.requiredResourceAccess!.filter(
                    (rra) => rra.resourceAccess!.length > 0
                );

            if (
                filteredRequiredResourceAccess.length !==
                requestingApp.requiredResourceAccess!.length
            ) {
                console.log(
                    `new required resource access for ${requestingEnv.id}`,
                    filteredRequiredResourceAccess
                );
            }
            console.log(
                `updating required resource access for ${requestingEnv.id}`,
                filteredRequiredResourceAccess
            );
            await this.pontifexService.Instance.application.update(requestingEnv.id, {
                requiredResourceAccess: filteredRequiredResourceAccess,
            });
        } catch (error) {
            if (error?.statusCode === 404) {
                console.log(`AAD resources for permission request ${id} already cleaned up, skipping AAD cleanup`)
            } else {
                throw error
            }
        }

        await this.gremlinService.dropVertex(id, 'permissionRequest');
    }

    /**
     * Check if an identity owns the source environment's parent application for this permission request.
     */
    async isOwnedBy(prId: string, identityId: string): Promise<boolean> {
        const query = `g.V(vid)
            .union(
                fold().unfold(),
                out("owns").has("type", "group"),
                out("member of")
            )
            .out("owns").has("type", "application")
            .out("contains").has("type", "environment")
            .out("requests permission").hasId(prId)
            .limit(1)`;
        const result = await this.gremlinService.submit(query, {vid: identityId, prId});
        return result._items.length > 0;
    }
}