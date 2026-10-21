import { SHARDS, VIRTUES, VIRTUE_ORDER } from '../data.js'
import { formatDistance, formatTime, victoryRank } from '../logic.js'

export class UI {
  constructor(callbacks = {}) {
    this.callbacks = callbacks
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
    this.elements = {
      hud: document.getElementById('hud'),
      title: document.getElementById('title-screen'),
      pause: document.getElementById('pause-screen'),
      ending: document.getElementById('ending-screen'),
      transition: document.getElementById('transition'),
      transitionTitle: document.getElementById('transition-title'),
      transitionSub: document.getElementById('transition-sub'),
      healthFill: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      staminaFill: document.getElementById('stamina-fill'),
      virtues: document.getElementById('virtues'),
      keys: document.getElementById('key-sockets'),
      quest: document.getElementById('quest-text'),
      prompt: document.getElementById('prompt'),
      promptKey: document.getElementById('prompt-key'),
      promptText: document.getElementById('prompt-text'),
      bossBar: document.getElementById('boss-bar'),
      bossName: document.getElementById('boss-name'),
      bossRule: document.getElementById('boss-rule'),
      bossFill: document.getElementById('boss-fill'),
      ruleChip: document.getElementById('rule-chip'),
      ruleName: document.getElementById('rule-name'),
      ruleDetail: document.getElementById('rule-detail'),
      compass: document.getElementById('compass'),
      compassDistance: document.getElementById('compass-distance'),
      toasts: document.getElementById('toasts'),
      damage: document.getElementById('damage-flash'),
      heal: document.getElementById('heal-flash'),
      shadow: document.getElementById('shadow-veil'),
      special: document.getElementById('special-meter'),
      specialLabel: document.getElementById('special-label'),
      specialFill: document.getElementById('special-fill'),
      mute: document.getElementById('btn-mute'),
      soundToggle: document.getElementById('btn-sound-toggle'),
      endingCopy: document.getElementById('ending-copy'),
      endingStats: document.getElementById('ending-stats'),
      reticle: document.getElementById('reticle'),
      interact: document.getElementById('btn-interact')
    }
    this.buildVirtues()
    this.buildKeys()
    this.bind()
  }

  bind() {
    document.getElementById('btn-start')?.addEventListener('click', () => this.callbacks.onStart?.())
    document.getElementById('btn-pause')?.addEventListener('click', () => this.callbacks.onPause?.())
    document.getElementById('btn-mute')?.addEventListener('click', () => this.callbacks.onMute?.())
    document.getElementById('btn-sound-toggle')?.addEventListener('click', () => this.callbacks.onMute?.())
    document.getElementById('btn-resume')?.addEventListener('click', () => this.callbacks.onResume?.())
    document.getElementById('btn-restart')?.addEventListener('click', () => this.callbacks.onRestart?.())
    document.getElementById('btn-again')?.addEventListener('click', () => this.callbacks.onRestart?.())
    document.querySelectorAll('#quality-seg button').forEach(button => {
      button.addEventListener('click', () => this.callbacks.onQuality?.(button.dataset.quality))
    })
  }

  buildVirtues() {
    this.virtueNodes = {}
    for (const id of VIRTUE_ORDER) {
      const virtue = VIRTUES[id]
      const node = document.createElement('div')
      node.className = 'virtue'
      node.style.setProperty('--vc', virtue.css)
      node.innerHTML = `
        <div class="virtue-head"><span>${virtue.name.slice(0, 3).toUpperCase()}</span><span class="virtue-glyph">${virtue.glyph}</span></div>
        <div class="virtue-track"><div class="virtue-fill"></div></div>
      `
      this.elements.virtues.appendChild(node)
      this.virtueNodes[id] = { node, fill: node.querySelector('.virtue-fill') }
    }
  }

  buildKeys() {
    this.keyNodes = {}
    for (const shard of SHARDS) {
      const socket = document.createElement('div')
      socket.className = 'key-socket'
      socket.style.setProperty('--socket-color', shard.css)
      socket.title = `${shard.name} key`
      this.elements.keys.appendChild(socket)
      this.keyNodes[shard.id] = socket
    }
  }

  showHud() {
    this.elements.hud.classList.remove('is-hidden')
    this.elements.title.classList.add('is-hidden')
  }

  hideHud() {
    this.elements.hud.classList.add('is-hidden')
  }

  showTitle() {
    this.elements.title.classList.remove('is-hidden')
    this.hideHud()
  }

  showPause() {
    this.elements.pause.classList.remove('is-hidden')
  }

  hidePause() {
    this.elements.pause.classList.add('is-hidden')
  }

  setHealth(value, max) {
    const ratio = Math.max(0, Math.min(1, value / max))
    this.elements.healthFill.style.width = `${ratio * 100}%`
    this.elements.healthFill.classList.toggle('low', ratio < 0.3)
    this.elements.healthText.textContent = `${Math.ceil(Math.max(0, value))}`
  }

  setStamina(value, max) {
    this.elements.staminaFill.style.width = `${Math.max(0, Math.min(1, value / max)) * 100}%`
  }

