import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { asphaltTexture, sidewalkTexture, sandTexture, facadeTexture, shopTexture, billboardTexture, waterNormalTexture, radialGlow } from './textures.js'
import { createCar, createPalm, createStreetLamp, createTrafficLight, createPedestrian, createMissionMarker, createCollectible, addContactShadow, createCharacter, animateCharacter } from './entities.js'
import { ROOMS, PERSONAS } from './data/social.js'

export const ROADS = [-192, -128, -64, 0, 64, 128, 192]
export const BLOCK_CENTERS = [-160, -96, -32, 32, 96, 160]
export const ROAD_WIDTH = 14
export const CITY_EDGE = 230
export const PLAYER_START = new THREE.Vector3(12, 0.04, 26)

const BUILDING_STYLES = ['glass', 'glass', 'stucco', 'brick', 'deco', 'teal']
const BUILDING_TINTS = [0xffffff, 0xf6ead7, 0xe8d2bb, 0xd8e7e5, 0xf0d4ca, 0xdfe4d1]
const SHOP_NAMES = ['PALMS', 'TACO LOCO', 'VICE MOTEL', 'NEON LIQUOR', 'SUNSET 99', 'LA MARINA', 'LIQUOR', 'SURF SHACK', 'EL REY', 'MOTEL']
const NEON = ['#ff5d3a', '#ff3d9e', '#48f5e0', '#ffcb45', '#9d7bff', '#55ff89']

function cloneFacade(style, width, height) {
  const base = facadeBases[style]
  const t = base.clone()
  t.needsUpdate = true
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(Math.max(1, Math.round(width / 11)), Math.max(1, Math.round(height / 18)))
  return t
}

let facadeBases = {}
let textures = {}

function makeTextSprite(text, color = '#ffe07a') {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const x = c.getContext('2d')
  x.clearRect(0, 0, 512, 128)
  x.font = '900 66px Arial Black, sans-serif'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.shadowColor = color
  x.shadowBlur = 24
  x.fillStyle = color
  x.fillText(text, 256, 64)
  x.strokeStyle = 'rgba(10,12,16,.8)'
  x.lineWidth = 2
  x.strokeText(text, 256, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false })
  const s = new THREE.Sprite(mat)
  s.scale.set(8, 2, 1)
  return s
}

function merged(geos, material, shadows = true) {
  const normalized = geos.map(g => g.index ? g.toNonIndexed() : g)
  const geo = mergeGeometries(normalized, false)
  geos.forEach(g => g.dispose())
  if (!geo) throw new Error('geometry merge failed')
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = shadows
  mesh.receiveShadow = shadows
  return mesh
}

export function buildWorld(scene) {
  textures = {
    asphalt: asphaltTexture(),
    sidewalk: sidewalkTexture(),
    sand: sandTexture()
  }
  facadeBases = {}
  for (const key of ['glass', 'stucco', 'brick', 'deco', 'teal']) facadeBases[key] = facadeTexture(key)

  const world = {
    scene,
    colliders: [],
    parkedCars: [],
    trafficCars: [],
    peds: [],
    palms: [],
    lamps: [],
    trafficLights: [],
    collectibles: [],
    buildings: [],
    mapBuildings: [],
    pauses: [],
    markers: {},
    zones: [],
    venues: [],
    npcs: [],
    time: 0
  }

  scene.background = new THREE.Color(0x1e2d47)
  scene.fog = new THREE.FogExp2(0x8c7b86, 0.00165)

  addSky(scene, world)
  addLights(scene)
  addOcean(scene, world)
  addIsland(scene)
  addRoads(scene, world)
  addBlocks(scene, world)
  addBeach(scene, world)
  addPier(scene, world)
  addMountains(scene)
  addTraffic(scene, world)
  addPedestrians(scene, world)
  addCollectibles(scene, world)
  addMarkers(scene, world)
  addOuterProps(scene, world)
  addSocialCharacters(scene, world)
  mergeBuildingBodies(scene, world)

  world.zones = [
    { name: 'Ocean Drive', x: -160, z: 124, r: 88 },
    { name: 'Vice Beach', x: -215, z: 0, r: 100 },
    { name: 'Downtown', x: 96, z: -128, r: 110 },
    { name: 'Little Havana', x: -128, z: -64, r: 86 },
    { name: 'The Docks', x: 156, z: 146, r: 100 },
    { name: 'Starfish Island', x: 0, z: 96, r: 90 },
    { name: 'Neon Mile', x: 0, z: 0, r: 80 }
  ]

  return world
}

function mergeBuildingBodies(scene, world) {
  const byStyle = new Map()
  for (const group of world.buildings) {
    const collected = []
    group.traverse(obj => {
      if (obj.isMesh && obj.userData.mergeBuilding) collected.push(obj)
    })
    for (const mesh of collected) {
      const style = mesh.userData.mergeBuilding
      const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone())
      const mat = mesh.material
      const uv = geo.attributes.uv
      const rx = mat.map?.repeat?.x || 1
      const ry = mat.map?.repeat?.y || 1
      if (uv) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rx, uv.getY(i) * ry)
      const color = mat.color || new THREE.Color(0xffffff)
      const colors = new Float32Array(geo.attributes.position.count * 3)
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = color.r
        colors[i + 1] = color.g
        colors[i + 2] = color.b
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      mesh.updateWorldMatrix(true, false)
      geo.applyMatrix4(mesh.matrixWorld)
      if (!byStyle.has(style)) byStyle.set(style, [])
      byStyle.get(style).push(geo)
      mesh.parent.remove(mesh)
      mat.dispose()
    }
  }
  const glass = new THREE.MeshStandardMaterial({ map: facadeBases.glass, color: 0xffffff, vertexColors: true, roughness: 0.42, metalness: 0.32 })
  const stucco = new THREE.MeshStandardMaterial({ map: facadeBases.stucco, color: 0xffffff, vertexColors: true, roughness: 0.7, metalness: 0.04 })
  const brick = new THREE.MeshStandardMaterial({ map: facadeBases.brick, color: 0xffffff, vertexColors: true, roughness: 0.7, metalness: 0.04 })
  const deco = new THREE.MeshStandardMaterial({ map: facadeBases.deco, color: 0xffffff, vertexColors: true, roughness: 0.7, metalness: 0.04 })
  const teal = new THREE.MeshStandardMaterial({ map: facadeBases.teal, color: 0xffffff, vertexColors: true, roughness: 0.42, metalness: 0.3 })
  const mats = { glass, stucco, brick, deco, teal }
  for (const [style, geos] of byStyle) {
    const base = facadeBases[style]
    base.repeat.set(1, 1)
    const mergedGeo = mergeGeometries(geos, false)
    geos.forEach(g => g.dispose())
    const mesh = new THREE.Mesh(mergedGeo, mats[style])
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }
}

