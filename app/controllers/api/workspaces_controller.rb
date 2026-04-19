module Api
  class WorkspacesController < ApplicationController
    # IoT Hardware does not have CSRF tokens, so we disable forgery protection
    skip_before_action :verify_authenticity_token, raise: false

    # We don't use Devise user sessions for hardware pings
    skip_before_action :authenticate_user!, raise: false

    before_action :authenticate_hardware!

    # POST /api/workspaces/:id/telemetry
    def telemetry
      # We process either `_json` (if payload is array) or the raw robust body
      raw_payload = request.request_parameters

      # Bind payload to an active session if one exists
      active_session = @workspace.sessions.in_progress.first

      record = @workspace.telemetry_records.new(
        raw_payload: raw_payload,
        session: active_session,
        recorded_at: Time.current
      )

      if record.save
        # Payload successfully committed to database!
        # Step 2: Instantly blast this payload across the Rails WebSocket 
        # to any browser heavily watching the Live Dashboard.
        ActionCable.server.broadcast(
          "workspace_#{@workspace.id}_telemetry",
          record.as_json
        )

        render json: { success: true, processed: true }, status: :created
      else
        render json: { errors: record.errors.full_messages }, status: :unprocessable_entity
      end
    end

    private

    def authenticate_hardware!
      api_key = request.headers['X-API-Key']

      @workspace = Workspace.find_by(id: params[:id], api_key: api_key)
      unless @workspace
        render json: { error: 'Unauthorized hardware API key' }, status: :unauthorized
      end
    end
  end
end
