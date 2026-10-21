import { clamp } from '../logic.js'

const MOODS = {
  title: { root: 110, notes: [0, 7, 12, 15], filter: 820, wind: 0.035, chimeEvery: 9 },
  hub: { root: 98, notes: [0, 7, 10, 14], filter: 700, wind: 0.05, chimeEvery: 7.5 },
  elderwood: { root: 130.81, notes: [0, 3, 7, 10], filter: 1100, wind: 0.07, chimeEvery: 5.5 },
  iron: { root: 73.42, notes: [0, 5, 7, 11], filter: 430, wind: 0.11, chimeEvery: 6.5 },
  astral: { root: 146.83, notes: [0, 4, 7, 12], filter: 1500, wind: 0.025, chimeEvery: 4.5 },
  shadow: { root: 55, notes: [0, 1, 6, 8], filter: 260, wind: 0.1, chimeEvery: 10 },
  finale: { root: 130.81, notes: [0, 4, 7, 11], filter: 1700, wind: 0.02, chimeEvery: 4 }
}

export class AudioEngine {
  constructor() {
    this.ready = false
    this.muted = false
    this.paused = false
    this.scene = 'title'
    this.chimeTimer = 6
    this.started = false
  }

  start() {
    if (this.started) {
      this.ctx?.resume?.()
      return
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    this.started = true
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.7
    this.compressor = this.ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -18
    this.compressor.knee.value = 24
    this.compressor.ratio.value = 5
    this.compressor.attack.value = 0.004
    this.compressor.release.value = 0.25
    this.muffle = this.ctx.createBiquadFilter()
    this.muffle.type = 'lowpass'
    this.muffle.frequency.value = 1800
    this.muffle.Q.value = 0.4
    this.master.connect(this.muffle)
    this.muffle.connect(this.compressor)
    this.compressor.connect(this.ctx.destination)

    this.music = this.ctx.createGain()
    this.music.gain.value = 0.24
    this.music.connect(this.master)
    this.sfx = this.ctx.createGain()
    this.sfx.gain.value = 0.55
    this.sfx.connect(this.master)

    this.noiseBuffer = this.createNoiseBuffer(2.4)
    this.buildPad()
    this.buildWind()
    this.ready = true
    this.setScene(this.scene)
    this.ctx.resume?.()
  }

  createNoiseBuffer(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2 + white * 0.16
    }
    return buffer
  }