function addSky(scene, world) {
  const uniforms = {
    time: { value: 0 },
    sunDir: { value: new THREE.Vector3(-0.65, 0.24, -0.72).normalize() }
  }
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 sunDir;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.05; a *= 0.5; }
        return v;
      }
      void main() {
        vec3 d = normalize(vWorld);
        float h = clamp(d.y, -0.12, 1.0);
        vec3 horizon = vec3(1.0, 0.49, 0.32);
        vec3 mid = vec3(0.55, 0.36, 0.48);
        vec3 zenith = vec3(0.06, 0.16, 0.33);
        vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.22, h));
        col = mix(col, zenith, smoothstep(0.18, 0.85, h));
        float sun = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.66, 0.33) * pow(sun, 16.0) * 0.32;
        col += vec3(1.0, 0.86, 0.62) * pow(sun, 420.0) * 2.2;
        float bands = fbm(vec2(atan(d.z, d.x) * 2.0 + time * 0.006, d.y * 8.0 + 1.0));
        float cloud = smoothstep(0.52, 0.72, bands) * smoothstep(0.02, 0.2, h) * smoothstep(0.72, 0.36, h);
        col = mix(col, vec3(1.0, 0.62, 0.52), cloud * 0.44);
        col += vec3(0.32, 0.16, 0.2) * smoothstep(0.74, 0.98, bands) * smoothstep(0.36, 0.53, h) * 0.2;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 40, 24), mat)
  sky.frustumCulled = false
  scene.add(sky)
  world.sky = sky
  world.skyUniforms = uniforms

  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 240),
    new THREE.MeshBasicMaterial({ color: 0xff9d72, transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  )
  haze.position.set(-180, 65, -720)
  scene.add(haze)
}

function addLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe0c2, 0x343943, 1.85)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffc18a, 3.0)
  sun.position.set(-135, 130, -120)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 20
  sun.shadow.camera.far = 520
  sun.shadow.camera.left = -180
  sun.shadow.camera.right = 180
  sun.shadow.camera.top = 180
  sun.shadow.camera.bottom = -180
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.035
  scene.add(sun)
  scene.add(sun.target)
  const fill = new THREE.DirectionalLight(0x6b9bd6, 0.7)
  fill.position.set(130, 70, 150)
  scene.add(fill)
  const warm = new THREE.PointLight(0xff8048, 25, 120, 1.5)
  warm.position.set(-20, 36, -60)
  scene.add(warm)
}

function addOcean(scene, world) {
  const geo = new THREE.PlaneGeometry(2400, 2400, 100, 100)
  const uniforms = {
    time: { value: 0 },
    sunDir: { value: new THREE.Vector3(-0.65, 0.24, -0.72).normalize() }
  }
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms,
    vertexShader: `
      uniform float time;
      varying vec3 vWorld;
      varying vec2 vUv;
      void main() {
        vec3 p = position;
        float w1 = sin(p.x * 0.12 + time * 1.1) * 0.09;
        float w2 = sin(p.y * 0.16 - time * 0.8) * 0.06;
        float w3 = sin((p.x + p.y) * 0.08 + time * 1.4) * 0.05;
        p.z += w1 + w2 + w3;
        vUv = uv;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 sunDir;
      varying vec3 vWorld;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 n = normalize(vec3(
          sin(vWorld.x * 0.28 + time * 1.5) * 0.06 + sin(vWorld.z * 0.17 - time) * 0.04,
          1.0,
          cos(vWorld.z * 0.24 + time * 1.2) * 0.06
        ));
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, view), 0.0), 2.2);
        vec3 deep = vec3(0.025, 0.16, 0.23);
        vec3 sky = vec3(0.58, 0.49, 0.54);
        vec3 col = mix(deep, sky, clamp(fres * 1.1, 0.0, 0.8));
        vec3 r = reflect(-sunDir, n);
        float spec = pow(max(dot(r, view), 0.0), 110.0);
        col += vec3(1.0, 0.64, 0.3) * spec * 2.4;
        float glint = pow(max(dot(r, view), 0.0), 24.0) * 0.08;
        col += vec3(1.0, 0.72, 0.48) * glint;
        float ripple = smoothstep(0.82, 1.0, sin(vWorld.x * 0.8 + vWorld.z * 0.31 + time * 2.0) * 0.5 + 0.5);
        col += vec3(0.22, 0.37, 0.4) * ripple * 0.05;
        gl_FragColor = vec4(col, 0.97);
      }
    `
  })
  const water = new THREE.Mesh(geo, mat)
  water.rotation.x = -Math.PI / 2
  water.position.y = -0.55
  water.receiveShadow = true
  scene.add(water)
  world.water = water
  world.waterUniforms = uniforms

  const foamMat = new THREE.MeshBasicMaterial({ color: 0xcfeee9, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })
  for (let i = 0; i < 5; i++) {
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(500 - i * 24, 1.2 + i * 0.25), foamMat)
    foam.rotation.x = -Math.PI / 2
    foam.position.set(-2, -0.44 + i * 0.005, 0)
    foam.rotation.z = Math.PI / 2
    scene.add(foam)
  }
}

function islandShape(points) {
  const shape = new THREE.Shape()
  points.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z)
    else shape.lineTo(x, -z)
  })
  shape.closePath()
  const geo = new THREE.ShapeGeometry(shape, 20)
  geo.rotateX(-Math.PI / 2)
  return geo
}

function addIsland(scene) {
  const landGeo = islandShape([
    [-236, -280], [120, -282], [220, -236], [268, -130], [270, 132], [208, 262], [-95, 282], [-232, 238], [-266, 80], [-252, -120]
  ])
  const land = new THREE.Mesh(landGeo, new THREE.MeshStandardMaterial({ color: 0x9f9b89, roughness: 1 }))
  land.position.y = -0.03
  land.receiveShadow = true
  scene.add(land)

  const under = new THREE.Mesh(landGeo, new THREE.MeshStandardMaterial({ color: 0x8d7755, roughness: 1 }))
  under.position.y = -0.55
  scene.add(under)

  const lawnMat = new THREE.MeshStandardMaterial({ color: 0x6e844d, roughness: 1 })
  for (const [x, z, w, d] of [[-70, -31, 46, 14], [100, 31, 14, 46], [50, -180, 26, 26]]) {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lawnMat)
    lawn.rotation.x = -Math.PI / 2
    lawn.position.set(x, 0.01, z)
    lawn.receiveShadow = true
    scene.add(lawn)
  }
}

