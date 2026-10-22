import * as THREE from 'three'

const CHIPS = {
  default: ['What is going on tonight?', 'Anyone got work?', 'Who else is here?', 'Tell me something good.'],
  job: ['Any jobs on the board?', 'What is the payout?', 'I will take it.', 'Who is in charge?']
}

const HUMAN_NAMES = ['Rook', 'Sparrow', 'Wren', 'Juno', 'Cass', 'Marlow', 'Dove', 'Slate', 'Kite', 'Vega']

function initials(name) {
  return String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function timeLabel(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export class SocialHub {
  constructor({ onMission, onToast, onPickVenue, onOpenRoom, onClose } = {}) {
    this.onMission = onMission || (() => {})
    this.onToast = onToast || (() => {})
    this.onPickVenue = onPickVenue || (() => {})
    this.onOpenRoom = onOpenRoom || (() => {})
    this.onClose = onClose || (() => {})
    this.clientId = localStorage.getItem('sunset.client') || `c${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem('sunset.client', this.clientId)
    this.playerName = localStorage.getItem('sunset.name') || HUMAN_NAMES[Math.floor(Math.random() * HUMAN_NAMES.length)]
    localStorage.setItem('sunset.name', this.playerName)
    this.rooms = []
    this.messages = []
    this.mode = 'closed'
    this.room = null
    this.dmPersona = null
    this.bubbles = []
    this.provider = { provider: 'sim', model: 'sunset-sim' }
    this.board = []
    this.activeMission = null

    this.el = {
      panel: document.querySelector('#socialPanel'),
      roomName: document.querySelector('#socialRoomName'),
      roomTopic: document.querySelector('#socialRoomTopic'),
      accent: document.querySelector('#socialAccent'),
      presence: document.querySelector('#socialPresence'),
      provider: document.querySelector('#socialProvider'),
      members: document.querySelector('#socialMembers'),
      log: document.querySelector('#chatLog'),
      chips: document.querySelector('#chatChips'),
      form: document.querySelector('#chatForm'),
      input: document.querySelector('#chatInput'),
      send: document.querySelector('#chatSend'),
      close: document.querySelector('#socialClose'),
      leave: document.querySelector('#leaveRoomBtn'),
      boardBtn: document.querySelector('#boardBtn'),
      boardPanel: document.querySelector('#boardPanel'),
      boardList: document.querySelector('#boardList'),
      boardClose: document.querySelector('#boardClose'),
      boardGenerate: document.querySelector('#boardGenerate'),
      boardStatus: document.querySelector('#boardStatus'),
      venuesPanel: document.querySelector('#venuesPanel'),
      venuesList: document.querySelector('#venuesList'),
      venuesClose: document.querySelector('#venuesClose'),
      venuesBoard: document.querySelector('#venuesBoardBtn'),
      bubbleLayer: document.querySelector('#bubbleLayer')
    }

    this.bindEvents()
  }

  bindEvents() {
    this.el.form.addEventListener('submit', (event) => {
      event.preventDefault()
      this.send(this.el.input.value)
      this.el.input.value = ''
    })
    this.el.close.addEventListener('click', () => this.exitRoom())
    this.el.leave.addEventListener('click', () => this.exitRoom())
    this.el.boardBtn.addEventListener('click', () => this.openBoard())
    this.el.boardClose.addEventListener('click', () => this.closeBoard())
    this.el.boardGenerate.addEventListener('click', () => this.generateMission())
    this.el.venuesClose.addEventListener('click', () => this.closeVenues())
    this.el.venuesBoard.addEventListener('click', () => {
      this.closeVenues()
      this.openBoard()
    })
  }

  handleEscape() {
    if (!this.el.venuesPanel.classList.contains('is-hidden')) {
      this.closeVenues()
      return true
    }
    if (!this.el.boardPanel.classList.contains('is-hidden')) {
      this.closeBoard()
      return true
    }
    if (this.mode === 'room' || this.mode === 'dm') {
      this.exitRoom()
      return true
    }
    return false
  }

  async init() {
    try {
      const res = await fetch('/api/rooms')
      const body = await res.json()
      this.rooms = body.rooms || []
    } catch {
      this.rooms = []
    }
    try {
      const res = await fetch(`/api/missions?clientId=${encodeURIComponent(this.clientId)}`)
      const body = await res.json()
      this.board = body.board || []
      if (body.active) this.onMission(body.active)
    } catch {
      /* server offline: the city still runs, just without the hub */
    }
    this.connectStream()
  }

  connectStream() {
    if (typeof EventSource === 'undefined') return
    try {
      this.stream = new EventSource(`/api/stream?clientId=${encodeURIComponent(this.clientId)}`)
      this.stream.onmessage = (event) => {
        let payload
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }
        this.handleEvent(payload)
      }
      this.stream.onerror = () => {
        this.el.provider.textContent = 'OFFLINE'
        this.el.provider.style.color = '#ffb27a'
      }
    } catch {
      /* no stream support */
    }
  }

  handleEvent(payload) {
    if (payload.type === 'hello') {
      this.provider = payload.provider || this.provider
      this.el.provider.textContent = payload.provider?.provider === 'zen' ? `AI ${payload.provider.model}` : 'CITY AI'
      return
    }
    if (payload.type === 'message') {
      const message = payload.message
      if (!message) return
      if (this.mode === 'room' && message.roomId === this.room?.id) {
        this.messages.push(message)
        this.renderMessages()
      }
      return
    }
    if (payload.type === 'presence') {
      if (this.mode === 'room' && payload.roomId === this.room?.id) {
        const others = (payload.names || []).filter((name) => name !== this.playerName)
        this.el.presence.textContent = others.length
          ? `${payload.humans} here · ${others.join(', ')}`
          : `${payload.humans} here`
      }
      return
    }
    if (payload.type === 'mission_update') {
      if (payload.clientId && payload.clientId !== this.clientId) return
      this.activeMission = payload.mission || null
      this.onMission(this.activeMission)
      if (payload.note === 'accepted') this.onToast('Job accepted — your crew is rolling')
      return
    }
  }

  async enterRoom(room) {
    const target = typeof room === 'string' ? this.rooms.find((r) => r.id === room) : room
    if (!target) return
    this.mode = 'room'
    this.room = target
    this.dmPersona = null
    this.messages = []
    this.el.roomName.textContent = target.name
    this.el.roomTopic.textContent = target.topic
    this.el.accent.style.background = target.accent || '#5ff5df'
    this.el.accent.style.color = target.accent || '#5ff5df'
    this.el.presence.textContent = `${target.humans || 0} here`
    this.el.boardBtn.classList.toggle('is-hidden', !target.board)
    this.el.panel.classList.remove('is-hidden')
    this.el.input.placeholder = `Say something in ${target.name}...`
    this.renderMembers(target.members || [])
    this.renderChips(CHIPS.default)
    this.el.log.innerHTML = '<div class="chat-msg is-system"><div class="chat-text">Loading the room...</div></div>'

    try {
      const res = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: this.clientId, roomId: target.id, name: this.playerName })
      })
      const body = await res.json()
      if (body.room) {
        this.room = { ...target, ...body.room, members: target.members }
        this.el.presence.textContent = `${body.humans || 0} here`
      }
      const history = await (await fetch(`/api/room/${target.id}`)).json()
      this.messages = history.messages || []
      this.renderMessages()
    } catch {
      this.el.log.innerHTML = '<div class="chat-msg is-system"><div class="chat-text">The hub is not answering. City AI is offline.</div></div>'
    }
    this.pushOpen()
  }

  enterDm(persona, anchor = null) {
    this.mode = 'dm'
    this.room = { id: `dm-${persona.id}`, name: persona.name, topic: persona.blurb, accent: persona.color, members: [persona] }
    this.dmPersona = persona
    this.messages = []
    this.el.roomName.textContent = persona.name
    this.el.roomTopic.textContent = `${persona.role} — private chat`
    this.el.accent.style.background = persona.color
    this.el.accent.style.color = persona.color
    this.el.presence.textContent = '1 on 1'
    this.el.boardBtn.classList.add('is-hidden')
    this.el.panel.classList.remove('is-hidden')
    this.el.input.placeholder = `Talk to ${persona.name}...`
    this.renderMembers([persona])
    this.renderChips(CHIPS.default)
    this.pushLocal({ kind: 'system', text: `You step aside and talk to ${persona.name}.`, author: { name: 'Sunset City', color: '#8aa0b8' } })
    this.pushOpen()
    this.greet(persona, anchor)
  }

  async greet(persona, anchor) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.clientId,
          roomId: `dm-${persona.id}`,
          target: persona.id,
          text: 'hey'
        })
      })
      const body = await res.json()
      if (body.reply) {
        this.pushLocal(body.reply)
        if (anchor) this.say(anchor, persona.name, body.reply.text, persona.color)
      }
    } catch {
      /* hub offline */
    }
  }

  exitRoom() {
    if (this.mode === 'closed') return
    if (this.mode === 'room' && this.room) {
      fetch('/api/room/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: this.clientId, roomId: this.room.id })
      }).catch(() => {})
    }
    this.mode = 'closed'
    this.room = null
    this.dmPersona = null
    this.messages = []
    this.el.panel.classList.add('is-hidden')
    this.el.log.innerHTML = ''
    this.popOpen()
  }

  pushOpen() {
    this.openCount = (this.openCount || 0) + 1
    document.body.classList.add('social-open')
    this.onOpenRoom(this.room)
  }

  popOpen() {
    this.openCount = Math.max(0, (this.openCount || 0) - 1)
    if (this.openCount > 0) return
    document.body.classList.remove('social-open')
    this.onClose()
  }

  renderMembers(members) {
    this.el.members.innerHTML = ''
    for (const member of members || []) {
      if (!member || !member.name) continue
      const chip = document.createElement('span')
      chip.className = 'member-chip'
      chip.innerHTML = `<i class="member-dot" style="background:${member.color}">${initials(member.name)}</i>${member.name}`
      this.el.members.appendChild(chip)
    }
  }

  renderChips(list) {
    this.el.chips.innerHTML = ''
    for (const text of list) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'chat-chip'
      chip.textContent = text
      chip.addEventListener('click', () => this.send(text))
      this.el.chips.appendChild(chip)
    }
  }

  pushLocal(message) {
    this.messages.push(message)
    this.renderMessages()
  }

  renderMessages() {
    const log = this.el.log
    log.innerHTML = ''
    for (const message of this.messages.slice(-60)) {
      const author = message.author || { name: 'Unknown', color: '#8aa0b8', role: '' }
      const wrap = document.createElement('div')
      wrap.className = 'chat-msg'
      if (message.kind === 'system') wrap.classList.add('is-system')
      if (message.tone === 'good') wrap.classList.add('is-good')
      if (message.kind === 'mission') wrap.classList.add('is-mission')
      if (author.id === 'player') wrap.classList.add('is-human')
      wrap.innerHTML = `
        <div class="chat-avatar" style="background:${author.color}">${initials(author.name)}</div>
        <div class="chat-body">
          <div class="chat-meta">
            <span class="chat-name" style="color:${author.color}">${author.name}</span>
            ${author.role ? `<span class="chat-role">${author.role}</span>` : ''}
            <span class="chat-time">${timeLabel(message.ts || Date.now())}</span>
          </div>
          <div class="chat-text">${this.escape(message.text || '')}${message.provider === 'zen' ? '<span class="chat-provider">·llm</span>' : ''}</div>
        </div>`
      log.appendChild(wrap)
    }
    log.scrollTop = log.scrollHeight
  }

  escape(text) {
    return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
  }

  async send(raw) {
    const text = String(raw || '').trim()
    if (!text || this.mode === 'closed') return
    if (this.mode === 'dm' && this.dmPersona) {
      this.pushLocal({
        kind: 'chat',
        text,
        author: { id: 'player', name: 'You', role: 'Human', color: '#7bd4ff' },
        ts: Date.now()
      })
      this.el.input.value = ''
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: this.clientId,
            roomId: this.room.id,
            target: this.dmPersona.id,
            text
          })
        })
        const body = await res.json()
        if (body.reply) this.pushLocal(body.reply)
      } catch {
        this.pushLocal({ kind: 'system', text: 'No answer. The hub is offline.', author: { name: 'Sunset City', color: '#8aa0b8' } })
      }
      return
    }

    this.el.input.value = ''
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: this.clientId, roomId: this.room.id, text })
      })
    } catch {
      this.pushLocal({ kind: 'system', text: 'The hub did not answer.', author: { name: 'Sunset City', color: '#8aa0b8' } })
    }
  }

  async openBoard() {
    this.el.boardPanel.classList.remove('is-hidden')
    this.pushOpen()
    this.el.boardStatus.textContent = 'loading...'
    try {
      const res = await fetch(`/api/missions?clientId=${encodeURIComponent(this.clientId)}`)
      const body = await res.json()
      this.board = body.board || []
      this.activeMission = body.active || this.activeMission
      this.renderBoard()
      this.el.boardStatus.textContent = `${this.board.length} open contracts`
    } catch {
      this.el.boardStatus.textContent = 'board offline'
    }
  }

  closeBoard() {
    this.el.boardPanel.classList.add('is-hidden')
    this.popOpen()
  }

  async generateMission() {
    this.el.boardStatus.textContent = 'posting...'
    try {
      await fetch('/api/missions/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      await this.openBoard()
    } catch {
      this.el.boardStatus.textContent = 'the fixer is offline'
    }
  }

  renderBoard() {
    const list = this.el.boardList
    list.innerHTML = ''
    for (const mission of this.board) {
      const active = this.activeMission && this.activeMission.id === mission.id
      const card = document.createElement('div')
      card.className = 'board-card' + (active ? ' is-active' : '')
      const steps = (mission.steps || []).map((step, index) => {
        const done = active && index < (mission.stepIndex || 0)
        const current = active && index === (mission.stepIndex || 0)
        return `<span class="board-step ${done ? 'done' : ''} ${current ? 'active' : ''}">${step.label}</span>`
      }).join('')
      card.innerHTML = `
        <div class="board-card-top"><b>${mission.title}</b><span>$${mission.reward}</span></div>
        <div class="board-brief">${mission.brief}</div>
        <div class="board-steps">${steps}</div>
        <div class="board-meta">
          <span class="board-who">GIVER ${(mission.giver || '').toUpperCase()}${mission.companions && mission.companions.length ? ` · CREW ${mission.companions.join(', ').toUpperCase()}` : ''}</span>
          <button class="board-accept" ${active ? 'disabled' : ''}>${active ? 'ON THE JOB' : 'ACCEPT'}</button>
        </div>`
      const button = card.querySelector('.board-accept')
      button.addEventListener('click', () => this.acceptMission(mission))
      list.appendChild(card)
    }
  }

  async acceptMission(mission) {
    try {
      const res = await fetch('/api/missions/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: this.clientId, missionId: mission.id, roomId: this.room?.id || 'el-rey' })
      })
      const body = await res.json()
      if (body.mission) {
        this.activeMission = body.mission
        this.onMission(body.mission)
        this.renderBoard()
        this.closeBoard()
        this.exitRoom()
      }
    } catch {
      this.el.boardStatus.textContent = 'could not accept'
    }
  }

  openVenues(playerPosition) {
    this.el.venuesPanel.classList.remove('is-hidden')
    this.pushOpen()
    this.renderVenues(playerPosition)
  }

  closeVenues() {
    this.el.venuesPanel.classList.add('is-hidden')
    this.popOpen()
  }

  renderVenues(playerPosition) {
    const list = this.el.venuesList
    list.innerHTML = ''
    const rows = this.rooms
      .map((room) => {
        const venue = room.venue
        const door = venue?.door
        const distance = playerPosition && door ? Math.round(Math.hypot(playerPosition.x - door.x, playerPosition.z - door.z)) : null
        return { room, distance }
      })
      .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999))
    for (const { room, distance } of rows) {
      const row = document.createElement('div')
      row.className = 'venue-row' + (distance !== null && distance < 30 ? ' is-near' : '')
      row.innerHTML = `
        <span class="venue-swatch" style="background:${room.accent}"></span>
        <span class="venue-copy"><b>${room.name}</b><small>${room.blurb || room.topic}</small></span>
        <span class="venue-dist">${distance === null ? '--' : `${distance}m`}</span>`
      row.addEventListener('click', () => {
        this.closeVenues()
        this.onPickVenue(room)
      })
      list.appendChild(row)
    }
  }

  say(anchor, name, text, color = '#ffd35f') {
    if (!anchor || !this.el.bubbleLayer) return
    const el = document.createElement('div')
    el.className = 'bubble'
    el.style.setProperty('--bubble-color', color)
    el.innerHTML = `<span class="bubble-name">${name}</span>${this.escape(text)}`
    this.el.bubbleLayer.appendChild(el)
    const bubble = { el, anchor, until: performance.now() + 5200 }
    this.bubbles.push(bubble)
    setTimeout(() => {
      el.classList.add('is-fading')
      setTimeout(() => el.remove(), 450)
      this.bubbles = this.bubbles.filter((b) => b !== bubble)
    }, 5200)
  }

  updateBubbles(camera) {
    if (!this.bubbles.length) return
    const width = window.innerWidth
    const height = window.innerHeight
    const vector = new THREE.Vector3()
    for (const bubble of this.bubbles) {
      const position = bubble.anchor?.position || bubble.anchor
      if (!position) continue
      vector.set(position.x, (position.y || 0) + 2.25, position.z)
      vector.project(camera)
      const visible = vector.z < 1
      bubble.el.style.display = visible ? 'block' : 'none'
      if (!visible) continue
      bubble.el.style.left = `${(vector.x * 0.5 + 0.5) * width}px`
      bubble.el.style.top = `${(-vector.y * 0.5 + 0.5) * height}px`
    }
  }
}
