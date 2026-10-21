export const VIRTUES = {
  wisdom: {
    id: 'wisdom',
    name: 'Wisdom',
    glyph: '◈',
    color: 0x8bd7ff,
    css: '#8bd7ff',
    blurb: 'Insight reveals what force cannot.'
  },
  resilience: {
    id: 'resilience',
    name: 'Resilience',
    glyph: '⬢',
    color: 0xffc46b,
    css: '#ffc46b',
    blurb: 'The Maze bends. You do not.'
  },
  empathy: {
    id: 'empathy',
    name: 'Empathy',
    glyph: '❧',
    color: 0x7dffb0,
    css: '#7dffb0',
    blurb: 'Every echo deserves an answer.'
  },
  discipline: {
    id: 'discipline',
    name: 'Discipline',
    glyph: '⟡',
    color: 0xff845f,
    css: '#ff845f',
    blurb: 'Perfection is a quiet, repeated choice.'
  }
}

export const VIRTUE_ORDER = ['wisdom', 'resilience', 'empathy', 'discipline']

export const SHARDS = [
  {
    id: 'elderwood',
    name: 'Elderwood Realm',
    shortName: 'Elderwood',
    virtue: 'empathy',
    color: 0x62ff9e,
    css: '#62ff9e',
    position: [-29, 0, -29],
    angle: Math.PI * 1.25,
    rule: 'SYMBIOSIS',
    ruleDetail: 'Stand in the sun. The Rotting Heart recoils from shadow.',
    guardian: 'The Rotting Heart',
    guardianShort: 'Rotting Heart',
    objective: 'Heal the Rotting Heart',
    description: 'A twilight forest where every wound is answered.',
    trial: 'empathy',
    trialTitle: 'Echoes of the Lost',
    trialHint: 'Soothe the three lost echoes',
    bossHp: 620
  },
  {
    id: 'iron',
    name: 'Iron Nexus',
    shortName: 'Iron Nexus',
    virtue: 'discipline',
    color: 0xff845f,
    css: '#ff845f',
    position: [29, 0, -29],
    angle: Math.PI * 0.25,
    rule: 'POLARITY',
    ruleDetail: 'Match opposite polarities to pierce the Colossus.',
    guardian: 'The Iron Colossus',
    guardianShort: 'Iron Colossus',
    objective: 'Break the Iron Colossus',
    description: 'A rust desert where the machines still dream of war.',
    trial: 'discipline',
    trialTitle: 'The Perfect Form',
    trialHint: 'Defeat the three training sentinels',
    bossHp: 700
  },
  {
    id: 'astral',
    name: 'Astral Rift',
    shortName: 'Astral Rift',
    virtue: 'wisdom',
    color: 0x8bd7ff,
    css: '#8bd7ff',
    position: [29, 0, 29],
    angle: Math.PI * 0.75,
    rule: 'LIGHT-BOUND',
    ruleDetail: 'Shadow drinks your Light. Return to the glowing pools.',
    guardian: 'The Void Echo',
    guardianShort: 'Void Echo',
    objective: 'Silence the Void Echo',
    description: 'Floating islands adrift in a silent, starless sea.',
    trial: 'wisdom',
    trialTitle: 'Runes of the Rift',
    trialHint: 'Follow the three rune echoes',
    bossHp: 580
  },
  {
    id: 'shadow',
    name: 'Shadowdeep',
    shortName: 'Shadowdeep',
    virtue: 'resilience',
    color: 0xffc46b,
    css: '#ffc46b',
    position: [-29, 0, 29],
    angle: Math.PI * 1.75,
    rule: 'SENSORY DEPRIVATION',
    ruleDetail: 'The dark hides everything. Strike when the fear is revealed.',
    guardian: 'The Unseen Fear',
    guardianShort: 'Unseen Fear',
    objective: 'Face the Unseen Fear',
    description: 'A buried dark that remembers the shape of your fears.',
    trial: 'resilience',
    trialTitle: 'The Long Night',
    trialHint: 'Gather three embers while the Maze storms',
    bossHp: 540
  }
]

export const SHARD_BY_ID = Object.fromEntries(SHARDS.map(shard => [shard.id, shard]))

export const VIRTUE_FOR_SHARD = Object.fromEntries(SHARDS.map(shard => [shard.id, shard.virtue]))

export const TRIAL_LABELS = {
  empathy: 'Soothe',
  discipline: 'Defeat',
  wisdom: 'Gather',
  resilience: 'Survive'
}

export const TRIAL_TOTALS = {
  empathy: 3,
  discipline: 3,
  wisdom: 3,
  resilience: 3
}

export const STORAGE_KEY = 'seekerverse-progress-v1'