function addRoads(scene, world) {
  const asphalt = textures.asphalt.clone()
  asphalt.needsUpdate = true
  asphalt.repeat.set(2, 38)
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, color: 0x9a9a98, roughness: 0.92 })
  const half = CITY_EDGE + 16
  const vertical = []
  for (const x of ROADS) {
    const g = new THREE.PlaneGeometry(ROAD_WIDTH, half * 2)
    g.rotateX(-Math.PI / 2)
    g.translate(x, 0.015, 0)
    vertical.push(g)
  }
  const vmesh = merged(vertical, roadMat)
  vmesh.receiveShadow = true
  scene.add(vmesh)
  const asphalt2 = asphalt.clone()
  asphalt2.needsUpdate = true
  asphalt2.repeat.set(38, 2)
  const roadMat2 = new THREE.MeshStandardMaterial({ map: asphalt2, color: 0x9a9a98, roughness: 0.92 })
  const horizontal = []
  for (const z of ROADS) {
    const g = new THREE.PlaneGeometry(half * 2, ROAD_WIDTH)
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0.016, z)
    horizontal.push(g)
  }
  const hmesh = merged(horizontal, roadMat2)
  hmesh.receiveShadow = true
  scene.add(hmesh)

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf1dba1, transparent: true, opacity: 0.62 })
  const lineGeo = new THREE.BoxGeometry(0.14, 0.012, 2.4)
  const lines = []
  for (const x of ROADS) {
    for (let z = -CITY_EDGE; z <= CITY_EDGE; z += 8) {
      if (ROADS.some(r => Math.abs(z - r) < ROAD_WIDTH)) continue
      lines.push([x, 0.032, z, 0])
    }
  }
  for (const z of ROADS) {
    for (let x = -CITY_EDGE; x <= CITY_EDGE; x += 8) {
      if (ROADS.some(r => Math.abs(x - r) < ROAD_WIDTH)) continue
      lines.push([x, 0.033, z, Math.PI / 2])
    }
  }
  const inst = new THREE.InstancedMesh(lineGeo, lineMat, lines.length)
  const dummy = new THREE.Object3D()
  lines.forEach(([x, y, z, r], i) => {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, r, 0)
    dummy.updateMatrix()
    inst.setMatrixAt(i, dummy.matrix)
  })
  inst.instanceMatrix.needsUpdate = true
  scene.add(inst)

  const crossMat = new THREE.MeshBasicMaterial({ color: 0xe8e5da, transparent: true, opacity: 0.7 })
  const crossGeo = new THREE.BoxGeometry(3.2, 0.012, 0.46)
  const stripes = []
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      for (const side of [-1, 1]) {
        for (let i = -2; i <= 2; i++) {
          stripes.push([rx + side * (ROAD_WIDTH / 2 + 2.1), 0.035, rz + i * 1.15, 0])
          stripes.push([rx + i * 1.15, 0.035, rz + side * (ROAD_WIDTH / 2 + 2.1), Math.PI / 2])
        }
      }
    }
  }
  const crossInst = new THREE.InstancedMesh(crossGeo, crossMat, stripes.length)
  stripes.forEach(([x, y, z, r], i) => {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, r, 0)
    dummy.updateMatrix()
    crossInst.setMatrixAt(i, dummy.matrix)
  })
  crossInst.instanceMatrix.needsUpdate = true
  scene.add(crossInst)
}

function addBlocks(scene, world) {
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: textures.sidewalk, color: 0xeeeae1, roughness: 0.94 })
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xc9c1b4, roughness: 0.9 })
  const startBlock = { x: 32, z: 32 }
  const walkGeos = []
  const curbGeos = []

  for (const cx of BLOCK_CENTERS) {
    for (const cz of BLOCK_CENTERS) {
      const size = 50
      walkGeos.push(transformedGeo(new THREE.BoxGeometry(size, 0.09, size), cx, 0.005, cz))
      for (const side of [-1, 1]) {
        curbGeos.push(transformedGeo(new THREE.BoxGeometry(size + 0.5, 0.12, 0.5), cx, 0.02, cz + side * size / 2))
        curbGeos.push(transformedGeo(new THREE.BoxGeometry(0.5, 0.12, size + 0.5), cx + side * size / 2, 0.02, cz))
      }

      if (cx === -32 && cz === -32) {
        addPark(scene, world, cx, cz)
        continue
      }
      if (cx === 96 && cz === 96) {
        addParkingLot(scene, world, cx, cz)
        continue
      }
      if (cx === startBlock.x && cz === startBlock.z) {
        addStartPlaza(scene, world, cx, cz)
        continue
      }
      if ((cx === 96 && cz === -160) || (cx === 32 && cz === -128) || (cx === -32 && cz === -160) || (cx === 160 && cz === -96) || (cx === 96 && cz === -96)) {
        addLandmarkBlock(scene, world, cx, cz)
        continue
      }
      const venue = ROOMS.find((room) => room.venue && room.venue.block && room.venue.block[0] === cx && room.venue.block[1] === cz && !room.venue.existing)
      if (venue) {
        addVenueBlock(scene, world, venue)
        continue
      }
      addCityBlock(scene, world, cx, cz)
    }
  }
  const walkMesh = merged(walkGeos, sidewalkMat)
  walkMesh.castShadow = false
  scene.add(walkMesh)
  const curbMesh = merged(curbGeos, curbMat)
  curbMesh.castShadow = false
  scene.add(curbMesh)
}

function addVenueBlock(scene, world, room) {
  const venue = room.venue
  const spec = venue.building
  const building = makeBuilding(scene, world, spec.x, spec.z, spec.w, spec.d, spec.h, spec.style, spec.tint, {
    neon: spec.neon, landmark: spec.neon, skipShop: true
  })
  decorateVenue(scene, world, room, building, -spec.d / 2)
}

function decorateVenue(scene, world, room, building, faceZ) {
  const venue = room.venue
  const accent = room.accent || '#5ff5df'
  const accentColor = new THREE.Color(accent)
  const doorW = 2.8
  const doorH = 3.3
  const doorZ = faceZ - 0.06

  const frameMat = new THREE.MeshBasicMaterial({ color: accentColor, toneMapped: false })
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.7, 0.16, 0.18), frameMat)
  lintel.position.set(0, doorH + 0.1, doorZ)
  building.add(lintel)
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, doorH + 0.2, 0.18), frameMat)
    post.position.set(side * (doorW / 2 + 0.27), (doorH + 0.2) / 2, doorZ)
    building.add(post)
  }

  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(doorW, doorH),
    new THREE.MeshStandardMaterial({ color: 0x0b0d15, roughness: 0.35, metalness: 0.25, emissive: accentColor, emissiveIntensity: 0.5 })
  )
  door.position.set(0, doorH / 2, doorZ - 0.02)
  door.rotation.y = Math.PI
  building.add(door)

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(9, venue.building.w * 0.6), 1.5),
    new THREE.MeshBasicMaterial({ map: shopTexture(venue.building.sign, accent, 'ENTER'), toneMapped: false })
  )
  sign.position.set(0, doorH + 1.1, doorZ - 0.02)
  sign.rotation.y = Math.PI
  building.add(sign)

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 3.2),
    new THREE.MeshBasicMaterial({ map: radialGlow('rgba(255,255,255,.55)'), color: accentColor, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  )
  glow.position.set(0, doorH / 2, doorZ - 0.05)
  glow.rotation.y = Math.PI
  building.add(glow)

  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({ map: radialGlow('rgba(255,255,255,.5)'), color: accentColor, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  )
  pool.rotation.x = -Math.PI / 2
  pool.position.set(venue.door.x, 0.075, venue.door.z)
  scene.add(pool)

  const label = makeTextSprite(venue.building.sign, accent)
  label.scale.set(4.4, 1.1, 1)
  label.position.set(venue.door.x, 5.4, venue.door.z)
  scene.add(label)

  world.venues.push({
    id: room.id,
    name: room.name,
    accent,
    kind: room.kind,
    board: Boolean(room.board),
    door: new THREE.Vector3(venue.door.x, 0, venue.door.z),
    label
  })
}

function addSocialCharacters(scene, world) {
  const skins = [0xb97852, 0x8d5a3b, 0xd8a97c, 0x6f4530, 0xe0b48c]
  const hairs = [0x17120f, 0x3a2418, 0x6b4a2a, 0x111318, 0x8a5a2b]
  PERSONAS.forEach((persona, index) => {
    const character = createCharacter({
      skin: skins[index % skins.length],
      shirt: new THREE.Color(persona.color).getHex(),
      pants: 0x1d2434,
      shoes: 0xefe8da,
      hair: hairs[index % hairs.length],
      accent: 0xffffff
    })
    character.position.set(persona.street.x, 0.06, persona.street.z)
    character.rotation.y = persona.street.rot || 0
    scene.add(character)
    const label = makeTextSprite(persona.name.toUpperCase(), persona.color)
    label.scale.set(2.9, 0.72, 1)
    label.position.set(persona.street.x, 2.45, persona.street.z)
    scene.add(label)
    world.npcs.push({ id: persona.id, name: persona.name, role: persona.role, color: persona.color, persona, group: character, label })
  })
}

function transformedGeo(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz))
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)))
  return geo
}

