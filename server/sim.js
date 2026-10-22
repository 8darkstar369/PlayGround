// Offline persona engine. Keeps Sunset City social hub alive without any API key.
// Every response is assembled from persona voice, room context and conversation memory.
import { MISSION_TEMPLATES, DISTRICT_SPOTS, PERSONAS } from '../src/data/social.js'

const OPENERS = {
  nova: ['Quick one.', 'Alright, listen.', 'Right.'],
  dex: ['ok ok ok', 'brb compiling', 'one sec'],
  kilo: ['Hey, good to hear you.', "You're on the air, so—", 'Hey there.'],
  mags: ['Kid.', 'Chief.', "Alright then."],
  sable: ['Well well well.', 'Attention, contender!', 'Oh, you came.'],
  juno: ['Mm, yes.', 'Hey, you.', 'Come in, come in.'],
  rocco: ['HA! A friendly face!', 'Hey hey! Sit down.', 'Pour me one?'],
  ivy: ['Good, you are here.', 'Listen closely.', 'Right.'],
  zeta: ['Oh, interesting.', 'Hold on, that is interesting.', 'Quick, what is this?']
}

const CLOSERS = {
  nova: ['Keep moving.', 'That is the way.', 'Do not get lost out there.'],
  dex: ['ping me if the wifi drops', 'brb, another packet', 'trust me, it works'],
  kilo: ['We will talk soon.', 'Stay tuned, yeah?', 'You know where to find me.'],
  mags: ['Do not break it.', 'Any fool can do it, I suppose.', 'Bring it back in one piece.'],
  sable: ['The arcade awaits!', 'The score board does not lie!', 'Rematch?'],
  juno: ['The pressing is in the back if you want it.', 'Listen to it once, at least.', 'No rush.'],
  rocco: ['Pints are on me.', 'The bar never sleeps.', 'Tell Rocco I said hi, since I am Rocco.'],
  ivy: ['Keep your ears open.', 'I will be in touch.', 'Consider it a favor.'],
  zeta: ['Find me by the pier.', 'I want that photo, remember.', 'Keep looking.']
}

const BANK = {
  greeting: [
    'Hey {player}. Good to see somebody walk in.',
    'Alright {player}, what do you need?',
    'Hey. You look like you have been running.',
    'You made it. Good. Sit down for a second.',
    'Evening. The board is open, take a look.'
  ],
  whoAreYou: [
    'I am {name}, {role} around here. That is the short version.',
    '{name}. {role}. I keep this corner of the city moving.',
    'They call me {name}. {role}. You will learn my habits fast enough.'
  ],
  askRoom: [
    'This is {room}, so let me give you the rules: keep it friendly, keep it moving.',
    '{room}. Mostly regulars, decent coffee, worse decisions.',
    'This is {room}. People come here to talk, so talk.'
  ],
  jobs: [
    'Work comes through {room}. Ivy posts the real jobs, but the board never stays empty.',
    'There is a job board inside {room}. Ask whoever is running the room and they will point you at it.',
    'Jobs, cash, trouble, pick a lane. The board is where the lane starts.',
    'I can point you at the board, but I do not sign off on the paperwork.'
  ],
  askAbout: [
    'About {topic}? Around here that is a messy story. Start at {room} and ask louder.',
    'You want {topic}. Smart. Half the city is pretending {topic} does not exist.',
    'Okay so {topic} — this is exactly why people come into {room} and talk.',
    '{topic}. I will tell you what I know, but ask me again later, the details move.'
  ],
  askWhere: [
    'Straight down the boulevard, then cut toward the water. You will smell it before you see it.',
    'Follow the neon, ignore the truck route, and you are there in five minutes.',
    'Easy. Head toward {topic} and you will end up right in front of the door.'
  ],
  help: [
    'Talk to people. Accept work on the board. Do not walk into the freight yard alone.',
    'The board has work, the rooms have gossip, and the street has shortcuts if you are brave.',
    'Keep cash in your pocket, keep your ears open, and check the board when you are bored.'
  ],
  compliment: [
    'Careful, I might start charging for that.',
    'You are alright, I will give you that.',
    'Flattery will get you a discount. Maybe.'
  ],
  insult: [
    'Charming. Buy something before you talk to me like that.',
    'You are new. It shows. Watch the street and try again.',
    'I have heard worse from people with worse aim.'
  ],
  farewell: [
    'Go get it, then. Doors are open all night.',
    'Later. Watch the corner on the way out.',
    'Take care of yourself out there.'
  ],
  default: [
    'Say more, I am listening.',
    'That is a story. Go on.',
    'Hmm. Around here that means three different things.',
    'I follow you. Mostly.',
    'Okay, that is interesting. Keep going.'
  ]
}

const TOPIC_WORDS = ['crate', 'crates', 'van', 'call', 'caller', 'caller', 'midnight', 'favor', 'favour', 'score', 'cargo', 'manifest', 'package', 'job', 'money', 'town']

export function detectIntent(text, persona, room) {
  const t = (text || '').toLowerCase()
  if (/\b(bye|gtg|later|see ya|goodbye)\b/.test(t)) return 'farewell'
  if (/\b(hi|hello|hey|yo|sup|howdy|greetings)\b/.test(t)) return 'greeting'
  if (/\b(who are you|what do you do|introduce|your name)\b/.test(t)) return 'whoAreYou'
  if (/\b(job|work|mission|contract|board|hire|pay|cash|bounty)\b/.test(t)) return 'jobs'
  if (/\b(where|how do i (get|find)|directions)\b/.test(t)) return 'askWhere'
  if (/\b(help|what now|what should i)\b/.test(t)) return 'help'
  if (/\b(thanks|thank you|good work|appreciate|nice one|well played)\b/.test(t)) return 'compliment'
  if (/\b(stupid|idiot|useless|shut up)\b/.test(t)) return 'insult'
  if (/\b(tell me about|what about|any word on|heard about)\b/.test(t) || TOPIC_WORDS.some((w) => t.includes(w))) return 'askAbout'
  if (/\b(this place|what is this|where am i)\b/.test(t)) return 'askRoom'
  return 'default'
}

