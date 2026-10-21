import * as THREE from 'three'
import { glowSprite } from './gfx.js'

export class Projectiles {
  constructor(scene) {
    this.scene = scene
    this.active = []
    this.geometry = new THREE.SphereGeometry(0.19, 10, 8)
  }

  spawn(from, direction, options = {}) {
    const color = options.color ?? 0xff9a6b
    const material = new THREE.MeshBasicMaterial({ color })
    const mesh = new THREE.Mesh(this.geometry, material)
    const glow = glowSprite(color, 1.5, 0.75)
    mesh.add(glow)
    mesh.position.copy(from)
    this.scene.add(mesh)
    const projectile = {
      mesh,
      material,
      velocity: direction.clone().normalize().multiplyScalar(options.speed ?? 10),
      damage: options.damage ?? 10,
      radius: options.radius ?? 0.22,
      life: options.life ?? 3,
      owner: options.owner ?? 'enemy',
      gravity: options.gravity ?? 0
    }
    this.active.push(projectile)
    return projectile
  }

  update(dt, { player, world, effects, audio, ui }) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const projectile = this.active[i]
      projectile.life -= dt
      projectile.velocity.y -= projectile.gravity * dt
      projectile.mesh.position.addScaledVector(projectile.velocity, dt)
      projectile.mesh.rotation.y += dt * 4
      effects?.trail?.(projectile.mesh.position, projectile.material.color.getHex(), 1, 0.1)
      let remove = projectile.life <= 0
      if (projectile.mesh.position.y < 0.05) {
        effects?.burst(projectile.mesh.position, projectile.material.color.getHex(), 8, 2, 0.4, 0.2)
        remove = true
      }
      if (!remove && player.alive) {
        const dx = projectile.mesh.position.x - player.position.x
        const dy = projectile.mesh.position.y - (player.position.y + 1)
        const dz = projectile.mesh.position.z - player.position.z
        if (Math.hypot(dx, dy, dz) < projectile.radius + 0.7) {
          player.takeDamage(projectile.damage, { world, effects, audio, ui })
          effects?.burst(projectile.mesh.position, projectile.material.color.getHex(), 14, 3.4, 0.55, 0.24)
          remove = true
        }
      }
      if (remove) {
        this.scene.remove(projectile.mesh)
        projectile.material.dispose()
        projectile.mesh.children[0]?.material?.dispose?.()
        this.active.splice(i, 1)
      }
    }
  }

  clear() {
    for (const projectile of this.active) {
      this.scene.remove(projectile.mesh)
      projectile.material.dispose()
    }
    this.active.length = 0
  }
}