function addLandmarkBlock(scene, world, cx, cz) {
  const towers = {
    '96,-160': [38, 34, 126, 'glass', 3, '#54ffe0'],
    '32,-128': [32, 30, 94, 'deco', 4, '#ff4c86'],
    '-32,-160': [30, 32, 78, 'glass', 0, '#ffc84a'],
    '160,-96': [34, 32, 108, 'teal', 2, '#ff7048'],
    '96,-96': [30, 30, 86, 'glass', 1, '#73b8ff']
  }
  const [w, d, h, style, tint, neon] = towers[`${cx},${cz}`] || [30, 30, 80, 'glass', 0, '#54ffe0']
  const tower = makeBuilding(scene, world, cx, cz, w, d, h, style, tint, { neon, landmark: neon, skipShop: true })
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.95 })
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), plazaMat)
  plaza.rotation.x = -Math.PI / 2
  plaza.position.set(cx, 0.056, cz)
  scene.add(plaza)
  for (const [ox, oz] of [[-19, -19], [19, -19], [-19, 19], [19, 19]]) addPalmAt(scene, world, cx + ox, cz + oz, 7 + Math.random() * 2, 0.2)
  addLampAt(scene, world, cx - 20, cz + 20, 0)
  addLampAt(scene, world, cx + 20, cz - 20, Math.PI)
}

function addStartPlaza(scene, world, cx, cz) {
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(33, 33), new THREE.MeshStandardMaterial({ color: 0x3c3d40, roughness: 0.9 }))
  lot.rotation.x = -Math.PI / 2
  lot.position.set(cx + 4, 0.055, cz - 3)
  lot.receiveShadow = true
  scene.add(lot)

  const diner = makeBuilding(scene, world, cx + 13, cz + 14, 19, 13, 9, 'deco', 0, {
    shop: 'EL REY', neon: '#ff4f87', signSide: -1, noRooftop: true
  })
  world.buildings.push(diner)
  const elRey = ROOMS.find((room) => room.id === 'el-rey')
  if (elRey) decorateVenue(scene, world, elRey, diner, -6.5)

  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 0.08, 1, 1), new THREE.MeshBasicMaterial({ color: 0xf0d15a }))
    p.rotation.x = -Math.PI / 2
    p.position.set(cx - 4 + i * 6.5, 0.061, cz - 3)
    scene.add(p)
  }
  addPalmAt(scene, world, cx - 12, cz - 8, 8.4, 0.18)
  addPalmAt(scene, world, cx - 13, cz + 11, 7.2, -0.2)
  addBench(scene, cx - 8, cz + 6, 0)

  const marker = createMissionMarker()
  marker.position.set(cx - 17, 0.06, cz - 10)
  marker.visible = false
  scene.add(marker)
  world.markers.missionStart = marker
  world.markers.missionStart.position.set(cx - 17, 0.06, cz - 10)
  world.missionStart = new THREE.Vector3(cx - 17, 0, cz - 10)

  addParkedCar(world, 4, 24, Math.PI, 0xff5b32, 'sport', 'starter')
  addParkedCar(world, -5, 58, 0, 0x3ba0d8, 'sedan')
  addParkedCar(world, 55, 70, Math.PI, 0xe6b745, 'taxi')
  addLampAt(scene, world, cx - 21, cz - 21, 0)
  addLampAt(scene, world, cx + 21, cz + 21, Math.PI)
}

function addCityBlock(scene, world, cx, cz) {
  const district = getDistrict(cx, cz)
  const isDowntown = district === 'downtown'
  const isWest = district === 'beach'
  const isIndustrial = district === 'docks'
  const lots = isDowntown ? [[-10, -10, 21, 20], [12, -10, 18, 20], [-11, 12, 20, 18], [12, 12, 18, 18]] : [[-9, -10, 19, 17], [11, -10, 17, 17], [-9, 11, 18, 16], [11, 11, 16, 16]]
  for (const [ox, oz, w, d] of lots) {
    if (Math.random() < (isWest ? 0.26 : 0.1)) continue
    let h
    if (isDowntown) h = 28 + Math.random() * 54
    else if (isIndustrial) h = 7 + Math.random() * 8
    else if (isWest) h = 6 + Math.random() * 12
    else h = 9 + Math.random() * 22
    if (Math.random() < 0.06) h = 2.5
    const style = isDowntown ? (Math.random() > 0.25 ? 'glass' : 'teal') : BUILDING_STYLES[Math.floor(Math.random() * BUILDING_STYLES.length)]
    const shop = !isDowntown && h < 25 && Math.random() > 0.35 ? SHOP_NAMES[Math.floor(Math.random() * SHOP_NAMES.length)] : null
    const neon = NEON[Math.floor(Math.random() * NEON.length)]
    makeBuilding(scene, world, cx + ox, cz + oz, w, d, h, style, Math.floor(Math.random() * 6), { shop, neon, signSide: Math.random() > 0.5 ? 1 : -1 })
  }

  if (isWest && Math.random() > 0.25) {
    for (let i = 0; i < 2; i++) addPalmAt(scene, world, cx - 16 + i * 9, cz + (i ? 17 : -18), 6.8 + Math.random() * 3, 0.16)
  }
  if (district === 'commercial' && Math.random() > 0.5) {
    addPalmAt(scene, world, cx - 19, cz + 18, 7.5, 0.2)
  }
  if (Math.random() > 0.72) addLampAt(scene, world, cx - 22, cz + 22, Math.random() > 0.5 ? 0 : Math.PI)
  if (Math.random() > 0.82) addLampAt(scene, world, cx + 22, cz - 22, Math.random() > 0.5 ? Math.PI : 0)
  if (isDowntown && Math.random() > 0.55) {
    addParkedCar(world, cx + 18, cz - 26, 0, [0x22262b, 0xd3d5d8, 0x8c1f28, 0x224f7a][Math.floor(Math.random() * 4)], 'sport')
  }
}

function getDistrict(cx, cz) {
  if (cx <= -96) return 'beach'
  if (cx >= 96 && cz >= 96) return 'docks'
  if (cx >= 32 && cz <= -32) return 'downtown'
  if (cz >= 96) return 'suburbs'
  return 'commercial'
}

