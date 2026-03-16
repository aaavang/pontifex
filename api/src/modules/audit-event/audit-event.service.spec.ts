import { Test, TestingModule } from '@nestjs/testing';
import { AuditEventService } from './audit-event.service';
import { GremlinService } from '../gremlin/gremlin.service';
import { PontifexAuditEvent } from './entities/audit-event.entity';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'generated-uuid'),
}));

describe('AuditEventService', () => {
  let service: AuditEventService;
  let gremlinService: jest.Mocked<GremlinService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditEventService,
        {
          provide: GremlinService,
          useValue: {
            upsertVertex: jest.fn().mockResolvedValue(undefined),
            upsertEdge: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(AuditEventService);
    gremlinService = module.get(GremlinService);
  });

  describe('publishEvent', () => {
    it('creates a vertex and bidirectional edges for a single target resource', async () => {
      const event: PontifexAuditEvent = {
        action: 'CREATE',
        value: 'Created environment',
        targetResourceId: 'resource-1',
        associatedUserId: 'user-1',
        createDate: '2024-01-01T00:00:00.000Z',
      };

      await service.publishEvent(event);

      expect(gremlinService.upsertVertex).toHaveBeenCalledWith({
        id: 'generated-uuid',
        pk: 'generated-uuid',
        defaultProperties: {
          type: 'event',
          action: 'CREATE',
          value: 'Created environment',
          createDate: '2024-01-01T00:00:00.000Z',
          associatedUserId: 'user-1',
        },
      });

      expect(gremlinService.upsertEdge).toHaveBeenCalledTimes(2);

      expect(gremlinService.upsertEdge).toHaveBeenCalledWith({
        label: 'has event',
        sourceVertexId: 'resource-1',
        sourceVertexPk: 'resource-1',
        destinationVertexId: 'generated-uuid',
        destinationVertexPk: 'generated-uuid',
      });

      expect(gremlinService.upsertEdge).toHaveBeenCalledWith({
        label: 'is event for',
        sourceVertexId: 'generated-uuid',
        sourceVertexPk: 'generated-uuid',
        destinationVertexId: 'resource-1',
        destinationVertexPk: 'resource-1',
      });
    });

    it('creates edges for multiple target resource IDs', async () => {
      const event: PontifexAuditEvent = {
        action: 'UPDATE',
        value: 'Updated resources',
        targetResourceId: ['resource-1', 'resource-2'],
      };

      await service.publishEvent(event);

      expect(gremlinService.upsertVertex).toHaveBeenCalledTimes(1);
      // 2 edges per resource * 2 resources = 4 edges
      expect(gremlinService.upsertEdge).toHaveBeenCalledTimes(4);
    });

    it('does not create edges when targetResourceId is undefined', async () => {
      const event: PontifexAuditEvent = {
        action: 'SYSTEM',
        value: 'System event',
      };

      await service.publishEvent(event);

      expect(gremlinService.upsertVertex).toHaveBeenCalledTimes(1);
      expect(gremlinService.upsertEdge).not.toHaveBeenCalled();
    });

    it('does not include associatedUserId when not provided', async () => {
      const event: PontifexAuditEvent = {
        action: 'DELETE',
        value: 'Deleted resource',
        targetResourceId: 'resource-1',
      };

      await service.publishEvent(event);

      const vertexCall = gremlinService.upsertVertex.mock.calls[0][0];
      expect(vertexCall.defaultProperties).not.toHaveProperty('associatedUserId');
    });

    it('generates a createDate when not provided', async () => {
      const event: PontifexAuditEvent = {
        action: 'CREATE',
        value: 'test',
      };

      await service.publishEvent(event);

      const vertexCall = gremlinService.upsertVertex.mock.calls[0][0] as any;
      expect(vertexCall.defaultProperties.createDate).toBeDefined();
      // Should be a valid ISO string
      expect(new Date(vertexCall.defaultProperties.createDate).toISOString()).toBe(
        vertexCall.defaultProperties.createDate,
      );
    });
  });
});
