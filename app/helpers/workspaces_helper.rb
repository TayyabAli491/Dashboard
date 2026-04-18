module WorkspacesHelper
  def example_payload_json(payload_schema)
    return if payload_schema.blank?

    example = payload_schema.fields.each_with_object({}) do |field, hash|
      hash[field["key"]] = example_value_for_type(field["type"])
    end
    JSON.pretty_generate(example)
  end

  private

  def example_value_for_type(field_type)
    case field_type
    when "float"   then 0.0
    when "integer" then 0
    when "boolean" then false
    when "string"  then ""
    end
  end
end
