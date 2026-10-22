import * as THREE from 'three'
import './style.css'
import { buildWorld, updateWorld, findNearestCar, isBlocked, PLAYER_START, CITY_EDGE } from './world.js'
import { createCharacter, animateCharacter } from './entities.js'
import { createRadar } from './radar.js'
import { AudioEngine } from './audio.js'
import { SocialHub } from './social.js'
import { ROOMS, personaById } from './data/social.js'

const canvas = document.querySelector('#scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.14
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1500)
scene.add(camera)

const world = buildWorld(scene)
const player = createCharacter({
  skin: 0xb97955,
  shirt: 0xf2eddc,
  pants: 0x222c40,
  shoes: 0xece6d8,
  hair: 0x17120f,
  accent: 0xffc54a
})
player.position.copy(PLAYER_START)
player.rotation.y = Math.PI
scene.add(player)

world.markers.missionStart.visible = false
world.markers.dropOff.visible = false
world.markers.garage.visible = false
world.fixerLabel.visible = false

const radar = createRadar(world, document.querySelector('#radar'))
const audio = new AudioEngine()

const ui = {
  hud: document.querySelector('#hud'),
  menu: document.querySelector('#menu'),
  loading: document.querySelector('#loading'),
  startBtn: document.querySelector('#startBtn'),
  pause: document.querySelector('#pause'),
  pauseBtn: document.querySelector('#pauseBtn'),
  resumeBtn: document.querySelector('#resumeBtn'),
  health: document.querySelector('#healthBar'),
  armor: document.querySelector('#armorBar'),
  money: document.querySelector('#money'),
  wanted: document.querySelector('#wanted'),
  clock: document.querySelector('#clock'),
  tokenCount: document.querySelector('#tokenCount'),
  zone: document.querySelector('#zoneName'),
  prompt: document.querySelector('#prompt'),
  promptKey: document.querySelector('#prompt .prompt-key'),
  promptText: document.querySelector('#promptText'),
  speedo: document.querySelector('#speedo'),
  speedNum: document.querySelector('#speedNum'),
  speedDial: document.querySelector('.speed-dial'),
  gear: document.querySelector('.gear'),
  missionTag: document.querySelector('#missionTag'),
  missionTimer: document.querySelector('#missionTimer'),
  missionTitle: document.querySelector('#missionTitle'),
  missionSub: document.querySelector('#missionSub'),
  missionBar: document.querySelector('.mission-progress i'),
  missionFlash: document.querySelector('#missionFlash'),
  missionFlashText: document.querySelector('#missionFlash b'),
  toasts: document.querySelector('#toasts'),
  flash: document.querySelector('#flash'),
  soundBtn: document.querySelector('#soundBtn'),
  joystick: document.querySelector('#joystick'),
  joystickKnob: document.querySelector('#joystickKnob'),
  sprintBtn: document.querySelector('#sprintBtn'),
  brakeBtn: document.querySelector('#brakeBtn'),
  carBtn: document.querySelector('#carBtn'),
  actionBtn: document.querySelector('#actionBtn'),
  enterBtn: document.querySelector('#enterBtn'),
  socialBtn: document.querySelector('#socialBtn')
}

const state = {
  started: false,
  paused: false,
  inCar: false,
  car: null,
  health: 100,
  armor: 72,
  money: 850,
  wanted: 0,
  tokens: 0,
  mission: { stage: 'idle', timer: 0, cooldown: 0 },
  social: { open: false, mission: null, waypoint: null, companions: [], reported: -1, paid: null },
  camYaw: 0,
  camPitch: 0.145,
  camDist: 9.2,
  time: 0,
  zone: '',
  zoneTick: 0,
  crimeCooldown: 0,
  wantedCool: 0,
  shake: 0,
  lastLook: 10,
  deathCooldown: 0,
  elapsed: 0
}

const hub = new SocialHub({
  onMission: (mission) => applySocialMission(mission),
  onToast: (text) => toast(text, 'gold'),
  onPickVenue: (room) => setWaypoint(room),
  onOpenRoom: () => {
    state.social.open = true
    document.body.classList.add('social-open')
  },
  onClose: () => {
    state.social.open = false
    document.body.classList.remove('social-open')
  }
})

const input = {
  keys: new Set(),
  joy: { x: 0, y: 0, active: false, pointer: null },
  sprint: false,
  brake: false,
  lookPointer: null,
  lookX: 0,
  lookY: 0
}

let snapCamera = true
let activeLook = null

const tempVec = new THREE.Vector3()
const tempVec2 = new THREE.Vector3()
const tempVec3 = new THREE.Vector3()

function formatMoney(n) {
  return '$' + Math.max(0, Math.floor(n)).toLocaleString('en-US')
}

function updateBars() {
  ui.health.style.width = Math.max(0, state.health) + '%'
  ui.armor.style.width = Math.max(0, state.armor) + '%'
}

function updateWanted() {
  const stars = ui.wanted.querySelectorAll('span')
  stars.forEach((s, i) => s.classList.toggle('on', i < state.wanted))
}

