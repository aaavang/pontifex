import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentService } from './environment.service';
import { GremlinService } from '../gremlin/gremlin.service';
import { PasswordService } from '../password/password.service';
import { PontifexAadService } from '../pontifex-aad/pontifex-aad.service';
import { RoleService } from '../role/role.service';
import { ScopeService } from '../scope/scope.service';
import { PermissionRequestService } from '../permission-request/permission-request.service';
import { AuditEventService } from '../audit-event/audit-event.service';

describe('EnvironmentService', () => {
  let service: EnvironmentService;
  let gremlinService: jest.Mocked<GremlinService>;
  let passwordService: jest.Mocked<PasswordService>;

  const mockEnvVertex = {
    id: 'env-1',
    label: 'environment',
    properties: [
      { key: 'name', value: 'app-dev' },
      { key: 'level', value: 'dev' },
      { key: 'clientId', value: 'client-1' },
      { key: 'spaRedirectUrls', value: '' },
      { key: 'webRedirectUrls', value: '' },
    ],
  };

  const mockAppVertex = {
    id: 'app-1',
    pk: 'app-1',
    label: 'application',
    properties: [
      { key: 'name', value: 'my-app' },
      { key: 'creator', value: 'user-1' },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentService,
        {
          provide: GremlinService,
          useValue: {
            getVertexAndChildren: jest.fn(),
            upsertVertex: jest.fn(),
            upsertEdge: jest.fn(),
            dropVertex: jest.fn(),
            submit: jest.fn(),
          },
        },
        {
          provide: PasswordService,
          useValue: {
            create: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: PontifexAadService,
          useValue: {
            Instance: {
              application: { get: jest.fn(), update: jest.fn() },
            },
          },
        },
        { provide: RoleService, useValue: { get: jest.fn(), update: jest.fn(), addApplicationAssociation: jest.fn(), getPermissionRequests: jest.fn(), delete: jest.fn() } },
        { provide: ScopeService, useValue: { update: jest.fn(), addApplicationAssociation: jest.fn() } },
        { provide: PermissionRequestService, useValue: { delete: jest.fn() } },
        { provide: AuditEventService, useValue: { publishEvent: jest.fn() } },
      ],
    }).compile();

    service = module.get(EnvironmentService);
    gremlinService = module.get(GremlinService);
    passwordService = module.get(PasswordService);
  });

  describe('get', () => {
    it('returns an environment bundle', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: mockEnvVertex,
        connections: {
          'contained by': { application: [mockAppVertex] },
          contains: { role: [], scope: [] },
        },
      });

      const result = await service.get('env-1');

      expect(result.environment.id).toBe('env-1');
      expect(result.environment.name).toBe('app-dev');
      expect(result.application.id).toBe('app-1');
    });

    it('throws when id is empty', async () => {
      await expect(service.get('')).rejects.toThrow('id cannot be empty or undefined');
    });

    it('throws when vertex is not found', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: null,
        connections: {},
      });

      await expect(service.get('missing')).rejects.toThrow('Environment not found');
    });
  });

  describe('update', () => {
    it('upserts the environment vertex and returns the result', async () => {
      gremlinService.upsertVertex.mockResolvedValue(mockEnvVertex);

      const result = await service.update({
        id: 'env-1',
        name: 'app-dev',
        level: 'dev',
        clientId: 'client-1',
        spaRedirectUrls: ['http://localhost:3000'],
        webRedirectUrls: [],
      });

      expect(result.id).toBe('env-1');
      expect(gremlinService.upsertVertex).toHaveBeenCalledWith({
        id: 'env-1',
        pk: 'env-1',
        defaultProperties: {
          type: 'environment',
          name: 'app-dev',
          level: 'dev',
          clientId: 'client-1',
        },
        updatedProperties: {
          spaRedirectUrls: 'http://localhost:3000',
          webRedirectUrls: '',
        },
      });
    });
  });

  describe('delete', () => {
    it('throws when id is empty', async () => {
      await expect(service.delete('')).rejects.toThrow('id cannot be empty or undefined');
    });

    it('drops the environment vertex', async () => {
      gremlinService.dropVertex.mockResolvedValue(undefined);

      await service.delete('env-1');

      expect(gremlinService.dropVertex).toHaveBeenCalledWith('env-1', 'environment');
    });
  });

  describe('addApplicationAssociation', () => {
    it('creates bidirectional edges between app and environment', async () => {
      gremlinService.upsertEdge.mockResolvedValue(undefined);

      await service.addApplicationAssociation('app-1', 'env-1');

      expect(gremlinService.upsertEdge).toHaveBeenCalledTimes(2);
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'contains', sourceVertexId: 'app-1', destinationVertexId: 'env-1' }),
      );
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'contained by', sourceVertexId: 'env-1', destinationVertexId: 'app-1' }),
      );
    });
  });

  describe('addRoleAssociation', () => {
    it('creates bidirectional consumes edges with status', async () => {
      gremlinService.upsertEdge.mockResolvedValue(undefined);

      await service.addRoleAssociation('env-1', 'role-1', 'approved');

      expect(gremlinService.upsertEdge).toHaveBeenCalledTimes(2);
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'consumes',
          sourceVertexId: 'env-1',
          destinationVertexId: 'role-1',
          properties: { status: 'approved' },
        }),
      );
    });
  });

  describe('addScopeAssociation', () => {
    it('creates bidirectional consumes edges with status', async () => {
      gremlinService.upsertEdge.mockResolvedValue(undefined);

      await service.addScopeAssociation('env-1', 'scope-1', 'pending');

      expect(gremlinService.upsertEdge).toHaveBeenCalledTimes(2);
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'consumes',
          properties: { status: 'pending' },
        }),
      );
    });
  });

  describe('addPassword', () => {
    it('creates the password and edges', async () => {
      passwordService.create.mockResolvedValue(undefined);
      gremlinService.upsertEdge.mockResolvedValue(undefined);

      await service.addPassword('env-1', {
        id: 'pw-1',
        displayName: 'secret',
        start: '2024-01-01',
        end: '2025-01-01',
        password: 'val',
      });

      expect(passwordService.create).toHaveBeenCalled();
      expect(gremlinService.upsertEdge).toHaveBeenCalledTimes(2);
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'has password' }),
      );
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'is password for' }),
      );
    });
  });

  describe('removePassword', () => {
    it('drops the password vertex', async () => {
      gremlinService.dropVertex.mockResolvedValue(undefined);

      await service.removePassword('pw-1');

      expect(gremlinService.dropVertex).toHaveBeenCalledWith('pw-1', 'password');
    });
  });

  describe('getAllForApplication', () => {
    it('returns environments for the given app', async () => {
      gremlinService.submit.mockResolvedValue({ _items: [mockEnvVertex] });

      const result = await service.getAllForApplication('app-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('app-dev');
    });
  });
});
