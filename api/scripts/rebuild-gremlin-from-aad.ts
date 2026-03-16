/**
 * Rebuilds the Gremlin graph database from Azure Entra (Azure AD) state.
 *
 * Works like Terraform: plan then apply.
 *
 *   npx ts-node scripts/rebuild-gremlin-from-aad.ts plan [plan.json]
 *     → Queries Azure Entra + Gremlin, generates a plan file, shows diff
 *
 *   npx ts-node scripts/rebuild-gremlin-from-aad.ts apply <plan.json>
 *     → Reads the plan file and executes all operations against Gremlin
 *
 * All operations are idempotent upserts — safe to run against an existing
 * graph for repair/sync without data loss.
 *
 * Discovers Pontifex-managed resources using:
 *   - `pontifex-managed` tag on AAD app registrations
 *   - Service principal app role assignments (to discover groups)
 *
 * Infers Pontifex application names from the AAD display name pattern:
 *   {ApplicationName}-{environment}  (e.g., "my-app-dev", "my-app-prod")
 *
 * Requires env vars: PONTIFEX_TENANT_ID, PONTIFEX_CLIENT_ID, PONTIFEX_CLIENT_SECRET,
 *                    PONTIFEX_DATABASE_ENDPOINT (defaults to ws://localhost:8182/gremlin)
 */

