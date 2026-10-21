import * as THREE from 'three'
import { World } from './World.js'
import { Boss } from '../entities/Boss.js'
import { VIRTUES } from '../data.js'
import {
  groundTexture, stoneTexture, makeSky, makeStars, makeMotes, updateMotes, makeRuneRing,
  makeBeam, makeLightShaft, makeFlame, makeRubbleStone, glowSprite, makePortalDisc
} from './gfx.js'
import { clamp, damp, angleDelta, mulberry32 } from '../logic.js'

export class ShardWorld extends World {
  constructor(game, shard) {
    super(game, { boundary: 34, spawn: new THREE.Vector3(0, 0, 22) })
    this.shard = shard
    this.returnOpen = false
    this.returnGate = null
    this.ruleDetail = shard.ruleDetail
    this.ruleDetailCache = ''
    this.compassVisible = true
    this.time = 0
    this.random = mulberry32(shard.id.length * 999 + shard.name.length)
    this.lightPools = []
    this.shadowZones = []
    this.envMotes = []
    this.playerLight = null
    this.beamAngle = 0
    this.firstRuleWarn = false
    this.buildEnvironment()
    this.buildApproach()
    this.buildReturnGate()
    this.setupBoss()
  }

  setupCommonEnvironment({
    top, horizon, bottom, glow, fogColor, fogDensity, stars = 300, starColor = 0xbfe6ff,
    hemiSky = 0x7fa8c0, hemiGround = 0x23231c, hemiIntensity = 0.55, ambient = 0x2b3a45,
    ambientIntensity = 0.3, sunColor = 0xffe2b6, sunIntensity = 1.8, sunPosition = [24, 40, 18],
    shadows = true
  }) {
    this.scene.add(makeSky({ top, horizon, bottom, glow }))
    if (stars > 0) this.scene.add(makeStars(stars, 200, this.shard.id.length + 41, starColor))
    this.scene.fog = new THREE.FogExp2(fogColor, fogDensity)
    this.scene.background = new THREE.Color(bottom)
    this.scene.add(new THREE.HemisphereLight(hemiSky, hemiGround, hemiIntensity * 1.35))
    this.scene.add(new THREE.AmbientLight(ambient, ambientIntensity * 1.35))
    const sun = new THREE.DirectionalLight(sunColor, sunIntensity)
    sun.position.set(...sunPosition)
    if (shadows) {
      sun.castShadow = true
      sun.shadow.mapSize.set(this.game.isTouch ? 1024 : 2048, this.game.isTouch ? 1024 : 2048)
      sun.shadow.camera.left = -44
      sun.shadow.camera.right = 44
      sun.shadow.camera.top = 44
      sun.shadow.camera.bottom = -44
      sun.shadow.camera.near = 1
      sun.shadow.camera.far = 120
      sun.shadow.bias = -0.0004
      sun.shadow.normalBias = 0.04
    }
    this.scene.add(sun)
    this.sun = sun
  }

  buildGround({ base, moss, seed, color = 0xc0cbc1, radius = 36, repeat = 9, edgeColor = 0x232b29 }) {
    const texture = groundTexture({ base, moss, seed })
    texture.repeat.set(repeat, repeat)
    const material = new THREE.MeshStandardMaterial({ map: texture, color, roughness: 1, metalness: 0.03 })
    const ground = new THREE.Mesh(new THREE.CircleGeometry(radius, 96), material)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius - 1.2, 2.2, 96, 1, true), new THREE.MeshStandardMaterial({ color: edgeColor, roughness: 1 }))
    edge.position.y = -1.1
    this.scene.add(edge)
    return ground
  }

  addCliffs({ color = 0x2d3633, count = 26, minHeight = 3, maxHeight = 9, radius = 34 }) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + this.random() * 0.18
      const r = radius + this.random() * 4
      const rock = makeRubbleStone(1.6 + this.random() * 2.4, color, 300 + i)
      const height = minHeight + this.random() * (maxHeight - minHeight)
      rock.position.set(Math.cos(angle) * r, height * 0.25, Math.sin(angle) * r)
      rock.scale.set(1, height / 3.4, 1)
      rock.rotation.y = this.random() * Math.PI
      rock.castShadow = true
      rock.receiveShadow = true
      this.scene.add(rock)
    }
  }

  buildApproach() {
    const stone = new THREE.MeshStandardMaterial({
      map: stoneTexture({ base: '#363b3a', accent: '#707a70', moss: '#2b4537', seed: 63 }),
      color: 0xc8d0c4,
      roughness: 0.92,
      metalness: 0.06
    })
    const glow = new THREE.MeshBasicMaterial({ color: this.shard.color })
    for (let i = 0; i < 4; i++) {
      const z = 18 - i * 3.4
      for (const side of [-1, 1]) {
        const x = side * 3.55
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 0.62, 7), stone)
        plinth.position.set(x, 0.31, z)
        plinth.castShadow = true
        this.scene.add(plinth)
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), glow)
        core.position.set(x, 0.82, z)
        this.scene.add(core)
        const halo = glowSprite(this.shard.color, 1.7, 0.25)
        halo.position.set(x, 0.84, z)
        this.scene.add(halo)
        if (i === 0) {
          this.addCircleCollider(x, z, 0.35, 1)
          this.cameraBlockers.push(plinth)
        }
      }
    }
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 17),
      new THREE.MeshBasicMaterial({ color: this.shard.color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    strip.rotation.x = -Math.PI / 2
    strip.position.set(0, 0.025, 13)
    this.scene.add(strip)
  }

  buildReturnGate() {
    const group = new THREE.Group()
    group.position.set(0, 0, 16)
    group.rotation.y = Math.PI
    const stone = new THREE.MeshStandardMaterial({
      map: stoneTexture({ base: '#394044', accent: '#6c7775', moss: '#274437', seed: 71 }),
      color: 0xc9d3cb,
      roughness: 0.9,
      metalness: 0.08
    })
    const rune = new THREE.MeshStandardMaterial({
      color: this.shard.color,
      emissive: this.shard.color,
      emissiveIntensity: 1.45,
      roughness: 0.35,
      metalness: 0.5
    })
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4 + (i % 2) * 0.6, 0.6), stone)
      pillar.position.set(Math.cos(angle) * 2.7, 1.2 + (i % 2) * 0.3, Math.sin(angle) * 2.7)
      pillar.rotation.y = -angle
      pillar.castShadow = true
      group.add(pillar)
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.22, 8, 40), stone)
    arch.position.y = 2.9
    group.add(arch)
    const archRune = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.04, 6, 40), rune)
    archRune.position.y = 2.9
    archRune.position.z = 0.24
    group.add(archRune)
    const disc = makePortalDisc(this.shard.color, true)
    disc.position.y = 2.75
    group.add(disc)
    this.returnDisc = disc
    const beam = makeBeam(this.shard.color, 16, 0.24, 0.24)
    beam.position.y = 0.4
    group.add(beam)
    this.returnBeam = beam
    const halo = glowSprite(this.shard.color, 6, 0.3)
    halo.position.y = 2.7
    group.add(halo)
    this.returnHalo = halo
    group.visible = false
    this.scene.add(group)
    this.returnGate = group
    this.returnPos = group.position.clone()
  }

  createBoss({ hp, position = new THREE.Vector3(), radius = 2.4, height = 5.5, group, visual, color, attackTimer = 2.5 }) {
    const boss = new Boss(this.scene, this, {
      name: this.shard.guardian,
      hp,
      position,
      radius,
      height,
      group,
      visual,
      color,
      attackTimer
    })
    boss.updateLogic = (dt, ctx) => this.updateBossLogic(dt, ctx)
    this.boss = boss
    return boss
  }

  onEnter() {
    this.game.ui.showBoss(this.shard.guardian, this.shard.rule)
    this.game.ui.updateBoss(this.boss?.hp ?? 1, this.boss?.maxHp ?? 1)
    this.game.ui.setRule(this.shard.rule, this.ruleDetail, true)
    this.game.ui.setKeys(this.game.stateData.keys)
    this.game.audio.setScene(this.shard.id)
    this.game.player.sunbond = false
    this.compassVisible = true
    if (this.shard.id === 'shadow') {
      this.game.ui.setHudDark(true)
      this.compassVisible = false
    }
  }

  onExit() {
    this.game.ui.hideBoss()
    this.game.ui.setRule('', '', false)
    this.game.ui.setSpecial(false)
    this.game.ui.setHudDark(false)
    this.game.player.sunbond = false
    this.game.player.speedScale = 1
    this.game.ui.setKeys(this.game.stateData.keys)
    if (this.playerLight) this.playerLight.visible = true
  }

  onBossDefeated() {
    const shard = this.shard
    const state = this.game.stateData
    if (!state.keys.includes(shard.id)) {
      state.keys.push(shard.id)
      state.shardsCleared++
    }
    this.returnOpen = true
    this.returnGate.visible = true
    this.effects.burst(this.returnPos.clone().add(new THREE.Vector3(0, 2.8, 0)), shard.color, 45, 6.5, 1.4, 0.4)
    this.effects.shockwave(this.returnPos, shard.color, 7, 0.9)
    this.game.gainVirtue(shard.virtue, 40)
    this.game.ui.setKeys(state.keys)
    this.game.ui.hideBoss()
    this.game.ui.setRule(shard.rule, 'Guardian vanquished. The gate home is open.', true)
    this.game.ui.toast(`${shard.guardian} has fallen — the ${VIRTUES[shard.virtue].name} Shard Key is yours`, 'gold', 5200)
    this.game.refreshObjective()
    this.game.audio.victory()
    if (shard.id === 'shadow') {
      this.game.ui.setHudDark(false)
      this.compassVisible = true
    }
    this.ruleDetail = 'Guardian vanquished. The gate home is open.'
  }

  update(dt, ctx) {
    this.time += dt
    if (this.boss) this.boss.update(dt, ctx)
    this.updateEnvironment(dt, ctx)
    this.updateRules(dt, ctx)
    if (this.returnOpen) {
      if (this.returnDisc) this.returnDisc.userData.portalMaterial.uniforms.uTime.value = this.time
      this.returnGate.rotation.y += dt * 0.15
      this.returnHalo.material.opacity = 0.22 + Math.sin(this.time * 2.1) * 0.08
      this.returnBeam.rotation.y += dt * 0.4
    }
    this.updateCommon(dt, { ...ctx, world: this })
    this.syncLabels()
  }

  syncLabels() {
    const detail = this.ruleDetail
    if (detail !== this.ruleDetailCache) {
      this.ruleDetailCache = detail
      this.game.ui.setRule(this.shard.rule, detail, true)
    }
  }

  updateEnvironment() {}

  updateRules() {}

  updateBossLogic() {}

  filterBossDamage(boss, amount) {
    return { amount }
  }

  getInteractable(player) {
    if (this.returnOpen) {
      const distance = Math.hypot(player.position.x - this.returnPos.x, player.position.z - this.returnPos.z)
      if (distance < 5) {
        return { id: 'return', label: 'Return to the Nexus', action: 'return', range: 5 }
      }
    }
    return null
  }

  interact(action, game) {
    if (action === 'return') game.returnToHub(this.shard)
  }

  getCompassTarget() {
    if (this.boss && !this.boss.dead) return { position: this.boss.position, label: this.shard.guardian }
    if (this.returnOpen) return { position: this.returnPos, label: 'Nexus gate' }
    return null
  }

  getRule() {
    return { name: this.shard.rule, detail: this.ruleDetail }
  }

  getSpecial() {
    return null
  }

  spawnAdd(type, color, position) {
    return this.spawnEnemy({
      type,
      position,
      color,
      hp: type === 'wisp' ? 40 : 52,
      damage: 8,
      ranged: type === 'wisp',
      attackRange: type === 'wisp' ? 8 : 2.1,
      aggroRange: 24,
      isBossAdd: true
    })
  }
}