function updateMoney() {
  ui.money.textContent = formatMoney(state.money)
}

function toast(text, tone = '') {
  const el = document.createElement('div')
  el.className = 'toast ' + tone
  el.innerHTML = text
  ui.toasts.appendChild(el)
  setTimeout(() => {
    el.classList.add('out')
    setTimeout(() => el.remove(), 400)
  }, 3000)
}

function flashMission(title = 'THE MARINA RUN') {
  ui.missionFlashText.textContent = title
  ui.missionFlash.classList.remove('show')
  void ui.missionFlash.offsetWidth
  ui.missionFlash.classList.add('show')
}

function setZone(name) {
  if (name === state.zone) return
  state.zone = name
  ui.zone.textContent = name.toUpperCase()
  ui.zone.classList.remove('flash')
  void ui.zone.offsetWidth
  ui.zone.classList.add('flash')
}

function updateMissionUI() {
  if (state.social.mission) {
    updateSocialMissionUI(true)
    return
  }
  const m = state.mission
  if (m.stage === 'idle') {
    ui.missionTag.textContent = 'FREE ROAM'
    ui.missionTitle.textContent = 'Meet the fixer at El Rey Plaza'
    ui.missionSub.textContent = 'Follow the gold marker through the city'
    ui.missionTimer.textContent = ''
    ui.missionBar.style.width = '16%'
  } else if (m.stage === 'active') {
    ui.missionTag.textContent = 'THE MARINA RUN'
    ui.missionTitle.textContent = 'Deliver the package to Pier 99'
    ui.missionSub.textContent = 'Get to the marina drop-off before the clock runs out'
    ui.missionTimer.textContent = formatTime(m.timer)
    const pct = 25 + (1 - m.timer / 150) * 65
    ui.missionBar.style.width = Math.min(100, pct) + '%'
  } else if (m.stage === 'failed') {
    ui.missionTag.textContent = 'MISSION FAILED'
    ui.missionTitle.textContent = 'The client got nervous'
    ui.missionSub.textContent = 'Return to the plaza to try the run again'
    ui.missionTimer.textContent = ''
    ui.missionBar.style.width = '0%'
  } else {
    ui.missionTag.textContent = 'MISSION COMPLETE'
    ui.missionTitle.textContent = 'The marina run is done'
    ui.missionSub.textContent = 'Free roam the coast — another job is waiting'
    ui.missionTimer.textContent = ''
    ui.missionBar.style.width = '100%'
  }
}

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

function playerAnchor() {
  return state.inCar && state.car ? state.car.position : player.position
}

function nearestVenue() {
  const pos = playerAnchor()
  let best = null
  let bestDist = 5.4
  for (const venue of world.venues) {
    const d = Math.hypot(pos.x - venue.door.x, pos.z - venue.door.z)
    if (d < bestDist) {
      bestDist = d
      best = venue
    }
  }
  return best
}

function nearestNpc() {
  if (state.inCar) return null
  let best = null
  let bestDist = 4.4
  for (const npc of world.npcs) {
    const d = Math.hypot(player.position.x - npc.group.position.x, player.position.z - npc.group.position.z)
    if (d < bestDist) {
      bestDist = d
      best = npc
    }
  }
  return best
}

function enterVenue(venue) {
  if (!venue) return
  const room = ROOMS.find((r) => r.id === venue.id)
  if (!room) return
  hub.enterRoom(room)
  audio.chime()
}

function talkTo(npc) {
  if (!npc) return
  hub.enterDm(npc.persona, npc.group)
}

function setWaypoint(room) {
  const venue = world.venues.find((v) => v.id === room.id)
  if (!venue) return
  state.social.waypoint = venue.door.clone()
  toast(`Waypoint set — <b>${room.name}</b>`, 'cyan')
}

function applySocialMission(mission) {
  const previous = state.social.mission
  state.social.mission = mission || null
  state.social.reported = -1
  if (!mission) {
    updateMissionUI()
    return
  }
  if (mission.id !== previous?.id) {
    spawnCompanions(mission.companions || [])
    flashMission(mission.title.toUpperCase())
  }
  updateSocialMissionUI(true)
  if (mission && mission.complete && state.social.paid !== mission.id) {
    state.social.paid = mission.id
    state.money += mission.reward || 0
    updateMoney()
    toast(`<b>Contract complete</b> — $${mission.reward}`, 'gold')
    for (const companion of state.social.companions) {
      hub.say(companion.group, companion.persona.name, pickBanter(companion.persona.id, 'done'), companion.persona.color)
    }
  }
}

function currentSocialStep() {
  const mission = state.social.mission
  if (!mission || !mission.steps) return null
  return mission.steps[mission.stepIndex || 0] || null
}

