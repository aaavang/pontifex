import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_GUARD } from '../src/common/guards/azure-ad-auth.guard';
import { AzureAdStrategy } from '../src/common/strategies/azure-ad.strategy';
import { GremlinService } from '../src/modules/gremlin/gremlin.service';

/**
 * E2E integration tests for the Pontifex API.
 *
 * Prerequisites:
 *   - Gremlin server running on ws://localhost:8182/gremlin (docker compose up gremlin)
 *   - Valid Azure AD credentials in .env
 *
 * Uses the real AppModule with two overrides:
 *   - AUTH_GUARD is replaced with a pass-through that injects a fake user
 *   - AzureAdStrategy is stubbed so Passport doesn't call Azure AD on startup
 *
 * Cleanup: all created application IDs are tracked and deleted in afterAll hooks
 * to ensure no orphaned resources in Gremlin or AAD.
 */

const FAKE_USER = {
  id: 'e2e-test-user-oid',
  name: 'E2E Test User',
  email: 'e2e@test.pontifex.dev',
  type: 'user' as const,
  roles: [],
};

/** Track all app IDs created during the test run for guaranteed cleanup. */
const createdAppIds: string[] = [];

async function cleanupApp(nestApp: INestApplication, appId: string): Promise<void> {
  try {
    await request(nestApp.getHttpServer()).delete(`/api/applications/${appId}`);
  } catch (e) {
    console.warn(`Cleanup failed for app ${appId}:`, e.message);
  }
}

