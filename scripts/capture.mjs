import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

class TransientError extends Error {}

const transient = message => {
  throw new TransientError(message)
}

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
if (!url || !output) {
  console.error('Set CAPTURE_URL and CAPTURE_DIR.')
  process.exit(1)
}

const runtime = join(process.env.HOME, '.local/share/omgithub-playwright')
if (!existsSync(runtime)) transient(`Playwright runtime not found at ${runtime}`)

let chromium
try {
  const require = createRequire(join(runtime, 'package.json'))
  ;({ chromium } = require('playwright'))
} catch (error) {
  transient(`Unable to load Playwright: ${error.message}`)
}

const configPath = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
let config
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'))
} catch (error) {
  transient(`Unable to read ${configPath}: ${error.message}`)
}
if (process.platform === 'linux' && !process.env.DISPLAY) {
  try {
    process.env.DISPLAY = ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
  } catch (error) {
    transient(`Unable to read the Xvfb display: ${error.message}`)
  }
}

const screenshotFailure = error => {
  if (error.name === 'TimeoutError' || /Target (?:page, context or browser )?has been closed|Browser has been closed/i.test(error.message)) {
    throw new TransientError(`Screenshot failed: ${error.message}`)
  }
  throw error
}

let browser
let exitCode = 0
try {
  try {
    browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 })
  } catch (error) {
    transient(`Browser launch failed: ${error.message}`)
  }

  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      ...(name === 'mobile' ? { isMobile: true, hasTouch: true } : {})
    }).catch(error => transient(`Unable to create ${name} context: ${error.message}`))

    const page = await context.newPage().catch(error => transient(`Unable to create ${name} page: ${error.message}`))
    page.setDefaultTimeout(30000)
    page.on('pageerror', error => console.error(`${name} page error: ${error.message}`))

    try {
      let response
      try {
        response = await page.goto(url, { waitUntil: 'load', timeout: 45000 })
      } catch (error) {
        transient(`Navigation to ${url} failed: ${error.message}`)
      }
      if (!response) transient(`No HTTP response from ${url}`)
      if (!response.ok()) {
        const status = response.status()
        if ([408, 429, 500, 502, 503, 504].includes(status)) transient(`HTTP ${status} loading ${url}`)
        throw new Error(`HTTP ${status} loading ${url}`)
      }

      await page.waitForFunction(() => {
        const loading = document.querySelector('#loading')
        return Boolean(window.__sunset) && (!loading || loading.classList.contains('hidden'))
      }, null, { timeout: 30000 })

      await page.evaluate(() => {
        if (!window.__sunset.state.started) window.__sunset.startGame()
      })
      await page.waitForFunction(() => (
        window.__sunset.state.started && window.__sunset.renderer.info.render.calls > 0
      ), null, { timeout: 15000 })
      await page.waitForTimeout(900)

      await page.screenshot({
        path: join(output, `final-${name}.png`),
        timeout: 30000
      }).catch(screenshotFailure)
      console.log(`Captured ${name} view: ${join(output, `final-${name}.png`)}`)
    } finally {
      await page.close().catch(() => {})
      await context.close().catch(() => {})
    }
  }
} catch (error) {
  console.error(error.stack || error.message || error)
  exitCode = error instanceof TransientError ? 75 : 1
} finally {
  try {
    await browser?.close()
  } catch (error) {
    console.error(`Browser close failed: ${error.message}`)
    if (exitCode === 0) exitCode = 75
  }
}

process.exitCode = exitCode