function updateSocialMissionUI(force = false) {
  const mission = state.social.mission
  if (!mission) return
  const now = performance.now()
  if (!force && now - (state.social.uiStamp || 0) < 200) return
  state.social.uiStamp = now
  const step = currentSocialStep()
  const total = mission.steps?.length || 1
  const index = Math.min(mission.stepIndex || 0, total - 1)
  ui.missionTag.textContent = mission.complete ? 'CONTRACT DONE' : 'CONTRACT'
  ui.missionTitle.textContent = mission.title
  ui.missionTimer.textContent = mission.complete ? '' : `${index + 1}/${total}`
  if (mission.complete) {
    ui.missionSub.textContent = `Paid $${mission.reward} — the crew is celebrating`
    ui.missionBar.style.width = '100%'
    return
  }
  let sub = step ? step.label : 'Stand by'
  if (step && typeof step.x === 'number') {
    const d = Math.round(playerAnchor().distanceTo(new THREE.Vector3(step.x, 0, step.z)))
    sub += ` — ${d}m`
  } else if (step && step.room) {
    const room = ROOMS.find((r) => r.id === step.room)
    if (room) sub += ` — ${room.name}`
  }
  ui.missionSub.textContent = sub
  ui.missionBar.style.width = `${((index + (step ? 0.15 : 0)) / total) * 100}%`
}

function spawnCompanions(ids) {
  for (const id of ids || []) {
    if (state.social.companions.some((c) => c.id === id)) continue
    const persona = personaById(id)
    if (!persona) continue
    const group = createCharacter({
      skin: 0xc98f63,
      shirt: new THREE.Color(persona.color).getHex(),
      pants: 0x232b3c,
      shoes: 0xe9e3d6,
      hair: 0x241a12,
      accent: 0xffffff
    })
    const angle = Math.random() * Math.PI * 2
    group.position.set(player.position.x + Math.cos(angle) * 2.4, 0.06, player.position.z + Math.sin(angle) * 2.4)
    scene.add(group)
    state.social.companions.push({ id, persona, group, offset: Math.random() * Math.PI * 2 })
    toast(`<b>${persona.name}</b> joined your crew`, 'cyan')
  }
}

function updateCompanions(dt) {
  const followers = state.social.companions
  if (!followers.length) return
  const anchor = playerAnchor()
  for (const companion of followers) {
    const group = companion.group
    const targetX = anchor.x + Math.cos(companion.offset + state.time * 0.35) * 2.9
    const targetZ = anchor.z + Math.sin(companion.offset + state.time * 0.35) * 2.9
    const dx = targetX - group.position.x
    const dz = targetZ - group.position.z
    const distance = Math.hypot(dx, dz)
    const moving = distance > 0.6
    if (moving) {
      const step = Math.min(distance, (state.inCar ? 9.5 : 7.4) * dt)
      const nx = group.position.x + (dx / distance) * step
      const nz = group.position.z + (dz / distance) * step
      if (!isBlocked(world, nx, group.position.z, 0.4)) group.position.x = nx
      if (!isBlocked(world, group.position.x, nz, 0.4)) group.position.z = nz
      group.rotation.y = dampAngle(group.rotation.y, Math.atan2(dx, dz), 9, dt)
    }
    group.position.y = 0.06 + Math.sin(state.time * 3 + companion.offset) * 0.02
    animateCharacter(group, dt, moving ? (state.inCar ? 1.6 : 1.2) : 0, state.time)
  }
}

async function reportMissionProgress(event) {
  const mission = state.social.mission
  if (!mission) return
  try {
    const res = await fetch('/api/missions/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: hub.clientId, missionId: mission.id, event })
    })
    const body = await res.json()
    if (body.advanced && body.mission) {
      applySocialMission(body.mission)
      if (!body.done) toast('Contract step cleared', 'gold')
    }
  } catch {
    /* hub offline */
  }
}

function reportSocialProgress() {
  const mission = state.social.mission
  if (!mission || !mission.steps) return
  const index = mission.stepIndex || 0
  const step = mission.steps[index]
  if (!step || state.social.reported === index) return
  if (step.type === 'drive' && typeof step.x === 'number' && typeof step.z === 'number') {
    const anchor = playerAnchor()
    const distance = Math.hypot(anchor.x - step.x, anchor.z - step.z)
    if (distance < 12) {
      state.social.reported = index
      reportMissionProgress({ type: 'drive', x: anchor.x, z: anchor.z })
    }
  } else if (step.type === 'collect') {
    if (state.tokens >= (step.count || 1)) {
      state.social.reported = index
      reportMissionProgress({ type: 'collect', count: state.tokens })
    }
  }
}

function pickBanter(personaId, moment) {
  const lines = {
    nova: ['Nice work. I am logging off.', 'That is the city paying out.', 'You drive, I plan.'],
    dex: ['I literally hacked the traffic lights for this.', 'Signal was clean, no thanks to me.'],
    kilo: ['That goes straight on air tonight.', 'Listeners are going to love that.'],
    mags: ['Bring it back in one piece next time.', 'She still runs smooth.'],
    rocco: ['Drinks are on me after this.', 'Told you the pier pays better.'],
    sable: ['And the crowd goes wild!', 'High score secured.'],
    zeta: ['Got the shot, obviously.', 'The night is full of pictures now.'],
    juno: ['That deserves a good record to go with it.'],
    ivy: ['Clean work. I will remember that.']
  }
  const bank = lines[personaId] || ['Good job out there.']
  return bank[Math.floor(Math.random() * bank.length)]
}

