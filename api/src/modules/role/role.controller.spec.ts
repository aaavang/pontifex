import { Test, TestingModule } from '@nestjs/testing';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { Reflector } from '@nestjs/core';

describe('RoleController', () => {
  let controller: RoleController;
  let roleService: jest.Mocked<RoleService>;

  const mockRoleBundle = {
    role: { id: 'role-1', name: 'admin', sensitive: true, description: 'Admin role' },
    environment: { id: 'env-1', name: 'app-dev', level: 'dev', clientId: 'c1', spaRedirectUrls: [], webRedirectUrls: [] },
    requests: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleController],
      providers: [
        Reflector,
        {
          provide: RoleService,
          useValue: {
            get: jest.fn(),
            getOwners: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(RoleController);
    roleService = module.get(RoleService);
  });

  describe('getRoleById', () => {
    it('returns the role bundle', async () => {
      roleService.get.mockResolvedValue(mockRoleBundle);

      const result = await controller.getRoleById('role-1');

      expect(result).toEqual(mockRoleBundle);
    });
  });

  describe('getRoleOwnersById', () => {
    it('returns the owners of a role', async () => {
      const owners = [{ id: 'user-1', name: 'John', email: 'john@example.com', normalizedName: 'john' }];
      roleService.getOwners.mockResolvedValue(owners);

      const result = await controller.getRoleOwnersById('role-1');

      expect(result).toEqual({ owners });
    });
  });
});
