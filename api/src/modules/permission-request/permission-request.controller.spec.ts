import { Test, TestingModule } from '@nestjs/testing';
import { PermissionRequestController } from './permission-request.controller';
import { PermissionRequestService } from './permission-request.service';
import { Reflector } from '@nestjs/core';

describe('PermissionRequestController', () => {
  let controller: PermissionRequestController;
  let service: jest.Mocked<PermissionRequestService>;

  const mockPrBundle = {
    permissionRequest: {
      id: 'pr-1',
      requestor: 'user-1',
      createDate: '2024-01-01',
      status: 'PENDING',
      permissionType: 'Role',
    },
    sourceEnvironment: { id: 'env-1', name: 'app-dev' },
    targetRole: { id: 'role-1', name: 'admin' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionRequestController],
      providers: [
        Reflector,
        {
          provide: PermissionRequestService,
          useValue: {
            get: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PermissionRequestController);
    service = module.get(PermissionRequestService);
  });

  describe('getPermissionRequestById', () => {
    it('returns the permission request bundle', async () => {
      service.get.mockResolvedValue(mockPrBundle as any);

      const result = await controller.getPermissionRequestById('pr-1');

      expect(result).toEqual(mockPrBundle);
      expect(service.get).toHaveBeenCalledWith('pr-1');
    });
  });

  describe('updatePermissionRequest', () => {
    it('updates the status to APPROVED', async () => {
      const updatedPr = { ...mockPrBundle.permissionRequest, status: 'APPROVED' };
      service.updateStatus.mockResolvedValue(updatedPr as any);

      const result = await controller.updatePermissionRequest('pr-1', { status: 'APPROVED' });

      expect(result.status).toBe('APPROVED');
      expect(service.updateStatus).toHaveBeenCalledWith('pr-1', 'APPROVED');
    });

    it('updates the status to REJECTED', async () => {
      const updatedPr = { ...mockPrBundle.permissionRequest, status: 'REJECTED' };
      service.updateStatus.mockResolvedValue(updatedPr as any);

      const result = await controller.updatePermissionRequest('pr-1', { status: 'REJECTED' });

      expect(result.status).toBe('REJECTED');
    });
  });
});
