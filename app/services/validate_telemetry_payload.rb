class ValidateTelemetryPayload
  Result = Struct.new(:errors) do
    def self.success
      new([])
    end

    def self.failure(errors)
      new(errors)
    end

    def valid?
      errors.empty?
    end
  end

  def initialize(workspace:, raw_payload:)
    @workspace   = workspace
    @raw_payload = raw_payload
  end

  def call
    return Result.failure(["payload schema is not defined for this workspace"]) unless schema_defined?
    return Result.failure(["payload must be a JSON object"]) unless raw_payload.is_a?(Hash)

    errors = missing_key_errors + type_mismatch_errors
    errors.any? ? Result.failure(errors) : Result.success
  end

  private

  attr_reader :workspace, :raw_payload

  def schema_defined?
    workspace.payload_schema_defined?
  end

  def schema
    workspace.payload_schema
  end

  def payload_with_string_keys
    @payload_with_string_keys ||= raw_payload.to_h { |key, value| [key.to_s, value] }
  end

  def missing_key_errors
    missing_keys = schema.field_keys - payload_with_string_keys.keys
    missing_keys.map { |key| "missing required field '#{key}'" }
  end

  def type_mismatch_errors
    schema.fields.filter_map { |field| type_error_for(field) }
  end

  def type_error_for(field)
    key = field["key"].to_s
    return unless payload_with_string_keys.key?(key)

    value = payload_with_string_keys[key]
    return if value_matches_declared_type?(value, field["type"])

    "field '#{key}' expected #{field['type']}, got #{value.inspect}"
  end

  def value_matches_declared_type?(value, declared_type)
    case declared_type.to_s
    when "float", "numeric" then value.is_a?(Numeric)
    when "integer"          then value.is_a?(Integer)
    when "string"           then value.is_a?(String)
    when "boolean"          then value == true || value == false
    else                         true
    end
  end
end
