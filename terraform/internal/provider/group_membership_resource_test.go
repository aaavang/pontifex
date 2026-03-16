package provider_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
	"github.com/pontifex/terraform-provider-pontifex/internal/client"
)

func TestAccGroupMembershipResource_basic(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	groupID := "gm-group-100"
	userID := "gm-user-200"

	// POST /api/groups/{id}/members/{id} — create
	mock.handle("POST", "/api/groups/"+groupID+"/members/"+userID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// GET /api/groups/{id} — read (membership checks group members)
	mock.handleJSON("GET", "/api/groups/"+groupID, http.StatusOK, client.GroupBundle{
		Group: client.Group{
			ID:   groupID,
			Name: "test-group",
		},
		Owners: []client.User{},
		Members: []client.User{
			{ID: userID, Name: "Test User"},
		},
	})

	// DELETE /api/groups/{id}/members/{id} — destroy
	mock.handle("DELETE", "/api/groups/"+groupID+"/members/"+userID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_group_membership" "test" {
  group_id = "` + groupID + `"
  user_id  = "` + userID + `"
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_group_membership.test", "id", groupID+"/"+userID),
					resource.TestCheckResourceAttr("pontifex_group_membership.test", "group_id", groupID),
					resource.TestCheckResourceAttr("pontifex_group_membership.test", "user_id", userID),
				),
			},
		},
	})
}

func TestAccGroupMembershipResource_importState(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	groupID := "gm-import-group-300"
	userID := "gm-import-user-400"

	// POST create
	mock.handle("POST", "/api/groups/"+groupID+"/members/"+userID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// GET read
	mock.handleJSON("GET", "/api/groups/"+groupID, http.StatusOK, client.GroupBundle{
		Group: client.Group{
			ID:   groupID,
			Name: "import-group",
		},
		Owners: []client.User{},
		Members: []client.User{
			{ID: userID, Name: "Import User"},
		},
	})

	// DELETE destroy
	mock.handle("DELETE", "/api/groups/"+groupID+"/members/"+userID, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_group_membership" "test" {
  group_id = "` + groupID + `"
  user_id  = "` + userID + `"
}
`,
			},
			{
				ResourceName:      "pontifex_group_membership.test",
				ImportState:       true,
				ImportStateId:     groupID + "/" + userID,
				ImportStateVerify: true,
			},
		},
	})
}

func TestAccGroupMembershipResource_memberRemoved(t *testing.T) {
	mock := newMockServer()
	defer mock.close()

	groupID := "gm-removed-group-500"
	userID := "gm-removed-user-600"
	memberPresent := true

	// POST create — re-adds the member
	mock.handle("POST", "/api/groups/"+groupID+"/members/"+userID, func(w http.ResponseWriter, r *http.Request) {
		memberPresent = true
		w.WriteHeader(http.StatusOK)
	})

	// GET read — returns member based on current state
	mock.handle("GET", "/api/groups/"+groupID, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		bundle := client.GroupBundle{
			Group:   client.Group{ID: groupID, Name: "test-group"},
			Owners:  []client.User{},
			Members: []client.User{},
		}

		if memberPresent {
			bundle.Members = []client.User{{ID: userID, Name: "Test User"}}
		}

		json.NewEncoder(w).Encode(bundle)
	})

	// DELETE destroy
	mock.handle("DELETE", "/api/groups/"+groupID+"/members/"+userID, func(w http.ResponseWriter, r *http.Request) {
		memberPresent = false
		w.WriteHeader(http.StatusNoContent)
	})

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: mock.providerConfig() + `
resource "pontifex_group_membership" "test" {
  group_id = "` + groupID + `"
  user_id  = "` + userID + `"
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_group_membership.test", "id", groupID+"/"+userID),
				),
			},
			// Step 2: Remove the resource from config — Terraform should call DELETE.
			// Then re-add it to verify re-creation works.
			{
				Config: mock.providerConfig() + `
# membership removed from config
`,
			},
			{
				Config: mock.providerConfig() + `
resource "pontifex_group_membership" "test" {
  group_id = "` + groupID + `"
  user_id  = "` + userID + `"
}
`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttr("pontifex_group_membership.test", "id", groupID+"/"+userID),
				),
			},
		},
	})
}
