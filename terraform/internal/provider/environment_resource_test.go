package provider_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
	"github.com/pontifex/terraform-provider-pontifex/internal/client"
)

func TestAccEnvironmentResource_basic(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	appID := "app-env-test-100"
	envID := "env-test-id-200"

	// POST /api/applications/{id}/environments — create
	mock.handle("POST", "/api/applications/"+appID+"/environments", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]client.EnvironmentBundle{
			"environment": {
				Environment: client.Environment{
					ID:       envID,
					Name:     "my-app-staging",
					Level:    "staging",
					ClientID: "aad-client-id-abc",
				},
			},
		})
	})

	// GET /api/environments/{id} — read
	mock.handleJSON("GET", "/api/environments/"+envID, http.StatusOK, client.EnvironmentBundle{
		Environment: client.Environment{
			ID:       envID,
			Name:     "my-app-staging",
			Level:    "staging",
			ClientID: "aad-client-id-abc",
		},
		Application: client.Application{ID: appID, Name: "my-app"},
	})

	// DELETE /api/environments/{id} — destroy
	mock.handle("DELETE", "/api/environments/"+envID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_environment" "test" {
  application_id = "` + appID + `"
  level          = "staging"
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_environment.test", "id", envID),
					resource.TestCheckResourceAttr("pontifex_environment.test", "name", "my-app-staging"),
					resource.TestCheckResourceAttr("pontifex_environment.test", "level", "staging"),
					resource.TestCheckResourceAttr("pontifex_environment.test", "client_id", "aad-client-id-abc"),
					resource.TestCheckResourceAttr("pontifex_environment.test", "application_id", appID),
				),
			},
		},
	})
}

func TestAccEnvironmentResource_withRedirectUrls(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	appID := "app-env-redir-300"
	envID := "env-redir-id-400"

	// POST create — returns env with redirect URLs
	mock.handle("POST", "/api/applications/"+appID+"/environments", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]client.EnvironmentBundle{
			"environment": {
				Environment: client.Environment{
					ID:              envID,
					Name:            "my-app-dev",
					Level:           "dev",
					ClientID:        "aad-client-id-dev",
					SpaRedirectUrls: []string{"http://localhost:3000"},
					WebRedirectUrls: []string{"http://localhost:8080/callback"},
				},
			},
		})
	})

	// PATCH update — resource Create calls UpdateEnvironment after creation when redirect URLs are set
	mock.handle("PATCH", "/api/environments/"+envID, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]client.Environment{
			"environment": {
				ID:              envID,
				Name:            "my-app-dev",
				Level:           "dev",
				ClientID:        "aad-client-id-dev",
				SpaRedirectUrls: []string{"http://localhost:3000"},
				WebRedirectUrls: []string{"http://localhost:8080/callback"},
			},
		})
	})

	// GET read
	mock.handleJSON("GET", "/api/environments/"+envID, http.StatusOK, client.EnvironmentBundle{
		Environment: client.Environment{
			ID:              envID,
			Name:            "my-app-dev",
			Level:           "dev",
			ClientID:        "aad-client-id-dev",
			SpaRedirectUrls: []string{"http://localhost:3000"},
			WebRedirectUrls: []string{"http://localhost:8080/callback"},
		},
		Application: client.Application{ID: appID, Name: "my-app"},
	})

	// DELETE
	mock.handle("DELETE", "/api/environments/"+envID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_environment" "test" {
  application_id   = "` + appID + `"
  level            = "dev"
  spa_redirect_urls = ["http://localhost:3000"]
  web_redirect_urls = ["http://localhost:8080/callback"]
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_environment.test", "id", envID),
					resource.TestCheckResourceAttr("pontifex_environment.test", "level", "dev"),
					resource.TestCheckResourceAttr("pontifex_environment.test", "spa_redirect_urls.#", "1"),
					resource.TestCheckResourceAttr("pontifex_environment.test", "spa_redirect_urls.0", "http://localhost:3000"),
					resource.TestCheckResourceAttr("pontifex_environment.test", "web_redirect_urls.#", "1"),
					resource.TestCheckResourceAttr("pontifex_environment.test", "web_redirect_urls.0", "http://localhost:8080/callback"),
				),
			},
		},
	})
}

func TestAccEnvironmentResource_update(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	appID := "app-env-upd-500"
	envID := "env-upd-id-600"
	step := 0

	// POST create
	mock.handle("POST", "/api/applications/"+appID+"/environments", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]client.EnvironmentBundle{
			"environment": {
				Environment: client.Environment{
					ID:       envID,
					Name:     "my-app-dev",
					Level:    "dev",
					ClientID: "aad-client-id-upd",
				},
			},
		})
	})

	// GET read — returns different state based on step
	mock.handle("GET", "/api/environments/"+envID, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		env := client.Environment{
			ID:       envID,
			Name:     "my-app-dev",
			Level:    "dev",
			ClientID: "aad-client-id-upd",
		}

		if step >= 1 {
			env.SpaRedirectUrls = []string{"http://localhost:3000", "http://localhost:4000"}
		}

		json.NewEncoder(w).Encode(client.EnvironmentBundle{
			Environment: env,
			Application: client.Application{ID: appID, Name: "my-app"},
		})
	})

	// PATCH update
	mock.handle("PATCH", "/api/environments/"+envID, func(w http.ResponseWriter, r *http.Request) {
		step = 1
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]client.Environment{
			"environment": {
				ID:              envID,
				Name:            "my-app-dev",
				Level:           "dev",
				ClientID:        "aad-client-id-upd",
				SpaRedirectUrls: []string{"http://localhost:3000", "http://localhost:4000"},
			},
		})
	})

	// DELETE
	mock.handle("DELETE", "/api/environments/"+envID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_environment" "test" {
  application_id = "` + appID + `"
  level          = "dev"
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_environment.test", "id", envID),
					resource.TestCheckNoResourceAttr("pontifex_environment.test", "spa_redirect_urls.#"),
				),
			},
			{
				Config: mock.providerConfig() + `
resource "pontifex_environment" "test" {
  application_id    = "` + appID + `"
  level             = "dev"
  spa_redirect_urls = ["http://localhost:3000", "http://localhost:4000"]
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_environment.test", "spa_redirect_urls.#", "2"),
				),
			},
		},
	})
}
