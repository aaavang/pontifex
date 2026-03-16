package provider_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
	"github.com/pontifex/terraform-provider-pontifex/internal/client"
)

func TestAccGroupResource_basic(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	groupID := "group-test-id-123"

	// POST /api/groups — create
	mock.handle("POST", "/api/groups", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]client.Group{
			"group": {
				ID:   groupID,
				Name: "test-group",
			},
		})
	})

	// GET /api/groups/{id} — read
	mock.handleJSON("GET", "/api/groups/"+groupID, http.StatusOK, client.GroupBundle{
		Group: client.Group{
			ID:   groupID,
			Name: "test-group",
		},
		Owners:  []client.User{},
		Members: []client.User{},
	})

	// PATCH owners/members (called when explicitly set to empty)
	mock.handle("PATCH", "/api/groups/"+groupID+"/owners", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mock.handle("PATCH", "/api/groups/"+groupID+"/members", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// DELETE /api/groups/{id} — destroy
	mock.handle("DELETE", "/api/groups/"+groupID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_group" "test" {
  name       = "test-group"
  owner_ids  = []
  member_ids = []
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_group.test", "id", groupID),
					resource.TestCheckResourceAttr("pontifex_group.test", "name", "test-group"),
					resource.TestCheckResourceAttr("pontifex_group.test", "owner_ids.#", "0"),
					resource.TestCheckResourceAttr("pontifex_group.test", "member_ids.#", "0"),
				),
			},
		},
	})
}

func TestAccGroupResource_withMembers(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	groupID := "group-members-id-456"

	mock.handle("POST", "/api/groups", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]client.Group{
			"group": {
				ID:   groupID,
				Name: "team-group",
			},
		})
	})

	// PATCH owners
	mock.handle("PATCH", "/api/groups/"+groupID+"/owners", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// PATCH members
	mock.handle("PATCH", "/api/groups/"+groupID+"/members", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	mock.handleJSON("GET", "/api/groups/"+groupID, http.StatusOK, client.GroupBundle{
		Group: client.Group{
			ID:   groupID,
			Name: "team-group",
		},
		Owners: []client.User{
			{ID: "owner-1", Name: "Owner One"},
		},
		Members: []client.User{
			{ID: "member-1", Name: "Member One"},
			{ID: "member-2", Name: "Member Two"},
		},
	})

	mock.handle("DELETE", "/api/groups/"+groupID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_group" "test" {
  name       = "team-group"
  owner_ids  = ["owner-1"]
  member_ids = ["member-1", "member-2"]
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_group.test", "id", groupID),
					resource.TestCheckResourceAttr("pontifex_group.test", "name", "team-group"),
					resource.TestCheckResourceAttr("pontifex_group.test", "owner_ids.#", "1"),
					resource.TestCheckResourceAttr("pontifex_group.test", "member_ids.#", "2"),
				),
			},
		},
	})
}

func TestAccGroupResource_importState(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	groupID := "group-import-id-789"

	mock.handle("POST", "/api/groups", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]client.Group{
			"group": {
				ID:   groupID,
				Name: "import-group",
			},
		})
	})

	mock.handleJSON("GET", "/api/groups/"+groupID, http.StatusOK, client.GroupBundle{
		Group: client.Group{
			ID:   groupID,
			Name: "import-group",
		},
		Owners:  []client.User{},
		Members: []client.User{},
	})

	mock.handle("PATCH", "/api/groups/"+groupID+"/owners", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mock.handle("PATCH", "/api/groups/"+groupID+"/members", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	mock.handle("DELETE", "/api/groups/"+groupID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_group" "test" {
  name       = "import-group"
  owner_ids  = []
  member_ids = []
}
`,
			},
			{
				ResourceName:      "pontifex_group.test",
				ImportState:       true,
				ImportStateVerify: true,
			},
		},
	})
}
