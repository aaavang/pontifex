package provider_test

import (
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
	"github.com/pontifex/terraform-provider-pontifex/internal/client"
)

func TestAccApplicationResource_basic(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	appID := "app-test-id-123"

	// POST /api/applications — create
	mock.handle("POST", "/api/applications", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(client.Application{
			ID:   appID,
			Name: "test-app",
		})
	})

	// GET /api/applications/{id} — read
	mock.handleJSON("GET", "/api/applications/"+appID, http.StatusOK, client.ApplicationBundle{
		Application: client.Application{
			ID:   appID,
			Name: "test-app",
		},
		Environments: []client.Environment{
			{ID: "env-1", Name: "test-app-dev", Level: "dev"},
		},
		Owners: []client.User{},
	})

	// DELETE /api/applications/{id} — destroy
	mock.handle("DELETE", "/api/applications/"+appID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_application" "test" {
  name         = "test-app"
  environments = ["dev"]
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_application.test", "id", appID),
					resource.TestCheckResourceAttr("pontifex_application.test", "name", "test-app"),
					resource.TestCheckResourceAttr("pontifex_application.test", "environments.#", "1"),
					resource.TestCheckResourceAttr("pontifex_application.test", "environments.0", "dev"),
				),
			},
		},
	})
}

func TestAccApplicationResource_withDescription(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	appID := "app-desc-id-456"

	mock.handle("POST", "/api/applications", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var req client.CreateApplicationRequest
		json.Unmarshal(body, &req)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(client.Application{
			ID:          appID,
			Name:        req.ApplicationName,
			Description: req.Description,
		})
	})

	mock.handleJSON("GET", "/api/applications/"+appID, http.StatusOK, client.ApplicationBundle{
		Application: client.Application{
			ID:          appID,
			Name:        "my-service",
			Description: "A test service",
		},
		Environments: []client.Environment{
			{ID: "env-1", Level: "dev"},
			{ID: "env-2", Level: "prod"},
		},
		Owners: []client.User{},
	})

	mock.handle("DELETE", "/api/applications/"+appID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_application" "test" {
  name         = "my-service"
  description  = "A test service"
  environments = ["dev", "prod"]
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_application.test", "id", appID),
					resource.TestCheckResourceAttr("pontifex_application.test", "name", "my-service"),
					resource.TestCheckResourceAttr("pontifex_application.test", "description", "A test service"),
					resource.TestCheckResourceAttr("pontifex_application.test", "environments.#", "2"),
				),
			},
		},
	})
}

func TestAccApplicationResource_update(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	appID := "app-update-id-789"
	step := 0

	mock.handle("POST", "/api/applications", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(client.Application{
			ID:   appID,
			Name: "update-app",
		})
	})

	mock.handle("GET", "/api/applications/"+appID, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		bundle := client.ApplicationBundle{
			Application: client.Application{
				ID:   appID,
				Name: "update-app",
			},
			Owners: []client.User{},
		}

		if step == 0 {
			bundle.Environments = []client.Environment{
				{ID: "env-1", Level: "dev"},
			}
		} else {
			bundle.Application.Description = "updated"
			bundle.Environments = []client.Environment{
				{ID: "env-1", Level: "dev"},
				{ID: "env-2", Level: "staging"},
			}
		}

		json.NewEncoder(w).Encode(bundle)
	})

	mock.handle("PATCH", "/api/applications/"+appID, func(w http.ResponseWriter, r *http.Request) {
		step = 1
		w.WriteHeader(http.StatusOK)
	})

	mock.handle("DELETE", "/api/applications/"+appID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_application" "test" {
  name         = "update-app"
  environments = ["dev"]
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_application.test", "environments.#", "1"),
				),
			},
			{
				Config: mock.providerConfig() + `
resource "pontifex_application" "test" {
  name         = "update-app"
  description  = "updated"
  environments = ["dev", "staging"]
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_application.test", "environments.#", "2"),
					resource.TestCheckResourceAttr("pontifex_application.test", "description", "updated"),
				),
			},
		},
	})
}

func TestAccApplicationResource_importState(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	appID := "app-import-id-101"

	mock.handle("POST", "/api/applications", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(client.Application{
			ID:   appID,
			Name: "import-app",
		})
	})

	mock.handleJSON("GET", "/api/applications/"+appID, http.StatusOK, client.ApplicationBundle{
		Application: client.Application{
			ID:   appID,
			Name: "import-app",
		},
		Environments: []client.Environment{
			{ID: "env-1", Level: "dev"},
		},
		Owners: []client.User{},
	})

	mock.handle("DELETE", "/api/applications/"+appID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_application" "test" {
  name         = "import-app"
  environments = ["dev"]
}
`,
			},
			{
				ResourceName:      "pontifex_application.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
		},
	})
}
