import * as THREE from 'three'
import { World } from './World.js'
import { SHARDS, SHARD_BY_ID, VIRTUES } from '../data.js'
import {
  stoneTexture, groundTexture, makeSky, makeStars, makeMotes, updateMotes, makePortalDisc,
  makeRuneRing, makeBeam, makeLightShaft, makeFlame, makeRubbleStone, glowSprite
} from './gfx.js'
import { mulberry32, clamp, damp } from '../logic.js'

export class HubWorld extends World {
  constructor(game) {
    super(game, { boundary: 47, spawn: new THREE.Vector3(0, 0, 23) })
    this.random = mulberry32(1977)
    this.portals = new Map()
    this.trial = null
    this.castleRisen = false
    this.castleRise = 0
    this.dialogIndex = 0
    this.mentorSpoken = false
    this.portalLights = []
    this.motes = []
    this.time = 0
    this.build()
  }

  build() {
    this.buildSky()
    this.buildGround()
    this.buildApproach()
    this.buildRuins()
    this.buildDais()
    this.buildPortals()
    this.buildCastle()
    this.buildMentor()
    this.buildAmbient()
    this.spawnInitialEnemies()
  }

  buildSky() {
    this.scene.add(makeSky({ top: 0x071022, horizon: 0x1b3c52, bottom: 0x060a12, glow: 0x8fd2e8 }))
    this.scene.add(makeStars(620, 190, 11, 0xbfe6ff))
    this.scene.fog = new THREE.FogExp2(0x0b1824, 0.0095)
    this.scene.background = new THREE.Color(0x08101b)

    this.hemi = new THREE.HemisphereLight(0x9dd4eb, 0x3b3727, 1.05)
    this.scene.add(this.hemi)
    this.ambient = new THREE.AmbientLight(0x40566a, 0.55)
    this.scene.add(this.ambient)
    const moon = new THREE.DirectionalLight(0xffe4bd, 3.1)
    moon.position.set(34, 52, 22)
    moon.castShadow = true
    moon.shadow.mapSize.set(this.game.isTouch ? 1024 : 2048, this.game.isTouch ? 1024 : 2048)
    moon.shadow.camera.left = -62
    moon.shadow.camera.right = 62
    moon.shadow.camera.top = 62
    moon.shadow.camera.bottom = -62
    moon.shadow.camera.near = 1
    moon.shadow.camera.far = 140
    moon.shadow.bias = -0.0004
    moon.shadow.normalBias = 0.035
    this.scene.add(moon)
    this.moon = moon
    const rim = new THREE.DirectionalLight(0x5aa6d8, 0.6)
    rim.position.set(-38, 26, -30)
    this.scene.add(rim)
  }

  buildGround() {
    const texture = groundTexture({ base: '#262c2a', moss: '#36513c', seed: 12 })
    texture.repeat.set(11, 11)
    const groundMaterial = new THREE.MeshStandardMaterial({ map: texture, color: 0xb8c4b9, roughness: 1, metalness: 0.02 })
    const ground = new THREE.Mesh(new THREE.CircleGeometry(54, 96), groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(21, 64),
      new THREE.MeshStandardMaterial({ map: groundTexture({ base: '#2c332f', moss: '#425a45', seed: 5 }), color: 0xcbd4c7, roughness: 1 })
    )
    inner.rotation.x = -Math.PI / 2
    inner.position.y = 0.012
    inner.receiveShadow = true
    this.scene.add(inner)

  }

