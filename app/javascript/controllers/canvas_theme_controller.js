import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "gridArea", 
    "videoLayer", 
    "fileInput", 
    "blueprintBtn", 
    "videoBtn"
  ]

  connect() {
    console.log("Canvas Theme Controller initialized.")
  }

  selectBlueprint() {
    // UI toggle
    this.blueprintBtnTarget.classList.add("border-[#1A1A1A]", "bg-[#F7F5F1]")
    this.videoBtnTarget.classList.remove("border-[#1A1A1A]", "bg-[#F7F5F1]")

    // Hide video
    this.videoLayerTarget.classList.add("opacity-0")
    setTimeout(() => {
      this.videoLayerTarget.classList.add("hidden")
      this.videoLayerTarget.pause()
    }, 300)

    // Restore blueprint grid style
    this.gridAreaTarget.style.backgroundColor = "rgba(255, 255, 255, 0.6)"
    this.gridAreaTarget.style.backgroundImage = "radial-gradient(#E8E4DD 1.5px, transparent 1.5px)"
  }

  triggerVideoUpload() {
    this.fileInputTarget.click()
  }

  handleVideoSelect(event) {
    const file = event.target.files[0]
    if (!file) return

    // UI toggle
    this.videoBtnTarget.classList.add("border-[#1A1A1A]", "bg-[#F7F5F1]")
    this.blueprintBtnTarget.classList.remove("border-[#1A1A1A]", "bg-[#F7F5F1]")

    // Load video URL
    const url = URL.createObjectURL(file)
    this.videoLayerTarget.src = url
    
    // Show video
    this.videoLayerTarget.classList.remove("hidden")
    // Minor delay to allow display block before fading in
    setTimeout(() => {
      this.videoLayerTarget.classList.remove("opacity-0")
      this.videoLayerTarget.play()
    }, 50)

    // Hide blueprint grid style to make canvas transparent
    this.gridAreaTarget.style.backgroundColor = "transparent"
    this.gridAreaTarget.style.backgroundImage = "none"
  }
}
