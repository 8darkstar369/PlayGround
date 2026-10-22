import { ROADS, ROAD_WIDTH, BLOCK_CENTERS, CITY_EDGE } from './world.js'

export function createRadar(world, canvas) {
  const ctx = canvas.getContext('2d')
  const size = canvas.width
  const c = size / 2
  const range = 155
  const scale = size / (range * 2)
  const map = world.mapBuildings

  function update(pos, heading, extras = {}) {
    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ctx.beginPath()
    ctx.arc(c, c, c - 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = '#0a2832'
    ctx.fillRect(0, 0, size, size)

    ctx.translate(c - pos.x * scale, c - pos.z * scale)
    ctx.scale(scale, scale)

    ctx.fillStyle = '#1d2b33'
    ctx.fillRect(-CITY_EDGE, -CITY_EDGE, CITY_EDGE * 2, CITY_EDGE * 2)
    ctx.strokeStyle = '#43525c'
    ctx.lineWidth = 3.5
    ctx.strokeRect(-CITY_EDGE, -CITY_EDGE, CITY_EDGE * 2, CITY_EDGE * 2)

    ctx.strokeStyle = '#66737c'
    ctx.lineWidth = ROAD_WIDTH
    ctx.beginPath()
    for (const x of ROADS) {
      ctx.moveTo(x, -CITY_EDGE)
      ctx.lineTo(x, CITY_EDGE)
    }
    for (const z of ROADS) {
      ctx.moveTo(-CITY_EDGE, z)
      ctx.lineTo(CITY_EDGE, z)
    }
    ctx.stroke()

    ctx.fillStyle = '#18252c'
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        ctx.fillRect(bx - 21, bz - 21, 42, 42)
      }
    }

    ctx.fillStyle = 'rgba(126,141,146,.7)'
    for (const b of map) {
      ctx.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d)
    }

    ctx.fillStyle = '#5c853e'
    for (const [x, z] of [[-32, -32], [96, 96]]) {
      ctx.fillRect(x - 21, z - 21, 42, 42)
    }

    ctx.fillStyle = 'rgba(214,181,128,.8)'
    ctx.fillRect(-252, -230, 34, 460)
    ctx.fillStyle = '#2b7a86'
    ctx.fillRect(-420, -420, 120, 840)

    ctx.fillStyle = 'rgba(255,212,90,.9)'
    const drawTarget = (target, isDrop = false, color = '#ffcf4a') => {
      if (!target) return
      let dx = target.x - pos.x
      let dz = target.z - pos.z
      const max = range * 0.8
      const dist = Math.hypot(dx, dz)
      if (dist > max) {
        dx = dx / dist * max
        dz = dz / dist * max
      }
      ctx.save()
      ctx.translate(pos.x + dx, pos.z + dz)
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = color
      ctx.fillRect(-5, -5, 10, 10)
      ctx.strokeStyle = isDrop ? 'rgba(255,230,140,.7)' : 'rgba(255,255,255,.5)'
      ctx.lineWidth = 2
      ctx.strokeRect(-8, -8, 16, 16)
      ctx.restore()
    }
    if (extras.mission) drawTarget(extras.mission)
    if (extras.dropOff) drawTarget(extras.dropOff, true)
    if (extras.waypoint) drawTarget(extras.waypoint, false, '#5ff5df')

    for (const car of world.trafficCars) {
      ctx.fillStyle = '#d9b04a'
      ctx.fillRect(car.position.x - 1.6, car.position.z - 1.6, 3.2, 3.2)
    }
    for (const car of world.parkedCars) {
      if (car.userData.occupied) continue
      ctx.fillStyle = 'rgba(240,240,230,.6)'
      ctx.fillRect(car.position.x - 1.2, car.position.z - 1.2, 2.4, 2.4)
    }

    ctx.restore()

    ctx.save()
    ctx.translate(c, c)
    ctx.rotate(heading)
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(0,0,0,.55)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(0, -9)
    ctx.lineTo(6.5, 7)
    ctx.lineTo(0, 4)
    ctx.lineTo(-6.5, 7)
    ctx.closePath()
    ctx.stroke()
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,.22)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(c, c, c - 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  return { update }
}
