import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    url: String,
    interval: Number
  }

  connect() {
    this.timer = setInterval(() => {
      Turbo.visit(this.urlValue, { action: "replace" })
    }, this.intervalValue)
  }

  disconnect() {
    clearInterval(this.timer)
  }
}
