class TelemetryChannel < ApplicationCable::Channel
  def subscribed
    stream_from "workspace_#{params[:workspace_id]}_telemetry"
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
