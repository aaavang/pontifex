export const rolesHelpText =
  "These are the roles that are available for clients to request access to. Roles allow the client application to access data without a user and should be used for machine to machine scenarios.";

export const scopesHelpText =
  "These are the scopes that are available for clients to request access to. Scopes are used for interactive clients (UI) and allow the client application to act on a user's behalf.";

export const tokenGroupsHelpText =
  "These are Azure AD groups that will show up in user tokens if the user is a member of them.  They are used for role-based access control (RBAC).";

export const outboundPermissionRequestsHelpText =
  "These are requests for this environment to access roles in other applications/environments.  Their statuses might be pending, approved, or denied.";
export const inboundPermissionRequestsHelpText =
  "These are requests for other applications/environments to access roles in this applications/environments.  Their statuses might be pending, approved, or denied.";
export const clientCredentialsHelpText =
  "These are credentials that can be used to acquire tokens on behalf on this application's specific environment.";
export const clientIdHelpText =
  "This ID is used to request OAuth2 tokens.  You would see this in the 'scope' field as 'CLIENT_ID/.default'.  You can click the ID to copy it to your clipboard.";
export const environmentsHelpText =
  "These are the various environments/stages this application is running in.  Each environment shares the same available roles, but has its own set of outbound connections/permission requests/client credentials.";
export const secretHelpText =
  "If an application is secret, it will not be visible in searches to anyone who isn't an owner.  You can still connect to a secret application's environments by copying the Connection URL from the hamburger menu.";
export const sensitiveHelpText =
  "This role contains sensitive data, or interacts with sensitive systems.  You will be required to provided reasoning when asking for access to this role.";
export const nonSensitiveHelpText =
  "This role doesn't contain sensitive data or interact with sensitive systems.";
export const tooManyClientCredentialsHelpText =
  "You can only have a maximum of 2 client credentials.  Delete one of the existing ones to add another.";
