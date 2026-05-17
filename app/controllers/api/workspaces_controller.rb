module Api
  class WorkspacesController < ApplicationController
    # IoT Hardware does not have CSRF tokens, so we disable forgery protection
    skip_before_action :verify_authenticity_token, raise: false

    # We don't use Devise user sessions for hardware pings
    skip_before_action :authenticate_user!, raise: false

    # Hardware is not a browser, skip modern browser checks
    skip_before_action :allow_browser, raise: false

    before_action :authenticate_hardware!

    # POST /api/workspaces/:id/telemetry
    def telemetry
      raw_payload = params.except(:controller, :action, :id, :workspace).to_unsafe_h

      validation = ValidateTelemetryPayload.new(workspace: @workspace, raw_payload: raw_payload).call
      return render json: { errors: validation.errors }, status: :unprocessable_entity unless validation.valid?

      record = @workspace.telemetry_records.new(
        raw_payload:  raw_payload,
        session:      @workspace.sessions.in_progress.first,
        recorded_at:  Time.current
      )

      if record.save
        render json: { success: true, processed: true }, status: :created
      else
        render json: { errors: record.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # POST /api/workspaces/:id/images
    def images
      raw_payload = params.slice(:iimage, :timestamp).to_unsafe_h

      if raw_payload[:iimage].present?
        # Stream it directly without persisting it slowly to database
        ActionCable.server.broadcast(
          "workspace_camera_#{@workspace.id}",
          raw_payload
        )
        render json: { success: true, processed: true }, status: :created
      else
        render json: { error: "Missing iimage data" }, status: :unprocessable_entity
      end
    end

    private

    def authenticate_hardware!
      api_key = request.headers["X-API-Key"]

      @workspace = Workspace.find_by(id: params[:id], api_key: api_key)
      unless @workspace
        render json: { error: "Unauthorized hardware API key" }, status: :unauthorized
      end
    end
  end
end
