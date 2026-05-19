class TelemetryRecordsController < ApplicationController
  before_action :authenticate_user!
  before_action :find_workspace_belonging_to_current_user, only: %i[index]
  before_action :find_session_belonging_to_workspace, only: %i[index], if: -> { params[:session_id].present? }
  before_action :find_telemetry_record_belonging_to_current_user, only: %i[show]

  def index
    @page = params.fetch(:page, 1).to_i
    @page = 1 if @page < 1
    @per_page = 50

    scope = if @session
      @session.telemetry_records
    else
      @workspace.telemetry_records
    end

    @total_records = scope.count
    @total_pages = (@total_records.to_f / @per_page).ceil
    @telemetry_records = scope
                         .most_recent_first
                         .offset((@page - 1) * @per_page)
                         .limit(@per_page)

    @field_keys = @workspace.payload_schema&.field_keys || []
  end

  def show
    @workspace = @telemetry_record.workspace
    @field_keys = @workspace.payload_schema&.field_keys || []
  end

  private

  def find_workspace_belonging_to_current_user
    @workspace = current_user.workspaces.find(params[:workspace_id])
  end

  def find_session_belonging_to_workspace
    @session = @workspace.sessions.find(params[:session_id])
  end

  def find_telemetry_record_belonging_to_current_user
    @telemetry_record = TelemetryRecord.joins(:workspace).find_by!(
      id: params[:id],
      workspaces: { user_id: current_user.id }
    )
  end
end

