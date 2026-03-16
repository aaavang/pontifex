package resources

import (
	"context"

	"github.com/hashicorp/terraform-plugin-framework/attr"
	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/pontifex/terraform-provider-pontifex/internal/client"
)

var (
	_ resource.Resource                = &groupResource{}
	_ resource.ResourceWithConfigure   = &groupResource{}
	_ resource.ResourceWithImportState = &groupResource{}
)

type groupResource struct {
	client *client.Client
}

type groupResourceModel struct {
	ID        types.String `tfsdk:"id"`
	Name      types.String `tfsdk:"name"`
	OwnerIDs  types.Set    `tfsdk:"owner_ids"`
	MemberIDs types.Set    `tfsdk:"member_ids"`
}

func NewGroupResource() resource.Resource {
	return &groupResource{}
}

func (r *groupResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_group"
}

func (r *groupResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages a Pontifex group.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the group.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Description: "The display name of the group.",
				Required:    true,
			},
			"owner_ids": schema.SetAttribute{
				Description: "Set of user IDs who own the group.",
				Optional:    true,
				ElementType: types.StringType,
			},
			"member_ids": schema.SetAttribute{
				Description: "Set of user IDs who are members of the group.",
				Optional:    true,
				ElementType: types.StringType,
			},
		},
	}
}

func (r *groupResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	c, ok := req.ProviderData.(*client.Client)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected Resource Configure Type",
			"Expected *client.Client, got unexpected type.",
		)
		return
	}

	r.client = c
}

func (r *groupResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan groupResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	group, err := r.client.CreateGroup(plan.Name.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error creating group", err.Error())
		return
	}

	plan.ID = types.StringValue(group.ID)

	if !plan.OwnerIDs.IsNull() && !plan.OwnerIDs.IsUnknown() {
		ownerIDs := r.setToStringSlice(ctx, plan.OwnerIDs, &resp.Diagnostics)
		if resp.Diagnostics.HasError() {
			return
		}
		if err := r.client.UpdateGroupOwners(group.ID, ownerIDs); err != nil {
			resp.Diagnostics.AddError("Error setting group owners", err.Error())
			return
		}
	}

	if !plan.MemberIDs.IsNull() && !plan.MemberIDs.IsUnknown() {
		memberIDs := r.setToStringSlice(ctx, plan.MemberIDs, &resp.Diagnostics)
		if resp.Diagnostics.HasError() {
			return
		}
		if err := r.client.UpdateGroupMembers(group.ID, memberIDs); err != nil {
			resp.Diagnostics.AddError("Error setting group members", err.Error())
			return
		}
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *groupResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state groupResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	bundle, err := r.client.GetGroup(state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error reading group", err.Error())
		return
	}

	state.Name = types.StringValue(bundle.Group.Name)
	state.OwnerIDs = r.usersToStringSet(bundle.Owners)
	state.MemberIDs = r.usersToStringSet(bundle.Members)

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *groupResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan groupResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state groupResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	plan.ID = state.ID

	if !plan.OwnerIDs.IsNull() && !plan.OwnerIDs.IsUnknown() {
		ownerIDs := r.setToStringSlice(ctx, plan.OwnerIDs, &resp.Diagnostics)
		if resp.Diagnostics.HasError() {
			return
		}
		if err := r.client.UpdateGroupOwners(state.ID.ValueString(), ownerIDs); err != nil {
			resp.Diagnostics.AddError("Error updating group owners", err.Error())
			return
		}
	} else {
		if err := r.client.UpdateGroupOwners(state.ID.ValueString(), []string{}); err != nil {
			resp.Diagnostics.AddError("Error clearing group owners", err.Error())
			return
		}
	}

	if !plan.MemberIDs.IsNull() && !plan.MemberIDs.IsUnknown() {
		memberIDs := r.setToStringSlice(ctx, plan.MemberIDs, &resp.Diagnostics)
		if resp.Diagnostics.HasError() {
			return
		}
		if err := r.client.UpdateGroupMembers(state.ID.ValueString(), memberIDs); err != nil {
			resp.Diagnostics.AddError("Error updating group members", err.Error())
			return
		}
	} else {
		if err := r.client.UpdateGroupMembers(state.ID.ValueString(), []string{}); err != nil {
			resp.Diagnostics.AddError("Error clearing group members", err.Error())
			return
		}
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *groupResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state groupResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	if err := r.client.DeleteGroup(state.ID.ValueString()); err != nil {
		resp.Diagnostics.AddError("Error deleting group", err.Error())
		return
	}
}

func (r *groupResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

func (r *groupResource) setToStringSlice(ctx context.Context, set types.Set, diags *diag.Diagnostics) []string {
	var values []string
	diags.Append(set.ElementsAs(ctx, &values, false)...)
	return values
}

func (r *groupResource) usersToStringSet(users []client.User) types.Set {
	if len(users) == 0 {
		return types.SetValueMust(types.StringType, []attr.Value{})
	}
	elements := make([]attr.Value, len(users))
	for i, u := range users {
		elements[i] = types.StringValue(u.ID)
	}
	return types.SetValueMust(types.StringType, elements)
}
