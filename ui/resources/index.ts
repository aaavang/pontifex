import axios from "axios";
import {memoize} from "memoize-lit";
import {
    GetTokenResponse,
    PontifexApplication,
    PontifexApplicationScope,
    PontifexCreateUserResponse,
    PontifexEnvironment,
    PontifexGetApplicationAuditEventsResponse,
    PontifexGetApplicationResponse,
    PontifexGetApplicationsResponse,
    PontifexGetEnrichedEnvironmentResponse,
    PontifexGetEnvironmentConnectedRolesResponse,
    PontifexGetEnvironmentConnectedScopesResponse,
    PontifexGetEnvironmentPermissionRequestResponse,
    PontifexGetEnvironmentResponse,
    PontifexGetGroupResponse,
    PontifexGetPendingPermissionRequestsResponse,
    PontifexGetPermissionRequestResponse,
    PontifexGetRoleResponse,
    PontifexGetScopeResponse,
    PontifexGetUserResponse,
    PontifexRole,
    PontifexRoleScopeSelectorBundle,
    PontifexUser,
    PontifexUserBundle,
} from "../models/axios";
import {wrapPromise} from "../utils/suspense";

const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

export const readAllApplications = async (): Promise<PontifexApplication[]> => {
    const res = await axios.get<PontifexGetApplicationsResponse>(
        "/api/applications"
    );

    return res.data.applications;
};

export const readApplication =
    (appId: string) => async (): Promise<PontifexGetApplicationResponse> => {
        if (!appId) {
            console.error("empty appId");
            return null;
        }

        const res = await axios.get<PontifexGetApplicationResponse>(
            `/api/applications/${appId}`
        );

        return res.data;
    };

export const readApplicationAuditEvents =
    (appId: string) =>
        async (): Promise<PontifexGetApplicationAuditEventsResponse> => {
            if (!appId) {
                console.error("empty appId");
                return null;
            }

            const res = await axios.get<PontifexGetApplicationAuditEventsResponse>(
                `/api/applications/${appId}/audit`
            );

            return res.data;
        };

export const readGroup =
    (groupId: string) => async (): Promise<PontifexGetGroupResponse> => {
        if (!groupId) {
            console.error("empty groupId");
            return null;
        }

        if (!isValidUUID(groupId)) {
            console.error("invalid groupId");
            return null;
        }

        const res = await axios.get<PontifexGetGroupResponse>(
            `/api/groups/${groupId}`
        );

        return res.data;
    };

export const readApplicationEnvironments =
    (appId: string) => async (): Promise<PontifexEnvironment[]> => {
        if (!appId) {
            console.error("empty appId");
            return null;
        }

        const res = await axios.get<PontifexGetApplicationResponse>(
            `/api/applications/${appId}`
        );

        return res.data.environments;
    };

export const readEnvironment =
    (envId: string) => async (): Promise<PontifexGetEnvironmentResponse> => {
        if (!envId) {
            console.error("empty envId");
            return null;
        }

        const res = await axios.get<PontifexGetEnvironmentResponse>(
            `/api/environments/${envId}`
        );

        return res.data;
    };

export const createOrReadUser = () => async (): Promise<PontifexUser> => {
    const res = await axios.put<PontifexCreateUserResponse>(`/api/users/create`);

    return res.data.user;
};

export const readToken =
    (clientId: string, clientSecret: string, resourceId: string) =>
        async (): Promise<GetTokenResponse> => {
            const res = await axios.post("/api/request-token", {
                clientId,
                clientSecret,
                resourceId,
            });

            return res.data;
        };

export const readEnrichedEnvironment =
    (envId: string) =>
        async (): Promise<PontifexGetEnrichedEnvironmentResponse> => {
            if (!envId) {
                console.error("empty envId");
                return null;
            }

            const res = await axios.get<PontifexGetEnvironmentResponse>(
                `/api/environments/${envId}`
            );

            const promises = (res.data.permissionRequests ?? []).map((pr) =>
                                                                         readPermissionRequest(pr.id)()
            );
            const prRes = await Promise.allSettled(promises);

            const targetEnvironments = prRes
                .filter((prRes) => prRes.status == "fulfilled")
                .map(
                    (prRes) =>
                        (
                            prRes as PromiseFulfilledResult<PontifexGetPermissionRequestResponse>
                        ).value
                )
                .map((prRes) => prRes.targetEnvironment);
            const envIdToEnv: Record<string, PontifexEnvironment> = {};

            targetEnvironments.forEach((env) => {
                if (!(env.id in envIdToEnv)) {
                    envIdToEnv[env.id] = env;
                }
            });

            return {
                ...res.data,
                connectedEnvironments: Object.values(envIdToEnv),
            };
        };

export const readEnvironmentRoles = memoize(
    (envId: string) =>
        wrapPromise(async (): Promise<PontifexRole[]> => {
            if (!envId) {
                console.error("empty envId");
                return null;
            }

            const res = await axios.get<PontifexGetEnvironmentResponse>(
                `/api/environments/${envId}`
            );

            return res.data.roles;
        }),
    {maxAge: 300000}
);

