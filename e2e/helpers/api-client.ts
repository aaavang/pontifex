import { APIRequestContext } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL ?? 'https://api.pontifex.localhost:8443/api';

export interface Application {
  id: string;
  name: string;
  creator: string;
  description: string;
}

export interface ApplicationBundle {
  application: Application;
  environments: Environment[];
  owners: User[];
  ownerGroups: Group[];
}

export interface Environment {
  id: string;
  name: string;
  level: string;
  clientId: string;
  spaRedirectUrls: string[];
  webRedirectUrls: string[];
}

export interface EnvironmentBundle {
  environment: Environment;
  roles: Role[];
  scopes: Scope[];
  permissionRequests: PermissionRequest[];
  outboundPermissionRequests: PermissionRequest[];
  inboundPermissionRequests: PermissionRequest[];
  application: Application;
  passwords: Password[];
  tokenGroups: TokenGroup[];
}

export interface Role {
  id: string;
  name: string;
  sensitive: boolean;
  description?: string;
}

export interface Scope {
  id: string;
  name: string;
  displayName: string;
  description: string;
}

export interface PermissionRequest {
  id: string;
  requestor: string;
  createDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  permissionType: string;
  roleAssignmentId?: string;
  scopeAssignmentId?: string;
  sourceEnvironmentName: string;
  sourceEnvironmentId: string;
  targetEnvironmentName: string;
  targetEnvironmentId: string;
  targetPermissionName: string;
  targetPermissionId: string;
}

export interface User {
  id: string;
  name: string;
  normalizedName: string;
  email: string;
}

export interface UserBundle {
  user: User;
  ownedApplications: Application[];
  memberGroups: Group[];
}

export interface Group {
  id: string;
  name: string;
}

export interface Password {
  id: string;
  displayName: string;
  password?: string;
  start?: string;
  end?: string;
}

export interface TokenGroup {
  id: string;
  name: string;
}

export class PontifexApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly token: string,
  ) {}

  private get headers() {
    return { Authorization: `Bearer ${this.token}` };
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.request.get(`${API_BASE_URL}${path}`, {
      headers: this.headers,
      ignoreHTTPSErrors: true,
    });
    if (!response.ok()) {
      throw new Error(`API GET ${path} failed: ${response.status()} ${response.statusText()}`);
    }
    return response.json();
  }

  private async post<T>(path: string, data?: unknown): Promise<T> {
    const response = await this.request.post(`${API_BASE_URL}${path}`, {
      headers: this.headers,
      data,
      ignoreHTTPSErrors: true,
    });
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`API POST ${path} failed: ${response.status()} ${body}`);
    }
    return response.json();
  }

  private async patch<T>(path: string, data?: unknown): Promise<T> {
    const response = await this.request.patch(`${API_BASE_URL}${path}`, {
      headers: this.headers,
      data,
      ignoreHTTPSErrors: true,
    });
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`API PATCH ${path} failed: ${response.status()} ${body}`);
    }
    return response.json();
  }

  private async put<T>(path: string, data?: unknown): Promise<T> {
    const response = await this.request.put(`${API_BASE_URL}${path}`, {
      headers: this.headers,
      data,
      ignoreHTTPSErrors: true,
    });
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`API PUT ${path} failed: ${response.status()} ${body}`);
    }
    return response.json();
  }

  private async del(path: string): Promise<void> {
    const response = await this.request.delete(`${API_BASE_URL}${path}`, {
      headers: this.headers,
      ignoreHTTPSErrors: true,
    });
    if (!response.ok()) {
      throw new Error(`API DELETE ${path} failed: ${response.status()} ${response.statusText()}`);
    }
  }

  /** Make a request and return the status code without throwing */
  async rawRequest(method: string, path: string, data?: unknown): Promise<{ status: number; body: unknown }> {
    const response = await this.request.fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: this.headers,
      data,
      ignoreHTTPSErrors: true,
    });
    const body = await response.json().catch(() => null);
    return { status: response.status(), body };
  }

  // Applications

  async getApplications(): Promise<{ applications: Application[] }> {
    return this.get('/applications');
  }

  async getApplication(id: string): Promise<ApplicationBundle> {
    return this.get(`/applications/${id}`);
  }

  async getApplicationSafe(id: string): Promise<ApplicationBundle | null> {
    const response = await this.request.get(`${API_BASE_URL}/applications/${id}`, {
      headers: this.headers,
      ignoreHTTPSErrors: true,
    });
    if (response.status() === 404) return null;
    if (!response.ok()) {
      throw new Error(`API GET /applications/${id} failed: ${response.status()}`);
    }
    return response.json();
  }

  async deleteApplication(id: string): Promise<void> {
    return this.del(`/applications/${id}`);
  }

  // Environments

  async getEnvironment(id: string): Promise<EnvironmentBundle> {
    return this.get(`/environments/${id}`);
  }

  async getEnvironmentPermissionRequests(id: string): Promise<{
    inboundPermissionRequests: PermissionRequest[];
    outboundPermissionRequests: PermissionRequest[];
  }> {
    return this.get(`/environments/${id}/permissionRequests`);
  }

  // Search

  async searchApplications(prefix: string): Promise<{ applications: Application[] }> {
    return this.get(`/applications/search?prefix=${encodeURIComponent(prefix)}`);
  }

  async getOwnedApplications(): Promise<{ applications: Application[] }> {
    return this.get('/applications/owned');
  }

  async createApplication(name: string, environments: string[], description?: string): Promise<Application> {
    return this.post('/applications', { applicationName: name, environments, description });
  }

  async updateApplicationRoles(appId: string, roles: Array<{ displayName: string; claimValue: string; sensitive: boolean; description?: string }>): Promise<void> {
    await this.patch(`/applications/${appId}/roles`, { roles });
  }

  async updateApplicationScopes(appId: string, scopes: Array<{ name: string; displayName: string; description?: string }>): Promise<void> {
    await this.patch(`/applications/${appId}/scopes`, { scopes });
  }

  // Audit events

  async getApplicationAuditEvents(id: string): Promise<{ events: AuditEvent[] }> {
    return this.get(`/applications/${id}/audit-events`);
  }

  // Environment operations

  async addPassword(envId: string, displayName: string): Promise<{ id: string }> {
    return this.post(`/environments/${envId}/addPassword`, { displayName });
  }

  // Groups

  async createGroup(name: string): Promise<{ group: Group }> {
    return this.post('/groups', { name });
  }

  async deleteGroup(id: string): Promise<void> {
    return this.del(`/groups/${id}`);
  }

  async getGroup(id: string): Promise<{ group: Group; owners: User[]; members: User[] }> {
    return this.get(`/groups/${id}`);
  }

  // Users

  async createUser(): Promise<{ user: User }> {
    return this.put('/users/create');
  }

  async getCurrentUser(): Promise<{ bundle: UserBundle }> {
    return this.get('/users/me');
  }
}

export interface AuditEvent {
  action: string;
  value: string;
  associatedUserId?: string;
  targetResourceId?: string;
}