export function pick(list, seed = Math.random()) {
  return list[Math.floor(Math.abs(seed) * list.length) % list.length]
}

function fill(template, ctx) {
  return template
    .replace(/\{player\}/g, ctx.player || 'friend')
    .replace(/\{name\}/g, ctx.persona.name)
    .replace(/\{role\}/g, ctx.persona.role.toLowerCase())
    .replace(/\{room\}/g, ctx.room ? ctx.room.name : 'this place')
    .replace(/\{topic\}/g, ctx.topic || 'that')
}

export function simReply({ persona, room, text, history = [], player = 'friend', intel = null }) {
  const intent = detectIntent(text, persona, room)
  const seed = Math.random()
  let body = pick(BANK[intent] || BANK.default, seed)
  const topicMatch = (text || '').match(/\b(crates?|van|caller|midnight|favou?r|score|cargo|manifest|package)\b/i)
  const ctx = {
    persona,
    room,
    player,
    topic: topicMatch ? topicMatch[0].toLowerCase() : null
  }
  body = fill(body, ctx)

  const openerChance = 0.35 + (intent === 'greeting' ? 0.35 : 0)
  const opener = pick(OPENERS[persona.id] || ['Hey.'], seed + 0.13)
  const closer = pick(CLOSERS[persona.id] || ['See you around.'], seed + 0.37)

  const lastUser = [...history].reverse().find((m) => m.role === 'user')
  const remember = lastUser && history.length > 2 && Math.random() < 0.3
    ? ` You asked me about ${fill('{topic}', ctx) === 'that' ? 'that' : fill('{topic}', ctx)} earlier — same answer.`
    : ''

  const parts = []
  if (Math.random() < openerChance) parts.push(opener)
  parts.push(body)
  if (intel) parts.push(intel)
  if (remember) parts.push(remember.trim())
  if (Math.random() < 0.4) parts.push(closer)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export function simAmbient({ room, personas }) {
  if (!personas.length) return []
  const a = personas[Math.floor(Math.random() * personas.length)]
  const b = personas.find((p) => p.id !== a.id)
  if (!b) return [{ personaId: a.id, text: `${a.name} is nursing a drink and watching the door.` }]
  const lines = [
    [`${a.name}: "You ever get the feeling the whole city is one beat behind?"`, `${b.name}: "Only on nights when it is not."`],
    [`${a.name}: "Board is slow tonight."`, `${b.name}: "Boards are always slow. That is why you talk to people."`],
    [`${a.name}: "Sunset hit the water all orange just now."`, `${b.name}: "Take a picture then, do not just describe it."`],
    [`${a.name}: "Somebody left a package at the garage again."`, `${b.name}: "Somebody always leaves a package. That is the job."`]
  ]
  const pair = pick(lines, Math.random())
  return [
    { personaId: a.id, text: pair[0].replace(`${a.name}: `, '') },
    { personaId: b.id, text: pair[1].replace(`${b.name}: `, '') }
  ]
}

const TITLES = {
  'courier-run': ['Hot Package', 'Paper Route', 'Nothing to Declare', 'Last Drop'],
  'rumour-hunt': ['Rumour Mill', 'Names and Crates', 'The Midnight Caller'],
  tournament: ['Tidal Combat: Open Challenge', 'High Score or Bust', 'The Board is Set'],
  'night-drive': ['Sunset Recording', 'Coastal Take', 'The Long Way Round'],
  'fixer-favor': ['Unspoken Favors', 'Ivy Needs a Hand', 'Quiet Work']
}

export function simMission({ key, title, brief, steps, reward, giverId, companionIds }) {
  const spot = DISTRICT_SPOTS[Math.floor(Math.random() * DISTRICT_SPOTS.length)]
  const finalSteps = steps.map((step) => ({ ...step }))
  const driveStep = finalSteps.find((s) => s.type === 'drive')
  if (driveStep && Math.random() < 0.6) {
    driveStep.x = spot.x
    driveStep.z = spot.z
    driveStep.place = spot.name
  }
  return {
    id: `m-${key}-${Date.now().toString(36)}`,
    key,
    title: title || pick(TITLES[key] || ['Night Work'], Math.random()),
    brief: brief || 'Work came in off the street. Details are thin, but the pay is real.',
    steps: finalSteps,
    reward: reward + Math.floor(Math.random() * 600),
    giver: giverId,
    companions: companionIds,
    aiGenerated: false,
    createdAt: Date.now()
  }
}

export function simMissionBoard() {
  const picks = ['courier-run', 'rumour-hunt', 'tournament', 'night-drive', 'fixer-favor']
  const board = []
  for (const key of picks) {
    const template = MISSION_TEMPLATES.find((t) => t.key === key)
    if (!template) continue
    const giverId = template.giver || 'ivy'
    const companionPool = PERSONAS.map((p) => p.id).filter((id) => id !== giverId)
    const companion = companionPool[Math.floor(Math.random() * companionPool.length)]
    board.push(simMission({
      key: template.key,
      title: template.title,
      brief: template.brief,
      steps: template.steps,
      reward: template.reward,
      giverId,
      companionIds: [companion]
    }))
  }
  return board
}
