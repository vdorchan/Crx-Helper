// ==MoliHelperUserScript==
// @name           HelloMoliHelperUserScript
// @description    这是一个示例
// @match          https://*.baowenonline.com/
// @match          https://*.google.com/
// @match          https://*.baidu.com/
// @version        1.0.6
// @require        https://moli-static.oss-cn-hangzhou.aliyuncs.com/js-libs/lodash.min.js
// @hidden         true
// ==/MoliHelperUserScript==

const toast = text => {
  const div = document.createElement('div')
  div.style.background = 'white'
  div.style.color = 'black'
  div.style.fontSize = '20px'
  div.style.position = 'fixed'
  div.style.left = '50%'
  div.style.transform = 'translateX(-50%)'
  div.style.top = '30px'
  div.style.boxShadow = '5px 5px 10px grey'
  div.style.padding = '30px'
  div.style.background = 'yellow'
  div.style.zIndex = '999999'
  div.textContent = text
  document.body.appendChild(div)
  setTimeout(() => {
    document.body.removeChild(div)
  }, 1000 * 5)
}

toast('Toast From Hello Moli Helper User Script!')

console.log('Hello Moli Helper User Script')
