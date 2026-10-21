import * as THREE from 'three'
import { clamp } from '../logic.js'

export class Boss {
  constructor(scene, shard, options = {}) {
    this.scene = scene
    this.shard = shard
    this.name = options.name
    this.maxHp = options.hp
    this.hp = options.hp
    this.position = (options.position || new THREE.Vector3()).clone()
    this.radius = options.radius ?? 2.4
    this.height = options.height ?? 5
    this.color = options.color
    this.group = options.group
    this.group.position.copy(this.position)
    this.visual = options.visual ?? this.group
    this.dead = false
    this.dying = 0
    this.flash = 0
    this.immune = false
    this.time = 0
    this.attackTimer = options.attackTimer ?? 2.5
    this.phase = 1
    this.updateLogic = null
    this.parts = {}
    scene.add(this.group)
  }

  takeDamage(amount, opts = {}) {
    if (this.dead) return 0
    const result = this.shard.filterBossDamage?.(this, amount, opts) ?? { amount }
    if (result.immune) {
      this.shard.effects.burst(this.position.clone().add(new THREE.Vector3(0, 2, 0)), 0x9aa9b5, 8, 2.4, 0.5, 0.22)
      this.shard.game.audio?.hit?.()
      return 0
    }
    const dealt = Math.max(1, Math.round(result.amount ?? amount))
    this.hp = Math.max(0, this.hp - dealt)
    this.flash = 0.14
    this.shard.effects.burst(this.position.clone().add(new THREE.Vector3(0, 2.2, 0)), result.crit ? 0xffe19a : this.color, result.crit ? 26 : 15, result.crit ? 6 : 4, 0.65, result.crit ? 0.36 : 0.28, 0.7)
    this.shard.game.ui?.updateBoss?.(this.hp, this.maxHp)
    this.shard.game.ui?.damageFlash?.()
    if (result.recoil && opts.player) {
      opts.player.takeDamage(result.recoil, { world: this.shard, effects: this.shard.effects, audio: this.shard.audio, ui: this.shard.ui })
    }
    if (this.hp <= 0) this.die()
    return dealt
  }

  die() {
    if (this.dead) return
    this.dead = true
    this.dying = 2.4
    this.shard.effects.burst(this.position.clone().add(new THREE.Vector3(0, 2.5, 0)), this.color, 80, 9, 2.2, 0.55, 0.4)
    this.shard.effects.shockwave(this.position, this.color, 9, 1.2)
    const burst = this.position.clone()
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.shard.effects.burst(burst.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 1 + Math.random() * 4, (Math.random() - 0.5) * 6)), this.color, 18, 5, 1.1, 0.4, 0.3)
      }, i * 160)
    }
    this.shard.game.audio?.death?.()
    this.shard.game.audio?.victory?.()
    this.shard.game.shakeCamera(0.8)
    this.shard.onBossDefeated?.()
  }

  update(dt, ctx) {
    this.time += dt
    this.flash = Math.max(0, this.flash - dt)
    if (this.dead) {
      this.dying -= dt
      const t = clamp(this.dying / 2.4, 0, 1)
      this.group.rotation.y += dt * 0.35
      this.group.scale.setScalar(Math.max(0.001, 0.4 + t * 0.6))
      this.group.position.y = this.position.y + (1 - t) * 8
      if (this.visual.materials) {
        for (const material of this.visual.materials) {
          if ('opacity' in material) material.opacity = Math.max(0, t)
        }
      }
      if (this.dying <= 0) this.group.visible = false
      return
    }
    if (this.flash > 0) {
      this.group.scale.setScalar(1 + this.flash * 0.8)
    } else if (!this.customScale) {
      this.group.scale.setScalar(1)
    }
    this.updateLogic?.(dt, ctx)
  }
}
