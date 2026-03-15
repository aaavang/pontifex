import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PermissionRequestService } from '../permission-request/permission-request.service';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;
  let permissionRequestService: jest.Mocked<PermissionRequestService>;

  const mockUserBundle = {
    user: { id: 'user-1', name: 'John Doe', email: 'john@example.com', normalizedName: 'john doe' },
    memberGroups: [],
    ownerGroups: [],
    ownedApplications: [],
    pendingPermissionRequests: [],
    groupedPendingPermissionRequests: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            get: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: PermissionRequestService,
          useValue: {
            getPendingForUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UserController);
    userService = module.get(UserService);
    permissionRequestService = module.get(PermissionRequestService);
  });

  describe('createUser', () => {
    it('creates a user from the JWT token', async () => {
      userService.update.mockResolvedValue(mockUserBundle.user);

      const req = {
        user: { oid: 'user-1', name: 'John Doe', preferred_username: 'john@example.com' },
      };

      const result = await controller.createUser(req);

      expect(result.user).toEqual(mockUserBundle.user);
      expect(userService.update).toHaveBeenCalledWith({
        id: 'user-1',
        name: 'John Doe',
        normalizedName: 'john doe',
        email: 'john@example.com',
      });
    });
  });

  describe('getCurrentUser', () => {
    it('returns the current user bundle', async () => {
      userService.get.mockResolvedValue(mockUserBundle);

      const req = { user: { oid: 'user-1' } };
      const result = await controller.getCurrentUser(req);

      expect(result).toEqual({ bundle: mockUserBundle });
      expect(userService.get).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getPendingPermissionRequests', () => {
    it('returns pending permission requests for the current user', async () => {
      const pendingPrs = [{ id: 'pr-1', status: 'PENDING' }];
      permissionRequestService.getPendingForUser.mockResolvedValue(pendingPrs as any);

      const req = { user: { oid: 'user-1' } };
      const result = await controller.getPendingPermissionRequests(req);

      expect(result).toEqual(pendingPrs);
    });
  });

  describe('getUserById', () => {
    it('returns the user bundle by id', async () => {
      userService.get.mockResolvedValue(mockUserBundle);

      const req = { params: { id: 'user-1' } };
      const result = await controller.getUserById(req);

      expect(result).toEqual({ bundle: mockUserBundle });
    });
  });
});
