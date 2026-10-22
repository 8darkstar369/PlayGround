export const PERSONAS = [
  {
    id: 'nova',
    name: 'Nova Reyes',
    role: 'Courier',
    color: '#ff7a5c',
    blurb: 'Runs packages across the boulevard faster than dispatch can log them.',
    persona: 'You are Nova Reyes, a veteran courier in Sunset City. You know every back alley, every short cut, and exactly which cops are asleep on shift. You are fast-talking, loyal to your friends, and mildly allergic to paperwork.',
    voice: 'clipped street slang, confident, one or two short sentences',
    interests: ['delivery routes', 'synth tracks', 'the pier at sunset'],
    homeRoom: 'neon-net',
    street: { x: 47, z: 73, rot: Math.PI },
    companion: true
  },
  {
    id: 'dex',
    name: 'Dex Marlow',
    role: 'Hacker',
    color: '#5fffe2',
    blurb: 'Keeps the café wifi alive with duct tape and spite.',
    persona: 'You are Dex Marlow, a teenage-ish netrunner who runs the internet cafe rig. You speak in tech shorthand, love conspiracies about municipal signal towers, and are always mid-hack.',
    voice: 'rapid techy chatter, lowercase energy, occasional jargon',
    interests: ['signal towers', 'old arcade boards', 'pirated radio'],
    homeRoom: 'neon-net',
    street: { x: 37, z: 74, rot: Math.PI },
    companion: true
  },
  {
    id: 'kilo',
    name: 'Kilo Tan',
    role: 'Radio DJ',
    color: '#9d7bff',
    blurb: 'Runs the midnight show on K-SUN and knows everyone who calls in.',
    persona: 'You are Kilo Tan, host of the K-SUN midnight broadcast. You have a warm radio voice, a taste for weird music, and you treat every caller like a friend.',
    voice: 'warm, smooth, radio-announcer cadence, short sentences',
    interests: ['late night radio', 'call-in requests', 'city sounds'],
    homeRoom: 'k-sun',
    street: { x: 47, z: -50, rot: 0 },
    companion: true
  },
  {
    id: 'mags',
    name: 'Mags Okafor',
    role: 'Mechanic',
    color: '#ffcb45',
    blurb: 'Can rebuild a drivetrain in a thunderstorm and still make it by sundown.',
    persona: 'You are Mags Okafor, owner of Sunset Auto Garage. You are blunt, practical, and gruff on the surface but soft on mechanics. You call everyone "kid" or "chief".',
    voice: 'gruff, plain, no-nonsense, short',
    interests: ['motorcycles', 'carburetors', 'racing history'],
    homeRoom: 'garage',
    street: { x: 145, z: -50, rot: 0 },
    companion: true
  },
  {
    id: 'sable',
    name: 'Sable Voss',
    role: 'Arcade Owner',
    color: '#ff4c86',
    blurb: 'Holds the high score for Tidal Combat and defends it daily.',
    persona: 'You are Sable Voss, owner of Arcade 98. You are theatrical, competitive, and treat every visitor as a potential challenger. You narrate your own life like a sports broadcast.',
    voice: 'dramatic, playful, esports commentary energy',
    interests: ['high scores', 'cabinet repairs', 'rivalries'],
    homeRoom: 'arcade-98',
    street: { x: -39, z: 74, rot: Math.PI },
    companion: true
  },
  {
    id: 'juno',
    name: 'Juno Park',
    role: 'Record Dealer',
    color: '#ffc4f2',
    blurb: 'Sells rare wax to collectors and worse records to herself.',
    persona: 'You are Juno Park, who runs Vinyl & Velvet. You are mellow, poetic, and drip music recommendations like a slow pour. You notice details nobody else does.',
    voice: 'soft, poetic, unhurried, sensory details',
    interests: ['rare pressings', 'dub and synth', 'old flyers'],
    homeRoom: 'vinyl',
    street: { x: -145, z: 74, rot: Math.PI },
    companion: false
  },
  {
    id: 'rocco',
    name: 'Rocco Diaz',
    role: 'Dock Hand',
    color: '#7bd4ff',
    blurb: 'Works the pier by day, pours drinks at El Rey by night.',
    persona: 'You are Rocco Diaz, a dock hand who works the cargo piers by day and tends bar at El Rey by night. You are loud, generous, and suspicious of anyone who will not take a drink.',
    voice: 'boisterous, storytelling, interrupts himself',
    interests: ['cargo manifests', 'boxing', 'cheap beer'],
    homeRoom: 'el-rey',
    street: { x: 40, z: 36, rot: Math.PI },
    companion: true
  },
  {
    id: 'ivy',
    name: 'Ivy Chen',
    role: 'Fixer',
    color: '#a8ff8f',
    blurb: 'Finds work, finds trouble, occasionally in that order.',
    persona: 'You are Ivy Chen, a fixer who broker deals around El Rey Plaza. You are calm, precise, and transactional, but you have a soft spot for people who actually show up.',
    voice: 'measured, professional, slightly formal',
    interests: ['rare cargo', 'quiet routes', 'collecting favors'],
    homeRoom: 'el-rey',
    street: { x: 50, z: 36, rot: Math.PI },
    companion: false
  },
  {
    id: 'zeta',
    name: 'Zeta Ruiz',
    role: 'Rumour Dealer',
    color: '#ffe07a',
    blurb: 'Trades secrets for photographs and photographs for coffee.',
    persona: 'You are Zeta Ruiz, a street photographer who hears every rumour first. You are curious, playful, and dangerously good at connecting dots nobody else notices.',
    voice: 'curious, teasing, asks a lot of questions',
    interests: ['stray photos', 'night markets', 'the truth about the pier'],
    homeRoom: 'anchor',
    street: { x: -80, z: 10, rot: 0 },
    companion: false
  }
]

