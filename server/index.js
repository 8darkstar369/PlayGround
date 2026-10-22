import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PERSONAS, ROOMS, MISSION_TEMPLATES, personaById, roomById } from '../src/data/social.js'
import { complete, providerStatus } from './llm.js'
import { simReply, simAmbient, simMission, simMissionBoard, pick } from './sim.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..')
const WEB_ROOT = path.resolve(process.env.WEB_ROOT || path.join(ROOT, 'dist'))
const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '0.0.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
}

const MAX_MESSAGES = 80

const state = {
  rooms: new Map(),
  players: new Map(),
  board: [],
  missionCounter: 0
}

for (const room of ROOMS) state.rooms.set(room.id, { id: room.id, messages: [] })
state.board = simMissionBoard()

function roomState(id) {
  if (!state.rooms.has(id)) state.rooms.set(id, { id, messages: [] })
  return state.rooms.get(id)
}

function personaPayload(id) {
  const p = personaById(id)
  if (!p) return { id: 'unknown', name: 'Unknown', role: 'Resident', color: '#8aa0b8', ai: true }
  return { id: p.id, name: p.name, role: p.role, color: p.color, ai: true }
}

function pushMessage(roomId, message) {
  const room = roomState(roomId)
  const entry = { id: `m${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`, roomId, ts: Date.now(), ...message }
  room.messages.push(entry)
  if (room.messages.length > MAX_MESSAGES) room.messages.splice(0, room.messages.length - MAX_MESSAGES)
  broadcast(roomId, { type: 'message', message: entry })
  return entry
}

function systemMessage(roomId, text, tone = 'system') {
  return pushMessage(roomId, { kind: 'system', text, tone, author: { id: 'system', name: 'Sunset City', role: 'System', color: '#8aa0b8', ai: true } })
}

function membersOf(roomId) {
  const room = roomById(roomId)
  if (!room) return []
  return room.members.map(personaById).filter(Boolean)
}

function humansIn(roomId) {
  let count = 0
  for (const p of state.players.values()) if (p.room === roomId) count += 1
  return count
}

function broadcast(roomId, payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`
  for (const player of state.players.values()) {
    if (!player.res || player.room !== roomId) continue
    try {
      player.res.write(data)
    } catch {
      /* client vanished */
    }
  }
}

function broadcastAll(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`
  for (const player of state.players.values()) {
    if (!player.res) continue
    try {
      player.res.write(data)
    } catch {
      /* client vanished */
    }
  }
}

function pickResponder(roomId, requested) {
  if (requested) return personaById(requested)
  const room = roomById(roomId)
  if (!room) return null
  const members = membersOf(roomId)
  if (!members.length) return null
  return pick(members, Math.random())
}

function preferredResponder(clientId, roomId) {
  const mission = activeMission(clientId)
  const step = missionStepFor(mission, roomId)
  if (step && step.persona) return personaById(step.persona)
  return null
}

function historyFor(roomId, limit = 12) {
  const room = roomState(roomId)
  const lines = room.messages
    .filter((m) => m.kind === 'chat')
    .slice(-limit)
    .map((m) => `${m.author.name}: ${m.text}`)
  return lines.length ? [{ role: 'user', content: `Recent conversation in ${roomById(roomId)?.name || 'the room'}:\n${lines.join('\n')}` }] : []
}

function buildSystemPrompt(persona, room, kind, intel = null) {
  const topic = room ? room.topic : 'a one on one conversation on the street'
  const base = `${persona.persona} You are talking inside ${room ? room.name : 'Sunset City'}: ${topic}. ${persona.blurb}`
  const rules = [
    'Stay strictly in character.',
    'Reply with 1-3 short sentences, no markdown, no emoji, no stage directions.',
    'Reference the room and the people in it when it fits.',
    'Never mention being an AI, a language model, prompts, or tokens.',
    'Keep the conversation moving with a question or a hook.'
  ]
  if (kind === 'mission') rules.push('Stay under 60 words.')
  if (intel) rules.push(`You know this and can share it if it is asked for: ${intel}`)
  return `${base}\n${rules.join(' ')}`
}

const INTEL = {
  crates: 'The crates move through Sunset Auto Garage after dark, out of the freight side. Ask Mags, and do not mention me.',
  caller: 'The midnight caller rides the old radio frequency, so whoever answers that frequency gets the job.',
  favor: 'The favour is a sealed box waiting at Sunset Auto Garage. Do not open it, do not ask about it, just carry it.',
  favour: 'The favour is a sealed box waiting at Sunset Auto Garage. Do not open it, do not ask about it, just carry it.',
  score: 'Her score is on the board at Arcade 98. Three tokens is the entry, the prize is on the house.'
}

