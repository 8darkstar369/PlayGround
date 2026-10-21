import * as THREE from 'three'
import { mulberry32 } from '../logic.js'

const textureCache = new Map()
let glowTexture = null
let softTexture = null

function canvas2d(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return [canvas, canvas.getContext('2d')]
}

function hex(color) {
  return `#${new THREE.Color(color).getHexString()}`
}

export function stoneTexture({ base = '#39414a', accent = '#59625e', moss = '#243f2d', seed = 1, size = 512 } = {}) {
  const key = `stone-${base}-${accent}-${moss}-${seed}-${size}`
  if (textureCache.has(key)) return textureCache.get(key)
  const [canvas, ctx] = canvas2d(size, size)
  const random = mulberry32(seed)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 3200; i++) {
    const alpha = 0.02 + random() * 0.09
    ctx.fillStyle = random() > 0.5
      ? `rgba(255,255,255,${alpha})`
      : `rgba(0,0,0,${alpha * 1.4})`
    const r = 1 + random() * 9
    ctx.beginPath()
    ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 20; i++) {
    ctx.strokeStyle = `rgba(8,12,12,${0.24 + random() * 0.3})`
    ctx.lineWidth = 0.7 + random() * 1.6
    ctx.beginPath()
    let x = random() * size
    let y = random() * size
    ctx.moveTo(x, y)
    const segments = 3 + Math.floor(random() * 5)
    for (let s = 0; s < segments; s++) {
      x += (random() - 0.5) * 74
      y += random() * 46
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  for (let i = 0; i < 30; i++) {
    const x = random() * size
    const y = random() * size
    const r = 5 + random() * 36
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, `${moss}cc`)
    gradient.addColorStop(0.65, `${moss}55`)
    gradient.addColorStop(1, `${moss}00`)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = random() > 0.5 ? `${accent}55` : `rgba(0,0,0,0.16)`
    const x = random() * size
    const y = random() * size
    ctx.fillRect(x, y, 1 + random() * 3, 1 + random() * 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  textureCache.set(key, texture)
  return texture
}

export function groundTexture({ base = '#252b2a', moss = '#314a38', seed = 4, size = 512 } = {}) {
  const key = `ground-${base}-${moss}-${seed}-${size}`
  if (textureCache.has(key)) return textureCache.get(key)
  const [canvas, ctx] = canvas2d(size, size)
  const random = mulberry32(seed)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 2600; i++) {
    const shade = random()
    ctx.fillStyle = shade > 0.72
      ? `rgba(255,255,255,${random() * 0.05})`
      : `rgba(0,0,0,${random() * 0.13})`
    ctx.beginPath()
    ctx.arc(random() * size, random() * size, 1 + random() * 14, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 46; i++) {
    const x = random() * size
    const y = random() * size
    const r = 10 + random() * 60
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, `${moss}66`)
    gradient.addColorStop(1, `${moss}00`)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 800; i++) {
    ctx.strokeStyle = `rgba(190,205,185,${random() * 0.1})`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    const x = random() * size
    const y = random() * size
    ctx.moveTo(x, y)
    ctx.lineTo(x + (random() - 0.5) * 7, y - 3 - random() * 7)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  textureCache.set(key, texture)
  return texture
}

export function glowSprite(color = 0xffffff, scale = 1, opacity = 0.9) {
  if (!glowTexture) {
    const [canvas, ctx] = canvas2d(128, 128)
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.18, 'rgba(255,255,255,0.9)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.32)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
    glowTexture = new THREE.CanvasTexture(canvas)
  }
  const material = new THREE.SpriteMaterial({
    map: glowTexture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.setScalar(scale)
  return sprite
}

export function softDotTexture() {
  if (softTexture) return softTexture
  const [canvas, ctx] = canvas2d(64, 64)
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.65)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  softTexture = new THREE.CanvasTexture(canvas)
  return softTexture
}

export function makeSky({ top = 0x0a1530, horizon = 0x22415a, bottom = 0x070b14, glow = 0x78bcd8 } = {}) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uBottom: { value: new THREE.Color(bottom) },
      uGlow: { value: new THREE.Color(glow) }
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform vec3 uGlow;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        vec3 col = mix(uBottom, uHorizon, smoothstep(-0.28, 0.08, h));
        col = mix(col, uTop, smoothstep(0.05, 0.65, h));
        float band = exp(-pow((h - 0.015) * 7.0, 2.0));
        col += uGlow * band * 0.22;
        float horizon = atan(vWorld.z, vWorld.x);
        col += uGlow * 0.025 * (0.5 + 0.5 * sin(horizon * 3.0 + 1.7));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(210, 32, 18), material)
  mesh.renderOrder = -10
  return mesh
}

export function makeStars(count = 520, radius = 180, seed = 9, color = 0xbfe6ff) {
  const random = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const palette = new THREE.Color(color)
  for (let i = 0; i < count; i++) {
    const theta = random() * Math.PI * 2
    const phi = Math.acos(0.06 + random() * 0.94)
    const r = radius * (0.86 + random() * 0.2)
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r
    positions[i * 3 + 1] = Math.cos(phi) * r
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r
    const tint = palette.clone().lerp(new THREE.Color(0xffe6bb), random() * 0.5)
    colors[i * 3] = tint.r
    colors[i * 3 + 1] = tint.g
    colors[i * 3 + 2] = tint.b
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.PointsMaterial({
    size: 1.2,
    map: softDotTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    sizeAttenuation: true
  })
  const points = new THREE.Points(geometry, material)
  points.renderOrder = -8
  return points
}

export function makeMotes({ count = 160, color = 0x9fe8ff, radius = 36, height = 14, size = 0.34, seed = 3, opacity = 0.8 } = {}) {
  const random = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const speeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2
    const r = Math.sqrt(random()) * radius
    positions[i * 3] = Math.cos(a) * r
    positions[i * 3 + 1] = random() * height
    positions[i * 3 + 2] = Math.sin(a) * r
    speeds[i] = 0.15 + random() * 0.55
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    size,
    map: softDotTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  })
  const points = new THREE.Points(geometry, material)
  points.userData = { speeds, height, count, phase: random() * 10 }
  points.frustumCulled = false
  return points
}

