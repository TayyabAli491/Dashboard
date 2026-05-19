class TestTelemetryPayloadBuilder
  def initialize(workspace:)
    @workspace = workspace
  end

  def call
    return {} unless workspace.payload_schema_defined?

    workspace.payload_schema.fields.each_with_object({}) do |field, payload|
      payload[field["key"]] = synthetic_value_for(field["type"])
    end
  end

  private

  attr_reader :workspace

  def synthetic_value_for(declared_type)
    case declared_type.to_s
    when "float", "numeric" then rand(0.0..100.0).round(2)
    when "integer"          then rand(0..100)
    when "string"           then "test"
    when "boolean"          then [true, false].sample
    else                         0
    end
  end
end
