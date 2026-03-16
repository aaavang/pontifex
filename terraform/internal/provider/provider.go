package provider

import (
	"context"
	"fmt"
	"os"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/provider"
	"github.com/hashicorp/terraform-plugin-framework/provider/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/pontifex/terraform-provider-pontifex/internal/client"
	"github.com/pontifex/terraform-provider-pontifex/internal/datasources"
	"github.com/pontifex/terraform-provider-pontifex/internal/resources"
)

var _ provider.Provider = &PontifexProvider{}

type PontifexProvider struct {
	version string
}

type PontifexProviderModel struct {
	BaseURL      types.String `tfsdk:"base_url"`
	Token        types.String `tfsdk:"token"`
	TenantID     types.String `tfsdk:"tenant_id"`
	ClientID     types.String `tfsdk:"client_id"`
	ClientSecret types.String `tfsdk:"client_secret"`
	Audience     types.String `tfsdk:"audience"`
}

func New(version string) func() provider.Provider {
	return func() provider.Provider {
		return &PontifexProvider{
			version: version,
		}
	}
}

func (p *PontifexProvider) Metadata(_ context.Context, _ provider.MetadataRequest, resp *provider.MetadataResponse) {
	resp.TypeName = "pontifex"
	resp.Version = p.version
}

func (p *PontifexProvider) Schema(_ context.Context, _ provider.SchemaRequest, resp *provider.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Terraform provider for managing Pontifex resources (Azure Entra ID management layer).",
		Attributes: map[string]schema.Attribute{
			"base_url": schema.StringAttribute{
				Description: "The base URL of the Pontifex API (e.g., https://api.pontifex.localhost:8443). Can also be set via PONTIFEX_BASE_URL environment variable.",
				Optional:    true,
			},
			"token": schema.StringAttribute{
				Description: "Azure AD Bearer token for direct authentication. Can also be set via PONTIFEX_TOKEN environment variable. Mutually exclusive with client credentials auth.",
				Optional:    true,
				Sensitive:   true,
			},
			"tenant_id": schema.StringAttribute{
				Description: "Azure AD tenant ID for client credentials authentication. Can also be set via PONTIFEX_TENANT_ID environment variable.",
				Optional:    true,
			},
			"client_id": schema.StringAttribute{
				Description: "Service principal client ID for client credentials authentication. Can also be set via PONTIFEX_CLIENT_ID environment variable.",
				Optional:    true,
			},
			"client_secret": schema.StringAttribute{
				Description: "Service principal client secret for client credentials authentication. Can also be set via PONTIFEX_CLIENT_SECRET environment variable.",
				Optional:    true,
				Sensitive:   true,
			},
			"audience": schema.StringAttribute{
				Description: "Pontifex app client ID (the API's app registration) used as the token audience. Can also be set via PONTIFEX_AUDIENCE environment variable. Defaults to client_id if not set.",
				Optional:    true,
			},
		},
	}
}

func (p *PontifexProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
	var config PontifexProviderModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
	if resp.Diagnostics.HasError() {
		return
	}

	baseURL := os.Getenv("PONTIFEX_BASE_URL")
	if !config.BaseURL.IsNull() {
		baseURL = config.BaseURL.ValueString()
	}
	if baseURL == "" {
		resp.Diagnostics.AddError(
			"Missing Pontifex API URL",
			"The provider requires a base_url to be set in the provider configuration or via the PONTIFEX_BASE_URL environment variable.",
		)
		return
	}

	token := os.Getenv("PONTIFEX_TOKEN")
	if !config.Token.IsNull() {
		token = config.Token.ValueString()
	}

	tenantID := os.Getenv("PONTIFEX_TENANT_ID")
	if !config.TenantID.IsNull() {
		tenantID = config.TenantID.ValueString()
	}

	clientID := os.Getenv("PONTIFEX_CLIENT_ID")
	if !config.ClientID.IsNull() {
		clientID = config.ClientID.ValueString()
	}

	clientSecret := os.Getenv("PONTIFEX_CLIENT_SECRET")
	if !config.ClientSecret.IsNull() {
		clientSecret = config.ClientSecret.ValueString()
	}

	audience := os.Getenv("PONTIFEX_AUDIENCE")
	if !config.Audience.IsNull() {
		audience = config.Audience.ValueString()
	}

	var c *client.Client

	if token != "" {
		// Direct token mode
		c = client.NewClient(baseURL, token)
	} else if clientID != "" && clientSecret != "" && tenantID != "" {
		// Client credentials mode
		if audience == "" {
			audience = clientID
		}
		var err error
		c, err = client.NewClientWithCredentials(baseURL, tenantID, clientID, clientSecret, audience)
		if err != nil {
			resp.Diagnostics.AddError(
				"Failed to authenticate with Azure AD",
				fmt.Sprintf("Client credentials authentication failed: %s", err.Error()),
			)
			return
		}
	} else {
		resp.Diagnostics.AddError(
			"Missing Pontifex Authentication",
			"The provider requires either a 'token' (or PONTIFEX_TOKEN env var) for direct token auth, "+
				"or 'tenant_id', 'client_id', and 'client_secret' (or their PONTIFEX_* env vars) for client credentials auth.",
		)
		return
	}

	resp.DataSourceData = c
	resp.ResourceData = c
}

func (p *PontifexProvider) Resources(_ context.Context) []func() resource.Resource {
	return []func() resource.Resource{
		resources.NewApplicationResource,
		resources.NewGroupResource,
		resources.NewGroupMembershipResource,
		resources.NewEnvironmentResource,
		resources.NewTokenGroupResource,
	}
}

func (p *PontifexProvider) DataSources(_ context.Context) []func() datasource.DataSource {
	return []func() datasource.DataSource{
		datasources.NewApplicationDataSource,
		datasources.NewGroupDataSource,
		datasources.NewEnvironmentDataSource,
		datasources.NewUserDataSource,
	}
}