export const ROOMS = [
  {
    id: 'el-rey',
    name: 'EL REY DINER',
    kind: 'hub',
    topic: 'the neighborhood bar-and-grill where deals get made',
    accent: '#ff4f87',
    members: ['rocco', 'ivy'],
    board: true,
    venue: {
      block: [32, 32],
      building: { x: 45, z: 46, w: 19, d: 13, h: 9, style: 'deco', tint: 0, neon: '#ff4f87', sign: 'EL REY', signSide: -1 },
      door: { x: 45, z: 37.5 },
      existing: true
    },
    blurb: 'Booths, bad coffee, and every job in the city passes through here.'
  },
  {
    id: 'neon-net',
    name: 'NEON NET CAFE',
    kind: 'chat',
    topic: 'a late night internet cafe where the city trades tips and rumors',
    accent: '#5fffe2',
    members: ['dex', 'nova', 'zeta'],
    venue: {
      block: [32, 96],
      building: { x: 43, z: 86, w: 18, d: 14, h: 11, style: 'teal', tint: 2, neon: '#5fffe2', sign: 'NEON NET', signSide: -1 },
      door: { x: 43, z: 77.5 }
    },
    blurb: 'Four terminals, one cracked mug, endless noise.'
  },
  {
    id: 'arcade-98',
    name: "ARCADE '98",
    kind: 'chat',
    topic: 'a retro arcade where high scores are settled in person',
    accent: '#ff4c86',
    members: ['sable', 'juno'],
    venue: {
      block: [-32, 96],
      building: { x: -43, z: 86, w: 19, d: 14, h: 10, style: 'brick', tint: 3, neon: '#ff4c86', sign: "ARCADE '98", signSide: -1 },
      door: { x: -43, z: 77.5 }
    },
    blurb: 'Cabinets from another decade, still humming.'
  },
  {
    id: 'anchor',
    name: 'THE RUSTY ANCHOR',
    kind: 'chat',
    topic: 'a dockside bar where the harbour workers and the night crowd mix',
    accent: '#ffcb45',
    members: ['rocco', 'kilo', 'zeta'],
    venue: {
      block: [-96, 32],
      building: { x: -85, z: 22, w: 20, d: 14, h: 9, style: 'brick', tint: 1, neon: '#ffcb45', sign: 'RUSTY ANCHOR', signSide: -1 },
      door: { x: -85, z: 13.5 }
    },
    blurb: 'Sticky floors, cheap beer, excellent gossip.'
  },
  {
    id: 'k-sun',
    name: 'K-SUN RADIO',
    kind: 'chat',
    topic: 'the lobby of a radio tower where the midnight show runs out of the speakers',
    accent: '#9d7bff',
    members: ['kilo', 'sable', 'ivy'],
    venue: {
      block: [32, -32],
      building: { x: 43, z: -42, w: 26, d: 24, h: 34, style: 'glass', tint: 4, neon: '#9d7bff', sign: 'K-SUN 98.1', signSide: -1 },
      door: { x: 43, z: -55.5 }
    },
    blurb: 'The whole block hums with the broadcast.'
  },
  {
    id: 'garage',
    name: 'SUNSET AUTO GARAGE',
    kind: 'chat',
    topic: 'a garage where every illegal modification is at least half legal',
    accent: '#48f5e0',
    members: ['mags', 'nova', 'dex'],
    venue: {
      block: [160, -32],
      building: { x: 149, z: -42, w: 22, d: 16, h: 9, style: 'stucco', tint: 0, neon: '#48f5e0', sign: 'AUTO GARAGE', signSide: -1 },
      door: { x: 149, z: -51.5 }
    },
    blurb: 'Bring it in broken, leave it in a hurry.'
  },
  {
    id: 'vinyl',
    name: 'VINYL & VELVET',
    kind: 'chat',
    topic: 'a record shop where the walls are shelves and the debate is always music',
    accent: '#ffc4f2',
    members: ['juno', 'kilo', 'zeta'],
    venue: {
      block: [-160, 96],
      building: { x: -149, z: 86, w: 19, d: 14, h: 9, style: 'stucco', tint: 5, neon: '#ffc4f2', sign: 'VINYL & VELVET', signSide: -1 },
      door: { x: -149, z: 77.5 }
    },
    blurb: 'Ask for a recommendation, get an hour of stories.'
  }
]

