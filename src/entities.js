import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { radialGlow } from './textures.js'

const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })

export function addContactShadow(parent, width = 2, length = 4, opacity = 0.24) {
  const mat = shadowMat.clone()
  mat.opacity = opacity
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 20), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.scale.set(width, length, 1)
  mesh.position.y = 0.025
  mesh.renderOrder = 1
  parent.add(mesh)
  return mesh
}

function transformed(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const matrix = new THREE.Matrix4()
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz))
  matrix.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1))
  geo.applyMatrix4(matrix)
  return geo
}

function mergedMesh(geos, material, shadows = true) {
  const normalized = geos.map(g => g.index ? g.toNonIndexed() : g)
  const merged = mergeGeometries(normalized, false)
  geos.forEach(g => g.dispose())
  if (!merged) throw new Error('geometry merge failed')
  const mesh = new THREE.Mesh(merged, material)
  mesh.castShadow = shadows
  mesh.receiveShadow = shadows
  return mesh
}

const wheelGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.32, 12)
const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x101113, roughness: 0.82 })
const hubGeometry = new THREE.CylinderGeometry(0.17, 0.17, 0.34, 8)
const hubMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c1c5, roughness: 0.32, metalness: 0.85 })

export function createCar({ color = 0xff4b3e, type = 'sport', police = false } = {}) {
  const group = new THREE.Group()
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.58 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x111417, roughness: 0.5, metalness: 0.4 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x10232e, roughness: 0.06, metalness: 0.9, transparent: true, opacity: 0.88 })
  const head = new THREE.MeshStandardMaterial({ color: 0xfff1c7, emissive: 0xffd080, emissiveIntensity: 2.5, roughness: 0.2 })
  const tail = new THREE.MeshStandardMaterial({ color: 0xff1d1d, emissive: 0xff1200, emissiveIntensity: 2, roughness: 0.3 })

  const long = type === 'van' ? 5.2 : type === 'sport' ? 4.3 : 4.6
  const width = type === 'van' ? 2.15 : type === 'sport' ? 1.92 : 1.98
  const height = type === 'van' ? 1.9 : 1.25
  const bodyY = 0.55 + height * 0.27
  const paintGeos = []

  paintGeos.push(transformed(new RoundedBoxGeometry(width, height * 0.55, long, 2, 0.15), 0, bodyY, 0))
  paintGeos.push(transformed(new RoundedBoxGeometry(width * 0.92, 0.24, long * 0.34, 2, 0.06), 0, 0.79 + height * 0.27, long * 0.27))

  const cabLength = type === 'van' ? long * 0.5 : long * 0.42
  const cabHeight = type === 'van' ? 1.1 : 0.66
  const cabinY = bodyY + height * 0.27 + cabHeight * 0.33
  const cabinZ = type === 'van' ? -long * 0.04 : -long * 0.11
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(width * 0.87, cabHeight, cabLength, 2, 0.1), glass)
  cabin.position.set(0, cabinY, cabinZ)
  cabin.castShadow = false
  group.add(cabin)
  paintGeos.push(transformed(new RoundedBoxGeometry(width * 0.8, 0.12, cabLength * 0.9, 2, 0.04), 0, cabinY + cabHeight * 0.53, cabinZ))

  if (type === 'sport') {
    paintGeos.push(transformed(new THREE.BoxGeometry(width * 0.8, 0.08, 0.34), 0, 1.1, -long * 0.47))
  }
  group.add(mergedMesh(paintGeos, paint))

  const wheels = []
  const frontZ = long * 0.29
  const backZ = -long * 0.29
  for (const [wx, wz] of [[-width / 2 + 0.04, frontZ], [width / 2 - 0.04, frontZ], [-width / 2 + 0.04, backZ], [width / 2 - 0.04, backZ]]) {
    const pivot = new THREE.Group()
    pivot.position.set(wx, 0.45, wz)
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
    wheel.rotation.z = Math.PI / 2
    wheel.castShadow = false
    pivot.add(wheel)
    group.add(pivot)
    wheels.push(pivot)
  }

  const headGeos = []
  const tailGeos = []
  const lampGeo = new THREE.BoxGeometry(0.5, 0.18, 0.08)
  for (const side of [-1, 1]) {
    headGeos.push(transformed(lampGeo.clone(), side * width * 0.31, 0.72, long / 2 + 0.01))
    tailGeos.push(transformed(lampGeo.clone(), side * width * 0.33, 0.72, -long / 2 - 0.01))
  }
  group.add(mergedMesh(headGeos, head, false))
  group.add(mergedMesh(tailGeos, tail, false))

  const bumperGeos = [
    transformed(new THREE.BoxGeometry(width * 0.86, 0.12, 0.16), 0, 0.48, long / 2 + 0.06),
    transformed(new THREE.BoxGeometry(width * 0.86, 0.12, 0.16), 0, 0.48, -long / 2 - 0.06)
  ]
  group.add(mergedMesh(bumperGeos, dark, false))

  if (police) {
    const bar = new THREE.Group()
    bar.position.set(0, cabinY + cabHeight * 0.65, cabinZ)
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.13, 0.24), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 4 }))
    red.position.x = -0.3
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.13, 0.24), new THREE.MeshStandardMaterial({ color: 0x2060ff, emissive: 0x0044ff, emissiveIntensity: 4 }))
    blue.position.x = 0.3
    bar.add(red, blue)
    group.add(bar)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(width + 0.015, 0.34, 1.8), new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: 0.4 }))
    stripe.position.set(0, 0.93, -0.1)
    group.add(stripe)
  }

  addContactShadow(group, width * 0.72, long * 0.62, 0.26)
  group.userData.wheels = wheels
  group.userData.type = type
  group.userData.color = color
  return group
}

