import { Test, TestingModule } from '@nestjs/testing';
import { RoleService } from './role.service';
import { GremlinService } from '../gremlin/gremlin.service';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';

describe('RoleService', () => {
  let service: RoleService;
  let gremlinService: jest.Mocked<GremlinService>;

  const mockRoleVertex = {
    id: 'role-1',
    label: 'role',
    properties: [
      { key: 'name', value: 'admin' },
      { key: 'sensitive', value: true },
      { key: 'description', value: 'Admin role' },
    ],
  };

  const mockEnvVertex = {
    id: 'env-1',
    pk: 'env-1',
    label: 'environment',
    properties: {
      name: [{ value: 'my-app-dev' }],
      level: [{ value: 'dev' }],
      clientId: [{ value: 'client-1' }],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
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
      ],
    }).compile();

    service = module.get(RoleService);
    gremlinService = module.get(GremlinService);
  });

  describe('get', () => {
    it('returns a role bundle', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: mockRoleVertex,
        connections: {
          'contained by': { environment: [mockEnvVertex] },
        },
      });

      const result = await service.get('role-1');

      expect(result.role.name).toBe('admin');
      expect(result.role.sensitive).toBe(true);
    });

    it('throws ResourceNotFoundException when role is not found', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: null,
        connections: {},
      });

      await expect(service.get('missing')).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('update', () => {
    it('upserts a role vertex', async () => {
      gremlinService.upsertVertex.mockResolvedValue(mockRoleVertex);

      const result = await service.update({
        id: 'role-1',
        name: 'admin',
        sensitive: true,
        description: 'Admin role',
      });

      expect(result.name).toBe('admin');
      expect(gremlinService.upsertVertex).toHaveBeenCalledWith({
        id: 'role-1',
        pk: 'role-1',
        defaultProperties: { type: 'role', name: 'admin' },
        updatedProperties: { sensitive: true, description: 'Admin role' },
      });
    });
  });

  describe('delete', () => {
    it('drops the role vertex', async () => {
      gremlinService.dropVertex.mockResolvedValue(undefined);

      await service.delete('role-1');

      expect(gremlinService.dropVertex).toHaveBeenCalledWith('role-1', 'role');
    });
  });

  describe('addApplicationAssociation', () => {
    it('creates bidirectional edges', async () => {
      gremlinService.upsertEdge.mockResolvedValue(undefined);

      await service.addApplicationAssociation(
        { id: 'role-1', name: 'admin', sensitive: false, description: '' },
        'app-1',
      );

      expect(gremlinService.upsertEdge).toHaveBeenCalledTimes(2);
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'contains', sourceVertexId: 'app-1' }),
      );
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'contained by', sourceVertexId: 'role-1' }),
      );
    });
  });

  describe('getPermissionRequests', () => {
    it('returns permission requests for the role', async () => {
      const prVertex = {
        id: 'pr-1',
        label: 'permissionRequest',
        properties: [
          { key: 'requestor', value: 'user-1' },
          { key: 'createDate', value: '2024-01-01' },
          { key: 'status', value: 'PENDING' },
          { key: 'permissionType', value: 'Role' },
          { key: 'sourceEnvironmentId', value: 'env-1' },
          { key: 'sourceEnvironmentName', value: 'app-dev' },
          { key: 'targetEnvironmentId', value: 'env-2' },
          { key: 'targetEnvironmentName', value: 'app-prod' },
          { key: 'targetPermissionName', value: 'admin' },
          { key: 'targetPermissionId', value: 'role-1' },
        ],
      };
      gremlinService.submit.mockResolvedValue({ _items: [prVertex] });

      const result = await service.getPermissionRequests('role-1');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING');
    });
  });

  describe('syncRoles', () => {
    it('updates and associates each role', async () => {
      gremlinService.upsertVertex.mockResolvedValue(mockRoleVertex);
      gremlinService.upsertEdge.mockResolvedValue(undefined);

      await service.syncRoles('app-1', [
        {
          id: 'role-1',
          displayName: 'admin',
          sensitive: true,
          description: 'Admin',
          allowedMemberTypes: ['Application'],
          value: 'admin',
        },
      ]);

      expect(gremlinService.upsertVertex).toHaveBeenCalledTimes(1);
      expect(gremlinService.upsertEdge).toHaveBeenCalledTimes(2);
    });
  });
});
