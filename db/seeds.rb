# Clear existing data
TelemetryRecord.delete_all
Session.delete_all
PayloadSchema.delete_all
Workspace.delete_all
User.delete_all

# Create users
user_1 = User.create!(
  email: "cansat_team@example.com",
  password: "password123",
  password_confirmation: "password123"
)

user_2 = User.create!(
  email: "weather_station@example.com",
  password: "password123",
  password_confirmation: "password123"
)

user_3 = User.create!(
  email: "agriculture_iot@example.com",
  password: "password123",
  password_confirmation: "password123"
)

# ==================== CANSAT PROJECT ====================
workspace_cansat = Workspace.create!(
  user: user_1,
  name: "CanSat 2025 - High Altitude Mission",
  description: "Real-time telemetry tracking for high-altitude weather satellite"
)

schema_cansat = PayloadSchema.create!(
  workspace: workspace_cansat,
  fields: [
    { key: "altitude", type: "float", unit: "meters" },
    { key: "temperature", type: "float", unit: "celsius" },
    { key: "pressure", type: "float", unit: "hPa" },
    { key: "humidity", type: "float", unit: "percent" },
    { key: "gps_latitude", type: "float", unit: "degrees" },
    { key: "gps_longitude", type: "float", unit: "degrees" },
    { key: "acceleration_x", type: "float", unit: "m/s²" },
    { key: "acceleration_y", type: "float", unit: "m/s²" },
    { key: "acceleration_z", type: "float", unit: "m/s²" }
  ]
)

# CanSat Session 1 - Launch sequence
session_cansat_1 = Session.create!(
  workspace: workspace_cansat,
  name: "Launch Sequence - Ascent Phase",
  started_at: Time.current - 2.hours
)

# Generate realistic telemetry for ascent (altitude increasing)
(0..60).each do |i|
  minutes_ago = 60 - i
  altitude = 150 + (i * 350)
  temperature = 20 - (i * 0.15)
  
  TelemetryRecord.create!(
    workspace: workspace_cansat,
    session: session_cansat_1,
    raw_payload: {
      "altitude" => altitude,
      "temperature" => temperature,
      "pressure" => 1013 - (altitude / 50),
      "humidity" => 45 + (i % 10),
      "gps_latitude" => 40.7128 + (i * 0.0005),
      "gps_longitude" => -74.0060 + (i * 0.0003),
      "acceleration_x" => (rand - 0.5) * 2,
      "acceleration_y" => (rand - 0.5) * 2,
      "acceleration_z" => 9.8 + (rand - 0.5)
    },
    recorded_at: Time.current - minutes_ago.minutes
  )
end

# ==================== WEATHER STATION PROJECT ====================
workspace_weather = Workspace.create!(
  user: user_2,
  name: "Automated Weather Station Network",
  description: "Continuous environmental monitoring across 5 geographic locations"
)

schema_weather = PayloadSchema.create!(
  workspace: workspace_weather,
  fields: [
    { key: "temperature", type: "float", unit: "celsius" },
    { key: "wind_speed", type: "float", unit: "km/h" },
    { key: "wind_direction", type: "float", unit: "degrees" },
    { key: "precipitation", type: "float", unit: "mm" },
    { key: "uv_index", type: "float", unit: "index" },
    { key: "visibility", type: "float", unit: "kilometers" }
  ]
)

# Weather station sessions from multiple locations
locations = [
  { name: "Downtown Station", base_temp: 22 },
  { name: "Airport Station", base_temp: 19 },
  { name: "Mountain Station", base_temp: 12 }
]

locations.each_with_index do |location, idx|
  session = Session.create!(
    workspace: workspace_weather,
    name: location[:name],
    started_at: Time.current - 48.hours
  )
  
  # Generate 2 days of hourly data
  (0..47).each do |hour|
    hours_ago = 48 - hour
    temp_variation = location[:base_temp] + (Math.sin(hour / 4.0) * 5)
    
    TelemetryRecord.create!(
      workspace: workspace_weather,
      session: session,
      raw_payload: {
        "temperature" => temp_variation + (rand - 0.5) * 2,
        "wind_speed" => 5 + (idx * 3) + (rand * 10),
        "wind_direction" => (hour * 7.5) % 360,
        "precipitation" => hour > 24 ? (rand * 2) : 0,
        "uv_index" => [3 + (Math.sin((hour - 12) / 12.0) * 5), 0].max,
        "visibility" => 10 - (rand * 3)
      },
      recorded_at: Time.current - hours_ago.hours
    )
  end
end

# ==================== AGRICULTURE IOT PROJECT ====================
workspace_agriculture = Workspace.create!(
  user: user_3,
  name: "Smart Farm Monitoring System",
  description: "Precision agriculture with soil, weather, and crop health sensors"
)

schema_agriculture = PayloadSchema.create!(
  workspace: workspace_agriculture,
  fields: [
    { key: "soil_moisture", type: "float", unit: "percent" },
    { key: "soil_ph", type: "float", unit: "pH" },
    { key: "soil_nitrogen", type: "float", unit: "mg/kg" },
    { key: "air_temperature", type: "float", unit: "celsius" },
    { key: "air_humidity", type: "float", unit: "percent" },
    { key: "light_intensity", type: "float", unit: "lux" },
    { key: "plant_health_score", type: "float", unit: "percent" }
  ]
)

# Field A - Main crop area
session_field_a = Session.create!(
  workspace: workspace_agriculture,
  name: "Field A - Primary Crop Zone",
  started_at: Time.current - 7.days
)

PI = 3.14159265359

(0..168).each do |hour|
  hours_ago = 168 - hour
  time_of_day = (hour % 24) / 24.0
  
  TelemetryRecord.create!(
    workspace: workspace_agriculture,
    session: session_field_a,
    raw_payload: {
      "soil_moisture" => 55 + (Math.sin(time_of_day * PI * 2) * 15),
      "soil_ph" => 6.8 + (rand - 0.5) * 0.3,
      "soil_nitrogen" => 45 + (rand * 20),
      "air_temperature" => 20 + (Math.sin(time_of_day * PI * 2) * 8),
      "air_humidity" => 60 + (rand * 20),
      "light_intensity" => [50000 * (Math.sin((time_of_day - 0.25) * PI * 2).abs), 0].max,
      "plant_health_score" => 85 + (rand - 0.5) * 10
    },
    recorded_at: Time.current - hours_ago.hours
  )
end

puts "✅ Seed data created successfully!"
puts ""
puts "Users created:"
puts "  - #{user_1.email} (CanSat project)"
puts "  - #{user_2.email} (Weather stations)"
puts "  - #{user_3.email} (Agriculture IoT)"
puts ""
puts "Workspaces:"
puts "  - #{workspace_cansat.name} (#{TelemetryRecord.where(workspace: workspace_cansat).count} records)"
puts "  - #{workspace_weather.name} (#{TelemetryRecord.where(workspace: workspace_weather).count} records)"
puts "  - #{workspace_agriculture.name} (#{TelemetryRecord.where(workspace: workspace_agriculture).count} records)"
puts ""
puts "Total telemetry records: #{TelemetryRecord.count}"
