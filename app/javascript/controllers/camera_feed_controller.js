import { Controller } from "@hotwired/stimulus"
import consumer from "channels/consumer"

export default class extends Controller {
  static targets = ["feed", "offline", "timestamp"]
  static values = { workspaceId: Number }

  connect() {
    this.subscription = consumer.subscriptions.create(
      { channel: "WorkspaceCameraChannel", workspace_id: this.workspaceIdValue },
      { received: (data) => this.handleFrame(data) }
    )
  }

  disconnect() {
    this.subscription?.unsubscribe()
  }

  handleFrame(data) {
    if (!data.iimage) return

    // Ensure the image string has the proper base64 prefix if the hardware sends raw base64 without meta tags
    let imgSrc = data.iimage
    if (!imgSrc.startsWith("data:image")) {
      imgSrc = `data:image/jpeg;base64,${imgSrc}`
    }

    this.feedTarget.src = imgSrc
    
    // Toggle UI states
    this.offlineTarget.classList.add("hidden")
    this.feedTarget.classList.remove("hidden")
    this.timestampTarget.classList.remove("hidden")

    if (data.timestamp) {
      this.timestampTarget.innerText = `SYS: ${data.timestamp}`
    }
  }
}
