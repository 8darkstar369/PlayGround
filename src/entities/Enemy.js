import * as THREE from 'three'
import { clamp, angleDelta, damp, mulberry32 } from '../logic.js'
import { glowSprite, makeFlame } from '../world/gfx.js'

const DEFAULTS = {
  type: 'wanderer',
  hp: 58,
  damage: 10,
  speed: 2.2,
  attackRange: 2.2,
  aggroRange: 13,
  attackCooldown: 1.7,
  windup: 0.62,
  radius: 0.5,
  height: 1.8,
  color: 0x9d8cff,
  ranged: false,
  anchorRadius: 5
}

export class Enemy {
  constructor(scene, options = {}) {
    Object.assign(this, DEFAULTS, options)
    this.scene = scene
    this.maxHp = this.hp
    this.position = (options.position || new THREE.Vector3()).clone()
    this.spawn = this.position.clone()
    this.velocity = new THREE.Vector3()
    this.facing = Math.random() * Math.PI * 2
    this.state = 'idle'
    this.stateTime = 0
    this.cooldown = 0.5 + Math.random() * 1.2
    this.dead = false
    this.dying = 0
    this.remove = false
    this.aggro = false
    this.flash = 0
    this.time = Math.random() * 10
    this.barVisible = false
    this.patrolAngle = Math.random() * Math.PI * 2
    this.patrolTimer = 1 + Math.random() * 3
    this.attackDone = false
    this.random = mulberry32(Math.floor(Math.random() * 100000))
    this.build()
  }

