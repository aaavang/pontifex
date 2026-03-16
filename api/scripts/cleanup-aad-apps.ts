/**
 * Cleans up stale Azure AD app registrations created by e2e tests.
 *
 * E2E tests create apps with names like "e2e-crud-1234567890-dev",
 * "e2e-dash-1234567890-prod", etc. This script finds and deletes them.
 *
 * Usage:
 *   npx ts-node scripts/cleanup-aad-apps.ts [--dry-run]
 *
 * Requires env vars: PONTIFEX_TENANT_ID, PONTIFEX_CLIENT_ID, PONTIFEX_CLIENT_SECRET
 */

import {ClientSecretCredential} from "@azure/identity";
import {Client} from "@microsoft/microsoft-graph-client";
import {
    TokenCredentialAuthenticationProvider,
    TokenCredentialAuthenticationProviderOptions
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import {Application} from "@microsoft/microsoft-graph-types";
import "isomorphic-fetch";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({path: path.resolve(__dirname, '../.env')});

const E2E_PREFIXES = ['e2e-', 'E2E-'];
const PONTIFEX_APP_NAME = 'Pontifex';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    const tenantId = process.env.PONTIFEX_TENANT_ID!;
    const clientId = process.env.PONTIFEX_CLIENT_ID!;
    const clientSecret = process.env.PONTIFEX_CLIENT_SECRET!;

    if (!tenantId || !clientId || !clientSecret) {
        console.error('Missing required env vars: PONTIFEX_TENANT_ID, PONTIFEX_CLIENT_ID, PONTIFEX_CLIENT_SECRET');
        process.exit(1);
    }

    const tokenCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const options: TokenCredentialAuthenticationProviderOptions = {
        scopes: ["https://graph.microsoft.com/.default"]
    };
    const authProvider = new TokenCredentialAuthenticationProvider(tokenCredential, options);
    const graph = Client.initWithMiddleware({authProvider});

    console.log(`Scanning Azure AD app registrations... ${DRY_RUN ? '(DRY RUN)' : ''}`);

    // Fetch all app registrations
    let apps: Application[] = [];
    let nextLink: string | undefined = '/applications?$top=100&$select=id,displayName,createdDateTime';

    while (nextLink) {
        const response = await graph.api(nextLink).get();
        apps.push(...response.value);
        nextLink = response['@odata.nextLink'];
    }

    console.log(`Found ${apps.length} total app registrations.`);

    // Filter to e2e test apps
    const staleApps = apps.filter(app => {
        const name = app.displayName ?? '';
        // Match e2e- prefixed apps (created by tests)
        if (E2E_PREFIXES.some(prefix => name.startsWith(prefix))) return true;
        // Match environment apps created for e2e tests (e.g., "e2e-crud-123-dev")
        if (E2E_PREFIXES.some(prefix => name.includes(prefix))) return true;
        return false;
    });

    // Never delete the Pontifex app itself
    const toDelete = staleApps.filter(app => app.displayName !== PONTIFEX_APP_NAME);

    if (toDelete.length === 0) {
        console.log('No stale e2e app registrations found.');
        return;
    }

    console.log(`\nFound ${toDelete.length} stale e2e app registrations:`);
    for (const app of toDelete) {
        console.log(`  ${app.displayName} (${app.id}) created ${app.createdDateTime}`);
    }

    if (DRY_RUN) {
        console.log('\nDry run — no apps deleted. Remove --dry-run to delete.');
        return;
    }

    console.log(`\nDeleting ${toDelete.length} app registrations...`);
    let deleted = 0;
    let failed = 0;

    for (const app of toDelete) {
        try {
            await graph.api(`/applications/${app.id}`).delete();
            deleted++;
            console.log(`  ✓ Deleted: ${app.displayName} (${app.id})`);
        } catch (error: any) {
            failed++;
            console.error(`  ✗ Failed: ${app.displayName} (${app.id}) — ${error.message ?? error}`);
        }
    }

    console.log(`\nDone. Deleted: ${deleted}, Failed: ${failed}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