  buildPad() {
    this.padFilter = this.ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = 700
    this.padFilter.Q.value = 0.8
    this.padFilter.connect(this.music)
    this.padOscillators = []
    this.padVoices = []
    const layout = [
      { type: 'sine', detune: -5, gain: 0.2, octave: 0 },
      { type: 'triangle', detune: 5, gain: 0.1, octave: 0 },
      { type: 'sine', detune: 2, gain: 0.09, octave: 1 },
      { type: 'sawtooth', detune: -9, gain: 0.025, octave: 1 },
      { type: 'sine', detune: 0, gain: 0.045, octave: 2 }
    ]
    for (const voice of layout) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const pan = this.ctx.createStereoPanner()
      osc.type = voice.type
      gain.gain.value = voice.gain
      pan.pan.value = (Math.random() - 0.5) * 0.5
      osc.connect(gain)
      gain.connect(pan)
      pan.connect(this.padFilter)
      osc.start()
      this.padOscillators.push(osc)
      this.padVoices.push({ osc, gain, voice, pan })
    }
    const lfo = this.ctx.createOscillator()
    const lfoGain = this.ctx.createGain()
    lfo.frequency.value = 0.055
    lfoGain.gain.value = 130
    lfo.connect(lfoGain)
    lfoGain.connect(this.padFilter.frequency)
    lfo.start()
  }

  buildWind() {
    const source = this.ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 480
    filter.Q.value = 0.6
    const gain = this.ctx.createGain()
    gain.gain.value = 0.05
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.music)
    source.start()
    this.windGain = gain
    this.windFilter = filter
  }

  setScene(name) {
    this.scene = name
    if (!this.ready) return
    const mood = MOODS[name] || MOODS.hub
    const now = this.ctx.currentTime
    this.padVoices.forEach(({ osc, voice }) => {
      const note = mood.notes[voice.octave % mood.notes.length]
      const freq = mood.root * Math.pow(2, (note + 12 * voice.octave) / 12)
      osc.frequency.cancelScheduledValues(now)
      osc.frequency.setTargetAtTime(freq, now, 2.2)
    })
    this.padFilter.frequency.cancelScheduledValues(now)
    this.padFilter.frequency.setTargetAtTime(mood.filter, now, 2.5)
    this.windGain.gain.setTargetAtTime(mood.wind, now, 2)
    this.windFilter.frequency.setTargetAtTime(name === 'iron' ? 900 : name === 'astral' ? 1600 : 520, now, 2)
    this.muffle.frequency.cancelScheduledValues(now)
    if (name === 'shadow') {
      this.muffle.frequency.setTargetAtTime(420, now, 1.2)
      this.music.gain.setTargetAtTime(0.2, now, 1.2)
    } else if (name === 'finale') {
      this.muffle.frequency.setTargetAtTime(3000, now, 1.2)
      this.music.gain.setTargetAtTime(0.32, now, 1.2)
    } else {
      this.muffle.frequency.setTargetAtTime(2600, now, 1.2)
      this.music.gain.setTargetAtTime(0.24, now, 1.2)
    }
    this.chimeTimer = 3
  }

  setMuted(muted) {
    this.muted = muted
    if (!this.ready) return
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(muted ? 0 : 0.7, now, 0.12)
  }

  setPaused(paused) {
    this.paused = paused
    if (!this.ready) return
    if (paused) this.ctx.suspend?.()
    else this.ctx.resume?.()
  }

  update(dt) {
    if (!this.ready || this.paused) return
    this.chimeTimer -= dt
    if (this.chimeTimer <= 0) {
      const mood = MOODS[this.scene] || MOODS.hub
      this.chimeTimer = mood.chimeEvery * (0.7 + Math.random() * 0.7)
      const note = mood.notes[Math.floor(Math.random() * mood.notes.length)]
      const freq = mood.root * Math.pow(2, (note + 24) / 12)
      this.chime(freq, 0.035, 2.6)
    }
  }

  tone({ freq = 440, endFreq = freq, duration = 0.25, type = 'sine', volume = 0.2, attack = 0.006, pan = 0 }) {
    if (!this.ready) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const panner = this.ctx.createStereoPanner()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration)
    panner.pan.value = clamp(pan, -1, 1)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain)
    gain.connect(panner)
    panner.connect(this.sfx)
    osc.start(now)
    osc.stop(now + duration + 0.05)
  }

  noise({ duration = 0.3, volume = 0.2, type = 'highpass', freq = 900, endFreq = freq, Q = 0.7, pan = 0 }) {
    if (!this.ready) return
    const now = this.ctx.currentTime
    const source = this.ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()
    const panner = this.ctx.createStereoPanner()
    filter.type = type
    filter.frequency.setValueAtTime(freq, now)
    if (endFreq !== freq) filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration)
    filter.Q.value = Q
    panner.pan.value = clamp(pan, -1, 1)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(panner)
    panner.connect(this.sfx)
    source.start(now)
    source.stop(now + duration + 0.05)
  }

  chime(freq, volume = 0.04, duration = 3) {
    if (!this.ready) return
    const now = this.ctx.currentTime
    for (const [mult, detune] of [[1, 0], [2.01, 4], [2.99, -6]]) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const panner = this.ctx.createStereoPanner()
      osc.type = 'sine'
      osc.frequency.value = freq * mult
      osc.detune.value = detune
      panner.pan.value = (Math.random() - 0.5) * 0.8
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(volume / mult, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      osc.connect(gain)
      gain.connect(panner)
      panner.connect(this.music)
      osc.start(now)
      osc.stop(now + duration + 0.1)
    }
  }

  strike() {
    this.noise({ duration: 0.22, volume: 0.22, type: 'bandpass', freq: 2400, endFreq: 380, Q: 1.1 })
    this.tone({ freq: 170, endFreq: 60, duration: 0.16, type: 'triangle', volume: 0.1 })
  }

  hit(crit = false) {
    this.tone({ freq: crit ? 220 : 150, endFreq: 54, duration: 0.22, type: 'square', volume: crit ? 0.14 : 0.09 })
    this.noise({ duration: 0.14, volume: 0.12, type: 'highpass', freq: 1200, endFreq: 400 })
    if (crit) this.tone({ freq: 880, endFreq: 1320, duration: 0.12, type: 'sine', volume: 0.05 })
  }

  pickup() {
    this.tone({ freq: 660, endFreq: 990, duration: 0.5, type: 'sine', volume: 0.13 })
    setTimeout(() => this.tone({ freq: 990, endFreq: 1320, duration: 0.55, type: 'sine', volume: 0.09 }), 80)
  }

  virtue() {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => setTimeout(() => this.chime(freq, 0.05, 2.2), i * 120))
  }

  portal() {
    this.tone({ freq: 90, endFreq: 240, duration: 1.4, type: 'sine', volume: 0.16 })
    this.noise({ duration: 1.2, volume: 0.1, type: 'bandpass', freq: 300, endFreq: 2400, Q: 1.8 })
    this.chime(660, 0.05, 2.6)
  }

  damage() {
    this.tone({ freq: 120, endFreq: 40, duration: 0.32, type: 'sawtooth', volume: 0.16 })
    this.noise({ duration: 0.25, volume: 0.14, type: 'lowpass', freq: 700, endFreq: 120 })
  }

  heal() {
    this.tone({ freq: 440, endFreq: 660, duration: 0.55, type: 'sine', volume: 0.08 })
    this.chime(880, 0.035, 1.4)
  }

  dodge() {
    this.noise({ duration: 0.3, volume: 0.12, type: 'bandpass', freq: 900, endFreq: 260, Q: 0.8 })
  }

  bossRoar() {
    this.tone({ freq: 62, endFreq: 34, duration: 1.5, type: 'sawtooth', volume: 0.2 })
    this.tone({ freq: 93, endFreq: 47, duration: 1.5, type: 'square', volume: 0.08 })
    this.noise({ duration: 1.3, volume: 0.12, type: 'lowpass', freq: 500, endFreq: 100 })
  }

  death() {
    this.tone({ freq: 180, endFreq: 46, duration: 1.1, type: 'triangle', volume: 0.13 })
    this.noise({ duration: 0.9, volume: 0.09, type: 'lowpass', freq: 1100, endFreq: 100 })
  }

  victory() {
    const notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99]
    notes.forEach((freq, i) => setTimeout(() => this.chime(freq, 0.055, 3.2), i * 130))
    this.tone({ freq: 65.41, endFreq: 130.81, duration: 3.5, type: 'sine', volume: 0.12 })
  }

  click() {
    this.tone({ freq: 720, endFreq: 880, duration: 0.09, type: 'sine', volume: 0.04 })
  }

  whisper() {
    this.noise({ duration: 1.4, volume: 0.065, type: 'bandpass', freq: 620 + Math.random() * 700, endFreq: 300, Q: 3.2, pan: (Math.random() - 0.5) * 1.4 })
  }
}
