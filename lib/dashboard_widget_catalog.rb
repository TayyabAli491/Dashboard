module DashboardWidgetCatalog
  module_function

  CATALOG = {
    "value_card" => {
      label: "Value Card",
      description: "Single live metric",
      icon: "fa-hashtag",
      group: "Data Display",
      min_fields: 1,
      max_fields: 1,
      configurable: %i[fields color unit decimals],
      default_grid: { w: 3, h: 2 }
    },
    "line_chart" => {
      label: "Line Chart",
      description: "Time series of one or more fields",
      icon: "fa-chart-line",
      group: "Data Display",
      min_fields: 1,
      max_fields: 4,
      configurable: %i[fields color],
      default_grid: { w: 6, h: 3 }
    },
    "gauge" => {
      label: "Gauge",
      description: "Current value within a range",
      icon: "fa-gauge-high",
      group: "Data Display",
      min_fields: 1,
      max_fields: 1,
      configurable: %i[fields color unit min max],
      default_grid: { w: 3, h: 3 }
    },
    "gps_map" => {
      label: "GPS Map",
      description: "Live position tracking",
      icon: "fa-map-location-dot",
      group: "Telemetry",
      min_fields: 0,
      max_fields: 0,
      auto_fields: %w[latitude longitude],
      auto_aliases: { "latitude" => %w[lat], "longitude" => %w[lng lon] },
      configurable: %i[],
      default_grid: { w: 6, h: 4 }
    },
    "attitude_3d" => {
      label: "3D Attitude",
      description: "Roll · Pitch · Yaw",
      icon: "fa-cube",
      group: "Telemetry",
      min_fields: 0,
      max_fields: 0,
      auto_fields: %w[roll pitch yaw],
      configurable: %i[],
      default_grid: { w: 4, h: 4 }
    },
    "compass" => {
      label: "Compass",
      description: "Heading direction",
      icon: "fa-compass",
      group: "Telemetry",
      min_fields: 0,
      max_fields: 0,
      auto_fields: %w[heading],
      configurable: %i[],
      default_grid: { w: 3, h: 3 }
    }
  }.freeze

  COLOR_CHOICES = %w[primary cyan success warning danger].freeze

  def all
    CATALOG
  end

  def find(type)
    CATALOG[type.to_s]
  end

  def configurable?(type)
    spec = find(type)
    spec && spec[:min_fields].to_i.positive?
  end

  def normalize_widget(raw_widget)
    return nil unless raw_widget.is_a?(Hash)

    type = raw_widget["type"].to_s
    spec = find(type)
    return nil unless spec

    config = (raw_widget["config"] || {}).slice("fields", "color", "unit", "decimals", "min", "max")

    {
      "id"     => raw_widget["id"].presence || "widget_#{SecureRandom.hex(6)}",
      "type"   => type,
      "label"  => raw_widget["label"].to_s.presence || spec[:label],
      "grid"   => normalize_grid(raw_widget["grid"], spec[:default_grid]),
      "config" => apply_config_defaults(config, spec)
    }
  end

  def normalize_grid(grid, default)
    grid = {} unless grid.is_a?(Hash)
    {
      "x" => grid["x"].to_i,
      "y" => grid["y"].to_i,
      "w" => (grid["w"] || default[:w]).to_i,
      "h" => (grid["h"] || default[:h]).to_i
    }
  end

  def apply_config_defaults(config, spec)
    fields = Array(config["fields"]).reject(&:blank?)
    fields = spec[:auto_fields] if fields.empty? && spec[:auto_fields]

    {
      "fields"   => fields,
      "color"    => COLOR_CHOICES.include?(config["color"]) ? config["color"] : "primary",
      "unit"     => config["unit"].to_s,
      "decimals" => (config["decimals"] || 1).to_i.clamp(0, 4),
      "min"      => config["min"].presence&.to_f || 0,
      "max"      => config["max"].presence&.to_f || 100
    }
  end
end
