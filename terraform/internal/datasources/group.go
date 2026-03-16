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
	_ datasource.DataSource              = &GroupDataSource{}
	_ datasource.DataSourceWithConfigure = &GroupDataSource{}
)

type GroupDataSource struct {
	client *client.Client
}

type GroupDataSourceModel struct {
	ID        types.String `tfsdk:"id"`
	Name      types.String `tfsdk:"name"`
	OwnerIDs  types.Set    `tfsdk:"owner_ids"`
	MemberIDs types.Set    `tfsdk:"member_ids"`
}

func NewGroupDataSource() datasource.DataSource {
	return &GroupDataSource{}
}

func (d *GroupDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_group"
}

func (d *GroupDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Fetches a Pontifex group by ID.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The group ID.",
				Required:    true,
			},
			"name": schema.StringAttribute{
				Description: "The group name.",
				Computed:    true,
			},
			"owner_ids": schema.SetAttribute{
				Description: "The IDs of the group owners.",
				Computed:    true,
				ElementType: types.StringType,
			},
			"member_ids": schema.SetAttribute{
				Description: "The IDs of the group members.",
				Computed:    true,
				ElementType: types.StringType,
			},
		},
	}
}

func (d *GroupDataSource) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
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

func (d *GroupDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var state GroupDataSourceModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	bundle, err := d.client.GetGroup(state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError(
			"Unable to Read Group",
			fmt.Sprintf("Could not read group ID %s: %s", state.ID.ValueString(), err.Error()),
		)
		return
	}

	state.Name = types.StringValue(bundle.Group.Name)

	ownerIDs := make([]string, len(bundle.Owners))
	for i, owner := range bundle.Owners {
		ownerIDs[i] = owner.ID
	}
	ownerIDsSet, diags := types.SetValueFrom(ctx, types.StringType, ownerIDs)
	resp.Diagnostics.Append(diags...)

	memberIDs := make([]string, len(bundle.Members))
	for i, member := range bundle.Members {
		memberIDs[i] = member.ID
	}
	memberIDsSet, diags := types.SetValueFrom(ctx, types.StringType, memberIDs)
	resp.Diagnostics.Append(diags...)

	if resp.Diagnostics.HasError() {
		return
	}

	state.OwnerIDs = ownerIDsSet
	state.MemberIDs = memberIDsSet

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}
