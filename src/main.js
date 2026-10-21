import '@fontsource/cinzel/400.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './style.css'
import { Game } from './core/Game.js'

try {
  const game = new Game()
  window.__seekerverse = game
} catch (error) {
  console.error(error)
  const message = document.createElement('div')
  message.style.cssText = 'position:fixed;inset:0;z-index:999;display:grid;place-items:center;background:#04070d;color:#e9f4ff;font-family:Georgia,serif;text-align:center;padding:24px'
  message.innerHTML = `<div><div style="font-size:11px;letter-spacing:.3em;color:#e8c987;margin-bottom:14px">SEEKERVERSE</div><div style="font-size:24px;margin-bottom:10px">The Maze could not open.</div><div style="font-size:12px;opacity:.6">This experience requires WebGL. Try a recent browser with hardware acceleration enabled.</div></div>`
  document.body.appendChild(message)
}
