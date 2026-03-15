import { Test, TestingModule } from '@nestjs/testing';
import { GroupService } from './group.service';
import { GremlinService } from '../gremlin/gremlin.service';
import { PontifexAadService } from '../pontifex-aad/pontifex-aad.service';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';

describe('GroupService', () => {
  let service: GroupService;
  let gremlinService: jest.Mocked<GremlinService>;

  const mockGroupCreate = jest.fn();
  const mockGroupGetMembers = jest.fn();
  const mockGroupGetOwners = jest.fn();

  const mockGroupVertex = {
    id: 'aad-group-id',
    properties: [
      { key: 'name', value: 'TestGroup' },
      { key: 'normalizedName', value: 'testgroup' },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGroupCreate.mockResolvedValue({ id: 'aad-group-id', displayName: 'TestGroup' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        {
          provide: GremlinService,
          useValue: {
            upsertVertex: jest.fn().mockResolvedValue(mockGroupVertex),
            upsertEdge: jest.fn(),
            dropEdge: jest.fn(),
            getVertexAndChildren: jest.fn(),
            submit: jest.fn(),
          },
        },
        {
          provide: PontifexAadService,
          useValue: {
            Instance: {
              group: {
                create: mockGroupCreate,
                getMembers: mockGroupGetMembers,
                getOwners: mockGroupGetOwners,
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get(GroupService);
    gremlinService = module.get(GremlinService) as jest.Mocked<GremlinService>;
  });

  describe('create', () => {
    it('should create a group in Azure AD', async () => {
      await service.create('TestGroup', 'creator-id');

      expect(mockGroupCreate).toHaveBeenCalledWith('TestGroup');
    });

    it('should create a group vertex in Gremlin', async () => {
      await service.create('TestGroup', 'creator-id');

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith({
        id: 'aad-group-id',
        pk: 'aad-group-id',
        defaultProperties: {
          type: 'group',
        },
        updatedProperties: {
          name: 'TestGroup',
          normalizedName: 'testgroup',
        },
      });
    });

    it('should set the creator as owner', async () => {
      await service.create('TestGroup', 'creator-id');

      expect(gremlinService.upsertEdge).toHaveBeenCalledWith({
        label: 'owns',
        sourceVertexId: 'creator-id',
        sourceVertexPk: 'creator-id',
        destinationVertexId: 'aad-group-id',
        destinationVertexPk: 'aad-group-id',
      });

      expect(gremlinService.upsertEdge).toHaveBeenCalledWith({
        label: 'owned by',
        sourceVertexId: 'aad-group-id',
        sourceVertexPk: 'aad-group-id',
        destinationVertexId: 'creator-id',
        destinationVertexPk: 'creator-id',
      });
    });

    it('should return the created group', async () => {
      const result = await service.create('TestGroup', 'creator-id');

      expect(result).toEqual({
        id: 'aad-group-id',
        name: 'TestGroup',
        normalizedName: 'testgroup',
      });
    });
  });

  describe('get', () => {
    it('should return a group bundle with owners, members, and owned applications', async () => {
      const ownerVertex = {
        id: 'owner-1', properties: [
          { key: 'name', value: 'Owner' },
          { key: 'normalizedName', value: 'owner' },
          { key: 'email', value: 'owner@test.com' },
        ],
      };
      const memberVertex = {
        id: 'member-1', properties: [
          { key: 'name', value: 'Member' },
          { key: 'normalizedName', value: 'member' },
          { key: 'email', value: 'member@test.com' },
        ],
      };

      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: mockGroupVertex,
        connections: {
          'owned by': { user: [ownerVertex] },
          'has member': { user: [memberVertex] },
          owns: { application: [] },
        },
      } as any);

      const result = await service.get('aad-group-id');

      expect(result.group.name).toBe('TestGroup');
      expect(result.owners).toHaveLength(1);
      expect(result.owners[0].name).toBe('Owner');
      expect(result.members).toHaveLength(1);
      expect(result.members[0].name).toBe('Member');
    });

    it('should throw ResourceNotFoundException if group not found', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: null,
        connections: {},
      } as any);

      await expect(service.get('nonexistent')).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('addMember', () => {
    it('should create bidirectional edges', async () => {
      await service.addMember('group-1', 'user-1');

      expect(gremlinService.upsertEdge).toHaveBeenCalledWith({
        label: 'member of',
        sourceVertexId: 'user-1',
        sourceVertexPk: 'user-1',
        destinationVertexId: 'group-1',
        destinationVertexPk: 'group-1',
      });

      expect(gremlinService.upsertEdge).toHaveBeenCalledWith({
        label: 'has member',
        sourceVertexId: 'group-1',
        sourceVertexPk: 'group-1',
        destinationVertexId: 'user-1',
        destinationVertexPk: 'user-1',
      });
    });
  });

  describe('removeMember', () => {
    it('should drop bidirectional edges', async () => {
      await service.removeMember('group-1', 'user-1');

      expect(gremlinService.dropEdge).toHaveBeenCalledWith('user-1.user-1-member of-group-1.group-1');
      expect(gremlinService.dropEdge).toHaveBeenCalledWith('group-1.group-1-has member-user-1.user-1');
    });
  });

  describe('sync', () => {
    const groupVertex = {
      id: 'group-1',
      properties: [
        { key: 'name', value: 'SyncGroup' },
        { key: 'normalizedName', value: 'syncgroup' },
      ],
    };

    const makeUserVertex = (id: string, name: string) => ({
      id,
      properties: [
        { key: 'name', value: name },
        { key: 'normalizedName', value: name.toLowerCase() },
        { key: 'email', value: `${name}@test.com` },
      ],
    });

    beforeEach(() => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: groupVertex,
        connections: {
          'owned by': { user: [makeUserVertex('owner-old', 'OldOwner')] },
          'has member': { user: [makeUserVertex('member-old', 'OldMember')] },
          owns: { application: [] },
        },
      } as any);
    });

    it('should add members present in AAD but missing from Gremlin', async () => {
      mockGroupGetMembers.mockResolvedValue([
        { id: 'member-old' },
        { id: 'member-new' },
      ]);
      mockGroupGetOwners.mockResolvedValue([{ id: 'owner-old' }]);

      const result = await service.sync('group-1');

      expect(result.membersAdded).toEqual(['member-new']);
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'member of', sourceVertexId: 'member-new' }),
      );
    });

    it('should remove members present in Gremlin but missing from AAD', async () => {
      mockGroupGetMembers.mockResolvedValue([]);
      mockGroupGetOwners.mockResolvedValue([{ id: 'owner-old' }]);

      const result = await service.sync('group-1');

      expect(result.membersRemoved).toEqual(['member-old']);
      expect(gremlinService.dropEdge).toHaveBeenCalledWith('member-old.member-old-member of-group-1.group-1');
    });

    it('should add owners present in AAD but missing from Gremlin', async () => {
      mockGroupGetMembers.mockResolvedValue([{ id: 'member-old' }]);
      mockGroupGetOwners.mockResolvedValue([
        { id: 'owner-old' },
        { id: 'owner-new' },
      ]);

      const result = await service.sync('group-1');

      expect(result.ownersAdded).toEqual(['owner-new']);
      expect(gremlinService.upsertEdge).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'owns', sourceVertexId: 'owner-new' }),
      );
    });

    it('should remove owners present in Gremlin but missing from AAD', async () => {
      mockGroupGetMembers.mockResolvedValue([{ id: 'member-old' }]);
      mockGroupGetOwners.mockResolvedValue([]);

      const result = await service.sync('group-1');

      expect(result.ownersRemoved).toEqual(['owner-old']);
      expect(gremlinService.dropEdge).toHaveBeenCalledWith('owner-old.owner-old-owns-group-1.group-1');
    });

    it('should return no changes when AAD and Gremlin are in sync', async () => {
      mockGroupGetMembers.mockResolvedValue([{ id: 'member-old' }]);
      mockGroupGetOwners.mockResolvedValue([{ id: 'owner-old' }]);

      const result = await service.sync('group-1');

      expect(result.membersAdded).toEqual([]);
      expect(result.membersRemoved).toEqual([]);
      expect(result.ownersAdded).toEqual([]);
      expect(result.ownersRemoved).toEqual([]);
    });
  });
});
