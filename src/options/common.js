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