function intelFor(step) {
  if (!step || step.type !== 'ask' || !step.topic) return null
  return INTEL[step.topic.toLowerCase()] || null
}

async function generateReply({ persona, room, text, history, intel = null }) {
  const system = buildSystemPrompt(persona, room, 'chat', intel)
  const messages = history.length
    ? [{ role: 'user', content: `${history[0].content}\n\nNew message: ${text}` }]
    : [{ role: 'user', content: text }]
  try {
    const result = await complete({
      system,
      messages,
      temperature: 0.9,
      maxTokens: 220
    })
    return { text: result.text, provider: 'zen', model: result.model }
  } catch (error) {
    return {
      text: simReply({ persona, room, text, history, intel }),
      provider: 'sim',
      reason: error.message
    }
  }
}

async function generateAmbient(roomId) {
  const members = membersOf(roomId)
  if (!members.length) return []
  const lines = simAmbient({ room: roomById(roomId), personas: members })
  const persona = members[0]
  try {
    const result = await complete({
      system: `Write ONE short line of small talk from ${persona.name} (${persona.role}) inside ${roomById(roomId).name}. 1 sentence, no quotes, no markdown.`,
      messages: [{ role: 'user', content: 'Say something casual to the room.' }],
      maxTokens: 90,
      temperature: 1.1
    })
    return [{ personaId: persona.id, text: result.text }]
  } catch {
    return lines
  }
}

function normalizeGeneratedMission(raw) {
  if (!raw || typeof raw !== 'object') return null
  const allowedRooms = ROOMS.map((r) => r.id)
  const allowedPersonas = PERSONAS.map((p) => p.id)
  const steps = Array.isArray(raw.steps) ? raw.steps.slice(0, 4).map((step) => {
    const type = ['ask', 'drive', 'meet', 'report', 'collect', 'pickup'].includes(step.type) ? step.type : 'drive'
    const out = { type, label: String(step.label || 'Do the job').slice(0, 80) }
    if (allowedRooms.includes(step.room)) out.room = step.room
    if (allowedPersonas.includes(step.persona)) out.persona = step.persona
    if (typeof step.topic === 'string') out.topic = step.topic.slice(0, 40)
    if (typeof step.x === 'number' && typeof step.z === 'number') {
      out.x = Math.max(-240, Math.min(240, step.x))
      out.z = Math.max(-240, Math.min(240, step.z))
      out.place = String(step.place || 'the drop point').slice(0, 60)
    }
    return out
  }) : []
  if (!steps.length) return null
  return {
    id: `m-gen-${Date.now().toString(36)}`,
    key: 'generated',
    title: String(raw.title || 'Open Contract').slice(0, 60),
    brief: String(raw.brief || 'A job that nobody wrote down.').slice(0, 200),
    steps,
    reward: Math.max(600, Math.min(6000, Number(raw.reward) || 1500)),
    giver: allowedPersonas.includes(raw.giver) ? raw.giver : 'ivy',
    companions: (Array.isArray(raw.companions) ? raw.companions : []).filter((id) => allowedPersonas.includes(id)).slice(0, 2),
    aiGenerated: true,
    createdAt: Date.now()
  }
}

async function generateMission() {
  const templateList = MISSION_TEMPLATES.map((t) => `${t.key}: ${t.title} — ${t.brief} steps: ${t.steps.map((s) => `${s.type}/${s.room || s.place || s.label}`).join(', ')}`).join('\n')
  const roomList = ROOMS.map((r) => `${r.id} (${r.name})`).join(', ')
  const personaList = PERSONAS.map((p) => `${p.id} (${p.name}, ${p.role})`).join(', ')
  const system = [
    'You design small jobs for a retro-futurist city game.',
    'Answer with JSON only, no markdown.',
    'Schema: {"title":string,"brief":string,"reward":number,"giver":string,"companions":string[],"steps":[{"type":"ask|drive|meet|report|collect","label":string,"room":string,"persona":string,"topic":string,"x":number,"z":number,"place":string}]}',
    `Rooms: ${roomList}. Personas: ${personaList}.`,
    'Use 2 to 3 steps. Coordinates must be inside the city (x -220..220, z -220..220).'
  ].join('\n')
  try {
    const result = await complete({
      system,
      messages: [{ role: 'user', content: `Existing jobs:\n${templateList}\n\nInvent one new job for the board.` }],
      maxTokens: 320,
      temperature: 1
    })
    const json = JSON.parse(result.text.replace(/^[^[{]*/, '').replace(/[^\]}]*$/, ''))
    const mission = normalizeGeneratedMission(json)
    if (mission) return mission
    throw new Error('bad json')
  } catch (error) {
    const key = pick(MISSION_TEMPLATES, Math.random()).key
    const template = MISSION_TEMPLATES.find((t) => t.key === key)
    return simMission({
      key: template.key,
      title: template.title,
      brief: template.brief,
      steps: template.steps,
      reward: template.reward,
      giverId: 'ivy',
      companionIds: [pick(PERSONAS.map((p) => p.id), Math.random())]
    })
  }
}

