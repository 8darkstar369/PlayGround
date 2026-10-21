import { describe, expect, it, vi } from 'vitest'
import {
  clamp, lerp, damp, angleDelta, mulberry32, createInitialState, gainVirtue,
  playerBonuses, attackDamage, trialComplete, trialProgressLabel, allKeys,
  nextObjective, formatDistance, formatTime, victoryRank
} from '../src/logic.js'

describe('math helpers', () => {
  it('clamps and interpolates values', () => {
    expect(clamp(-2, 0, 10)).toBe(0)
    expect(clamp(12, 0, 10)).toBe(10)
    expect(lerp(10, 20, 0.25)).toBe(12.5)
    expect(damp(0, 10, 10, 0.1)).toBeCloseTo(6.321, 3)
  })

  it('wraps angle deltas to the shortest path', () => {
    expect(angleDelta(Math.PI * 0.9, -Math.PI * 0.9)).toBeCloseTo(Math.PI * 0.2)
    expect(angleDelta(-Math.PI * 0.9, Math.PI * 0.9)).toBeCloseTo(-Math.PI * 0.2)
  })

  it('produces deterministic seeded random values', () => {
    const a = mulberry32(99)
    const b = mulberry32(99)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(a()).toBeGreaterThanOrEqual(0)
    expect(a()).toBeLessThan(1)
  })
})

describe('progression', () => {
  it('creates a complete initial state', () => {
    const state = createInitialState()
    expect(state.virtues).toEqual({ wisdom: 0, resilience: 0, empathy: 0, discipline: 0 })
    expect(state.keys).toEqual([])
    expect(state.seals).toEqual({})
    expect(state.kills).toBe(0)
    expect(state.shardsCleared).toBe(0)
    expect(Number.isFinite(state.startedAt)).toBe(true)
  })

  it('gains virtue with clamping and ignores unknown virtues', () => {
    const state = createInitialState()
    expect(gainVirtue(state, 'wisdom', 25)).toBe(25)
    expect(state.virtues.wisdom).toBe(25)
    expect(gainVirtue(state, 'wisdom', 200)).toBe(75)
    expect(state.virtues.wisdom).toBe(100)
    expect(gainVirtue(state, 'unknown', 10)).toBe(0)
  })

  it('derives player bonuses from virtues', () => {
    const bonuses = playerBonuses({ wisdom: 100, resilience: 40, empathy: 50, discipline: 100 })
    expect(bonuses.maxHealth).toBe(130)
    expect(bonuses.damageMultiplier).toBe(1.5)
    expect(bonuses.critChance).toBeCloseTo(0.3)
    expect(bonuses.killHeal).toBe(4)
    expect(bonuses.staminaRegen).toBeCloseTo(1.16)
  })

  it('calculates combo and critical damage', () => {
    const virtues = { wisdom: 0, resilience: 0, empathy: 0, discipline: 0 }
    const normal = attackDamage(20, 0, virtues, { variance: 1, crit: false })
    const combo = attackDamage(20, 2, virtues, { variance: 1, crit: false })
    const crit = attackDamage(20, 0, virtues, { variance: 1, crit: true })
    expect(normal).toEqual({ amount: 20, crit: false })
    expect(combo.amount).toBe(28)
    expect(crit.amount).toBe(35)
  })

  it('reports trial completion and labels', () => {
    expect(trialComplete(null)).toBe(false)
    expect(trialComplete({ type: 'empathy', progress: 2 })).toBe(false)
    expect(trialComplete({ type: 'empathy', progress: 3 })).toBe(true)
    expect(trialProgressLabel({ type: 'wisdom', progress: 8 })).toBe('3 / 3')
  })

  it('describes the current objective', () => {
    const state = createInitialState()
    expect(nextObjective(state)).toBe('Restore the four Virtue Seals')
    state.seals.elderwood = true
    expect(nextObjective(state)).toBe('3 Shards remain unclaimed')
    state.seals.iron = state.seals.astral = state.seals.shadow = true
    expect(nextObjective(state)).toBe('Ascend to Seeker Castle')
    state.keys.push('elderwood', 'iron', 'astral', 'shadow')
    expect(allKeys(state)).toBe(true)
    expect(nextObjective(state, { inShard: true, activeShard: { guardian: 'X' }, bossAlive: true })).toBe('Defeat X')
    expect(nextObjective(state, { inShard: true, returnOpen: true })).toBe('Return through the Shard Gate')
  })
})

describe('formatting', () => {
  it('formats distance and elapsed time', () => {
    expect(formatDistance(undefined)).toBe('—')
    expect(formatDistance(3.6)).toBe('4m')
    expect(formatDistance(-2)).toBe('0m')
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(83_000)).toBe('1:23')
  })

  it('ranks the seeker by average virtue', () => {
    const virtues = { wisdom: 100, resilience: 100, empathy: 100, discipline: 100 }
    expect(victoryRank({ virtues })).toBe('MYTHIC SEEKER')
    expect(victoryRank({ virtues: { ...virtues, wisdom: 50, resilience: 50, empathy: 50, discipline: 50 } })).toBe('TRUE SEEKER')
  })
})
