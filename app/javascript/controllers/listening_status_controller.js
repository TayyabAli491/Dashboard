import { Controller } from "@hotwired/stimulus"
import consumer from "channels/consumer"

export default class extends Controller {
  static targets = ["pill", "label", "pulse"]
  static values  = { workspaceId: Number }

  connect() {
    this.subscription = consumer.subscriptions.create(
      { channel: "WorkspaceTelemetryChannel", workspace_id: this.workspaceIdValue },
      { received: () => this.handlePacket() }
    )
  }

  disconnect() {
    this.subscription?.unsubscribe()
  }

  handlePacket() {
    this.labelTarget.classList.remove("text-[#6B6560]")
    this.labelTarget.classList.add("text-[#1A1A1A]")
    this.labelTarget.innerHTML = "Last packet received <strong>just now</strong> — data is flowing!"

    this.pillTarget.classList.add("ls-pill-flash")
    clearTimeout(this.flashTimer)
    this.flashTimer = setTimeout(() => {
      this.pillTarget.classList.remove("ls-pill-flash")
    }, 800)
  }
}
