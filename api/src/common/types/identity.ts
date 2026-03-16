export type IdentityType = 'user' | 'application';

export interface PontifexIdentity {
  id: string;           // Azure AD object ID (oid claim)
  name: string;         // Display name (user name or app display name)
  email: string;        // Email for users, empty string for apps
  type: IdentityType;   // 'user' or 'application'
  roles: string[];      // App roles from the token
  clientId?: string;    // For apps: the application (client) ID (azp claim)
}
