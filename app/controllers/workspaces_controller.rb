class WorkspacesController < ApplicationController
  before_action :authenticate_user!
  before_action :find_workspace_belonging_to_current_user, only: %i[show edit update setup save_layout destroy live_dashboard]

  def index
    @workspaces = current_user.workspaces.order(created_at: :desc)
  end

  def show
    @recent_telemetry_record = @workspace.telemetry_records.most_recent_first.first
    @active_session = @workspace.sessions.in_progress.first
  end

  def live_dashboard
    @active_session = @workspace.sessions.in_progress.first
    render layout: false
  end

  def setup; end

  def new
    @workspace = current_user.workspaces.new
  end

  def create
    @workspace = current_user.workspaces.new(workspace_form_params)

    respond_to do |format|
      if @workspace.save
        format.turbo_stream { render turbo_stream: turbo_stream.append("remote_modal", "<script>window.location.href='#{edit_workspace_payload_schema_path(@workspace)}'</script>".html_safe) }
        format.html { redirect_to edit_workspace_payload_schema_path(@workspace), notice: "Workspace created successfully." }
      else
        format.html { render :new, status: :unprocessable_entity }
      end
    end
  end

  def edit; end

  def update
    respond_to do |format|
      if params[:regenerate_api_key].present?
        @workspace.regenerate_api_key!
        format.turbo_stream { render turbo_stream: turbo_stream.append("remote_modal", "<script>window.location.href='#{workspace_path(@workspace)}'</script>".html_safe) }
        format.html { redirect_to workspace_path(@workspace), notice: "API key regenerated successfully." }
      elsif @workspace.update(workspace_form_params)
        format.turbo_stream { render turbo_stream: turbo_stream.append("remote_modal", "<script>window.location.href='#{workspace_path(@workspace)}'</script>".html_safe) }
        format.html { redirect_to workspace_path(@workspace), notice: "Workspace updated successfully." }
      else
        format.html { render :edit, status: :unprocessable_entity }
      end
    end
  end

  def destroy
    @workspace.destroy
    redirect_to workspaces_path, notice: "Workspace deleted successfully."
  end

  def save_layout
    if @workspace.update(dashboard_layout_params)
      head :ok
    else
      head :unprocessable_entity
    end
  end

  private

  def find_workspace_belonging_to_current_user
    @workspace = current_user.workspaces.find(params[:id])
  end

  def workspace_form_params
    params.require(:workspace).permit(:name, :description, :is_public)
  end

  def dashboard_layout_params
    params.require(:workspace).permit(
      dashboard_layout: [ :id, :type, :label, grid: [ :x, :y, :w, :h ] ]
    )
  end
end
