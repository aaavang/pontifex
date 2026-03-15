import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { GremlinService } from './gremlin.service';
import { GremlinVertex } from './entities/gremlin.entity';

interface TestVertex {
  type: string;
  name?: string;
  tags?: string[];
}

/**
 * Integration tests for GremlinService against a real Gremlin server.
 *
 * Prerequisites:
 *   docker compose up gremlin
 *
 * All test vertices/edges use a unique prefix per run and are cleaned up in
 * afterAll to avoid polluting the database.
 */

const PREFIX = `intg-${Date.now()}`;
const vid = (name: string) => `${PREFIX}-${name}`;

/** Extract property values from a Gremlin vertex's properties array. */
function getProp(vertex: any, key: string): any[] {
  return vertex.properties
    .filter((p: any) => p.key === key || p.label === key)
    .map((p: any) => p.value);
}

describe('GremlinService (integration)', () => {
  let service: GremlinService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
      ],
      providers: [GremlinService],
    }).compile();

    service = module.get<GremlinService>(GremlinService);
    service.onModuleInit();
  });

  afterAll(async () => {
    // Clean up all test vertices (edges are dropped with their vertices)
    await service.submit(
      `g.V().has('pk', pk).drop()`,
      { pk: PREFIX },
    );
    await service.onModuleDestroy();
    await module.close();
  });

  describe('upsertVertex', () => {
    it('creates a new vertex with default and updated properties', async () => {
      const result = await service.upsertVertex<TestVertex>({
        id: vid('app-1'),
        pk: PREFIX,
        defaultProperties: { type: 'application', name: 'Test App' },
        updatedProperties: { name: 'Test App Updated' },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(vid('app-1'));
    });

    it('upserts an existing vertex without duplicating it', async () => {
      await service.upsertVertex<TestVertex>({
        id: vid('app-1'),
        pk: PREFIX,
        defaultProperties: { type: 'application', name: 'Original' },
        updatedProperties: { name: 'Upserted' },
      });

      const all = await service.submit(
        `g.V('${vid('app-1')}').has('pk', pk)`,
        { pk: PREFIX },
      );
      expect(all._items).toHaveLength(1);
    });

    it('stores single-value properties', async () => {
      await service.upsertVertex<TestVertex>({
        id: vid('app-single'),
        pk: PREFIX,
        defaultProperties: { type: 'application' },
        updatedProperties: { name: 'SingleProp' },
      });

      const vertex = await service.getVertex(vid('app-single'), PREFIX);
      expect(vertex).toBeDefined();
      expect(getProp(vertex, 'name')).toEqual(['SingleProp']);
    });

    it('stores list-value properties', async () => {
      await service.upsertVertex<TestVertex>({
        id: vid('app-list'),
        pk: PREFIX,
        defaultProperties: { type: 'application' },
        updatedProperties: { tags: ['alpha', 'beta'] },
      });

      const vertex = await service.getVertex(vid('app-list'), PREFIX);
      expect(getProp(vertex, 'tags')).toEqual(expect.arrayContaining(['alpha', 'beta']));
    });

    it('replaces list-value properties on re-upsert', async () => {
      await service.upsertVertex<TestVertex>({
        id: vid('app-list-replace'),
        pk: PREFIX,
        defaultProperties: { type: 'application' },
        updatedProperties: { tags: ['old'] },
      });

      await service.upsertVertex<TestVertex>({
        id: vid('app-list-replace'),
        pk: PREFIX,
        defaultProperties: { type: 'application' },
        updatedProperties: { tags: ['new-a', 'new-b'] },
      });

      const vertex = await service.getVertex(vid('app-list-replace'), PREFIX);
      expect(getProp(vertex, 'tags')).toEqual(['new-a', 'new-b']);
    });
  });

  describe('getVertex', () => {
    beforeAll(async () => {
      await service.upsertVertex<TestVertex>({
        id: vid('get-target'),
        pk: PREFIX,
        defaultProperties: { type: 'application' },
        updatedProperties: { name: 'GetTarget' },
      });
    });

    it('returns the vertex when it exists', async () => {
      const vertex = await service.getVertex(vid('get-target'), PREFIX);

      expect(vertex).toBeDefined();
      expect(vertex.id).toBe(vid('get-target'));
      expect(getProp(vertex, 'name')).toEqual(['GetTarget']);
    });

    it('returns undefined when the vertex does not exist', async () => {
      const vertex = await service.getVertex('nonexistent-id', PREFIX);
      expect(vertex).toBeUndefined();
    });
  });

  describe('getAllVerticesOfType', () => {
    beforeAll(async () => {
      await service.upsertVertex<TestVertex>({
        id: vid('typed-1'),
        pk: PREFIX,
        defaultProperties: { type: 'environment' },
      });
      await service.upsertVertex<TestVertex>({
        id: vid('typed-2'),
        pk: PREFIX,
        defaultProperties: { type: 'environment' },
      });
    });

    it('returns all vertices of the given type', async () => {
      const results = await service.getAllVerticesOfType('environment');

      const ids = results.map((v) => v.id);
      expect(ids).toContain(vid('typed-1'));
      expect(ids).toContain(vid('typed-2'));
    });
  });

  describe('upsertEdge', () => {
    beforeAll(async () => {
      await service.upsertVertex<TestVertex>({
        id: vid('edge-src'),
        pk: PREFIX,
        defaultProperties: { type: 'application' },
      });
      await service.upsertVertex<TestVertex>({
        id: vid('edge-dst'),
        pk: PREFIX,
        defaultProperties: { type: 'environment' },
      });
    });

    it('creates an edge between two vertices', async () => {
      const result = await service.upsertEdge({
        label: 'contains',
        sourceVertexId: vid('edge-src'),
        sourceVertexPk: PREFIX,
        destinationVertexId: vid('edge-dst'),
        destinationVertexPk: PREFIX,
      });

      expect(result).toBeDefined();
    });

    it('is idempotent — upserting the same edge twice does not duplicate', async () => {
      await service.upsertEdge({
        label: 'contains',
        sourceVertexId: vid('edge-src'),
        sourceVertexPk: PREFIX,
        destinationVertexId: vid('edge-dst'),
        destinationVertexPk: PREFIX,
      });

      const edges = await service.submit(
        `g.V('${vid('edge-src')}').outE('contains')`,
        {},
      );
      expect(edges._items).toHaveLength(1);
    });

    // Note: upsertEdge with properties uses mapProperties() which generates
    // Cardinality.single/list — Gremlin only supports cardinality on vertices,
    // not edges. This is a known limitation of the current implementation.
  });

  describe('getVertexAndChildren', () => {
    beforeAll(async () => {
      await service.upsertVertex<TestVertex>({
        id: vid('parent'),
        pk: PREFIX,
        defaultProperties: { type: 'application' },
        updatedProperties: { name: 'Parent' },
      });
      await service.upsertVertex<TestVertex>({
        id: vid('child-1'),
        pk: PREFIX,
        defaultProperties: { type: 'environment' },
        updatedProperties: { name: 'Child1' },
      });
      await service.upsertVertex<TestVertex>({
        id: vid('child-2'),
        pk: PREFIX,
        defaultProperties: { type: 'environment' },
        updatedProperties: { name: 'Child2' },
      });
      await service.upsertEdge({
        label: 'contains',
        sourceVertexId: vid('parent'),
        sourceVertexPk: PREFIX,
        destinationVertexId: vid('child-1'),
        destinationVertexPk: PREFIX,
      });
      await service.upsertEdge({
        label: 'contains',
        sourceVertexId: vid('parent'),
        sourceVertexPk: PREFIX,
        destinationVertexId: vid('child-2'),
        destinationVertexPk: PREFIX,
      });
    });

    it('returns the vertex and its grouped children', async () => {
      const result = await service.getVertexAndChildren<GremlinVertex>(
        vid('parent'),
        PREFIX,
        'application',
      );

      expect(result.vertex).toBeDefined();
      expect(result.vertex.id).toBe(vid('parent'));
      expect(result.connections.contains).toBeDefined();
      expect(result.connections.contains!.environment).toHaveLength(2);
    });
  });

  describe('getAllChildrenOfType', () => {
    beforeAll(async () => {
      await service.upsertVertex<TestVertex>({
        id: vid('traverse-root'),
        pk: PREFIX,
        defaultProperties: { type: 'application' },
      });
      await service.upsertVertex<TestVertex>({
        id: vid('traverse-env'),
        pk: PREFIX,
        defaultProperties: { type: 'environment' },
      });
      await service.upsertEdge({
        label: 'contains',
        sourceVertexId: vid('traverse-root'),
        sourceVertexPk: PREFIX,
        destinationVertexId: vid('traverse-env'),
        destinationVertexPk: PREFIX,
      });
    });

    it('traverses edges and returns children of the target type', async () => {
      const children = await service.getAllChildrenOfType<GremlinVertex>(
        vid('traverse-root'),
        PREFIX,
        'environment',
        ['contains'],
      );

      expect(children).toHaveLength(1);
      expect(children[0].id).toBe(vid('traverse-env'));
    });

    // Note: getAllChildrenOfType uses repeat().until() which will not terminate
    // if no vertex of the target type is reachable. This is a known limitation
    // of the traversal — callers must ensure the type exists in the subgraph.
  });

  describe('dropVertex', () => {
    it('removes the vertex from the graph', async () => {
      await service.upsertVertex<TestVertex>({
        id: vid('to-drop'),
        pk: PREFIX,
        defaultProperties: { type: 'application' },
      });

      await service.dropVertex(vid('to-drop'), 'application');

      const vertex = await service.getVertex(vid('to-drop'), PREFIX);
      expect(vertex).toBeUndefined();
    });
  });

  describe('dropEdge', () => {
    it('removes the edge from the graph', async () => {
      await service.upsertVertex<TestVertex>({
        id: vid('drop-e-src'),
        pk: PREFIX,
        defaultProperties: { type: 'application' },
      });
      await service.upsertVertex<TestVertex>({
        id: vid('drop-e-dst'),
        pk: PREFIX,
        defaultProperties: { type: 'environment' },
      });
      await service.upsertEdge({
        label: 'contains',
        sourceVertexId: vid('drop-e-src'),
        sourceVertexPk: PREFIX,
        destinationVertexId: vid('drop-e-dst'),
        destinationVertexPk: PREFIX,
      });

      const edgeId = `${vid('drop-e-src')}.${PREFIX}-contains-${vid('drop-e-dst')}.${PREFIX}`;
      await service.dropEdge(edgeId);

      const edges = await service.submit(
        `g.V('${vid('drop-e-src')}').outE('contains')`,
        {},
      );
      expect(edges._items).toHaveLength(0);
    });
  });
});
