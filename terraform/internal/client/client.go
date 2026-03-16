package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// Client is the HTTP client for the Pontifex API.
type Client struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
}

// TokenResponse represents the OAuth2 token response from Azure AD.
type TokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

// NewClient creates a new Pontifex API client with a pre-existing bearer token.
func NewClient(baseURL, token string) *Client {
	return &Client{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		Token:      token,
		HTTPClient: &http.Client{},
	}
}

// NewClientWithCredentials creates a new Pontifex API client by requesting
// a token from Azure AD using the OAuth2 client credentials flow.
// The audience parameter is the Pontifex app's client ID (target API app registration).
func NewClientWithCredentials(baseURL, tenantID, clientID, clientSecret, audience string) (*Client, error) {
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", tenantID)
	scope := audience + "/.default"

	data := url.Values{}
	data.Set("grant_type", "client_credentials")
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("scope", scope)

	resp, err := http.Post(tokenURL, "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("requesting token from Azure AD: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Azure AD token request failed (status %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("parsing token response: %w", err)
	}

	if tokenResp.AccessToken == "" {
		return nil, fmt.Errorf("Azure AD returned empty access token")
	}

	return &Client{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		Token:      tokenResp.AccessToken,
		HTTPClient: &http.Client{},
	}, nil
}

func (c *Client) doRequest(method, path string, body interface{}, result interface{}) error {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshaling request body: %w", err)
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, reqBody)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	if result != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("unmarshaling response: %w", err)
		}
	}

	return nil
}

// --- Application ---

type Application struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Creator      string `json:"creator"`
	Description  string `json:"description"`
	LoginEnabled bool   `json:"loginEnabled"`
}

type ApplicationBundle struct {
	Application  Application   `json:"application"`
	Environments []Environment `json:"environments"`
	Owners       []User        `json:"owners"`
}

type CreateApplicationRequest struct {
	ApplicationName string   `json:"applicationName"`
	Environments    []string `json:"environments"`
	Description     string   `json:"description,omitempty"`
}

type UpdateApplicationRequest struct {
	Environments []string `json:"environments"`
	Description  string   `json:"description,omitempty"`
}

func (c *Client) CreateApplication(req CreateApplicationRequest) (*Application, error) {
	var app Application
	err := c.doRequest("POST", "/api/applications", req, &app)
	return &app, err
}

func (c *Client) GetApplication(id string) (*ApplicationBundle, error) {
	var bundle ApplicationBundle
	err := c.doRequest("GET", "/api/applications/"+id, nil, &bundle)
	return &bundle, err
}

func (c *Client) UpdateApplication(id string, req UpdateApplicationRequest) error {
	return c.doRequest("PATCH", "/api/applications/"+id, req, nil)
}

func (c *Client) DeleteApplication(id string) error {
	return c.doRequest("DELETE", "/api/applications/"+id, nil, nil)
}

func (c *Client) UpdateApplicationOwners(id string, ownerIds []string) error {
	body := map[string][]string{"ownerIds": ownerIds}
	return c.doRequest("PUT", "/api/applications/"+id+"/owners", body, nil)
}

// --- Application Roles ---

type RoleDto struct {
	DisplayName string `json:"displayName"`
	ClaimValue  string `json:"claimValue"`
	Sensitive   bool   `json:"sensitive"`
	Description string `json:"description,omitempty"`
}

func (c *Client) UpdateApplicationRoles(appID string, roles []RoleDto) error {
	body := map[string][]RoleDto{"roles": roles}
	return c.doRequest("PATCH", "/api/applications/"+appID+"/roles", body, nil)
}

// --- Application Scopes ---

type ScopeDto struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Description string `json:"description,omitempty"`
}

func (c *Client) UpdateApplicationScopes(appID string, scopes []ScopeDto) error {
	body := map[string][]ScopeDto{"scopes": scopes}
	return c.doRequest("PATCH", "/api/applications/"+appID+"/scopes", body, nil)
}

// --- Group ---

type Group struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	NormalizedName string `json:"normalizedName"`
}

type GroupBundle struct {
	Group   Group  `json:"group"`
	Owners  []User `json:"owners"`
	Members []User `json:"members"`
}

func (c *Client) CreateGroup(name string) (*Group, error) {
	body := map[string]string{"name": name}
	var resp struct {
		Group Group `json:"group"`
	}
	err := c.doRequest("POST", "/api/groups", body, &resp)
	return &resp.Group, err
}

