import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import {
  TokenCredentialAuthenticationProvider,
  TokenCredentialAuthenticationProviderOptions,
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { Application } from "@microsoft/microsoft-graph-types";
import "isomorphic-fetch";
import * as dotenv from "dotenv";
import * as path from "path";
import * as readline from "readline";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const TENANT_ID = process.env.PONTIFEX_TENANT_ID!;
const CLIENT_ID = process.env.PONTIFEX_CLIENT_ID!;
const CLIENT_SECRET = process.env.PONTIFEX_CLIENT_SECRET!;

function createGraphClient(): Client {
  const tokenCredential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
  const options: TokenCredentialAuthenticationProviderOptions = {
    scopes: ["https://graph.microsoft.com/.default"],
  };
  const authProvider = new TokenCredentialAuthenticationProvider(tokenCredential, options);
  return Client.initWithMiddleware({ authProvider });
}

async function listE2eApps(client: Client): Promise<Application[]> {
  // Graph API doesn't support contains() on applications, so fetch all and filter client-side
  const apps: Application[] = [];
  let nextLink: string | undefined = `/applications?$select=id,appId,displayName,createdDateTime&$top=100`;

  while (nextLink) {
    const response = await client.api(nextLink).get();
    apps.push(...response.value);
    nextLink = response["@odata.nextLink"];
  }

  return apps.filter((app) => app.displayName?.toLowerCase().includes("e2e"));
}

async function deleteApp(client: Client, objectId: string): Promise<void> {
  await client.api(`/applications/${objectId}`).delete();
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  console.log("Connecting to Azure AD...");
  const client = createGraphClient();

  console.log("Searching for app registrations with 'e2e' in the name...\n");
  const apps = await listE2eApps(client);

  if (apps.length === 0) {
    console.log("No app registrations found with 'e2e' in the name.");
    return;
  }

  console.log(`Found ${apps.length} app registration(s):\n`);
  apps.forEach((app, i) => {
    console.log(`  ${i + 1}. ${app.displayName}`);
    console.log(`     Object ID: ${app.id}`);
    console.log(`     App ID:    ${app.appId}`);
    console.log(`     Created:   ${app.createdDateTime}`);
    console.log();
  });

  const autoConfirm = process.argv.includes("--yes");
  if (!autoConfirm) {
    const answer = await prompt(`Delete all ${apps.length} app registration(s)? (yes/no): `);
    if (answer !== "yes") {
      console.log("Aborted.");
      return;
    }
  }

  console.log("\nDeleting...");
  let deleted = 0;
  let failed = 0;

  for (const app of apps) {
    try {
      await deleteApp(client, app.id!);
      deleted++;
      console.log(`  Deleted: ${app.displayName} (${app.id})`);
    } catch (error: any) {
      failed++;
      console.error(`  Failed to delete ${app.displayName}: ${error.message}`);
    }
  }

  console.log(`\nDone. Deleted: ${deleted}, Failed: ${failed}`);
}

main().catch(console.error);
