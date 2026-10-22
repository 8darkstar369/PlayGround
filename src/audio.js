export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.engineOsc = null
    this.engineGain = null
    this.started = false
    this.muted = false
  }

  start() {
    if (this.started) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.55
    this.master.connect(this.ctx.destination)
    this.started = true
    this.ambience()
    this.engine()
  }

  ambience() {
    const ctx = this.ctx
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 520
    filter.Q.value = 0.7
    const gain = ctx.createGain()
    gain.gain.value = 0.028
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.012
    lfo.connect(lfoGain).connect(gain.gain)
    src.connect(filter).connect(gain).connect(this.master)
    src.start()
    lfo.start()

    const chord = [55, 82.41, 110, 138.59]
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = i % 2 ? 'triangle' : 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = (i - 1.5) * 6
      const g = ctx.createGain()
      g.gain.value = 0.012
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 240
      lp.Q.value = 2
      const trem = ctx.createOscillator()
      trem.frequency.value = 0.045 + i * 0.013
      const tg = ctx.createGain()
      tg.gain.value = 0.008
      trem.connect(tg).connect(g.gain)
      osc.connect(lp).connect(g).connect(this.master)
      osc.start()
      trem.start()
    })
  }

  engine() {
    const ctx = this.ctx
    this.engineGain = ctx.createGain()
    this.engineGain.gain.value = 0
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    filter.Q.value = 4
    this.engineOsc = ctx.createOscillator()
    this.engineOsc.type = 'sawtooth'
    this.engineOsc.frequency.value = 46
    const osc2 = ctx.createOscillator()
    osc2.type = 'square'
    osc2.frequency.value = 23
    const g2 = ctx.createGain()
    g2.gain.value = 0.35
    this.engineOsc.connect(filter)
    osc2.connect(g2).connect(filter)
    filter.connect(this.engineGain).connect(this.master)
    this.engineOsc.start()
    osc2.start()
  }

  setEngine(on, speed = 0, reverse = false) {
    if (!this.started || !this.engineGain) return
    const now = this.ctx.currentTime
    const target = on ? 0.028 + Math.min(0.06, Math.abs(speed) * 0.0019) : 0
    this.engineGain.gain.setTargetAtTime(target, now, 0.12)
    if (this.engineOsc) {
      const f = 38 + Math.abs(speed) * 3.1 + (reverse ? -7 : 0)
      this.engineOsc.frequency.setTargetAtTime(f, now, 0.15)
    }
  }

  horn() {
    if (!this.started) return
    const ctx = this.ctx
    const now = ctx.currentTime
    for (const freq of [392, 466]) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)
      osc.connect(g).connect(this.master)
      osc.start(now)
      osc.stop(now + 0.36)
    }
  }

  chime() {
    if (!this.started) return
    const ctx = this.ctx
    const now = ctx.currentTime
    ;[880, 1174, 1568].forEach((f, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      g.gain.setValueAtTime(0.0001, now + i * 0.06)
      g.gain.exponentialRampToValueAtTime(0.09, now + i * 0.06 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.5)
      osc.connect(g).connect(this.master)
      osc.start(now + i * 0.06)
      osc.stop(now + i * 0.06 + 0.55)
    })
  }

  crash() {
    if (!this.started) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    const g = ctx.createGain()
    g.gain.value = 0.28
    src.connect(filter).connect(g).connect(this.master)
    src.start(now)
  }

  toggle() {
    if (!this.started) return
    this.muted = !this.muted
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05)
    return !this.muted
  }
}