export class ElderwoodWorld extends ShardWorld {
  constructor(game, shard) {
    super(game, shard)
  }

  buildEnvironment() {
    this.setupCommonEnvironment({
      top: 0x04110d,
      horizon: 0x1b4a32,
      bottom: 0x020705,
      glow: 0x76e6a2,
      fogColor: 0x081a11,
      fogDensity: 0.026,
      stars: 240,
      starColor: 0xbaf7cf,
      hemiSky: 0x75d9a0,
      hemiGround: 0x11170d,
      hemiIntensity: 0.7,
      ambient: 0x2b503a,
      ambientIntensity: 0.35,
      sunColor: 0xffe8b8,
      sunIntensity: 2,
      sunPosition: [20, 34, 12]
    })
    this.buildGround({ base: '#22352a', moss: '#376b46', seed: 31, color: 0xaebfae, repeat: 10 })
    this.addCliffs({ color: 0x263b30, count: 24, minHeight: 5, maxHeight: 12 })

    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2a1e, roughness: 0.95 })
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x1a3b28, roughness: 0.9, flatShading: true })
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + this.random() * 0.2
      const radius = 24 + this.random() * 8
      const tx = Math.cos(angle) * radius
      const tz = Math.sin(angle) * radius
      if (Math.abs(tx) < 8 && tz > 1) continue
      if (Math.hypot(tx, tz - 22) < 12) continue
      const height = 12 + this.random() * 13
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.6, height, 7), trunkMaterial)
      trunk.position.set(tx, height / 2, tz)
      trunk.rotation.z = (this.random() - 0.5) * 0.12
      trunk.castShadow = true
      this.scene.add(trunk)
      this.cameraBlockers.push(trunk)
      for (let c = 0; c < 3; c++) {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + this.random() * 2.4, 0), foliageMaterial)
        crown.position.set(trunk.position.x + (this.random() - 0.5) * 4, height - 2 + c * 2.6, trunk.position.z + (this.random() - 0.5) * 4)
        crown.scale.y = 0.7
        crown.castShadow = true
        this.scene.add(crown)
      }
      const root = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 7), trunkMaterial)
      root.position.set(trunk.position.x, 1.2, trunk.position.z)
      root.rotation.x = Math.PI
      this.scene.add(root)
    }

    const glowMushroom = new THREE.MeshStandardMaterial({ color: 0x3f8f62, emissive: 0x74e6a2, emissiveIntensity: 0.65, roughness: 0.55 })
    for (let i = 0; i < 26; i++) {
      const angle = this.random() * Math.PI * 2
      const radius = 8 + this.random() * 22
      const mx = Math.cos(angle) * radius
      const mz = Math.sin(angle) * radius
      if (Math.abs(mx) < 5 && mz > 4) continue
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 5), new THREE.MeshStandardMaterial({ color: 0xcfd6bd }))
      stem.position.set(mx, 0.2, mz)
      this.scene.add(stem)
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12 + this.random() * 0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), glowMushroom)
      cap.position.set(mx, 0.43, mz)
      this.scene.add(cap)
    }

    for (let i = 0; i < 4; i++) {
      const angle = 0.4 + i * 1.6
      const shaft = makeLightShaft(0xffe6a8, 2.4 + this.random() * 2, 30, 0.05)
      shaft.position.set(Math.cos(angle) * (12 + this.random() * 12), 0, Math.sin(angle) * (12 + this.random() * 12))
      this.scene.add(shaft)
    }

    const poolMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd84,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe8ae,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    this.sunPools = []
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.4
      const position = new THREE.Vector3(Math.cos(angle) * 5.1, 0.06, Math.sin(angle) * 5.1)
      const disc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 42), poolMaterial.clone())
      disc.rotation.x = -Math.PI / 2
      disc.position.copy(position)
      this.scene.add(disc)
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.3, 42), ringMaterial.clone())
      ring.rotation.x = -Math.PI / 2
      ring.position.copy(position).setY(0.08)
      this.scene.add(ring)
      const shaft = makeLightShaft(0xffe2a0, 2.9, 18, 0.06)
      shaft.position.copy(position)
      this.scene.add(shaft)
      const sunLight = new THREE.PointLight(0xffcf7a, 5.5, 9, 2)
      sunLight.position.copy(position).setY(1.3)
      this.scene.add(sunLight)
      this.sunPools.push({ position, radius: 3.2, disc, ring, shaft, light: sunLight })
    }

    const spores = makeMotes({ count: 130, color: 0x9dffc4, radius: 30, height: 12, size: 0.28, seed: 51, opacity: 0.6 })
    this.scene.add(spores)
    this.envMotes.push(spores)
    const goldMotes = makeMotes({ count: 60, color: 0xffe3a0, radius: 18, height: 8, size: 0.22, seed: 55, opacity: 0.45 })
    this.scene.add(goldMotes)
    this.envMotes.push(goldMotes)

    this.rot = []
    for (let i = 0; i < 12; i++) {
      const rock = makeRubbleStone(0.3 + this.random() * 0.8, 0x33453a, 500 + i)
      const angle = this.random() * Math.PI * 2
      const radius = 10 + this.random() * 20
      rock.position.set(Math.cos(angle) * radius, 0.3, Math.sin(angle) * radius)
      rock.rotation.set(this.random(), this.random(), this.random())
      this.scene.add(rock)
    }
  }

  setupBoss() {
    const group = new THREE.Group()
    const visual = new THREE.Group()
    group.add(visual)
    const bark = new THREE.MeshStandardMaterial({ color: 0x332b1e, roughness: 0.95, flatShading: true })
    const barkDark = new THREE.MeshStandardMaterial({ color: 0x1c1810, roughness: 1, flatShading: true })
    const heart = new THREE.MeshStandardMaterial({
      color: 0xff5b5b,
      emissive: 0xff3030,
      emissiveIntensity: 1.5,
      roughness: 0.35,
      metalness: 0.1
    })
    const thorn = new THREE.MeshStandardMaterial({ color: 0x6d7f4b, emissive: 0x2c4a24, emissiveIntensity: 0.6, roughness: 0.7 })

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.7, 4.4, 8), bark)
    trunk.position.y = 2.2
    trunk.rotation.z = 0.05
    trunk.castShadow = true
    visual.add(trunk)
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.5, 2.6, 7), barkDark)
    upper.position.y = 5
    upper.rotation.z = -0.08
    upper.castShadow = true
    visual.add(upper)
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2
      const root = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 6), bark)
      root.position.set(Math.cos(angle) * 1.7, 0.5, Math.sin(angle) * 1.7)
      root.rotation.z = Math.PI / 2.3
      root.rotation.y = -angle
      visual.add(root)
    }
    const heartMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), heart)
    heartMesh.position.set(0, 3.8, 0.95)
    heartMesh.scale.set(1, 1.2, 0.7)
    visual.add(heartMesh)
    const heartHalo = glowSprite(0xff5a5a, 6, 0.45)
    heartHalo.position.copy(heartMesh.position)
    visual.add(heartHalo)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.2
      const branch = new THREE.Mesh(new THREE.ConeGeometry(0.22, 3 + this.random() * 2, 5), thorn)
      branch.position.set(Math.cos(angle) * 2.4, 3.2 + this.random() * 2.4, Math.sin(angle) * 2.4)
      branch.rotation.z = 0.7 + Math.random() * 0.6
      branch.rotation.y = -angle
      visual.add(branch)
    }

    this.thornBeams = new THREE.Group()
    const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xff7b6b, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
    for (const angle of [0, Math.PI]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.12, 0.12), beamMaterial)
      arm.position.set(Math.cos(angle) * 4.3, 1.5, Math.sin(angle) * 4.3)
      arm.rotation.y = -angle
      this.thornBeams.add(arm)
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 5), thorn)
        spike.position.set(Math.cos(angle) * (1.5 + i * 1.25), 1.5, Math.sin(angle) * (1.5 + i * 1.25))
        spike.rotation.z = Math.PI / 2
        this.thornBeams.add(spike)
      }
    }
    visual.add(this.thornBeams)
    visual.materials = [bark, barkDark, heart, thorn, beamMaterial]
    this.bossVisual = visual
    this.bossHeart = heartMesh
    this.bossHalo = heartHalo
    this.createBoss({
      hp: this.shard.bossHp,
      position: new THREE.Vector3(0, 0, 0),
      radius: 2.4,
      height: 6.4,
      group,
      visual,
      color: 0xff7a6b,
      attackTimer: 3.4
    })
  }

  updateEnvironment(dt, game) {
    for (const mote of this.envMotes) updateMotes(mote, dt, this.time)
    this.thornBeams.rotation.y = this.beamAngle
    this.bossHeart.scale.set(1 + Math.sin(this.time * 2.3) * 0.06, 1.2 + Math.sin(this.time * 2.3 + 1) * 0.05, 0.7)
    this.bossHalo.material.opacity = 0.35 + Math.sin(this.time * 2.6) * 0.1
    for (const pool of this.sunPools) {
      pool.disc.material.opacity = 0.2 + Math.sin(this.time * 1.4) * 0.04
      pool.ring.rotation.z += dt * 0.2
    }
  }

  updateRules(dt, ctx) {
    const player = ctx.player
    if (!this.boss || this.boss.dead) {
      player.sunbond = false
      return
    }
    let inSun = false
    for (const pool of this.sunPools) {
      if (Math.hypot(player.position.x - pool.position.x, player.position.z - pool.position.z) < pool.radius) {
        inSun = true
        break
      }
    }
    player.sunbond = inSun
    if (inSun && player.alive) {
      player.health = clamp(player.health + dt * 2.4, 0, player.maxHealth)
    }
    this.ruleDetail = inSun
      ? 'SUNBOND — the Heart is exposed to your strikes'
      : 'SHADOW — the Heart reflects your violence'
    this.beamAngle += dt * 0.55
    this.beamTick = Math.max(0, (this.beamTick ?? 0) - dt)
    if (this.beamTick <= 0 && player.alive) {
      const dx = player.position.x
      const dz = player.position.z
      const distance = Math.hypot(dx, dz)
      if (distance > 1.4 && distance < 9.4) {
        const angle = Math.atan2(dz, dx)
        for (const offset of [0, Math.PI]) {
          if (Math.abs(angleDelta(angle, this.boss.group.rotation.y + this.beamAngle + offset)) < 0.075) {
            player.takeDamage(8, { world: this, effects: this.effects, audio: this.audio, ui: this.ui })
            this.beamTick = 0.6
            break
          }
        }
      }
    }
    this.thornTimer = (this.thornTimer ?? 4.2) - dt
    if (this.thornTimer <= 0) {
      this.thornTimer = 4.4
      this.spawnHazard({
        position: new THREE.Vector3(player.position.x, 0, player.position.z),
        radius: 2.4,
        delay: 1.1,
        duration: 0.2,
        damage: 13,
        color: 0xff5a6a
      })
    }
    this.pulseTimer = (this.pulseTimer ?? 7.5) - dt
    if (this.pulseTimer <= 0) {
      this.pulseTimer = 8.2
      this.spawnHazard({ position: this.boss.position.clone(), radius: 4.6, delay: 1.3, duration: 0.25, damage: 15, color: 0xff8b6a })
    }
    this.addTimer = (this.addTimer ?? 12) - dt
    if (this.addTimer <= 0) {
      this.addTimer = 15
      if (this.enemies.filter(enemy => !enemy.dead).length < 4) {
        const angle = Math.random() * Math.PI * 2
        this.spawnAdd('wisp', 0x8dffc2, new THREE.Vector3(Math.cos(angle) * 7, 0, Math.sin(angle) * 7))
      }
    }
  }

  filterBossDamage(boss, amount, opts) {
    if (opts.player?.sunbond) return { amount, crit: opts.crit }
    if (!this.firstRuleWarn) {
      this.firstRuleWarn = true
      this.game.ui.toast('The Heart recoils. Stand in the sunlight to wound it.', 'virtue', 3800)
    }
    return { amount: Math.round(amount * 0.22), recoil: 4 }
  }

  updateBossLogic(dt, ctx) {
    if (!this.boss || this.boss.dead) return
    const player = ctx.player
    this.boss.group.rotation.y = Math.atan2(player.position.x, player.position.z)
    this.boss.group.position.copy(this.boss.position)
    this.boss.visual.position.y = Math.sin(this.time * 1.1) * 0.12
  }
}