export const readEnvironmentRolesScopesAndCurrentConnections =
    (sourceEnvId: string, targetEnvId: string) =>
        async (): Promise<PontifexRoleScopeSelectorBundle> => {
            if (!sourceEnvId) {
                console.error("empty sourceEnvId");
                return null;
            }

            if (!targetEnvId) {
                console.error("empty targetEnvId");
                return null;
            }

            const res = await axios.get<PontifexGetEnvironmentResponse>(
                `/api/environments/${targetEnvId}`
            );

            const RolesResp =
                await axios.get<PontifexGetEnvironmentConnectedRolesResponse>(
                    `/api/environments/${sourceEnvId}/roles`
                );

            const scopesResp =
                await axios.get<PontifexGetEnvironmentConnectedScopesResponse>(
                    `/api/environments/${sourceEnvId}/scopes`
                );

            return {
                availableRoles: res.data.roles,
                alreadyRequestedRoles: RolesResp.data[targetEnvId] ?? [],
                availableScopes: res.data.scopes,
                alreadyRequestedScopes: scopesResp.data[targetEnvId] ?? [],
            };
        };

export const readEnvironmentPermissionRequests =
    (envId: string, direction: "inbound" | "outbound") =>
        async (): Promise<PontifexGetEnvironmentPermissionRequestResponse> => {
            if (!envId) {
                console.error("empty envId");
                return null;
            }

            const res =
                await axios.get<PontifexGetEnvironmentPermissionRequestResponse>(
                    `/api/environments/${envId}/permissionRequests?direction=${direction}`
                );

            return {
                ...res.data,
            };
        };

export const readPermissionRequest =
    (prId: string) => async (): Promise<PontifexGetPermissionRequestResponse> => {
        if (!prId) {
            console.error("empty prId");
            return null;
        }

        const res = await axios.get<PontifexGetPermissionRequestResponse>(
            `/api/permission-requests/${prId}`
        );

        let targetEnvironment: PontifexEnvironment;
        if (res.data.targetRole) {
            const targetRoleRes = await axios.get<PontifexGetRoleResponse>(
                `/api/roles/${res.data.targetRole.id}`
            );
            targetEnvironment = targetRoleRes.data.environment;
        } else if (res.data.targetScope) {
            const targetScopeRes = await axios.get<PontifexGetScopeResponse>(
                `/api/scopes/${res.data.targetScope.id}`
            );
            targetEnvironment = targetScopeRes.data.environment;
        }

        return {
            ...res.data,
            targetEnvironment: targetEnvironment,
        };
    };

export const readRole =
    (roleId: string) => async (): Promise<PontifexGetRoleResponse> => {
        if (!roleId) {
            console.error("empty roleId");
            return null;
        }

        const res = await axios.get<PontifexGetRoleResponse>(
            `/api/roles/${roleId}`
        );

        return res.data;
    };

export const readScope =
    (scopeId: string) => async (): Promise<PontifexGetScopeResponse> => {

        if (!scopeId) {
            console.error("empty scopeId");
            return null;
        }

        if (!isValidUUID(scopeId)) {
            console.error("invalid scopeId");
            return null;
        }

        const res = await axios.get<PontifexGetScopeResponse>(
            `/api/scopes/${scopeId}`
        );

        return res.data;
    };

export const readPendingPermissionRequests =
    async (): Promise<PontifexGetPendingPermissionRequestsResponse> => {
        const res = await axios.get<PontifexGetUserResponse>("/api/users/me");

        return {
            pendingPermissionRequests:
                res.data.bundle.pendingPermissionRequests ?? [],
            groupedPendingPermissionRequests:
                res.data.bundle.groupedPendingPermissionRequests ?? {},
        };
    };

export const readUser = (userId) => async (): Promise<PontifexUser> => {
    const res = await axios.get<PontifexGetUserResponse>(`/api/users/${userId}`);

    return res.data.bundle.user;
};

export const readCurrentUserBundle = async (): Promise<PontifexUserBundle> => {
    const res = await axios.get<PontifexGetUserResponse>(`/api/users/me`);

    return res.data.bundle;
};

export const requestAccess = async (
    sourceEnvId: string,
    targetEnvId: string,
    roleIds: PontifexRole[],
    scopeIds: PontifexApplicationScope[]
): Promise<number> => {
    console.log("Requesting access from", sourceEnvId, "to", targetEnvId);
    console.log("Role IDs:", roleIds);
    console.log("Scope IDs:", scopeIds);
    const RolesResp =
        await axios.get<PontifexGetEnvironmentConnectedRolesResponse>(
            `/api/environments/${sourceEnvId}/roles`
        );
    const roles: PontifexGetEnvironmentConnectedRolesResponse =
        RolesResp.data as any;

    roles[targetEnvId] = roleIds;

    const scopesResp =
        await axios.get<PontifexGetEnvironmentConnectedScopesResponse>(
            `/api/environments/${sourceEnvId}/scopes`
        );
    const scopes: PontifexGetEnvironmentConnectedScopesResponse =
        scopesResp.data as any;

    scopes[targetEnvId] = scopeIds;

    const permissions = [];
    console.log("Roles:", roles);
    for (const envId in roles) {
        const newPermissions = roles[envId].map((ep) => ({
            id: ep.id,
            applicationObjectId: envId,
            type: "Role",
        }));
        permissions.push(...newPermissions);
    }

    for (const envId in scopes) {
        const newPermissions = scopes[envId].map((ep) => ({
            id: ep.id,
            applicationObjectId: envId,
            type: "Scope",
        }));
        permissions.push(...newPermissions);
    }

    const res = await axios.patch(
        `/api/environments/${sourceEnvId}/permissions`,
        {
            targetEnvironmentId: targetEnvId,
            permissions,
        }
    );

    return res.status;
};
