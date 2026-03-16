import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SystemSettingsService } from './system-settings.service';
import { GremlinService } from '../gremlin/gremlin.service';
import { ApplicationService } from '../application/application.service';
import { EnvironmentService } from '../environment/environment.service';
import { GroupService } from '../group/group.service';
import { PontifexAadService } from '../pontifex-aad/pontifex-aad.service';
import { TokenGroupService } from '../token-group/token-group.service';
import { UserService } from '../user/user.service';

describe('SystemSettingsService', () => {
  let service: SystemSettingsService;
  let gremlinService: jest.Mocked<GremlinService>;
  let applicationService: jest.Mocked<ApplicationService>;
  let environmentService: jest.Mocked<EnvironmentService>;
  let groupService: jest.Mocked<GroupService>;
  let tokenGroupService: jest.Mocked<TokenGroupService>;

  const mockApplicationGetByAppId = jest.fn();
  const mockApplicationUpdate = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockApplicationGetByAppId.mockResolvedValue({ id: 'aad-app-object-id', appId: 'test-client-id', tags: [] });
    mockApplicationUpdate.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemSettingsService,
        {
          provide: GremlinService,
          useValue: {
            upsertVertex: jest.fn(),
            upsertEdge: jest.fn(),
          },
        },
        {
          provide: ApplicationService,
          useValue: {
            update: jest.fn(),
            addUserOwnerAssociation: jest.fn(),
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            update: jest.fn(),
            addApplicationAssociation: jest.fn(),
          },
        },
        {
          provide: GroupService,
          useValue: {
            ensureGroup: jest.fn().mockResolvedValue({
              group: { id: 'aad-group-id', name: 'Pontifex_Admins', normalizedName: 'pontifex_admins' },
              aadGroupId: 'aad-group-id',
            }),
            sync: jest.fn(),
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
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-client-id'),
          },
        },
        {
          provide: TokenGroupService,
          useValue: {
            createWithKnownIds: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SystemSettingsService);
    gremlinService = module.get(GremlinService) as jest.Mocked<GremlinService>;
    applicationService = module.get(ApplicationService) as jest.Mocked<ApplicationService>;
    environmentService = module.get(EnvironmentService) as jest.Mocked<EnvironmentService>;
    groupService = module.get(GroupService) as jest.Mocked<GroupService>;
    tokenGroupService = module.get(TokenGroupService) as jest.Mocked<TokenGroupService>;
  });

  describe('onApplicationBootstrap', () => {
    it('should create the system-settings base vertex', async () => {
      await service.onApplicationBootstrap();

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith({
        id: 'system-settings',
        pk: 'system-settings',
        defaultProperties: { type: 'systemSetting', name: 'system-settings' },
      });
    });

    it('should not throw if initialization fails', async () => {
      groupService.ensureGroup.mockRejectedValue(new Error('AAD unavailable'));

      await expect(service.onApplicationBootstrap()).resolves.not.toThrow();
    });
  });

  describe('Pontifex_Admins group', () => {
    it('should delegate group creation to GroupService.ensureGroup', async () => {
      await service.onApplicationBootstrap();

      expect(groupService.ensureGroup).toHaveBeenCalledWith(
        'Pontifex_Admins',
        'Pontifex administrators group',
      );
    });

    it('should sync the admin group membership from AAD', async () => {
      await service.onApplicationBootstrap();

      expect(groupService.sync).toHaveBeenCalledWith('aad-group-id');
    });
  });

  describe('environment levels setting', () => {
    it('should create the environment levels vertex with default values', async () => {
      await service.onApplicationBootstrap();

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith({
        id: 'setting-environment-levels',
        pk: 'setting-environment-levels',
        defaultProperties: {
          type: 'systemSetting',
          name: 'environment-levels',
          levels: ['dev', 'test', 'qa', 'prod'],
        },
      });
    });
  });

  describe('Pontifex application', () => {
    it('should create the Pontifex application via ApplicationService', async () => {
      await service.onApplicationBootstrap();

      expect(applicationService.update).toHaveBeenCalledWith({
        id: 'pontifex',
        name: 'Pontifex',
        creator: 'system',
        description: 'Pontifex application management platform',
      });
    });

    it('should create the Pontifex environment using the AAD app object ID', async () => {
      await service.onApplicationBootstrap();

      expect(mockApplicationGetByAppId).toHaveBeenCalledWith('test-client-id');
      expect(environmentService.update).toHaveBeenCalledWith({
        id: 'aad-app-object-id',
        name: 'Pontifex',
        level: 'prod',
        clientId: 'test-client-id',
        spaRedirectUrls: [],
        webRedirectUrls: [],
      });
    });

    it('should wire the application to its environment', async () => {
      await service.onApplicationBootstrap();

      expect(environmentService.addApplicationAssociation).toHaveBeenCalledWith('pontifex', 'aad-app-object-id');
    });

    it('should wire the admin group as owner via ApplicationService', async () => {
      await service.onApplicationBootstrap();

      expect(applicationService.addUserOwnerAssociation).toHaveBeenCalledWith('pontifex', 'aad-group-id');
    });

    it('should tag the Pontifex AAD app with pontifex-managed', async () => {
      await service.onApplicationBootstrap();

      expect(mockApplicationUpdate).toHaveBeenCalledWith('aad-app-object-id', {
        tags: ['pontifex-managed'],
        notes: JSON.stringify({pontifexAppId: 'pontifex', pontifexAppName: 'Pontifex'}),
      });
    });

    it('should skip tagging if the AAD app is already tagged', async () => {
      mockApplicationGetByAppId.mockResolvedValue({
        id: 'aad-app-object-id',
        appId: 'test-client-id',
        tags: ['pontifex-managed'],
      });

      await service.onApplicationBootstrap();

      expect(mockApplicationUpdate).not.toHaveBeenCalled();
    });

    it('should delegate token group creation using the AAD app object ID as envId', async () => {
      await service.onApplicationBootstrap();

      expect(tokenGroupService.createWithKnownIds).toHaveBeenCalledWith(
        'pontifex-admin-token-group',
        'aad-app-object-id',
        'test-client-id',
        {
          name: 'Pontifex_Admins',
          claimValue: 'Admin',
          groupId: 'aad-group-id',
          description: 'Pontifex administrators token group',
        },
      );
    });
  });
});
