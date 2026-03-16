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
	_ datasource.DataSource              = &ApplicationDataSource{}
	_ datasource.DataSourceWithConfigure = &ApplicationDataSource{}
)

type ApplicationDataSource struct {
	client *client.Client
}

type ApplicationDataSourceModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Creator     types.String `tfsdk:"creator"`
}

func NewApplicationDataSource() datasource.DataSource {
	return &ApplicationDataSource{}
}

func (d *ApplicationDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_application"
}

func (d *ApplicationDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Fetches a Pontifex application by ID.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The application ID.",
				Required:    true,
			},
			"name": schema.StringAttribute{
				Description: "The application name.",
				Computed:    true,
			},
			"description": schema.StringAttribute{
				Description: "A description of the application.",
				Computed:    true,
			},
			"creator": schema.StringAttribute{
				Description: "The creator of the application.",
				Computed:    true,
			},
		},
	}
}

func (d *ApplicationDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
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

func (d *ApplicationDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var state ApplicationDataSourceModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	bundle, err := d.client.GetApplication(state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError(
			"Unable to Read Application",
			fmt.Sprintf("Could not read application ID %s: %s", state.ID.ValueString(), err.Error()),
		)
		return
	}

	state.Name = types.StringValue(bundle.Application.Name)
	state.Description = types.StringValue(bundle.Application.Description)
	state.Creator = types.StringValue(bundle.Application.Creator)

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}
