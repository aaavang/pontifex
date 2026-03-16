terraform {
  required_providers {
    pontifex = {
      source = "registry.terraform.io/pontifex/pontifex"
    }
  }
}

## Option 1: Client credentials (recommended for automation)
# The service principal must have the ProgrammaticAccess role on the Pontifex app.
provider "pontifex" {
  base_url = "https://api.pontifex.localhost:8443"
  # These can also be set via environment variables:
  #   PONTIFEX_TENANT_ID, PONTIFEX_CLIENT_ID, PONTIFEX_CLIENT_SECRET, PONTIFEX_AUDIENCE
  tenant_id     = "your-tenant-id"
  client_id     = "your-service-principal-client-id"
  client_secret = "your-service-principal-client-secret"
  audience      = "pontifex-app-client-id" # defaults to client_id if omitted
}

## Option 2: Direct bearer token
# provider "pontifex" {
#   base_url = "https://api.pontifex.localhost:8443"
#   token    = "your-azure-ad-bearer-token"  # or set PONTIFEX_TOKEN
# }

# --- Data Sources ---

data "pontifex_user" "me" {
  id = "00000000-0000-0000-0000-000000000001"
}

# --- Application ---

resource "pontifex_application" "my_app" {
  name         = "My Service"
  description  = "An example application managed by Terraform"
  environments = ["dev", "prod"]
  owner_ids    = [data.pontifex_user.me.id]
}

# --- Look up the created application ---

data "pontifex_application" "my_app" {
  id = pontifex_application.my_app.id
}

# --- Group ---

resource "pontifex_group" "developers" {
  name       = "My Service Developers"
  owner_ids  = [data.pontifex_user.me.id]
  member_ids = [data.pontifex_user.me.id]
}

# --- Individual group membership ---

resource "pontifex_group_membership" "extra_member" {
  group_id = pontifex_group.developers.id
  user_id  = "00000000-0000-0000-0000-000000000002"
}

# --- Environment data source ---

data "pontifex_environment" "dev" {
  id = pontifex_application.my_app.id # Replace with actual environment ID
}

# --- Token Group ---

resource "pontifex_token_group" "dev_access" {
  application_id = pontifex_application.my_app.id
  name           = "dev-access"
  claim_value    = "DevAccess"
  group_id       = pontifex_group.developers.id
  description    = "Grants dev access to group members"
}
