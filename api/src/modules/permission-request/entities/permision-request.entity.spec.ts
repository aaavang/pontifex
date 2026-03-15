import { PontifexPermissionRequestFromGremlin } from './permision-request.entity';

describe('PontifexPermissionRequestFromGremlin', () => {
  it('converts a gremlin vertex to a PontifexPermissionRequest', () => {
    const vertex = {
      id: 'env-1.role-1',
      label: 'permissionRequest',
      properties: [
        { key: 'requestor', value: 'user-1' },
        { key: 'createDate', value: '2024-01-01T00:00:00Z' },
        { key: 'status', value: 'PENDING' },
        { key: 'permissionType', value: 'Role' },
        { key: 'roleAssignmentId', value: 'assign-1' },
        { key: 'targetPermissionName', value: 'admin' },
        { key: 'targetPermissionId', value: 'role-1' },
        { key: 'sourceEnvironmentId', value: 'env-1' },
        { key: 'sourceEnvironmentName', value: 'my-app-dev' },
        { key: 'targetEnvironmentId', value: 'env-2' },
        { key: 'targetEnvironmentName', value: 'other-app-prod' },
      ],
    };

    const result = PontifexPermissionRequestFromGremlin(vertex);

    expect(result).toEqual({
      id: 'env-1.role-1',
      requestor: 'user-1',
      createDate: '2024-01-01T00:00:00Z',
      status: 'PENDING',
      permissionType: 'Role',
      roleAssignmentId: 'assign-1',
      scopeAssignmentId: undefined,
      targetPermissionName: 'admin',
      targetPermissionId: 'role-1',
      sourceEnvironmentId: 'env-1',
      sourceEnvironmentName: 'my-app-dev',
      targetEnvironmentId: 'env-2',
      targetEnvironmentName: 'other-app-prod',
    });
  });

  it('defaults permissionType to Role when missing', () => {
    const vertex = {
      id: 'pr-1',
      label: 'permissionRequest',
      properties: [
        { key: 'requestor', value: 'user-1' },
        { key: 'createDate', value: '2024-01-01T00:00:00Z' },
        { key: 'status', value: 'APPROVED' },
        { key: 'sourceEnvironmentId', value: 'env-1' },
        { key: 'sourceEnvironmentName', value: 'app-dev' },
        { key: 'targetEnvironmentId', value: 'env-2' },
        { key: 'targetEnvironmentName', value: 'app-prod' },
        { key: 'targetPermissionName', value: 'reader' },
        { key: 'targetPermissionId', value: 'role-2' },
      ],
    };

    const result = PontifexPermissionRequestFromGremlin(vertex);
    expect(result.permissionType).toBe('Role');
  });
});