func (c *Client) GetGroup(id string) (*GroupBundle, error) {
	var bundle GroupBundle
	err := c.doRequest("GET", "/api/groups/"+id, nil, &bundle)
	return &bundle, err
}

func (c *Client) DeleteGroup(id string) error {
	return c.doRequest("DELETE", "/api/groups/"+id, nil, nil)
}

func (c *Client) UpdateGroupOwners(id string, ownerIds []string) error {
	body := map[string][]string{"ownerIds": ownerIds}
	return c.doRequest("PATCH", "/api/groups/"+id+"/owners", body, nil)
}

func (c *Client) UpdateGroupMembers(id string, memberIds []string) error {
	body := map[string][]string{"memberIds": memberIds}
	return c.doRequest("PATCH", "/api/groups/"+id+"/members", body, nil)
}

func (c *Client) AddGroupMember(groupID, userID string) error {
	return c.doRequest("POST", "/api/groups/"+groupID+"/members/"+userID, nil, nil)
}

func (c *Client) RemoveGroupMember(groupID, userID string) error {
	return c.doRequest("DELETE", "/api/groups/"+groupID+"/members/"+userID, nil, nil)
}

// --- Environment ---

type Environment struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Level           string   `json:"level"`
	ClientID        string   `json:"clientId"`
	SpaRedirectUrls []string `json:"spaRedirectUrls"`
	WebRedirectUrls []string `json:"webRedirectUrls"`
}

type EnvironmentBundle struct {
	Environment Environment  `json:"environment"`
	Roles       []Role       `json:"roles"`
	Scopes      []Scope      `json:"scopes"`
	Passwords   []Password   `json:"passwords"`
	Application Application  `json:"application"`
	TokenGroups []TokenGroup `json:"tokenGroups"`
}

type UpdateEnvironmentRequest struct {
	Name            string   `json:"name,omitempty"`
	Level           string   `json:"level,omitempty"`
	ClientID        string   `json:"clientId,omitempty"`
	SpaRedirectUrls []string `json:"spaRedirectUrls,omitempty"`
	WebRedirectUrls []string `json:"webRedirectUrls,omitempty"`
}

func (c *Client) GetEnvironment(id string) (*EnvironmentBundle, error) {
	var bundle EnvironmentBundle
	err := c.doRequest("GET", "/api/environments/"+id, nil, &bundle)
	return &bundle, err
}

func (c *Client) CreateEnvironment(appID string, name string) (*EnvironmentBundle, error) {
	body := map[string]string{"name": name}
	var resp struct {
		Environment EnvironmentBundle `json:"environment"`
	}
	err := c.doRequest("POST", "/api/applications/"+appID+"/environments", body, &resp)
	return &resp.Environment, err
}

func (c *Client) UpdateEnvironment(id string, req UpdateEnvironmentRequest) (*Environment, error) {
	var resp struct {
		Environment Environment `json:"environment"`
	}
	err := c.doRequest("PATCH", "/api/environments/"+id, req, &resp)
	return &resp.Environment, err
}

func (c *Client) DeleteEnvironment(id string) error {
	return c.doRequest("DELETE", "/api/environments/"+id, nil, nil)
}

func (c *Client) AddEnvironmentPassword(envID, displayName string) error {
	body := map[string]string{"displayName": displayName}
	return c.doRequest("POST", "/api/environments/"+envID+"/addPassword", body, nil)
}

func (c *Client) RemoveEnvironmentPassword(envID, keyID string) error {
	body := map[string]string{"keyId": keyID}
	return c.doRequest("POST", "/api/environments/"+envID+"/removePassword", body, nil)
}

// --- Role ---

type Role struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Sensitive   bool   `json:"sensitive"`
	Description string `json:"description"`
}

type RoleBundle struct {
	Role   Role   `json:"role"`
	Owners []User `json:"owners"`
}

func (c *Client) GetRole(id string) (*RoleBundle, error) {
	var bundle RoleBundle
	err := c.doRequest("GET", "/api/roles/"+id, nil, &bundle)
	return &bundle, err
}

// --- Scope ---

type Scope struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Description string `json:"description"`
}

// --- Token Group ---

type TokenGroup struct {
	ID                   string `json:"id"`
	Name                 string `json:"name"`
	EnvID                string `json:"envId"`
	AppRoleID            string `json:"appRoleId"`
	AppRoleAssignmentID  string `json:"appRoleAssignmentId"`
	GroupID              string `json:"groupId"`
	ClaimValue           string `json:"claimValue"`
	Description          string `json:"description"`
}