  setVirtues(virtues, flashId = null) {
    for (const id of VIRTUE_ORDER) {
      const node = this.virtueNodes[id]
      if (!node) continue
      node.fill.style.width = `${Math.max(0, Math.min(100, virtues[id]))}%`
      if (flashId === id) {
        node.node.classList.remove('flash')
        void node.node.offsetWidth
        node.node.classList.add('flash')
      }
    }
  }

  setKeys(keys) {
    for (const shard of SHARDS) {
      this.keyNodes[shard.id]?.classList.toggle('filled', keys.includes(shard.id))
    }
  }

  setQuest(text) {
    this.elements.quest.textContent = text
  }

  setRule(name, detail, visible = true) {
    this.elements.ruleChip.classList.toggle('is-hidden', !visible)
    if (name) this.elements.ruleName.textContent = name
    if (detail !== undefined) this.elements.ruleDetail.textContent = detail
  }

  setHudDark(dark) {
    this.elements.hud.classList.toggle('rule-dark', dark)
    this.elements.shadow.style.opacity = dark ? '0.75' : '0'
  }

  setPrompt(text, key = null) {
    if (!text) {
      this.elements.prompt.classList.add('is-hidden')
      this.elements.interact?.classList.remove('ready')
      return
    }
    this.elements.prompt.classList.remove('is-hidden')
    this.elements.promptText.textContent = text
    this.elements.promptKey.textContent = key ?? (this.isTouch ? '✦' : 'E')
    this.elements.interact?.classList.add('ready')
  }

  setCompass({ heading = 0, questAngle = 0, distance = null, visible = true } = {}) {
    this.elements.compass.style.opacity = visible ? '1' : '0'
    this.elements.compass.style.setProperty('--heading', `${heading}rad`)
    this.elements.compass.style.setProperty('--quest-angle', `${questAngle}rad`)
    this.elements.compassDistance.textContent = distance === null || distance === undefined ? '—' : formatDistance(distance)
  }

  showBoss(name, rule) {
    this.elements.bossName.textContent = name
    this.elements.bossRule.textContent = rule
    this.elements.bossBar.classList.remove('is-hidden')
  }

  updateBoss(hp, max) {
    this.elements.bossFill.style.width = `${Math.max(0, Math.min(1, hp / max)) * 100}%`
  }

  hideBoss() {
    this.elements.bossBar.classList.add('is-hidden')
  }

  toast(text, variant = '', duration = 3200) {
    const node = document.createElement('div')
    node.className = `toast ${variant}`
    node.textContent = text
    if (variant === 'virtue') {
      const virtue = VIRTUE_ORDER.find(id => text.toLowerCase().includes(VIRTUES[id].name.toLowerCase()))
      if (virtue) node.style.setProperty('--virtue-color', VIRTUES[virtue].css)
    }
    this.elements.toasts.appendChild(node)
    while (this.elements.toasts.children.length > 3) this.elements.toasts.firstElementChild.remove()
    setTimeout(() => {
      node.classList.add('out')
      setTimeout(() => node.remove(), 500)
    }, duration)
  }

  damageFlash() {
    this.elements.damage.style.opacity = '1'
    setTimeout(() => { this.elements.damage.style.opacity = '0' }, 90)
  }

  healFlash() {
    this.elements.heal.style.opacity = '1'
    setTimeout(() => { this.elements.heal.style.opacity = '0' }, 160)
  }

  setSpecial(visible, value = 0, label = 'LIGHT') {
    this.elements.special.classList.toggle('is-hidden', !visible)
    if (!visible) return
    this.elements.specialLabel.textContent = label
    this.elements.specialFill.style.width = `${Math.max(0, Math.min(1, value / 100)) * 100}%`
  }

  setMuted(muted) {
    this.elements.mute?.classList.toggle('muted', muted)
    this.elements.soundToggle?.classList.toggle('is-on', !muted)
  }

  setQuality(quality) {
    document.querySelectorAll('#quality-seg button').forEach(button => {
      button.classList.toggle('is-on', button.dataset.quality === quality)
    })
  }

  beginTransition(title, sub = '') {
    this.elements.transitionTitle.textContent = title
    this.elements.transitionSub.textContent = sub
    this.elements.transition.classList.add('active')
  }

  endTransition() {
    this.elements.transition.classList.remove('active')
  }

  showEnding(state, { shards = 4 } = {}) {
    this.elements.ending.classList.remove('is-hidden')
    this.hideHud()
    const total = VIRTUE_ORDER.reduce((sum, id) => sum + state.virtues[id], 0)
    this.elements.endingCopy.textContent = 'The four Shards sing as one. The Sentient Maze remembers your name, and opens its final door.'
    this.elements.endingStats.innerHTML = `
      <div class="ending-stat"><b>${victoryRank(state)}</b><span>SEEKER RANK</span></div>
      <div class="ending-stat"><b>${Math.round(total)}</b><span>TOTAL VIRTUE</span></div>
      <div class="ending-stat"><b>${state.kills}</b><span>FOES FACED</span></div>
      <div class="ending-stat"><b>${formatTime(Date.now() - state.startedAt)}</b><span>TIME IN THE MAZE</span></div>
      <div class="ending-stat"><b>${shards} / 4</b><span>SHARDS RESTORED</span></div>
    `
  }

  hideEnding() {
    this.elements.ending.classList.add('is-hidden')
  }
}
