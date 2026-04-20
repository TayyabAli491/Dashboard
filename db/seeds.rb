TelemetryRecord.delete_all
Session.delete_all
PayloadSchema.delete_all
Workspace.delete_all
User.delete_all

srand(2026)

demo_user = User.create!(
  email: "demo@drift.local",
  password: "password123",
  password_confirmation: "password123"
)

workspaces_data = [
  { name: "CanSat Atlas", description: "Primary flight-test payload for spring launch window", is_public: true },
  { name: "CanSat Borealis", description: "Backup avionics stack used for environmental validation", is_public: false },
  { name: "CanSat Cirrus", description: "Thermal and humidity profile experiments", is_public: false }
]

telemetry_fields = [
  { key: "altitude_m", type: "float", unit: "meters", alias: "Altitude" },
  { key: "vertical_speed_mps", type: "float", unit: "m/s", alias: "Vertical Speed" },
  { key: "temperature_c", type: "float", unit: "celsius", alias: "Temperature" },
  { key: "pressure_hpa", type: "float", unit: "hPa", alias: "Pressure" },
  { key: "humidity_pct", type: "float", unit: "percent", alias: "Humidity" },
  { key: "battery_v", type: "float", unit: "volts", alias: "Battery Voltage" },
  { key: "latitude", type: "float", unit: "deg", alias: "Latitude" },
  { key: "longitude", type: "float", unit: "deg", alias: "Longitude" },
  { key: "ax_g", type: "float", unit: "g", alias: "Accel X" },
  { key: "ay_g", type: "float", unit: "g", alias: "Accel Y" },
  { key: "az_g", type: "float", unit: "g", alias: "Accel Z" }
]

def rounded_payload(payload)
  payload.transform_values { |value| value.is_a?(Float) ? value.round(3) : value }
end

def simulated_packet(step, total_steps:, base_altitude:, max_altitude:, base_latitude:, base_longitude:)
  ascent_ratio = [step.to_f / [total_steps * 0.5, 1].max, 1.0].min
  descent_ratio = [[step - (total_steps * 0.55), 0].max.to_f / [total_steps * 0.45, 1].max, 1.0].min

  altitude =
    if step < (total_steps * 0.55)
      base_altitude + ((max_altitude - base_altitude) * ascent_ratio)
    else
      max_altitude - ((max_altitude - 120.0) * descent_ratio)
    end

  vertical_speed =
    if step < (total_steps * 0.55)
      8.5 + rand(-0.8..1.2)
    else
      -6.0 + rand(-1.2..0.7)
    end

  pressure = 1013.25 - (altitude * 0.12) + rand(-0.8..0.8)
  temperature = 26.0 - (altitude * 0.006) + rand(-0.5..0.5)
  humidity = 41.0 + (step * 0.14) + rand(-2.0..2.0)
  battery = 8.4 - (step * 0.0045) + rand(-0.03..0.03)
  latitude = base_latitude + (step * 0.00003) + rand(-0.00002..0.00002)
  longitude = base_longitude + (step * 0.00002) + rand(-0.00002..0.00002)

  rounded_payload(
    "altitude_m" => altitude,
    "vertical_speed_mps" => vertical_speed,
    "temperature_c" => temperature,
    "pressure_hpa" => pressure,
    "humidity_pct" => humidity.clamp(10.0, 95.0),
    "battery_v" => [battery, 6.8].max,
    "latitude" => latitude,
    "longitude" => longitude,
    "ax_g" => rand(-0.08..0.08),
    "ay_g" => rand(-0.08..0.08),
    "az_g" => 1.0 + rand(-0.12..0.18)
  )
end

workspaces_data.each_with_index do |workspace_data, index|
  workspace = demo_user.workspaces.create!(workspace_data)
  PayloadSchema.create!(workspace: workspace, fields: telemetry_fields)

  completed_session = workspace.sessions.create!(
    name: "Flight Test #{index + 1}A",
    description: "Completed high-altitude mission profile",
    status: :completed,
    started_at: (3 + index).days.ago,
    ended_at: (3 + index).days.ago + 22.minutes
  )

  in_progress_session = workspace.sessions.create!(
    name: "Flight Test #{index + 1}B",
    description: "Current monitoring session",
    status: :in_progress,
    started_at: 90.minutes.ago
  )

  180.times do |step|
    recorded_at = completed_session.started_at + step.seconds * 7
    payload = simulated_packet(
      step,
      total_steps: 180,
      base_altitude: 80.0 + (index * 15),
      max_altitude: 1400.0 + (index * 120),
      base_latitude: 1.3521 + (index * 0.0009),
      base_longitude: 103.8198 + (index * 0.0008)
    )

    workspace.telemetry_records.create!(
      session: completed_session,
      raw_payload: payload,
      processed_payload: payload,
      recorded_at: recorded_at
    )
  end

  35.times do |step|
    recorded_at = in_progress_session.started_at + step.minutes * 2
    payload = simulated_packet(
      step,
      total_steps: 60,
      base_altitude: 90.0 + (index * 12),
      max_altitude: 680.0 + (index * 80),
      base_latitude: 1.3521 + (index * 0.0009),
      base_longitude: 103.8198 + (index * 0.0008)
    )

    workspace.telemetry_records.create!(
      session: in_progress_session,
      raw_payload: payload,
      processed_payload: payload,
      recorded_at: recorded_at
    )
  end
end

puts "Seeded user: #{demo_user.email}"
puts "Workspaces: #{Workspace.count}"
puts "Sessions: #{Session.count} (#{Session.completed.count} completed / #{Session.in_progress.count} active)"
puts "Telemetry records: #{TelemetryRecord.count}"
