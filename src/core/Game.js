import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { Input } from './Input.js'
import { AudioEngine } from './Audio.js'
import { UI } from './UI.js'
import { Player } from '../entities/Player.js'
import { HubWorld } from '../world/HubWorld.js'
import { createShardWorld } from '../world/Shards.js'
import { VIRTUES, SHARDS, VIRTUE_ORDER } from '../data.js'
import {
  createInitialState, gainVirtue as applyVirtue, nextObjective, clamp, damp, angleDelta, playerBonuses
} from '../logic.js'

const FINAL_PASS = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.38 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float dist = length(centered);
      float aberration = 0.0008 + dist * 0.0016;
      vec4 color;
      color.r = texture2D(tDiffuse, uv + centered * aberration).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - centered * aberration).b;
      color.a = 1.0;
      float vignette = smoothstep(0.88, 0.22, dist);
      color.rgb *= mix(1.0, vignette, uVignette);
      float grain = (rand(uv * 800.0 + uTime) - 0.5) * 0.022;
      color.rgb += grain;
      gl_FragColor = color;
    }
  `
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export class Game {
  constructor() {
    this.canvas = document.getElementById('game')
    this.state = 'title'
    this.stateData = createInitialState()
    this.currentSceneName = 'hub'
    this.isTouch = window.matchMedia('(pointer: coarse)').matches
    this.quality = localStorage.getItem('seekerverse-quality') || (this.isTouch ? 'high' : 'high')
    this.muted = localStorage.getItem('seekerverse-muted') === '1'
    this.titleTime = 0
    this.hitStop = 0
    this.shake = 0
    this.lastRuleName = ''
    this.lastRuleDetail = ''
    this.interactable = null
    this.channel = null
    this.deadHandling = false
    this.hubReturn = new THREE.Vector3(0, 0, 17)
    this.shardWorlds = new Map()
    this.time = 0
    this.lastTime = performance.now()
    this.transitioning = false
    this.debugSpectate = false
    this.cameraYaw = 0
    this.cameraPitch = 0.36
    this.cameraDistance = 7.8
    this.cameraTarget = new THREE.Vector3()
    this.cameraPosition = new THREE.Vector3()
    this.cameraRaycaster = new THREE.Raycaster()
    this.cameraCollisionVector = new THREE.Vector3()

    this.audio = new AudioEngine()
    this.ui = new UI({
      onStart: () => this.startJourney(),
      onPause: () => this.togglePause(),
      onResume: () => this.setPaused(false),
      onMute: () => this.toggleMute(),
      onRestart: () => this.restart(),
      onQuality: quality => this.setQuality(quality)
    })
    this.input = new Input(this.canvas, document.getElementById('joystick'), document.getElementById('joystick-knob'), {
      onPause: () => this.togglePause(),
      onMute: () => this.toggleMute()
    })
    this.setupRenderer()
    this.setupCamera()
    this.hub = new HubWorld(this)
    this.currentWorld = this.hub
    this.hub.active = true
    this.setupScene(this.hub.scene)
    this.player = new Player(this.hub.scene, this.hub.spawn)
    this.player.root.visible = false
    this.player.facing = Math.PI
    this.cameraTarget.copy(this.hub.spawn).add(new THREE.Vector3(0, 1.4, 0))
    this.cameraPosition.copy(this.cameraTarget)
    this.ui.setKeys(this.stateData.keys)
    this.ui.setVirtues(this.stateData.virtues)
    this.ui.setQuality(this.quality)
    this.ui.setMuted(this.muted)
    this.ui.showTitle()
    this.refreshObjective()
    this.setupResize()
    this.audio.setMuted(this.muted)
    this.clockStart()
    this.exposeDebug()
    const params = new URLSearchParams(window.location.search)
    if (params.get('autostart') === '1') setTimeout(() => this.startJourney(), 300)
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isTouch,
      powerPreference: 'high-performance',
      alpha: false
    })
    const maxPixelRatio = this.isTouch ? 1.75 : 2
    this.renderer.setPixelRatio(this.quality === 'high' ? Math.min(window.devicePixelRatio, maxPixelRatio) : 1)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.3
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x070b14, 1)
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400)
    this.camera.position.set(0, 12, 28)
    this.camera.lookAt(0, 4, 0)
  }

  getDefaultCameraDistance() {
    return window.innerWidth / window.innerHeight < 0.8 ? 9.4 : 7.8
  }

  setupScene(scene) {
    this.scene = scene
    if (!this.composer) {
      this.composer = new EffectComposer(this.renderer)
      this.renderPass = new RenderPass(scene, this.camera)
      this.composer.addPass(this.renderPass)
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        this.isTouch ? 0.52 : 0.62,
        0.62,
        0.74
      )
      this.composer.addPass(this.bloomPass)
      this.composer.addPass(new OutputPass())
      this.finalPass = new ShaderPass(FINAL_PASS)
      this.composer.addPass(this.finalPass)
    } else {
      this.renderPass.scene = scene
    }
    this.finalPass.uniforms.uVignette.value = this.currentSceneName === 'shadow' ? 0.62 : 0.38
  }

  setupResize() {
    const resize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      this.camera.aspect = width / height
      this.camera.fov = width / height < 0.8 ? 66 : 55
      this.camera.updateProjectionMatrix()
      this.cameraDistance = this.getDefaultCameraDistance()
      this.renderer.setSize(width, height)
      this.composer?.setSize(width, height)
      if (this.bloomPass) {
        this.bloomPass.strength = (this.quality === 'high' ? (this.isTouch ? 0.52 : 0.62) : 0.38)
      }
    }
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', () => setTimeout(resize, 220))
    this.resize = resize
    resize()
  }

  clockStart() {
    this.lastTime = performance.now()
    const tick = now => {
      requestAnimationFrame(tick)
      const raw = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000))
      this.lastTime = now
      this.time += raw
      this.update(raw)
      this.render()
    }
    requestAnimationFrame(tick)
  }

  update(dt) {
    this.finalPass.uniforms.uTime.value = this.time
    if (this.state === 'paused') return
    this.ui.setPrompt(null)

    if (this.state === 'title') {
      this.updateTitle(dt)
      return
    }

    if (this.state === 'transition') {
      this.updateCamera(dt, true)
      return
    }

    if (this.hitStop > 0) {
      this.hitStop -= dt
      dt *= 0.16
    }

    if (this.state === 'playing') {
      this.updatePlaying(dt)
    } else if (this.state === 'ended') {
      this.updateEnded(dt)
    } else if (this.state === 'dead') {
      this.updateCamera(dt)
    }

    this.updateHud()
  }

  updateTitle(dt) {
    this.titleTime += dt
    this.hub.update(dt, { player: this.player, camera: this.camera, game: this })
    const angle = this.titleTime * 0.055 + 0.8
    const radius = 26
    const targetPos = new THREE.Vector3(Math.cos(angle) * radius, 11 + Math.sin(this.titleTime * 0.22) * 1.2, Math.sin(angle) * radius)
    this.camera.position.lerp(targetPos, 1 - Math.exp(-dt * 1.5))
    this.camera.lookAt(0, 4.6, 0)
    this.ui.setCompass({ visible: false })
  }

  updatePlaying(dt) {
    const input = this.input
    const cameraDelta = input.takeCameraDelta()
    this.cameraYaw += cameraDelta.x
    this.cameraPitch = clamp(this.cameraPitch + cameraDelta.y, 0.08, 1.02)
    this.cameraDistance = clamp(this.cameraDistance + input.takeZoom() * 3, 4.4, 11)

    if (input.consumeAttack() || (input.attackHeld && this.player.attackCooldown <= 0)) {
      if (this.player.tryAttack({ world: this.currentWorld, effects: this.currentWorld.effects, audio: this.audio, game: this })) {
        if (this.channel) this.cancelChannel()
      }
    }
    if (input.consumeDodge()) {
      if (this.player.tryDodge({ world: this.currentWorld, effects: this.currentWorld.effects, audio: this.audio })) {
        if (this.channel) this.cancelChannel()
      }
    }

    this.player.update(dt, {
      input,
      cameraYaw: this.cameraYaw,
      world: this.currentWorld,
      effects: this.currentWorld.effects,
      audio: this.audio,
      ui: this.ui,
      game: this
    })

    this.updateInteraction(dt)

    this.currentWorld.update(dt, { player: this.player, camera: this.camera, game: this, input })

    if (this.player.cameraShake > 0) {
      this.shake = Math.max(this.shake, this.player.cameraShake * 0.4)
    }

    this.updateCamera(dt)
    this.updateCompass()
    this.audio.update(dt)
    if (this.player.health <= 0 && this.state === 'playing' && !this.deadHandling) this.onPlayerDeath()
  }

  updateInteraction(dt) {
    const candidate = this.currentWorld.getInteractable(this.player)
    this.interactable = candidate

    if (this.channel) {
      const target = this.channel.target
      const stillValid = candidate && candidate.id === this.channel.id
      const tooFar = target.echo
        ? Math.hypot(this.player.position.x - target.echo.position.x, this.player.position.z - target.echo.position.z) > target.range + 0.6
        : false
      if (!stillValid || tooFar || !this.player.alive) {
        this.cancelChannel()
      } else {
        this.channel.elapsed += dt
        this.player.busy = Math.max(this.player.busy, 0.15)
        const progress = clamp(this.channel.elapsed / this.channel.duration, 0, 1)
        this.ui.setPrompt(`Soothe the lost echo — ${Math.round(progress * 100)}%`)
        if (progress >= 1) {
          this.currentWorld.completeChannel(this.channel.target, this)
          this.audio.pickup()
          this.channel = null
        }
      }
      if (this.channel) return
    }

    if (!candidate) {
      this.ui.setPrompt(null)
      this.input.consumeInteract()
      return
    }
    if (this.channel) return
    this.ui.setPrompt(this.channel ? '' : candidate.label)
    if (this.input.consumeInteract()) {
      if (candidate.channel) {
        this.channel = {
          id: candidate.id,
          target: candidate,
          duration: candidate.channel,
          elapsed: 0
        }
        this.audio.click()
      } else {
        this.currentWorld.interact(candidate.action, this)
      }
    }
  }

  cancelChannel() {
    this.channel = null
    this.ui.setPrompt(null)
  }

  updateCamera(dt, snap = false) {
    const target = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y + 1.45,
      this.player.position.z
    )
    this.cameraTarget.lerp(target, snap ? 1 : 1 - Math.exp(-dt * 12))
    const distance = this.cameraDistance
    const cosPitch = Math.cos(this.cameraPitch)
    const desired = new THREE.Vector3(
      this.cameraTarget.x + Math.sin(this.cameraYaw) * distance * cosPitch,
      this.cameraTarget.y + Math.sin(this.cameraPitch) * distance,
      this.cameraTarget.z + Math.cos(this.cameraYaw) * distance * cosPitch
    )

    let allowed = distance
    if (this.currentWorld?.cameraBlockers?.length) {
      const direction = desired.clone().sub(this.cameraTarget)
      const length = direction.length()
      direction.normalize()
      this.cameraRaycaster.set(this.cameraTarget, direction)
      this.cameraRaycaster.far = length
      this.scene.updateMatrixWorld()
      const hits = this.cameraRaycaster.intersectObjects(this.currentWorld.cameraBlockers, false)
      if (hits.length > 0) {
        allowed = Math.max(1.4, hits[0].distance - 0.35)
      }
    }
    const multiplier = clamp(allowed / distance, 0.18, 1)
    const finalPos = new THREE.Vector3(
      this.cameraTarget.x + Math.sin(this.cameraYaw) * distance * multiplier * cosPitch,
      this.cameraTarget.y + Math.sin(this.cameraPitch) * distance * multiplier,
      this.cameraTarget.z + Math.cos(this.cameraYaw) * distance * multiplier * cosPitch
    )

    if (this.shake > 0.001) {
      const amount = this.shake * 0.35
      finalPos.x += (Math.random() - 0.5) * amount
      finalPos.y += (Math.random() - 0.5) * amount * 0.7
      finalPos.z += (Math.random() - 0.5) * amount
      this.shake = damp(this.shake, 0, 8, dt)
    }

    this.camera.position.lerp(finalPos, snap ? 1 : 1 - Math.exp(-dt * 13))
    this.camera.lookAt(this.cameraTarget)
    if (finalPos.y < 0.6) this.camera.position.y = 0.6
  }

  updateCompass() {
    const target = this.currentWorld.getCompassTarget?.()
    const visible = this.currentWorld.compassVisible !== false && Boolean(target)
    const worldAngle = target
      ? Math.atan2(target.position.x - this.player.position.x, -(target.position.z - this.player.position.z))
      : 0
    const cameraHeading = Math.atan2(-Math.sin(this.cameraYaw), Math.cos(this.cameraYaw))
    const relative = angleDelta(cameraHeading, worldAngle)
    const distance = target ? Math.hypot(target.position.x - this.player.position.x, target.position.z - this.player.position.z) : null
    this.ui.setCompass({ heading: cameraHeading, questAngle: relative, distance, visible })
  }

  updateHud() {
    if (this.state !== 'playing' && this.state !== 'dead') return
    this.ui.setHealth(this.player.health, this.player.maxHealth)
    this.ui.setStamina(this.player.stamina, this.player.maxStamina)
    this.ui.setVirtues(this.stateData.virtues)
    const special = this.currentWorld.getSpecial?.()
    if (special) this.ui.setSpecial(true, special.value, special.label)
    else this.ui.setSpecial(false)
    const rule = this.currentWorld.getRule?.()
    if (rule) {
      if (rule.name !== this.lastRuleName || rule.detail !== this.lastRuleDetail) {
        this.lastRuleName = rule.name
        this.lastRuleDetail = rule.detail
        this.ui.setRule(rule.name, rule.detail, true)
      }
    } else if (this.lastRuleName) {
      this.lastRuleName = ''
      this.lastRuleDetail = ''
      this.ui.setRule('', '', false)
    }
  }

  startJourney() {
    if (this.state !== 'title') return
    this.audio.start()
    this.audio.setScene('hub')
    this.audio.click()
    this.state = 'playing'
    this.ui.showHud()
    this.player.root.visible = true
    this.player.reset(this.hub.spawn)
    this.player.facing = Math.PI
    this.cameraYaw = 0
    this.cameraPitch = 0.34
    this.cameraDistance = this.getDefaultCameraDistance()
    this.updateCamera(1, true)
    this.refreshObjective()
    this.ui.setKeys(this.stateData.keys)
    this.ui.toast('The Sentient Maze is listening.', 'gold', 3400)
    setTimeout(() => {
      if (this.state !== 'playing') return
      const hint = this.isTouch
        ? 'Left stick to move · Drag to look · STRIKE to fight · TOUCH to interact'
        : 'WASD to move · Drag to look · J to strike · Space to dodge · E to touch'
      this.ui.toast(hint, '', 5200)
    }, 1700)
  }

  gainVirtue(virtue, amount, { toast = true } = {}) {
    const gained = applyVirtue(this.stateData, virtue, amount)
    if (gained <= 0) return
    this.player.setVirtues(this.stateData.virtues)
    this.ui.setVirtues(this.stateData.virtues, virtue)
    if (toast) {
      this.ui.toast(`${VIRTUES[virtue].name} +${Math.round(gained)}`, 'virtue', 2100)
    }
    if (gained >= 4) this.audio.virtue()
    const color = VIRTUES[virtue].color
    this.currentWorld.effects?.burst(this.player.position.clone().add(new THREE.Vector3(0, 1.2, 0)), color, 12, 2.4, 0.8, 0.26)
  }

  onEnemyKilled(enemy) {
    this.stateData.kills++
    const virtue = enemy.type === 'sentinel' ? 'discipline' : enemy.type === 'wisp' ? 'wisdom' : 'empathy'
    this.gainVirtue(virtue, 0.9, { toast: false })
    const heal = playerBonuses(this.stateData.virtues).killHeal
    if (heal > 0.2) this.player.heal(heal)
  }

  refreshObjective() {
    const world = this.currentWorld
    let text = ''
    if (world === this.hub) {
      if (this.hub.castleRisen) text = 'Ascend to Seeker Castle'
      else if (this.stateData.keys.length >= 4) text = 'The Seeker Castle awakens'
      else if (this.hub.trial) text = `${VIRTUES[this.hub.trial.shard.virtue].name} Trial — ${this.hub.trial.progress} / ${this.hub.trial.total}`
      else {
        const open = SHARDS.filter(shard => this.hub.portals.get(shard.id)?.open && !this.stateData.keys.includes(shard.id))
        if (open.length > 0) text = `Enter the ${open[0].shortName}`
        else {
          const remaining = SHARDS.filter(shard => !this.stateData.seals[shard.id] && !this.stateData.keys.includes(shard.id))
          text = remaining.length === 4 ? 'Restore the four Virtue Seals' : `Restore the remaining ${remaining.length} Virtue Seal${remaining.length === 1 ? '' : 's'}`
        }
      }
    } else {
      const shard = world.shard
      if (world.boss && !world.boss.dead) {
        text = `Defeat ${shard.guardian}`
      } else if (world.returnOpen) {
        text = 'Return through the Shard Gate'
      } else {
        text = nextObjective(this.stateData, { inShard: true, activeShard: shard, bossAlive: false, returnOpen: false })
      }
    }
    this.ui.setQuest(text)
    this.ui.setKeys(this.stateData.keys)
  }

  async enterShard(shard) {
    if (this.state !== 'playing' || this.transitioning) return
    this.transitioning = true
    this.state = 'transition'
    this.ui.setPrompt(null)
    this.cancelChannel()
    this.audio.portal()
    this.audio.setScene(shard.id)
    this.ui.beginTransition(shard.name, shard.description)
    const portal = this.hub.portals.get(shard.id)
    if (portal) {
      const towardCenter = new THREE.Vector3(-portal.position.x, 0, -portal.position.z).normalize()
      this.hubReturn.copy(portal.position).add(towardCenter.multiplyScalar(6))
    }
    await delay(760)
    this.hub.onExit?.()
    this.hub.active = false
    let world = this.shardWorlds.get(shard.id)
    if (!world) {
      world = createShardWorld(this, shard)
      this.shardWorlds.set(shard.id, world)
    }
    this.currentWorld = world
    this.currentSceneName = shard.id
    world.active = true
    this.setupScene(world.scene)
    world.scene.add(this.player.root)
    this.player.reset(world.spawn)
    this.player.facing = Math.PI
    this.player.setVirtues(this.stateData.virtues)
    this.ui.setKeys(this.stateData.keys)
    this.ui.setHudDark(false)
    this.cameraYaw = 0
    this.cameraPitch = 0.34
    this.cameraDistance = this.getDefaultCameraDistance()
    this.updateCamera(1, true)
    world.onEnter(this)
    this.refreshObjective()
    this.lastRuleName = ''
    this.lastRuleDetail = ''
    this.ui.setRule(shard.rule, shard.ruleDetail, true)
    this.finalPass.uniforms.uVignette.value = shard.id === 'shadow' ? 0.6 : 0.42
    await delay(360)
    this.ui.endTransition()
    this.state = 'playing'
    this.transitioning = false
    this.audio.setScene(shard.id)
    if (shard.id === 'shadow') {
      this.ui.toast('Your lantern is the only truth here.', 'virtue', 3600)
    } else {
      this.ui.toast(`${shard.rule} — ${shard.ruleDetail}`, 'virtue', 4400)
    }
  }

  async returnToHub(shard) {
    if (this.state !== 'playing' || this.transitioning) return
    this.transitioning = true
    this.state = 'transition'
    this.ui.setPrompt(null)
    this.cancelChannel()
    this.audio.portal()
    this.ui.beginTransition('THE NEXUS', 'The Maze reshapes around you')
    await delay(720)
    this.currentWorld.onExit?.(this)
    this.currentWorld.active = false
    this.currentWorld = this.hub
    this.hub.active = true
    this.currentSceneName = 'hub'
    this.setupScene(this.hub.scene)
    this.hub.scene.add(this.player.root)
    this.player.reset(this.hubReturn)
    this.player.facing = Math.PI
    this.player.setVirtues(this.stateData.virtues)
    this.ui.setHudDark(false)
    this.cameraYaw = 0.4
    this.cameraPitch = 0.36
    this.cameraDistance = this.getDefaultCameraDistance()
    this.updateCamera(1, true)
    this.hub.onEnter?.(this)
    this.audio.setScene('hub')
    this.finalPass.uniforms.uVignette.value = 0.38
    this.refreshObjective()
    this.ui.setKeys(this.stateData.keys)
    await delay(340)
    this.ui.endTransition()
    this.state = 'playing'
    this.transitioning = false
    if (this.stateData.keys.length >= 4) {
      this.ui.toast('The four keys resonate. Seeker Castle has risen.', 'gold', 4600)
    } else {
      this.ui.toast(`${VIRTUES[shard.virtue].name} Shard restored. ${4 - this.stateData.keys.length} remain.`, 'gold', 3600)
    }
  }

  async onPlayerDeath() {
    if (this.deadHandling) return
    this.deadHandling = true
    this.state = 'dead'
    this.stateData.deaths++
    this.cancelChannel()
    this.ui.setPrompt(null)
    this.ui.toast('The Maze rewinds you.', 'virtue', 2600)
    await delay(1100)
    this.ui.beginTransition('THE MAZE REWINDS', 'Every ending is a door')
    await delay(700)
    if (this.currentWorld.boss && !this.currentWorld.boss.dead) {
      this.currentWorld.boss.hp = this.currentWorld.boss.maxHp
      this.ui.updateBoss(this.currentWorld.boss.hp, this.currentWorld.boss.maxHp)
    }
    this.currentWorld.projectiles?.clear?.()
    this.currentWorld.hazards.length = 0
    this.player.reset(this.currentWorld.spawn)
    this.player.facing = Math.PI
    this.player.setVirtues(this.stateData.virtues)
    this.player.invulnerable = 2.6
    this.player.root.visible = true
    this.updateCamera(1, true)
    this.ui.endTransition()
    this.state = 'playing'
    this.deadHandling = false
    this.refreshObjective()
    this.audio.setScene(this.currentSceneName)
  }

  async finishJourney() {
    if (this.state !== 'playing') return
    this.state = 'transition'
    this.transitioning = true
    this.audio.setScene('finale')
    this.audio.victory()
    this.ui.beginTransition('SEEKER CASTLE', 'The heart of the Maze remembers you')
    this.shakeCamera(0.5)
    await delay(1600)
    this.state = 'ended'
    this.transitioning = false
    this.cancelChannel()
    this.ui.setPrompt(null)
    this.ui.showEnding(this.stateData, { shards: this.stateData.keys.length })
    this.ui.endTransition()
    this.ui.hideBoss()
  }

  updateEnded(dt) {
    this.titleTime += dt
    this.currentWorld.update(dt, { player: this.player, camera: this.camera, game: this })
    const angle = this.titleTime * 0.08
    const target = new THREE.Vector3(Math.cos(angle) * 18, 10.5, Math.sin(angle) * 18)
    this.camera.position.lerp(target, 1 - Math.exp(-dt * 1.2))
    this.camera.lookAt(0, 8, 0)
  }

  togglePause() {
    if (this.state === 'playing') this.setPaused(true)
    else if (this.state === 'paused') this.setPaused(false)
  }

  setPaused(paused) {
    if (paused && this.state !== 'playing') return
    if (!paused && this.state !== 'paused') return
    this.state = paused ? 'paused' : 'playing'
    this.audio.setPaused(paused)
    if (paused) {
      this.ui.showPause()
      this.ui.setPrompt(null)
      this.input.attackHeld = false
      this.input.interactHeld = false
      this.input.keys.clear()
    } else {
      this.ui.hidePause()
      this.lastTime = performance.now()
    }
  }

  toggleMute() {
    this.muted = !this.muted
    this.audio.setMuted(this.muted)
    this.ui.setMuted(this.muted)
    localStorage.setItem('seekerverse-muted', this.muted ? '1' : '0')
  }

  setQuality(quality) {
    this.quality = quality
    localStorage.setItem('seekerverse-quality', quality)
    this.ui.setQuality(quality)
    this.renderer.setPixelRatio(quality === 'high' ? Math.min(window.devicePixelRatio, this.isTouch ? 1.75 : 2) : 1)
    this.resize?.()
  }

  shakeCamera(amount) {
    this.shake = Math.max(this.shake, amount)
  }

  restart() {
    window.location.reload()
  }

  render() {
    this.composer.render()
  }

  exposeDebug() {
    window.__seeker = {
      game: this,
      start: () => this.startJourney(),
      teleport: (x, z) => {
        this.player.position.set(x, 0, z)
        this.updateCamera(1, true)
      },
      interact: () => {
        const target = this.currentWorld.getInteractable(this.player)
        if (target) this.currentWorld.interact(target.action, this)
      },
      enterShard: id => {
        const shard = SHARDS.find(item => item.id === id)
        if (shard) this.enterShard(shard)
      },
      unlockSeals: () => {
        for (const shard of SHARDS) {
          const portal = this.hub.portals.get(shard.id)
          if (!portal) continue
          this.stateData.seals[shard.id] = true
          portal.open = true
          this.gainVirtue(shard.virtue, 40, { toast: false })
        }
        this.refreshObjective()
        this.ui.setKeys(this.stateData.keys)
      },
      defeatBoss: () => {
        if (this.currentWorld.boss && !this.currentWorld.boss.dead) {
          this.currentWorld.boss.takeDamage(99999, { player: this.player, crit: true, source: this.player.position.clone() })
        }
      },
      grantKeys: () => {
        for (const shard of SHARDS) {
          this.stateData.seals[shard.id] = true
          this.hub.portals.get(shard.id).open = true
          if (!this.stateData.keys.includes(shard.id)) this.stateData.keys.push(shard.id)
        }
        this.refreshObjective()
        this.ui.setKeys(this.stateData.keys)
      },
      seek: shardId => {
        const shard = SHARDS.find(item => item.id === shardId)
        const portal = this.hub.portals.get(shardId)
        if (!portal) return
        if (!this.stateData.seals[shardId]) {
          this.stateData.seals[shardId] = true
          portal.open = true
          this.refreshObjective()
        }
        this.player.position.copy(portal.position).add(new THREE.Vector3(0, 0, 1))
        this.updateCamera(1, true)
      },
      stats: () => ({
        state: this.state,
        virtues: { ...this.stateData.virtues },
        keys: [...this.stateData.keys],
        scene: this.currentSceneName,
        player: { x: this.player.position.x, z: this.player.position.z, hp: this.player.health }
      })
    }
  }
}