export class IronWorld extends ShardWorld {
  constructor(game, shard) {
    super(game, shard)
  }

  buildEnvironment() {
    this.setupCommonEnvironment({
      top: 0x120806,
      horizon: 0x6b3318,
      bottom: 0x080302,
      glow: 0xff9a5f,
      fogColor: 0x1a0d08,
      fogDensity: 0.025,
      stars: 130,
      starColor: 0xffc099,
      hemiSky: 0xb86a40,
      hemiGround: 0x120b08,
      hemiIntensity: 0.5,
      ambient: 0x4d2a1b,
      ambientIntensity: 0.35,
      sunColor: 0xffa765,
      sunIntensity: 1.8,
      sunPosition: [-24, 30, 16]
    })
    this.buildGround({ base: '#3a2a21', moss: '#6b3f24', seed: 77, color: 0xc6b3a2, repeat: 11, edgeColor: 0x2a1a13 })
    this.addCliffs({ color: 0x3d2a20, count: 22, minHeight: 4, maxHeight: 11 })

    const metal = new THREE.MeshStandardMaterial({ color: 0x3d3b38, roughness: 0.55, metalness: 0.75 })
    const rust = new THREE.MeshStandardMaterial({ color: 0x6b3a26, roughness: 0.85, metalness: 0.4 })
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.7
      const radius = 22 + this.random() * 6
      const gear = new THREE.Group()
      const rim = new THREE.Mesh(new THREE.TorusGeometry(3 + i * 0.5, 0.5, 8, 26), metal)
      gear.add(rim)
      for (let s = 0; s < 8; s++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), rust)
        const a = (s / 8) * Math.PI * 2
        tooth.position.set(Math.cos(a) * (3 + i * 0.5), Math.sin(a) * (3 + i * 0.5), 0)
        tooth.rotation.z = a
        gear.add(tooth)
      }
      for (let s = 0; s < 4; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.8, 0.28), metal)
        spoke.rotation.z = (s / 4) * Math.PI
        gear.add(spoke)
      }
      gear.position.set(Math.cos(angle) * radius, 3.4 + i * 0.8, Math.sin(angle) * radius)
      gear.rotation.y = -angle + Math.PI / 2
      gear.rotation.z = this.random() * 0.4
      this.scene.add(gear)
      this.gears = this.gears || []
      this.gears.push(gear)
    }

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.2
      const radius = 12 + this.random() * 16
      const px = Math.cos(angle) * radius
      const pz = Math.sin(angle) * radius
      if (Math.abs(px) < 7 && pz > 2) continue
      const height = 3 + this.random() * 7
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2 + this.random(), height, 1.2), i % 2 ? metal : rust)
      pillar.position.set(px, height / 2, pz)
      pillar.rotation.y = this.random() * Math.PI
      pillar.castShadow = true
      pillar.receiveShadow = true
      this.scene.add(pillar)
      this.cameraBlockers.push(pillar)
      this.addBoxCollider(pillar.position.x, pillar.position.z, 1.6, 1.6, height)
    }

    for (let i = 0; i < 5; i++) {
      const wreck = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 5 + this.random() * 4, 6), rust)
      const angle = this.random() * Math.PI * 2
      const radius = 17 + this.random() * 10
      wreck.position.set(Math.cos(angle) * radius, 2, Math.sin(angle) * radius)
      wreck.rotation.z = 1.1 + this.random() * 0.5
      wreck.castShadow = true
      this.scene.add(wreck)
    }

    const sand = makeMotes({ count: 180, color: 0xffb27a, radius: 34, height: 9, size: 0.3, seed: 82, opacity: 0.45 })
    this.scene.add(sand)
    this.envMotes.push(sand)
    this.sandMotes = sand
    const ember = makeMotes({ count: 40, color: 0xff6a3c, radius: 25, height: 6, size: 0.22, seed: 88, opacity: 0.55 })
    this.scene.add(ember)
    this.envMotes.push(ember)

    const coreLight = new THREE.PointLight(0xff8a4a, 12, 28, 2)
    coreLight.position.set(0, 5, 0)
    this.scene.add(coreLight)
    this.arenaLight = coreLight

    const arenaRing = new THREE.Mesh(
      new THREE.RingGeometry(9.4, 9.7, 64),
      new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    )
    arenaRing.rotation.x = -Math.PI / 2
    arenaRing.position.y = 0.05
    this.scene.add(arenaRing)
    this.arenaRing = arenaRing
  }

  setupBoss() {
    const group = new THREE.Group()
    const visual = new THREE.Group()
    group.add(visual)
    const plate = new THREE.MeshStandardMaterial({ color: 0x4e4a44, roughness: 0.5, metalness: 0.8 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x252320, roughness: 0.7, metalness: 0.5 })
    const rust = new THREE.MeshStandardMaterial({ color: 0x7a4429, roughness: 0.8, metalness: 0.45 })
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x69e6ff,
      emissive: 0x2bc8ff,
      emissiveIntensity: 1.8,
      roughness: 0.25,
      metalness: 0.3
    })

    const torso = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.8, 2.2), plate)
    torso.position.y = 4.2
    torso.castShadow = true
    visual.add(torso)
    const chest = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.5), rust)
    chest.position.set(0, 4.4, 1.18)
    visual.add(chest)
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 12), coreMaterial)
    core.position.set(0, 4.3, 1.5)
    visual.add(core)
    const coreHalo = glowSprite(0x5fe4ff, 4.4, 0.4)
    coreHalo.position.copy(core.position)
    visual.add(coreHalo)
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.2), dark)
    head.position.y = 6
    visual.add(head)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.17, 0.1), new THREE.MeshBasicMaterial({ color: 0xff8a5c }))
    visor.position.set(0, 6.02, 0.66)
    visual.add(visor)
    this.ironLegs = []
    for (const side of [-1, 1]) {
      const leg = new THREE.Group()
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.5, 1.1), plate)
      thigh.position.y = 1.25
      leg.add(thigh)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.8), dark)
      foot.position.set(0, 0.1, 0.25)
      leg.add(foot)
      leg.position.set(side * 0.95, 0, 0)
      visual.add(leg)
      this.ironLegs.push(leg)
      const arm = new THREE.Group()
      const upper = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), rust)
      upper.position.y = -0.7
      arm.add(upper)
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.9), plate)
      lower.position.y = -2
      arm.add(lower)
      const fist = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.9, 1.2), dark)
      fist.position.y = -3.2
      arm.add(fist)
      arm.position.set(side * 2.35, 5, 0)
      arm.rotation.z = side * 0.1
      visual.add(arm)
      if (side === -1) this.ironArmL = arm
      else this.ironArmR = arm
    }

    const auraMaterial = new THREE.MeshBasicMaterial({
      color: 0x5fe4ff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const aura = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.15, 48), auraMaterial)
    aura.rotation.x = -Math.PI / 2
    aura.position.y = 0.08
    visual.add(aura)
    this.ironAura = aura
    visual.materials = [plate, dark, rust, coreMaterial]
    this.ironCore = core
    this.ironCoreHalo = coreHalo
    this.createBoss({
      hp: this.shard.bossHp,
      position: new THREE.Vector3(0, 0, 0),
      radius: 2.6,
      height: 7,
      group,
      visual,
      color: 0xff8a5c,
      attackTimer: 2.4
    })
    this.boss.polarity = true
    this.boss.polarityTimer = 7
    this.playerPolarity = false
    this.polarityWarned = false
    this.addsSpawned = false
  }

  updateEnvironment(dt) {
    for (const mote of this.envMotes) {
      updateMotes(mote, dt, this.time)
      if (mote === this.sandMotes) {
        mote.rotation.y += dt * 0.04
      }
    }
    this.gears?.forEach((gear, i) => {
      gear.rotation.z += dt * (0.08 + i * 0.02) * (i % 2 ? -1 : 1)
    })
    this.arenaRing.rotation.z += dt * 0.13
  }

  updateRules(dt, ctx) {
    const player = ctx.player
    if (!this.boss || this.boss.dead) return
    this.boss.polarityTimer -= dt
    if (this.boss.polarityTimer <= 0) {
      this.boss.polarityTimer = 7.5
      this.boss.polarity = !this.boss.polarity
      this.effects.shockwave(this.boss.position, this.boss.polarity ? 0x5fe4ff : 0xff5a5a, 5, 0.6)
      this.game.audio.tone({ freq: 320, endFreq: 180, duration: 0.4, type: 'sawtooth', volume: 0.06 })
    }
    const polarityColor = this.boss.polarity ? 0x5fe4ff : 0xff5a5a
    this.ironAura.material.color.setHex(polarityColor)
    this.ironAura.material.opacity = 0.28 + Math.sin(this.time * 2.2) * 0.08
    this.ironCore.material.emissive.setHex(polarityColor)
    this.ironCoreHalo.material.color.setHex(polarityColor)
    this.ironCoreHalo.material.opacity = 0.26 + Math.sin(this.time * 2.4) * 0.08
    this.arenaLight.color.setHex(polarityColor)
    const aligned = this.playerPolarity === this.boss.polarity
    this.ruleDetail = `POLARITY — you are ${this.playerPolarity ? 'REPEL' : 'ATTRACT'}; the Colossus is ${this.boss.polarity ? 'REPEL' : 'ATTRACT'}. ${aligned ? 'ALIGNED — invert to wound.' : 'OPPOSED — strike now.'}`
    if (this.boss.hp < this.boss.maxHp * 0.5 && !this.addsSpawned) {
      this.addsSpawned = true
      for (let i = 0; i < 2; i++) {
        const angle = (i / 2) * Math.PI * 2
        this.spawnAdd('sentinel', 0x5fe4ff, new THREE.Vector3(Math.cos(angle) * 8, 0, Math.sin(angle) * 8))
      }
      this.game.ui.toast('The Colossus calls its sentinels.', 'virtue', 2600)
    }
    void player
  }

  filterBossDamage(boss, amount, opts) {
    if (this.playerPolarity !== boss.polarity) return { amount, crit: opts.crit }
    if (!this.polarityWarned) {
      this.polarityWarned = true
      this.game.ui.toast('Aligned polarity. Use TOUCH to invert, then strike.', 'virtue', 3800)
    }
    return { amount: Math.round(amount * 0.22), recoil: 5 }
  }

  updateBossLogic(dt, ctx) {
    if (!this.boss || this.boss.dead) return
    const player = ctx.player
    const boss = this.boss
    const dx = player.position.x - boss.position.x
    const dz = player.position.z - boss.position.z
    const distance = Math.hypot(dx, dz)
    const targetFacing = Math.atan2(dx, dz)
    boss.group.rotation.y += angleDelta(boss.group.rotation.y, targetFacing) * Math.min(1, dt * 3)
    if (distance > 4.2) {
      const vx = (dx / distance) * 2.15
      const vz = (dz / distance) * 2.15
      boss.position.x += vx * dt
      boss.position.z += vz * dt
      this.resolveCollisions(boss.position, 2.2)
    }
    boss.group.position.copy(boss.position)
    boss.attackTimer -= dt
    if (boss.attackTimer <= 0 && distance < 5.2) {
      boss.attackTimer = 3.1
      this.spawnHazard({
        position: new THREE.Vector3(player.position.x, 0, player.position.z),
        radius: 3.2,
        delay: 0.9,
        duration: 0.25,
        damage: 17,
        color: 0xff5a5a
      })
      this.game.audio.bossRoar()
      this.effects.shockwave(boss.position, 0xff8a5c, 6, 0.7)
      this.ironArmR.rotation.x = -1.2
      setTimeout(() => { this.ironArmR.rotation.x = 0 }, 220)
    }
    const walk = Math.sin(this.time * 4.2) * 0.2
    this.ironLegs[0].rotation.x = walk
    this.ironLegs[1].rotation.x = -walk
    this.ironArmL.rotation.x = -walk * 0.4
    this.boss.visual.position.y = Math.abs(Math.sin(this.time * 4.2)) * 0.06
    this.boss.group.scale.setScalar(1 + this.boss.flash * 0.8)
  }

  getInteractable(player) {
    if (this.boss && !this.boss.dead) {
      return {
        id: 'polarity',
        label: `Invert Polarity — now ${this.playerPolarity ? 'REPEL' : 'ATTRACT'}`,
        action: 'polarity',
        range: 999
      }
    }
    return super.getInteractable(player)
  }

  interact(action, game) {
    if (action === 'polarity') {
      this.playerPolarity = !this.playerPolarity
      this.effects.shockwave(this.game.player.position, this.playerPolarity ? 0x5fe4ff : 0xff5a5a, 2.6, 0.45)
      this.game.player.ringMaterial.color.setHex(this.playerPolarity ? 0x5fe4ff : 0xff5a5a)
      this.game.audio.click()
      this.game.audio.tone({ freq: this.playerPolarity ? 440 : 300, endFreq: this.playerPolarity ? 660 : 220, duration: 0.35, type: 'triangle', volume: 0.1 })
      return
    }
    super.interact(action, game)
  }
}

