import * as THREE from 'three'
import { clamp, damp, angleDelta, playerBonuses, attackDamage } from '../logic.js'
import { glowSprite } from '../world/gfx.js'

export class Player {
  constructor(scene, spawn = new THREE.Vector3()) {
    this.scene = scene
    this.radius = 0.5
    this.position = spawn.clone()
    this.velocity = new THREE.Vector3()
    this.facing = Math.PI
    this.health = 100
    this.maxHealth = 100
    this.stamina = 100
    this.maxStamina = 100
    this.virtues = { wisdom: 0, resilience: 0, empathy: 0, discipline: 0 }
    this.bonuses = playerBonuses(this.virtues)
    this.alive = true
    this.invulnerable = 0
    this.dodgeCooldown = 0
    this.attackCooldown = 0
    this.attackState = null
    this.combo = 0
    this.comboTimer = 0
    this.lastDamageAt = -20
    this.time = 0
    this.busy = 0
    this.sunbond = false
    this.speedScale = 1
    this.moveAmount = 0
    this.cameraShake = 0
    this.build()
  }

  build() {
    this.root = new THREE.Group()
    this.root.position.copy(this.position)
    this.root.rotation.y = this.facing

    this.visual = new THREE.Group()
    this.root.add(this.visual)

    const cloakMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b4572,
      emissive: 0x071a30,
      emissiveIntensity: 0.65,
      roughness: 0.72,
      metalness: 0.1,
      side: THREE.DoubleSide
    })
    const innerMaterial = new THREE.MeshStandardMaterial({ color: 0x0a1320, roughness: 0.92 })
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0bd77,
      roughness: 0.45,
      metalness: 0.7,
      emissive: 0x4a3310,
      emissiveIntensity: 0.65
    })
    this.trimMaterial = trimMaterial

    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.62, 1.18, 10, 3, true), cloakMaterial)
    cloak.position.y = 0.77
    cloak.castShadow = true
    this.visual.add(cloak)
    this.cloak = cloak

    const underCloak = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 1.1, 8), innerMaterial)
    underCloak.position.y = 0.75
    this.visual.add(underCloak)

    const shoulders = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.38, 8, 1, true), cloakMaterial)
    shoulders.position.y = 1.28
    shoulders.rotation.y = Math.PI / 8
    shoulders.castShadow = true
    this.visual.add(shoulders)

    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12), cloakMaterial)
    hood.scale.set(1, 1.1, 1.04)
    hood.position.y = 1.64
    hood.castShadow = true
    this.visual.add(hood)

    const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.5, 10, 1, true), cloakMaterial)
    cowl.position.y = 1.73
    cowl.rotation.x = Math.PI
    this.visual.add(cowl)

    const face = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0x05080d, roughness: 1 }))
    face.position.set(0, 1.62, 0.17)
    face.scale.set(1, 1.1, 0.55)
    this.visual.add(face)

    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xaee9ff })
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), eyeMaterial)
      eye.position.set(side * 0.07, 1.65, 0.31)
      this.visual.add(eye)
    }

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 6, 16), trimMaterial)
    belt.rotation.x = Math.PI / 2
    belt.position.y = 1.02
    this.visual.add(belt)

    const sigil = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: 0x8fe3ff }))
    sigil.position.set(0, 1.04, 0.33)
    sigil.rotation.z = Math.PI / 4
    this.visual.add(sigil)
    this.sigil = sigil

    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.022, 5, 28), trimMaterial)
    hem.rotation.x = Math.PI / 2
    hem.position.y = 0.24
    this.visual.add(hem)
    const backMark = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.018, 5, 24),
      new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.75 })
    )
    backMark.position.set(0, 1.22, -0.4)
    backMark.rotation.y = Math.PI
    this.visual.add(backMark)
    const backCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), new THREE.MeshBasicMaterial({ color: 0xc8f3ff }))
    backCore.position.set(0, 1.22, -0.41)
    this.visual.add(backCore)
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.78, 0.02), trimMaterial)
      rib.position.set(side * 0.24, 1.18, -0.4)
      rib.rotation.z = side * 0.055
      this.visual.add(rib)
    }

    this.leftArm = new THREE.Group()
    this.leftArm.position.set(-0.42, 1.28, 0)
    this.rightArm = new THREE.Group()
    this.rightArm.position.set(0.42, 1.28, 0)
    this.visual.add(this.leftArm, this.rightArm)

    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x182944, roughness: 0.85 })
    for (const [arm, side] of [[this.leftArm, -1], [this.rightArm, 1]]) {
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.62, 7), armMaterial)
      sleeve.position.set(side * 0.05, -0.3, 0)
      sleeve.rotation.z = side * 0.16
      sleeve.castShadow = true
      arm.add(sleeve)
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 9, 7), innerMaterial)
      hand.position.set(side * 0.13, -0.62, 0.02)
      arm.add(hand)
    }

    this.weapon = new THREE.Group()
    this.weapon.position.set(0.12, -0.62, 0.04)
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.08, 0.018), new THREE.MeshStandardMaterial({
      color: 0xe7d6a8,
      emissive: 0x8f6a24,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.85
    }))
    blade.position.y = 0.62
    blade.castShadow = true
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.07), trimMaterial)
    hilt.position.y = 0.08
    this.weapon.add(blade, hilt)
    this.weapon.rotation.z = 0.35
    this.weapon.rotation.x = -0.2
    this.rightArm.add(this.weapon)

    this.runeRing = new THREE.Group()
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.018, 5, 40), ringMaterial)
    ring.rotation.x = Math.PI / 2
    this.runeRing.add(ring)
    for (let i = 0; i < 4; i++) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.16), ringMaterial)
      const angle = (i / 4) * Math.PI * 2
      mark.position.set(Math.cos(angle) * 0.62, 0, Math.sin(angle) * 0.62)
      mark.rotation.y = -angle
      this.runeRing.add(mark)
    }
    this.runeRing.position.y = 0.05
    this.ringMaterial = ringMaterial
    this.root.add(this.runeRing)

    this.glow = glowSprite(0x6fcde8, 2.4, 0.22)
    this.glow.position.y = 0.7
    this.root.add(this.glow)

    this.fillLight = new THREE.PointLight(0xa8dfff, 3.6, 8, 2)
    this.fillLight.position.y = 1.5
    this.root.add(this.fillLight)

    this.scene.add(this.root)
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing))
  }

  setVirtues(virtues) {
    this.virtues = virtues
    const previousMax = this.maxHealth
    this.bonuses = playerBonuses(virtues)
    this.maxHealth = this.bonuses.maxHealth
    this.health = clamp(this.health + Math.max(0, this.maxHealth - previousMax), 0, this.maxHealth)
    this.maxStamina = 100 + virtues.resilience * 0.2
  }

  setPosition(position) {
    this.position.copy(position)
    this.root.position.copy(position)
    this.velocity.set(0, 0, 0)
  }

  reset(spawn) {
    this.position.copy(spawn)
    this.root.position.copy(spawn)
    this.velocity.set(0, 0, 0)
    this.health = this.maxHealth
    this.stamina = this.maxStamina
    this.alive = true
    this.invulnerable = 1.2
    this.attackState = null
    this.attackCooldown = 0
    this.dodgeCooldown = 0
    this.root.visible = true
    this.visual.visible = true
  }

  tryAttack({ world, effects, audio, game }) {
    if (!this.alive || this.attackCooldown > 0 || this.dodgeCooldown > 0.12 || this.busy > 0) return false
    this.combo = this.comboTimer > 0 ? (this.combo + 1) % 3 : 0
    this.comboTimer = 1.3
    this.attackCooldown = 0.46
    this.attackState = { time: 0, duration: 0.44, hit: false, combo: this.combo, dir: this.forward.clone() }
    this.attackCooldown = 0.44
    this.velocity.add(this.attackState.dir.clone().multiplyScalar(2.6))
    return true
  }

  tryDodge({ world, effects, audio }) {
    if (!this.alive || this.dodgeCooldown > 0 || this.stamina < 22) return false
    this.stamina -= 22
    this.dodgeCooldown = 1.05
    this.invulnerable = Math.max(this.invulnerable, 0.36)
    const input = this.lastMove && (Math.abs(this.lastMove.x) + Math.abs(this.lastMove.z) > 0.1)
    const dir = input
      ? new THREE.Vector3(this.lastMove.worldX, 0, this.lastMove.worldZ).normalize()
      : this.forward.clone().negate()
    this.dodgeDir = dir
    this.dodgeTime = 0.24
    this.dodgeTotal = 0.24
    effects?.burst(this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0x8fe3ff, 12, 2.6, 0.5, 0.26)
    audio?.dodge?.()
    return true
  }

  takeDamage(amount, { world, effects, audio, ui, game } = {}) {
    if (!this.alive || this.invulnerable > 0 || this.dodgeTime > 0) return false
    const damage = Math.max(1, Math.round(amount))
    this.health -= damage
    this.invulnerable = 0.55
    this.lastDamageAt = this.time
    this.cameraShake = Math.max(this.cameraShake, 0.22)
    effects?.burst(this.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff5a6a, 16, 4, 0.6, 0.3, 1.6)
    audio?.damage?.()
    ui?.damageFlash?.()
    if (this.health <= 0) {
      this.health = 0
      this.die({ audio, effects, game, ui })
    }
    return true
  }

  heal(amount, { ui, audio, effects } = {}) {
    if (!this.alive) return
    const before = this.health
    this.health = clamp(this.health + amount, 0, this.maxHealth)
    if (this.health > before) {
      ui?.healFlash?.()
      audio?.heal?.()
      effects?.burst(this.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0x7dffb0, 10, 2.2, 0.7, 0.28)
    }
  }

  die({ audio, effects, game, ui } = {}) {
    if (!this.alive) return
    this.alive = false
    this.attackState = null
    effects?.burst(this.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x8fe3ff, 36, 6, 1.2, 0.4)
    audio?.death?.()
    this.root.visible = false
    game?.onPlayerDeath?.()
  }

  update(dt, { input, cameraYaw, world, effects, audio, ui, game }) {
    this.time += dt
    this.invulnerable = Math.max(0, this.invulnerable - dt)
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.comboTimer = Math.max(0, this.comboTimer - dt)
    this.busy = Math.max(0, this.busy - dt)
    this.cameraShake = damp(this.cameraShake, 0, 7, dt)
    this.stamina = clamp(this.stamina + dt * 16 * this.bonuses.staminaRegen, 0, this.maxStamina)
    if (this.time - this.lastDamageAt > 8 && this.health < this.maxHealth && this.alive) {
      this.health = clamp(this.health + dt * 2.2, 0, this.maxHealth)
    }
    if (!this.alive) return

    const move = input.move
    const worldX = Math.cos(cameraYaw) * move.x + Math.sin(cameraYaw) * move.z
    const worldZ = -Math.sin(cameraYaw) * move.x + Math.cos(cameraYaw) * move.z
    const moving = Math.abs(worldX) + Math.abs(worldZ) > 0.06 && this.busy <= 0
    this.lastMove = { x: move.x, z: move.z, worldX, worldZ }
    this.moveAmount = damp(this.moveAmount, moving ? move.magnitude : 0, 9, dt)

    const speed = 5.6 * this.speedScale * (this.busy > 0 ? 0.25 : 1)
    if (this.dodgeTime > 0) {
      this.dodgeTime = Math.max(0, this.dodgeTime - dt)
      const strength = 15.5 * (this.dodgeTime / this.dodgeTotal)
      this.velocity.x = damp(this.velocity.x, this.dodgeDir.x * strength, 20, dt)
      this.velocity.z = damp(this.velocity.z, this.dodgeDir.z * strength, 20, dt)
      effects?.trail?.({ x: this.position.x, y: 0.25, z: this.position.z }, 0x8fe3ff, 1, 0.3)
    } else {
      this.velocity.x = damp(this.velocity.x, worldX * speed, moving ? 12 : 9, dt)
      this.velocity.z = damp(this.velocity.z, worldZ * speed, moving ? 12 : 9, dt)
    }

    const steps = Math.max(1, Math.ceil((Math.hypot(this.velocity.x, this.velocity.z) * dt) / 0.16))
    for (let i = 0; i < steps; i++) {
      this.position.x += (this.velocity.x * dt) / steps
      this.position.z += (this.velocity.z * dt) / steps
      world.resolveCollisions(this.position, this.radius)
    }

    if (moving) {
      const targetFacing = Math.atan2(worldX, worldZ)
      this.facing += angleDelta(this.facing, targetFacing) * Math.min(1, dt * 14)
    }

    if (this.attackState) {
      this.attackState.time += dt
      if (!this.attackState.hit && this.attackState.time >= 0.16) {
        this.attackState.hit = true
        this.performStrike({ world, effects, audio, game })
      }
      if (this.attackState.time >= this.attackState.duration) this.attackState = null
    }

    this.animate(dt)
  }

  performStrike({ world, effects, audio, game }) {
    const state = this.attackState
    const candidates = world.getDamageTargets?.(this.position, 5.5) ?? []
    let best = null
    let bestDistance = Infinity
    for (const target of candidates) {
      if (target.dead) continue
      const dx = target.position.x - this.position.x
      const dz = target.position.z - this.position.z
      const distance = Math.hypot(dx, dz)
      const angle = Math.abs(angleDelta(this.facing, Math.atan2(dx, dz)))
      if (distance < bestDistance && angle < 1.35) {
        best = target
        bestDistance = distance
      }
    }
    if (best && bestDistance < 5.6) {
      const dx = best.position.x - this.position.x
      const dz = best.position.z - this.position.z
      this.facing = Math.atan2(dx, dz)
    }
    this.root.rotation.y = this.facing
    const dir = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing))
    const { amount, crit } = attackDamage(18, state.combo, this.virtues)
    const hit = world.damageEnemies(this.position, dir, 3.35, 1.95, amount, { crit, source: 'player', player: this })
    effects?.slash(this.position.clone().add(new THREE.Vector3(0, 0.55, 0)), dir, this.sunbond ? 0xffe7a0 : 0xd9f1ff, 3.2, 0.3)
    if (hit > 0) {
      audio?.hit?.(crit)
      this.cameraShake = Math.max(this.cameraShake, crit ? 0.3 : 0.16)
      if (game) game.hitStop = crit ? 0.055 : 0.03
    } else {
      audio?.strike?.()
    }
    this.attackState.dir = dir
  }

  animate(dt) {
    const t = this.time
    this.root.position.copy(this.position)
    this.root.rotation.y = this.facing
    const bob = Math.sin(t * (6 + this.moveAmount * 4)) * 0.045 * this.moveAmount
    const dodgeProgress = this.dodgeTime > 0 ? this.dodgeTime / this.dodgeTotal : 0
    this.visual.position.y = bob + Math.sin(t * 2.4) * 0.02
    this.visual.rotation.x = damp(this.visual.rotation.x, this.moveAmount * 0.1 + dodgeProgress * 0.5, 9, dt)
    this.visual.rotation.z = Math.sin(t * 3.4) * 0.018 + dodgeProgress * 0.2
    this.cloak.rotation.y = Math.sin(t * 1.8) * 0.04
    this.cloak.rotation.z = Math.sin(t * 1.3) * 0.025 + this.moveAmount * 0.05
    this.leftArm.rotation.x = Math.sin(t * (2 + this.moveAmount * 3)) * 0.1 * (0.4 + this.moveAmount)
    this.rightArm.rotation.x = -Math.sin(t * (2 + this.moveAmount * 3)) * 0.1 * (0.4 + this.moveAmount)
    if (this.attackState) {
      const progress = clamp(this.attackState.time / this.attackState.duration, 0, 1)
      const swing = Math.sin(progress * Math.PI)
      this.rightArm.rotation.x = -1.5 * swing
      this.rightArm.rotation.z = -1.2 * swing
      this.visual.rotation.y = -0.55 * swing
      this.weapon.visible = true
    } else {
      this.rightArm.rotation.z = damp(this.rightArm.rotation.z, 0.15, 10, dt)
      this.visual.rotation.y = damp(this.visual.rotation.y, 0, 10, dt)
    }
    this.sigil.rotation.y += dt * 1.6
    this.runeRing.rotation.y += dt * 0.6
    this.runeRing.position.y = 0.05 + Math.sin(t * 1.4) * 0.015
    const ringColor = this.sunbond ? 0xffd77a : 0x8fe3ff
    this.ringMaterial.color.setHex(ringColor)
    this.ringMaterial.opacity = this.sunbond ? 0.75 : 0.38
    this.glow.material.opacity = this.invulnerable > 0 ? 0.45 : 0.22
    this.runeRing.visible = this.alive
    this.glow.visible = this.alive
    this.root.visible = this.alive
  }
}
