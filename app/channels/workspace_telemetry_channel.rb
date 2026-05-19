class WorkspaceTelemetryChannel < ApplicationCable::Channel
  def subscribed
    workspace = current_user.workspaces
      .find(params[:workspace_id])
    stream_from "workspace_telemetry_#{workspace.id}"
  rescue ActiveRecord::RecordNotFound
    reject
  end

  def unsubscribed
  end
end
