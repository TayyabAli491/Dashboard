import { Controller } from "@hotwired/stimulus"
// import consumer from "../channels/consumer"
import * as THREE from "three"

export default class extends Controller {
  static targets = ["stats"]
  static values  = { workspaceId: Number }

  connect() {
    // this.setupScene()
    // this.setupMesh()
    // this.setupLights()
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
    this.camera.position.set(3, 2, 4)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true 
    })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.element.appendChild(this.renderer.domElement)

    const gridHelper = new THREE.GridHelper(
      4, 8, 
      new THREE.Color(0x1f2937), 
      new THREE.Color(0x111827)
    )
    this.scene.add(gridHelper)

    const axesHelper = new THREE.AxesHelper(1.5)
    this.scene.add(axesHelper)
  }

  setupMesh() {
    const geometry = new THREE.BoxGeometry(1.5, 0.4, 2)
    const material = new THREE.MeshStandardMaterial({
      color:     0x6366F1,
      emissive:  0x6366F1,
      emissiveIntensity: 0.15,
      metalness: 0.3,
      roughness: 0.4
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.scene.add(this.mesh)

    // Target rotation for smooth interpolation
    this.targetRotation = new THREE.Euler(0, 0, 0)
  }

  setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambient)

    const directional = new THREE.DirectionalLight(
      0xffffff, 0.8
    )
    directional.position.set(5, 5, 5)
    this.scene.add(directional)
  }

  startAnimationLoop() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)

      // Smooth interpolation toward target rotation
      this.mesh.rotation.x = THREE.MathUtils.lerp(
        this.mesh.rotation.x, 
        this.targetRotation.x, 
        0.1
      )
      this.mesh.rotation.y = THREE.MathUtils.lerp(
        this.mesh.rotation.y, 
        this.targetRotation.y, 
        0.1
      )
      this.mesh.rotation.z = THREE.MathUtils.lerp(
        this.mesh.rotation.z, 
        this.targetRotation.z, 
        0.1
      )

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

    const pitch = parseFloat(payload.pitch || 0)
    const roll  = parseFloat(payload.roll  || 0)
    const yaw   = parseFloat(payload.yaw   || 0)

    const toRad = THREE.MathUtils.degToRad

    this.targetRotation.x = toRad(pitch)
    this.targetRotation.z = toRad(roll)
    this.targetRotation.y = toRad(yaw)

    if (this.hasStatsTarget) {
      this.statsTarget.innerHTML = `
        <span>P: ${pitch.toFixed(1)}°</span>
        <span>R: ${roll.toFixed(1)}°</span>
        <span>Y: ${yaw.toFixed(1)}°</span>
      `
    }
  }
}
