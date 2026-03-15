export interface PontifexGetApplicationsResponse {
    applications: PontifexApplication[];
}

export interface PontifexApplication {
    id: string;
    name: string; // human-friendly
    creator: string;
    secret: boolean; // should the application be discoverable/searchable
    description: string;
}

export interface PontifexGroup {
    id: string;
    name: string;
}

export interface PontifexGetApplicationResponse {
    application: PontifexApplication;
    environments?: PontifexEnvironment[];
    owners?: PontifexUser[];
    ownerGroups?: PontifexGroup[];
    description?: string;
}

export interface PontifexAuditEvent {
    id: string;
    type: string;
    action: string;
    associatedUserId: string;
    createDate: string;
}

export interface PontifexPassword {
    id: string;
    displayName: string;
    password: string;
    start: string;
    end: string;
}

export interface PontifexTokenGroup {
    id: string;
    name: string;
    envId: string;
    appRoleId: string;
    appRoleAssignmentId: string;
    groupId: string;
    claimValue: string;
    description: string;
}

export interface PontifexGetApplicationAuditEventsResponse {
    events: PontifexAuditEvent[];
}

export interface GetTokenResponse {
    token: string;
}

export interface PontifexGetEnvironmentResponse {
    environment: PontifexEnvironment;
    roles?: PontifexRole[];
    scopes?: PontifexApplicationScope[];
    tokenGroups?: PontifexTokenGroup[];
    permissionRequests?: PontifexPermissionRequest[];
    inboundPermissionRequests?: PontifexPermissionRequest[];
    outboundPermissionRequests?: PontifexPermissionRequest[];
    application: PontifexApplication;
    passwords: PontifexPassword[];
}

export interface PontifexGetEnrichedEnvironmentResponse
    extends PontifexGetEnvironmentResponse {
    connectedEnvironments: PontifexEnvironment[];
}

export interface PontifexGetEnvironmentConnectedRolesResponse {
    [envId: string]: PontifexRole[];
}

export interface PontifexGetEnvironmentConnectedScopesResponse {
    [envId: string]: PontifexApplicationScope[];
}

export interface PontifexGetEnvironmentPermissionRequestResponse {
    outboundPermissionRequests: PontifexGetPermissionRequestResponse[];
    inboundPermissionRequests: PontifexGetPermissionRequestResponse[];
}

export interface PontifexGetPermissionRequestResponse {
    permissionRequest: PontifexPermissionRequest;
    sourceEnvironment: PontifexEnvironment;
    targetEnvironment: PontifexEnvironment;
    targetRole?: PontifexRole;
    targetScope?: PontifexApplicationScope;
}

export interface PontifexGetRoleResponse {
    role: PontifexRole;
    environment: PontifexEnvironment;
    requests?: PontifexPermissionRequest[];
}

export interface PontifexGetScopeResponse {
    scope: PontifexApplicationScope;
    environment: PontifexEnvironment;
    requests?: PontifexPermissionRequest[];
}

export interface PontifexGetPendingPermissionRequestsResponse {
    pendingPermissionRequests: PontifexPermissionRequest[];
    groupedPendingPermissionRequests: Record<string, PontifexPermissionRequest[]>;
}

export interface PontifexGetOwnersResponse {
    owners: PontifexUser[];
}

export interface PontifexUserBundle {
    user: PontifexUser;
    memberGroups?: PontifexGroup[];
    ownerGroups?: PontifexGroup[];
    ownedApplications?: PontifexApplication[];
    pendingPermissionRequests?: PontifexPermissionRequest[];
    groupedPendingPermissionRequests?: Record<
        string,
        PontifexPermissionRequest[]
    >;
}

export interface PontifexCreateUserResponse {
    user: PontifexUser;
}

export interface PontifexGetUserResponse {
    bundle: PontifexUserBundle;
}

export interface PontifexGetGroupResponse {
    group: PontifexGroup;
    owners: PontifexUser[];
    members: PontifexUser[];
    ownedApplications: PontifexApplication[];
}

export interface PontifexUser {
    id: string;
    name: string;
    email: string;
}

export interface PontifexPermissionRequest {
    id: string;
    requestor: string;
    createDate: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    permissionType: "Role" | "Scope";
    targetPermissionId: string; // role or scope id
    targetPermissionName: string;
    sourceEnvironmentId: string; // for display purposes
    sourceEnvironmentName: string; // for display purposes
    targetEnvironmentId: string; // for display purposes
    targetEnvironmentName: string; // for display purposes
}

export interface AddPontifextRoleRequest {
    name: string;
    sensitive: boolean;
}

export interface PontifexRole {
    id: string;
    name: string; // app registration name + dev/stage/prod
    sensitive: boolean;
    description: string;
}

export interface PontifexApplicationScope {
    id: string;
    name: string; // scope name e.g. "read.users"
    displayName: string; // human-friendly scope name e.g. "Read Users"
    description: string; // human-friendly scope description e.g. "Read all user records"
}

export interface PontifexRoleScopeSelectorBundle {
    availableRoles: PontifexRole[];
    alreadyRequestedRoles: PontifexRole[];
    availableScopes: PontifexApplicationScope[];
    alreadyRequestedScopes: PontifexApplicationScope[];
}

export interface PontifexEnvironment {
    name: string; // app registration name + dev/stage/prod
    level: string;
    id: string; // app registration object id
    clientId: string;
    spaRedirectUrls?: string[];
    webRedirectUrls?: string[];
}
