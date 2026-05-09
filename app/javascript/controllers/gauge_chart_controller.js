import { Controller } from "@hotwired/stimulus"

const COLOR_HEX = {
  primary: "#6366F1",
  cyan:    "#06B6D4",
  success: "#10B981",
  warning: "#F59E0B",
  danger:  "#EF4444"
}
const Chart = window.Chart

export default class extends Controller {
  static targets = ["canvas", "readout"]
  static values  = {
    field:    String,
    min:      { type: Number, default: 0 },
    max:      { type: Number, default: 100 },
    unit:     String,
    decimals: { type: Number, default: 1 },
    color:    { type: String, default: "primary" }
  }

  connect() {
    const accent = COLOR_HEX[this.colorValue] || COLOR_HEX.primary

    this.chart = new Chart(this.canvasTarget, {
      type: "doughnut",
      data: {
        datasets: [{
          data: [0, this.maxValue - this.minValue],
          backgroundColor: [accent, "rgba(255,255,255,0.06)"],
          borderWidth: 0,
          circumference: 220,
          rotation: 250
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "78%",
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 350 }
      }
    })

    this.handleTelemetry = this.handleTelemetry.bind(this)
    window.addEventListener("telemetry:received", this.handleTelemetry)
  }

  disconnect() {
    this.chart?.destroy()
    window.removeEventListener("telemetry:received", this.handleTelemetry)
  }

  handleTelemetry(event) {
    const payload = event.detail
    if (!payload) return

    const value = parseFloat(payload[this.fieldValue])
    if (isNaN(value)) return

    const range   = this.maxValue - this.minValue
    const clamped = Math.min(Math.max(value, this.minValue), this.maxValue)
    const filled  = clamped - this.minValue

    this.chart.data.datasets[0].data = [filled, range - filled]
    this.chart.update("none")

    if (this.hasReadoutTarget) {
      this.readoutTarget.textContent = `${value.toFixed(this.decimalsValue)}${this.unitValue ? " " + this.unitValue : ""}`
    }
  }
}