function startMission() {
  if (state.mission.stage !== 'idle') return
  state.mission.stage = 'active'
  state.mission.timer = 150
  world.markers.missionStart.visible = false
  world.markers.dropOff.visible = true
  world.fixerLabel.visible = false
  flashMission('THE MARINA RUN')
  toast('<b>New mission</b> — deliver the package to Pier 99', 'gold')
  audio.chime()
  updateMissionUI()
}

function completeMission() {
  if (state.mission.stage !== 'active') return
  state.mission.stage = 'complete'
  state.mission.cooldown = 18
  state.money += 2500
  state.wanted = 0
  state.wantedCool = 0
  world.markers.dropOff.visible = false
  flashMission('MISSION COMPLETE')
  toast('<b>+$2,500</b> — the marina run is complete', 'gold')
  audio.chime()
  updateMoney()
  updateWanted()
  updateMissionUI()
}

function failMission() {
  if (state.mission.stage !== 'active') return
  state.mission.stage = 'failed'
  state.mission.cooldown = 12
  world.markers.dropOff.visible = false
  toast('<b>Mission failed</b> — the clock ran out', '')
  updateMissionUI()
}

function resetMission() {
  state.mission.stage = 'idle'
  state.mission.timer = 0
  state.mission.cooldown = 0
  world.markers.missionStart.visible = true
  world.fixerLabel.visible = true
  updateMissionUI()
}

function missionAction() {
  if (!state.started || state.paused || state.inCar) return
  if (state.mission.stage === 'idle') {
    if (player.position.distanceTo(world.missionStart) < 5.4) startMission()
    else toast('Head to the <b>gold marker</b> to meet the fixer')
  }
}

function nearestEnterableCar() {
  return findNearestCar(world, player.position, 8.5)
}

function enterCar(car) {
  if (!car) return
  state.inCar = true
  state.car = car
  car.userData.occupied = true
  car.userData.speed = 0
  player.visible = false
  state.camYaw = car.rotation.y + Math.PI
  state.camPitch = 0.23
  state.lastLook = 10
  audio.horn()
  toast('Vehicle acquired — <b>W / S</b> to drive, <b>A / D</b> to steer')
}

function exitCar() {
  if (!state.inCar) return
  const car = state.car
  const side = new THREE.Vector3(Math.cos(car.rotation.y), 0, -Math.sin(car.rotation.y))
  let x = car.position.x + side.x * 2.4
  let z = car.position.z + side.z * 2.4
  if (isBlocked(world, x, z, 0.5)) {
    x = car.position.x - side.x * 2.4
    z = car.position.z - side.z * 2.4
  }
  player.position.set(x, 0.06, z)
  player.visible = true
  car.userData.occupied = false
  car.userData.speed = 0
  state.inCar = false
  state.car = null
  audio.setEngine(false, 0)
  state.lastLook = 10
}

function toggleVehicle() {
  if (!state.started || state.paused) return
  if (state.inCar) exitCar()
  else enterCar(nearestEnterableCar())
}

function addWanted(amount, message) {
  state.wanted = Math.min(5, state.wanted + amount)
  state.wantedCool = 32
  updateWanted()
  if (message) toast(message, 'gold')
}

function applyDamage(amount) {
  if (state.deathCooldown > 0) return
  let dmg = amount
  if (state.armor > 0) {
    const absorbed = Math.min(state.armor, dmg * 0.7)
    state.armor -= absorbed
    dmg -= absorbed
  }
  state.health -= dmg
  state.shake = Math.min(1.4, state.shake + amount / 35)
  updateBars()
  if (state.health <= 0) {
    state.health = 0
    updateBars()
    respawn()
  }
}

function respawn() {
  state.deathCooldown = 1
  state.health = 100
  state.armor = 50
  state.wanted = 0
  state.wantedCool = 0
  if (state.inCar) exitCar()
  player.position.copy(PLAYER_START)
  player.rotation.y = Math.PI
  player.visible = true
  state.camYaw = 0
  state.camPitch = 0.145
  snapCamera = true
  ui.flash.classList.add('on')
  setTimeout(() => ui.flash.classList.remove('on'), 160)
  updateBars()
  updateWanted()
  toast('<b>Wasted</b> — back on the boulevard')
}

function togglePause(force) {
  if (!state.started) return
  state.paused = force ?? !state.paused
  ui.pause.classList.toggle('is-hidden', !state.paused)
  if (state.paused) audio.setEngine(false, 0)
}

