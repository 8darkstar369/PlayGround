import * as THREE from 'three'
import { Effects } from './Effects.js'
import { Projectiles } from './Projectiles.js'
import { Enemy } from '../entities/Enemy.js'
import { clamp, angleDelta } from '../logic.js'

export class World {
  constructor(game, { boundary = 48, spawn = new THREE.Vector3() } = {}) {
    this.game = game
    this.ui = game.ui
    this.audio = game.audio
    this.scene = new THREE.Scene()
    this.boundary = boundary
    this.spawn = spawn.clone()
    this.colliders = []
    this.cameraBlockers = []
    this.enemies = []
    this.hazards = []
    this.effects = new Effects(this.scene)
    this.projectiles = new Projectiles(this.scene)
    this.time = 0
    this.active = false
    this.boss = null
  }

  addBoxCollider(x, z, width, depth, height = 4) {
    this.colliders.push({ type: 'box', x, z, width, depth, height })
  }

  addCircleCollider(x, z, radius, height = 4) {
    this.colliders.push({ type: 'circle', x, z, radius, height })
  }

  resolveCollisions(position, radius) {
    for (const collider of this.colliders) {
      if (collider.type === 'box') {
        const halfW = collider.width / 2
        const halfD = collider.depth / 2
        const closestX = clamp(position.x, collider.x - halfW, collider.x + halfW)
        const closestZ = clamp(position.z, collider.z - halfD, collider.z + halfD)
        let dx = position.x - closestX
        let dz = position.z - closestZ
        const distance = Math.hypot(dx, dz)
        if (distance < radius) {
          if (distance > 0.0001) {
            const push = (radius - distance) / distance
            position.x += dx * push
            position.z += dz * push
          } else {
            const left = Math.abs(position.x - (collider.x - halfW))
            const right = Math.abs(collider.x + halfW - position.x)
            const top = Math.abs(position.z - (collider.z - halfD))
            const bottom = Math.abs(collider.z + halfD - position.z)
            const min = Math.min(left, right, top, bottom)
            if (min === left) position.x = collider.x - halfW - radius
            else if (min === right) position.x = collider.x + halfW + radius
            else if (min === top) position.z = collider.z - halfD - radius
            else position.z = collider.z + halfD + radius
          }
        }
      } else {
        const dx = position.x - collider.x
        const dz = position.z - collider.z
        const distance = Math.hypot(dx, dz)
        const minDistance = radius + collider.radius
        if (distance < minDistance && distance > 0.0001) {
          const push = (minDistance - distance) / distance
          position.x += dx * push
          position.z += dz * push
        }
      }
    }
    const distance = Math.hypot(position.x, position.z)
    const maxDistance = this.boundary - radius
    if (distance > maxDistance) {
      position.x = (position.x / distance) * maxDistance
      position.z = (position.z / distance) * maxDistance
    }
  }

  getHeight() {
    return 0
  }

  spawnEnemy(options) {
    const enemy = new Enemy(this.scene, options)
    this.enemies.push(enemy)
    return enemy
  }

  spawnProjectile(from, direction, options) {
    return this.projectiles.spawn(from, direction, options)
  }

  getDamageTargets(origin, radius = 6) {
    const targets = []
    for (const enemy of this.enemies) {
      if (enemy.dead) continue
      if (origin.distanceTo(enemy.position) <= radius + 2.5) targets.push(enemy)
    }
    if (this.boss && !this.boss.dead && origin.distanceTo(this.boss.position) <= radius + 4.5) targets.push(this.boss)
    return targets
  }

  damageEnemies(origin, direction, range, arc, amount, opts = {}) {
    let hits = 0
    const targets = this.getDamageTargets(origin, range)
    for (const target of targets) {
      if (target.remove || target.dead) continue
      const dx = target.position.x - origin.x
      const dz = target.position.z - origin.z
      const distance = Math.hypot(dx, dz)
      if (distance > range + (target.radius ?? 0.5)) continue
      const angle = Math.abs(angleDelta(Math.atan2(direction.x, direction.z), Math.atan2(dx, dz)))
      if (angle > arc / 2 && distance > 1.2) continue
      const dealt = target.takeDamage(amount, { ...opts, source: origin, effects: this.effects, player: opts.player })
      if (dealt > 0) hits++
    }
    return hits
  }

  spawnHazard({ position, radius = 2.4, delay = 1.1, duration = 0.3, damage = 12, color = 0xff5a6a }) {
    const hazard = {
      position: position.clone(),
      radius,
      delay,
      duration,
      damage,
      color,
      elapsed: 0,
      triggered: false,
      group: this.effects.telegraph(position, color, radius, delay)
    }
    this.hazards.push(hazard)
    return hazard
  }

  updateHazards(dt, player) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hazard = this.hazards[i]
      hazard.elapsed += dt
      if (!hazard.triggered && hazard.elapsed >= hazard.delay) {
        hazard.triggered = true
        const distance = Math.hypot(player.position.x - hazard.position.x, player.position.z - hazard.position.z)
        if (distance <= hazard.radius + 0.35 && player.alive) {
          player.takeDamage(hazard.damage, { world: this, effects: this.effects, audio: this.audio, ui: this.ui })
        }
        this.effects.burst(hazard.position.clone().add(new THREE.Vector3(0, 0.3, 0)), hazard.color, 16, 3.2, 0.5, 0.28)
      }
      if (hazard.elapsed >= hazard.delay + hazard.duration) this.hazards.splice(i, 1)
    }
  }

  updateCommon(dt, ctx) {
    this.time += dt
    const { player, camera } = ctx
    for (const enemy of this.enemies) enemy.update(dt, { ...ctx, camera })
    for (const enemy of this.enemies) {
      if (enemy.dead && !enemy.rewarded && !enemy.isBossAdd) {
        enemy.rewarded = true
        this.game.onEnemyKilled?.(enemy, this)
      }
    }
    this.enemies = this.enemies.filter(enemy => !enemy.remove)
    this.projectiles.update(dt, { player, world: this, effects: this.effects, audio: this.audio, ui: this.ui })
    this.updateHazards(dt, player)
    this.effects.update(dt)
  }

  getInteractable() {
    return null
  }

  interact() {}

  getCompassTarget() {
    return null
  }

  getRule() {
    return null
  }

  getSpecial() {
    return null
  }

  update() {}

  onEnter() {}

  onExit() {}
}
