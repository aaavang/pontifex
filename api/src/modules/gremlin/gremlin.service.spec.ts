import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GremlinService } from './gremlin.service';

describe('GremlinService', () => {
  let service: GremlinService;
  let mockClient: { submit: jest.Mock; close: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GremlinService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('ws://localhost:8182/gremlin'),
          },
        },
      ],
    }).compile();

    service = module.get<GremlinService>(GremlinService);

    // Replace the client with a mock after init
    mockClient = {
      submit: jest.fn(),
      close: jest.fn(),
    };
    (service as any).client = mockClient;
  });

  describe('expandGremlinQuerySafe', () => {
    it('replaces string bindings with escaped single-quoted values', () => {
      const result = service.expandGremlinQuerySafe(
        "g.V(vid).has('pk', pk)",
        { vid: 'app-1', pk: 'app-1' },
      );
      expect(result).toBe("g.V('app-1').has('pk', 'app-1')");
    });

    it('replaces numeric bindings with their string representation', () => {
      const result = service.expandGremlinQuerySafe(
        'g.V().limit(count)',
        { count: 10 },
      );
      expect(result).toBe('g.V().limit(10)');
    });

    it('replaces array bindings with JSON array', () => {
      const result = service.expandGremlinQuerySafe(
        'g.V().has(labels)',
        { labels: ['a', 'b'] },
      );
      expect(result).toBe('g.V().has(["a", "b"])');
    });

    it('does not replace string literals', () => {
      const result = service.expandGremlinQuerySafe(
        "g.V().has('type', type)",
        { type: 'application' },
      );
      expect(result).toBe("g.V().has('type', 'application')");
    });

    it('escapes single quotes in string values', () => {
      const result = service.expandGremlinQuerySafe(
        'g.V(vid)',
        { vid: "it's" },
      );
      expect(result).toBe("g.V('it\\'s')");
    });

    it('returns the query unchanged when no bindings match', () => {
      const result = service.expandGremlinQuerySafe(
        "g.V().has('type', 'app')",
        {},
      );
      expect(result).toBe("g.V().has('type', 'app')");
    });
  });

  describe('submit', () => {
    it('submits the expanded query to the client', async () => {
      mockClient.submit.mockResolvedValue({ _items: [] });

      await service.submit("g.V(vid).has('pk', pk)", { vid: 'v-1', pk: 'v-1' });

      expect(mockClient.submit).toHaveBeenCalledWith(
        "g.V('v-1').has('pk', 'v-1')",
      );
    });
  });

  describe('getVertex', () => {
    it('returns the first item from the result', async () => {
      const vertex = { id: 'v-1', properties: [] };
      mockClient.submit.mockResolvedValue({ _items: [vertex] });

      const result = await service.getVertex('v-1', 'v-1');
      expect(result).toBe(vertex);
    });

    it('returns undefined when vertex is not found', async () => {
      mockClient.submit.mockResolvedValue({ _items: [] });

      const result = await service.getVertex('missing', 'missing');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllVerticesOfType', () => {
    it('returns all items from the result', async () => {
      const items = [{ id: '1' }, { id: '2' }];
      mockClient.submit.mockResolvedValue({ _items: items });

      const result = await service.getAllVerticesOfType('application');
      expect(result).toEqual(items);
    });
  });

  describe('dropVertex', () => {
    it('submits a drop query', async () => {
      mockClient.submit.mockResolvedValue({ _items: [] });

      await service.dropVertex('v-1', 'application');

      expect(mockClient.submit).toHaveBeenCalled();
      const query = mockClient.submit.mock.calls[0][0];
      expect(query).toContain('drop');
    });
  });

  describe('dropEdge', () => {
    it('submits a drop edge query', async () => {
      mockClient.submit.mockResolvedValue({ _items: [] });

      await service.dropEdge('edge-1');

      expect(mockClient.submit).toHaveBeenCalled();
      const query = mockClient.submit.mock.calls[0][0];
      expect(query).toContain('drop');
    });
  });

  describe('upsertVertex', () => {
    it('submits an upsert query and returns the first item', async () => {
      const vertex = { id: 'v-1', properties: [] };
      mockClient.submit.mockResolvedValue({ _items: [vertex] });

      const result = await service.upsertVertex<Record<string, any>>({
        id: 'v-1',
        pk: 'v-1',
        defaultProperties: { type: 'application' },
        updatedProperties: { name: 'test' },
      });

      expect(result).toBe(vertex);
      expect(mockClient.submit).toHaveBeenCalled();
    });
  });

  describe('upsertEdge', () => {
    it('submits an edge upsert query', async () => {
      const edge = { id: 'e-1' };
      mockClient.submit.mockResolvedValue({ _items: [edge] });

      const result = await service.upsertEdge({
        label: 'contains',
        sourceVertexId: 'app-1',
        sourceVertexPk: 'app-1',
        destinationVertexId: 'env-1',
        destinationVertexPk: 'env-1',
      });

      expect(result).toBe(edge);
      expect(mockClient.submit).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('closes the client', async () => {
      await service.onModuleDestroy();
      expect(mockClient.close).toHaveBeenCalled();
    });
  });
});