function startGame() {
  if (state.started) return
  state.started = true
  state.paused = false
  input.keys.clear()
  audio.start()
  ui.menu.classList.add('gone')
  ui.hud.classList.remove('is-hidden')
  ui.flash.classList.add('on')
  setTimeout(() => ui.flash.classList.remove('on'), 90)
  world.markers.missionStart.visible = true
  world.fixerLabel.visible = true
  snapCamera = true
  updateMissionUI()
  setZone('Neon Mile')
  hub.init()
  toast('<b>Welcome to Sunset City</b> — find the gold marker at El Rey Plaza', 'gold')
  setTimeout(() => toast('Walk into a lit doorway to chat · <b>F</b> to talk to people on the street'), 3200)
}

document.addEventListener('pointerdown', () => {
  if (state.started) audio.start()
}, { once: true })

ui.startBtn.addEventListener('click', startGame)
ui.pauseBtn.addEventListener('click', e => { e.stopPropagation(); togglePause(true) })
ui.resumeBtn.addEventListener('click', () => togglePause(false))
ui.soundBtn.addEventListener('click', e => {
  e.stopPropagation()
  if (!audio.started) audio.start()
  const on = audio.toggle()
  ui.soundBtn.textContent = on ? 'SOUND ON' : 'SOUND OFF'
})

window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
  if (e.code === 'Escape') {
    if (hub.handleEscape()) return
    togglePause()
    return
  }
  if (e.repeat) return
  input.keys.add(e.code)
  if (e.code === 'KeyE') {
    if (state.inCar) toggleVehicle()
    else {
      const venue = nearestVenue()
      if (venue) enterVenue(venue)
      else toggleVehicle()
    }
  }
  if (e.code === 'KeyF') {
    const npc = nearestNpc()
    if (npc) talkTo(npc)
    else missionAction()
  }
  if (e.code === 'KeyM') {
    state.camPitch = state.camPitch > 0.5 ? 0.27 : 0.68
  }
})
window.addEventListener('keyup', e => input.keys.delete(e.code))
window.addEventListener('blur', () => { input.keys.clear(); input.joy.x = 0; input.joy.y = 0; input.sprint = false; input.brake = false })

canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (activeLook !== null) return
  activeLook = e.pointerId
  input.lookX = e.clientX
  input.lookY = e.clientY
  state.lastLook = 0
  canvas.setPointerCapture?.(e.pointerId)
})
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== activeLook) return
  const dx = e.clientX - input.lookX
  const dy = e.clientY - input.lookY
  input.lookX = e.clientX
  input.lookY = e.clientY
  state.camYaw -= dx * 0.0052
  state.camPitch = THREE.MathUtils.clamp(state.camPitch + dy * 0.0036, 0.02, 0.72)
  state.lastLook = 0
})
function endLook(e) {
  if (e.pointerId === activeLook) activeLook = null
}
canvas.addEventListener('pointerup', endLook)
canvas.addEventListener('pointercancel', endLook)
canvas.addEventListener('wheel', e => {
  state.camDist = THREE.MathUtils.clamp(state.camDist + Math.sign(e.deltaY) * 0.6, 5.2, 13)
}, { passive: true })

