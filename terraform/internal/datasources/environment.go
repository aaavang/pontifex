package datasources

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/datasource/schema"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/pontifex/terraform-provider-pontifex/internal/client"
)

var (
	_ datasource.DataSource              = &EnvironmentDataSource{}
	_ datasource.DataSourceWithConfigure = &EnvironmentDataSource{}
)

type EnvironmentDataSource struct {
	client *client.Client
}

type EnvironmentDataSourceModel struct {
	ID              types.String `tfsdk:"id"`
	Name            types.String `tfsdk:"name"`
	Level           types.String `tfsdk:"level"`
	ClientID        types.String `tfsdk:"client_id"`
	SpaRedirectUrls types.List   `tfsdk:"spa_redirect_urls"`
	WebRedirectUrls types.List   `tfsdk:"web_redirect_urls"`
}

func NewEnvironmentDataSource() datasource.DataSource {
	return &EnvironmentDataSource{}
}

func (d *EnvironmentDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_environment"
}

func (d *EnvironmentDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Fetches a Pontifex environment by ID.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The environment ID.",
				Required:    true,
			},
			"name": schema.StringAttribute{
				Description: "The environment name.",
				Computed:    true,
			},
			"level": schema.StringAttribute{
				Description: "The environment level (e.g., dev, prod).",
				Computed:    true,
			},
			"client_id": schema.StringAttribute{
				Description: "The Azure AD client ID for the environment.",
				Computed:    true,
			},
			"spa_redirect_urls": schema.ListAttribute{
				Description: "SPA redirect URLs for the environment.",
				Computed:    true,
				ElementType: types.StringType,
			},
			"web_redirect_urls": schema.ListAttribute{
				Description: "Web redirect URLs for the environment.",
				Computed:    true,
				ElementType: types.StringType,
			},
		},
	}
}

func (d *EnvironmentDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}
	c, ok := req.ProviderData.(*client.Client)
	if !ok {
		resp.Diagnostics.AddError("Unexpected Data Source Configure Type", "Expected *client.Client")
		return
	}
	d.client = c
}

func (d *EnvironmentDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var state EnvironmentDataSourceModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	bundle, err := d.client.GetEnvironment(state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError(
			"Unable to Read Environment",
			fmt.Sprintf("Could not read environment ID %s: %s", state.ID.ValueString(), err.Error()),
		)
		return
	}

	state.Name = types.StringValue(bundle.Environment.Name)
	state.Level = types.StringValue(bundle.Environment.Level)
	state.ClientID = types.StringValue(bundle.Environment.ClientID)

	spaUrls, diags := types.ListValueFrom(ctx, types.StringType, bundle.Environment.SpaRedirectUrls)
	resp.Diagnostics.Append(diags...)

	webUrls, diags := types.ListValueFrom(ctx, types.StringType, bundle.Environment.WebRedirectUrls)
	resp.Diagnostics.Append(diags...)

	if resp.Diagnostics.HasError() {
		return
	}

	state.SpaRedirectUrls = spaUrls
	state.WebRedirectUrls = webUrls

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}