export function setCarColor(car, color) {
  car.traverse(obj => {
    if (obj.isMesh && obj.material?.metalness === 0.55 && obj.material.color) obj.material.color.set(color)
  })
}

export function createCharacter({ skin = 0xb97852, shirt = 0xf4f0df, pants = 0x1e2939, shoes = 0xf2eee4, hair = 0x17120f, accent = 0xffc84a } = {}) {
  const group = new THREE.Group()
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.82 })
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.88 })
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 })
  const shoeMat = new THREE.MeshStandardMaterial({ color: shoes, roughness: 0.72 })
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.92 })

  const hips = new THREE.Group()
  hips.position.y = 0.84
  group.add(hips)

  const torso = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.7, 0.34, 2, 0.1), shirtMat)
  torso.position.y = 0.35
  torso.castShadow = true
  hips.add(torso)

  const jacket = new THREE.Mesh(new RoundedBoxGeometry(0.63, 0.32, 0.37, 2, 0.08), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.78 }))
  jacket.position.y = 0.47
  hips.add(jacket)

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 8), skinMat)
  neck.position.y = 0.75
  hips.add(neck)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), skinMat)
  head.position.y = 0.97
  head.scale.set(0.94, 1.08, 0.98)
  head.castShadow = true
  hips.add(head)

  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat)
  hairMesh.position.y = 1.02
  hairMesh.rotation.x = -0.12
  hips.add(hairMesh)

  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.08), new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.15, metalness: 0.6 }))
  glasses.position.set(0, 1, 0.19)
  hips.add(glasses)

  const arms = []
  const legs = []
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.38, 0.58, 0)
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.46, 4, 8), skinMat)
    arm.position.y = -0.27
    arm.castShadow = true
    shoulder.add(arm)
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.2, 8), shirtMat)
    sleeve.position.y = -0.08
    shoulder.add(sleeve)
    hips.add(shoulder)
    arms.push(shoulder)

    const hip = new THREE.Group()
    hip.position.set(side * 0.16, 0, 0)
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 4, 8), pantsMat)
    leg.position.y = -0.34
    leg.castShadow = true
    hip.add(leg)
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.14, 0.38, 2, 0.05), shoeMat)
    shoe.position.set(0, -0.69, 0.06)
    hip.add(shoe)
    hips.add(hip)
    legs.push(hip)
  }

  group.userData.parts = { hips, torso, head, arms, legs }
  group.userData.phase = Math.random() * Math.PI * 2
  addContactShadow(group, 0.48, 0.42, 0.2)
  return group
}

