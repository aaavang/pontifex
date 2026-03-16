import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationController } from './application.controller';
import { ApplicationService } from './application.service';
import { EnvironmentService } from '../environment/environment.service';
import { RoleService } from '../role/role.service';
import { ScopeService } from '../scope/scope.service';
import { PontifexAadService } from '../pontifex-aad/pontifex-aad.service';
import { ApplicationOrchestrationService } from './application-orchestration.service';
import { Reflector } from '@nestjs/core';

describe('ApplicationController', () => {
  let controller: ApplicationController;
  let applicationService: jest.Mocked<ApplicationService>;
  let environmentService: jest.Mocked<EnvironmentService>;
  let orchestrationService: jest.Mocked<ApplicationOrchestrationService>;

  const mockAppBundle = {
    application: { id: 'app-1', name: 'my-app', creator: 'user-1', description: '' },
    environments: [],
    owners: [],
    ownerGroups: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationController],
      providers: [
        Reflector,
        {
          provide: ApplicationService,
          useValue: {
            getAll: jest.fn(),
            get: jest.fn(),
            getAllByUser: jest.fn(),
            searchByPrefix: jest.fn(),
            getAuditEvents: jest.fn(),
            update: jest.fn(),
            addUserOwnerAssociation: jest.fn(),
            removeUserOwnerAssociation: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            get: jest.fn(),
            update: jest.fn(),
            addApplicationAssociation: jest.fn(),
            getAllForApplication: jest.fn(),
            updateEnvironmentRoles: jest.fn(),
          },
        },
        {
          provide: RoleService,
          useValue: {
            get: jest.fn(),
            getPermissionRequests: jest.fn(),
            syncRoles: jest.fn(),
          },
        },
        {
          provide: ScopeService,
          useValue: {
            syncScopes: jest.fn(),
          },
        },
        {
          provide: ApplicationOrchestrationService,
          useValue: {
            deleteApplication: jest.fn(),
            updateApplicationRoles: jest.fn(),
          },
        },
        {
          provide: PontifexAadService,
          useValue: {
            Instance: {
              application: {
                create: jest.fn(),
                get: jest.fn(),
                update: jest.fn(),
              },
              servicePrincipal: {
                create: jest.fn(),
              },
              oauth2: {
                grantPermission: jest.fn(),
              },
            },
          },
        },
      ],
    }).compile();

    controller = module.get(ApplicationController);
    applicationService = module.get(ApplicationService);
    environmentService = module.get(EnvironmentService);
    orchestrationService = module.get(ApplicationOrchestrationService);
  });

  describe('getApplications', () => {
    it('returns all applications', async () => {
      applicationService.getAll.mockResolvedValue([mockAppBundle.application]);

      const result = await controller.getApplications({} as any);

      expect(result).toEqual({ applications: [mockAppBundle.application] });
    });
  });

  describe('searchApplications', () => {
    it('returns applications matching prefix', async () => {
      applicationService.searchByPrefix.mockResolvedValue([mockAppBundle.application]);

      const result = await controller.searchApplications('my');

      expect(result).toEqual({ applications: [mockAppBundle.application] });
    });
  });

  describe('getOwnedApplications', () => {
    it('returns applications owned by the requesting user', async () => {
      applicationService.getAllByUser.mockResolvedValue([mockAppBundle.application]);

      const result = await controller.getOwnedApplications({ user: { id: 'user-1' } });

      expect(result).toEqual({ applications: [mockAppBundle.application] });
      expect(applicationService.getAllByUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getApplicationById', () => {
    it('returns the application bundle', async () => {
      applicationService.get.mockResolvedValue(mockAppBundle);

      const result = await controller.getApplicationById('app-1');

      expect(result).toEqual(mockAppBundle);
    });
  });

  describe('getApplicationAuditEvents', () => {
    it('returns audit events', async () => {
      const events = [{ action: 'CREATE', value: 'test' }];
      applicationService.getAuditEvents.mockResolvedValue(events as any);

      const result = await controller.getApplicationAuditEvents('app-1');

      expect(result).toEqual({ events });
    });
  });

  describe('deleteApplication', () => {
    it('deletes the application and returns the id', async () => {
      orchestrationService.deleteApplication.mockResolvedValue(undefined);

      const result = await controller.deleteApplication('app-1');

      expect(result).toEqual({ id: 'app-1' });
      expect(orchestrationService.deleteApplication).toHaveBeenCalledWith('app-1');
    });
  });

  describe('getEnvironmentsForApplication', () => {
    it('returns environments for the application', async () => {
      const envs = [{ id: 'env-1', name: 'app-dev', level: 'dev', clientId: 'c1', spaRedirectUrls: [], webRedirectUrls: [] }];
      environmentService.getAllForApplication.mockResolvedValue(envs);

      const result = await controller.getEnvironmentsForApplication('app-1');

      expect(result).toEqual({ environments: envs });
    });
  });

  describe('updateApplicationOwners', () => {
    it('adds new owners and removes old ones', async () => {
      applicationService.get.mockResolvedValue({
        ...mockAppBundle,
        owners: [{ id: 'user-1', name: 'User 1', email: '', normalizedName: '' }],
        ownerGroups: [],
      });

      await controller.updateApplicationOwners('app-1', { ownerIds: ['user-2'] });

      expect(applicationService.addUserOwnerAssociation).toHaveBeenCalledWith('app-1', 'user-2');
      expect(applicationService.removeUserOwnerAssociation).toHaveBeenCalledWith('app-1', 'user-1');
    });
  });
});
