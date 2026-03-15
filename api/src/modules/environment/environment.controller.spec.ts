import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentController } from './environment.controller';
import { EnvironmentService } from './environment.service';
import { PontifexAadService } from '../pontifex-aad/pontifex-aad.service';
import { PermissionRequestService } from '../permission-request/permission-request.service';
import { RoleService } from '../role/role.service';
import { ScopeService } from '../scope/scope.service';
import { AuditEventService } from '../audit-event/audit-event.service';
import { UserService } from '../user/user.service';
import { Reflector } from '@nestjs/core';

describe('EnvironmentController', () => {
  let controller: EnvironmentController;
  let environmentService: jest.Mocked<EnvironmentService>;
  let pontifexService: jest.Mocked<PontifexAadService>;

  const mockEnvBundle = {
    environment: { id: 'env-1', name: 'app-dev', level: 'dev', clientId: 'c1', spaRedirectUrls: [], webRedirectUrls: [] },
    application: { id: 'app-1', name: 'my-app', creator: 'user-1', description: '' },
    roles: [],
    scopes: [],
    permissionRequests: [],
    outboundPermissionRequests: [],
    inboundPermissionRequests: [],
    passwords: [],
    tokenGroups: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnvironmentController],
      providers: [
        Reflector,
        {
          provide: EnvironmentService,
          useValue: {
            get: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            addPassword: jest.fn(),
            removePassword: jest.fn(),
            addRoleAssociation: jest.fn(),
            addScopeAssociation: jest.fn(),
            getGroupedRoles: jest.fn(),
            getGroupedScopes: jest.fn(),
          },
        },
        {
          provide: PontifexAadService,
          useValue: {
            Instance: {
              application: {
                addPassword: jest.fn(),
                get: jest.fn(),
                update: jest.fn(),
              },
            },
          },
        },
        { provide: PermissionRequestService, useValue: { get: jest.fn(), delete: jest.fn() } },
        { provide: RoleService, useValue: { get: jest.fn() } },
        { provide: ScopeService, useValue: { get: jest.fn() } },
        { provide: AuditEventService, useValue: { publishEvent: jest.fn() } },
        { provide: UserService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(EnvironmentController);
    environmentService = module.get(EnvironmentService);
    pontifexService = module.get(PontifexAadService);
  });

  describe('getEnvironment', () => {
    it('returns the environment bundle', async () => {
      environmentService.get.mockResolvedValue(mockEnvBundle);

      const result = await controller.getEnvironment('env-1');

      expect(result).toEqual(mockEnvBundle);
    });
  });

  describe('updateEnvironment', () => {
    it('merges update DTO with existing environment', async () => {
      environmentService.get.mockResolvedValue(mockEnvBundle);
      environmentService.update.mockResolvedValue({ ...mockEnvBundle.environment, name: 'app-staging' });

      const result = await controller.updateEnvironment('env-1', { name: 'app-staging' });

      expect(result.environment.name).toBe('app-staging');
    });
  });

  describe('deleteEnvironment', () => {
    it('deletes and returns the id', async () => {
      environmentService.delete.mockResolvedValue(undefined);

      const result = await controller.deleteEnvironment('env-1');

      expect(result).toEqual({ id: 'env-1' });
    });
  });

  describe('addPassword', () => {
    it('creates a password via AAD and stores it', async () => {
      (pontifexService.Instance.application.addPassword as jest.Mock).mockResolvedValue({
        keyId: 'key-1',
        secretText: 'secret',
        startDateTime: '2024-01-01',
        endDateTime: '2025-01-01',
      });
      environmentService.addPassword.mockResolvedValue(undefined);

      const result = await controller.addPassword('env-1', { displayName: 'my-secret' });

      expect(result).toEqual({ id: 'key-1' });
    });
  });

  describe('removePassword', () => {
    it('removes and returns the id', async () => {
      environmentService.removePassword.mockResolvedValue(undefined);

      const result = await controller.removePassword('pw-1');

      expect(result).toEqual({ id: 'pw-1' });
    });
  });

  describe('addRoleAssociation', () => {
    it('associates a role with an environment', async () => {
      environmentService.addRoleAssociation.mockResolvedValue(undefined);

      const result = await controller.addRoleAssociation('env-1', 'role-1', 'approved');

      expect(result).toEqual({ id: 'env-1', roleId: 'role-1', status: 'approved' });
    });
  });

  describe('addScopeAssociation', () => {
    it('associates a scope with an environment', async () => {
      environmentService.addScopeAssociation.mockResolvedValue(undefined);

      const result = await controller.addScopeAssociation('env-1', 'scope-1', 'approved');

      expect(result).toEqual({ id: 'env-1', scopeId: 'scope-1', status: 'approved' });
    });
  });

  describe('getPermissionRequests', () => {
    it('returns inbound and outbound permission requests', async () => {
      environmentService.get.mockResolvedValue(mockEnvBundle);

      const result = await controller.getPermissionRequests('env-1');

      expect(result).toEqual({
        inboundPermissionRequests: [],
        outboundPermissionRequests: [],
      });
    });
  });

  describe('getEnvironmentRoles', () => {
    it('returns grouped roles', async () => {
      const grouped = { 'env-2': [{ id: 'role-1', name: 'admin', sensitive: false, description: '' }] };
      environmentService.getGroupedRoles.mockResolvedValue(grouped);

      const result = await controller.getEnvironmentRoles('env-1');

      expect(result).toEqual(grouped);
    });
  });

  describe('getEnvironmentScopes', () => {
    it('returns grouped scopes', async () => {
      const grouped = { 'env-2': [{ id: 'scope-1', name: 'User.Read', displayName: 'Read', description: '' }] };
      environmentService.getGroupedScopes.mockResolvedValue(grouped);

      const result = await controller.getEnvironmentScopes('env-1');

      expect(result).toEqual(grouped);
    });
  });
});
