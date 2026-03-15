import { Test, TestingModule } from '@nestjs/testing';
import { TokenGroupService } from './token-group.service';
import { GremlinService } from '../gremlin/gremlin.service';
import { PontifexAadService } from '../pontifex-aad/pontifex-aad.service';

// Stable UUID for tests
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

describe('TokenGroupService', () => {
  let service: TokenGroupService;
  let gremlinService: jest.Mocked<GremlinService>;

  const mockApplicationGetByAppId = jest.fn();
  const mockApplicationUpdate = jest.fn();
  const mockServicePrincipalGetByAppId = jest.fn();
  const mockGroupAddAppRoleAssignment = jest.fn();

  const appRegistration = { id: 'app-object-id', appId: 'client-id', appRoles: [] };
  const servicePrincipal = { id: 'sp-object-id', appId: 'client-id' };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockApplicationGetByAppId.mockResolvedValue(appRegistration);
    mockServicePrincipalGetByAppId.mockResolvedValue(servicePrincipal);
    mockGroupAddAppRoleAssignment.mockResolvedValue({ id: 'assignment-id' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenGroupService,
        {
          provide: GremlinService,
          useValue: {
            upsertVertex: jest.fn().mockResolvedValue({
              id: 'test-uuid',
              properties: {
                name: [{ value: 'TestGroup' }],
                envId: [{ value: 'env-1' }],
                appRoleId: [{ value: 'test-uuid' }],
                appRoleAssignmentId: [{ value: 'assignment-id' }],
                groupId: [{ value: 'group-1' }],
                claimValue: [{ value: 'TestClaim' }],
                description: [{ value: 'A test group' }],
              },
            }),
            upsertEdge: jest.fn(),
          },
        },
        {
          provide: PontifexAadService,
          useValue: {
            Instance: {
              application: {
                getByAppId: mockApplicationGetByAppId,
                update: mockApplicationUpdate,
              },
              servicePrincipal: {
                getByAppId: mockServicePrincipalGetByAppId,
              },
              group: {
                addAppRoleAssignment: mockGroupAddAppRoleAssignment,
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get(TokenGroupService);
    gremlinService = module.get(GremlinService) as jest.Mocked<GremlinService>;
  });

  describe('create', () => {
    const dto = {
      name: 'TestGroup',
      claimValue: 'TestClaim',
      groupId: 'group-1',
      description: 'A test group',
    };

    it('should look up the AAD app registration by clientId', async () => {
      await service.create('env-1', 'client-id', dto);

      expect(mockApplicationGetByAppId).toHaveBeenCalledWith('client-id');
    });

    it('should throw if AAD app not found', async () => {
      mockApplicationGetByAppId.mockResolvedValue(undefined);

      await expect(service.create('env-1', 'client-id', dto))
        .rejects.toThrow('AAD application not found for clientId: client-id');
    });

    it('should create the app role if it does not exist', async () => {
      await service.create('env-1', 'client-id', dto);

      expect(mockApplicationUpdate).toHaveBeenCalledWith(
        'app-object-id',
        expect.objectContaining({
          appRoles: [expect.objectContaining({
            displayName: 'TestGroup',
            value: 'TestClaim',
            isEnabled: true,
            allowedMemberTypes: ['Application', 'User'],
          })],
        }),
      );
    });

    it('should not create the app role if it already exists', async () => {
      mockApplicationGetByAppId.mockResolvedValue({
        ...appRegistration,
        appRoles: [{
          id: 'existing-role-id',
          value: 'TestClaim',
          displayName: 'TestGroup',
          isEnabled: true,
        }],
      });

      await service.create('env-1', 'client-id', dto);

      expect(mockApplicationUpdate).not.toHaveBeenCalled();
    });

    it('should assign the group to the app role via addAppRoleAssignment', async () => {
      await service.create('env-1', 'client-id', dto);

      expect(mockGroupAddAppRoleAssignment).toHaveBeenCalledWith(
        'group-1',
        'sp-object-id',
        'test-uuid',
      );
    });

    it('should create the token group vertex in Gremlin', async () => {
      await service.create('env-1', 'client-id', dto);

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-uuid',
        pk: 'test-uuid',
        defaultProperties: expect.objectContaining({
          type: 'tokenGroup',
          name: 'TestGroup',
          envId: 'env-1',
          groupId: 'group-1',
          claimValue: 'TestClaim',
          description: 'A test group',
          appRoleId: 'test-uuid',
          appRoleAssignmentId: 'assignment-id',
        }),
      }));
    });

    it('should wire bidirectional edges between environment and token group', async () => {
      await service.create('env-1', 'client-id', dto);

      expect(gremlinService.upsertEdge).toHaveBeenCalledWith({
        label: 'has token group',
        sourceVertexId: 'env-1',
        sourceVertexPk: 'env-1',
        destinationVertexId: 'test-uuid',
        destinationVertexPk: 'test-uuid',
      });

      expect(gremlinService.upsertEdge).toHaveBeenCalledWith({
        label: 'is user token group for',
        sourceVertexId: 'test-uuid',
        sourceVertexPk: 'test-uuid',
        destinationVertexId: 'env-1',
        destinationVertexPk: 'env-1',
      });
    });
  });

  describe('createWithKnownIds', () => {
    const dto = {
      name: 'AdminGroup',
      claimValue: 'Admin',
      groupId: 'admin-group-id',
      description: 'Admin token group',
    };

    it('should use the provided token group ID instead of generating one', async () => {
      await service.createWithKnownIds('known-tg-id', 'env-1', 'client-id', dto);

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith(expect.objectContaining({
        id: 'known-tg-id',
        pk: 'known-tg-id',
      }));
    });

    it('should store appRoleId and appRoleAssignmentId as updatedProperties', async () => {
      await service.createWithKnownIds('known-tg-id', 'env-1', 'client-id', dto);

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith(expect.objectContaining({
        defaultProperties: expect.objectContaining({
          type: 'tokenGroup',
          name: 'AdminGroup',
        }),
        updatedProperties: expect.objectContaining({
          appRoleAssignmentId: 'assignment-id',
        }),
      }));
    });
  });
});