  build() {
    this.root = new THREE.Group()
    this.root.position.copy(this.position)
    this.visual = new THREE.Group()
    this.root.add(this.visual)
    this.materials = []
    this.eyes = []

    if (this.type === 'wisp') {
      this.buildWisp()
    } else if (this.type === 'sentinel') {
      this.buildSentinel()
    } else {
      this.buildWanderer()
    }

    this.root.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true
        if (child.material && !this.materials.includes(child.material)) this.materials.push(child.material)
      }
    })
    this.scene.add(this.root)
    this.buildBar()
  }

  makeMaterial(color, options = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.06, ...options })
  }

  buildWanderer() {
    const robeColor = new THREE.Color(this.color).lerp(new THREE.Color(0x111522), 0.65)
    const robe = this.makeMaterial(robeColor, { side: THREE.DoubleSide })
    const dark = this.makeMaterial(0x080b12)
    const trim = this.makeMaterial(this.color, { emissive: this.color, emissiveIntensity: 0.9, roughness: 0.4 })
    this.visual.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.52, 1.3, 8, 2, true), robe))
    this.visual.children[0].position.y = 0.72
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), robe)
    hood.position.y = 1.48
    hood.scale.set(1, 1.14, 1.05)
    this.visual.add(hood)
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), dark)
    face.position.set(0, 1.47, 0.16)
    face.scale.set(1, 1.1, 0.42)
    this.visual.add(face)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 7, 5), new THREE.MeshBasicMaterial({ color: this.color }))
      eye.position.set(side * 0.065, 1.5, 0.29)
      this.visual.add(eye)
      this.eyes.push(eye)
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.8, 6), robe)
      arm.position.set(side * 0.43, 0.96, 0.02)
      arm.rotation.z = side * 0.28
      arm.rotation.x = -0.15
      this.visual.add(arm)
      if (side === 1) this.rightArm = arm
      else this.leftArm = arm
    }
    const tatters = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.35, 8, 1, true), robe)
    tatters.position.y = 0.1
    tatters.rotation.x = Math.PI
    this.visual.add(tatters)
    this.visual.add(this.eyes[0], this.eyes[1])
    const wisp = glowSprite(this.color, 1.5, 0.28)
    wisp.position.y = 1.3
    this.visual.add(wisp)
    this.glow = wisp
    if (trim) this.materials.push(trim)
  }

  buildSentinel() {
    const stone = this.makeMaterial(0x4a4742, { roughness: 0.95, metalness: 0.12 })
    const dark = this.makeMaterial(0x26241f, { roughness: 0.9 })
    const rune = new THREE.MeshBasicMaterial({ color: this.color })
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 0.62), stone)
    body.position.y = 1.02
    body.rotation.x = 0.06
    this.visual.add(body)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.4), dark)
    head.position.y = 1.72
    this.visual.add(head)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.02), rune)
      eye.position.set(side * 0.1, 1.75, 0.21)
      this.visual.add(eye)
      this.eyes.push(eye)
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.48), stone)
      shoulder.position.set(side * 0.65, 1.37, 0)
      this.visual.add(shoulder)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.26), stone)
      arm.position.set(side * 0.72, 0.9, 0)
      arm.rotation.z = side * 0.12
      this.visual.add(arm)
      if (side === 1) this.rightArm = arm
      else this.leftArm = arm
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.62, 0.34), dark)
      leg.position.set(side * 0.25, 0.3, 0)
      this.visual.add(leg)
    }
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 0), rune)
    core.position.set(0, 1.08, 0.34)
    core.rotation.z = Math.PI / 4
    this.visual.add(core)
    this.core = core
    const halo = glowSprite(this.color, 1.7, 0.2)
    halo.position.y = 1.1
    this.visual.add(halo)
    this.glow = halo
  }

  buildWisp() {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.23, 0), new THREE.MeshBasicMaterial({ color: this.color }))
    core.position.y = 1.55
    this.visual.add(core)
    this.core = core
    const ringMaterial = new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45 + i * 0.14, 0.014, 4, 28), ringMaterial)
      ring.rotation.x = Math.PI / 2 + i * 0.6
      ring.rotation.z = i * 0.8
      ring.position.y = 1.55
      this.visual.add(ring)
      if (i === 0) this.ringA = ring
      else this.ringB = ring
    }
    const halo = glowSprite(this.color, 2.2, 0.45)
    halo.position.y = 1.55
    this.visual.add(halo)
    this.glow = halo
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }))
      eye.position.set(side * 0.07, 1.58, 0.2)
      this.visual.add(eye)
      this.eyes.push(eye)
    }
    this.rightArm = null
    this.leftArm = null
  }

  buildBar() {
    this.bar = new THREE.Group()
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.09),
      new THREE.MeshBasicMaterial({ color: 0x05080d, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false })
    )
    back.renderOrder = 20
    const fillGeometry = new THREE.PlaneGeometry(1.1, 0.055)
    fillGeometry.translate(0.55, 0, 0)
    const fillMaterial = new THREE.MeshBasicMaterial({ color: 0xff6b76, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false })
    this.barFill = new THREE.Mesh(fillGeometry, fillMaterial)
    this.barFill.position.set(-0.55, 0, 0.001)
    this.barFill.renderOrder = 21
    this.bar.add(back, this.barFill)
    this.bar.position.y = this.height + 0.75
    this.bar.visible = false
    this.root.add(this.bar)
    this.barBack = back
  }

  updateBar(camera) {
    if (!this.bar) return
    const ratio = clamp(this.hp / this.maxHp, 0, 1)
    this.barFill.scale.x = Math.max(0.001, ratio)
    this.bar.visible = !this.dead && (this.barVisible || ratio < 0.999)
    this.bar.lookAt(camera.position)
    const distance = camera.position.distanceTo(this.position)
    const scale = clamp(distance / 12, 0.75, 1.4)
    this.bar.scale.setScalar(scale)
  }

  takeDamage(amount, { crit = false, source = null, effects = null, player = null } = {}) {
    if (this.dead) return 0
    this.hp -= amount
    this.flash = 0.12
    this.barVisible = true
    this.aggro = true
    if (source) {
      const dx = this.position.x - source.x
      const dz = this.position.z - source.z
      const length = Math.hypot(dx, dz) || 1
      this.velocity.x += (dx / length) * (crit ? 2.4 : 1.4)
      this.velocity.z += (dz / length) * (crit ? 2.4 : 1.4)
    }
    effects?.burst(this.position.clone().add(new THREE.Vector3(0, 1.1, 0)), crit ? 0xffd67a : this.color, crit ? 20 : 12, crit ? 5.5 : 3.6, 0.55, crit ? 0.34 : 0.26, 1.2)
    if (this.hp <= 0) this.die({ effects, player })
    return amount
  }

  die({ effects, player } = {}) {
    if (this.dead) return
    this.dead = true
    this.dying = 0.7
    this.state = 'dead'
    this.bar.visible = false
    effects?.burst(this.position.clone().add(new THREE.Vector3(0, 1, 0)), this.color, 30, 5.5, 1, 0.32, 0.8)
    effects?.shockwave(this.position, this.color, 3.2, 0.5)
  }

  update(dt, ctx) {
    const { player, world, effects, camera, audio } = ctx
    this.time += dt
    this.flash = Math.max(0, this.flash - dt)
    this.cooldown = Math.max(0, this.cooldown - dt)
    if (this.dead) {
      this.dying -= dt
      const t = clamp(this.dying / 0.7, 0, 1)
      this.visual.scale.setScalar(Math.max(0.001, t))
      this.visual.position.y = (1 - t) * 1.4
      this.visual.rotation.y += dt * 4
      if (this.dying <= 0) {
        this.remove = true
        this.root.visible = false
      }
      return
    }

    const dx = player.position.x - this.position.x
    const dz = player.position.z - this.position.z
    const distance = Math.hypot(dx, dz)
    if (!this.aggro && distance < this.aggroRange && player.alive) this.aggro = true
    if (this.aggro && !player.alive) this.aggro = false

    if (this.state === 'windup') {
      this.stateTime += dt
      this.visual.position.y = Math.sin(this.time * 30) * 0.025
      const progress = this.stateTime / this.windup
      if (!this.attackDone && this.stateTime >= this.windup) {
        this.attackDone = true
        this.performAttack({ player, world, effects, audio })
      }
      if (this.stateTime >= this.windup + 0.25) {
        this.state = 'chase'
        this.stateTime = 0
        this.cooldown = this.attackCooldown
        this.visual.position.y = 0
      }
      if (progress < 1) {
        this.visual.rotation.x = -0.25 * progress
      }
      this.root.rotation.y = this.facing
      this.animate(dt)
      this.updateBar(camera)
      return
    }

    let targetX = 0
    let targetZ = 0
    let active = false
    if (this.aggro) {
      if (distance > this.attackRange && this.ranged) {
        if (distance > 7.5) {
          targetX = dx / (distance || 1)
          targetZ = dz / (distance || 1)
          active = true
        } else if (distance < 5) {
          targetX = -dx / (distance || 1)
          targetZ = -dz / (distance || 1)
          active = true
        }
      } else if (distance > this.attackRange) {
        targetX = dx / (distance || 1)
        targetZ = dz / (distance || 1)
        active = true
      }
      if (distance <= this.attackRange + 0.3 && this.cooldown <= 0) {
        this.state = 'windup'
        this.stateTime = 0
        this.attackDone = false
        effects?.markerPulse(this.position, this.color)
        this.facing = Math.atan2(dx, dz)
        if (this.ranged) {
          this.visual.position.y = 0.2
        }
        return
      }
      if (distance < 2) {
        active = false
      }
    } else {
      this.patrolTimer -= dt
      if (this.patrolTimer <= 0) {
        this.patrolTimer = 2.5 + this.random() * 4
        this.patrolAngle = this.random() * Math.PI * 2
      }
      const target = new THREE.Vector3(
        this.spawn.x + Math.cos(this.patrolAngle) * this.anchorRadius * 0.7,
        0,
        this.spawn.z + Math.sin(this.patrolAngle) * this.anchorRadius * 0.7
      )
      const pdx = target.x - this.position.x
      const pdz = target.z - this.position.z
      const pd = Math.hypot(pdx, pdz)
      if (pd > 0.7) {
        targetX = pdx / pd
        targetZ = pdz / pd
        active = true
      }
    }

    if (active) {
      this.velocity.x = damp(this.velocity.x, targetX * this.speed, 6, dt)
      this.velocity.z = damp(this.velocity.z, targetZ * this.speed, 6, dt)
      this.facing += angleDelta(this.facing, Math.atan2(targetX, targetZ)) * Math.min(1, dt * 8)
      this.state = this.aggro ? 'chase' : 'patrol'
    } else {
      this.velocity.x = damp(this.velocity.x, 0, 8, dt)
      this.velocity.z = damp(this.velocity.z, 0, 8, dt)
    }

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    world.resolveCollisions(this.position, this.radius)
    this.position.y = world.getHeight?.(this.position) ?? 0
    this.root.position.copy(this.position)
    this.root.rotation.y = this.facing
    this.animate(dt)
    this.updateBar(camera)
  }

  performAttack({ player, world, effects, audio }) {
    if (!player.alive) return
    const dx = player.position.x - this.position.x
    const dz = player.position.z - this.position.z
    const distance = Math.hypot(dx, dz)
    if (this.ranged) {
      const dir = new THREE.Vector3(dx, 0.12, dz).normalize()
      world.spawnProjectile(this.position.clone().add(new THREE.Vector3(0, 1.5, 0)), dir, {
        speed: 11,
        damage: this.damage,
        color: this.color,
        radius: 0.28,
        life: 3.4,
        owner: 'enemy'
      })
      audio?.tone?.({ freq: 320, endFreq: 120, duration: 0.22, type: 'sine', volume: 0.06 })
      return
    }
    if (distance <= this.attackRange + 1.1) {
      const angle = Math.abs(angleDelta(this.facing, Math.atan2(dx, dz)))
      if (angle < 1.2) {
        player.takeDamage(this.damage, { world, effects, audio, ui: world.ui })
      }
    }
    effects?.slash(this.position.clone().add(new THREE.Vector3(0, 0.7, 0)), new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)), this.color, 2.4, 0.22)
    effects?.shockwave(this.position, this.color, 2.2, 0.35)
    audio?.noise?.({ duration: 0.2, volume: 0.08, type: 'bandpass', freq: 700, endFreq: 250 })
  }

  animate(dt) {
    if (this.dead) return
    const t = this.time
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    const moving = clamp(speed / 2, 0, 1)
    if (this.type === 'wisp') {
      this.visual.position.y = 0.1 + Math.sin(t * 2.4) * 0.16
      this.ringA.rotation.y += dt * 0.9
      this.ringB.rotation.x -= dt * 1.3
      this.core.rotation.y += dt * 1.6
      this.core.position.y = 1.55
    } else if (this.type === 'sentinel') {
      this.visual.position.y = Math.abs(Math.sin(t * 5)) * 0.035 * moving
      this.core.rotation.y += dt * 1.5
    } else {
      this.visual.position.y = Math.sin(t * 2) * 0.03 + Math.abs(Math.sin(t * 6)) * 0.04 * moving
      this.visual.rotation.z = Math.sin(t * 2.2) * 0.03
      if (this.leftArm) this.leftArm.rotation.x = Math.sin(t * (2 + moving * 4)) * 0.25
      if (this.rightArm) this.rightArm.rotation.x = -Math.sin(t * (2 + moving * 4)) * 0.25
    }
    if (this.flash > 0) {
      this.visual.scale.setScalar(1 + this.flash * 1.4)
    } else {
      this.visual.scale.setScalar(1)
    }
    if (this.glow) this.glow.material.opacity = 0.2 + Math.sin(t * 2.3) * 0.07 + (this.aggro ? 0.14 : 0)
    for (const eye of this.eyes) {
      if (eye.material) eye.material.color?.setHex?.(this.aggro ? 0xff5a6a : this.color)
    }
  }
}
