import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ApplicationTokenGroupController } from './application-token-group.controller';
import { ApplicationService } from '../application/application.service';
import { TokenGroupService } from '../token-group/token-group.service';
import { GremlinService } from '../gremlin/gremlin.service';

describe('ApplicationTokenGroupController', () => {
  let controller: ApplicationTokenGroupController;
  let applicationService: jest.Mocked<ApplicationService>;
  let tokenGroupService: jest.Mocked<TokenGroupService>;
  let gremlinService: jest.Mocked<GremlinService>;

  const mockEnv = {
    id: 'env-1',
    name: 'my-app-dev',
    level: 'dev',
    clientId: 'client-1',
    spaRedirectUrls: [],
    webRedirectUrls: [],
  };

  const mockAppBundle = {
    application: { id: 'app-1', name: 'my-app', creator: 'user-1', description: '' },
    environments: [mockEnv],
    owners: [],
    ownerGroups: [],
  };

  const mockTokenGroup = {
    id: 'tg-1',
    name: 'My Group',
    envId: 'env-1',
    appRoleId: 'role-1',
    appRoleAssignmentId: 'assignment-1',
    groupId: 'group-1',
    claimValue: 'my.claim',
    description: 'A token group',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationTokenGroupController],
      providers: [
        Reflector,
        {
          provide: ApplicationService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: TokenGroupService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: GremlinService,
          useValue: {
            upsertVertex: jest.fn(),
            submit: jest.fn(),
            dropVertex: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ApplicationTokenGroupController);
    applicationService = module.get(ApplicationService);
    tokenGroupService = module.get(TokenGroupService);
    gremlinService = module.get(GremlinService);
  });

  describe('create', () => {
    it('creates a token group on each environment', async () => {
      applicationService.get.mockResolvedValue(mockAppBundle as any);
      tokenGroupService.create.mockResolvedValue(mockTokenGroup);

      const dto = {
        name: 'My Group',
        claimValue: 'my.claim',
        groupId: 'group-1',
        description: 'A token group',
      };

      const result = await controller.create('app-1', dto);

      expect(applicationService.get).toHaveBeenCalledWith('app-1');
      expect(tokenGroupService.create).toHaveBeenCalledWith('env-1', 'client-1', dto);
      expect(result).toEqual({ tokenGroups: [mockTokenGroup] });
    });

    it('creates a token group on multiple environments', async () => {
      const secondEnv = { ...mockEnv, id: 'env-2', clientId: 'client-2', name: 'my-app-staging' };
      applicationService.get.mockResolvedValue({
        ...mockAppBundle,
        environments: [mockEnv, secondEnv],
      } as any);

      const secondTokenGroup = { ...mockTokenGroup, id: 'tg-2', envId: 'env-2' };
      tokenGroupService.create
        .mockResolvedValueOnce(mockTokenGroup)
        .mockResolvedValueOnce(secondTokenGroup);

      const dto = {
        name: 'My Group',
        claimValue: 'my.claim',
        groupId: 'group-1',
        description: 'A token group',
      };

      const result = await controller.create('app-1', dto);

      expect(tokenGroupService.create).toHaveBeenCalledTimes(2);
      expect(tokenGroupService.create).toHaveBeenCalledWith('env-1', 'client-1', dto);
      expect(tokenGroupService.create).toHaveBeenCalledWith('env-2', 'client-2', dto);
      expect(result).toEqual({ tokenGroups: [mockTokenGroup, secondTokenGroup] });
    });
  });

  describe('update', () => {
    it('updates the token group description', async () => {
      gremlinService.upsertVertex.mockResolvedValue(undefined);

      const result = await controller.update('app-1', 'tg-1', { description: 'Updated desc' });

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith({
        id: 'tg-1',
        pk: 'tg-1',
        updatedProperties: {
          description: 'Updated desc',
        },
      });
      expect(result).toEqual({ id: 'tg-1' });
    });
  });

  describe('remove', () => {
    it('finds token groups by name and drops them', async () => {
      gremlinService.submit.mockResolvedValue({ _items: [{ id: 'tg-1' }] } as any);
      gremlinService.dropVertex.mockResolvedValue(undefined);

      const result = await controller.remove('app-1', { name: 'My Group' });

      expect(gremlinService.submit).toHaveBeenCalledWith(
        "g.V().has('type', type).has('name', name)",
        { type: 'tokenGroup', name: 'My Group' },
      );
      expect(gremlinService.dropVertex).toHaveBeenCalledWith('tg-1', 'tokenGroup');
      expect(result).toEqual({ name: 'My Group' });
    });

    it('drops multiple vertices when multiple match', async () => {
      gremlinService.submit.mockResolvedValue({
        _items: [{ id: 'tg-1' }, { id: 'tg-2' }],
      } as any);
      gremlinService.dropVertex.mockResolvedValue(undefined);

      await controller.remove('app-1', { name: 'My Group' });

      expect(gremlinService.dropVertex).toHaveBeenCalledTimes(2);
      expect(gremlinService.dropVertex).toHaveBeenCalledWith('tg-1', 'tokenGroup');
      expect(gremlinService.dropVertex).toHaveBeenCalledWith('tg-2', 'tokenGroup');
    });

    it('handles no matching vertices gracefully', async () => {
      gremlinService.submit.mockResolvedValue({ _items: [] } as any);

      const result = await controller.remove('app-1', { name: 'Nonexistent' });

      expect(gremlinService.dropVertex).not.toHaveBeenCalled();
      expect(result).toEqual({ name: 'Nonexistent' });
    });
  });
});
