import { clamp } from '../logic.js'

export class Input {
  constructor(canvas, joystick, knob, callbacks = {}) {
    this.canvas = canvas
    this.callbacks = callbacks
    this.keys = new Set()
    this.joystickValue = { x: 0, z: 0 }
    this.cameraDelta = { x: 0, y: 0 }
    this.zoomDelta = 0
    this.attackPressed = false
    this.attackHeld = false
    this.dodgePressed = false
    this.interactPressed = false
    this.interactHeld = false
    this.joystick = joystick
    this.knob = knob
    this.joystickPointer = null
    this.dragging = false
    this.dragPointer = null
    this.dragStart = { x: 0, y: 0 }
    this.lastPointer = { x: 0, y: 0 }
    this.dragDistance = 0

    this.onKeyDown = this.onKeyDown.bind(this)
    this.onKeyUp = this.onKeyUp.bind(this)
    this.bind()
  }

  bind() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.attackHeld = false
      this.interactHeld = false
      this.resetJoystick()
    })

    this.canvas.addEventListener('contextmenu', event => event.preventDefault())

    this.canvas.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (this.dragPointer !== null) return
      this.dragPointer = event.pointerId
      this.dragging = true
      this.dragDistance = 0
      this.dragStart.x = event.clientX
      this.dragStart.y = event.clientY
      this.lastPointer.x = event.clientX
      this.lastPointer.y = event.clientY
      this.canvas.setPointerCapture?.(event.pointerId)
    })

    this.canvas.addEventListener('pointermove', event => {
      if (event.pointerId !== this.dragPointer) return
      const dx = event.clientX - this.lastPointer.x
      const dy = event.clientY - this.lastPointer.y
      this.lastPointer.x = event.clientX
      this.lastPointer.y = event.clientY
      this.dragDistance += Math.abs(dx) + Math.abs(dy)
      const sensitivity = event.pointerType === 'touch' ? 0.0048 : 0.0032
      this.cameraDelta.x -= dx * sensitivity
      this.cameraDelta.y += dy * sensitivity
    })

    const finishDrag = event => {
      if (event.pointerId !== this.dragPointer) return
      const wasClick = this.dragDistance < 7 && event.pointerType === 'mouse'
      this.dragPointer = null
      this.dragging = false
      if (wasClick) this.attackPressed = true
    }
    this.canvas.addEventListener('pointerup', finishDrag)
    this.canvas.addEventListener('pointercancel', event => {
      if (event.pointerId === this.dragPointer) {
        this.dragPointer = null
        this.dragging = false
      }
    })

    this.canvas.addEventListener('wheel', event => {
      event.preventDefault()
      this.zoomDelta += event.deltaY * 0.0015
    }, { passive: false })

    this.bindAction('btn-attack', 'attack')
    this.bindAction('btn-dodge', 'dodge')
    this.bindAction('btn-interact', 'interact')
    this.bindJoystick()
  }

  bindAction(id, action) {
    const element = document.getElementById(id)
    if (!element) return
    const press = event => {
      event.preventDefault()
      event.stopPropagation()
      element.classList.add('pressed')
      if (action === 'attack') {
        this.attackPressed = true
        this.attackHeld = true
      } else if (action === 'dodge') {
        this.dodgePressed = true
      } else if (action === 'interact') {
        this.interactPressed = true
        this.interactHeld = true
      }
      element.setPointerCapture?.(event.pointerId)
    }
    const release = event => {
      event.preventDefault()
      event.stopPropagation()
      element.classList.remove('pressed')
      if (action === 'attack') this.attackHeld = false
      if (action === 'interact') this.interactHeld = false
    }
    element.addEventListener('pointerdown', press)
    element.addEventListener('pointerup', release)
    element.addEventListener('pointercancel', release)
    element.addEventListener('pointerleave', event => {
      if (event.buttons === 0) release(event)
    })
  }

  bindJoystick() {
    if (!this.joystick) return
    this.joystick.style.pointerEvents = 'auto'
    const start = event => {
      event.preventDefault()
      event.stopPropagation()
      this.joystickPointer = event.pointerId
      this.joystick.setPointerCapture?.(event.pointerId)
      this.updateJoystick(event)
    }
    const move = event => {
      if (event.pointerId !== this.joystickPointer) return
      event.preventDefault()
      this.updateJoystick(event)
    }
    const end = event => {
      if (event.pointerId !== this.joystickPointer) return
      event.preventDefault()
      this.resetJoystick()
    }
    this.joystick.addEventListener('pointerdown', start)
    this.joystick.addEventListener('pointermove', move)
    this.joystick.addEventListener('pointerup', end)
    this.joystick.addEventListener('pointercancel', end)
  }

  updateJoystick(event) {
    const rect = this.joystick.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const max = rect.width * 0.32
    let dx = event.clientX - cx
    let dy = event.clientY - cy
    const length = Math.hypot(dx, dy)
    if (length > max) {
      dx = (dx / length) * max
      dy = (dy / length) * max
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
    const nx = clamp(dx / max, -1, 1)
    const ny = clamp(dy / max, -1, 1)
    const deadzone = 0.14
    const magnitude = Math.hypot(nx, ny)
    if (magnitude < deadzone) {
      this.joystickValue.x = 0
      this.joystickValue.z = 0
    } else {
      const normalized = Math.min(1, (magnitude - deadzone) / (1 - deadzone))
      this.joystickValue.x = (nx / magnitude) * normalized
      this.joystickValue.z = (ny / magnitude) * normalized
    }
  }

  resetJoystick() {
    this.joystickPointer = null
    this.joystickValue.x = 0
    this.joystickValue.z = 0
    if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)'
  }

  onKeyDown(event) {
    if (event.repeat) {
      this.keys.add(event.code)
      return
    }
    this.keys.add(event.code)
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
    if (event.code === 'KeyJ' || event.code === 'KeyF') {
      this.attackPressed = true
      this.attackHeld = true
    }
    if (event.code === 'Space' || event.code === 'ShiftLeft') this.dodgePressed = true
    if (event.code === 'KeyE') {
      this.interactPressed = true
      this.interactHeld = true
    }
    if (event.code === 'Escape' || event.code === 'KeyP') this.callbacks.onPause?.()
    if (event.code === 'KeyM') this.callbacks.onMute?.()
  }

  onKeyUp(event) {
    this.keys.delete(event.code)
    if (event.code === 'KeyJ' || event.code === 'KeyF') this.attackHeld = false
    if (event.code === 'KeyE') this.interactHeld = false
  }

  get move() {
    let x = this.joystickValue.x
    let z = this.joystickValue.z
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    const length = Math.hypot(x, z)
    if (length > 1) {
      x /= length
      z /= length
    }
    return { x, z, magnitude: Math.min(1, length) }
  }

  takeCameraDelta() {
    const delta = { x: this.cameraDelta.x, y: this.cameraDelta.y }
    this.cameraDelta.x = 0
    this.cameraDelta.y = 0
    return delta
  }

  takeZoom() {
    const zoom = this.zoomDelta
    this.zoomDelta = 0
    return zoom
  }

  consumeAttack() {
    const value = this.attackPressed
    this.attackPressed = false
    return value
  }

  consumeDodge() {
    const value = this.dodgePressed
    this.dodgePressed = false
    return value
  }

  consumeInteract() {
    const value = this.interactPressed
    this.interactPressed = false
    return value
  }
}
