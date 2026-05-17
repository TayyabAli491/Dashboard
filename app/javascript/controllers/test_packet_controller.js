import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["button", "label", "result"]
  static values  = { url: String }

  async send() {
    this.setLoading()

    try {
      const response = await fetch(this.urlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept":       "application/json",
          "X-CSRF-Token": this.csrfToken()
        }
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        this.showSuccess(data.message || "Test packet delivered")
      } else {
        const errors = data.errors?.length ? data.errors.join(" • ") : "Something went wrong"
        this.showFailure(errors)
      }
    } catch (error) {
      this.showFailure(error.message || "Network error")
    }
  }

  setLoading() {
    this.buttonTarget.disabled = true
    this.labelTarget.textContent = "Sending..."
    this.resultTarget.classList.add("hidden")
  }

  showSuccess(message) {
    this.buttonTarget.disabled = false
    this.labelTarget.textContent = "Send a test packet"
    this.resultTarget.textContent = "✓ " + message
    this.resultTarget.classList.remove("hidden", "text-[#A32D2D]")
    this.resultTarget.classList.add("text-[#1F7A4F]", "font-medium")
  }

  showFailure(message) {
    this.buttonTarget.disabled = false
    this.labelTarget.textContent = "Send a test packet"
    this.resultTarget.textContent = "✕ " + message
    this.resultTarget.classList.remove("hidden", "text-[#1F7A4F]")
    this.resultTarget.classList.add("text-[#A32D2D]", "font-medium")
  }

  csrfToken() {
    return document.querySelector("meta[name='csrf-token']")?.content ?? ""
  }
}
