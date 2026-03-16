package resources

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/pontifex/terraform-provider-pontifex/internal/client"
)

var (
	_ resource.Resource                = &ApplicationResource{}
	_ resource.ResourceWithConfigure   = &ApplicationResource{}
	_ resource.ResourceWithImportState = &ApplicationResource{}
)

type ApplicationResource struct {
	client *client.Client
}

type ApplicationResourceModel struct {
	ID           types.String `tfsdk:"id"`
	Name         types.String `tfsdk:"name"`
	Description  types.String `tfsdk:"description"`
	Environments types.List   `tfsdk:"environments"`
	OwnerIDs     types.List   `tfsdk:"owner_ids"`
}

func NewApplicationResource() resource.Resource {
	return &ApplicationResource{}
}

func (r *ApplicationResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_application"
}

func (r *ApplicationResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages a Pontifex application.",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The application ID.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"name": schema.StringAttribute{
				Description: "The application name.",
				Required:    true,
			},
			"description": schema.StringAttribute{
				Description: "A description of the application.",
				Optional:    true,
			},
			"environments": schema.ListAttribute{
				Description: "Environment levels for the application (e.g., dev, prod).",
				Required:    true,
				ElementType: types.StringType,
			},
			"owner_ids": schema.ListAttribute{
				Description: "User IDs of the application owners.",
				Optional:    true,
				ElementType: types.StringType,
			},
		},
	}
}

func (r *ApplicationResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}
	c, ok := req.ProviderData.(*client.Client)
	if !ok {
		resp.Diagnostics.AddError("Unexpected Resource Configure Type", "Expected *client.Client")
		return
	}
	r.client = c
}

func (r *ApplicationResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan ApplicationResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	var environments []string
	resp.Diagnostics.Append(plan.Environments.ElementsAs(ctx, &environments, false)...)
	if resp.Diagnostics.HasError() {
		return
	}

	createReq := client.CreateApplicationRequest{
		ApplicationName: plan.Name.ValueString(),
		Environments:    environments,
	}
	if !plan.Description.IsNull() {
		createReq.Description = plan.Description.ValueString()
	}

	app, err := r.client.CreateApplication(createReq)
	if err != nil {
		resp.Diagnostics.AddError("Error creating application", fmt.Sprintf("Could not create application: %s", err))
		return
	}

	plan.ID = types.StringValue(app.ID)

	// Set owners if specified.
	if !plan.OwnerIDs.IsNull() && !plan.OwnerIDs.IsUnknown() {
		var ownerIDs []string
		resp.Diagnostics.Append(plan.OwnerIDs.ElementsAs(ctx, &ownerIDs, false)...)
		if resp.Diagnostics.HasError() {
			return
		}
		if len(ownerIDs) > 0 {
			err = r.client.UpdateApplicationOwners(app.ID, ownerIDs)
			if err != nil {
				resp.Diagnostics.AddError("Error setting application owners", fmt.Sprintf("Could not set owners: %s", err))
				return
			}
		}
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *ApplicationResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state ApplicationResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	bundle, err := r.client.GetApplication(state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error reading application", fmt.Sprintf("Could not read application %s: %s", state.ID.ValueString(), err))
		return
	}

	state.Name = types.StringValue(bundle.Application.Name)

	if bundle.Application.Description != "" {
		state.Description = types.StringValue(bundle.Application.Description)
	} else {
		state.Description = types.StringNull()
	}

	// Map environment levels from the bundle.
	envLevels := make([]string, len(bundle.Environments))
	for i, env := range bundle.Environments {
		envLevels[i] = env.Level
	}
	envList, diags := types.ListValueFrom(ctx, types.StringType, envLevels)
	resp.Diagnostics.Append(diags...)
	if resp.Diagnostics.HasError() {
		return
	}
	state.Environments = envList

	// Map owner IDs from the bundle.
	if len(bundle.Owners) > 0 {
		ownerIDs := make([]string, len(bundle.Owners))
		for i, owner := range bundle.Owners {
			ownerIDs[i] = owner.ID
		}
		ownerList, diags := types.ListValueFrom(ctx, types.StringType, ownerIDs)
		resp.Diagnostics.Append(diags...)
		if resp.Diagnostics.HasError() {
			return
		}
		state.OwnerIDs = ownerList
	} else {
		state.OwnerIDs = types.ListNull(types.StringType)
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *ApplicationResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan ApplicationResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	var state ApplicationResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	var environments []string
	resp.Diagnostics.Append(plan.Environments.ElementsAs(ctx, &environments, false)...)
	if resp.Diagnostics.HasError() {
		return
	}

	updateReq := client.UpdateApplicationRequest{
		Environments: environments,
	}
	if !plan.Description.IsNull() {
		updateReq.Description = plan.Description.ValueString()
	}

	err := r.client.UpdateApplication(state.ID.ValueString(), updateReq)
	if err != nil {
		resp.Diagnostics.AddError("Error updating application", fmt.Sprintf("Could not update application %s: %s", state.ID.ValueString(), err))
		return
	}

	// Update owners if changed.
	if !plan.OwnerIDs.Equal(state.OwnerIDs) {
		var ownerIDs []string
		if !plan.OwnerIDs.IsNull() && !plan.OwnerIDs.IsUnknown() {
			resp.Diagnostics.Append(plan.OwnerIDs.ElementsAs(ctx, &ownerIDs, false)...)
			if resp.Diagnostics.HasError() {
				return
			}
		}
		err = r.client.UpdateApplicationOwners(state.ID.ValueString(), ownerIDs)
		if err != nil {
			resp.Diagnostics.AddError("Error updating application owners", fmt.Sprintf("Could not update owners: %s", err))
			return
		}
	}

	plan.ID = state.ID
	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *ApplicationResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state ApplicationResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	err := r.client.DeleteApplication(state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error deleting application", fmt.Sprintf("Could not delete application %s: %s", state.ID.ValueString(), err))
		return
	}
}

func (r *ApplicationResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}
