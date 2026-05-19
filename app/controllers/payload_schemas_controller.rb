class PayloadSchemasController < ApplicationController
  before_action :authenticate_user!
  before_action :find_workspace_belonging_to_current_user
  before_action :find_or_build_payload_schema

  def show; end

  def new; end

  def create
    parsed_fields = parse_fields_json
    return render :new, status: :unprocessable_entity if parsed_fields.nil?

    @payload_schema.fields = parsed_fields

    if @payload_schema.save
      redirect_to workspace_path(@workspace), notice: "Payload schema defined successfully."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit; end

  def update
    parsed_fields = parse_fields_json
    return render :edit, status: :unprocessable_entity if parsed_fields.nil?

    @payload_schema.fields = parsed_fields

    if @payload_schema.save
      redirect_to workspace_path(@workspace), notice: "Payload schema updated successfully."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def find_workspace_belonging_to_current_user
    @workspace = current_user.workspaces.find(params[:workspace_id])
  end

  def find_or_build_payload_schema
    @payload_schema = @workspace.payload_schema || @workspace.build_payload_schema(fields: [])
  end

  def parse_fields_json
    fields_json = params.require(:payload_schema).fetch(:fields_json, "[]")
    return [] if fields_json.blank?

    JSON.parse(fields_json).tap do |parsed_fields|
      unless parsed_fields.is_a?(Array)
        @payload_schema.errors.add(:fields, "must be a JSON array")
        return nil
      end
    end
  rescue JSON::ParserError
    @payload_schema.errors.add(:fields, "must be valid JSON")
    nil
  end
end
