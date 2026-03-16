package resources

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/pontifex/terraform-provider-pontifex/internal/client"
)

var (
	_ resource.Resource              = &tokenGroupResource{}
	_ resource.ResourceWithConfigure = &tokenGroupResource{}
)

type tokenGroupResource struct {
	client *client.Client
}

type tokenGroupResourceModel struct {
	ID            types.String `tfsdk:"id"`
	ApplicationID types.String `tfsdk:"application_id"`
	Name          types.String `tfsdk:"name"`
	ClaimValue    types.String `tfsdk:"claim_value"`
	GroupID       types.String `tfsdk:"group_id"`
	Description   types.String `tfsdk:"description"`
}

func NewTokenGroupResource() resource.Resource {
	return &tokenGroupResource{}
}

func (r *tokenGroupResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_token_group"
}

func (r *tokenGroupResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages a Pontifex token group.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The first token group ID returned (one is created per environment).",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"application_id": schema.StringAttribute{
				Description: "The application ID this token group belongs to.",
				Required:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"name": schema.StringAttribute{
				Description: "The token group name.",
				Required:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"claim_value": schema.StringAttribute{
				Description: "The claim value for the token group.",
				Required:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"group_id": schema.StringAttribute{
				Description: "The Azure AD group ID.",
				Required:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"description": schema.StringAttribute{
				Description: "A description of the token group.",
				Optional:    true,
			},
		},
	}
}

func (r *tokenGroupResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
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

func (r *tokenGroupResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan tokenGroupResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	createReq := client.CreateTokenGroupRequest{
		Name:       plan.Name.ValueString(),
		ClaimValue: plan.ClaimValue.ValueString(),
		GroupID:    plan.GroupID.ValueString(),
	}
	if !plan.Description.IsNull() {
		createReq.Description = plan.Description.ValueString()
	}

	tokenGroups, err := r.client.CreateTokenGroup(plan.ApplicationID.ValueString(), createReq)
	if err != nil {
		resp.Diagnostics.AddError("Error creating token group", fmt.Sprintf("Could not create token group: %s", err))
		return
	}

	if len(tokenGroups) == 0 {
		resp.Diagnostics.AddError("Error creating token group", "API returned empty token groups array")
		return
	}

	plan.ID = types.StringValue(tokenGroups[0].ID)

	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *tokenGroupResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state tokenGroupResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	bundle, err := r.client.GetApplication(state.ApplicationID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error reading token group", fmt.Sprintf("Could not read application %s: %s", state.ApplicationID.ValueString(), err))
		return
	}

	var found *client.TokenGroup
	for _, env := range bundle.Environments {
		envBundle, err := r.client.GetEnvironment(env.ID)
		if err != nil {
			resp.Diagnostics.AddError("Error reading token group", fmt.Sprintf("Could not read environment %s: %s", env.ID, err))
			return
		}

		for _, tg := range envBundle.TokenGroups {
			if tg.Name == state.Name.ValueString() {
				found = &tg
				break
			}
		}

		if found != nil {
			break
		}
	}

	if found == nil {
		resp.State.RemoveResource(ctx)
		return
	}

	state.ID = types.StringValue(found.ID)
	state.ClaimValue = types.StringValue(found.ClaimValue)
	state.GroupID = types.StringValue(found.GroupID)

	if found.Description != "" {
		state.Description = types.StringValue(found.Description)
	} else {
		state.Description = types.StringNull()
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *tokenGroupResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan tokenGroupResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state tokenGroupResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	description := ""
	if !plan.Description.IsNull() {
		description = plan.Description.ValueString()
	}

	err := r.client.UpdateTokenGroup(state.ApplicationID.ValueString(), state.ID.ValueString(), description)
	if err != nil {
		resp.Diagnostics.AddError("Error updating token group", fmt.Sprintf("Could not update token group: %s", err))
		return
	}

	plan.ID = state.ID

	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *tokenGroupResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state tokenGroupResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	err := r.client.DeleteTokenGroup(state.ApplicationID.ValueString(), state.Name.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error deleting token group", fmt.Sprintf("Could not delete token group: %s", err))
		return
	}
}
