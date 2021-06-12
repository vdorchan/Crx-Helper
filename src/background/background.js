import {
  chromeStorage,
  fetchText,
  fetchJson,
  getStringBetweenTags
} from '../common/helper'
import {
  MSG_TYPE,
  USER_SCRIPTS,
  DEFAULT_CONTENT_SCRIPT,
  USER_SCRIPTS_OPTIONS
} from '../common/constant'

const isProd = process.env.NODE_ENV === 'production'

const SERVER_PATH = isProd
  ? 'https://moli-static.oss-cn-hangzhou.aliyuncs.com/moli-helper'
  : 'http://127.0.0.1:9999'

const bgkd = (() => {
  class Bgkd {
    /**
     * Convert header string to object config.
     * @param {string} header
     */
    getConfigFromHeader(header) {
      header = header.replace(/\t/g, '    ')
      header = header.replace(/\r/g, '\n')
      header = header.replace(/\n\n+/g, '\n')
      header = header.replace(/[^|\n][ \t]+\/\//g, '//')
      const config = {}
      header
        .split('\n')
        .filter(l => l)
        .forEach(l => {
          const str = l
            .replace(/^[\t\s]*\/\//gi, '')
            .replace(/^[\t\s]*/gi, '')
            .replace(/\s\s+/gi, ' ')

          if (str) {
            let [_, key, value] = str.match(
              new RegExp('^@' + '([a-zA-Z]+)' + '[\\t\\s]' + '(.*)', 'i')
            )

            try {
              value = JSON.parse(value)
            } catch (error) {}

            const existValue = config[key]
            if (existValue && typeof existValue === 'string') {
              config[key] = [existValue]
            }

            if (Array.isArray(config[key])) {
              config[key].push(value)
            } else {
              config[key] = value
            }
          }
        })

      return config
    }

    /**
     * Get the default content script of extension.
     */
    async getContentScript() {
      return chromeStorage.get(DEFAULT_CONTENT_SCRIPT)
    }

    /**
     * Cache user script list
     */
    async updateUserScripts() {
      const userScripts = await fetchJson(`${SERVER_PATH}/userScripts.json`)
      console.log({ userScripts })

      const userScriptsToCache = []

      for (const { url: userScriptUrl } of userScripts) {
        const userScript = await fetchText(SERVER_PATH + userScriptUrl)

        const header = getStringBetweenTags(
          userScript.replace(/(\r\n|\n|\r)/gm, '\n'),
          '==MoliHelperUserScript==',
          '==/MoliHelperUserScript=='
        )

        const config = this.getConfigFromHeader(header)

        userScriptsToCache.push({
          ...config,
          code: userScript
        })
      }

      chromeStorage.set(USER_SCRIPTS, userScriptsToCache)

      const userScriptsOptions = {
        userScriptDisabled: {},
        lastUpdate: Date.now()
      }
      chromeStorage.set(USER_SCRIPTS_OPTIONS, userScriptsOptions)

      const contentScriptCode = await fetchText(
        isProd ? `${SERVER_PATH}/contentScript.js` : '../contentScript.js'
      )

      chromeStorage.set(DEFAULT_CONTENT_SCRIPT, contentScriptCode)

      console.log({ userScripts, userScriptsToCache })
      return { userScripts: userScriptsToCache, userScriptsOptions }
    }

    autoUpdate() {
      chrome.alarms.create('autoUpdate', {
        periodInMinutes: 60
      })

      chrome.alarms.onAlarm.addListener(alarm => {
        console.log('onAlarm', { alarm })
        if (alarm.name === 'autoUpdate') {
          this.updateUserScripts()
        }
      })
    }

    /**
     * Add some listeners for extension.
     */
    addCrxListeners() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('received message', { message, sender })

        const { type: msgType } = message

        switch (msgType) {
          case MSG_TYPE.EXEC_FUNC_IN_BKGND:
            try {
              const func = Function(`return ${message.func}`)()
              // res = func && (await func(message.funcParams))
              if (func) {
                func(message.funcParams).then(res => sendResponse(res))
              }
            } catch (error) {
              console.log('error during execute function', error)
            }
            break

          case MSG_TYPE.UPDATE_USER_SCRIPTS:
            this.updateUserScripts().then(res => sendResponse(res))
            break
        }

        return true
      })

      chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        console.log(
          'chrome.tabs.onUpdated',
          { tabId, changeInfo, tab },
          String(changeInfo.status).toLowerCase() === 'complete' &&
            /^(http(s)?|file):\/\//.test(tab.url)
        )
        // Inject the content script.
        if (
          String(changeInfo.status).toLowerCase() === 'complete' &&
          /^(http(s)?|file):\/\//.test(tab.url)
        ) {
          chrome.tabs.executeScript(tabId, {
            code: `window.__GLOBAL_ACTIVE_TAB_ID__=${tabId}`
          })
          const code = await this.getContentScript()

          if (code) {
            console.log('ah')
            chrome.tabs.executeScript(tabId, { code })
          }
        }
      })

      chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
        chrome.runtime.openOptionsPage()
        if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
        }
      })
    }

    init() {
      this.updateUserScripts()
      this.addCrxListeners()
      this.autoUpdate()
    }
  }
  return new Bgkd()
})()

bgkd.init()