function makeBuilding(scene, world, x, z, w, d, h, style, tint, options = {}) {
  const group = new THREE.Group()
  const baseColor = BUILDING_TINTS[tint % BUILDING_TINTS.length]
  const mat = new THREE.MeshStandardMaterial({ map: cloneFacade(style, w, h * 0.72), color: baseColor, roughness: style === 'glass' ? 0.42 : 0.7, metalness: style === 'glass' ? 0.32 : 0.04 })
  const lowerH = h > 52 ? h * 0.72 : h
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, lowerH, d), mat)
  body.position.y = lowerH / 2 + 0.06
  body.castShadow = true
  body.receiveShadow = true
  body.userData.mergeBuilding = style
  group.add(body)

  let topW = w
  let topD = d
  if (h > 52) {
    const upperH = h - lowerH
    topW = w * 0.7
    topD = d * 0.72
    const upperMat = new THREE.MeshStandardMaterial({ map: cloneFacade(style, topW, upperH), color: baseColor, roughness: style === 'glass' ? 0.36 : 0.7, metalness: style === 'glass' ? 0.38 : 0.04 })
    const upper = new THREE.Mesh(new THREE.BoxGeometry(topW, upperH, topD), upperMat)
    upper.position.y = lowerH + upperH / 2 + 0.06
    upper.castShadow = true
    upper.receiveShadow = true
    upper.userData.mergeBuilding = style
    group.add(upper)
  }

  const capMat = new THREE.MeshStandardMaterial({ color: style === 'glass' ? 0x536166 : 0x8b7765, roughness: 0.78 })
  const cap = new THREE.Mesh(new THREE.BoxGeometry(topW + 0.35, 0.55, topD + 0.35), capMat)
  cap.position.y = h + 0.2
  group.add(cap)

  if (options.landmark || (style === 'glass' && h > 68)) {
    const neonMat = new THREE.MeshBasicMaterial({ color: options.landmark || (h > 90 ? 0x55ffe0 : 0xff5a86), transparent: true, opacity: 0.85, toneMapped: false })
    for (const y of [h - 1.4, h - 4.2]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(topW + 0.5, 0.22, topD + 0.5), neonMat)
      band.position.y = y
      group.add(band)
    }
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.5, 0.25), new THREE.MeshStandardMaterial({ color: 0xc9d4d7, metalness: 0.9, roughness: 0.25 }))
    crown.position.y = h + 2.2
    group.add(crown)
  }

  if (!options.noRooftop && h > 12) {
    const acMat = new THREE.MeshStandardMaterial({ color: 0x7b8b8d, roughness: 0.65, metalness: 0.4 })
    for (let i = 0; i < 1; i++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 1.1), acMat)
      ac.position.set((Math.random() - 0.5) * topW * 0.5, h + 0.85, (Math.random() - 0.5) * topD * 0.5)
      group.add(ac)
    }
    if (h > 34 && Math.random() > 0.5) {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 4 + Math.random() * 5, 5), new THREE.MeshStandardMaterial({ color: 0x777c80, metalness: 0.8, roughness: 0.35 }))
      antenna.position.set(0, h + 2.8, 0)
      group.add(antenna)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff3c2f, emissive: 0xff1400, emissiveIntensity: 3 }))
      tip.position.y = h + 5.3
      group.add(tip)
    }
  }

  if (options.shop) {
    const front = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.65, 7), 1.4), new THREE.MeshBasicMaterial({ map: shopTexture(options.shop, options.neon || '#ff6b4a'), toneMapped: false }))
    front.position.set(0, 2.1, d / 2 + 0.07)
    group.add(front)
    const awning = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.75, 8), 0.12, 1.4), new THREE.MeshStandardMaterial({ color: options.neon || 0xff6b4a, roughness: 0.75 }))
    awning.position.set(0, 2.85, d / 2 + 0.6)
    awning.rotation.x = -0.14
    awning.castShadow = true
    group.add(awning)
    const windows = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.66, 1.6), new THREE.MeshStandardMaterial({ color: 0x112630, roughness: 0.08, metalness: 0.8, emissive: 0x2b6a7a, emissiveIntensity: 0.25 }))
    windows.position.set(0, 1.0, d / 2 + 0.08)
    group.add(windows)
  }

  if (!options.landmark && h > 24 && Math.random() > 0.82) {
    const bw = Math.min(topW * 0.78, 9)
    const billboard = new THREE.Mesh(new THREE.PlaneGeometry(bw, bw * 0.5), new THREE.MeshBasicMaterial({ map: billboardTexture(['VICE', 'SUNSET', 'NEON'], ['#ffcb45', '#ff4f9e', '#4fffe3'][Math.floor(Math.random() * 3)]), toneMapped: false }))
    billboard.position.set(0, h * 0.64, d / 2 + 0.1)
    group.add(billboard)
    const legs = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.3, 0.22, 0.2), new THREE.MeshStandardMaterial({ color: 0x2b2e33 }))
    legs.position.set(0, h * 0.64 - bw * 0.25 - 0.1, d / 2 + 0.1)
    group.add(legs)
  }

  group.position.set(x, 0, z)
  scene.add(group)
  world.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h })
  world.mapBuildings.push({ x, z, w, d, h })
  world.buildings.push(group)
  return group
}

function addPark(scene, world, cx, cz) {
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), new THREE.MeshStandardMaterial({ color: 0x5e7c43, roughness: 1 }))
  lawn.rotation.x = -Math.PI / 2
  lawn.position.set(cx, 0.055, cz)
  lawn.receiveShadow = true
  scene.add(lawn)
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xc6b392, roughness: 1 })
  const path1 = new THREE.Mesh(new THREE.PlaneGeometry(42, 4), pathMat)
  path1.rotation.x = -Math.PI / 2
  path1.position.set(cx, 0.062, cz)
  scene.add(path1)
  const path2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 42), pathMat)
  path2.rotation.x = -Math.PI / 2
  path2.position.set(cx, 0.063, cz)
  scene.add(path2)
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 0.6, 24), new THREE.MeshStandardMaterial({ color: 0xc8bda7, roughness: 0.7 }))
  fountain.position.set(cx, 0.34, cz)
  fountain.castShadow = true
  scene.add(fountain)
  const water = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.14, 24), new THREE.MeshStandardMaterial({ color: 0x2b7988, roughness: 0.1, metalness: 0.4 }))
  water.position.set(cx, 0.67, cz)
  scene.add(water)
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 2.4, 12), new THREE.MeshStandardMaterial({ color: 0xc8bda7 }))
  column.position.set(cx, 1.6, cz)
  scene.add(column)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    addPalmAt(scene, world, cx + Math.cos(a) * 16, cz + Math.sin(a) * 16, 6 + Math.random() * 3, 0.2)
  }
  for (let i = 0; i < 4; i++) {
    addBench(scene, cx + (i < 2 ? -8 : 8), cz + (i % 2 ? 8 : -8), i < 2 ? Math.PI / 2 : -Math.PI / 2)
  }
}

