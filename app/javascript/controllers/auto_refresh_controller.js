import { Controller } from "@hotwired/stimulus"
import { visit } from "@hotwired/turbo"

export default class extends Controller {
  static values = {
    url: String,
    interval: Number
  }

  connect() {
    this.timer = setInterval(() => {
      visit(this.urlValue, { action: "replace" })
    }, this.intervalValue)
  }

  disconnect() {
    clearInterval(this.timer)
  }
}
