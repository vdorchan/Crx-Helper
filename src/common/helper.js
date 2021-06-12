export const chromeStorage = {
  get: keys =>
    new Promise(resolve =>
      chrome.storage.local.get(keys, res =>
        resolve(typeof keys === 'string' ? res[keys] : res)
      )
    ),
  set: (key, value) =>
    new Promise(resolve =>
      chrome.storage.local.set({ [key]: value }, () => resolve())
    ),
  remove: (key, value) =>
    new Promise(resolve =>
      chrome.storage.local.remove({ key: value }, () => resolve())
    )
}

export const fetchText = url =>
  new Promise(resolve =>
    fetch(url, { cache: 'no-store' })
      .then(res => res.text())
      .then(resolve)
  )

export const fetchJson = url =>
  new Promise(resolve =>
    fetch(url)
      .then(res => res.json())
      .then(resolve)
  )

export const getStringBetweenTags = (string, startTag, endTag) => {
  const d = string.indexOf(startTag)
  if (-1 == d) return ''
  if (!endTag) return string.substr(d + startTag.length)
  endTag = string.substr(d + startTag.length).indexOf(endTag)
  return -1 == endTag ? '' : string.substr(d + startTag.length, endTag)
}

export const createUrlMatcher = pattern => {
  const ALL_SCHEMES = {}
  function getParts(pattern) {
    if (pattern === '<all_urls>') {
      return {
        scheme: ALL_SCHEMES,
        host: '*',
        path: '*'
      }
    }

    const matchScheme = '(\\*|http|https|file|ftp)'
    const matchHost = '(\\*|(?:\\*\\.)?(?:[^/*]+))?'
    const matchPath = '(.*)?'
    const regex = new RegExp(
      '^' + matchScheme + '://' + matchHost + '(/)' + matchPath + '$'
    )

    const result = regex.exec(pattern)
    if (!result) {
      throw Error('Invalid pattern')
    }

    return {
      scheme: result[1],
      host: result[2],
      path: result[4]
    }
  }
  const parts = getParts(pattern)
  let str = '^'

  // check scheme
  if (parts.scheme === ALL_SCHEMES) {
    str += '(http|https|ftp|file)'
  } else if (parts.scheme === '*') {
    str += '(http|https)'
  } else {
    str += parts.scheme
  }

  str += '://'

  // check host
  if (parts.host === '*') {
    str += '.*'
  } else if (parts.host.startsWith('*.')) {
    str += '.*'
    str += '\\.?'
    str += parts.host.substr(2).replace(/\./g, '\\.')
  } else if (parts.host) {
    str += parts.host
  }

  // check path
  if (!parts.path) {
    str += '/?'
  } else if (parts.path) {
    str += '/'
    str += parts.path.replace(/[?.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  }

  str += '$'

  const regex = new RegExp(str)
  return function matchUrl(url) {
    return regex.test(url)
  }
}
export const genExecCode = (func, params) =>
  `(${func})(${JSON.stringify(params)})`

export const any2Array = n => (Array.isArray(n) ? n : n ? [n] : [])

export const insertScript = (document, { src, code }) => {
  console.log('insertScript', { src, code })
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.onload = resolve
    script.onerror = reject
    if (src) {
      script.src = src
    } else if (code) {
      script.textContent = code
    }
    document.body.appendChild(script)
  })
}

export function formatTime(time) {
  var date = new Date(time)
  var year = date.getFullYear()
  var month = date.getMonth() + 1
  var days = date.getDate()
  var hours = date.getHours()
  var mins = date.getMinutes()
  var secs = date.getSeconds()

  return [
    `${year}-${fillZero(month)}-${fillZero(days)}`,
    `${fillZero(hours)}:${fillZero(mins)}:${fillZero(secs)}`
  ].join(' ')

  function fillZero(value) {
    return ('0' + value).slice(-2)
  }
}