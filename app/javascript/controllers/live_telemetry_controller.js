import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.handleTelemetry = this.handleTelemetry.bind(this)
    window.addEventListener("telemetry:received", this.handleTelemetry)

    // Setup history arrays for charts (keep last 30 readings)
    this.gasData = Array(30).fill(0)
    this.tempData = Array(30).fill(0)
    this.presData = Array(30).fill(0)

    // Clock setup
    this.clockEl = document.getElementById("center-clock")
    if (this.clockEl) {
      this.tick()
      this.clockInterval = setInterval(() => this.tick(), 1000)
    }
  }

  disconnect() {
    window.removeEventListener("telemetry:received", this.handleTelemetry)
    if (this.clockInterval) clearInterval(this.clockInterval)
  }

  tick() {
    this.clockEl.textContent = new Date().toUTCString().slice(17, 25) + " UTC"
  }

  handleTelemetry(event) {
    const payload = event.detail
    if (!payload) return

    // Magnetometer/Heading
    this.updateCompass(payload)
    
    // MQ135 (Gas)
    this.updateGas(payload)
    
    // BMP280 (Temperature)
    this.updateTemperature(payload)
    
    // BMP280 (Pressure)
    this.updatePressure(payload)
    
    // Battery Status
    this.updateBattery(payload)
  }

  updateCompass(data) {
    // Accepts 'heading' or calculates from mag_x/y if needed. For now assume passing heading directly.
    let heading = parseFloat(data.heading)
    if (isNaN(heading)) return

    const compassNeedle = document.getElementById("compass-needle")
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    const deg = document.getElementById("compass-deg")
    const dir = document.getElementById("compass-dir")
    
    if (compassNeedle) compassNeedle.style.transform = `rotate(${heading}deg)`
    if (deg) deg.textContent = Math.round(heading)
    if (dir) dir.textContent = dirs[Math.round(heading / 45) % 8] || "N"

    if (data.mag_x !== undefined) {
      const mx = document.getElementById("mag-x")
      if (mx) mx.textContent = `${data.mag_x > 0 ? '+' : ''}${Math.round(data.mag_x)} µT`
    }
    if (data.mag_y !== undefined) {
      const my = document.getElementById("mag-y")
      if (my) my.textContent = `${data.mag_y > 0 ? '+' : ''}${Math.round(data.mag_y)} µT`
    }
    if (data.mag_z !== undefined) {
      const mz = document.getElementById("mag-z")
      if (mz) mz.textContent = `${data.mag_z > 0 ? '+' : ''}${Math.round(data.mag_z)} µT`
    }
  }

  updateGas(data) {
    let ppm = parseFloat(data.mq135 || data.gas)
    if (isNaN(ppm)) return

    this.gasData.shift()
    this.gasData.push(ppm)

    const readout = document.getElementById("gas-readout")
    const badge = document.getElementById("gas-badge")
    const valBadge = document.getElementById("gas-val-badge")
    const marker = document.getElementById("gas-marker")

    if (readout) readout.textContent = Math.round(ppm)
    
    const lbl = ppm < 300 ? "CLEAN" : ppm < 600 ? "GOOD" : ppm < 800 ? "MODERATE" : "HAZARDOUS"
    const col = ppm < 300 ? "#10B981" : ppm < 600 ? "#84cc16" : ppm < 800 ? "#F59E0B" : "#f43f5e"

    if (badge) {
      badge.textContent = lbl
      badge.style.color = col
    }
    if (valBadge) {
      valBadge.textContent = lbl[0] + lbl.slice(1).toLowerCase()
      valBadge.style.color = col
    }

    if (marker) marker.style.left = `${Math.min(100, Math.max(0, ppm / 10))}%`
    
    this.renderChart("gas-chart", "gas-line", "gas-area", this.gasData, 0, 1000)
  }

  updateTemperature(data) {
    let temp = parseFloat(data.temperature || data.temp)
    if (isNaN(temp)) return

    this.tempData.shift()
    this.tempData.push(temp)

    const valEl = document.getElementById("temp-val")
    const marker = document.getElementById("temp-marker")

    if (valEl) valEl.textContent = temp.toFixed(1)
    if (marker) marker.style.left = `${Math.min(100, Math.max(0, ((temp + 20) / 105) * 100))}%`

    this.renderChart("temp-chart", "temp-line", "temp-area", this.tempData, -20, 85)
  }

  updatePressure(data) {
    let pressure = parseFloat(data.pressure)
    if (isNaN(pressure)) return

    this.presData.shift()
    this.presData.push(pressure)

    const valEl = document.getElementById("pres-val")
    const altEl = document.getElementById("pres-alt")
    const marker = document.getElementById("pres-marker")

    if (valEl) valEl.textContent = Math.round(pressure)
    if (altEl) altEl.textContent = `~${Math.round(44330 * (1 - Math.pow(pressure / 1013.25, 0.1903)))}m`
    if (marker) marker.style.left = `${Math.max(1, Math.min(99, ((pressure - 900) / 150) * 100))}%`

    this.renderChart("pres-chart", "pres-line", "pres-area", this.presData, 900, 1050)
  }

  updateBattery(data) {
    let batt = parseFloat(data.battery || data.batt)
    if (isNaN(batt)) return

    const fill = document.getElementById("batt-fill-header")
    const pct = document.getElementById("batt-pct-header")
    const pill = document.getElementById("battery-header-pill")

    if (fill) fill.setAttribute("width", Math.max(1, Math.round((batt / 100) * 20)))
    if (pct) pct.textContent = Math.round(batt)
    
    const color = batt < 20 ? "#f43f5e" : batt < 40 ? "#F59E0B" : "#10B981"
    
    if (fill) fill.setAttribute("fill", color)
    if (pct) pct.style.color = color
    if (pill) pill.className = batt < 20 ? "battery-pill critical" : batt < 40 ? "battery-pill warning" : "battery-pill"
  }

  renderChart(svgId, lineId, areaId, data, minY, maxY) {
    const svg = document.getElementById(svgId)
    if (!svg) return

    const W = svg.clientWidth || svg.parentElement.clientWidth || 280
    const H = svg.clientHeight || svg.parentElement.clientHeight || 60
    if (W < 2 || H < 2 || data.length < 2) return

    const n = data.length
    const pts = data.map((v, i) => {
      const x = (i / (n - 1)) * W
      const y = H - Math.max(0, Math.min(1, (v - minY) / (maxY - minY))) * H * 0.9
      return [x, y]
    })

    const linePath = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")
    const areaPath = linePath + ` L${W},${H} L0,${H} Z`

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
    
    const lineEl = document.getElementById(lineId)
    const areaEl = document.getElementById(areaId)
    
    if (lineEl) lineEl.setAttribute("d", linePath)
    if (areaEl) areaEl.setAttribute("d", areaPath)
  }
}