export function animateCharacter(character, dt, speed, time) {
  const p = character.userData.parts
  character.userData.phase += dt * (2.2 + speed * 1.7)
  const phase = character.userData.phase
  const amount = Math.min(1, speed * 1.6)
  p.legs[0].rotation.x = Math.sin(phase) * 0.75 * amount
  p.legs[1].rotation.x = -Math.sin(phase) * 0.75 * amount
  p.arms[0].rotation.x = -Math.sin(phase) * 0.62 * amount
  p.arms[1].rotation.x = Math.sin(phase) * 0.62 * amount
  p.arms[0].rotation.z = -0.06
  p.arms[1].rotation.z = 0.06
  p.hips.position.y = 0.84 + Math.abs(Math.sin(phase)) * 0.035 * amount
  p.hips.rotation.z = Math.sin(phase) * 0.035 * amount
  if (amount < 0.05) {
    p.hips.position.y = 0.84 + Math.sin(time * 2) * 0.008
    p.torso.rotation.z = Math.sin(time * 1.6) * 0.01
  }
  p.head.rotation.y = Math.sin(time * 0.6 + character.userData.phase * 0.02) * 0.14
}

export function createPalm(height = 6, lean = 0.22) {
  const group = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.6, height * 0.35, 0),
    new THREE.Vector3(lean * 1.2, height * 0.7, 0.05),
    new THREE.Vector3(lean * 1.5, height, 0)
  ])
  const top = curve.getPoint(1)
  const trunkGeos = [new THREE.TubeGeometry(curve, 8, 0.22, 6, false)]
  for (let i = 0; i < 3; i++) {
    trunkGeos.push(transformed(new THREE.SphereGeometry(0.13, 7, 5), top.x + Math.cos(i * 2.1) * 0.2, top.y - 0.08, top.z + Math.sin(i * 2.1) * 0.2))
  }
  const trunk = mergedMesh(trunkGeos, new THREE.MeshStandardMaterial({ color: 0x6e4d31, roughness: 1 }))
  group.add(trunk)

  const leafGeos = []
  for (let i = 0; i < 8; i++) {
    const segs = 5
    const positions = []
    const indices = []
    const length = 2.3 + Math.random() * 1.1
    for (let s = 0; s <= segs; s++) {
      const t = s / segs
      const w = Math.sin(t * Math.PI) * 0.22 + 0.02
      const droop = t * t * 1.15
      positions.push(-w, -droop, t * length, w, -droop, t * length)
      if (s < segs) {
        const a = s * 2
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.18
    transformed(geo, top.x, top.y, top.z, -0.15 + Math.random() * 0.32, angle, 0)
    leafGeos.push(geo)
  }
  const leaves = mergedMesh(leafGeos, new THREE.MeshStandardMaterial({ color: 0x3c733d, roughness: 0.9, side: THREE.DoubleSide }), false)
  group.add(leaves)
  group.userData.height = height
  return group
}

export function createStreetLamp() {
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.45, metalness: 0.7 })
  const poleGeos = [
    transformed(new THREE.CylinderGeometry(0.08, 0.12, 6.4, 7), 0, 3.2, 0),
    transformed(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 5), 0.5, 6.3, 0, 0, 0, Math.PI / 2)
  ]
  group.add(mergedMesh(poleGeos, metal, false))
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffe4b0, emissive: 0xffbe62, emissiveIntensity: 4 }))
  bulb.position.set(1.03, 6.2, 0)
  group.add(bulb)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlow('rgba(255,180,90,.8)'), color: 0xffbd76, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  glow.scale.set(2.4, 2.4, 1)
  glow.position.set(1.03, 6.15, 0)
  group.add(glow)
  return group
}

