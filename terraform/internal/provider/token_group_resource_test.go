package provider_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
	"github.com/pontifex/terraform-provider-pontifex/internal/client"
)

func TestAccTokenGroupResource_basic(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	appID := "app-tg-100"
	tgID := "tg-id-200"
	groupID := "aad-group-id-300"
	envID := "env-tg-400"

	// POST /api/applications/{id}/token-groups — create
	mock.handle("POST", "/api/applications/"+appID+"/token-groups", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string][]client.TokenGroup{
			"tokenGroups": {
				{
					ID:         tgID,
					Name:       "admin",
					ClaimValue: "admin",
					GroupID:    groupID,
					EnvID:      envID,
				},
			},
		})
	})

	// GET /api/applications/{id} — read (token group Read fetches the app bundle)
	mock.handleJSON("GET", "/api/applications/"+appID, http.StatusOK, client.ApplicationBundle{
		Application: client.Application{ID: appID, Name: "my-app"},
		Environments: []client.Environment{
			{ID: envID, Name: "my-app-dev", Level: "dev"},
		},
		Owners: []client.User{},
	})

	// GET /api/environments/{id} — read (token group Read fetches env bundles to find the token group)
	mock.handleJSON("GET", "/api/environments/"+envID, http.StatusOK, client.EnvironmentBundle{
		Environment: client.Environment{ID: envID, Name: "my-app-dev", Level: "dev"},
		TokenGroups: []client.TokenGroup{
			{
				ID:         tgID,
				Name:       "admin",
				ClaimValue: "admin",
				GroupID:    groupID,
				EnvID:      envID,
			},
		},
	})

	// DELETE /api/applications/{id}/token-groups — destroy
	mock.handle("DELETE", "/api/applications/"+appID+"/token-groups", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_token_group" "test" {
  application_id = "` + appID + `"
  name           = "admin"
  claim_value    = "admin"
  group_id       = "` + groupID + `"
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_token_group.test", "id", tgID),
					resource.TestCheckResourceAttr("pontifex_token_group.test", "name", "admin"),
					resource.TestCheckResourceAttr("pontifex_token_group.test", "claim_value", "admin"),
					resource.TestCheckResourceAttr("pontifex_token_group.test", "group_id", groupID),
					resource.TestCheckResourceAttr("pontifex_token_group.test", "application_id", appID),
				),
			},
		},
	})
}

func TestAccTokenGroupResource_withDescription(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	appID := "app-tg-desc-500"
	tgID := "tg-desc-id-600"
	groupID := "aad-group-desc-700"
	envID := "env-tg-desc-800"

	mock.handle("POST", "/api/applications/"+appID+"/token-groups", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string][]client.TokenGroup{
			"tokenGroups": {
				{
					ID:          tgID,
					Name:        "editor",
					ClaimValue:  "editor",
					GroupID:     groupID,
					EnvID:       envID,
					Description: "Editor access role",
				},
			},
		})
	})

	mock.handleJSON("GET", "/api/applications/"+appID, http.StatusOK, client.ApplicationBundle{
		Application:  client.Application{ID: appID, Name: "my-app"},
		Environments: []client.Environment{{ID: envID, Name: "my-app-dev", Level: "dev"}},
		Owners:       []client.User{},
	})

	mock.handleJSON("GET", "/api/environments/"+envID, http.StatusOK, client.EnvironmentBundle{
		Environment: client.Environment{ID: envID, Name: "my-app-dev", Level: "dev"},
		TokenGroups: []client.TokenGroup{
			{
				ID:          tgID,
				Name:        "editor",
				ClaimValue:  "editor",
				GroupID:     groupID,
				EnvID:       envID,
				Description: "Editor access role",
			},
		},
	})

	mock.handle("DELETE", "/api/applications/"+appID+"/token-groups", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_token_group" "test" {
  application_id = "` + appID + `"
  name           = "editor"
  claim_value    = "editor"
  group_id       = "` + groupID + `"
  description    = "Editor access role"
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_token_group.test", "id", tgID),
					resource.TestCheckResourceAttr("pontifex_token_group.test", "description", "Editor access role"),
				),
			},
		},
	})
}

func TestAccTokenGroupResource_updateDescription(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	appID := "app-tg-upd-900"
	tgID := "tg-upd-id-1000"
	groupID := "aad-group-upd-1100"
	envID := "env-tg-upd-1200"
	step := 0

	mock.handle("POST", "/api/applications/"+appID+"/token-groups", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string][]client.TokenGroup{
			"tokenGroups": {
				{
					ID:         tgID,
					Name:       "viewer",
					ClaimValue: "viewer",
					GroupID:    groupID,
					EnvID:      envID,
				},
			},
		})
	})

	mock.handleJSON("GET", "/api/applications/"+appID, http.StatusOK, client.ApplicationBundle{
		Application:  client.Application{ID: appID, Name: "my-app"},
		Environments: []client.Environment{{ID: envID, Name: "my-app-dev", Level: "dev"}},
		Owners:       []client.User{},
	})

	mock.handle("GET", "/api/environments/"+envID, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		tg := client.TokenGroup{
			ID:         tgID,
			Name:       "viewer",
			ClaimValue: "viewer",
			GroupID:    groupID,
			EnvID:      envID,
		}
		if step >= 1 {
			tg.Description = "Updated viewer description"
		}

		json.NewEncoder(w).Encode(client.EnvironmentBundle{
			Environment: client.Environment{ID: envID, Name: "my-app-dev", Level: "dev"},
			TokenGroups: []client.TokenGroup{tg},
		})
	})

	// PATCH /api/applications/{id}/token-groups/{id} — update description
	mock.handle("PATCH", "/api/applications/"+appID+"/token-groups/"+tgID, func(w http.ResponseWriter, r *http.Request) {
		step = 1
		w.WriteHeader(http.StatusOK)
	})

	mock.handle("DELETE", "/api/applications/"+appID+"/token-groups", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_token_group" "test" {
  application_id = "` + appID + `"
  name           = "viewer"
  claim_value    = "viewer"
  group_id       = "` + groupID + `"
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_token_group.test", "id", tgID),
					resource.TestCheckNoResourceAttr("pontifex_token_group.test", "description"),
				),
			},
			{
				Config: mock.providerConfig() + `
resource "pontifex_token_group" "test" {
  application_id = "` + appID + `"
  name           = "viewer"
  claim_value    = "viewer"
  group_id       = "` + groupID + `"
  description    = "Updated viewer description"
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_token_group.test", "description", "Updated viewer description"),
				),
			},
		},
	})
}
