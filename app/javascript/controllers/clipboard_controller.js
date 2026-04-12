import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["button"]
  static values = { text: String }

  copy() {
    navigator.clipboard.writeText(this.textValue).then(() => {
      const originalText = this.buttonTarget.textContent
      this.buttonTarget.textContent = "Copied!"

      setTimeout(() => {
        this.buttonTarget.textContent = originalText
      }, 2000)
    })
  }
}
