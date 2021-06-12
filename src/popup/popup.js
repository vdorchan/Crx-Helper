console.log('popup.js')

document.getElementById('menu').onclick = function (e) {
  const { command } = e.target.dataset

  if (command === 'openOptionsPage') {
    chrome.runtime.openOptionsPage()
  }
}
