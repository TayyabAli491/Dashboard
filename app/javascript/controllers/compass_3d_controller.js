import { Controller } from "@hotwired/stimulus"
// import consumer from "../channels/consumer"
import * as THREE from "three"

export default class extends Controller {
  static targets = ["heading"]
  static values  = { workspaceId: Number }

  connect() {
    // this.targetHeading = 0
    // this.currentHeading = 0
    // this.setupScene()
    // this.setupCompass()
    // this.startAnimationLoop()
    // this.subscribeToChannel()
  }

  disconnect() {
    cancelAnimationFrame(this.animationFrameId)
    this.renderer?.dispose()
    this.subscription?.unsubscribe()
  }

  setupScene() {
    const width  = this.element.clientWidth
    const height = this.element.clientHeight

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x050810)

    this.camera = new THREE.PerspectiveCamera(
      45, width / height, 0.1, 100
    )
    this.camera.position.set(0, 4, 0)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true 
    })
    this.renderer.setSize(width, height)
    this.element.appendChild(this.renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)
  }

  setupCompass() {
    this.compassGroup = new THREE.Group()

    // Base disc
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.05, 64),
      new THREE.MeshStandardMaterial({ 
        color: 0x111827 
      })
    )
    this.compassGroup.add(disc)

    // North arrow — red
    const northArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.8, 8),
      new THREE.MeshStandardMaterial({ 
        color: 0xEF4444,
        emissive: 0xEF4444,
        emissiveIntensity: 0.3
      })
    )
    northArrow.position.set(0, 0.1, -0.5)
    northArrow.rotation.x = Math.PI / 2
    this.compassGroup.add(northArrow)

    // South arrow — indigo
    const southArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.6, 8),
      new THREE.MeshStandardMaterial({ 
        color: 0x6366F1 
      })
    )
    southArrow.position.set(0, 0.1, 0.5)
    southArrow.rotation.x = -Math.PI / 2
    this.compassGroup.add(southArrow)

    this.scene.add(this.compassGroup)
  }

  startAnimationLoop() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)

      this.currentHeading = THREE.MathUtils.lerp(
        this.currentHeading,
        this.targetHeading,
        0.08
      )

      this.compassGroup.rotation.y = 
        THREE.MathUtils.degToRad(-this.currentHeading)

      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }

  subscribeToChannel() {
    this.subscription = consumer.subscriptions.create(
      {
        channel: "WorkspaceTelemetryChannel",
        workspace_id: this.workspaceIdValue
      },
      { received: (data) => this.handlePacket(data) }
    )
  }

  handlePacket(data) {
    const payload = data.processed_payload || 
                    data.raw_payload

    const heading = parseFloat(payload.heading || 0)
    this.targetHeading = heading

    if (this.hasHeadingTarget) {
      this.headingTarget.textContent = 
        `HDG: ${heading.toFixed(1)}°`
    }
  }
}