type CreateTokenGroupRequest struct {
	Name        string `json:"name"`
	ClaimValue  string `json:"claimValue"`
	GroupID     string `json:"groupId"`
	Description string `json:"description,omitempty"`
}

func (c *Client) CreateTokenGroup(appID string, req CreateTokenGroupRequest) ([]TokenGroup, error) {
	var resp struct {
		TokenGroups []TokenGroup `json:"tokenGroups"`
	}
	err := c.doRequest("POST", "/api/applications/"+appID+"/token-groups", req, &resp)
	return resp.TokenGroups, err
}

func (c *Client) UpdateTokenGroup(appID, id, description string) error {
	body := map[string]string{"description": description}
	return c.doRequest("PATCH", "/api/applications/"+appID+"/token-groups/"+id, body, nil)
}

func (c *Client) DeleteTokenGroup(appID, name string) error {
	body := map[string]string{"name": name}
	return c.doRequest("DELETE", "/api/applications/"+appID+"/token-groups", body, nil)
}

// --- User ---

type User struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Email          string `json:"email"`
	NormalizedName string `json:"normalizedName"`
}

type UserBundle struct {
	User         User          `json:"user"`
	MemberGroups []Group       `json:"memberGroups"`
	OwnerGroups  []Group       `json:"ownerGroups"`
	OwnedApps    []Application `json:"ownedApplications"`
}

func (c *Client) GetUser(id string) (*UserBundle, error) {
	var resp struct {
		Bundle UserBundle `json:"bundle"`
	}
	err := c.doRequest("GET", "/api/users/"+id, nil, &resp)
	return &resp.Bundle, err
}

func (c *Client) SearchUsers(prefix string) ([]User, error) {
	var resp struct {
		Users []User `json:"users"`
	}
	err := c.doRequest("GET", "/api/users/search?prefix="+url.QueryEscape(prefix), nil, &resp)
	return resp.Users, err
}

// --- Permission Request ---

type PermissionRequest struct {
	ID                    string `json:"id"`
	Requestor             string `json:"requestor"`
	CreateDate            string `json:"createDate"`
	Status                string `json:"status"`
	PermissionType        string `json:"permissionType"`
	SourceEnvironmentName string `json:"sourceEnvironmentName"`
	SourceEnvironmentID   string `json:"sourceEnvironmentId"`
	TargetEnvironmentName string `json:"targetEnvironmentName"`
	TargetEnvironmentID   string `json:"targetEnvironmentId"`
	TargetPermissionName  string `json:"targetPermissionName"`
	TargetPermissionID    string `json:"targetPermissionId"`
}

func (c *Client) GetPermissionRequest(id string) (*PermissionRequest, error) {
	var resp struct {
		PermissionRequest PermissionRequest `json:"permissionRequest"`
	}
	err := c.doRequest("GET", "/api/permission-requests/"+id, nil, &resp)
	return &resp.PermissionRequest, err
}

func (c *Client) UpdatePermissionRequestStatus(id, status string) (*PermissionRequest, error) {
	body := map[string]string{"status": status}
	var req PermissionRequest
	err := c.doRequest("PATCH", "/api/permission-requests/"+id, body, &req)
	return &req, err
}

// --- Password ---

type Password struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Password    string `json:"password"`
	Start       string `json:"start"`
	End         string `json:"end"`
}

// --- Environment Permissions ---

type Permission struct {
	ID                  string `json:"id"`
	ApplicationObjectID string `json:"applicationObjectId"`
	Type                string `json:"type"` // "Scope" or "Role"
}

func (c *Client) UpdateEnvironmentPermissions(envID, targetEnvID string, permissions []Permission) error {
	body := map[string]interface{}{
		"permissions":         permissions,
		"targetEnvironmentId": targetEnvID,
	}
	return c.doRequest("PATCH", "/api/environments/"+envID+"/permissions", body, nil)
}

func (c *Client) AssociateEnvironmentRole(envID, roleID string) error {
	return c.doRequest("POST", "/api/environments/"+envID+"/roles/"+roleID+"?status=approved", nil, nil)
}

func (c *Client) AssociateEnvironmentScope(envID, scopeID string) error {
	return c.doRequest("POST", "/api/environments/"+envID+"/scopes/"+scopeID+"?status=approved", nil, nil)
}
