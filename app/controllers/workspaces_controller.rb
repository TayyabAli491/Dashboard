class WorkspacesController < ApplicationController
  before_action :authenticate_user!
  before_action :find_workspace_belonging_to_current_user, only: %i[show edit update destroy]

  def index
    @workspaces = current_user.workspaces.order(created_at: :desc)
  end

  def show; end

  def new
    @workspace = current_user.workspaces.new
  end

  def create
    @workspace = current_user.workspaces.new(workspace_form_params)

    if @workspace.save
      redirect_to edit_workspace_payload_schema_path(@workspace), notice: "Workspace created successfully."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit; end

  def update
    if params[:regenerate_api_key].present?
      @workspace.regenerate_api_key!
      redirect_to workspace_path(@workspace), notice: "API key regenerated successfully."
    elsif @workspace.update(workspace_form_params)
      redirect_to workspace_path(@workspace), notice: "Workspace updated successfully."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @workspace.destroy
    redirect_to workspaces_path, notice: "Workspace deleted successfully."
  end

  private

  def find_workspace_belonging_to_current_user
    @workspace = current_user.workspaces.find(params[:id])
  end

  def workspace_form_params
    params.require(:workspace).permit(:name, :description, :is_public)
  end
end
