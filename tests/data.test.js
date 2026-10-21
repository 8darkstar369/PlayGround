import { describe, expect, it } from 'vitest'
import { SHARDS, VIRTUES, VIRTUE_ORDER, TRIAL_TOTALS, SHARD_BY_ID } from '../src/data.js'

describe('world data', () => {
  it('defines four unique Shards in four corners', () => {
    expect(SHARDS).toHaveLength(4)
    expect(new Set(SHARDS.map(shard => shard.id)).size).toBe(4)
    const positions = SHARDS.map(shard => `${shard.position[0]},${shard.position[2]}`)
    expect(new Set(positions).size).toBe(4)
    for (const shard of SHARDS) {
      expect(Math.abs(shard.position[0])).toBe(29)
      expect(Math.abs(shard.position[2])).toBe(29)
      expect(SHARD_BY_ID[shard.id]).toBe(shard)
    }
  })

  it('links every Shard to a virtue and a trial type', () => {
    for (const shard of SHARDS) {
      expect(VIRTUES[shard.virtue]).toBeDefined()
      expect(VIRTUE_ORDER).toContain(shard.virtue)
      expect(TRIAL_TOTALS[shard.trial]).toBe(3)
      expect(shard.rule.length).toBeGreaterThan(0)
      expect(shard.guardian.length).toBeGreaterThan(0)
      expect(shard.bossHp).toBeGreaterThan(0)
    }
  })

  it('uses each virtue exactly once', () => {
    const virtues = SHARDS.map(shard => shard.virtue).sort()
    expect(virtues).toEqual([...VIRTUE_ORDER].sort())
  })
})