function addParkingLot(scene, world, cx, cz) {
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x37393d, roughness: 1 }))
  lot.rotation.x = -Math.PI / 2
  lot.position.set(cx, 0.058, cz)
  scene.add(lot)
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd9d7c7, transparent: true, opacity: 0.6 })
  for (let i = -2; i <= 2; i++) {
    for (const x of [-13, -7, 0, 7, 13]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 5), lineMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(cx + x, 0.062, cz + i * 7)
      scene.add(line)
    }
  }
  const colors = [0xd8483d, 0x2a6a9d, 0xd0b14c, 0xe8e4dd, 0x27312e]
  for (let i = 0; i < 5; i++) {
    addParkedCar(world, cx - 11 + i * 5.5, cz - 3, i % 2 ? 0 : Math.PI, colors[i], 'sedan')
  }
  addPalmAt(scene, world, cx - 18, cz + 18, 7.8, 0.22)
}

function addBeach(scene, world) {
  const sand = textures.sand.clone()
  sand.needsUpdate = true
  sand.repeat.set(14, 56)
  const beachMat = new THREE.MeshStandardMaterial({ map: sand, color: 0xffdfaa, roughness: 1 })
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(74, 470), beachMat)
  beach.rotation.x = -Math.PI / 2
  beach.rotation.z = -0.045
  beach.position.set(-234, 0.02, 0)
  beach.receiveShadow = true
  scene.add(beach)

  for (let i = 0; i < 16; i++) {
    const z = -210 + i * 28 + Math.random() * 8
    addPalmAt(scene, world, -208 - Math.random() * 19, z, 6.5 + Math.random() * 4.5, 0.18 + Math.random() * 0.2)
  }

  const towelColors = [0xff4b64, 0x4fe0d0, 0xffd34b, 0x9c7bff]
  for (let i = 0; i < 14; i++) {
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.8), new THREE.MeshStandardMaterial({ color: towelColors[i % towelColors.length], roughness: 0.9, side: THREE.DoubleSide }))
    towel.rotation.x = -Math.PI / 2
    towel.rotation.z = Math.random() * Math.PI
    towel.position.set(-245 + Math.random() * 37, 0.035, -180 + i * 26 + Math.random() * 12)
    scene.add(towel)
    if (i % 3 === 0) {
      const umbrella = new THREE.Group()
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0xe6dfce }))
      pole.position.y = 1.2
      umbrella.add(pole)
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.55, 12), new THREE.MeshStandardMaterial({ color: towelColors[(i + 1) % towelColors.length], roughness: 0.8, side: THREE.DoubleSide }))
      canopy.position.y = 2.35
      umbrella.add(canopy)
      umbrella.position.copy(towel.position)
      umbrella.position.y = 0.04
      scene.add(umbrella)
    }
  }

  for (const z of [-150, -30, 98, 190]) {
    const tower = new THREE.Group()
    const postMat = new THREE.MeshStandardMaterial({ color: 0xd7b664, roughness: 0.85 })
    for (const x of [-1.4, 1.4]) for (const zz of [-1.4, 1.4]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.1, 0.18), postMat)
      p.position.set(x, 1.55, zz)
      tower.add(p)
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 3.4), postMat)
    deck.position.y = 3.1
    tower.add(deck)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.05, 4), new THREE.MeshStandardMaterial({ color: 0xf0e1bb, roughness: 0.8 }))
    roof.position.y = 4.2
    roof.rotation.y = Math.PI / 4
    tower.add(roof)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), new THREE.MeshStandardMaterial({ color: 0x133544, roughness: 0.08, metalness: 0.8 }))
    glass.position.set(0, 2.3, 1.46)
    tower.add(glass)
    tower.position.set(-226, 0.08, z)
    scene.add(tower)
  }
  world.zones.push({ name: 'Vice Beach', x: -235, z: 0, r: 110 })
}

function addPier(scene, world) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x8c6343, roughness: 0.88 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x543b2b, roughness: 1 })
  const deck = new THREE.Mesh(new THREE.BoxGeometry(128, 0.3, 16), wood)
  deck.position.set(-298, 0.15, 90)
  deck.castShadow = true
  deck.receiveShadow = true
  scene.add(deck)
  for (let i = 0; i < 18; i++) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 5.4, 6), dark)
      post.position.set(-240 - i * 7, -2.1, 90 + side * 7.2)
      scene.add(post)
    }
  }
  for (let i = 0; i < 10; i++) {
    const lamp = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.4, 6), new THREE.MeshStandardMaterial({ color: 0x292e31, metalness: 0.6, roughness: 0.5 }))
    pole.position.y = 1.7
    lamp.add(pole)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffbe63, emissiveIntensity: 3.5 }))
    bulb.position.y = 3.4
    lamp.add(bulb)
    lamp.position.set(-244 - i * 12, 0.3, 90 + (i % 2 ? 7 : -7))
    scene.add(lamp)
  }

  const wheel = new THREE.Group()
  const neon = new THREE.MeshStandardMaterial({ color: 0xff4e8d, emissive: 0xff2c77, emissiveIntensity: 2.6, roughness: 0.35 })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 0.28, 8, 48), neon)
  wheel.add(ring)
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2, 12), new THREE.MeshStandardMaterial({ color: 0x555c61, metalness: 0.8, roughness: 0.3 }))
  hub.rotation.x = Math.PI / 2
  wheel.add(hub)
  for (let i = 0; i < 12; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.14, 26, 0.14), new THREE.MeshStandardMaterial({ color: 0xb7c3c3, metalness: 0.7, roughness: 0.4 }))
    spoke.rotation.z = (i / 12) * Math.PI * 2
    wheel.add(spoke)
    const pod = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 1.1), i % 2 ? neon : new THREE.MeshStandardMaterial({ color: 0x264d66, emissive: 0x1a8aa5, emissiveIntensity: 1 }))
    const a = (i / 12) * Math.PI * 2
    pod.position.set(Math.cos(a) * 14, Math.sin(a) * 14, 0)
    pod.rotation.z = a
    wheel.add(pod)
  }
  wheel.position.set(-324, 16, 90)
  wheel.rotation.y = Math.PI / 2
  scene.add(wheel)
  world.ferrisWheel = wheel

  const base = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x3a3c40 }))
  base.position.set(-324, 0.8, 90)
  scene.add(base)
  const supportL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 16, 0.6), new THREE.MeshStandardMaterial({ color: 0xbec6c7, metalness: 0.8, roughness: 0.3 }))
  supportL.position.set(-324, 8, 90)
  supportL.rotation.z = 0.5
  scene.add(supportL)
  const supportR = supportL.clone()
  supportR.rotation.z = -0.5
  scene.add(supportR)

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 2.2), new THREE.MeshBasicMaterial({ map: shopTexture('PIER 99', '#ff4f9b', 'SUNSET RIDES'), toneMapped: false }))
  sign.position.set(-300, 5.2, 83)
  sign.rotation.y = 0.25
  scene.add(sign)

  addParkedCar(world, -258, 90, Math.PI / 2, 0xf0cf4d, 'sport')
  addPalmAt(scene, world, -238, 98, 8, 0.2)
  addPalmAt(scene, world, -238, 82, 7, -0.18)
}