function updateJoystick(e) {
  const rect = ui.joystick.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  let dx = e.clientX - cx
  let dy = e.clientY - cy
  const max = rect.width * 0.34
  const len = Math.hypot(dx, dy)
  if (len > max) { dx = dx / len * max; dy = dy / len * max }
  input.joy.x = dx / max
  input.joy.y = -dy / max
  ui.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`
}

ui.joystick.addEventListener('pointerdown', e => {
  e.preventDefault()
  input.joy.active = true
  input.joy.pointer = e.pointerId
  ui.joystick.setPointerCapture(e.pointerId)
  updateJoystick(e)
})
ui.joystick.addEventListener('pointermove', e => {
  if (e.pointerId === input.joy.pointer) updateJoystick(e)
})
function releaseJoystick(e) {
  if (e.pointerId !== input.joy.pointer) return
  input.joy.active = false
  input.joy.pointer = null
  input.joy.x = 0
  input.joy.y = 0
  ui.joystickKnob.style.transform = 'translate(0px, 0px)'
}
ui.joystick.addEventListener('pointerup', releaseJoystick)
ui.joystick.addEventListener('pointercancel', releaseJoystick)

function holdButton(button, key) {
  button.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); input[key] = true })
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    button.addEventListener(type, e => { e.stopPropagation(); input[key] = false })
  }
}
holdButton(ui.sprintBtn, 'sprint')
holdButton(ui.brakeBtn, 'brake')
ui.carBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleVehicle() })
ui.actionBtn.addEventListener('pointerdown', e => {
  e.preventDefault()
  e.stopPropagation()
  const npc = nearestNpc()
  if (npc) talkTo(npc)
  else missionAction()
})
ui.enterBtn.addEventListener('pointerdown', e => {
  e.preventDefault()
  e.stopPropagation()
  const venue = nearestVenue()
  if (venue) enterVenue(venue)
})
ui.socialBtn.addEventListener('click', e => {
  e.stopPropagation()
  hub.openVenues(playerAnchor())
})

function axisValue() {
  let x = input.joy.x
  let y = input.joy.y
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y += 1
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y -= 1
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1
  const len = Math.hypot(x, y)
  if (len > 1) { x /= len; y /= len }
  return { x, y }
}

function updatePlayer(dt, axis) {
  const speed = (input.sprint || input.keys.has('ShiftLeft') || input.keys.has('ShiftRight')) ? 7.3 : 4.3
  const moving = Math.hypot(axis.x, axis.y) > 0.08

  if (state.deathCooldown > 0) { state.deathCooldown -= dt; return }

  if (moving) {
    const forward = tempVec.set(-Math.sin(state.camYaw), 0, -Math.cos(state.camYaw))
    const right = tempVec2.set(Math.cos(state.camYaw), 0, -Math.sin(state.camYaw))
    const dir = new THREE.Vector3().addScaledVector(forward, axis.y).addScaledVector(right, axis.x)
    dir.y = 0
    if (dir.lengthSq() > 0) {
      dir.normalize()
      const step = speed * dt
      const nx = player.position.x + dir.x * step
      const nz = player.position.z + dir.z * step
      if (!isBlocked(world, nx, player.position.z, 0.42)) player.position.x = nx
      if (!isBlocked(world, player.position.x, nz, 0.42)) player.position.z = nz
      player.position.x = THREE.MathUtils.clamp(player.position.x, -255, 268)
      player.position.z = THREE.MathUtils.clamp(player.position.z, -278, 278)
      const targetHeading = Math.atan2(dir.x, dir.z)
      player.rotation.y = dampAngle(player.rotation.y, targetHeading, 12, dt)
    }
  } else {
    state.lastLook += dt
  }
  animateCharacter(player, dt, moving ? speed / 5.4 : 0, state.time)
}

function dampAngle(current, target, speed, dt) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI
  if (diff < -Math.PI) diff += Math.PI * 2
  return current + diff * (1 - Math.exp(-speed * dt))
}

function updateVehicle(dt, axis) {
  const car = state.car
  if (!car) return
  let speed = car.userData.speed || 0
  const throttle = axis.y
  const steering = axis.x
  const handbrake = input.brake || input.keys.has('Space')
  const maxSpeed = 32

  if (throttle > 0.06) {
    if (speed < 0) speed += 38 * dt * throttle
    else speed += (10 + 15 * throttle) * dt
  } else if (throttle < -0.06) {
    if (speed > 0) speed -= 34 * dt * Math.abs(throttle)
    else speed -= 11 * dt * Math.abs(throttle)
  } else {
    speed *= Math.exp(-dt * 0.85)
  }
  if (handbrake) speed *= Math.exp(-dt * 3.8)
  speed = THREE.MathUtils.clamp(speed, -10, maxSpeed)

  const turn = steering * 2.05 * Math.min(1, Math.abs(speed) / 7) * (speed >= 0 ? 1 : -1)
  if (Math.abs(speed) > 0.2) car.rotation.y += turn * dt
  car.userData.speed = speed

  const dx = Math.sin(car.rotation.y) * speed * dt
  const dz = Math.cos(car.rotation.y) * speed * dt
  const nx = car.position.x + dx
  const nz = car.position.z + dz
  const hit = isBlocked(world, nx, nz, 1.25)
  const outside = nx < -256 || nx > 270 || nz < -280 || nz > 280
  if (hit || outside) {
    if (Math.abs(speed) > 13) {
      applyDamage(Math.min(32, Math.abs(speed) * 0.9))
      audio.crash()
      toast('<b>Crash</b> — watch the corners')
    }
    car.userData.speed = -speed * 0.18
    car.position.x += Math.sin(car.rotation.y) * car.userData.speed * dt
    car.position.z += Math.cos(car.rotation.y) * car.userData.speed * dt
  } else {
    car.position.x = nx
    car.position.z = nz
  }

  const wheels = car.userData.wheels
  if (wheels) {
    for (let i = 0; i < wheels.length; i++) {
      wheels[i].rotation.x -= speed * dt * 2.2
      if (i < 2) wheels[i].rotation.y = -steering * 0.42
    }
  }
  car.position.y = 0.05
  audio.setEngine(true, speed, speed < 0)
  state.shake = Math.max(0, state.shake - dt * 1.5)

  if (Math.abs(speed) > 4) {
    for (const ped of world.peds) {
      if (!ped.userData.alive) continue
      const d = ped.position.distanceTo(car.position)
      if (d < 2.7 && ped.userData.scared <= 0) {
        ped.userData.scared = 6
        if (state.crimeCooldown <= 0) {
          addWanted(1, '<b>Reckless driving</b> — keep it civil')
          audio.crash()
          state.crimeCooldown = 4
        }
      }
    }
    if (state.crimeCooldown <= 0) {
      for (const other of world.trafficCars) {
        if (other.position.distanceTo(car.position) < 3.1) {
          addWanted(1, '<b>Traffic collision</b>')
          audio.crash()
          cameraShake(0.4)
          other.userData.speed *= 0.4
          state.crimeCooldown = 3.5
          break
        }
      }
    }
  }
}

function cameraShake(amount) {
  state.shake = Math.min(1.5, state.shake + amount)
}

function updateGameCamera(dt) {
  if (!state.started) return
  state.lastLook += dt
  const inCar = state.inCar
  const focus = inCar ? state.car : player
  const targetY = inCar ? 1.15 : 1.35
  const target = new THREE.Vector3(focus.position.x, focus.position.y + targetY, focus.position.z)

  if (inCar && state.lastLook > 1.4) {
    state.camYaw = dampAngle(state.camYaw, state.car.rotation.y + Math.PI, 1.35, dt)
  }
  state.camPitch = THREE.MathUtils.clamp(state.camPitch, 0.02, 0.72)
  const portrait = camera.aspect < 0.82 ? 1.26 : 1
  const dist = (inCar ? Math.min(12.2, state.camDist + 1.9) : state.camDist) * portrait
  const cp = Math.cos(state.camPitch)
  const offset = new THREE.Vector3(
    Math.sin(state.camYaw) * cp * dist,
    Math.sin(state.camPitch) * dist + (inCar ? 1.3 : 1.25),
    Math.cos(state.camYaw) * cp * dist
  )
  const desired = target.clone().add(offset)
  if (snapCamera) {
    camera.position.copy(desired)
    snapCamera = false
  } else {
    camera.position.lerp(desired, 1 - Math.exp(-9 * dt))
  }
  if (state.shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * state.shake * 0.9
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.7
    camera.position.z += (Math.random() - 0.5) * state.shake * 0.9
    state.shake = Math.max(0, state.shake - dt * 2.6)
  }
  camLookTarget.copy(target)
  camLookTarget.y += inCar ? 0.25 : 0.2
  if (inCar) {
    camLookTarget.x += Math.sin(state.car.rotation.y) * 2.1
    camLookTarget.z += Math.cos(state.car.rotation.y) * 2.1
  }
  camera.lookAt(camLookTarget)
  const speed = inCar ? Math.abs(state.car.userData.speed) : 0
  const targetFov = (camera.aspect < 0.82 ? 60 : 57) + Math.min(8, speed * 0.25)
  camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-4 * dt))
  camera.updateProjectionMatrix()
}
const camLookTarget = new THREE.Vector3()

function updateMenuCamera(t) {
  const angle = 0.8 + t * 0.024
  const radius = 300 + Math.sin(t * 0.13) * 14
  camera.position.set(Math.cos(angle) * radius, 43 + Math.sin(t * 0.21) * 2.5, Math.sin(angle) * radius)
  camera.lookAt(-10, 34, -52)
  camera.fov = 48
  camera.updateProjectionMatrix()
}

function updateHud(dt) {
  const m = state.mission
  if (m.stage === 'active') {
    m.timer -= dt
    if (m.timer <= 0) failMission()
    if (!state.social.mission) {
      ui.missionTimer.textContent = formatTime(m.timer)
      ui.missionBar.style.width = Math.min(100, 25 + (1 - m.timer / 150) * 65) + '%'
    }
    m.distanceTick = (m.distanceTick || 0) - dt
    if (m.distanceTick <= 0) {
      m.distanceTick = 0.35
      const target = state.inCar ? state.car.position : player.position
      const d = Math.round(target.distanceTo(world.dropOff))
      if (!state.social.mission) ui.missionSub.textContent = d + 'm to the Pier 99 drop-off'
    }
  } else if (m.stage === 'idle' && !state.social.mission) {
    m.distanceTick = (m.distanceTick || 0) - dt
    if (m.distanceTick <= 0) {
      m.distanceTick = 0.5
      const d = Math.round(player.position.distanceTo(world.missionStart))
      ui.missionSub.textContent = d < 6 ? 'Press F to talk to the fixer' : d + 'm to El Rey Plaza'
    }
  }
  if (state.social.mission) updateSocialMissionUI()
  state.crimeCooldown = Math.max(0, state.crimeCooldown - dt)
  if (state.wanted > 0) {
    state.wantedCool -= dt
    if (state.wantedCool <= 0) {
      state.wanted -= 1
      state.wantedCool = 18
      updateWanted()
    }
  }
  state.zoneTick -= dt
  if (state.zoneTick <= 0) {
    state.zoneTick = 0.5
    let best = null
    let bestScore = Infinity
    for (const z of world.zones) {
      const d = Math.hypot(player.position.x - z.x, player.position.z - z.z)
      const score = d / z.r
      if (score < 1 && score < bestScore) { best = z; bestScore = score }
    }
    if (best) setZone(best.name)
  }
  const inCar = state.inCar
  ui.speedo.classList.toggle('is-hidden', !inCar)
  if (inCar) {
    const mph = Math.round(Math.abs(state.car.userData.speed) * 2.237)
    ui.speedNum.textContent = mph
    ui.speedDial.style.setProperty('--p', Math.min(285, mph * 3.8) + 'deg')
    ui.gear.textContent = state.car.userData.speed < -0.5 ? 'R' : 'D'
  }
  const minutes = 18 * 60 + 42 + state.elapsed * 0.58
  const hh = Math.floor(minutes / 60) % 24
  const mm = Math.floor(minutes % 60)
  if (ui.clock.textContent !== `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`) {
    ui.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }
  updatePrompt()
}

let promptCache = ''
function updatePrompt() {
  if (!state.started || state.paused || state.social.open) {
    ui.prompt.classList.add('is-hidden')
    ui.enterBtn.classList.add('is-hidden')
    return
  }
  let key = ''
  let text = ''
  const venue = state.inCar ? null : nearestVenue()
  if (state.inCar) {
    key = 'E'
    text = 'EXIT VEHICLE'
  } else {
    if (venue) {
      key = 'E'
      text = `ENTER ${venue.name}`
    } else {
      const npc = nearestNpc()
      if (npc) {
        key = 'F'
        text = `TALK TO ${npc.name.toUpperCase()}`
      } else {
        const nearCar = nearestEnterableCar()
        if (state.mission.stage === 'idle' && player.position.distanceTo(world.missionStart) < 5.4) {
          key = 'F'
          text = 'START MISSION'
        } else if (nearCar) {
          key = 'E'
          text = 'ENTER VEHICLE'
        }
      }
    }
  }
  ui.enterBtn.classList.toggle('is-hidden', !venue)
  const id = key + text
  if (id !== promptCache) {
    promptCache = id
    ui.promptKey.textContent = key
    ui.promptText.textContent = text
  }
  ui.prompt.classList.toggle('is-hidden', !key)
}

function checkMissionWorld() {
  if (state.mission.stage === 'active') {
    const target = state.inCar ? state.car.position : player.position
    const d = target.distanceTo(world.dropOff)
    if (d < 8.5) completeMission()
  }
  if (state.mission.stage === 'complete' || state.mission.stage === 'failed') {
    state.mission.cooldown -= 1 / 60
    if (state.mission.cooldown <= 0) resetMission()
  }
}

function checkCollectibles() {
  for (const c of world.collectibles) {
    if (c.userData.taken) continue
    if (player.position.distanceTo(c.position) < 2.7) {
      c.userData.taken = true
      c.visible = false
      state.tokens += 1
      state.money += 100
      audio.chime()
      ui.tokenCount.textContent = `${state.tokens} / 12`
      updateMoney()
      toast(`<b>Sunset token ${state.tokens}/12</b> — +$100`, 'cyan')
      if (state.tokens === 12) {
        state.money += 5000
        updateMoney()
        toast('<b>All tokens found</b> — +$5,000. The city is yours.', 'gold')
      }
    }
  }
}

let radarTick = 0
let lastTime = performance.now()

function frame(now) {
  requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016)
  lastTime = now
  state.elapsed += dt
  state.time += dt

  if (!state.paused) {
    if (state.started) {
      const axis = state.social.open ? { x: 0, y: 0 } : axisValue()
      if (state.inCar) updateVehicle(dt, axis)
      else updatePlayer(dt, axis)
      updateCompanions(dt)
      updateGameCamera(dt)
      if (state.deathCooldown > 0) state.deathCooldown -= dt
      checkMissionWorld()
      checkCollectibles()
      updateHud(dt)
      reportSocialProgress()
    } else {
      updateMenuCamera(state.time)
    }
    updateWorld(world, dt, state.time, player.position, camera)
  } else {
    updateWorld(world, 0, state.time, player.position, camera)
  }

  hub.updateBubbles(camera)

  radarTick += dt
  if (radarTick > 0.09) {
    radarTick = 0
    const heading = state.inCar ? state.car.rotation.y : player.rotation.y
    let missionPos = null
    if (state.mission.stage === 'idle') missionPos = world.missionStart
    if (state.mission.stage === 'active') missionPos = world.dropOff
    const step = currentSocialStep()
    let waypoint = state.social.waypoint
    if (step && typeof step.x === 'number' && typeof step.z === 'number') {
      waypoint = tempVec3.set(step.x, 0, step.z)
    }
    radar.update(state.inCar ? state.car.position : player.position, heading - Math.PI, { mission: missionPos, dropOff: state.mission.stage === 'active' ? world.dropOff : null, waypoint })
  }

  renderer.render(scene, camera)
}

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.started && !state.paused) togglePause(true)
})

updateBars()
updateMoney()
updateWanted()
updateMissionUI()

window.__sunset = { state, world, player, camera, renderer, scene, startGame, startMission, completeMission, input }

setTimeout(() => ui.loading.classList.add('hidden'), 420)
requestAnimationFrame(frame)

window.addEventListener('load', () => {
  setTimeout(() => ui.loading.classList.add('hidden'), 100)
})