export class AstralWorld extends ShardWorld {
  constructor(game, shard) {
    super(game, shard)
    this.light = 100
    this.sicknessTick = 0
    this.teleportTimer = 6
    this.volleyTimer = 1.5
    this.zoneTimer = 4
  }

  buildEnvironment() {
    this.setupCommonEnvironment({
      top: 0x030216,
      horizon: 0x241a5b,
      bottom: 0x020108,
      glow: 0x9584ff,
      fogColor: 0x08061c,
      fogDensity: 0.016,
      stars: 650,
      starColor: 0xcbbfff,
      hemiSky: 0x7c74d8,
      hemiGround: 0x0c0a1c,
      hemiIntensity: 0.58,
      ambient: 0x2d2a58,
      ambientIntensity: 0.38,
      sunColor: 0xb8b0ff,
      sunIntensity: 1.25,
      sunPosition: [28, 36, -18]
    })
    for (let i = 0; i < 6; i++) {
      const nebula = glowSprite(i % 2 ? 0x7a5fff : 0x3f7fff, 30 + this.random() * 24, 0.045)
      nebula.position.set((this.random() - 0.5) * 150, 20 + this.random() * 55, (this.random() - 0.5) * 150)
      this.scene.add(nebula)
    }
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(36, 28, 5.4, 96),
      new THREE.MeshStandardMaterial({ color: 0x1a1730, roughness: 0.95, metalness: 0.08 })
    )
    island.position.y = -2.7
    island.receiveShadow = true
    this.scene.add(island)
    this.buildGround({ base: '#1c1a30', moss: '#3a3568', seed: 93, color: 0x9b98bd, repeat: 12, edgeColor: 0x100e20 })
    this.addCliffs({ color: 0x232043, count: 20, minHeight: 2, maxHeight: 7 })