function addMountains(scene) {
  const mats = [
    new THREE.MeshStandardMaterial({ color: 0x5b5367, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x6f6070, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x82707a, roughness: 1 })
  ]
  for (let i = 0; i < 16; i++) {
    const h = 32 + Math.random() * 48
    const m = new THREE.Mesh(new THREE.ConeGeometry(118 + Math.random() * 90, h, 8, 3), mats[i % 3])
    m.position.set(-520 + i * 72 + Math.random() * 30, h / 2 - 10, -520 - Math.random() * 80)
    m.rotation.y = Math.random() * Math.PI
    m.scale.x = 1.35 + Math.random() * 0.3
    scene.add(m)
  }
  for (let i = 0; i < 7; i++) {
    const h = 38 + Math.random() * 48
    const m = new THREE.Mesh(new THREE.ConeGeometry(130 + Math.random() * 80, h, 8, 3), mats[1])
    m.position.set(430 + i * 55, h / 2 - 10, -320 + i * 90)
    m.rotation.y = Math.random() * Math.PI
    m.scale.x = 1.3
    scene.add(m)
  }
}

function addLampAt(scene, world, x, z, rot = 0) {
  const lamp = createStreetLamp()
  lamp.position.set(x, 0.05, z)
  lamp.rotation.y = rot
  scene.add(lamp)
  world.lamps.push(lamp)
}

function addPalmAt(scene, world, x, z, h, lean) {
  const palm = createPalm(h, lean)
  palm.position.set(x, 0.05, z)
  palm.rotation.y = Math.random() * Math.PI * 2
  scene.add(palm)
  world.palms.push(palm)
}

function addBench(scene, x, z, rot) {
  const bench = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: 0x8c5f3e, roughness: 0.9 })
  const metal = new THREE.MeshStandardMaterial({ color: 0x2d3033, metalness: 0.5, roughness: 0.6 })
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.13, 0.55), wood)
  seat.position.y = 0.55
  bench.add(seat)
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 0.12), wood)
  back.position.set(0, 0.86, -0.22)
  back.rotation.x = -0.12
  bench.add(back)
  for (const sx of [-0.72, 0.72]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.5), metal)
    leg.position.set(sx, 0.28, 0)
    bench.add(leg)
  }
  bench.position.set(x, 0.04, z)
  bench.rotation.y = rot
  bench.traverse(o => { if (o.isMesh) o.castShadow = true })
  scene.add(bench)
}

export function addParkedCar(world, x, z, heading, color, type, id) {
  const car = createCar({ color, type })
  car.position.set(x, 0.05, z)
  car.rotation.y = heading
  car.userData.heading = heading
  car.userData.parked = true
  car.userData.id = id || ''
  car.userData.speed = 0
  car.userData.drivetrain = 'parked'
  sceneAdd(world, car)
  world.parkedCars.push(car)
  return car
}

let activeScene = null
function sceneAdd(world, obj) {
  if (world.scene) world.scene.add(obj)
  else activeScene?.add(obj)
}

function addTraffic(scene, world) {
  world.scene = scene
  const palette = [0xdb4b3e, 0x3d89b7, 0xe3c24e, 0xd9dedf, 0x3d6b52, 0x8e4fa0, 0xe07b42, 0x31516d]
  for (let i = 0; i < 18; i++) {
    const axis = i % 2 === 0 ? 'z' : 'x'
    const lane = ROADS[Math.floor(Math.random() * ROADS.length)]
    const dir = Math.random() > 0.5 ? 1 : -1
    const offset = dir * 3.4
    const type = Math.random() > 0.8 ? 'van' : Math.random() > 0.4 ? 'sedan' : 'sport'
    const car = createCar({ color: palette[i % palette.length], type })
    const pos = -CITY_EDGE + Math.random() * CITY_EDGE * 2
    if (axis === 'z') {
      car.position.set(lane + offset, 0.05, pos)
      car.rotation.y = dir > 0 ? 0 : Math.PI
      car.userData.axis = 'z'
    } else {
      car.position.set(pos, 0.05, lane + offset)
      car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2
      car.userData.axis = 'x'
    }
    car.userData.dir = dir
    car.userData.lane = lane
    car.userData.offset = offset
    car.userData.speed = 7 + Math.random() * 8
    car.userData.heading = car.rotation.y
    car.userData.parked = false
    car.userData.drivetrain = 'traffic'
    scene.add(car)
    world.trafficCars.push(car)
  }
}

function addPedestrians(scene, world) {
  const shirts = [0x5f8ca0, 0xc46255, 0xd9c06a, 0x7d6ba8, 0x4d8c68, 0xd7d4c6, 0x2f3d55]
  const pants = [0x273140, 0x4c4a44, 0x7c6d58, 0x2d3c33]
  for (let i = 0; i < 14; i++) {
    const ped = createPedestrian({
      shirt: shirts[i % shirts.length],
      pants: pants[i % pants.length],
      skin: [0xb97852, 0x7d4d32, 0xd6a17c, 0x5c3c2a][i % 4]
    })
    const bx = BLOCK_CENTERS[Math.floor(Math.random() * BLOCK_CENTERS.length)]
    const bz = BLOCK_CENTERS[Math.floor(Math.random() * BLOCK_CENTERS.length)]
    const side = Math.floor(Math.random() * 4)
    const t = Math.random() * 2 - 1
    const inset = 25 - 2.2
    let x = bx + (side < 2 ? t * inset : (side === 2 ? -inset : inset))
    let z = bz + (side >= 2 ? t * inset : (side === 0 ? -inset : inset))
    ped.position.set(x, 0.07, z)
    ped.userData.target = new THREE.Vector3(x, 0, z)
    ped.userData.speed = 0.8 + Math.random() * 0.7
    ped.userData.phase = Math.random() * Math.PI * 2
    ped.userData.path = side
    ped.userData.block = [bx, bz]
    ped.userData.progress = Math.random()
    ped.userData.alive = true
    ped.userData.scared = 0
    scene.add(ped)
    world.peds.push(ped)
  }
}

function addCollectibles(scene, world) {
  const spots = [[-220, 50], [-242, -110], [-238, 175], [-30, -30], [34, 26], [100, 96], [100, 34], [165, -34], [166, 166], [36, 166], [-100, 164], [-166, 98]]
  for (const [x, z] of spots) {
    const c = createCollectible()
    c.position.set(x, 0.07, z)
    c.userData.baseY = 0.07
    c.userData.taken = false
    scene.add(c)
    world.collectibles.push(c)
  }
}

function addMarkers(scene, world) {
  const marker = createMissionMarker()
  marker.position.set(-208, 0.07, 90)
  scene.add(marker)
  marker.visible = false
  world.markers.dropOff = marker
  world.dropOff = new THREE.Vector3(-208, 0, 90)

  const garage = createMissionMarker()
  garage.position.set(150, 0.07, 54)
  garage.visible = false
  scene.add(garage)
  world.markers.garage = garage
  world.garage = new THREE.Vector3(150, 0, 54)

  const label = makeTextSprite('FIXER', '#ffe07a')
  label.scale.set(3.8, 0.95, 1)
  label.position.set(world.missionStart.x, 2.5, world.missionStart.z)
  scene.add(label)
  world.fixerLabel = label
}

