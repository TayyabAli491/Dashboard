TelemetryRecord.delete_all
Session.delete_all
PayloadSchema.delete_all
Workspace.delete_all
User.delete_all

demo_user = User.create!(
  email: "demo@drift.local",
  password: "password123",
  password_confirmation: "password123"
)

workspace_names = [
  "MiniSat Alpha",
  "MiniSat Bravo",
  "MiniSat Charlie",
  "MiniSat Delta",
  "MiniSat Echo",
  "MiniSat Foxtrot",
  "MiniSat Golf",
  "MiniSat Hotel",
  "MiniSat India",
  "MiniSat Juliet"
]

default_fields = [
  { key: "altitude", type: "float", unit: "meters", alias: "Altitude" },
  { key: "temperature", type: "float", unit: "celsius", alias: "Temperature" },
  { key: "pressure", type: "float", unit: "hPa", alias: "Pressure" },
  { key: "humidity", type: "float", unit: "percent", alias: "Humidity" }
]

workspace_names.each_with_index do |workspace_name, index|
  workspace = demo_user.workspaces.create!(
    name: workspace_name,
    description: "Seeded workspace #{index + 1}",
    is_public: false
  )

  next if index >= 5

  PayloadSchema.create!(
    workspace: workspace,
    fields: default_fields
  )

  next unless index < 3

  session = workspace.sessions.create!(
    name: "Live Session #{index + 1}",
    description: "Seeded live session",
    status: :in_progress,
    started_at: Time.current - 1.hour
  )

  10.times do |telemetry_index|
    timestamp = Time.current - (9 - telemetry_index).minutes
    payload = {
      "altitude" => 1500.0 + telemetry_index,
      "temperature" => 22.5 + (telemetry_index * 0.1),
      "pressure" => 1012.0 - (telemetry_index * 0.2),
      "humidity" => 48.0 + telemetry_index
    }

    workspace.telemetry_records.create!(
      session: session,
      raw_payload: payload,
      processed_payload: payload,
      recorded_at: timestamp
    )
  end
end

puts "Seeded 1 user and #{demo_user.workspaces.count} workspaces."
puts "Workspaces with schema: #{demo_user.workspaces.joins(:payload_schema).count}"
puts "Telemetry records: #{TelemetryRecord.count}"
