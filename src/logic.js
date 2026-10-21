import { VIRTUES, VIRTUE_ORDER, TRIAL_TOTALS } from './data.js'

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}

export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createInitialState() {
  const virtues = {}
  for (const id of VIRTUE_ORDER) virtues[id] = 0
  return {
    virtues,
    keys: [],
    seals: {},
    startedAt: Date.now(),
    kills: 0,
    deaths: 0,
    trials: 0,
    shardsCleared: 0
  }
}

export function gainVirtue(state, virtue, amount) {
  if (!state.virtues[virtue] && state.virtues[virtue] !== 0) return 0
  const before = state.virtues[virtue]
  const after = clamp(before + amount, 0, 100)
  state.virtues[virtue] = after
  return after - before
}

export function playerBonuses(virtues) {
  return {
    maxHealth: 100 + virtues.resilience * 0.75,
    damageMultiplier: 1 + virtues.wisdom * 0.005,
    critChance: clamp(0.05 + virtues.discipline * 0.0025, 0, 0.35),
    killHeal: virtues.empathy * 0.08,
    staminaRegen: 1 + virtues.resilience * 0.004
  }
}

export function attackDamage(base, combo, virtues, opts = {}) {
  const bonuses = playerBonuses(virtues)
  const comboMultiplier = [1, 1.12, 1.42][combo % 3] ?? 1
  const variance = opts.variance ?? 0.92 + Math.random() * 0.16
  const crit = opts.crit ?? Math.random() < bonuses.critChance
  const raw = base * comboMultiplier * bonuses.damageMultiplier * variance * (crit ? 1.75 : 1)
  return { amount: Math.max(1, Math.round(raw)), crit }
}

export function trialGoal(type) {
  return TRIAL_TOTALS[type] ?? 3
}

export function trialComplete(trial) {
  return Boolean(trial) && trial.progress >= trialGoal(trial.type)
}

export function trialProgressLabel(trial) {
  if (!trial) return ''
  return `${Math.min(trial.progress, trialGoal(trial.type))} / ${trialGoal(trial.type)}`
}

export function allKeys(state) {
  return state.keys.length >= 4
}

export function nextObjective(state, { inShard, activeShard, bossAlive, returnOpen } = {}) {
  if (inShard) {
    if (bossAlive) return `Defeat ${activeShard?.guardian ?? 'the Guardian'}`
    if (returnOpen) return 'Return through the Shard Gate'
    return 'Guardian vanquished'
  }
  if (allKeys(state)) return 'Ascend to Seeker Castle'
  const restored = Object.values(state.seals).filter(Boolean).length
  const remaining = Math.max(0, 4 - restored)
  if (remaining === 0) return 'Ascend to Seeker Castle'
  if (remaining < 4) return `${remaining} Shard${remaining === 1 ? '' : 's'} remain unclaimed`
  return 'Restore the four Virtue Seals'
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—'
  return `${Math.max(0, Math.round(meters))}m`
}

export function shardSocketState(state) {
  return VIRTUE_ORDER.map(id => ({
    id,
    color: VIRTUES[id].css,
    filled: state.keys.includes(id) || Object.values(state.seals).filter(Boolean).length >= VIRTUE_ORDER.indexOf(id) + 1
  }))
}

export function victoryRank(state) {
  const total = VIRTUE_ORDER.reduce((sum, id) => sum + state.virtues[id], 0)
  const average = total / VIRTUE_ORDER.length
  if (average >= 90) return 'MYTHIC SEEKER'
  if (average >= 70) return 'ASCENDANT'
  if (average >= 50) return 'TRUE SEEKER'
  return 'WANDERER'
}

export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