function addOuterProps(scene, world) {
  ROADS.forEach((x, xi) => {
    ROADS.forEach((z, zi) => {
      if ((xi + zi) % 3 !== 0) return
      const tl = createTrafficLight()
      tl.position.set(x + 7.5, 0.05, z - 7.5)
      tl.rotation.y = Math.PI / 2
      scene.add(tl)
      world.trafficLights.push(tl)
    })
  })
  const warehouseMat = new THREE.MeshStandardMaterial({ color: 0x6a6d68, roughness: 0.88 })
  for (let i = 0; i < 9; i++) {
    const x = 235 + Math.random() * 35
    const z = -170 + i * 40
    const b = new THREE.Mesh(new THREE.BoxGeometry(28 + Math.random() * 16, 8 + Math.random() * 12, 22), warehouseMat)
    b.position.set(x, 5, z)
    b.castShadow = true
    b.receiveShadow = true
    scene.add(b)
    world.colliders.push({ minX: b.position.x - b.geometry.parameters.width / 2, maxX: b.position.x + b.geometry.parameters.width / 2, minZ: b.position.z - b.geometry.parameters.depth / 2, maxZ: b.position.z + b.geometry.parameters.depth / 2, h: b.geometry.parameters.height })
  }
  for (let i = 0; i < 8; i++) {
    const x = -150 + i * 45
    const z = 248
    const b = new THREE.Mesh(new THREE.BoxGeometry(28, 7 + Math.random() * 5, 20), new THREE.MeshStandardMaterial({ color: 0xc0aa90, roughness: 0.9 }))
    b.position.set(x, 3.5, z)
    b.castShadow = true
    scene.add(b)
  }
}

export function updateWorld(world, dt, t, playerPos, camera) {
  world.time += dt
  if (world.skyUniforms) world.skyUniforms.time.value = t
  if (world.waterUniforms) world.waterUniforms.time.value = t
  if (world.water) world.water.position.y = -0.55 + Math.sin(t * 0.7) * 0.01
  if (world.ferrisWheel) world.ferrisWheel.rotation.z = t * 0.045
  for (const palm of world.palms) {
    palm.rotation.z = Math.sin(t * 0.65 + palm.position.x * 0.1) * 0.006
  }
  if (world.fixerLabel) {
    world.fixerLabel.position.y = 2.5 + Math.sin(t * 2) * 0.08
  }
  for (const marker of Object.values(world.markers)) {
    if (!marker.visible) continue
    marker.userData.ring.rotation.z = t * 0.6
    marker.userData.ring.material.opacity = 0.55 + Math.sin(t * 3) * 0.2
    marker.userData.marker.position.y = 2.8 + Math.sin(t * 2.4) * 0.25
    marker.userData.marker.rotation.y = t * 1.3
    marker.userData.inner.material.opacity = 0.12 + Math.sin(t * 2) * 0.05
  }
  for (const c of world.collectibles) {
    if (c.userData.taken) continue
    c.rotation.y = t * 1.2
    c.userData.gem.position.y = 1.2 + Math.sin(t * 2.2 + c.position.x) * 0.18
    c.userData.ring.rotation.z = t
  }

  for (const npc of world.npcs) {
    const dx = playerPos.x - npc.group.position.x
    const dz = playerPos.z - npc.group.position.z
    const distance = Math.hypot(dx, dz)
    if (distance < 14) {
      const wanted = Math.atan2(dx, dz)
      let diff = wanted - npc.group.rotation.y
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      npc.group.rotation.y += diff * Math.min(1, dt * 2.6)
    }
    npc.group.position.y = 0.06 + Math.sin(t * 1.4 + npc.group.position.x) * 0.015
    animateCharacter(npc.group, dt, 0, t)
  }

  for (const car of world.trafficCars) {
    if (car.userData.stopped) continue
    const speed = car.userData.speed
    if (car.userData.axis === 'z') {
      car.position.z += car.userData.dir * speed * dt
      if (car.position.z > CITY_EDGE + 14) car.position.z = -CITY_EDGE - 14
      if (car.position.z < -CITY_EDGE - 14) car.position.z = CITY_EDGE + 14
    } else {
      car.position.x += car.userData.dir * speed * dt
      if (car.position.x > CITY_EDGE + 14) car.position.x = -CITY_EDGE - 14
      if (car.position.x < -CITY_EDGE - 14) car.position.x = CITY_EDGE + 14
    }
    for (const wheel of car.userData.wheels) wheel.rotation.x -= speed * dt * 1.8
  }

  for (const ped of world.peds) {
    if (!ped.userData.alive) continue
    const [bx, bz] = ped.userData.block
    const speed = ped.userData.speed * (ped.userData.scared > 0 ? 3.2 : 1)
    ped.userData.scared = Math.max(0, ped.userData.scared - dt)
    const side = ped.userData.path
    const inset = 23
    const length = inset * 2
    ped.userData.progress += speed * dt / (length * 2)
    if (ped.userData.progress > 1) ped.userData.progress -= 1
    const p = ped.userData.progress
    let x, z, heading
    if (p < 0.25) {
      const q = p / 0.25
      x = bx - inset + q * length
      z = bz + inset
      heading = Math.PI / 2
    } else if (p < 0.5) {
      const q = (p - 0.25) / 0.25
      x = bx + inset
      z = bz + inset - q * length
      heading = Math.PI
    } else if (p < 0.75) {
      const q = (p - 0.5) / 0.25
      x = bx + inset - q * length
      z = bz - inset
      heading = -Math.PI / 2
    } else {
      const q = (p - 0.75) / 0.25
      x = bx - inset
      z = bz - inset + q * length
      heading = 0
    }
    if (ped.userData.scared > 0) heading += Math.sin(t * 16 + ped.userData.phase) * 0.6
    ped.position.x += (x - ped.position.x) * Math.min(1, dt * 4)
    ped.position.z += (z - ped.position.z) * Math.min(1, dt * 4)
    ped.rotation.y = heading
    ped.userData.legs[0].rotation.x = Math.sin(t * 6 + ped.userData.phase) * 0.55
    ped.userData.legs[1].rotation.x = -Math.sin(t * 6 + ped.userData.phase) * 0.55
  }

  for (const tl of world.trafficLights) {
    const green = (Math.floor(t * 0.2) + Math.round(tl.position.x / 20)) % 2 === 0
    tl.userData.lights.green.material.emissiveIntensity = green ? 2.2 : 0.1
    tl.userData.lights.red.material.emissiveIntensity = green ? 0.1 : 2.2
    tl.userData.lights.amber.material.emissiveIntensity = 0.1
  }
}

export function findNearestCar(world, pos, maxDist = 5.5) {
  let best = null
  let bestDist = maxDist
  for (const car of world.parkedCars) {
    if (car.userData.occupied) continue
    const d = car.position.distanceTo(pos)
    if (d < bestDist) {
      bestDist = d
      best = car
    }
  }
  return best
}

export function isBlocked(world, x, z, radius = 0.45) {
  for (const c of world.colliders) {
    if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) return c
  }
  return null
}
