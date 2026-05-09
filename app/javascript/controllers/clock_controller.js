import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["display"]

  connect() {
    this.tick()
    this.timer = setInterval(() => this.tick(), 1000)
  }

  disconnect() {
    clearInterval(this.timer)
  }

  tick() {
    if (!this.hasDisplayTarget) return
    const now = new Date()
    this.displayTarget.textContent = `${now.toUTCString().slice(17, 25)} UTC`
  }
}
