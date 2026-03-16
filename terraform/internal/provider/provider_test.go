package provider_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/hashicorp/terraform-plugin-framework/providerserver"
	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/hashicorp/terraform-plugin-testing/helper/resource"
	"github.com/pontifex/terraform-provider-pontifex/internal/provider"
)

// testAccProtoV6ProviderFactories returns provider factories for acceptance tests.
var testAccProtoV6ProviderFactories = map[string]func() (tfprotov6.ProviderServer, error){
	"pontifex": providerserver.NewProtocol6WithError(provider.New("test")()),
}

// mockServer provides a configurable HTTP mock for the Pontifex API.
// Use it to set up expected responses per route for acceptance tests.
type mockServer struct {
	server   *httptest.Server
	mu       sync.Mutex
	handlers map[string]http.HandlerFunc
}

// newMockServer starts a new mock Pontifex API server.
func newMockServer() *mockServer {
	m := &mockServer{
		handlers: make(map[string]http.HandlerFunc),
	}
	m.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m.mu.Lock()
		key := r.Method + " " + r.URL.Path
		handler, ok := m.handlers[key]
		m.mu.Unlock()

		if !ok {
			http.Error(w, fmt.Sprintf("no mock handler for %s", key), http.StatusNotFound)
			return
		}
		handler(w, r)
	}))
	return m
}

// handle registers a handler for a specific method + path combination.
func (m *mockServer) handle(method, path string, handler http.HandlerFunc) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.handlers[method+" "+path] = handler
}

// handleJSON registers a handler that returns a JSON response.
func (m *mockServer) handleJSON(method, path string, statusCode int, body interface{}) {
	m.handle(method, path, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		json.NewEncoder(w).Encode(body)
	})
}

// close shuts down the mock server.
func (m *mockServer) close() {
	m.server.Close()
}

// providerConfig returns a Terraform provider configuration block pointing at the mock server.
func (m *mockServer) providerConfig() string {
	return fmt.Sprintf(`
provider "pontifex" {
  base_url = %q
  token    = "mock-test-token"
}
`, m.server.URL)
}

// TestProviderSchema verifies the provider can be instantiated.
func TestProviderSchema(t *testing.T) {
	t.Parallel()

	resource.Test(t, resource.TestCase{
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: `provider "pontifex" {
					base_url = "http://localhost:8080"
					token    = "test-token"
				}`,
			},
		},
	})
}
