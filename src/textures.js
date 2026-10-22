import * as THREE from 'three'

function canvas(size = 256, height = size) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = height
  return c
}

function tex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 4
  return t
}

function noise(ctx, w, h, amount, alpha = 0.1) {
  for (let i = 0; i < amount; i++) {
    const g = Math.floor(Math.random() * 255)
    ctx.fillStyle = `rgba(${g},${g},${g},${alpha})`
    const s = Math.random() * 3 + 1
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s)
  }
}

export function asphaltTexture() {
  const c = canvas(512)
  const x = c.getContext('2d')
  x.fillStyle = '#20242b'
  x.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 26; i++) {
    x.strokeStyle = `rgba(${10 + Math.random() * 20},${12 + Math.random() * 20},${18 + Math.random() * 20},${0.25 + Math.random() * 0.2})`
    x.lineWidth = Math.random() * 2 + 0.5
    x.beginPath()
    let px = Math.random() * 512
    let py = Math.random() * 512
    x.moveTo(px, py)
    for (let j = 0; j < 4; j++) {
      px += (Math.random() - 0.5) * 120
      py += Math.random() * 50
      x.lineTo(px, py)
    }
    x.stroke()
  }
  noise(x, 512, 512, 7000, 0.05)
  return tex(c, 1, 1)
}

export function sidewalkTexture() {
  const c = canvas(512)
  const x = c.getContext('2d')
  x.fillStyle = '#c9c7c1'
  x.fillRect(0, 0, 512, 512)
  noise(x, 512, 512, 2600, 0.045)
  x.strokeStyle = 'rgba(60,58,54,.26)'
  x.lineWidth = 3
  for (let i = 0; i <= 512; i += 64) {
    x.beginPath()
    x.moveTo(i, 0)
    x.lineTo(i, 512)
    x.stroke()
    x.beginPath()
    x.moveTo(0, i)
    x.lineTo(512, i)
    x.stroke()
  }
  x.strokeStyle = 'rgba(255,255,255,.10)'
  x.lineWidth = 1
  for (let i = 0; i <= 512; i += 64) {
    x.beginPath()
    x.moveTo(i + 2, 0)
    x.lineTo(i + 2, 512)
    x.stroke()
  }
  return tex(c, 1, 1)
}

export function sandTexture() {
  const c = canvas(512)
  const x = c.getContext('2d')
  x.fillStyle = '#d8b783'
  x.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 5000; i++) {
    x.fillStyle = `rgba(${120 + Math.random() * 100},${90 + Math.random() * 80},${50 + Math.random() * 60},${Math.random() * 0.15})`
    x.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 3, Math.random() * 3)
  }
  x.strokeStyle = 'rgba(120,85,45,.12)'
  x.lineWidth = 4
  for (let i = 0; i < 14; i++) {
    x.beginPath()
    x.arc(Math.random() * 512, Math.random() * 512, 40 + Math.random() * 90, 0, Math.PI * 1.4)
    x.stroke()
  }
  return tex(c, 1, 1)
}

const FACADES = {
  glass: { bg: '#243c45', wall: '#395b63', frame: '#233039', lit: ['#ffd9a0', '#bfe9ef', '#ffc778'], dark: '#15252c', sill: '#7f9297' },
  stucco: { bg: '#bfa47f', wall: '#d7c3a1', frame: '#6f6253', lit: ['#ffe0a8', '#ffc56c', '#c7f3ef'], dark: '#403b35', sill: '#eee1c8' },
  brick: { bg: '#71433b', wall: '#965448', frame: '#3c2a27', lit: ['#ffd98f', '#ffb35e', '#ffe8b5'], dark: '#281d1b', sill: '#c7a58e' },
  deco: { bg: '#a66f72', wall: '#d29a98', frame: '#544248', lit: ['#ffe5b4', '#ffbe86', '#d2fff5'], dark: '#382b33', sill: '#ecc7b3' },
  teal: { bg: '#37615e', wall: '#4f827b', frame: '#223d3c', lit: ['#ffd9a0', '#bfffe7', '#ffcd85'], dark: '#162826', sill: '#9bb9ae' }
}