import {ClientSecretCredential} from "@azure/identity";
import {Client} from "@microsoft/microsoft-graph-client";
import {
    TokenCredentialAuthenticationProvider,
    TokenCredentialAuthenticationProviderOptions
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import {
    Application,
    AppRole,
    AppRoleAssignment,
    DirectoryObject,
    Group,
    PermissionScope,
    ServicePrincipal,
} from "@microsoft/microsoft-graph-types";
import * as Gremlin from "gremlin";
import * as fs from "fs";
import "isomorphic-fetch";
import * as dotenv from "dotenv";
import * as path from "path";
import {v4 as uuid} from "uuid";

dotenv.config({path: path.resolve(__dirname, '../.env')});

// ─── Constants ───────────────────────────────────────────────────────

const PONTIFEX_MANAGED_TAG = 'pontifex-managed';
const PONTIFEX_APP_ID = 'pontifex';
const PONTIFEX_APP_NAME = 'Pontifex';
const PONTIFEX_ADMINS_GROUP_NAME = 'Pontifex_Admins';
const PONTIFEX_ADMINS_SETTING_ID = 'setting-pontifex-admins';
const ENVIRONMENT_LEVELS_SETTING_ID = 'setting-environment-levels';
const SYSTEM_SETTINGS_BASE_ID = 'system-settings';
const DEFAULT_ENVIRONMENT_LEVELS = ['dev', 'test', 'qa', 'prod'];

// ─── Plan types ──────────────────────────────────────────────────────

interface VertexOp {
    op: 'upsertVertex';
    id: string;
    properties: Record<string, any>;
    /** Human-readable label for display */
    label: string;
    /** Whether the vertex already exists in Gremlin */
    status: 'new' | 'exists';
}

interface ListVertexOp {
    op: 'upsertListVertex';
    id: string;
    singleProperties: Record<string, any>;
    listProperties: Record<string, string[]>;
    label: string;
    status: 'new' | 'exists';
}

interface EdgeOp {
    op: 'upsertEdge';
    edgeLabel: string;
    srcId: string;
    dstId: string;
}

type Operation = VertexOp | ListVertexOp | EdgeOp;

interface RebuildPlan {
    generatedAt: string;
    gremlinEndpoint: string;
    summary: {
        new: number;
        exists: number;
        edges: number;
    };
    operations: Operation[];
}

// ─── Gremlin client ──────────────────────────────────────────────────

class GremlinClient {
    private client: Gremlin.driver.Client;

    constructor(endpoint: string) {
        this.client = new Gremlin.driver.Client(endpoint, {
            traversalsource: 'g',
            rejectUnauthorized: true,
            mimeType: 'application/vnd.graphbinary-v1.0',
        });
    }

    async submit(query: string, bindings: Record<string, any> = {}) {
        return this.client.submit(query, bindings);
    }

    async close() {
        await this.client.close();
    }

    async getVertexIdsByType(type: string): Promise<Set<string>> {
        const result = await this.submit("g.V().has('type', type).id().fold()", {type});
        return new Set(result._items[0] ?? []);
    }

    async findTokenGroupId(envId: string, groupId: string, claimValue: string): Promise<string | null> {
        const result = await this.submit(
            "g.V().has('type', 'tokenGroup').has('envId', envId).has('groupId', groupId).has('claimValue', claimValue).id().fold()",
            {envId, groupId, claimValue}
        );
        const ids = result._items[0] ?? [];
        return ids.length > 0 ? ids[0] : null;
    }

    async executeVertexOp(op: VertexOp) {
        const bindings: Record<string, any> = {vid: op.id, pk: op.id};
        let propString = '';
        for (const [key, value] of Object.entries(op.properties)) {
            const bindKey = `p_${key}`;
            bindings[bindKey] = value;
            propString += `.property(Cardinality.single, '${key}', ${bindKey})`;
        }
        await this.submit(`
            g.V(vid).has('pk', pk).fold()
            .coalesce(unfold(), addV().property(T.id, vid).property('pk', pk))
            ${propString}
        `, bindings);
    }

    async executeListVertexOp(op: ListVertexOp) {
        const bindings: Record<string, any> = {vid: op.id, pk: op.id};
        let propString = '';

        // Drop existing list properties first
        for (const key of Object.keys(op.listProperties)) {
            propString += `.sideEffect(properties('${key}').drop())`;
        }

        for (const [key, value] of Object.entries(op.singleProperties)) {
            const bindKey = `p_${key}`;
            bindings[bindKey] = value;
            propString += `.property(Cardinality.single, '${key}', ${bindKey})`;
        }

        for (const [key, values] of Object.entries(op.listProperties)) {
            values.forEach((val, i) => {
                const bindKey = `l_${key}_${i}`;
                bindings[bindKey] = val;
                propString += `.property(Cardinality.list, '${key}', ${bindKey})`;
            });
        }

        await this.submit(`
            g.V(vid).has('pk', pk).fold()
            .coalesce(unfold(), addV().property(T.id, vid).property('pk', pk))
            ${propString}
        `, bindings);
    }

    async executeEdgeOp(op: EdgeOp) {
        const edgeId = `${op.srcId}.${op.srcId}-${op.edgeLabel}-${op.dstId}.${op.dstId}`;
        await this.submit(`
            g.E(edgeId).fold()
            .coalesce(unfold(),
                __.V(srcId).has('pk', srcPk).as('source')
                .V(dstId).has('pk', dstPk)
                .addE(edgeLabel).from('source').property(T.id, edgeId))
        `, {edgeId, edgeLabel: op.edgeLabel, srcId: op.srcId, srcPk: op.srcId, dstId: op.dstId, dstPk: op.dstId});
    }
}

// ─── Lookup maps ─────────────────────────────────────────────────────

const appIdToObjectId = new Map<string, string>();
const objectIdToAppId = new Map<string, string>();
const objectIdToDisplayName = new Map<string, string>();
const appIdToSpId = new Map<string, string>();

// ─── Plan command ────────────────────────────────────────────────────

async function planCommand(planFile: string) {
    const tenantId = process.env.PONTIFEX_TENANT_ID!;
    const clientId = process.env.PONTIFEX_CLIENT_ID!;
    const clientSecret = process.env.PONTIFEX_CLIENT_SECRET!;
    const gremlinEndpoint = process.env.PONTIFEX_DATABASE_ENDPOINT || 'ws://localhost:8182/gremlin';

    if (!tenantId || !clientId || !clientSecret) {
        console.error('Missing required env vars: PONTIFEX_TENANT_ID, PONTIFEX_CLIENT_ID, PONTIFEX_CLIENT_SECRET');
        process.exit(1);
    }

    console.log('Planning rebuild from Azure Entra...');
    console.log(`Gremlin endpoint: ${gremlinEndpoint}\n`);

    const tokenCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const authProvider = new TokenCredentialAuthenticationProvider(tokenCredential, {
        scopes: ["https://graph.microsoft.com/.default"]
    });
    const graph = Client.initWithMiddleware({authProvider});
    const gremlin = new GremlinClient(gremlinEndpoint);

    const ops: Operation[] = [];

    function vertex(id: string, properties: Record<string, any>, label: string): VertexOp {
        const op: VertexOp = {op: 'upsertVertex', id, properties, label, status: 'new'};
        ops.push(op);
        return op;
    }

    function listVertex(id: string, singleProperties: Record<string, any>, listProperties: Record<string, string[]>, label: string): ListVertexOp {
        const op: ListVertexOp = {op: 'upsertListVertex', id, singleProperties, listProperties, label, status: 'new'};
        ops.push(op);
        return op;
    }

    function edge(edgeLabel: string, srcId: string, dstId: string) {
        ops.push({op: 'upsertEdge', edgeLabel, srcId, dstId});
    }

    function biEdge(forwardLabel: string, reverseLabel: string, srcId: string, dstId: string) {
        edge(forwardLabel, srcId, dstId);
        edge(reverseLabel, dstId, srcId);
    }

    try {
        // ─── Step 1: Discover tagged AAD apps
        console.log('Step 1: Discovering pontifex-managed app registrations...');
        const taggedApps = await getTaggedApps(graph);
        console.log(`  Found ${taggedApps.length} tagged app registrations.`);

        if (taggedApps.length === 0) {
            console.log('No pontifex-managed apps found in Azure Entra. Nothing to plan.');
            return;
        }

        for (const app of taggedApps) {
            appIdToObjectId.set(app.appId!, app.id!);
            objectIdToAppId.set(app.id!, app.appId!);
            objectIdToDisplayName.set(app.id!, app.displayName!);
        }

        // ─── Step 2: Group by inferred application name
        console.log('\nStep 2: Grouping by inferred application name...');
        const appGroups = groupByInferredAppName(taggedApps, clientId);
        for (const [appName, envs] of Object.entries(appGroups)) {
            console.log(`  ${appName}: ${envs.length} environment(s)`);
            for (const env of envs) {
                console.log(`    - ${env.displayName} (${env.id})`);
            }
        }

        // ─── Step 3: Fetch service principals and app role assignments
        console.log('\nStep 3: Fetching service principals and app role assignments...');
        const allAssignments = new Map<string, AppRoleAssignment[]>();

        for (const app of taggedApps) {
            try {
                const sp = await getServicePrincipalByAppId(graph, app.appId!);
                appIdToSpId.set(app.appId!, sp.id!);
                const assignments = await getAppRoleAssignedTo(graph, sp.id!);
                if (assignments.length > 0) {
                    allAssignments.set(sp.id!, assignments);
                    console.log(`  ${app.displayName}: ${assignments.length} app role assignment(s)`);
                }
            } catch {
                console.log(`  ${app.displayName}: no service principal found (skipping)`);
            }
        }

        // ─── Step 4: Discover groups
        console.log('\nStep 4: Discovering groups...');
        const groupIds = new Set<string>();
        for (const [, assignments] of allAssignments) {
            for (const assignment of assignments) {
                if (assignment.principalType === 'Group' && assignment.principalId) {
                    groupIds.add(assignment.principalId);
                }
            }
        }

        const adminGroup = await findGroupByName(graph, PONTIFEX_ADMINS_GROUP_NAME);
        if (adminGroup) {
            groupIds.add(adminGroup.id!);
            console.log(`  Admin group: ${adminGroup.displayName} (${adminGroup.id})`);
        } else {
            console.error(`  WARNING: ${PONTIFEX_ADMINS_GROUP_NAME} group not found.`);
        }

        const managedGroups: Group[] = [];
        for (const gid of groupIds) {
            try {
                const group = await getGroupById(graph, gid);
                managedGroups.push(group);
                console.log(`  ${group.displayName} (${group.id})`);
            } catch {
                console.log(`  Group ${gid}: not found (skipping)`);
            }
        }

        // ─── Step 5: Fetch group members/owners
        console.log('\nStep 5: Fetching group members and owners...');
        const groupData = new Map<string, { group: Group; members: DirectoryObject[]; owners: DirectoryObject[] }>();
        const allUsers = new Map<string, DirectoryObject>();

        for (const group of managedGroups) {
            const [members, owners] = await Promise.all([
                getGroupMembers(graph, group.id!),
                getGroupOwners(graph, group.id!),
            ]);
            groupData.set(group.id!, {group, members, owners});
            console.log(`  ${group.displayName}: ${members.length} members, ${owners.length} owners`);

            for (const user of [...members, ...owners]) {
                if (user.id && !allUsers.has(user.id)) {
                    allUsers.set(user.id, user);
                }
            }
        }

        // ─── Build operations ────────────────────────────────────────

        console.log('\nBuilding plan...');

        // System settings
        vertex(SYSTEM_SETTINGS_BASE_ID, {type: 'systemSetting', name: 'system-settings'}, 'system-settings');
        vertex('system', {type: 'user', name: 'System', email: '', normalizedName: 'system'}, 'System');

        const discoveredLevels = inferEnvironmentLevels(taggedApps);
        listVertex(ENVIRONMENT_LEVELS_SETTING_ID,
            {type: 'systemSetting', name: 'environment-levels'},
            {levels: discoveredLevels},
            'environment-levels',
        );
        biEdge('has setting', 'is setting for', SYSTEM_SETTINGS_BASE_ID, ENVIRONMENT_LEVELS_SETTING_ID);

        if (adminGroup) {
            vertex(PONTIFEX_ADMINS_SETTING_ID, {
                type: 'systemSetting', name: PONTIFEX_ADMINS_GROUP_NAME,
                aadGroupId: adminGroup.id!, aadGroupName: adminGroup.displayName!,
            }, PONTIFEX_ADMINS_GROUP_NAME);
            biEdge('has setting', 'is setting for', SYSTEM_SETTINGS_BASE_ID, PONTIFEX_ADMINS_SETTING_ID);
        }

        // Users
        for (const [userId, user] of allUsers) {
            const u = user as any;
            vertex(userId, {
                type: 'user', name: u.displayName ?? userId,
                email: u.mail ?? '', normalizedName: (u.displayName ?? userId).toLowerCase(),
            }, u.displayName ?? userId);
        }

        // Groups + membership
        for (const [gid, data] of groupData) {
            vertex(gid, {
                type: 'group', name: data.group.displayName!,
                normalizedName: data.group.displayName!.toLowerCase(),
            }, data.group.displayName!);

            for (const member of data.members) {
                biEdge('member of', 'has member', member.id!, gid);
            }
            for (const owner of data.owners) {
                biEdge('owns', 'owned by', owner.id!, gid);
            }
        }

        // Applications, environments, roles, scopes
        const roleIdToEnvObjectId = new Map<string, string>();
        const scopeIdToEnvObjectId = new Map<string, string>();

        for (const [appName, aadApps] of Object.entries(appGroups)) {
            const pontifexAppId = appName === PONTIFEX_APP_NAME ? PONTIFEX_APP_ID : uuid();

            vertex(pontifexAppId, {
                type: 'application', name: appName, creator: 'system',
                description: pontifexAppId === PONTIFEX_APP_ID ? 'Pontifex application management platform' : '',
            }, appName);

            if (adminGroup) {
                biEdge('owns', 'owned by', adminGroup.id!, pontifexAppId);
            }

            for (const aadApp of aadApps) {
                const envId = aadApp.id!;
                const level = extractLevel(aadApp.displayName!);

                vertex(envId, {
                    type: 'environment', name: aadApp.displayName!, level,
                    clientId: aadApp.appId!, spaRedirectUrls: '', webRedirectUrls: '',
                }, aadApp.displayName!);

                biEdge('contains', 'contained by', pontifexAppId, envId);

                for (const role of (aadApp.appRoles ?? []).filter((r: AppRole) => r.isEnabled && r.allowedMemberTypes?.includes('Application'))) {
                    vertex(role.id!, {
                        type: 'role', name: role.displayName!, sensitive: false,
                        description: role.description ?? '',
                    }, role.displayName!);
                    biEdge('contains', 'contained by', envId, role.id!);
                    roleIdToEnvObjectId.set(role.id!, envId);
                }

                for (const scope of (aadApp.api?.oauth2PermissionScopes ?? []).filter((s: PermissionScope) => s.isEnabled)) {
                    vertex(scope.id!, {
                        type: 'scope', name: scope.value!,
                        displayName: scope.userConsentDisplayName ?? scope.adminConsentDisplayName ?? scope.value!,
                        description: scope.userConsentDescription ?? scope.adminConsentDescription ?? '',
                    }, scope.value!);
                    biEdge('contains', 'contained by', envId, scope.id!);
                    scopeIdToEnvObjectId.set(scope.id!, envId);
                }

                // Passwords
                for (const cred of ((aadApp as any).passwordCredentials ?? [])) {
                    vertex(cred.keyId!, {
                        type: 'password', displayName: cred.displayName ?? '',
                        start: cred.startDateTime ?? '', end: cred.endDateTime ?? '',
                        password: '[RECOVERED BUT UNREADABLE]',
                    }, cred.displayName ?? cred.keyId!);
                    biEdge('has password', 'is password for', envId, cred.keyId!);
                }
            }
        }

        // Token groups — look up existing IDs from Gremlin
        for (const [, assignments] of allAssignments) {
            for (const assignment of assignments) {
                if (assignment.principalType !== 'Group') continue;
                const resourceAppId = findAppIdBySpId(assignment.resourceId!);
                if (!resourceAppId) continue;
                const envObjectId = appIdToObjectId.get(resourceAppId);
                if (!envObjectId) continue;
                const aadApp = taggedApps.find(a => a.id === envObjectId);
                const appRole = aadApp?.appRoles?.find(r => r.id === assignment.appRoleId);
                if (!appRole) continue;

                const gid = assignment.principalId!;
                const gd = groupData.get(gid);
                const groupName = gd?.group.displayName ?? gid;

                let tokenGroupId: string;
                try {
                    const existing = await gremlin.findTokenGroupId(envObjectId, gid, appRole.value ?? '');
                    tokenGroupId = existing ?? uuid();
                } catch {
                    tokenGroupId = uuid();
                }

                vertex(tokenGroupId, {
                    type: 'tokenGroup', name: groupName, envId: envObjectId,
                    groupId: gid, claimValue: appRole.value ?? '',
                    description: appRole.description ?? '', appRoleId: assignment.appRoleId!,
                    appRoleAssignmentId: assignment.id ?? '',
                }, `${objectIdToDisplayName.get(envObjectId)} / ${groupName} -> ${appRole.value}`);

                biEdge('has token group', 'is user token group for', envObjectId, tokenGroupId);
            }
        }

        // Permission requests
        const approvedGrants = new Set<string>();
        for (const [, assignments] of allAssignments) {
            for (const assignment of assignments) {
                if (assignment.principalType === 'ServicePrincipal') {
                    approvedGrants.add(`${assignment.principalId}.${assignment.appRoleId}`);
                }
            }
        }

        for (const sourceApp of taggedApps) {
            for (const rra of (sourceApp.requiredResourceAccess ?? [])) {
                const targetEnvObjectId = appIdToObjectId.get(rra.resourceAppId!);
                if (!targetEnvObjectId) continue;
                const targetEnvName = objectIdToDisplayName.get(targetEnvObjectId) ?? targetEnvObjectId;

                for (const access of (rra.resourceAccess ?? [])) {
                    const targetPermissionId = access.id!;
                    const permissionType = access.type === 'Scope' ? 'Scope' : 'Role';
                    const targetExists = permissionType === 'Role'
                        ? roleIdToEnvObjectId.has(targetPermissionId)
                        : scopeIdToEnvObjectId.has(targetPermissionId);
                    if (!targetExists) continue;

                    const sourceSpId = appIdToSpId.get(sourceApp.appId!);
                    const isApproved = sourceSpId && approvedGrants.has(`${sourceSpId}.${targetPermissionId}`);
                    const prId = `${sourceApp.id!}.${targetPermissionId}`;
                    const status = isApproved ? 'APPROVED' : 'PENDING';

                    const targetApp = taggedApps.find(a => a.id === targetEnvObjectId);
                    let targetPermissionName = targetPermissionId;
                    if (permissionType === 'Role') {
                        targetPermissionName = targetApp?.appRoles?.find(r => r.id === targetPermissionId)?.displayName ?? targetPermissionId;
                    } else {
                        targetPermissionName = targetApp?.api?.oauth2PermissionScopes?.find(s => s.id === targetPermissionId)?.value ?? targetPermissionId;
                    }

                    vertex(prId, {
                        type: 'permissionRequest', requestor: 'recovered',
                        createDate: new Date().toISOString(), status, permissionType,
                        targetPermissionId, targetPermissionName,
                        sourceEnvironmentId: sourceApp.id!, sourceEnvironmentName: sourceApp.displayName!,
                        targetEnvironmentId: targetEnvObjectId, targetEnvironmentName: targetEnvName,
                    }, `${sourceApp.displayName} -> ${targetEnvName}/${targetPermissionName} [${status}]`);

                    biEdge('requests permission', 'request source', sourceApp.id!, prId);
                    biEdge('requests permission', 'request target', targetPermissionId, prId);
                }
            }
        }

        // ─── Resolve status by diffing against Gremlin ───────────────

        console.log('Checking existing state in Gremlin...\n');

        const vertexOps = ops.filter(o => o.op === 'upsertVertex' || o.op === 'upsertListVertex') as (VertexOp | ListVertexOp)[];
        const typesNeeded = new Set(vertexOps.map(o => o.op === 'upsertVertex' ? o.properties.type : o.singleProperties.type));

        const existingByType = new Map<string, Set<string>>();
        for (const type of typesNeeded) {
            try {
                existingByType.set(type, await gremlin.getVertexIdsByType(type));
            } catch {
                existingByType.set(type, new Set());
            }
        }

        for (const op of vertexOps) {
            const type = op.op === 'upsertVertex' ? op.properties.type : op.singleProperties.type;
            const existing = existingByType.get(type) ?? new Set();
            op.status = existing.has(op.id) ? 'exists' : 'new';
        }

        // ─── Build plan object ───────────────────────────────────────

        const newCount = vertexOps.filter(o => o.status === 'new').length;
        const existsCount = vertexOps.filter(o => o.status === 'exists').length;
        const edgeCount = ops.filter(o => o.op === 'upsertEdge').length;

        const plan: RebuildPlan = {
            generatedAt: new Date().toISOString(),
            gremlinEndpoint,
            summary: {new: newCount, exists: existsCount, edges: edgeCount},
            operations: ops,
        };

        // ─── Print diff ──────────────────────────────────────────────

        console.log('═══════════════════════════════════════════');
        console.log('Plan');
        console.log('═══════════════════════════════════════════\n');

        const typeLabels: Record<string, string> = {
            systemSetting: 'System Settings', user: 'Users', group: 'Groups',
            application: 'Applications', environment: 'Environments',
            role: 'Roles', scope: 'Scopes', tokenGroup: 'Token Groups',
            password: 'Passwords', permissionRequest: 'Permission Requests',
        };

        for (const [type, label] of Object.entries(typeLabels)) {
            const items = vertexOps.filter(o => {
                const t = o.op === 'upsertVertex' ? o.properties.type : o.singleProperties.type;
                return t === type;
            });
            if (items.length === 0) continue;

            console.log(`${label}:`);
            for (const item of items) {
                if (item.status === 'new') {
                    console.log(`  + ${item.label}`);
                } else {
                    console.log(`    ${item.label} (exists)`);
                }
            }

            // Orphans
            const existingIds = existingByType.get(type) ?? new Set();
            const plannedIds = new Set(items.map(i => i.id));
            for (const id of existingIds) {
                if (!plannedIds.has(id)) {
                    console.log(`  ? ${id} (orphan — not in Azure Entra)`);
                }
            }
            console.log();
        }

        console.log(`Edges: ${edgeCount}`);
        console.log();
        console.log('───────────────────────────────────────────');
        console.log(`  New:      ${newCount}`);
        console.log(`  Exists:   ${existsCount}`);
        console.log(`  Edges:    ${edgeCount}`);

        // ─── Write plan file ─────────────────────────────────────────

        fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
        console.log(`\nPlan saved to ${planFile}`);
        console.log(`Run: npx ts-node scripts/rebuild-gremlin-from-aad.ts apply ${planFile}`);

    } finally {
        await gremlin.close();
    }
}

// ─── Apply command ───────────────────────────────────────────────────

async function applyCommand(planFile: string) {
    if (!fs.existsSync(planFile)) {
        console.error(`Plan file not found: ${planFile}`);
        process.exit(1);
    }

    const plan: RebuildPlan = JSON.parse(fs.readFileSync(planFile, 'utf-8'));
    const gremlinEndpoint = plan.gremlinEndpoint;

    console.log(`Applying plan from ${planFile}`);
    console.log(`Generated at: ${plan.generatedAt}`);
    console.log(`Gremlin endpoint: ${gremlinEndpoint}`);
    console.log(`Operations: ${plan.summary.new} new, ${plan.summary.exists} existing, ${plan.summary.edges} edges\n`);

    const gremlin = new GremlinClient(gremlinEndpoint);

    try {
        let completed = 0;
        const total = plan.operations.length;

        for (const op of plan.operations) {
            switch (op.op) {
                case 'upsertVertex':
                    await gremlin.executeVertexOp(op);
                    if (op.status === 'new') {
                        console.log(`  + ${op.label}`);
                    }
                    break;
                case 'upsertListVertex':
                    await gremlin.executeListVertexOp(op);
                    if (op.status === 'new') {
                        console.log(`  + ${op.label}`);
                    }
                    break;
                case 'upsertEdge':
                    await gremlin.executeEdgeOp(op);
                    break;
            }

            completed++;
            if (completed % 50 === 0) {
                console.log(`  ... ${completed}/${total} operations`);
            }
        }

        console.log(`\nApply complete. ${completed} operations executed.`);
    } finally {
        await gremlin.close();
    }
}

// ─── AAD Query Helpers ───────────────────────────────────────────────

async function getTaggedApps(graph: Client): Promise<Application[]> {
    const apps: Application[] = [];
    let nextLink: string | undefined =
        `/applications?$filter=tags/any(t: t eq '${PONTIFEX_MANAGED_TAG}')&$select=id,appId,displayName,tags,notes,appRoles,api,identifierUris,requiredResourceAccess,passwordCredentials`;
    while (nextLink) {
        const response = await graph.api(nextLink).get();
        apps.push(...response.value);
        nextLink = response['@odata.nextLink'];
    }
    return apps;
}

async function findGroupByName(graph: Client, name: string): Promise<Group | undefined> {
    const resp = await graph.api('/groups').filter(`displayName eq '${name}'`).get();
    return resp.value[0];
}

async function getGroupById(graph: Client, groupId: string): Promise<Group> {
    return await graph.api(`/groups/${groupId}`).get();
}

async function getGroupMembers(graph: Client, groupId: string): Promise<DirectoryObject[]> {
    const resp = await graph.api(`/groups/${groupId}/members`).get();
    return resp.value;
}

async function getGroupOwners(graph: Client, groupId: string): Promise<DirectoryObject[]> {
    const resp = await graph.api(`/groups/${groupId}/owners`).get();
    return resp.value;
}

async function getServicePrincipalByAppId(graph: Client, appId: string): Promise<ServicePrincipal> {
    const resp = await graph.api(`/servicePrincipals?$filter=appId eq '${appId}'`).get();
    if (resp.value.length === 0) throw new Error(`No ServicePrincipal for appId ${appId}`);
    return resp.value[0];
}

async function getAppRoleAssignedTo(graph: Client, spId: string): Promise<AppRoleAssignment[]> {
    const resp = await graph.api(`/servicePrincipals/${spId}/appRoleAssignedTo`).get();
    return resp.value;
}

// ─── Grouping / Inference Helpers ────────────────────────────────────

function groupByInferredAppName(apps: Application[], pontifexClientId: string): Record<string, Application[]> {
    const groups: Record<string, Application[]> = {};
    for (const app of apps) {
        const appName = app.appId === pontifexClientId ? PONTIFEX_APP_NAME : inferAppName(app.displayName!);
        if (!groups[appName]) groups[appName] = [];
        groups[appName].push(app);
    }
    return groups;
}

function inferAppName(displayName: string): string {
    const lastDash = displayName.lastIndexOf('-');
    if (lastDash === -1) return displayName;
    const suffix = displayName.substring(lastDash + 1).toLowerCase();
    return DEFAULT_ENVIRONMENT_LEVELS.includes(suffix) ? displayName.substring(0, lastDash) : displayName;
}

function inferEnvironmentLevels(apps: Application[]): string[] {
    const levels = new Set<string>();
    for (const app of apps) levels.add(extractLevel(app.displayName!));
    if (levels.size === 0) return DEFAULT_ENVIRONMENT_LEVELS;
    const ordered = DEFAULT_ENVIRONMENT_LEVELS.filter(l => levels.has(l));
    for (const l of levels) { if (!ordered.includes(l)) ordered.push(l); }
    return ordered;
}

function extractLevel(envName: string): string {
    const lastDash = envName.lastIndexOf('-');
    if (lastDash === -1) return 'prod';
    const suffix = envName.substring(lastDash + 1).toLowerCase();
    return DEFAULT_ENVIRONMENT_LEVELS.includes(suffix) ? suffix : 'prod';
}

function findAppIdBySpId(spId: string): string | undefined {
    for (const [appId, sid] of appIdToSpId) {
        if (sid === spId) return appId;
    }
    return undefined;
}

// ─── CLI ─────────────────────────────────────────────────────────────

const [command, fileArg] = process.argv.slice(2);

if (command === 'plan') {
    const planFile = fileArg || 'rebuild-plan.json';
    planCommand(planFile).catch(err => { console.error('Fatal:', err); process.exit(1); });
} else if (command === 'apply') {
    if (!fileArg) {
        console.error('Usage: npx ts-node scripts/rebuild-gremlin-from-aad.ts apply <plan.json>');
        process.exit(1);
    }
    applyCommand(fileArg).catch(err => { console.error('Fatal:', err); process.exit(1); });
} else {
    console.log('Usage:');
    console.log('  npx ts-node scripts/rebuild-gremlin-from-aad.ts plan [plan.json]');
    console.log('  npx ts-node scripts/rebuild-gremlin-from-aad.ts apply <plan.json>');
    process.exit(1);
}