  buildApproach() {
    const stone = new THREE.MeshStandardMaterial({
      map: stoneTexture({ base: '#343b39', accent: '#697166', moss: '#2c4a36', seed: 61 }),
      color: 0xc6cec2,
      roughness: 0.94,
      metalness: 0.05
    })
    const gold = new THREE.MeshBasicMaterial({ color: 0xffdfa0 })

    const pathTexture = stoneTexture({ base: '#333b39', accent: '#7d8a7c', moss: '#34503d', seed: 17 })
    pathTexture.repeat.set(2, 9)
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 21),
      new THREE.MeshStandardMaterial({ map: pathTexture, color: 0xc8d3c5, roughness: 0.88, metalness: 0.05 })
    )
    path.rotation.x = -Math.PI / 2
    path.position.set(0, 0.03, 14.5)
    path.receiveShadow = true
    this.scene.add(path)
    for (const side of [-1, 1]) {
      const inlay = new THREE.Mesh(
        new THREE.PlaneGeometry(0.055, 20),
        new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
      )
      inlay.rotation.x = -Math.PI / 2
      inlay.position.set(side * 1.9, 0.045, 14.5)
      this.scene.add(inlay)
    }

    for (let i = 0; i < 4; i++) {
      const z = 19 - i * 3.6
      for (const side of [-1, 1]) {
        const x = side * 4.7
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 0.9, 7), stone)
        base.position.set(x, 0.45, z)
        base.castShadow = true
        base.receiveShadow = true
        this.scene.add(base)
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.2, 7), stone)
        bowl.position.set(x, 0.98, z)
        this.scene.add(bowl)
        const flame = makeFlame(i % 2 ? 0x8fe3ff : 0xffd88a, 0.72)
        flame.position.set(x, 1.12, z)
        this.scene.add(flame)
        const halo = glowSprite(i % 2 ? 0x8fe3ff : 0xffd88a, 1.7, 0.16)
        halo.position.set(x, 1.2, z)
        this.scene.add(halo)
        this.addCircleCollider(x, z, 0.38, 1)
        this.cameraBlockers.push(base)
        if (i === 1) {
          const rune = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.03), gold)
          rune.position.set(x - side * 0.27, 0.52, z)
          this.scene.add(rune)
        }
      }
    }

    const lintelMaterial = new THREE.MeshStandardMaterial({ color: 0x2b3331, roughness: 0.7, metalness: 0.25 })
    for (const side of [-1, 1]) {
      const x = side * 8.2
      const z = 8.2
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 2.4), stone)
      plinth.position.set(x, 0.55, z)
      plinth.castShadow = true
      plinth.receiveShadow = true
      this.scene.add(plinth)
      const warden = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.0, 3.5, 7), stone)
      warden.position.set(x, 2.7, z)
      warden.rotation.y = Math.PI / 7
      warden.castShadow = true
      this.scene.add(warden)
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.2, 7), lintelMaterial)
      hood.position.set(x, 4.75, z)
      hood.rotation.y = Math.PI / 7
      this.scene.add(hood)
      const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 4.3, 5), lintelMaterial)
      spear.position.set(x + side * 0.72, 2.5, z + 0.28)
      spear.rotation.z = -side * 0.06
      this.scene.add(spear)
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }))
      tip.position.set(x + side * 0.84, 4.74, z + 0.28)
      this.scene.add(tip)
      const halo = glowSprite(0x8fe3ff, 2.4, 0.22)
      halo.position.copy(tip.position)
      this.scene.add(halo)
      this.addCircleCollider(x, z, 1.05, 5)
      this.cameraBlockers.push(warden)
    }
  }

  buildDais() {
    const texture = stoneTexture({ base: '#3b4140', accent: '#6c7066', moss: '#2c4a35', seed: 4 })
    texture.repeat.set(3, 3)
    const stone = new THREE.MeshStandardMaterial({ map: texture, color: 0xd0d5c9, roughness: 0.92, metalness: 0.05 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(12.4, 13.2, 0.55, 64), stone)
    base.position.y = 0.275
    base.receiveShadow = true
    base.castShadow = true
    this.scene.add(base)
    const step = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10.4, 0.4, 56), stone)
    step.position.y = 0.68
    step.receiveShadow = true
    this.scene.add(step)

    const ring = makeRuneRing({ radius: 8.2, color: 0x8fe3ff, thickness: 0.045, opacity: 0.34 })
    ring.position.y = 0.9
    this.scene.add(ring)
    this.daisRing = ring
    const ring2 = makeRuneRing({ radius: 5.6, color: 0xe8c987, thickness: 0.03, opacity: 0.24 })
    ring2.position.y = 0.91
    this.scene.add(ring2)
    this.daisRing2 = ring2

    const core = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 48),
      new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    core.rotation.x = -Math.PI / 2
    core.position.y = 0.9
    this.scene.add(core)

    const monumentMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2228, roughness: 0.4, metalness: 0.6, emissive: 0x0a2230, emissiveIntensity: 0.8 })
    const monument = new THREE.Group()
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.4, 6.2, 4), monumentMaterial)
    obelisk.rotation.y = Math.PI / 4
    obelisk.position.y = 4
    obelisk.castShadow = true
    monument.add(obelisk)
    for (let i = 0; i < 4; i++) {
      const socket = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: SHARDS[i].color }))
      const angle = (i / 4) * Math.PI * 2
      socket.position.set(Math.cos(angle) * 1.1, 4.6 + (i % 2) * 0.6, Math.sin(angle) * 1.1)
      monument.add(socket)
      this.monumentSockets = this.monumentSockets || []
      this.monumentSockets.push(socket)
    }
    const monumentGlow = glowSprite(0x8fe3ff, 3.5, 0.14)
    monumentGlow.position.y = 4
    monument.add(monumentGlow)
    this.scene.add(monument)
    this.monument = monument
    this.addCircleCollider(0, 0, 1.6, 6)
  }

  buildRuins() {
    const stone = stoneTexture({ base: '#38403f', accent: '#64705f', moss: '#2a4934', seed: 21 })
    stone.repeat.set(2, 1)
    const wallMaterial = new THREE.MeshStandardMaterial({ map: stone, color: 0xc3cabf, roughness: 0.95, metalness: 0.04 })
    const capMaterial = new THREE.MeshStandardMaterial({ color: 0x3c5a42, roughness: 1 })
    this.wallMaterial = wallMaterial
    this.capMaterial = capMaterial

    const portalPositions = SHARDS.map(shard => new THREE.Vector3(shard.position[0], 0, shard.position[2]))
    const placeWall = (x, z, width, depth, height, rotation = 0, collider = true) => {
      const group = new THREE.Group()
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial)
      mesh.position.y = height / 2
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 1.03, 0.14, depth * 1.12), capMaterial)
      cap.position.y = height + 0.05
      cap.castShadow = true
      group.add(cap)
      group.position.set(x, 0, z)
      group.rotation.y = rotation
      if (this.random() > 0.38) {
        const runeMaterial = this.random() > 0.35
          ? new THREE.MeshBasicMaterial({ color: 0x86dff5, transparent: true, opacity: 0.5 })
          : new THREE.MeshBasicMaterial({ color: 0xd9b96f, transparent: true, opacity: 0.42 })
        for (const side of [-1, 1]) {
          const rune = new THREE.Mesh(new THREE.BoxGeometry(0.07, height * (0.22 + this.random() * 0.24), 0.035), runeMaterial)
          rune.position.set((this.random() - 0.5) * width * 0.55, height * (0.48 + this.random() * 0.18), side * (depth / 2 + 0.022))
          group.add(rune)
        }
      }
      this.scene.add(group)
      this.cameraBlockers.push(mesh)
      if (collider && Math.abs(rotation % Math.PI) < 0.01) this.addBoxCollider(x, z, width, depth, height)
      return group
    }

    let attempts = 0
    let count = 0
    while (count < 17 && attempts < 200) {
      attempts++
      const angle = this.random() * Math.PI * 2
      const radius = 15 + this.random() * 25
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const width = 3.5 + this.random() * 9
      const depth = 1.1 + this.random() * 1.6
      const height = 2.2 + this.random() * 4.6
      if (radius < 13) continue
      if (Math.abs(x) < 9.5 && z > 2) continue
      if (Math.hypot(x, z - 23) < 11) continue
      if (portalPositions.some(p => p.distanceTo(new THREE.Vector3(x, 0, z)) < 11)) continue
      if (this.colliders.some(c => c.type === 'box' && Math.abs(c.x - x) < (c.width + width) / 2 + 1 && Math.abs(c.z - z) < (c.depth + depth) / 2 + 1)) continue
      placeWall(x, z, width, depth, height, this.random() > 0.72 ? Math.PI / 2 : 0)
      count++
    }

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.12
      const radius = 13.5
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      if (Math.hypot(x, z - 23) < 6) continue
      if (Math.abs(x) < 8 && z > 2) continue
      const height = 4.8 + this.random() * 3.5
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, height, 7), wallMaterial)
      pillar.position.set(x, height / 2, z)
      pillar.castShadow = true
      pillar.receiveShadow = true
      this.scene.add(pillar)
      this.addCircleCollider(x, z, 0.75, height)
      this.cameraBlockers.push(pillar)
      if (this.random() > 0.45) {
        const broken = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.78, 0.5, 7), capMaterial)
        broken.position.set(x, height + 0.1, z)
        broken.rotation.z = 0.2
        this.scene.add(broken)
      }
    }

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      const radius = 44
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      if (portalPositions.some(p => Math.hypot(p.x - x, p.z - z) < 8)) continue
      const width = 4 + this.random() * 5
      const height = 3.5 + this.random() * 4
      const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, 1.3), wallMaterial)
      wall.position.set(x, height / 2, z)
      wall.rotation.y = -angle + Math.PI / 2
      wall.castShadow = true
      wall.receiveShadow = true
      this.scene.add(wall)
      this.addCircleCollider(x, z, 0.65, height)
    }

    for (let i = 0; i < 46; i++) {
      const angle = this.random() * Math.PI * 2
      const radius = 8 + Math.sqrt(this.random()) * 38
      const rock = makeRubbleStone(0.2 + this.random() * 0.7, 0x3c4542, 100 + i)
      rock.position.set(Math.cos(angle) * radius, 0.12, Math.sin(angle) * radius)
      rock.rotation.set(this.random() * 3, this.random() * 3, this.random() * 3)
      rock.castShadow = true
      this.scene.add(rock)
    }

    const shaftMaterial = 0xffe3ad
    for (let i = 0; i < 5; i++) {
      const angle = 0.6 + i * 1.27
      const shaft = makeLightShaft(shaftMaterial, 3 + this.random() * 2, 26, 0.035)
      shaft.position.set(Math.cos(angle) * (18 + this.random() * 14), 0, Math.sin(angle) * (18 + this.random() * 14))
      shaft.rotation.z = (this.random() - 0.5) * 0.18
      this.scene.add(shaft)
      this.lightShafts = this.lightShafts || []
      this.lightShafts.push(shaft)
    }
  }

  makePortal(shard) {
    const group = new THREE.Group()
    const x = shard.position[0]
    const z = shard.position[2]
    group.position.set(x, 0, z)
    group.rotation.y = Math.atan2(-x, -z)

    const frameMaterial = new THREE.MeshStandardMaterial({
      map: stoneTexture({ base: '#33403f', accent: '#718273', moss: '#2b4a38', seed: 33 + shard.position[0] }),
      color: 0xc7d2c7,
      roughness: 0.9,
      metalness: 0.08
    })
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: shard.color,
      emissive: shard.color,
      emissiveIntensity: 0.65,
      roughness: 0.4,
      metalness: 0.6
    })

    const platform = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.5, 24), frameMaterial)
    platform.position.y = 0.25
    platform.receiveShadow = true
    platform.castShadow = true
    group.add(platform)

    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.05, 5.8, 1.25), frameMaterial)
      pillar.position.set(side * 2.65, 3.15, 0)
      pillar.castShadow = true
      pillar.receiveShadow = true
      group.add(pillar)
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.2, 0.08), accentMaterial)
      rune.position.set(side * 2.11, 3.5, 0.66)
      group.add(rune)
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 4), frameMaterial)
      cap.position.set(side * 2.65, 6.6, 0)
      cap.rotation.y = Math.PI / 4
      group.add(cap)
      const worldPos = new THREE.Vector3(side * 2.65, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y).add(group.position)
      this.addCircleCollider(worldPos.x, worldPos.z, 0.8, 6)
    }

    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.34, 8, 40, Math.PI), frameMaterial)
    arch.position.y = 4.2
    arch.castShadow = true
    group.add(arch)
    const archRune = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.055, 6, 40, Math.PI), accentMaterial)
    archRune.position.y = 4.2
    archRune.position.z = 0.3
    group.add(archRune)

    const disc = makePortalDisc(shard.color, false)
    disc.position.set(0, 3.1, 0)
    group.add(disc)

    const beam = makeBeam(shard.color, 20, 0.3, 0.24)
    beam.visible = false
    beam.position.y = 0.5
    group.add(beam)

    const sealMaterial = new THREE.MeshStandardMaterial({
      color: shard.color,
      emissive: shard.color,
      emissiveIntensity: 1.0,
      roughness: 0.25,
      metalness: 0.5,
      transparent: true,
      opacity: 0.95
    })
    const seal = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), sealMaterial)
    seal.position.set(0, 3.1, 1.4)
    group.add(seal)

    const halo = glowSprite(shard.color, 3.4, 0.16)
    halo.position.set(0, 3.1, 0.2)
    group.add(halo)

    const braziers = []
    for (const side of [-1, 1]) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.6, 8), frameMaterial)
      bowl.position.set(side * 4.1, 0.9, 1.3)
      group.add(bowl)
      const flame = makeFlame(shard.color, 0.8)
      flame.position.set(side * 4.1, 1.2, 1.3)
      group.add(flame)
      braziers.push(flame)
    }

    const light = new THREE.PointLight(shard.color, 0, 13, 2)
    light.position.set(0, 3.3, 0)
    group.add(light)
    this.portalLights.push(light)

    this.scene.add(group)
    const portal = {
      shard,
      group,
      disc,
      discMaterial: disc.userData.portalMaterial,
      seal,
      beam,
      halo,
      braziers,
      light,
      open: Boolean(this.game.stateData.seals[shard.id]),
      openAmount: this.game.stateData.seals[shard.id] ? 1 : 0,
      position: new THREE.Vector3(x, 0, z)
    }
    this.portals.set(shard.id, portal)
    return portal
  }

  buildPortals() {
    for (const shard of SHARDS) this.makePortal(shard)
  }

  buildCastle() {
    const castle = new THREE.Group()
    const stone = new THREE.MeshStandardMaterial({
      color: 0x394142,
      roughness: 0.82,
      metalness: 0.18,
      emissive: 0x152a2b,
      emissiveIntensity: 0.25
    })
    const gold = new THREE.MeshStandardMaterial({
      color: 0xd8b46a,
      emissive: 0x6b4a16,
      emissiveIntensity: 0.4,
      roughness: 0.38,
      metalness: 0.8
    })
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffe3a0 })

    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 6.6, 3, 8), stone)
    base.position.y = 1.5
    base.castShadow = true
    base.receiveShadow = true
    castle.add(base)

    const main = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.2, 13, 8), stone)
    main.position.y = 9.5
    main.castShadow = true
    castle.add(main)

    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.3, 5.4, 8), new THREE.MeshStandardMaterial({ color: 0x2b3438, roughness: 0.7, metalness: 0.35 }))
    crown.position.y = 18.6
    crown.rotation.y = Math.PI / 8
    castle.add(crown)

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.35, 9 + (i % 2) * 2, 7), stone)
      tower.position.set(Math.cos(angle) * 4.2, 6.5, Math.sin(angle) * 4.2)
      tower.castShadow = true
      castle.add(tower)
      const spire = new THREE.Mesh(new THREE.ConeGeometry(1.35, 3.6, 7), gold)
      spire.position.set(Math.cos(angle) * 4.2, 12.6, Math.sin(angle) * 4.2)
      spire.rotation.y = Math.PI / 7
      castle.add(spire)
      const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.8), windowMaterial)
      windowMesh.position.set(Math.cos(angle) * 5.05, 8.5, Math.sin(angle) * 5.05)
      windowMesh.lookAt(new THREE.Vector3(0, 8.5, 0))
      castle.add(windowMesh)
    }

    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4), new THREE.MeshBasicMaterial({ color: 0xffe7b0, transparent: true, opacity: 0.85 }))
    door.position.set(0, 2.8, 4.65)
    castle.add(door)
    const doorGlow = glowSprite(0xffdf9a, 8, 0.35)
    doorGlow.position.set(0, 3.3, 4.8)
    castle.add(doorGlow)

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.14, 5, 0.14), new THREE.MeshBasicMaterial({ color: SHARDS[i].color }))
      rune.position.set(Math.cos(angle) * 4.5, 2.7, Math.sin(angle) * 4.5)
      castle.add(rune)
    }

    const castleLight = glowSprite(0xffe3a8, 30, 0.18)
    castleLight.position.y = 12
    castle.add(castleLight)

    castle.position.y = -30
    castle.visible = false
    this.scene.add(castle)
    this.castle = castle
  }

  buildMentor() {
    const group = new THREE.Group()
    group.position.set(6.5, 0.9, 19)
    group.rotation.y = -2.4
    const robe = new THREE.MeshStandardMaterial({ color: 0x5d4a32, roughness: 0.9 })
    const trim = new THREE.MeshStandardMaterial({ color: 0xc8a35c, emissive: 0x51390f, emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.45 })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.7, 1.3, 8), robe)
    body.position.y = 0.78
    body.castShadow = true
    group.add(body)
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), robe)
    hood.position.y = 1.48
    group.add(hood)
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1a1208 }))
    face.position.set(0, 1.48, 0.17)
    face.scale.set(1, 1.1, 0.5)
    group.add(face)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffcf7a }))
      eye.position.set(side * 0.07, 1.5, 0.3)
      group.add(eye)
    }
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 }))
    staff.position.set(0.62, 1.1, 0.1)
    staff.rotation.z = -0.16
    group.add(staff)
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xffe4a3 }))
    orb.position.set(0.79, 2.2, 0.1)
    group.add(orb)
    const glow = glowSprite(0xffd88a, 2.2, 0.26)
    glow.position.set(0.79, 2.2, 0.1)
    group.add(glow)
    this.scene.add(group)
    this.mentor = group
    this.mentorOrb = orb
  }

  buildAmbient() {
    this.groundMotes = makeMotes({ count: 150, color: 0x9fe8ff, radius: 44, height: 11, size: 0.26, seed: 5, opacity: 0.55 })
    this.scene.add(this.groundMotes)
    this.motes.push(this.groundMotes)
    const embers = makeMotes({ count: 50, color: 0xffd58a, radius: 25, height: 8, size: 0.22, seed: 18, opacity: 0.45 })
    this.scene.add(embers)
    this.motes.push(embers)

    this.floaters = []
    for (let i = 0; i < 12; i++) {
      const rock = makeRubbleStone(0.18 + this.random() * 0.4, 0x455159, 200 + i)
      const angle = this.random() * Math.PI * 2
      const radius = 12 + this.random() * 26
      rock.position.set(Math.cos(angle) * radius, 2.2 + this.random() * 7, Math.sin(angle) * radius)
      rock.userData.baseY = rock.position.y
      rock.userData.phase = this.random() * 10
      this.scene.add(rock)
      this.floaters.push(rock)
    }
  }

  spawnInitialEnemies() {
    const random = mulberry32(44)
    for (const shard of SHARDS) {
      const angle = shard.angle + (random() - 0.5) * 0.5
      const radius = 19 + random() * 4
      const position = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
      this.spawnEnemy({
        type: random() > 0.4 ? 'wanderer' : 'sentinel',
        position,
        color: shard.color,
        hp: 52,
        damage: 9,
        speed: 2,
        aggroRange: 8,
        anchorRadius: 4
      })
    }
    this.spawnEnemy({
      type: 'wisp',
      position: new THREE.Vector3(-12, 0, 12),
      color: 0xa5c8ff,
      hp: 42,
      damage: 8,
      speed: 1.8,
      attackRange: 7,
      ranged: true,
      aggroRange: 8
    })
  }

  startTrial(portal) {
    if (this.trial || portal.open) return
    const shard = portal.shard
    const type = shard.trial
    const toCenter = new THREE.Vector3(-portal.position.x, 0, -portal.position.z).normalize()
    const side = new THREE.Vector3(-toCenter.z, 0, toCenter.x)
    const trial = {
      portal,
      type,
      shard,
      progress: 0,
      total: 3,
      echoes: [],
      enemies: [],
      active: true,
      hazardTimer: 2,
      elapsed: 0
    }
    this.trial = trial
    const offsets = [
      toCenter.clone().multiplyScalar(7),
      toCenter.clone().multiplyScalar(9.5).add(side.clone().multiplyScalar(4.5)),
      toCenter.clone().multiplyScalar(7.5).add(side.clone().multiplyScalar(-4.5))
    ]
    offsets.forEach((offset, index) => {
      const position = portal.position.clone().add(offset)
      position.y = 0
      if (type === 'empathy') this.createLostEcho(trial, position, index)
      else if (type === 'discipline') this.createSentinel(trial, position, index)
      else this.createRuneEcho(trial, position, index)
    })
    if (type === 'empathy' || type === 'wisdom') {
      for (let i = 0; i < 2; i++) {
        const enemy = this.spawnEnemy({
          type: i === 0 ? 'wanderer' : 'wisp',
          position: portal.position.clone().add(toCenter.clone().multiplyScalar(4 + i * 3)).add(side.clone().multiplyScalar(i === 0 ? -5 : 5)),
          color: shard.color,
          hp: 48,
          damage: 9,
          ranged: i === 1,
          attackRange: i === 1 ? 7 : 2.1,
          aggroRange: 14
        })
        trial.enemies.push(enemy)
      }
    }
    if (type === 'resilience') {
      for (let i = 0; i < 2; i++) {
        const enemy = this.spawnEnemy({
          type: i === 0 ? 'wisp' : 'wanderer',
          position: portal.position.clone().add(toCenter.clone().multiplyScalar(5)).add(side.clone().multiplyScalar(i === 0 ? 5 : -5)),
          color: shard.color,
          hp: 46,
          damage: 9,
          ranged: i === 0,
          attackRange: i === 0 ? 7 : 2.1,
          aggroRange: 12
        })
        trial.enemies.push(enemy)
      }
    }
    this.game.ui.toast(`${VIRTUES[shard.virtue].name} Trial: ${shard.trialHint}`, 'virtue', 4200)
    this.game.audio.virtue()
    this.game.refreshObjective()
    this.game.audio.setScene(this.game.currentSceneName === 'hub' ? 'hub' : 'hub')
  }

  createLostEcho(trial, position, index) {
    const group = new THREE.Group()
    group.position.copy(position)
    const color = trial.shard.color
    const robe = new THREE.MeshStandardMaterial({ color: 0x1c2a26, roughness: 0.9, transparent: true, opacity: 0.9 })
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.25, 8), robe)
    body.position.y = 0.65
    group.add(body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), robe)
    head.position.y = 1.28
    group.add(head)
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color }))
    core.position.set(0, 1.02, 0.28)
    group.add(core)
    const halo = glowSprite(color, 2.6, 0.3)
    halo.position.y = 1.1
    group.add(halo)
    const beam = makeBeam(color, 7, 0.16, 0.12)
    beam.position.y = 0.2
    group.add(beam)
    this.scene.add(group)
    const echo = {
      kind: 'lost',
      index,
      group,
      position: position.clone(),
      halo,
      core,
      beam,
      done: false,
      channel: 1.5,
      radius: 2.7
    }
    trial.echoes.push(echo)
  }

  createSentinel(trial, position, index) {
    const enemy = this.spawnEnemy({
      type: 'sentinel',
      position,
      color: trial.shard.color,
      hp: 72,
      damage: 12,
      speed: 2.5,
      aggroRange: 15,
      anchorRadius: 2,
      isTrialTarget: true
    })
    enemy.isTrialTarget = true
    trial.echoes.push({ kind: 'sentinel', enemy, position, done: false, index })
    trial.enemies.push(enemy)
  }

  createRuneEcho(trial, position, index) {
    const color = trial.shard.color
    const group = new THREE.Group()
    group.position.copy(position)
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), new THREE.MeshBasicMaterial({ color }))
    core.position.y = 1.5
    group.add(core)
    const ring = makeRuneRing({ radius: 0.8, color, thickness: 0.022, opacity: 0.7 })
    ring.position.y = 1.5
    group.add(ring)
    const glow = glowSprite(color, 3.4, 0.38)
    glow.position.y = 1.5
    group.add(glow)
    const beam = makeBeam(color, 9, 0.18, 0.13)
    beam.position.y = 0.1
    group.add(beam)
    this.scene.add(group)
    const echo = {
      kind: 'rune',
      index,
      group,
      core,
      ring,
      beam,
      position: position.clone().setY(0),
      done: false,
      radius: 2.1,
      kindName: trial.type === 'resilience' ? 'ember' : 'rune'
    }
    trial.echoes.push(echo)
  }

  collectEcho(echo, trial, game) {
    if (echo.done) return
    echo.done = true
    trial.progress++
    const color = trial.shard.color
    this.effects.burst(echo.position.clone().add(new THREE.Vector3(0, 1.2, 0)), color, 24, 4.4, 0.9, 0.32)
    this.effects.markerPulse(echo.position, color)
    this.audio.pickup()
    echo.group?.parent?.remove(echo.group)
    if (echo.beam) echo.beam.visible = false
    const virtue = trial.shard.virtue
    game.gainVirtue(virtue, 7, { toast: false })
    if (trial.progress >= trial.total) {
      this.completeTrial(trial, game)
    } else {
      game.ui.toast(`${VIRTUES[virtue].name} +7 · ${trial.progress} / ${trial.total}`, 'virtue', 1800)
      game.refreshObjective()
    }
  }

  completeTrial(trial, game) {
    if (trial.completed) return
    trial.completed = true
    const shard = trial.shard
    this.trial = null
    this.game.stateData.seals[shard.id] = true
    const portal = trial.portal
    portal.open = true
    this.game.gainVirtue(shard.virtue, 19, { toast: false })
    this.game.ui.toast(`${VIRTUES[shard.virtue].name} Seal restored — the ${shard.shortName} gate opens`, 'gold', 4400)
    this.game.audio.virtue()
    this.game.audio.portal()
    this.effects.shockwave(portal.position, shard.color, 8, 1)
    this.effects.burst(portal.position.clone().add(new THREE.Vector3(0, 3, 0)), shard.color, 42, 7, 1.4, 0.4)
    this.monumentSockets?.forEach(socket => {
      if (socket.material.color.getHex() === new THREE.Color(shard.color).getHex()) socket.scale.setScalar(1.45)
    })
    game.refreshObjective()
  }

  update(dt, { player, camera, game }) {
    this.time += dt
    const state = game.stateData
    for (const mote of this.motes) updateMotes(mote, dt, this.time)
    this.daisRing.rotation.y += dt * 0.09
    this.daisRing2.rotation.y -= dt * 0.13
    this.mentorOrb.rotation.y += dt * 1.2
    this.mentorOrb.position.y = 2.2 + Math.sin(this.time * 1.8) * 0.08
    this.floaters.forEach((rock, i) => {
      rock.position.y = rock.userData.baseY + Math.sin(this.time * 0.4 + rock.userData.phase) * 0.4
      rock.rotation.y += dt * 0.08
      rock.rotation.x += dt * 0.03
    })

    for (const portal of this.portals.values()) {
      portal.discMaterial.uniforms.uTime.value = this.time
      const target = portal.open ? 1 : 0.08
      portal.openAmount = damp(portal.openAmount, target, portal.open ? 3.5 : 1.5, dt)
      portal.discMaterial.uniforms.uOpen.value = portal.openAmount
      portal.seal.visible = portal.openAmount < 0.95
      if (portal.seal.visible) {
        portal.seal.rotation.y += dt * 0.7
        portal.seal.position.y = 3.1 + Math.sin(this.time * 1.4 + portal.position.x) * 0.18
        portal.seal.scale.setScalar(1 + Math.sin(this.time * 2.2) * 0.05)
      }
      portal.halo.material.opacity = 0.08 + portal.openAmount * 0.18 + Math.sin(this.time * 1.8) * 0.03
      portal.beam.visible = portal.openAmount > 0.3
      if (portal.beam.visible) {
        portal.beam.scale.y = clamp(portal.openAmount, 0.01, 1)
        portal.beam.rotation.y += dt * 0.25
      }
      portal.light.intensity = portal.openAmount * 6
      portal.braziers.forEach((flame, i) => {
        flame.userData.outer.material.opacity = 0.35 + Math.sin(this.time * 3.1 + i) * 0.12
        flame.scale.setScalar(0.8 + Math.sin(this.time * 2.6 + i) * 0.08)
      })
    }

    if (this.trial) this.updateTrial(dt, { player, game })

    if (state.keys.length >= 4 && !this.castleRisen) {
      this.castleRisen = true
      this.castle.visible = true
      this.game.ui.toast('Seeker Castle rises. The Maze has found its heart.', 'gold', 5200)
      this.game.audio.victory()
      this.game.audio.setScene('hub')
      this.game.shakeCamera(0.7)
      this.monument.visible = false
      this.addCircleCollider(0, 0, 2, 6)
    }
    if (this.castleRisen) {
      this.castleRise = Math.min(1, this.castleRise + dt * 0.28)
      const eased = 1 - Math.pow(1 - this.castleRise, 3)
      this.castle.position.y = -30 + eased * 30
      if (this.castleRise < 1) {
        if (Math.random() < dt * 18) {
          const angle = Math.random() * Math.PI * 2
          this.effects.burst(new THREE.Vector3(Math.cos(angle) * (6 + Math.random() * 5), 0.4, Math.sin(angle) * (6 + Math.random() * 5)), 0x8fe3ff, 5, 3, 0.8, 0.3)
        }
        game.shakeCamera(dt * 0.35)
        this.game.ui.setQuest('Seeker Castle manifests')
        this.scene.fog.density = 0.0095
      } else {
        this.scene.fog.density = 0.0085
      }
    }

    this.updateCommon(dt, { player, camera, world: this, game })
  }

  updateTrial(dt, { player, game }) {
    const trial = this.trial
    if (!trial) return
    trial.elapsed += dt
    if (trial.type === 'resilience') {
      trial.hazardTimer -= dt
      if (trial.hazardTimer <= 0) {
        trial.hazardTimer = 2.3
        this.spawnHazard({
          position: new THREE.Vector3(player.position.x + (Math.random() - 0.5) * 4, 0, player.position.z + (Math.random() - 0.5) * 4),
          radius: 2.3,
          delay: 1.1,
          duration: 0.2,
          damage: 10,
          color: 0xffc46b
        })
        this.effects.burst(player.position.clone().add(new THREE.Vector3(3, 0.3, 0)), 0xffc46b, 8, 2, 0.5, 0.25)
      }
    }
    for (const echo of trial.echoes) {
      if (echo.done) continue
      if (echo.kind === 'lost') {
        echo.core.rotation.y += dt
        echo.halo.material.opacity = 0.22 + Math.sin(this.time * 2) * 0.08
        const distance = Math.hypot(player.position.x - echo.position.x, player.position.z - echo.position.z)
        if (distance > 9) {
          echo.group.position.y = Math.sin(this.time * 1.2 + echo.index) * 0.06
        }
      } else if (echo.kind === 'rune') {
        echo.core.rotation.y += dt * 1.4
        echo.core.position.y = 1.5 + Math.sin(this.time * 2 + echo.index) * 0.18
        echo.ring.rotation.y += dt * 0.8
        echo.group.position.y = Math.sin(this.time * 1.1 + echo.index) * 0.08
        const distance = Math.hypot(player.position.x - echo.position.x, player.position.z - echo.position.z)
        if (distance < 2) {
          this.collectEcho(echo, trial, game)
          if (!this.trial) return
        }
      } else if (echo.kind === 'sentinel') {
        if (echo.enemy.dead && !echo.done) {
          echo.done = true
          trial.progress++
          this.effects.shockwave(echo.enemy.position, trial.shard.color, 3, 0.5)
          game.gainVirtue(trial.shard.virtue, 7, { toast: false })
          if (trial.progress >= trial.total) {
            this.completeTrial(trial, game)
            return
          }
          game.ui.toast(`${VIRTUES[trial.shard.virtue].name} +7 · ${trial.progress} / ${trial.total}`, 'virtue', 1800)
          game.refreshObjective()
        }
      }
    }
  }

  getInteractable(player) {
    const state = this.game.stateData
    let best = null
    let bestDistance = Infinity
    const consider = (interactable, distance, priority = 0) => {
      if (distance > (interactable.range ?? 3)) return
      const score = distance - priority
      if (score < bestDistance) {
        best = interactable
        bestDistance = score
      }
    }

    const mentorDistance = Math.hypot(player.position.x - this.mentor.position.x, player.position.z - this.mentor.position.z)
    consider({ id: 'mentor', label: 'Speak with the Seeker Mentor', action: 'mentor', range: 3.2 }, mentorDistance, 0.8)

    const castleDistance = Math.hypot(player.position.x, player.position.z)
    if (this.castleRisen && this.castleRise >= 0.98) {
      consider({ id: 'castle', label: 'Ascend to Seeker Castle', action: 'castle', range: 7.5 }, castleDistance, 1.2)
    }

    for (const portal of this.portals.values()) {
      const distance = Math.hypot(player.position.x - portal.position.x, player.position.z - portal.position.z)
      if (state.keys.includes(portal.shard.id)) continue
      if (portal.open) {
        consider({
          id: `portal-${portal.shard.id}`,
          label: `Enter the ${portal.shard.name}`,
          action: `enter:${portal.shard.id}`,
          range: 5.7,
          portal
        }, distance, 0.6)
      } else if (!this.trial) {
        consider({
          id: `trial-${portal.shard.id}`,
          label: `Begin the ${VIRTUES[portal.shard.virtue].name} Trial`,
          action: `trial:${portal.shard.id}`,
          range: 5.7,
          portal
        }, distance, 0.4)
      }
    }

    if (this.trial?.type === 'empathy') {
      for (const echo of this.trial.echoes) {
        if (echo.done) continue
        const distance = Math.hypot(player.position.x - echo.position.x, player.position.z - echo.position.z)
        consider({
          id: `echo-${echo.index}`,
          label: 'Soothe the lost echo',
          action: 'soothe',
          channel: echo.channel,
          echo,
          range: 3
        }, distance, 0.7)
      }
    }
    return best
  }

  interact(action, game) {
    if (action.startsWith('trial:')) {
      const shardId = action.split(':')[1]
      const portal = this.portals.get(shardId)
      if (portal) this.startTrial(portal)
      return
    }
    if (action.startsWith('enter:')) {
      const shardId = action.split(':')[1]
      game.enterShard(SHARD_BY_ID[shardId])
      return
    }
    if (action === 'mentor') {
      const lines = [
        'The Maze is not a place. It is a question. Walk until you have an answer.',
        'Each Shard answers a different wound. Elderwood for the heart. Iron for the hand. Astral for the mind. Shadow for the will.',
        'Virtue is not a bar to fill. It is a shape you become. The gates are listening.',
        'When four keys rest in the dais, the Castle will remember you.'
      ]
      game.ui.toast(lines[this.dialogIndex % lines.length], 'gold', 5000)
      this.dialogIndex++
      if (!this.mentorSpoken) {
        this.mentorSpoken = true
        game.gainVirtue('wisdom', 3)
      }
      game.audio.click()
    }
    if (action === 'castle') {
      game.finishJourney()
    }
  }

  completeChannel(interactable, game) {
    if (interactable.echo && this.trial) {
      const trial = this.trial
      this.collectEcho(interactable.echo, trial, game)
      game.audio.heal()
      game.player.heal(8)
    }
  }

  getCompassTarget() {
    if (this.castleRisen) return { position: new THREE.Vector3(0, 3, 0), label: 'Seeker Castle' }
    if (this.trial) {
      const remaining = this.trial.echoes.filter(echo => !echo.done)
      if (remaining.length > 0) {
        const nearest = remaining.reduce((a, b) => {
          const da = this.game.player.position.distanceTo(a.position)
          const db = this.game.player.position.distanceTo(b.position)
          return da < db ? a : b
        })
        return { position: nearest.position, label: 'Trial echo' }
      }
    }
    let best = null
    let bestDistance = Infinity
    for (const portal of this.portals.values()) {
      if (this.game.stateData.keys.includes(portal.shard.id)) continue
      const distance = this.game.player.position.distanceTo(portal.position)
      const priority = portal.open ? -10 : 0
      if (distance + priority < bestDistance) {
        best = portal
        bestDistance = distance + priority
      }
    }
    return best ? { position: best.position, label: best.shard.name } : { position: new THREE.Vector3(), label: 'The Nexus' }
  }

  getRule() {
    return {
      name: 'THE SENTIENT MAZE',
      detail: this.trial ? `Trial active · ${this.trial.progress} / ${this.trial.total}` : 'Four Virtues. Four Shards. One awakening.'
    }
  }

  getSpecial() {
    return null
  }
}
