import { Controller } from "@hotwired/stimulus"
import * as THREE from "three"

export default class extends Controller {
  static targets = ["stats"]
  static values  = { workspaceId: Number }

  connect() {
    this.setupScene()
    this.setupCanSat()
    this.setupLights()
    this.startAnimationLoop()
    this.subscribeToChannel()
    this._ro = new ResizeObserver(() => this.onResize())
    this._ro.observe(this.element)
  }

  disconnect() {
    cancelAnimationFrame(this.animationFrameId)
    this.renderer?.dispose()
    window.removeEventListener("telemetry:received", this.handleTelemetry)
    this._ro?.disconnect()
  }

  onResize() {
    const w = this.element.clientWidth
    const h = this.element.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  setupScene() {
    const width  = this.element.clientWidth  || 400
    const height = this.element.clientHeight || 300

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x050810)

    // Subtle star-field particles
    const starGeo = new THREE.BufferGeometry()
    const starCount = 300
    const positions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 60
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.5 })
    this.scene.add(new THREE.Points(starGeo, starMat))

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
    this.camera.position.set(4, 2.5, 5)
    this.camera.lookAt(0, 0.5, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.element.appendChild(this.renderer.domElement)

    // Subtle grid floor
    const grid = new THREE.GridHelper(6, 12, new THREE.Color(0x1a1d2e), new THREE.Color(0x0f111a))
    grid.position.y = -1.5
    this.scene.add(grid)

    // Glow axes
    const axes = new THREE.AxesHelper(1.2)
    this.scene.add(axes)

    // Target rotation for smooth interpolation
    this.targetRotation = new THREE.Euler(0, 0, 0)
  }

  setupCanSat() {
    this.cansat = new THREE.Group()

    // --- Main body (cylinder) ---
    const bodyMat = new THREE.MeshStandardMaterial({
      color:     0x1e2a4a,
      emissive:  0x1e2a4a,
      emissiveIntensity: 0.1,
      metalness: 0.7,
      roughness: 0.3
    })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 2.0, 32), bodyMat)
    this.cansat.add(body)

    // Accent ring bands
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, emissive: 0x6366f1, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.1 })
    for (const y of [0.5, 0, -0.5]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.03, 8, 32), ringMat)
      ring.rotation.x = Math.PI / 2
      ring.position.y = y
      this.cansat.add(ring)
    }

    // Top cap
    const capMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 })
    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 32), capMat)
    topCap.position.y = 1.06
    this.cansat.add(topCap)

    // Bottom cap
    const botCap = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 32), capMat)
    botCap.position.y = -1.06
    this.cansat.add(botCap)

    // --- Solar panels (2 wings) ---
    const solarMat = new THREE.MeshStandardMaterial({
      color:     0x0f4c8a,
      emissive:  0x0a3060,
      emissiveIntensity: 0.3,
      metalness: 0.2,
      roughness: 0.6
    })
    const solarFrameMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 })

    for (const side of [-1, 1]) {
      // Panel
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.04), solarMat)
      panel.position.set(side * 0.95, 0, 0)
      this.cansat.add(panel)

      // Frame border
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.94, 1.44, 0.02), solarFrameMat)
      frame.position.set(side * 0.95, 0, -0.02)
      this.cansat.add(frame)

      // Panel cells grid lines (just visual bars)
      for (let row = -2; row <= 2; row++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.01, 0.05), new THREE.MeshStandardMaterial({ color: 0x1e3a5f, metalness: 0.5 }))
        bar.position.set(side * 0.95, row * 0.28, 0.02)
        this.cansat.add(bar)
      }
    }

    // --- Antenna (thin rod on top) ---
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.05 })
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.8, 8), antennaMat)
    antenna.position.y = 1.52
    this.cansat.add(antenna)

    // Antenna tip blink
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 1.5 })
    this.antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), tipMat)
    this.antennaTip.position.y = 1.95
    this.cansat.add(this.antennaTip)

    // --- Fins on bottom (4 fins) ---
    const finMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 })
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.3), finMat)
      fin.position.set(Math.sin(angle) * 0.44, -1.1, Math.cos(angle) * 0.44)
      fin.rotation.y = angle
      this.cansat.add(fin)
    }

    this.scene.add(this.cansat)
  }

  setupLights() {
    this.scene.add(new THREE.AmbientLight(0x8899cc, 0.6))

    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(5, 8, 5)
    sun.castShadow = true
    this.scene.add(sun)

    // Indigo fill light (from left)
    const fill = new THREE.DirectionalLight(0x6366f1, 0.7)
    fill.position.set(-5, 0, 2)
    this.scene.add(fill)

    // Cyan rim from back
    const rim = new THREE.DirectionalLight(0x06b6d4, 0.5)
    rim.position.set(0, -3, -5)
    this.scene.add(rim)
  }

  startAnimationLoop() {
    let t = 0
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)
      t += 0.016

      // Smooth interpolation toward target rotation from telemetry
      this.cansat.rotation.x = THREE.MathUtils.lerp(this.cansat.rotation.x, this.targetRotation.x, 0.08)
      this.cansat.rotation.y = THREE.MathUtils.lerp(this.cansat.rotation.y, this.targetRotation.y, 0.08)
      this.cansat.rotation.z = THREE.MathUtils.lerp(this.cansat.rotation.z, this.targetRotation.z, 0.08)

      // Slow idle drift when no telemetry incoming
      if (!this._hasLiveData) {
        this.cansat.rotation.y += 0.004
      }

      // Blink antenna tip
      if (this.antennaTip) {
        this.antennaTip.material.emissiveIntensity = 0.8 + 0.7 * Math.sin(t * 3)
      }

      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }

  subscribeToChannel() {
    this.handleTelemetry = this.handleTelemetry.bind(this)
    window.addEventListener("telemetry:received", this.handleTelemetry)
  }

  handleTelemetry(event) {
    this.handlePacket({ raw_payload: event.detail })
  }

  handlePacket(data) {
    const payload = data.processed_payload || data.raw_payload
    const pitch = parseFloat(payload.pitch || 0)
    const roll  = parseFloat(payload.roll  || 0)
    const yaw   = parseFloat(payload.yaw   || 0)
    const toRad = THREE.MathUtils.degToRad

    this.targetRotation.x = toRad(pitch)
    this.targetRotation.z = toRad(roll)
    this.targetRotation.y = toRad(yaw)
    this._hasLiveData = true

    if (this.hasStatsTarget) {
      this.statsTarget.innerHTML = `<span>P: ${pitch.toFixed(1)}°</span><span>R: ${roll.toFixed(1)}°</span><span>Y: ${yaw.toFixed(1)}°</span>`
    }
  }
}