function activeMission(clientId) {
  const player = state.players.get(clientId)
  return player && player.active ? player.active : null
}

function missionSummary(mission) {
  if (!mission) return null
  const idx = mission.stepIndex || 0
  return {
    id: mission.id,
    title: mission.title,
    brief: mission.brief,
    reward: mission.reward,
    giver: mission.giver,
    companions: mission.companions,
    stepIndex: idx,
    steps: mission.steps,
    total: mission.steps.length,
    complete: mission.complete || false
  }
}

function advanceMission(clientId, mission, note) {
  const steps = mission.steps
  const idx = mission.stepIndex || 0
  if (idx >= steps.length) return { advanced: false, done: true }
  mission.stepIndex = idx + 1
  mission.complete = mission.stepIndex >= steps.length
  const step = steps[idx]
  const payload = {
    type: 'mission_update',
    clientId,
    mission: missionSummary(mission),
    note: note || null
  }
  broadcastAll(payload)
  if (mission.complete) {
    const player = state.players.get(clientId)
    if (player) {
      player.money = (player.money || 0) + mission.reward
      payload.reward = mission.reward
      payload.money = player.money
    }
  }
  return { advanced: true, done: mission.complete, step, mission: missionSummary(mission) }
}

function missionStepFor(mission, roomId) {
  if (!mission || mission.complete) return null
  const step = mission.steps[mission.stepIndex || 0]
  if (!step) return null
  if (step.type === 'ask' || step.type === 'meet' || step.type === 'report' || step.type === 'pickup') {
    if (step.room && step.room !== roomId) return null
  }
  return step
}

async function handleChat({ clientId, roomId, text, target }) {
  const room = roomById(roomId)
  const player = state.players.get(clientId)
  const step = missionStepFor(activeMission(clientId), roomId)
  const persona = target ? personaById(target) : preferredResponder(clientId, roomId) || pickResponder(roomId)
  if (!persona) throw new Error('no responder')

  pushMessage(roomId, {
    kind: 'chat',
    text,
    author: { id: 'player', name: player?.name || 'Player', role: 'Human', color: '#7bd4ff', ai: false }
  })

  const history = historyFor(roomId)
  const isAsk = Boolean(step && step.persona === persona.id && step.type === 'ask')
  const topicHit = isAsk && (!step.topic || text.toLowerCase().includes(step.topic.toLowerCase()))
  const nameHit = isAsk && text.toLowerCase().includes(persona.name.split(' ')[0].toLowerCase())
  const intel = isAsk && (topicHit || nameHit) ? intelFor(step) : null
  const reply = await generateReply({ persona, room, text, history, intel })
  if (isAsk) {
    if (topicHit || nameHit) {
      advanceMission(clientId, activeMission(clientId), `${persona.name} answered`)
      systemMessage(roomId, `Mission step complete — ${step.label}`, 'good')
    } else if (step.topic) {
      systemMessage(roomId, `${persona.name} waits for you to ask about the ${step.topic}.`, 'mission')
    }
  } else if (step && step.persona === persona.id && (step.type === 'meet' || step.type === 'report' || step.type === 'pickup')) {
    advanceMission(clientId, activeMission(clientId), `${persona.name} ${step.type === 'report' ? 'closed the job' : 'took the job'}`)
    systemMessage(roomId, `Mission step complete — ${step.label}`, 'good')
  }

  const entry = pushMessage(roomId, {
    kind: 'chat',
    text: reply.text,
    author: personaPayload(persona.id),
    provider: reply.provider
  })
  return { reply: entry, provider: reply.provider }
}

function joinRoom(clientId, roomId, name) {
  let player = state.players.get(clientId)
  if (!player) {
    player = { id: clientId, name: name || 'Player', room: null, res: null, money: 0, active: null, joinedAt: Date.now() }
    state.players.set(clientId, player)
  }
  if (name) player.name = name
  if (player.room && player.room !== roomId) {
    systemMessage(player.room, `${player.name} left.`, 'system')
  }
  player.room = roomId
  systemMessage(roomId, `${player.name} walked in.`, 'system')

  const mission = activeMission(clientId)
  const step = missionStepFor(mission, roomId)
  if (step && step.type === 'meet') {
    advanceMission(clientId, mission, `${step.persona || 'contact'} met`)
    systemMessage(roomId, `Mission step complete — ${step.label}`, 'good')
  }

  broadcastAll({ type: 'presence', roomId, humans: humansIn(roomId), names: [...state.players.values()].filter((p) => p.room === roomId).map((p) => p.name) })
  const room = roomById(roomId)
  return { room: room ? { ...room, members: room.members.map(personaPayload) } : null, humans: humansIn(roomId) }
}

