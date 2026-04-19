class WorkspaceCameraChannel < ApplicationCable::Channel
  def subscribed
    workspace = current_user.workspaces.find_by(id: params[:workspace_id])

    if workspace
      stream_from "workspace_camera_#{workspace.id}"
    else
      reject
    end
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