export const DISTRICT_SPOTS = [
  { name: 'Marina', x: -208, z: 90 },
  { name: 'El Rey Plaza', x: 15, z: 22 },
  { name: 'Beach Promenade', x: -232, z: 10 },
  { name: 'Dockside Freight', x: 150, z: 54 },
  { name: 'Sunset Strip', x: 160, z: 166 },
  { name: 'Old Radio Hill', x: -96, z: -150 },
  { name: 'Arcade Mile', x: 96, z: 96 },
  { name: 'North Overpass', x: 32, z: 166 }
]

export const MISSION_TEMPLATES = [
  {
    key: 'courier-run',
    title: 'Courier Run',
    brief: 'Move a package across town before the street notices it.',
    giver: 'mags',
    steps: [
      { type: 'pickup', label: 'Collect the package', room: 'garage', persona: 'mags' },
      { type: 'drive', label: 'Deliver it to the drop point', x: -208, z: 90, place: 'Pier 99 drop-off' },
      { type: 'report', label: 'Report back to the fixer', room: 'el-rey', persona: 'ivy' }
    ],
    reward: 1800
  },
  {
    key: 'rumour-hunt',
    title: 'Rumour Hunt',
    brief: 'Ask around the city and find out who is moving the crates.',
    giver: 'ivy',
    steps: [
      { type: 'ask', label: 'Ask Zeta about the crates', room: 'anchor', persona: 'zeta', topic: 'crates' },
      { type: 'ask', label: 'Ask Kilo about the midnight caller', room: 'k-sun', persona: 'kilo', topic: 'caller' },
      { type: 'drive', label: 'Take the answer to El Rey', x: 15, z: 22, place: 'El Rey Plaza' }
    ],
    reward: 2200
  },
  {
    key: 'tournament',
    title: 'Cabinet Clash',
    brief: 'Sable bet the bar that nobody can touch her Tidal Combat score.',
    giver: 'sable',
    steps: [
      { type: 'meet', label: 'Meet Sable at the arcade', room: 'arcade-98', persona: 'sable' },
      { type: 'collect', label: 'Grab three tokens on the board', count: 3 },
      { type: 'report', label: 'Collect the prize', room: 'arcade-98', persona: 'sable' }
    ],
    reward: 1500
  },
  {
    key: 'night-drive',
    title: 'Night Drive',
    brief: 'Kilo wants his show recorded from the coast at exactly sunset.',
    giver: 'kilo',
    steps: [
      { type: 'drive', label: 'Roll the coast road at dusk', x: -232, z: 10, place: 'Beach Promenade' },
      { type: 'drive', label: 'Get back to the tower', x: 43, z: -42, place: 'K-SUN Radio' },
      { type: 'report', label: 'Hand over the tape', room: 'k-sun', persona: 'kilo' }
    ],
    reward: 2000
  },
  {
    key: 'fixer-favor',
    title: 'A Favor for the Fixer',
    brief: 'Ivy needs a favour done and is not telling you the details yet.',
    giver: 'ivy',
    steps: [
      { type: 'ask', label: 'Ask Ivy what she needs', room: 'el-rey', persona: 'ivy', topic: 'favor' },
      { type: 'drive', label: 'Pick it up from the garage', x: 149, z: -42, place: 'Sunset Auto Garage' },
      { type: 'report', label: 'Close it out at the garage', room: 'garage', persona: 'mags' }
    ],
    reward: 2600
  }
]

export const PLAYER_NAME = 'you'

export function personaById(id) {
  return PERSONAS.find((p) => p.id === id) || null
}

export function roomById(id) {
  return ROOMS.find((r) => r.id === id) || null
}

export function roomName(id) {
  const room = roomById(id)
  return room ? room.name : id
}
