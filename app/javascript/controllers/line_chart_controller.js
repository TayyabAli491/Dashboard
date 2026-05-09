import { Controller } from "@hotwired/stimulus"

const COLOR_PALETTE = {
  primary: { line: "#6366F1", fill: "rgba(99,102,241,0.10)" },
  cyan:    { line: "#06B6D4", fill: "rgba(6,182,212,0.10)" },
  success: { line: "#10B981", fill: "rgba(16,185,129,0.10)" },
  warning: { line: "#F59E0B", fill: "rgba(245,158,11,0.10)" },
  danger:  { line: "#EF4444", fill: "rgba(239,68,68,0.10)" }
}
const FALLBACK_COLORS = ["primary", "cyan", "success", "warning", "danger"]

const MAX_POINTS = 60
const Chart = window.Chart

export default class extends Controller {
  static values = {
    fields: Array,
    color:  { type: String, default: "primary" }
  }

  connect() {
    const datasets = this.fieldsValue.map((field, i) => {
      const palette = COLOR_PALETTE[i === 0 ? this.colorValue : FALLBACK_COLORS[i % FALLBACK_COLORS.length]]
      return {
        label: field,
        data: [],
        borderColor: palette.line,
        backgroundColor: palette.fill,
        fill: this.fieldsValue.length === 1,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2
      }
    })

    this.chart = new Chart(this.element, {
      type: "line",
      data: { labels: [], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        scales: {
          x: {
            ticks: { color: "rgba(229,229,229,0.45)", maxTicksLimit: 5, font: { size: 9 } },
            grid:  { color: "rgba(255,255,255,0.04)" }
          },
          y: {
            ticks: { color: "rgba(229,229,229,0.45)", font: { size: 9 } },
            grid:  { color: "rgba(255,255,255,0.04)" }
          }
        },
        plugins: {
          legend: {
            display: this.fieldsValue.length > 1,
            labels: { color: "rgba(229,229,229,0.7)", boxWidth: 10, font: { size: 10 } }
          }
        }
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

    const stamp = new Date().toLocaleTimeString([], { hour12: false })

    if (this.chart.data.labels.length >= MAX_POINTS) {
      this.chart.data.labels.shift()
      this.chart.data.datasets.forEach(ds => ds.data.shift())
    }

    this.chart.data.labels.push(stamp)
    this.fieldsValue.forEach((field, i) => {
      const v = payload[field]
      this.chart.data.datasets[i].data.push(v !== undefined ? parseFloat(v) : null)
    })

    this.chart.update("none")
  }
}