export function facadeTexture(style = 'glass') {
  const p = FACADES[style] || FACADES.glass
  const c = canvas(256, 512)
  const x = c.getContext('2d')
  x.fillStyle = p.wall
  x.fillRect(0, 0, 256, 512)
  const cols = style === 'glass' ? 5 : 5
  const rows = style === 'glass' ? 10 : 9
  const cw = 256 / cols
  const ch = 512 / rows
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = col * cw + cw * 0.18
      const py = row * ch + ch * 0.17
      const ww = cw * 0.64
      const wh = ch * 0.54
      x.fillStyle = p.frame
      x.fillRect(px - 2, py - 2, ww + 4, wh + 4)
      const lit = Math.random() > 0.79
      x.fillStyle = lit ? p.lit[Math.floor(Math.random() * p.lit.length)] : p.dark
      x.fillRect(px, py, ww, wh)
      x.fillStyle = 'rgba(255,255,255,.12)'
      x.fillRect(px, py, ww, wh * 0.2)
      if (style === 'glass' && col < cols - 1) {
        x.fillStyle = 'rgba(255,255,255,.08)'
        x.fillRect(px + ww, py, cw * 0.08, wh)
      }
      if (style !== 'glass') {
        x.fillStyle = p.sill
        x.fillRect(px - 4, py + wh + 2, ww + 8, 3)
      }
    }
    if (style === 'brick') {
      x.fillStyle = 'rgba(40,20,15,.10)'
      x.fillRect(0, row * ch + ch - 2, 256, 2)
    }
  }
  if (style === 'glass') {
    const grad = x.createLinearGradient(0, 0, 256, 0)
    grad.addColorStop(0, 'rgba(255,255,255,.15)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0)')
    grad.addColorStop(0.7, 'rgba(140,235,255,.10)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = grad
    x.fillRect(0, 0, 256, 512)
  }
  return tex(c, 1, 1)
}

export function shopTexture(name, color = '#ff6b4a', sub = 'OPEN LATE') {
  const c = canvas(512, 128)
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 512, 128)
  g.addColorStop(0, '#12151b')
  g.addColorStop(0.5, color)
  g.addColorStop(1, '#12151b')
  x.fillStyle = g
  x.fillRect(0, 0, 512, 128)
  x.fillStyle = 'rgba(0,0,0,.4)'
  x.fillRect(8, 8, 496, 112)
  x.strokeStyle = 'rgba(255,255,255,.55)'
  x.lineWidth = 3
  x.strokeRect(12, 12, 488, 104)
  x.fillStyle = '#fff8df'
  x.font = '900 58px Arial Black, sans-serif'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(name, 256, 60)
  x.fillStyle = color
  x.font = '700 20px Arial, sans-serif'
  x.fillText(sub, 256, 100)
  return tex(c, 1, 1)
}

export function billboardTexture(title, accent = '#ffcc55') {
  const c = canvas(512, 256)
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 512, 256)
  g.addColorStop(0, '#101923')
  g.addColorStop(0.55, '#213b47')
  g.addColorStop(1, '#0b1015')
  x.fillStyle = g
  x.fillRect(0, 0, 512, 256)
  x.save()
  x.translate(380, 130)
  x.rotate(-0.35)
  x.strokeStyle = accent
  x.lineWidth = 16
  x.beginPath()
  x.arc(0, 0, 78, 0, Math.PI * 2)
  x.stroke()
  x.strokeStyle = 'rgba(255,255,255,.5)'
  x.lineWidth = 3
  x.beginPath()
  x.arc(0, 0, 92, 0, Math.PI * 2)
  x.stroke()
  x.restore()
  x.fillStyle = accent
  x.font = '900 70px Arial Black, sans-serif'
  x.fillText(title, 28, 105)
  x.fillStyle = '#f4f1e8'
  x.font = '600 22px Arial, sans-serif'
  x.fillText('SUNSET CITY  •  FEEL THE HEAT', 31, 143)
  x.fillStyle = 'rgba(255,255,255,.55)'
  x.font = '500 16px Arial, sans-serif'
  x.fillText('EVERY NIGHT IS A NEW STORY', 31, 185)
  return tex(c, 1, 1)
}

export function radialGlow(color = 'rgba(255,190,90,.7)') {
  const c = canvas(128)
  const x = c.getContext('2d')
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, color)
  g.addColorStop(0.4, color.replace(/[\d.]+\)$/, '0.2)'))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  return tex(c, 1, 1)
}

export function waterNormalTexture() {
  const c = canvas(256)
  const x = c.getContext('2d')
  x.fillStyle = '#8080ff'
  x.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 18; i++) {
    const g = x.createRadialGradient(Math.random() * 256, Math.random() * 256, 0, Math.random() * 256, Math.random() * 256, 60 + Math.random() * 80)
    g.addColorStop(0, 'rgba(140,140,255,.35)')
    g.addColorStop(0.5, 'rgba(96,96,255,.15)')
    g.addColorStop(1, 'rgba(128,128,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 256, 256)
  }
  return tex(c, 3, 3)
}

export function crowdTexture() {
  const c = canvas(128)
  const x = c.getContext('2d')
  x.clearRect(0, 0, 128, 128)
  x.fillStyle = 'rgba(255,255,255,.9)'
  x.beginPath()
  x.arc(64, 32, 12, 0, Math.PI * 2)
  x.fill()
  x.fillRect(52, 48, 24, 44)
  x.fillRect(38, 92, 18, 30)
  x.fillRect(72, 92, 18, 30)
  return tex(c, 1, 1)
}