function leaveRoom(clientId) {
  const player = state.players.get(clientId)
  if (!player || !player.room) return
  const roomId = player.room
  systemMessage(roomId, `${player.name} walked out.`, 'system')
  player.room = null
  broadcastAll({ type: 'presence', roomId, humans: humansIn(roomId), names: [...state.players.values()].filter((p) => p.room === roomId).map((p) => p.name) })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 200000) reject(new Error('payload too large'))
    })
    req.on('end', () => {
      if (!data) return resolve({})
      try {
        resolve(JSON.parse(data))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store'
  })
  res.end(payload)
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  let filePath = path.join(WEB_ROOT, decodeURIComponent(url.pathname))
  if (!filePath.startsWith(WEB_ROOT)) {
    res.writeHead(403)
    return res.end('forbidden')
  }
  if (url.pathname === '/' || !path.extname(filePath)) filePath = path.join(WEB_ROOT, 'index.html')
  fs.readFile(filePath, (error, data) => {
    if (error) {
      const fallback = path.join(WEB_ROOT, 'index.html')
      return fs.readFile(fallback, (err2, html) => {
        if (err2) {
          res.writeHead(404)
          return res.end('not found')
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] })
        res.end(html)
      })
    }
    const type = MIME[path.extname(filePath)] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': filePath.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' })
    res.end(data)
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res)

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, {
        ok: true,
        provider: providerStatus(),
        rooms: ROOMS.length,
        personas: PERSONAS.length,
        online: state.players.size,
        board: state.board.length
      })
    }

    if (req.method === 'GET' && url.pathname === '/api/rooms') {
      return json(res, 200, {
        rooms: ROOMS.map((room) => ({
          id: room.id,
          name: room.name,
          kind: room.kind,
          topic: room.topic,
          blurb: room.blurb,
          accent: room.accent,
          board: Boolean(room.board),
          venue: room.venue || null,
          members: room.members.map(personaPayload),
          humans: humansIn(room.id)
        }))
      })
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/room/')) {
      const roomId = url.pathname.slice('/api/room/'.length)
      const room = roomById(roomId)
      if (!room) return json(res, 404, { error: 'unknown room' })
      return json(res, 200, {
        room: { ...room, members: room.members.map(personaPayload) },
        messages: roomState(roomId).messages,
        humans: humansIn(roomId)
      })
    }

    if (req.method === 'GET' && url.pathname === '/api/personas') {
      return json(res, 200, { personas: PERSONAS.map(personaPayload) })
    }

    if (req.method === 'GET' && url.pathname === '/api/stream') {
      const clientId = url.searchParams.get('clientId') || `c${Date.now().toString(36)}`
      let player = state.players.get(clientId)
      if (!player) {
        player = { id: clientId, name: 'Player', room: null, res: null, money: 0, active: null }
        state.players.set(clientId, player)
      }
      player.res = res
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      })
      res.write(`retry: 3000\n\n`)
      res.write(`data: ${JSON.stringify({ type: 'hello', clientId, provider: providerStatus() })}\n\n`)
      req.on('close', () => {
        if (player.res === res) player.res = null
        if (player.room) {
          const roomId = player.room
          player.room = null
          broadcastAll({ type: 'presence', roomId, humans: humansIn(roomId), names: [...state.players.values()].filter((p) => p.room === roomId).map((p) => p.name) })
        }
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/room/join') {
      const body = await readBody(req)
      const result = joinRoom(body.clientId, body.roomId, body.name)
      return json(res, 200, result)
    }

    if (req.method === 'POST' && url.pathname === '/api/room/leave') {
      const body = await readBody(req)
      leaveRoom(body.clientId)
      return json(res, 200, { ok: true })
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const body = await readBody(req)
      if (!body.text || !body.roomId) return json(res, 400, { error: 'text and roomId required' })
      const result = await handleChat({
        clientId: body.clientId || 'anon',
        roomId: body.roomId,
        text: String(body.text).slice(0, 400),
        target: body.target || null
      })
      return json(res, 200, result)
    }

    if (req.method === 'POST' && url.pathname === '/api/talk') {
      const body = await readBody(req)
      const persona = personaById(body.personaId)
      if (!persona) return json(res, 404, { error: 'unknown persona' })
      const room = roomById(body.roomId) || null
      const history = body.roomId ? historyFor(body.roomId) : []
      const reply = await generateReply({ persona, room, text: String(body.text || '').slice(0, 400), history })
      const entry = pushMessage(body.roomId || `dm-${persona.id}`, {
        kind: 'chat',
        text: reply.text,
        author: personaPayload(persona.id),
        provider: reply.provider,
        dm: true
      })
      return json(res, 200, { reply: entry, provider: reply.provider })
    }

    if (req.method === 'GET' && url.pathname === '/api/missions') {
      const clientId = url.searchParams.get('clientId')
      return json(res, 200, {
        board: state.board.map((m) => missionSummary(m)),
        active: missionSummary(activeMission(clientId))
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/missions/generate') {
      const mission = await generateMission()
      state.board.unshift(mission)
      state.board = state.board.slice(0, 8)
      return json(res, 200, { mission: missionSummary(mission) })
    }

    if (req.method === 'POST' && url.pathname === '/api/missions/accept') {
      const body = await readBody(req)
      const mission = state.board.find((m) => m.id === body.missionId)
      if (!mission) return json(res, 404, { error: 'mission not found' })
      const player = state.players.get(body.clientId)
      if (!player) return json(res, 400, { error: 'unknown client' })
      player.active = { ...mission, stepIndex: 0, complete: false, acceptedAt: Date.now() }
      const giver = personaById(mission.giver)
      if (giver) {
        const roomId = body.roomId || 'el-rey'
        pushMessage(roomId, {
          kind: 'chat',
          text: `Job accepted: ${mission.title}. ${mission.brief}`,
          author: personaPayload(giver.id)
        })
        for (const companionId of mission.companions || []) {
          const companion = personaById(companionId)
          if (!companion) continue
          pushMessage(roomId, {
            kind: 'chat',
            text: simReply({ persona: companion, room: roomById(roomId), text: 'are you coming with me?', history: [] }),
            author: personaPayload(companion.id)
          })
        }
      }
      broadcastAll({ type: 'mission_update', clientId: body.clientId, mission: missionSummary(player.active), note: 'accepted' })
      return json(res, 200, { mission: missionSummary(player.active), companions: mission.companions || [] })
    }

    if (req.method === 'POST' && url.pathname === '/api/missions/progress') {
      const body = await readBody(req)
      const mission = activeMission(body.clientId)
      if (!mission) return json(res, 404, { error: 'no active mission' })
      const step = mission.steps[mission.stepIndex || 0]
      if (!step) return json(res, 200, { mission: missionSummary(mission), advanced: false })
      const event = body.event || {}
      let advanced = false
      if (step.type === 'drive' && typeof event.x === 'number' && typeof event.z === 'number') {
        const distance = Math.hypot(event.x - step.x, event.z - step.z)
        if (distance < 12) advanced = true
      } else if (step.type === 'collect') {
        const count = Number(event.count || 0)
        if (count >= (step.count || 1)) {
          advanced = true
          step.collected = count
        }
      }
      if (advanced) {
        const result = advanceMission(body.clientId, mission, step.label)
        return json(res, 200, { ...result, mission: missionSummary(mission) })
      }
      return json(res, 200, { advanced: false, mission: missionSummary(mission) })
    }

    if (req.method === 'POST' && url.pathname === '/api/missions/abandon') {
      const body = await readBody(req)
      const player = state.players.get(body.clientId)
      if (player) player.active = null
      broadcastAll({ type: 'mission_update', mission: null, note: 'abandoned' })
      return json(res, 200, { ok: true })
    }

    return json(res, 404, { error: 'unknown endpoint' })
  } catch (error) {
    return json(res, 500, { error: error.message })
  }
})

server.listen(PORT, HOST, () => {
  const status = providerStatus()
  console.log(`[sunset-city] social hub on http://${HOST}:${PORT} (ai: ${status.provider}/${status.model})`)
})

setInterval(async () => {
  for (const room of ROOMS) {
    if (humansIn(room.id) === 0) continue
    const lines = await generateAmbient(room.id)
    for (const line of lines) {
      pushMessage(room.id, { kind: 'chat', text: line.text, author: personaPayload(line.personaId), ambient: true })
    }
  }
}, 75000).unref()

setInterval(() => {
  for (const player of state.players.values()) {
    if (!player.res) continue
    try {
      player.res.write(': ping\n\n')
    } catch {
      /* ignore */
    }
  }
}, 25000).unref()
