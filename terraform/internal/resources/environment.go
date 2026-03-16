package resources

import (
	"context"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
	"github.com/pontifex/terraform-provider-pontifex/internal/client"
)

var (
	_ resource.Resource              = &environmentResource{}
	_ resource.ResourceWithConfigure = &environmentResource{}
)

type environmentResource struct {
	client *client.Client
}

type environmentResourceModel struct {
	ID              types.String `tfsdk:"id"`
	ApplicationID   types.String `tfsdk:"application_id"`
	Name            types.String `tfsdk:"name"`
	Level           types.String `tfsdk:"level"`
	ClientID        types.String `tfsdk:"client_id"`
	SpaRedirectUrls types.List   `tfsdk:"spa_redirect_urls"`
	WebRedirectUrls types.List   `tfsdk:"web_redirect_urls"`
}

func NewEnvironmentResource() resource.Resource {
	return &environmentResource{}
}

func (r *environmentResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_environment"
}

func (r *environmentResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Manages a Pontifex environment (app registration under an application).",
		Attributes: map[string]schema.Attribute{
			"id": schema.StringAttribute{
				Description: "The unique identifier of the environment.",
				Computed:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.UseStateForUnknown(),
				},
			},
			"application_id": schema.StringAttribute{
				Description: "The ID of the parent application.",
				Required:    true,
				PlanModifiers: []planmodifier.String{
					stringplanmodifier.RequiresReplace(),
				},
			},
			"name": schema.StringAttribute{
				Description: "The name of the environment, set by the API based on the application name and level.",
				Computed:    true,
			},
			"level": schema.StringAttribute{
				Description: "The environment level (e.g., dev, staging, production).",
				Optional:    true,
			},
			"client_id": schema.StringAttribute{
				Description: "The Azure AD client ID for this environment.",
				Computed:    true,
			},
			"spa_redirect_urls": schema.ListAttribute{
				Description: "SPA redirect URLs for the environment.",
				Optional:    true,
				ElementType: types.StringType,
			},
			"web_redirect_urls": schema.ListAttribute{
				Description: "Web redirect URLs for the environment.",
				Optional:    true,
				ElementType: types.StringType,
			},
		},
	}
}

func (r *environmentResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	if req.ProviderData == nil {
		return
	}

	c, ok := req.ProviderData.(*client.Client)
	if !ok {
		resp.Diagnostics.AddError(
			"Unexpected Resource Configure Type",
			fmt.Sprintf("Expected *client.Client, got: %T.", req.ProviderData),
		)
		return
	}

	r.client = c
}

func (r *environmentResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan environmentResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	level := plan.Level.ValueString()
	bundle, err := r.client.CreateEnvironment(plan.ApplicationID.ValueString(), level)
	if err != nil {
		resp.Diagnostics.AddError("Error creating environment", err.Error())
		return
	}

	env := bundle.Environment
	plan.ID = types.StringValue(env.ID)
	plan.Name = types.StringValue(env.Name)
	plan.ClientID = types.StringValue(env.ClientID)
	plan.Level = types.StringValue(env.Level)
	plan.SpaRedirectUrls = toStringListValue(ctx, env.SpaRedirectUrls, &resp.Diagnostics)
	plan.WebRedirectUrls = toStringListValue(ctx, env.WebRedirectUrls, &resp.Diagnostics)
	if resp.Diagnostics.HasError() {
		return
	}

	// If redirect URLs were specified in the plan, update the environment after creation
	if !plan.SpaRedirectUrls.IsNull() || !plan.WebRedirectUrls.IsNull() {
		var spaUrls, webUrls []string
		if !plan.SpaRedirectUrls.IsNull() {
			resp.Diagnostics.Append(plan.SpaRedirectUrls.ElementsAs(ctx, &spaUrls, false)...)
		}
		if !plan.WebRedirectUrls.IsNull() {
			resp.Diagnostics.Append(plan.WebRedirectUrls.ElementsAs(ctx, &webUrls, false)...)
		}
		if resp.Diagnostics.HasError() {
			return
		}

		if len(spaUrls) > 0 || len(webUrls) > 0 {
			updateReq := client.UpdateEnvironmentRequest{
				SpaRedirectUrls: spaUrls,
				WebRedirectUrls: webUrls,
			}
			updated, err := r.client.UpdateEnvironment(env.ID, updateReq)
			if err != nil {
				resp.Diagnostics.AddError("Error updating environment redirect URLs after creation", err.Error())
				return
			}
			plan.SpaRedirectUrls = toStringListValue(ctx, updated.SpaRedirectUrls, &resp.Diagnostics)
			plan.WebRedirectUrls = toStringListValue(ctx, updated.WebRedirectUrls, &resp.Diagnostics)
			if resp.Diagnostics.HasError() {
				return
			}
		}
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *environmentResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state environmentResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	bundle, err := r.client.GetEnvironment(state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error reading environment", err.Error())
		return
	}

	env := bundle.Environment
	state.ID = types.StringValue(env.ID)
	state.Name = types.StringValue(env.Name)
	state.Level = types.StringValue(env.Level)
	state.ClientID = types.StringValue(env.ClientID)
	state.SpaRedirectUrls = toStringListValue(ctx, env.SpaRedirectUrls, &resp.Diagnostics)
	state.WebRedirectUrls = toStringListValue(ctx, env.WebRedirectUrls, &resp.Diagnostics)
	if resp.Diagnostics.HasError() {
		return
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &state)...)
}

func (r *environmentResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var plan environmentResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}

	var spaUrls, webUrls []string
	if !plan.SpaRedirectUrls.IsNull() && !plan.SpaRedirectUrls.IsUnknown() {
		resp.Diagnostics.Append(plan.SpaRedirectUrls.ElementsAs(ctx, &spaUrls, false)...)
	}
	if !plan.WebRedirectUrls.IsNull() && !plan.WebRedirectUrls.IsUnknown() {
		resp.Diagnostics.Append(plan.WebRedirectUrls.ElementsAs(ctx, &webUrls, false)...)
	}
	if resp.Diagnostics.HasError() {
		return
	}

	updateReq := client.UpdateEnvironmentRequest{
		Level:           plan.Level.ValueString(),
		SpaRedirectUrls: spaUrls,
		WebRedirectUrls: webUrls,
	}

	updated, err := r.client.UpdateEnvironment(plan.ID.ValueString(), updateReq)
	if err != nil {
		resp.Diagnostics.AddError("Error updating environment", err.Error())
		return
	}

	plan.Name = types.StringValue(updated.Name)
	plan.Level = types.StringValue(updated.Level)
	plan.ClientID = types.StringValue(updated.ClientID)
	plan.SpaRedirectUrls = toStringListValue(ctx, updated.SpaRedirectUrls, &resp.Diagnostics)
	plan.WebRedirectUrls = toStringListValue(ctx, updated.WebRedirectUrls, &resp.Diagnostics)
	if resp.Diagnostics.HasError() {
		return
	}

	resp.Diagnostics.Append(resp.State.Set(ctx, &plan)...)
}

func (r *environmentResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var state environmentResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)
	if resp.Diagnostics.HasError() {
		return
	}

	err := r.client.DeleteEnvironment(state.ID.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error deleting environment", err.Error())
		return
	}
}

// toStringListValue converts a Go string slice to a types.List of StringType.
// Returns a null list if the slice is nil.
func toStringListValue(ctx context.Context, values []string, diags *diag.Diagnostics) types.List {
	if values == nil {
		return types.ListNull(types.StringType)
	}
	list, d := types.ListValueFrom(ctx, types.StringType, values)
	diags.Append(d...)
	return list
}
