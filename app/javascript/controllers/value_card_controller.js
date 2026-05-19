import { Controller } from "@hotwired/stimulus"

const COLOR_HEX = {
  primary: "#6366F1",
  cyan:    "#06B6D4",
  success: "#10B981",
  warning: "#F59E0B",
  danger:  "#EF4444"
}

export default class extends Controller {
  static targets = ["value", "unit", "pulse"]
  static values  = {
    field:    String,
    unit:     String,
    decimals: { type: Number, default: 1 },
    color:    { type: String, default: "primary" }
  }

  connect() {
    this.handleTelemetry = this.handleTelemetry.bind(this)
    window.addEventListener("telemetry:received", this.handleTelemetry)
    this.lastValue = null

    if (this.hasPulseTarget) {
      this.pulseTarget.style.background = COLOR_HEX[this.colorValue] || COLOR_HEX.primary
    }
  }

  disconnect() {
    window.removeEventListener("telemetry:received", this.handleTelemetry)
  }

  handleTelemetry(event) {
    const payload = event.detail
    if (!payload || payload[this.fieldValue] === undefined) return

    const raw     = payload[this.fieldValue]
    const numeric = parseFloat(raw)
    const display = isNaN(numeric) ? String(raw) : numeric.toFixed(this.decimalsValue)

    this.valueTarget.textContent = display
    this.flash()
  }

  flash() {
    if (!this.hasPulseTarget) return
    this.pulseTarget.classList.remove("flash")
    void this.pulseTarget.offsetWidth
    this.pulseTarget.classList.add("flash")
  }
}
