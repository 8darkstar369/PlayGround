import * as THREE from 'three'
import { softDotTexture } from './gfx.js'

export class Effects {
  constructor(scene) {
    this.scene = scene
    this.max = 460
    this.cursor = 0
    this.particles = Array.from({ length: this.max }, () => ({
      life: 0,
      maxLife: 1,
      vel: new THREE.Vector3(),
      gravity: 0,
      drag: 1
    }))
    const positions = new Float32Array(this.max * 3)
    const colors = new Float32Array(this.max * 3)
    const sizes = new Float32Array(this.max)
    for (let i = 0; i < this.max; i++) positions[i * 3 + 1] = -999
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    this.geometry = geometry
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uMap: { value: softDotTexture() },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 aColor;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = size * uPixelRatio * (260.0 / max(0.1, -mv.z));
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vColor, tex.a);
        }
      `,
    })
    this.points = new THREE.Points(geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 6
    scene.add(this.points)
    this.meshEffects = []
    this.color = new THREE.Color()
  }

  burst(position, color, count = 14, speed = 4.5, life = 0.65, size = 0.3, gravity = 0) {
    const pos = this.geometry.attributes.position
    const col = this.geometry.attributes.aColor
    const sizes = this.geometry.attributes.size
    const base = new THREE.Color(color)
    for (let n = 0; n < count; n++) {
      const index = this.cursor
      this.cursor = (this.cursor + 1) % this.max
      const p = this.particles[index]
      p.life = life * (0.6 + Math.random() * 0.7)
      p.maxLife = p.life
      p.gravity = gravity
      p.drag = 0.94 + Math.random() * 0.03
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const magnitude = speed * (0.25 + Math.random() * 0.9)
      p.vel.set(
        Math.sin(phi) * Math.cos(theta) * magnitude,
        Math.cos(phi) * magnitude * 0.8 + speed * 0.15,
        Math.sin(phi) * Math.sin(theta) * magnitude
      )
      pos.setXYZ(index, position.x + (Math.random() - 0.5) * 0.2, position.y + (Math.random() - 0.5) * 0.2, position.z + (Math.random() - 0.5) * 0.2)
      const tint = base.clone().offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.15)
      col.setXYZ(index, tint.r, tint.g, tint.b)
      sizes.setX(index, size * (0.4 + Math.random() * 1.1))
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    sizes.needsUpdate = true
  }

  trail(position, color, count = 2, spread = 0.25) {
    const pos = this.geometry.attributes.position
    const col = this.geometry.attributes.aColor
    const sizes = this.geometry.attributes.size
    const base = new THREE.Color(color)
    for (let n = 0; n < count; n++) {
      const index = this.cursor
      this.cursor = (this.cursor + 1) % this.max
      const p = this.particles[index]
      p.life = 0.4 + Math.random() * 0.2
      p.maxLife = p.life
      p.gravity = 0.2
      p.drag = 0.9
      p.vel.set((Math.random() - 0.5) * 1.1, Math.random() * 0.8, (Math.random() - 0.5) * 1.1)
      pos.setXYZ(index, position.x + (Math.random() - 0.5) * spread, position.y + (Math.random() - 0.5) * spread, position.z + (Math.random() - 0.5) * spread)
      col.setXYZ(index, base.r, base.g, base.b)
      sizes.setX(index, 0.35 + Math.random() * 0.6)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    sizes.needsUpdate = true
  }

  shockwave(position, color = 0xffd27a, radius = 3, life = 0.55) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.copy(position)
    mesh.position.y = Math.max(0.04, position.y)
    this.scene.add(mesh)
    this.meshEffects.push({
      mesh,
      life,
      maxLife: life,
      update: (t, progress) => {
        const scale = 0.5 + progress * radius
        mesh.scale.set(scale, scale, scale)
        material.opacity = (1 - progress) * 0.85
        mesh.position.y += 0.002
      }
    })
  }

  telegraph(position, color = 0xff5a6a, radius = 2.5, duration = 1.1) {
    const group = new THREE.Group()
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 42), material)
    disc.rotation.x = -Math.PI / 2
    disc.position.y = 0.06
    group.add(disc)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.92, radius, 42), ringMaterial)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.07
    group.add(ring)
    group.position.copy(position)
    group.position.y = 0.02
    this.scene.add(group)
    this.meshEffects.push({
      mesh: group,
      life: duration,
      maxLife: duration,
      update: (t, progress) => {
        material.opacity = 0.12 + progress * 0.4
        ringMaterial.opacity = 0.35 + Math.sin(progress * Math.PI) * 0.6
        const pulse = 0.96 + Math.sin(progress * Math.PI * 8) * 0.04
        ring.scale.set(pulse, pulse, pulse)
      },
      onEnd: () => {
        this.scene.remove(group)
        material.dispose()
        ringMaterial.dispose()
      }
    })
    return group
  }

  slash(position, direction, color = 0xffe6a8, range = 3, life = 0.28) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const geometry = new THREE.RingGeometry(0.55, range, 22, 1, -Math.PI * 0.36, Math.PI * 0.72)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.rotation.z = Math.atan2(direction.x, direction.z)
    mesh.position.copy(position)
    mesh.position.y = 0.9
    this.scene.add(mesh)
    this.meshEffects.push({
      mesh,
      life,
      maxLife: life,
      update: (t, progress) => {
        material.opacity = (1 - progress) * 0.9
        mesh.position.y = 0.9 + progress * 1.1
        const scale = 0.72 + progress * 0.4
        mesh.scale.set(scale, scale, scale)
      },
      onEnd: () => {
        this.scene.remove(mesh)
        geometry.dispose()
        material.dispose()
      }
    })
  }

  markerPulse(position, color = 0xe8c987) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.8, 36), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.copy(position)
    mesh.position.y = 0.08
    this.scene.add(mesh)
    this.meshEffects.push({
      mesh,
      life: 1.1,
      maxLife: 1.1,
      update: (t, progress) => {
        const scale = 1 + progress * 2.2
        mesh.scale.set(scale, scale, scale)
        material.opacity = (1 - progress) * 0.7
      },
      onEnd: () => {
        this.scene.remove(mesh)
        material.dispose()
      }
    })
  }

  update(dt) {
    const pos = this.geometry.attributes.position
    const col = this.geometry.attributes.aColor
    for (let i = 0; i < this.max; i++) {
      const p = this.particles[i]
      if (p.life <= 0) continue
      p.life -= dt
      if (p.life <= 0) {
        pos.setY(i, -999)
        continue
      }
      const velocity = p.vel
      velocity.multiplyScalar(Math.pow(p.drag, dt * 60))
      velocity.y -= p.gravity * dt
      pos.setXYZ(
        i,
        pos.getX(i) + velocity.x * dt,
        pos.getY(i) + velocity.y * dt,
        pos.getZ(i) + velocity.z * dt
      )
      const alpha = Math.max(0, p.life / p.maxLife)
      const c = this.color.setRGB(col.getX(i), col.getY(i), col.getZ(i))
      col.setXYZ(i, c.r * alpha, c.g * alpha, c.b * alpha)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    for (let i = this.meshEffects.length - 1; i >= 0; i--) {
      const effect = this.meshEffects[i]
      effect.life -= dt
      const progress = 1 - Math.max(0, effect.life / effect.maxLife)
      effect.update?.(dt, progress)
      if (effect.life <= 0) {
        if (!effect.onEnd) {
          this.scene.remove(effect.mesh)
          effect.mesh.traverse?.(child => {
            child.geometry?.dispose?.()
            child.material?.dispose?.()
          })
          effect.mesh.geometry?.dispose?.()
          effect.mesh.material?.dispose?.()
        } else {
          effect.onEnd()
        }
        this.meshEffects.splice(i, 1)
      }
    }
  }
}