    const crystal = new THREE.MeshStandardMaterial({ color: 0x6d63d8, emissive: 0x453bff, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.3 })
    for (let i = 0; i < 16; i++) {
      const angle = this.random() * Math.PI * 2
      const radius = 15 + this.random() * 16
      const cx = Math.cos(angle) * radius
      const cz = Math.sin(angle) * radius
      if (Math.abs(cx) < 8 && cz > 1) continue
      const h = 2 + this.random() * 6
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.4 + this.random() * 0.8, h, 5), crystal)
      shard.position.set(cx, h / 2, cz)
      shard.rotation.z = (this.random() - 0.5) * 0.4
      shard.castShadow = true
      this.scene.add(shard)
      this.cameraBlockers.push(shard)
    }

    this.floatingRocks = []
    for (let i = 0; i < 18; i++) {
      const rock = makeRubbleStone(0.7 + this.random() * 2.4, 0x272341, 600 + i)
      const angle = this.random() * Math.PI * 2
      const radius = 38 + this.random() * 14
      rock.position.set(Math.cos(angle) * radius, 4 + this.random() * 16, Math.sin(angle) * radius)
      rock.userData.baseY = rock.position.y
      rock.userData.phase = this.random() * 12
      this.scene.add(rock)
      this.floatingRocks.push(rock)
    }

    const poolMaterial = new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xd6f6ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.7
      const position = new THREE.Vector3(Math.cos(angle) * 9, 0.06, Math.sin(angle) * 9)
      const disc = new THREE.Mesh(new THREE.CircleGeometry(3.8, 42), poolMaterial.clone())
      disc.rotation.x = -Math.PI / 2
      disc.position.copy(position)
      this.scene.add(disc)
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.7, 3.9, 48), ringMaterial.clone())
      ring.rotation.x = -Math.PI / 2
      ring.position.copy(position).setY(0.08)
      this.scene.add(ring)
      const beam = makeBeam(0x9fdcff, 9, 0.16, 0.1)
      beam.position.copy(position)
      this.scene.add(beam)
      this.lightPools.push({ position, radius: 3.8, disc, ring, beam })
    }

    const starMotes = makeMotes({ count: 190, color: 0xb7a9ff, radius: 34, height: 14, size: 0.26, seed: 99, opacity: 0.55 })
    this.scene.add(starMotes)
    this.envMotes.push(starMotes)
    const lightMotes = makeMotes({ count: 70, color: 0x9fe8ff, radius: 18, height: 9, size: 0.22, seed: 100, opacity: 0.6 })
    this.scene.add(lightMotes)
    this.envMotes.push(lightMotes)
  }

  setupBoss() {
    const group = new THREE.Group()
    const visual = new THREE.Group()
    group.add(visual)
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x101031, emissive: 0x7f7bff, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.5 })
    const irisMaterial = new THREE.MeshBasicMaterial({ color: 0xd8f6ff })
    const shardMaterial = new THREE.MeshStandardMaterial({ color: 0x4f47b8, emissive: 0x2c27d8, emissiveIntensity: 0.9, roughness: 0.4, transparent: true, opacity: 0.9 })
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 16), eyeMaterial)
    eye.position.y = 3.7
    visual.add(eye)
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), irisMaterial)
    iris.position.set(0, 3.7, 1)
    visual.add(iris)
    const halo = glowSprite(0x9f8cff, 7, 0.4)
    halo.position.y = 3.7
    visual.add(halo)
    this.astralOrbit = new THREE.Group()
    this.astralOrbit.position.y = 3.7
    for (let i = 0; i < 7; i++) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.36 + (i % 3) * 0.14, 0), shardMaterial)
      const angle = (i / 7) * Math.PI * 2
      shard.position.set(Math.cos(angle) * (3.2 + (i % 2) * 0.6), Math.sin(angle * 2) * 0.7, Math.sin(angle) * (3.2 + (i % 2) * 0.6))
      this.astralOrbit.add(shard)
    }
    visual.add(this.astralOrbit)
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 0.8, 0.03, 5, 48), new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }))
      ring.rotation.x = Math.PI / 2 + i * 0.3
      ring.rotation.z = i * 0.6
      ring.position.y = 3.7
      visual.add(ring)
      if (i === 0) this.astralRingA = ring
      else if (i === 1) this.astralRingB = ring
    }
    for (let i = 0; i < 5; i++) {
      const tendril = new THREE.Mesh(new THREE.ConeGeometry(0.1, 2.2, 5), shardMaterial)
      const angle = (i / 5) * Math.PI * 2
      tendril.position.set(Math.cos(angle) * 1.2, 2, Math.sin(angle) * 1.2)
      tendril.rotation.z = 0.4
      visual.add(tendril)
    }
    visual.materials = [eyeMaterial, shardMaterial]
    this.astralEye = eye
    this.astralIris = iris
    this.createBoss({
      hp: this.shard.bossHp,
      position: new THREE.Vector3(0, 0, 0),
      radius: 2.3,
      height: 5,
      group,
      visual,
      color: 0x8fdcff,
      attackTimer: 2.6
    })
  }

  updateEnvironment(dt) {
    for (const mote of this.envMotes) updateMotes(mote, dt, this.time)
    this.lightPools.forEach((pool, i) => {
      pool.disc.material.opacity = 0.16 + Math.sin(this.time * 1.4 + i) * 0.05
      pool.ring.rotation.z += dt * 0.18
      pool.beam.rotation.y += dt * 0.2
    })
    this.floatingRocks.forEach(rock => {
      rock.position.y = rock.userData.baseY + Math.sin(this.time * 0.3 + rock.userData.phase) * 1.4
      rock.rotation.y += dt * 0.04
    })
    this.astralOrbit.rotation.y += dt * 0.3
    this.astralOrbit.rotation.z = Math.sin(this.time * 0.5) * 0.1
    this.astralRingA.rotation.z += dt * 0.4
    this.astralRingB.rotation.z -= dt * 0.25
    this.astralIris.scale.setScalar(1 + Math.sin(this.time * 2.4) * 0.06)
    for (let i = this.shadowZones.length - 1; i >= 0; i--) {
      const zone = this.shadowZones[i]
      zone.life -= dt
      zone.mesh.material.opacity = clamp(zone.life / 1.5, 0, 1) * 0.52
      zone.ring.material.opacity = clamp(zone.life / 1.5, 0, 1) * 0.35
      zone.ring.rotation.z += dt * 0.3
      if (zone.life <= 0) {
        this.scene.remove(zone.mesh, zone.ring)
        zone.mesh.material.dispose()
        zone.ring.material.dispose()
        this.shadowZones.splice(i, 1)
      }
    }
  }

  addShadowZone(position, radius = 3.4, life = 7) {
    const material = new THREE.MeshBasicMaterial({ color: 0x03010c, transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(position.x, 0.07, position.z)
    this.scene.add(mesh)
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x6f5cff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.92, radius, 40), ringMaterial)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(position.x, 0.085, position.z)
    this.scene.add(ring)
    this.shadowZones.push({ position: new THREE.Vector3(position.x, 0, position.z), radius, life, mesh, ring })
    this.effects.burst(new THREE.Vector3(position.x, 0.4, position.z), 0x6f5cff, 14, 3, 0.6, 0.3)
  }

  updateRules(dt, ctx) {
    const player = ctx.player
    if (!this.boss || this.boss.dead) {
      this.light = Math.min(100, this.light + dt * 30)
      this.game.ui.setSpecial(false)
      return
    }
    let inPool = false
    for (const pool of this.lightPools) {
      if (Math.hypot(player.position.x - pool.position.x, player.position.z - pool.position.z) < pool.radius) {
        inPool = true
        break
      }
    }
    let inShadow = false
    for (const zone of this.shadowZones) {
      if (Math.hypot(player.position.x - zone.position.x, player.position.z - zone.position.z) < zone.radius) {
        inShadow = true
        break
      }
    }
    if (inPool) this.light += dt * 38
    else if (inShadow) this.light -= dt * 24
    else this.light -= dt * 3.6
    this.light = clamp(this.light, 0, 100)
    player.speedScale = this.light <= 0 ? 0.72 : 1
    if (this.light <= 0) {
      this.sicknessTick -= dt
      if (this.sicknessTick <= 0) {
        this.sicknessTick = 1.2
        player.takeDamage(6, { world: this, effects: this.effects, audio: this.audio, ui: this.ui })
        this.game.ui.toast('Shadow Sickness', 'virtue', 1600)
      }
    } else {
      this.sicknessTick = 1.2
    }
    this.game.ui.setSpecial(true, Math.round(this.light), 'LIGHT')
    this.ruleDetail = inPool
      ? 'LIGHT-BOUND — the pool restores you'
      : inShadow
        ? 'LIGHT-BOUND — shadow is drinking your Light'
        : 'LIGHT-BOUND — find the glowing pools'
    this.volleyTimer -= dt
    if (this.volleyTimer <= 0) {
      this.volleyTimer = 2.7
      const origin = this.boss.position.clone().add(new THREE.Vector3(0, 3, 0))
      const dir = new THREE.Vector3(player.position.x - this.boss.position.x, 0.1, player.position.z - this.boss.position.z).normalize()
      for (let i = -2; i <= 2; i++) {
        const angle = i * 0.16
        const rotated = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
        this.spawnProjectile(origin, rotated, { speed: 10, damage: 8, color: 0x8fdcff, radius: 0.25, life: 3.4, owner: 'enemy' })
      }
      this.game.audio.tone({ freq: 520, endFreq: 260, duration: 0.3, type: 'sine', volume: 0.05 })
    }
    this.teleportTimer -= dt
    if (this.teleportTimer <= 0) {
      this.teleportTimer = 6.5
      this.effects.burst(this.boss.position.clone().add(new THREE.Vector3(0, 3, 0)), 0x8fdcff, 26, 5, 0.8, 0.34)
      const angle = Math.random() * Math.PI * 2
      const radius = 8 + Math.random() * 8
      this.boss.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
      this.boss.group.position.copy(this.boss.position)
      this.effects.shockwave(this.boss.position, 0x8fdcff, 4, 0.5)
      this.game.audio.portal()
    }
    this.zoneTimer -= dt
    if (this.zoneTimer <= 0) {
      this.zoneTimer = 5.4
      this.addShadowZone(player.position.clone(), 3.2, 7)
      this.game.audio.tone({ freq: 120, endFreq: 60, duration: 0.6, type: 'sine', volume: 0.06 })
    }
  }

  filterBossDamage(boss, amount, opts) {
    if (this.light > 15) return { amount, crit: opts.crit }
    if (!this.firstRuleWarn) {
      this.firstRuleWarn = true
      this.game.ui.toast('Your Light is too low to wound the Echo. Find a light pool.', 'virtue', 3600)
    }
    return { amount: Math.round(amount * 0.35) }
  }

  updateBossLogic(dt, ctx) {
    if (!this.boss || this.boss.dead) return
    const player = ctx.player
    const targetFacing = Math.atan2(player.position.x - this.boss.position.x, player.position.z - this.boss.position.z)
    this.boss.group.rotation.y += angleDelta(this.boss.group.rotation.y, targetFacing) * Math.min(1, dt * 2.5)
    this.boss.group.position.copy(this.boss.position)
    this.boss.visual.position.y = 0.45 + Math.sin(this.time * 1.7) * 0.22
    this.astralEye.rotation.y += dt * 0.2
    this.astralIris.rotation.y -= dt * 1.1
  }

  getSpecial() {
    return { visible: true, value: Math.round(this.light), label: 'LIGHT' }
  }
}

