import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from './password.service';
import { GremlinService } from '../gremlin/gremlin.service';
import { ResourceNotFoundException } from '../../common/exceptions/resource-not-found.exception';

describe('PasswordService', () => {
  let service: PasswordService;
  let gremlinService: jest.Mocked<GremlinService>;

  const mockPasswordVertex = {
    id: 'pw-1',
    label: 'password',
    properties: [
      { key: 'displayName', value: 'my-secret' },
      { key: 'start', value: '2024-01-01' },
      { key: 'end', value: '2025-01-01' },
      { key: 'password', value: 'secret-val' },
    ],
  };

  const mockEnvVertex = {
    id: 'env-1',
    pk: 'env-1',
    label: 'environment',
    properties: [
      { key: 'name', value: 'my-app-dev' },
      { key: 'level', value: 'dev' },
      { key: 'clientId', value: 'client-1' },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: GremlinService,
          useValue: {
            getVertexAndChildren: jest.fn(),
            upsertVertex: jest.fn(),
            dropVertex: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PasswordService);
    gremlinService = module.get(GremlinService);
  });

  describe('get', () => {
    it('returns a password bundle', async () => {
      gremlinService.getVertexAndChildren.mockResolvedValue({
        vertex: mockPasswordVertex,
        connections: {
          'is password for': { environment: [mockEnvVertex] },
        },
      });

      const result = await service.get('pw-1');

      expect(result.password.displayName).toBe('my-secret');
      expect(result.password.password).toBe('secret-val');
    });

    it('throws ResourceNotFoundException when password is not found', async () => {
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

  describe('create', () => {
    it('creates a password vertex', async () => {
      gremlinService.upsertVertex.mockResolvedValue(undefined);

      await service.create({
        id: 'pw-1',
        displayName: 'my-secret',
        start: '2024-01-01',
        end: '2025-01-01',
        password: 'secret-val',
      });

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith({
        id: 'pw-1',
        pk: 'pw-1',
        defaultProperties: { type: 'password' },
        updatedProperties: {
          start: '2024-01-01',
          end: '2025-01-01',
          password: 'secret-val',
          displayName: 'my-secret',
        },
      });
    });
  });

  describe('delete', () => {
    it('drops the password vertex', async () => {
      gremlinService.dropVertex.mockResolvedValue(undefined);

      await service.delete('pw-1');

      expect(gremlinService.dropVertex).toHaveBeenCalledWith('pw-1', 'password');
    });
  });
});
