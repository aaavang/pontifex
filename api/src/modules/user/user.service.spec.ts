import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { GremlinService } from '../gremlin/gremlin.service';
import { GraphQueryService } from '../gremlin/graph-query.service';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';

describe('UserService', () => {
  let service: UserService;
  let gremlinService: jest.Mocked<GremlinService>;
  let graphQueryService: jest.Mocked<GraphQueryService>;

  const mockUserVertex = {
    id: 'user-1',
    label: 'user',
    properties: [
      { key: 'name', value: 'John Doe' },
      { key: 'email', value: 'john@example.com' },
      { key: 'normalizedName', value: 'john doe' },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: GremlinService,
          useValue: {
            getVertexAndChildren: jest.fn(),
            upsertVertex: jest.fn(),
            dropVertex: jest.fn(),
            submit: jest.fn(),
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

    service = module.get(UserService);
    gremlinService = module.get(GremlinService);
    graphQueryService = module.get(GraphQueryService);
  });

  describe('get', () => {
    it('returns a user bundle using GraphQueryService.getApplicationsForUser', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: mockUserVertex,
        connections: {},
      });

      const mockApps = [{ id: 'app-1', name: 'MyApp', creator: 'user-1', description: '' }];
      graphQueryService.getApplicationsForUser.mockResolvedValue(mockApps as any);

      const result = await service.get('user-1');

      expect(result.user.name).toBe('John Doe');
      expect(result.ownedApplications).toEqual(mockApps);
      expect(graphQueryService.getApplicationsForUser).toHaveBeenCalledWith('user-1');
    });

    it('returns empty permission request defaults', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: mockUserVertex,
        connections: {},
      });

      const result = await service.get('user-1');

      expect(result.pendingPermissionRequests).toEqual([]);
      expect(result.groupedPendingPermissionRequests).toEqual({});
    });

    it('throws ResourceNotFoundException when user is not found', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: null,
        connections: {},
      });

      await expect(service.get('missing')).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('update', () => {
    it('upserts a user vertex and returns the user', async () => {
      gremlinService.upsertVertex.mockResolvedValue(mockUserVertex);

      const result = await service.update({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        normalizedName: 'john doe',
      });

      expect(result.name).toBe('John Doe');
    });
  });

  describe('delete', () => {
    it('drops the user vertex', async () => {
      gremlinService.dropVertex.mockResolvedValue(undefined);

      await service.delete('user-1');

      expect(gremlinService.dropVertex).toHaveBeenCalledWith('user-1', 'user');
    });
  });

  describe('searchByPrefix', () => {
    it('returns users matching the prefix', async () => {
      gremlinService.submit.mockResolvedValue({ _items: [mockUserVertex] });

      const result = await service.searchByPrefix('john');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John Doe');
    });
  });
});
