import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationService } from './application.service';
import { GraphQueryService } from '../gremlin/graph-query.service';
import { GremlinService } from '../gremlin/gremlin.service';
import { EnvironmentService } from '../environment/environment.service';
import { PontifexAadService } from '../pontifex-aad/pontifex-aad.service';
import { PermissionRequestService } from '../permission-request/permission-request.service';
import { PasswordService } from '../password/password.service';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';

describe('ApplicationService', () => {
  let service: ApplicationService;
  let gremlinService: jest.Mocked<GremlinService>;
  let environmentService: jest.Mocked<EnvironmentService>;
  let pontifexAadService: jest.Mocked<PontifexAadService>;
  let permissionRequestService: jest.Mocked<PermissionRequestService>;
  let passwordService: jest.Mocked<PasswordService>;

  const mockVertex = {
    id: 'app-1',
    label: 'application',
    properties: [
      { key: 'name', value: 'my-app' },
      { key: 'creator', value: 'user-1' },
      { key: 'description', value: 'desc' },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationService,
        {
          provide: GremlinService,
          useValue: {
            getVertexAndChildren: jest.fn(),
            getAllVerticesOfType: jest.fn(),
            upsertVertex: jest.fn(),
            upsertEdge: jest.fn(),
            dropVertex: jest.fn(),
            dropEdge: jest.fn(),
            submit: jest.fn(),
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            get: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: PontifexAadService,
          useValue: {
            Instance: {
              application: {
                get: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
              },
            },
          },
        },
        {
          provide: PermissionRequestService,
          useValue: {
            delete: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: PasswordService,
          useValue: {
            delete: jest.fn(),
          },
        },
        {
          provide: GraphQueryService,
          useValue: {
            getApplicationsForUser: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(ApplicationService);
    gremlinService = module.get(GremlinService);
    environmentService = module.get(EnvironmentService);
    pontifexAadService = module.get(PontifexAadService);
    permissionRequestService = module.get(PermissionRequestService);
    passwordService = module.get(PasswordService);
  });

  describe('get', () => {
    it('returns an application bundle', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: mockVertex,
        connections: {
          contains: { environment: [] },
          'owned by': { user: [], group: [] },
        },
      });

      const result = await service.get('app-1');

      expect(result.application).toEqual({
        id: 'app-1',
        name: 'my-app',
        creator: 'user-1',
        description: 'desc',
      });
      expect(result.environments).toEqual([]);
      expect(result.owners).toEqual([]);
    });

    it('throws ResourceNotFoundException when vertex is not found', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: null,
        connections: {},
      });

      await expect(service.get('missing')).rejects.toThrow(ResourceNotFoundException);
    });

    it('throws when id is empty', async () => {
      await expect(service.get('')).rejects.toThrow('id cannot be empty or undefined');
    });
  });

  describe('getAll', () => {
    it('returns all applications', async () => {
      gremlinService.getAllVerticesOfType.mockResolvedValue([mockVertex]);

      const result = await service.getAll();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('my-app');
    });
  });

  describe('getAllByUser', () => {
    it('returns applications owned by user', async () => {
      gremlinService.submit.mockResolvedValue({ _items: [mockVertex] });

      const result = await service.getAllByUser('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('my-app');
    });

    it('throws when userId is empty', async () => {
      await expect(service.getAllByUser('')).rejects.toThrow('userId cannot be empty or undefined');
    });
  });

  describe('update', () => {
    it('upserts the application vertex', async () => {
      gremlinService.upsertVertex.mockResolvedValue(undefined);

      await service.update({
        id: 'app-1',
        name: 'my-app',
        creator: 'user-1',
        description: 'updated',
      });

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith({
        id: 'app-1',
        pk: 'app-1',
        defaultProperties: { type: 'application', creator: 'user-1' },
        updatedProperties: { name: 'my-app', description: 'updated' },
      });
    });
  });

  describe('addUserOwnerAssociation', () => {
    it('creates bidirectional ownership edges', async () => {
      gremlinService.upsertEdge.mockResolvedValue(undefined);

      await service.addUserOwnerAssociation('app-1', 'user-1');

      expect(gremlinService.upsertEdge).toHaveBeenCalledTimes(2);

      const ownsEdge = gremlinService.upsertEdge.mock.calls[0][0];
      expect(ownsEdge.label).toBe('owns');
      expect(ownsEdge.sourceVertexId).toBe('user-1');
      expect(ownsEdge.destinationVertexId).toBe('app-1');

      const ownedByEdge = gremlinService.upsertEdge.mock.calls[1][0];
      expect(ownedByEdge.label).toBe('owned by');
      expect(ownedByEdge.sourceVertexId).toBe('app-1');
      expect(ownedByEdge.destinationVertexId).toBe('user-1');
    });
  });

  describe('removeUserOwnerAssociation', () => {
    it('drops both ownership edges', async () => {
      gremlinService.dropEdge.mockResolvedValue(undefined);

      await service.removeUserOwnerAssociation('app-1', 'user-1');

      expect(gremlinService.dropEdge).toHaveBeenCalledTimes(2);
      expect(gremlinService.dropEdge).toHaveBeenCalledWith('user-1.user-1-owns-app-1.app-1');
      expect(gremlinService.dropEdge).toHaveBeenCalledWith('app-1.app-1-owned by-user-1.user-1');
    });
  });

  describe('searchByPrefix', () => {
    it('returns applications matching the prefix', async () => {
      gremlinService.submit.mockResolvedValue({ _items: [mockVertex] });

      const result = await service.searchByPrefix('my');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('my-app');
    });
  });

  describe('getAuditEvents', () => {
    it('returns audit events for the application', async () => {
      const eventVertex = {
        id: 'event-1',
        properties: {
          createDate: [{ value: '2024-01-01' }],
          action: [{ value: 'CREATE' }],
          value: [{ value: 'test' }],
        },
      };
      gremlinService.submit.mockResolvedValue({ _items: [eventVertex] });

      const result = await service.getAuditEvents('app-1');

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('CREATE');
    });
  });

  describe('delete', () => {
    it('throws when id is empty', async () => {
      await expect(service.delete('')).rejects.toThrow('id cannot be empty or undefined');
    });
  });

  describe('setOwningGroup', () => {
    it('throws when groupId is empty', async () => {
      await expect(service.setOwningGroup('app-1', '')).rejects.toThrow(
        'id cannot be empty or undefined',
      );
    });

    it('upserts the owningGroup property', async () => {
      gremlinService.upsertVertex.mockResolvedValue(undefined);

      await service.setOwningGroup('app-1', 'group-1');

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith({
        id: 'app-1',
        pk: 'app-1',
        updatedProperties: { owningGroup: 'group-1' },
      });
    });
  });
});
