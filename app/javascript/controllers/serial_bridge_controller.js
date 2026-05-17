import { Controller } from "@hotwired/stimulus"

const TELEM_PREFIX = "TELEM_JSON:"

export default class extends Controller {
  static targets = ["unsupported", "idle", "active", "portName", "packetCount", "errorCount", "lastError"]
  static values  = {
    endpoint: String,
    apiKey:   String,
    baudRate: { type: Number, default: 115200 }
  }

  connect() {
    if (!this.serialApiSupported()) {
      this.unsupportedTarget.classList.remove("hidden")
      this.idleTarget.classList.add("hidden")
      return
    }
    this.packets = 0
    this.errors  = 0
  }

  disconnect() {
    this.stop()
  }

  async start() {
    try {
      this.port = await navigator.serial.requestPort()
    } catch (error) {
      if (error.name !== "NotFoundError") this.showError(error.message || String(error))
      return
    }

    try {
      await this.port.open({ baudRate: this.baudRateValue })
      this.showActive()
      this.readLoop()
    } catch (error) {
      this.showError("Could not open port: " + (error.message || String(error)))
      this.port = null
    }
  }

  async stop() {
    this.reading = false
    try { await this.reader?.cancel() } catch {}
    try { await this.readerPromise } catch {}
    try { await this.port?.close() } catch {}
    this.port = null
    this.reader = null
    if (this.hasIdleTarget) {
      this.idleTarget.classList.remove("hidden")
      this.activeTarget.classList.add("hidden")
    }
  }

  async readLoop() {
    this.reading = true
    const decoder = new TextDecoderStream()
    this.readerPromise = this.port.readable.pipeTo(decoder.writable).catch(() => {})
    this.reader = decoder.readable.getReader()

    let buffer = ""
    while (this.reading) {
      let value, done
      try {
        ({ value, done } = await this.reader.read())
      } catch {
        break
      }
      if (done) break
      buffer += value

      let newlineIndex
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (line.startsWith(TELEM_PREFIX)) {
          this.forwardLine(line.slice(TELEM_PREFIX.length).trim())
        }
      }
    }
  }

  async forwardLine(jsonText) {
    let payload
    try {
      payload = JSON.parse(jsonText)
    } catch {
      this.bumpErrors("Bad JSON from device")
      return
    }

    try {
      const response = await fetch(this.endpointValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key":    this.apiKeyValue
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        this.bumpPackets()
      } else {
        const body = await response.json().catch(() => ({}))
        const reason = (body.errors || []).join(" • ") || `HTTP ${response.status}`
        this.bumpErrors(reason)
      }
    } catch (error) {
      this.bumpErrors(error.message || "Network error")
    }
  }

  bumpPackets() {
    this.packets++
    if (this.hasPacketCountTarget) this.packetCountTarget.textContent = this.packets
  }

  bumpErrors(message) {
    this.errors++
    if (this.hasErrorCountTarget) this.errorCountTarget.textContent = this.errors
    if (this.hasLastErrorTarget) {
      this.lastErrorTarget.textContent = message
      this.lastErrorTarget.classList.remove("hidden")
    }
  }

  showActive() {
    this.packets = 0
    this.errors  = 0
    if (this.hasPacketCountTarget) this.packetCountTarget.textContent = "0"
    if (this.hasErrorCountTarget)  this.errorCountTarget.textContent  = "0"
    if (this.hasLastErrorTarget)   this.lastErrorTarget.classList.add("hidden")
    if (this.hasPortNameTarget) {
      const info = this.port.getInfo?.() || {}
      const name = info.usbProductId
        ? `USB device 0x${info.usbVendorId.toString(16)}:0x${info.usbProductId.toString(16)}`
        : "serial device"
      this.portNameTarget.textContent = name
    }
    this.idleTarget.classList.add("hidden")
    this.activeTarget.classList.remove("hidden")
  }

  showError(message) {
    if (this.hasLastErrorTarget) {
      this.lastErrorTarget.textContent = message
      this.lastErrorTarget.classList.remove("hidden")
    }
  }

  serialApiSupported() {
    return typeof navigator !== "undefined" && "serial" in navigator && window.isSecureContext
  }
}