describe('Pontifex API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_GUARD)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = { ...FAKE_USER };
          return true;
        },
      })
      .overrideProvider(AzureAdStrategy)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => new BadRequestException(errors),
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    // cleanup all tracked applications (idempotent — already-deleted apps return 404)
    for (const appId of createdAppIds) {
      await cleanupApp(app, appId);
    }

    // cleanup the fake test user from Gremlin
    try {
      const gremlin = app.get(GremlinService);
      await gremlin.dropVertex(FAKE_USER.id, 'user');
    } catch (e) {
      console.warn('User cleanup failed:', e.message);
    }

    await app.close();
  });

  /** Helper to create an app and track it for cleanup. */
  async function createTrackedApp(
    name: string,
    environments: string[] = ['dev'],
  ): Promise<any> {
    const res = await request(app.getHttpServer())
      .post('/api/applications')
      .send({ applicationName: name, environments })
      .expect(201);

    createdAppIds.push(res.body.id);
    return res.body;
  }

  describe('User endpoints', () => {
    it('PUT /api/users/create — creates a user from JWT claims', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/users/create')
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(FAKE_USER.id);
      expect(res.body.user.name).toBe(FAKE_USER.name);
      expect(res.body.user.email).toBe(FAKE_USER.email);
    });

    it('GET /api/users/me — returns the current user bundle', async () => {
      await request(app.getHttpServer()).put('/api/users/create');

      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .expect(200);

      expect(res.body.bundle).toBeDefined();
      expect(res.body.bundle.user.id).toBe(FAKE_USER.id);
    });
  });

  describe('Application CRUD lifecycle', () => {
    let appId: string;

    it('POST /api/applications — creates an application with environments in AAD', async () => {
      const body = await createTrackedApp(`e2e-test-app-${Date.now()}`);

      expect(body.id).toBeDefined();
      expect(body.name).toContain('e2e-test-app');
      appId = body.id;
    });

    it('GET /api/applications — lists all applications', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/applications')
        .expect(200);

      expect(res.body.applications).toBeInstanceOf(Array);
      expect(res.body.applications.some((a) => a.id === appId)).toBe(true);
    });

    it('GET /api/applications/owned — lists applications owned by current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/applications/owned')
        .expect(200);

      expect(res.body.applications).toBeInstanceOf(Array);
      expect(res.body.applications.some((a) => a.id === appId)).toBe(true);
    });

    it('GET /api/applications/:id — returns the application bundle', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/applications/${appId}`)
        .expect(200);

      expect(res.body.application.id).toBe(appId);
      expect(res.body.environments).toBeInstanceOf(Array);
      expect(res.body.environments.length).toBe(1);
      expect(res.body.environments[0].level).toBe('dev');
      expect(res.body.owners).toBeInstanceOf(Array);
    });

    it('GET /api/applications/:id/environments — returns environments', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/applications/${appId}/environments`)
        .expect(200);

      expect(res.body.environments).toBeInstanceOf(Array);
      expect(res.body.environments.length).toBe(1);
    });

    it('GET /api/applications/:id/audit-events — returns audit events', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/applications/${appId}/audit-events`)
        .expect(200);

      expect(res.body.events).toBeInstanceOf(Array);
    });

    it('DELETE /api/applications/:id — deletes the application and its environments', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/applications/${appId}`)
        .expect(200);

      expect(res.body.id).toBe(appId);
      const idx = createdAppIds.indexOf(appId);
      if (idx !== -1) createdAppIds.splice(idx, 1);
    });

    it('GET /api/applications/:id — returns 404 after deletion', async () => {
      await request(app.getHttpServer())
        .get(`/api/applications/${appId}`)
        .expect(404);
    });
  });

  describe('Environment endpoints', () => {
    let appId: string;
    let envId: string;

    beforeAll(async () => {
      const body = await createTrackedApp(`e2e-env-test-${Date.now()}`);
      appId = body.id;

      const appRes = await request(app.getHttpServer())
        .get(`/api/applications/${appId}`)
        .expect(200);

      envId = appRes.body.environments[0].id;
    });

    afterAll(async () => {
      await cleanupApp(app, appId);
      const idx = createdAppIds.indexOf(appId);
      if (idx !== -1) createdAppIds.splice(idx, 1);
    });

    it('GET /api/environments/:id — returns the environment bundle', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/environments/${envId}`)
        .expect(200);

      expect(res.body.environment.id).toBe(envId);
      expect(res.body.environment.level).toBe('dev');
      expect(res.body.application).toBeDefined();
      expect(res.body.roles).toBeInstanceOf(Array);
      expect(res.body.scopes).toBeInstanceOf(Array);
      expect(res.body.passwords).toBeInstanceOf(Array);
    });

    it('PATCH /api/environments/:id — updates the environment', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/environments/${envId}`)
        .send({ spaRedirectUrls: ['http://localhost:3000'] })
        .expect(200);

      expect(res.body.environment.spaRedirectUrls).toContain('http://localhost:3000');
    });

    it('GET /api/environments/:id/roles — returns grouped roles', async () => {
      await request(app.getHttpServer())
        .get(`/api/environments/${envId}/roles`)
        .expect(200);
    });

    it('GET /api/environments/:id/scopes — returns grouped scopes', async () => {
      await request(app.getHttpServer())
        .get(`/api/environments/${envId}/scopes`)
        .expect(200);
    });

    it('GET /api/environments/:id/permissionRequests — returns permission requests', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/environments/${envId}/permissionRequests`)
        .expect(200);

      expect(res.body.inboundPermissionRequests).toBeInstanceOf(Array);
      expect(res.body.outboundPermissionRequests).toBeInstanceOf(Array);
    });
  });

  describe('Application roles lifecycle', () => {
    let appId: string;

    beforeAll(async () => {
      const body = await createTrackedApp(`e2e-roles-test-${Date.now()}`);
      appId = body.id;
    });

    afterAll(async () => {
      await cleanupApp(app, appId);
      const idx = createdAppIds.indexOf(appId);
      if (idx !== -1) createdAppIds.splice(idx, 1);
    });

    it('PATCH /api/applications/:id/roles — adds roles to all environments', async () => {
      await request(app.getHttpServer())
        .patch(`/api/applications/${appId}/roles`)
        .send({
          roles: [
            { displayName: 'Reader', claimValue: 'reader', sensitive: false },
            {
              displayName: 'Writer',
              claimValue: 'writer',
              sensitive: true,
              description: 'Write access',
            },
          ],
        })
        .expect(200);

      const appRes = await request(app.getHttpServer())
        .get(`/api/applications/${appId}`)
        .expect(200);

      const envId = appRes.body.environments[0].id;
      const envRes = await request(app.getHttpServer())
        .get(`/api/environments/${envId}`)
        .expect(200);

      expect(envRes.body.roles.length).toBe(2);
      expect(envRes.body.roles.map((r) => r.name)).toContain('Reader');
      expect(envRes.body.roles.map((r) => r.name)).toContain('Writer');
    });
  });

  describe('Azure AD integration', () => {
    it('GET /api/pontifex-aad/groups — returns AAD groups', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/pontifex-aad/groups')
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });

    it('GET /api/pontifex-aad/groups/search — searches AAD groups by prefix', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/pontifex-aad/groups/search')
        .query({ prefix: 'nonexistent-e2e-prefix' })
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe('Validation', () => {
    it('POST /api/applications — rejects empty applicationName', async () => {
      await request(app.getHttpServer())
        .post('/api/applications')
        .send({ applicationName: '', environments: ['dev'] })
        .expect(400);
    });

    it('POST /api/applications — rejects empty environments', async () => {
      await request(app.getHttpServer())
        .post('/api/applications')
        .send({ applicationName: 'test', environments: [] })
        .expect(400);
    });

    it('POST /api/applications — rejects missing environments', async () => {
      await request(app.getHttpServer())
        .post('/api/applications')
        .send({ applicationName: 'test' })
        .expect(400);
    });

    it('POST /api/applications — rejects unknown properties', async () => {
      await request(app.getHttpServer())
        .post('/api/applications')
        .send({ applicationName: 'test', environments: ['dev'], bogus: true })
        .expect(400);
    });
  });
});
