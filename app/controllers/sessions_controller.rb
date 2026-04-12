class SessionsController < ApplicationController
  before_action :authenticate_user!
  before_action :find_workspace_belonging_to_current_user
  before_action :find_session_belonging_to_workspace, only: %i[show edit update destroy]

  def index
    @sessions = @workspace.sessions.most_recent_first
  end

  def show
    @page = params.fetch(:page, 1).to_i
    @page = 1 if @page < 1
    @per_page = 50
    @total_records = @session.telemetry_records.count
    @total_pages = (@total_records.to_f / @per_page).ceil
    @telemetry_records = @session.telemetry_records
                                 .most_recent_first
                                 .offset((@page - 1) * @per_page)
                                 .limit(@per_page)
    @field_keys = @workspace.payload_schema&.field_keys || []
  end

  def new
    @session = @workspace.sessions.new
  end

  def create
    @session = @workspace.sessions.new(session_form_params)

    if @session.save
      redirect_to session_path(@session), notice: "Session created successfully."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if params[:session_state] == "start"
      start_session
      redirect_to session_path(@session), notice: "Session started."
    elsif params[:session_state] == "end"
      end_session
      redirect_to session_path(@session), notice: "Session ended."
    elsif @session.update(session_form_params)
      redirect_to session_path(@session), notice: "Session updated successfully."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @session.destroy
    redirect_to workspace_sessions_path(@workspace), notice: "Session deleted successfully."
  end

  private

  def start_session
    @session.update!(started_at: Time.current)
  end

  def end_session
    @session.update!(ended_at: Time.current)
  end

  def find_workspace_belonging_to_current_user
    if params[:workspace_id].present?
      @workspace = current_user.workspaces.find(params[:workspace_id])
    end
  end

  def find_session_belonging_to_workspace
    @session = if @workspace.present?
                 @workspace.sessions.find(params[:id])
               else
                 Session.joins(:workspace).find_by!(id: params[:id], workspace: { user_id: current_user.id })
               end
    @workspace ||= @session.workspace
  end

  def session_form_params
    params.require(:session).permit(:name, :description)
  end
end