export class ShadowWorld extends ShardWorld {
  constructor(game, shard) {
    super(game, shard)
    this.revealed = false
    this.revealTimer = 3
    this.revealDuration = 2.2
    this.whisperTimer = 2
  }

  buildEnvironment() {
    this.setupCommonEnvironment({
      top: 0x010103,
      horizon: 0x0c0814,
      bottom: 0x000000,
      glow: 0x6a3284,
      fogColor: 0x020106,
      fogDensity: 0.055,
      stars: 90,
      starColor: 0x6e5a8f,
      hemiSky: 0x3a2350,
      hemiGround: 0x020102,
      hemiIntensity: 0.14,
      ambient: 0x1a1024,
      ambientIntensity: 0.12,
      sunColor: 0x5a3a78,
      sunIntensity: 0.25,
      sunPosition: [10, 24, 6],
      shadows: false
    })
    this.buildGround({ base: '#17151b', moss: '#241a2e', seed: 120, color: 0x6d6678, repeat: 13, edgeColor: 0x08070b })
    this.addCliffs({ color: 0x16131e, count: 28, minHeight: 5, maxHeight: 14 })

    const stone = new THREE.MeshStandardMaterial({ color: 0x1a1721, roughness: 1 })
    for (let i = 0; i < 14; i++) {
      const angle = this.random() * Math.PI * 2
      const radius = 13 + this.random() * 18
      const sx = Math.cos(angle) * radius
      const sz = Math.sin(angle) * radius
      if (Math.abs(sx) < 8 && sz > 1) continue
      const height = 3 + this.random() * 9
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.5 + this.random() * 1.1, height, 6), stone)
      spike.position.set(sx, height / 2, sz)
      spike.rotation.z = (this.random() - 0.5) * 0.3
      spike.castShadow = true
      this.scene.add(spike)
      this.cameraBlockers.push(spike)
    }

    this.brazierLights = []
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.6
      const radius = 11
      const position = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 1.4, 7), stone)
      base.position.copy(position).setY(0.7)
      this.scene.add(base)
      const flame = makeFlame(i === 1 ? 0xffb35c : 0xbc6bff, 1.1)
      flame.position.copy(position).setY(1.35)
      this.scene.add(flame)
      const light = new THREE.PointLight(i === 1 ? 0xffa54f : 0x9d5cff, 8, 14, 2)
      light.position.copy(position).setY(2)
      this.scene.add(light)
      this.brazierLights.push({ flame, light, position })
    }

    const darkMotes = makeMotes({ count: 110, color: 0x9a7ab8, radius: 30, height: 8, size: 0.22, seed: 121, opacity: 0.35 })
    this.scene.add(darkMotes)
    this.envMotes.push(darkMotes)

    this.playerLight = new THREE.PointLight(0xffca8a, 8, 16, 2)
    this.playerLight.position.set(0, 2.2, 0)
    this.scene.add(this.playerLight)
    const lantern = glowSprite(0xffc98a, 3.4, 0.25)
    this.lanternGlow = lantern
    this.scene.add(lantern)
  }

  setupBoss() {
    const group = new THREE.Group()
    const visual = new THREE.Group()
    group.add(visual)
    const shadowMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b1024,
      emissive: 0x2a1238,
      emissiveIntensity: 0.45,
      roughness: 0.75,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    })
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x09060e, roughness: 0.9, transparent: true, opacity: 0.12 })
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff4f9a })
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.5, 5.1, 9, 4, true), shadowMaterial)
    cloak.position.y = 2.6
    visual.add(cloak)
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 12), shadowMaterial)
    hood.position.y = 5.1
    hood.scale.set(1, 1.15, 1)
    visual.add(hood)
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), darkMaterial)
    face.position.set(0, 5.1, 0.3)
    face.scale.set(1, 1.1, 0.4)
    visual.add(face)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), eyeMaterial)
      eye.position.set(side * 0.19, 5.15, 0.63)
      visual.add(eye)
      this.shadowEye = this.shadowEye || []
      this.shadowEye.push(eye)
      const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 2.6, 5), shadowMaterial)
      antler.position.set(side * 0.5, 6.4, 0)
      antler.rotation.z = side * 0.5
      antler.rotation.x = -0.2
      visual.add(antler)
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 1.5, 5), shadowMaterial)
      branch.position.set(side * 1, 7, 0)
      branch.rotation.z = side * 1.05
      visual.add(branch)
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 3.2, 5), shadowMaterial)
      arm.position.set(side * 1.2, 3.2, 0)
      arm.rotation.z = side * 0.25
      visual.add(arm)
    }
    for (let i = 0; i < 6; i++) {
      const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.2, 5), shadowMaterial)
      const angle = (i / 6) * Math.PI * 2
      wisp.position.set(Math.cos(angle) * 1.4, 0.7, Math.sin(angle) * 1.4)
      wisp.rotation.z = Math.PI
      visual.add(wisp)
    }
    const aura = glowSprite(0x9d5cff, 7, 0.1)
    aura.position.y = 3
    visual.add(aura)
    visual.materials = [shadowMaterial, darkMaterial]
    this.shadowAura = aura
    this.shadowMaterials = [shadowMaterial, darkMaterial]
    this.createBoss({
      hp: this.shard.bossHp,
      position: new THREE.Vector3(0, 0, 2),
      radius: 1.7,
      height: 6.5,
      group,
      visual,
      color: 0xff4f9a,
      attackTimer: 3
    })
  }

  updateEnvironment(dt, ctx) {
    for (const mote of this.envMotes) updateMotes(mote, dt, this.time)
    const player = ctx?.player
    if (player && this.playerLight) {
      if (this.boss && this.boss.dead) {
        this.playerLight.intensity = damp(this.playerLight.intensity, 2, 1.5, dt)
      } else {
        this.playerLight.intensity = 8 + Math.sin(this.time * 3.1) * 0.5
      }
      this.playerLight.position.set(player.position.x, 2.2 + Math.sin(this.time * 1.7) * 0.15, player.position.z)
      this.lanternGlow.position.copy(this.playerLight.position)
      this.lanternGlow.material.opacity = 0.2 + Math.sin(this.time * 2.4) * 0.04
    }
    this.brazierLights.forEach((brazier, i) => {
      brazier.flame.scale.setScalar(0.9 + Math.sin(this.time * 3 + i) * 0.08)
      brazier.light.intensity = 7 + Math.sin(this.time * 2.4 + i * 2) * 1.2
    })
  }

  updateRules(dt, ctx) {
    const player = ctx.player
    if (!this.boss || this.boss.dead) return
    this.revealTimer -= dt
    if (this.revealTimer <= 0) {
      this.revealTimer = 5.2
      this.revealed = true
      this.revealRemaining = this.revealDuration
      this.effects.shockwave(this.boss.position, 0xff4f9a, 7, 0.8)
      this.game.audio.whisper()
      this.game.audio.tone({ freq: 180, endFreq: 420, duration: 0.9, type: 'sine', volume: 0.07 })
    }
    if (this.revealed) {
      this.revealRemaining -= dt
      if (this.revealRemaining <= 0) {
        this.revealed = false
        this.game.audio.whisper()
      }
    }
    const targetOpacity = this.revealed ? 0.92 : 0.1
    for (const material of this.shadowMaterials) material.opacity = damp(material.opacity, targetOpacity, 5, dt)
    this.shadowAura.material.opacity = this.revealed ? 0.32 : 0.08
    this.shadowEye.forEach(eye => {
      eye.material.color.setHex(this.revealed ? 0xffd2e8 : 0xff4f9a)
    })
    this.ruleDetail = this.revealed
      ? 'REVEALED — strike the fear now'
      : 'VEILED — listen. The fear will show itself.'
    this.whisperTimer -= dt
    if (this.whisperTimer <= 0) {
      this.whisperTimer = 5 + Math.random() * 5
      this.game.audio.whisper()
    }
    const bx = this.boss.position.x
    const bz = this.boss.position.z
    const dx = player.position.x - bx
    const dz = player.position.z - bz
    const distance = Math.hypot(dx, dz)
    const speed = this.revealed ? 2.9 : 1.7
    if (distance > 2.4) {
      this.boss.position.x += (dx / distance) * speed * dt
      this.boss.position.z += (dz / distance) * speed * dt
      this.resolveCollisions(this.boss.position, 1.5)
    }
    this.boss.attackTimer -= dt
    if (this.boss.attackTimer <= 0 && distance < 6.5) {
      this.boss.attackTimer = this.revealed ? 2.4 : 4
      this.spawnHazard({
        position: new THREE.Vector3(player.position.x, 0, player.position.z),
        radius: 2.7,
        delay: 0.85,
        duration: 0.18,
        damage: this.revealed ? 18 : 13,
        color: 0xff4f9a
      })
      this.game.audio.whisper()
      this.game.audio.tone({ freq: 90, endFreq: 38, duration: 0.6, type: 'sawtooth', volume: 0.11 })
    }
  }

  filterBossDamage(boss, amount, opts) {
    if (this.revealed) return { amount, crit: opts.crit }
    if (!this.firstRuleWarn) {
      this.firstRuleWarn = true
      this.game.ui.toast('Your blade finds only mist. Wait for the fear to reveal itself.', 'virtue', 4000)
    }
    return { immune: true }
  }

  updateBossLogic(dt, ctx) {
    if (!this.boss || this.boss.dead) return
    const player = ctx.player
    this.boss.group.position.copy(this.boss.position)
    this.boss.group.rotation.y = Math.atan2(player.position.x - this.boss.position.x, player.position.z - this.boss.position.z)
    this.boss.visual.position.y = 0.15 + Math.sin(this.time * 1.2) * 0.22
    this.boss.visual.rotation.z = Math.sin(this.time * 0.8) * 0.03
    this.shadowEye.forEach(eye => {
      eye.scale.setScalar(1 + Math.sin(this.time * 4) * 0.12)
    })
  }

  onBossDefeated() {
    super.onBossDefeated()
    this.revealed = false
    this.game.ui.setHudDark(false)
    this.compassVisible = true
    if (this.playerLight) this.playerLight.intensity = 3
  }
}

const SHARD_CLASSES = {
  elderwood: ElderwoodWorld,
  iron: IronWorld,
  astral: AstralWorld,
  shadow: ShadowWorld
}

export function createShardWorld(game, shard) {
  const Class = SHARD_CLASSES[shard.id] ?? ShardWorld
  return new Class(game, shard)
}