export function createTrafficLight() {
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.45, metalness: 0.7 })
  const metalGeos = [
    transformed(new THREE.CylinderGeometry(0.09, 0.13, 5.4, 7), 0, 2.7, 0),
    transformed(new THREE.BoxGeometry(0.36, 0.9, 0.32), 0, 5.3, 0.18)
  ]
  group.add(mergedMesh(metalGeos, metal, false))
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 6), new THREE.MeshStandardMaterial({ color: 0x401010, emissive: 0xff1a0a, emissiveIntensity: 0.2 }))
  red.position.set(0, 5.57, 0.36)
  const amber = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 6), new THREE.MeshStandardMaterial({ color: 0x3c2f0a, emissive: 0xffaa00, emissiveIntensity: 0.2 }))
  amber.position.set(0, 5.3, 0.36)
  const green = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 6), new THREE.MeshStandardMaterial({ color: 0x0b3316, emissive: 0x2bff70, emissiveIntensity: 2 }))
  green.position.set(0, 5.03, 0.36)
  group.add(red, amber, green)
  group.userData.lights = { red, amber, green }
  return group
}

export function createPedestrian(colors) {
  const group = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color: colors?.skin || 0xb97a55, roughness: 0.85 })
  const shirt = new THREE.MeshStandardMaterial({ color: colors?.shirt || 0x6e91a4, roughness: 0.9 })
  const pants = new THREE.MeshStandardMaterial({ color: colors?.pants || 0x2b3440, roughness: 0.9 })
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 6), shirt)
  body.position.y = 1.12
  group.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 7), skin)
  head.position.y = 1.63
  group.add(head)
  const legs = []
  for (const side of [-1, 1]) {
    const hip = new THREE.Group()
    hip.position.set(side * 0.12, 0.82, 0)
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 3, 5), pants)
    leg.position.y = -0.4
    hip.add(leg)
    group.add(hip)
    legs.push(hip)
  }
  group.userData.legs = legs
  addContactShadow(group, 0.42, 0.34, 0.18)
  return group
}

export function createMissionMarker() {
  const group = new THREE.Group()
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffcf4a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.55, 40), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.08
  group.add(ring)
  const inner = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), new THREE.MeshBasicMaterial({ color: 0xffb72e, transparent: true, opacity: 0.15, depthWrite: false, blending: THREE.AdditiveBlending }))
  inner.rotation.x = -Math.PI / 2
  inner.position.y = 0.075
  group.add(inner)
  const beam = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialGlow('rgba(255,205,90,.8)'),
    color: 0xffc23d,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  }))
  beam.scale.set(5.2, 9.5, 1)
  beam.position.y = 4.4
  group.add(beam)
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: 0xffd35c, emissive: 0xffa000, emissiveIntensity: 2 }))
  marker.position.y = 2.8
  group.add(marker)
  group.userData.ring = ring
  group.userData.inner = inner
  group.userData.marker = marker
  group.userData.beam = beam
  return group
}

export function createCollectible() {
  const group = new THREE.Group()
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), new THREE.MeshStandardMaterial({ color: 0x5fffe2, emissive: 0x00c9ae, emissiveIntensity: 2.5, roughness: 0.1, metalness: 0.6 }))
  gem.position.y = 1.2
  group.add(gem)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.025, 6, 28), new THREE.MeshBasicMaterial({ color: 0x72fff0, transparent: true, opacity: 0.6 }))
  ring.position.y = 1.2
  ring.rotation.x = Math.PI / 2
  group.add(ring)
  group.userData.gem = gem
  group.userData.ring = ring
  return group
}