export function updateMotes(points, dt, time) {
  const pos = points.geometry.attributes.position
  const { speeds, height } = points.userData
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) + speeds[i] * dt
    const drift = Math.sin(time * 0.35 + i * 1.7) * 0.0025
    pos.setX(i, pos.getX(i) + drift)
    pos.setZ(i, pos.getZ(i) + Math.cos(time * 0.28 + i) * 0.0016)
    if (y > height) y = 0.2
    pos.setY(i, y)
  }
  pos.needsUpdate = true
}

export function makePortalDisc(color = 0x8bd7ff, open = false) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpen: { value: open ? 1 : 0.08 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpen;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float a = atan(p.y, p.x);
        float edge = smoothstep(1.0, 0.82, r);
        float swirl = sin(a * 5.0 + uTime * 1.4 - r * 13.0) * 0.5 + 0.5;
        float swirl2 = sin(a * 3.0 - uTime * 0.8 + r * 18.0) * 0.5 + 0.5;
        float veins = pow(swirl * swirl2, 2.2);
        float core = smoothstep(0.65, 0.0, r);
        vec3 col = uColor * (veins * 1.05 + core * 0.4) * (0.5 + uOpen * 1.5);
        float alpha = edge * (0.18 + veins * 0.7) * (0.25 + uOpen * 0.85);
        gl_FragColor = vec4(col, alpha);
      }
    `
  })
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(2.25, 64), material)
  mesh.userData.portalMaterial = material
  return mesh
}

export function makeRuneRing({ radius = 2, color = 0xe8c987, thickness = 0.035, segments = 64, opacity = 0.8 } = {}) {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 6, segments), material)
  ring.rotation.x = Math.PI / 2
  group.add(ring)
  for (let i = 0; i < 8; i++) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.28), material)
    const angle = (i / 8) * Math.PI * 2
    mark.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    mark.rotation.y = -angle
    group.add(mark)
  }
  group.userData.material = material
  return group
}

export function makeBeam(color = 0x8bd7ff, height = 14, radius = 0.28, opacity = 0.28) {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  })
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.3, radius, height, 12, 1, true), material)
  beam.position.y = height / 2
  group.add(beam)
  const glow = glowSprite(color, 3.4, 0.5)
  glow.position.y = 0.9
  group.add(glow)
  return group
}

export function makeLightShaft(color = 0xffe7b0, radius = 2.4, height = 24, opacity = 0.05) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  })
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 18, 1, true), material)
  mesh.position.y = height / 2
  mesh.renderOrder = 2
  return mesh
}

export function makeFlame(color = 0xffb469, scale = 1) {
  const group = new THREE.Group()
  const outer = glowSprite(color, 1.9 * scale, 0.8)
  const inner = glowSprite(0xfff0c4, 0.8 * scale, 0.9)
  outer.position.y = 0.5 * scale
  inner.position.y = 0.4 * scale
  group.add(outer, inner)
  group.userData.outer = outer
  group.userData.inner = inner
  return group
}

export function makeRubbleStone(radius = 0.6, color = 0x3c4746, seed = 1) {
  const random = mulberry32(seed)
  const geometry = new THREE.DodecahedronGeometry(radius, 0)
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(
      i,
      position.getX(i) * (0.7 + random() * 0.6),
      position.getY(i) * (0.55 + random() * 0.7),
      position.getZ(i) * (0.7 + random() * 0.6)
    )
  }
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true })
  return new THREE.Mesh(geometry, material)
}

export function makeVineMaterial(color = 0x3d6b4b) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
}

export function makeHaloTexture() {
  return glowSprite
}

export function setTextureRepeat(texture, x, y) {
  const clone = texture.clone()
  clone.needsUpdate = true
  clone.repeat.set(x, y)
  clone.wrapS = THREE.RepeatWrapping
  clone.wrapT = THREE.RepeatWrapping
  return clone
}
