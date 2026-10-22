// OpenCode Zen chat completions client. Used when a key is configured; the game falls
// back to the offline persona engine (server/sim.js) whenever this is unavailable.

const ZEN_BASE = process.env.ZEN_BASE_URL || 'https://opencode.ai/zen/v1'
const ZEN_KEY = process.env.ZEN_API_KEY || process.env.OPENCODE_ZEN_API_KEY || ''
export const ZEN_MODEL = process.env.ZEN_MODEL || 'mimo-v2.6-flash-free'

let cachedModels = null
let modelCheckedAt = 0

export function providerStatus() {
  return {
    provider: ZEN_KEY ? 'zen' : 'sim',
    model: ZEN_KEY ? ZEN_MODEL : 'sunset-sim',
    keyPresent: Boolean(ZEN_KEY)
  }
}

async function listModels() {
  if (cachedModels && Date.now() - modelCheckedAt < 10 * 60 * 1000) return cachedModels
  const res = await fetch(`${ZEN_BASE}/models`, {
    headers: { Authorization: `Bearer ${ZEN_KEY || 'public'}`, 'Content-Type': 'application/json' }
  })
  if (!res.ok) throw new Error(`models ${res.status}`)
  const body = await res.json()
  cachedModels = (body.data || []).map((m) => m.id)
  modelCheckedAt = Date.now()
  return cachedModels
}

export async function complete({ system, messages, model = ZEN_MODEL, temperature = 0.9, maxTokens = 220 }) {
  if (!ZEN_KEY) throw new Error('no-zen-key')
  let target = model
  try {
    const models = await listModels()
    if (models.length && !models.includes(target)) {
      const free = models.find((id) => id.endsWith('-free'))
      target = free || models[0]
    }
  } catch {
    // model list unavailable, try the configured model anyway
  }

  const res = await fetch(`${ZEN_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ZEN_KEY}`,
      'User-Agent': 'sunset-city/1.0'
    },
    body: JSON.stringify({
      model: target,
      temperature,
      max_tokens: maxTokens,
      stream: false,
      messages: [{ role: 'system', content: system }, ...messages]
    }),
    signal: AbortSignal.timeout(25000)
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`zen ${res.status} ${text.slice(0, 200)}`)
  }
  const body = await res.json()
  const content = body?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('zen empty response')
  return { text: clean(content), model: target }
}

export function clean(text) {
  let out = String(text)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*(?:assistant|nova|reply)\s*:\s*/i, '')
    .replace(/^["'`\u201c]+/, '')
    .replace(/["'`\u201d]+$/, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (out.length > 420) out = out.slice(0, 417).replace(/\s+\S*$/, '') + '...'
  return out
}
