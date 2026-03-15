import { Test, TestingModule } from '@nestjs/testing';
import { ScopeService } from './scope.service';
import { GremlinService } from '../gremlin/gremlin.service';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';

describe('ScopeService', () => {
  let service: ScopeService;
  let gremlinService: jest.Mocked<GremlinService>;

  const mockScopeVertex = {
    id: 'scope-1',
    properties: {
      name: [{ value: 'User.Read' }],
      displayName: [{ value: 'Read user profile' }],
      description: [{ value: 'Allows reading user profile' }],
    },
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
        ScopeService,
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

    service = module.get(ScopeService);
    gremlinService = module.get(GremlinService);
  });

  describe('get', () => {
    it('returns a scope bundle', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: mockScopeVertex,
        connections: {
          'contained by': { environment: [mockEnvVertex] },
        },
      });

      const result = await service.get('scope-1');

      expect(result.scope.name).toBe('User.Read');
      expect(result.scope.displayName).toBe('Read user profile');
    });

    it('throws ResourceNotFoundException when scope is not found', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: null,
        connections: {},
      });

      await expect(service.get('missing')).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('update', () => {
    it('upserts a scope vertex', async () => {
      gremlinService.upsertVertex.mockResolvedValue(mockScopeVertex);

      await service.update({
        id: 'scope-1',
        name: 'User.Read',
        displayName: 'Read user profile',
        description: 'Allows reading user profile',
      });

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith({
        id: 'scope-1',
        pk: 'scope-1',
        defaultProperties: { type: 'scope', name: 'User.Read' },
        updatedProperties: { displayName: 'Read user profile', description: 'Allows reading user profile' },
      });
    });
  });

  describe('delete', () => {
    it('drops the scope vertex', async () => {
      gremlinService.dropVertex.mockResolvedValue(undefined);

      await service.delete('scope-1');

      expect(gremlinService.dropVertex).toHaveBeenCalledWith('scope-1', 'scope');
    });
  });

  describe('addApplicationAssociation', () => {
    it('creates bidirectional edges', async () => {
      gremlinService.upsertEdge.mockResolvedValue(undefined);

      await service.addApplicationAssociation(
        { id: 'scope-1', name: 'User.Read', displayName: 'Read', description: '' },
        'app-1',
      );

      expect(gremlinService.upsertEdge).toHaveBeenCalledTimes(2);
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'contains', sourceVertexId: 'app-1' }),
      );
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'contained by', sourceVertexId: 'scope-1' }),
      );
    });
  });

  describe('getPermissionRequests', () => {
    it('returns permission requests for the scope', async () => {
      const prVertex = {
        id: 'pr-1',
        label: 'permissionRequest',
        properties: [
          { key: 'requestor', value: 'user-1' },
          { key: 'createDate', value: '2024-01-01' },
          { key: 'status', value: 'PENDING' },
          { key: 'permissionType', value: 'Scope' },
          { key: 'sourceEnvironmentId', value: 'env-1' },
          { key: 'sourceEnvironmentName', value: 'app-dev' },
          { key: 'targetEnvironmentId', value: 'env-2' },
          { key: 'targetEnvironmentName', value: 'app-prod' },
          { key: 'targetPermissionName', value: 'User.Read' },
          { key: 'targetPermissionId', value: 'scope-1' },
        ],
      };
      gremlinService.submit.mockResolvedValue({ _items: [prVertex] });

      const result = await service.getPermissionRequests('scope-1');

      expect(result).toHaveLength(1);
      expect(result[0].permissionType).toBe('Scope');
    });
  });

  describe('syncScopes', () => {
    it('updates and associates each scope', async () => {
      gremlinService.upsertVertex.mockResolvedValue(mockScopeVertex);
      gremlinService.upsertEdge.mockResolvedValue(undefined);

      await service.syncScopes('app-1', [
        {
          id: 'scope-1',
          value: 'User.Read',
          userConsentDisplayName: 'Read profile',
          userConsentDescription: 'Allows reading',
          type: 'User',
        },
      ]);

      expect(gremlinService.upsertVertex).toHaveBeenCalledTimes(1);
      expect(gremlinService.upsertEdge).toHaveBeenCalledTimes(2);
    });
  });
});
