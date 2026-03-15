import {ClientSecretCredential} from "@azure/identity";
import {Client} from "@microsoft/microsoft-graph-client";
import {
    TokenCredentialAuthenticationProvider,
    TokenCredentialAuthenticationProviderOptions
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import {
    Application,
    AppRoleAssignment,
    DirectoryObject,
    Group,
    OAuth2PermissionGrant,
    PasswordCredential,
    ServicePrincipal
} from "@microsoft/microsoft-graph-types";
import "isomorphic-fetch";
import {validate} from "uuid"
import {AddPasswordRequest, PontifexAADConfig, RemovePasswordRequest} from "./types";

const APPLICATIONS_API_PATH = "/applications"
const SERVICE_PRINCIPALS_API_PATH = "/servicePrincipals"
const GROUPS_API_PATH = "/groups"
const DELEGATED_PERMISSIONS_API_PATH = "/oauth2PermissionGrants";

export class PontifexAAD {
    private aad: Client;
    oauth2 = {
        getPermissionsGrantedForApplication: async (
            clientId: string,
            resourceId: string
        ): Promise<OAuth2PermissionGrant> => {
            type OAuth2PermissionGrantQuery = {
                "@odata.context": string;
                value: OAuth2PermissionGrant[];
            };
            const {value}: OAuth2PermissionGrantQuery = await this.aad
                .api(
                    `${DELEGATED_PERMISSIONS_API_PATH}?$filter=clientId eq '${clientId}' and resourceId eq '${resourceId}'`
                )
                .get();

            console.log(`existing scopes resp: ${JSON.stringify(value)}`);

            return value[0];
        },
        grantPermission: async (
            clientId: string,
            resourceId: string,
            scope: string
        ): Promise<string> => {
            const existingPermissionsGranted =
                await this.oauth2.getPermissionsGrantedForApplication(
                    clientId,
                    resourceId
                );

            if (existingPermissionsGranted?.scope) {
                const updatedScope = `${existingPermissionsGranted.scope}, ${scope}`;
                await this.oauth2.updatePermissionScopes(
                    existingPermissionsGranted.id!,
                    updatedScope
                );

                return existingPermissionsGranted.id!;
            }

            const resp = (await this.aad.api(DELEGATED_PERMISSIONS_API_PATH).post({
                                                                                      clientId,
                                                                                      resourceId,
                                                                                      scope,
                                                                                      consentType: "AllPrincipals",
                                                                                  })) as OAuth2PermissionGrant;

            return resp.id!;
        },
        revokePermission: async (
            clientId: string,
            resourceId: string,
            scope: string
        ): Promise<OAuth2PermissionGrant> => {
            const existingPermissionsGranted =
                await this.oauth2.getPermissionsGrantedForApplication(
                    clientId,
                    resourceId
                );

            if (!existingPermissionsGranted) {
                throw Error(`couldn't find existing permission, ${resourceId}`)
            }

            // todo: this logic should maybe be handled in the calling code (i.e. not in client)
            console.log(
                `removing scope from existing scope: ${existingPermissionsGranted.scope}`
            );
            const updatedScope = existingPermissionsGranted.scope!
                .split(",")
                .filter((existingScope) => !existingScope.includes(scope))
                .join(",");

            console.log(`updated scope after removal: ${updatedScope}`);

            if (updatedScope === "") {
                console.log("no more scopes -- removing permission grant");
                return (await this.aad
                    .api(
                        `${DELEGATED_PERMISSIONS_API_PATH}/${existingPermissionsGranted.id}`
                    )
                    .delete()) as OAuth2PermissionGrant;
            }

            await this.oauth2.updatePermissionScopes(
                existingPermissionsGranted.id!,
                updatedScope
            );

            return {...existingPermissionsGranted, scope: updatedScope};
        },
        updatePermissionScopes: async (id: string, updatedScope: string) => {
            await this.aad.api(`${DELEGATED_PERMISSIONS_API_PATH}/${id}`).patch({
                                                                                    scope: updatedScope,
                                                                                });

            return;
        },
    };
    application = {
        create: async (app: Application): Promise<Application> => {
            return await this.aad.api(APPLICATIONS_API_PATH).post(app)
        },
        get: async (appObjectId: string, retries = 3, intervalMs = 2000): Promise<Application> => {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    return await this.aad.api(`${APPLICATIONS_API_PATH}/${appObjectId}`).get()
                } catch (error) {
                    if (error?.statusCode === 404 && attempt < retries) {
                        console.log(`AAD application ${appObjectId} not found (attempt ${attempt}/${retries}), retrying in ${intervalMs}ms...`);
                        await new Promise(resolve => setTimeout(resolve, intervalMs));
                        continue;
                    }
                    throw error;
                }
            }
            throw new Error(`AAD application ${appObjectId} not found after ${retries} attempts`);
        },
        update: async (appObjectId: string, app: Application) => {
            await this.aad.api(`${APPLICATIONS_API_PATH}/${appObjectId}`).patch(app)
        },
        delete: async (appObjectId: string) => {
            await this.aad.api(`${APPLICATIONS_API_PATH}/${appObjectId}`).delete()
        },
        addPassword: async (appObjectId: string, request: AddPasswordRequest): Promise<PasswordCredential> => {
            return await this.aad.api(`${APPLICATIONS_API_PATH}/${appObjectId}/addPassword`).post({
                                                                                                      passwordCredential: {
                                                                                                          displayName: request.displayName
                                                                                                      }
                                                                                                  })
        },
        removePassword: async (appObjectId: string, request: RemovePasswordRequest) => {
            return await this.aad.api(`${APPLICATIONS_API_PATH}/${appObjectId}/removePassword`).post(request)
        },
        getByAppId: async (appId: string): Promise<Application | undefined> => {
            if (!validate(appId)) {
                throw new Error("Invalid appId")
            }

            type ApplicationQuery = {
                "@odata.context": string,
                value: Application[]
            }
            const {value}: ApplicationQuery = await this.aad.api(
                `${APPLICATIONS_API_PATH}?$filter=appId eq '${appId}'`).get()

            return value[0]
        }
    }
    servicePrincipal = {
        create: async (appId: string): Promise<ServicePrincipal> => {
            return this.aad.api(SERVICE_PRINCIPALS_API_PATH).post({
                                                                      appId
                                                                  })
        },
        grantPermission: async (principalId: string, resourceId: string, appRoleId: string): Promise<string> => {
            const roleAssignment = await this.aad.api(
                `${SERVICE_PRINCIPALS_API_PATH}/${resourceId}/appRoleAssignedTo`).post({
                                                                                           principalId,
                                                                                           resourceId,
                                                                                           appRoleId
                                                                                       })

            return roleAssignment.id
        },
        revokePermission: async (resourceId: string, roleAssignmentId: string) => {
            await this.aad.api(
                `${SERVICE_PRINCIPALS_API_PATH}/${resourceId}/appRoleAssignedTo/${roleAssignmentId}`).delete()
        },
        getByAppId: async (appId: string): Promise<ServicePrincipal> => {
            if (!validate(appId)) {
                throw new Error("Invalid appId")
            }

            type ServicePrincipalQuery = {
                "@odata.context": string,
                value: ServicePrincipal[]
            }
            const {value}: ServicePrincipalQuery = await this.aad.api(
                `${SERVICE_PRINCIPALS_API_PATH}?$filter=appId eq '${appId}'`).get()

            if (value.length > 0) {
                return value[0]
            } else {
                throw new Error(`No ServicePrincipal found for appId, ${appId}`)
            }
        }
    }
    group = {
        create: async (displayName: string, description?: string): Promise<Group> => {
            return await this.aad.api(GROUPS_API_PATH).post({
                displayName,
                description,
                mailEnabled: false,
                mailNickname: displayName.replace(/[^a-zA-Z0-9]/g, '_'),
                securityEnabled: true,
            })
        },
        getByDisplayName: async (displayName: string): Promise<Group | undefined> => {
            const resp = await this.aad.api(GROUPS_API_PATH)
                .filter(`displayName eq '${displayName}'`)
                .get();
            return resp.value[0]
        },
        addAppRoleAssignment: async (principalId: string, resourceId: string, appRoleId: string) => {
            return await this.aad.api(`${GROUPS_API_PATH}/${principalId}/appRoleAssignments`).post({
                                                                                                       principalId,
                                                                                                       resourceId,
                                                                                                       appRoleId
                                                                                                   }) as AppRoleAssignment
        },
        getAll: async (): Promise<Group[]> => {
            const resp = await this.aad.api(`${GROUPS_API_PATH}`).get();
            return resp.value
        },
        searchByPrefix: async (prefix: string): Promise<Group[]> => {
            const resp = await this.aad.api(`${GROUPS_API_PATH}`).filter(`startswith(displayName, '${prefix}')`).get();
            return resp.value
        },
        getMembers: async (groupId: string): Promise<DirectoryObject[]> => {
            const resp = await this.aad.api(`${GROUPS_API_PATH}/${groupId}/members`).get();
            return resp.value
        },
        getOwners: async (groupId: string): Promise<DirectoryObject[]> => {
            const resp = await this.aad.api(`${GROUPS_API_PATH}/${groupId}/owners`).get();
            return resp.value
        }
    }

    constructor(config?: PontifexAADConfig) {
        const {tenantId, clientId, clientSecret} = {
            tenantId: process.env.PONTIFEX_TENANT_ID,
            clientId: process.env.PONTIFEX_CLIENT_ID,
            clientSecret: process.env.PONTIFEX_CLIENT_SECRET,
            ...config
        }

        console.log(`Initializing PontifexAAD with tenantId: ${tenantId}, clientId: ${clientId}`)

        if (!tenantId) {
            throw new Error("Missing tenantId")
        }

        if (!clientId) {
            throw new Error("Missing clientId")
        }

        if (!clientSecret) {
            throw new Error("Missing clientSecret")
        }

        const tokenCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        const options: TokenCredentialAuthenticationProviderOptions = {scopes: ["https://graph.microsoft.com/.default"]};

        const authProvider = new TokenCredentialAuthenticationProvider(tokenCredential, options)
        this.aad = Client.initWithMiddleware({
                                                 debugLogging: true,
                                                 authProvider
                                             })
    }
}


