import {
  chromeStorage,
  createUrlMatcher,
  getStringBetweenTags,
  genExecCode,
  any2Array,
  insertScript,
  fetchText
} from './common/helper'
import { USER_SCRIPTS, USER_SCRIPTS_OPTIONS, MSG_TYPE } from './common/constant'

const insertUserScripts_old = async (userScripts, userScriptsOptions) => {
  const url = location.href.replace(location.search, '')
  const { userScriptDisabled } = userScriptsOptions

  const availableUserScripts = userScripts.filter(
    s => !s.hidden && !userScriptDisabled[s.name]
  )

  console.log({ availableUserScripts })

  for (const userScript of availableUserScripts) {
    const matchers = any2Array(userScript.match).map(m => createUrlMatcher(m))
    console.log(
      { matchers },
      matchers.some(m => m(url))
    )

    if (matchers.some(m => m(url))) {
      console.log('match url succeed')

      try {
        for (const js of any2Array(userScript.require)) {
          await insertScript(document, { src: js })
        }
        await executeCode(userScript.code)
      } catch (error) {
        console.error('insert script error', error)
      }
    }
  }
}

const getScriptCodes = async (userScripts, userScriptsOptions) => {
  const url = location.href.replace(location.search, '')
  const { userScriptDisabled } = userScriptsOptions

  const availableUserScripts = userScripts.filter(
    s => !s.hidden && !userScriptDisabled[s.name]
  )

  const scriptCodes = []

  console.log({ availableUserScripts })

  for (const userScript of availableUserScripts) {
    const matchers = any2Array(userScript.match).map(m => createUrlMatcher(m))

    if (matchers.some(m => m(url))) {
      console.log('match url succeed')
      let scriptCode = ''

      try {
        for (const js of any2Array(userScript.require)) {
          scriptCode += await fetchText(js)
          // await insertScript(document, { src: js })
        }
        // await executeCode(userScript.code)
        scriptCode += userScript.code

        scriptCodes.push(scriptCode)
      } catch (error) {
        console.error('insert script error', error)
      }
    }
  }

  return scriptCodes
}

Promise.all([
  chromeStorage.get(USER_SCRIPTS),
  chromeStorage.get(USER_SCRIPTS_OPTIONS)
]).then(async ([userScripts, userScriptsOptions]) => {
  const scriptCodes = await getScriptCodes(userScripts, userScriptsOptions)

  for (const scriptCode of scriptCodes) {
    executeCode(scriptCode)
  }
})

function executeCode(code) {
  console.log('executeCode', { code })
  chrome.runtime.sendMessage({
    type: 'EXEC_FUNC_IN_BKGND',
    funcParams: {
      tabId: __GLOBAL_ACTIVE_TAB_ID__,
      code
    },
    func: (({ tabId, code }) => {
      chrome.tabs.executeScript(tabId, {
        code
      })
    }).toString()
  })
}
