import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["value", "button"]
  static values = { apiKey: String }

  connect() {
    this.isVisible = false
    this.renderState()
  }

  toggle() {
    this.isVisible = !this.isVisible
    this.renderState()
  }

  renderState() {
    this.valueTarget.textContent = this.isVisible ? this.apiKeyValue : "••••••••"
    this.buttonTarget.textContent = this.isVisible ? "Hide" : "Reveal"
  }
}
