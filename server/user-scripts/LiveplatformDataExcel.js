// ==MoliHelperUserScript==
// @name           中控台导出Excel
// @description    淘宝中控台页面实时截图并一键导出直播数据
// @match          https://databot.taobao.com/tb/tblive
// @version        0.1.2
// @require        https://moli-static.oss-cn-hangzhou.aliyuncs.com/js-libs/babel-polyfill/polyfill.js
// @require        https://moli-static.oss-cn-hangzhou.aliyuncs.com/js-libs/exceljs.min.js
// @require        https://moli-static.oss-cn-hangzhou.aliyuncs.com/js-libs/idb.min.js
// @hidden         false
// ==/MoliHelperUserScript==

console.log('Hello', chrome)

// helpers
const {
  exportExcel,
  getBase64FromUrl,
  download,
  writeFile,
  captureScreen,
  captureFullScreen,
  mergeImages,
  styleInject,
  sleep,
  hide,
  show,
  formatTime,
  toast,
  toastError,
  previewImage
} = {
  async exportExcel(list) {
    const workbook = new ExcelJS.Workbook()

    workbook.created = new Date()
    workbook.modified = new Date()

    const worksheet = workbook.addWorksheet('sheet')

    const firstRow = list[0]

    if (!firstRow) {
      return toastError('无数据')
    }

    worksheet.columns = [...firstRow.keys()]
      .filter(k => !k.startsWith('_'))
      .map(key => ({
        header: key,
        key: key,
        width:
          key === '导出截图'
            ? 12
            : Math.max(key.length, firstRow.get(key)?.length || 0, 4) * 2 + 2
      }))

    for await (const [idx, rowData] of list.entries()) {
      const oneRow = {}
      let screenshot
      for (const [key, value] of rowData.entries()) {
        if (key === '导出截图') {
          screenshot = value
        } else {
          oneRow[key] = value
        }
      }
      const rowHeight = 100

      if (screenshot) {
        const { base64, width: imageWidth, height: imageHeight } = screenshot
        worksheet.addRow(oneRow)

        const image = workbook.addImage({
          base64,
          extension: 'jpeg'
        })

        const width = 72
        const height = (imageHeight / imageWidth) * width

        worksheet.addImage(image, {
          tl: { col: 0, row: idx + 1 },
          ext: { width, height }
        })
      }

      worksheet.eachRow(function (row, rowNumber) {
        row.height = rowHeight
      })
    }

    worksheet.getRow(1).eachCell((cell, rowNumber) => {
      worksheet.getColumn(rowNumber).alignment = {
        vertical: 'middle',
        horizontal: 'center'
      }
    })

    const buffer = await workbook.xlsx.writeBuffer()

    writeFile(`中控台列表.xlsx`, buffer)
  },

  async getBase64FromUrl(url) {
    const data = await fetch(url)
    const blob = await data.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.readAsDataURL(blob)
      reader.onloadend = () => {
        const base64data = reader.result
        resolve(base64data)
      }
    })
  },

  download(url, fileName) {
    let a = document.createElement('a')

    a.download = fileName
    a.href = url

    a.click()
  },

  writeFile(fileName, content) {
    let blob = new Blob([content], { type: 'text/plain' })
    download(URL.createObjectURL(blob), fileName)
  },

  captureScreen() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(
        {
          type: 'EXEC_FUNC_IN_BKGND',
          funcParams: {
            tabId: __GLOBAL_ACTIVE_TAB_ID__
          },
          func: (async ({ tabId }) => {
            const captured = await (() =>
              new Promise(resolve =>
                chrome.tabs.captureVisibleTab(null, {}, resolve)
              ))()

            return captured
          }).toString()
        },
        captured => {
          console.log({ captured })

          resolve(captured)
        }
      )
    })
  },

  async captureFullScreen() {
    hide(operationPanel, true)
    await prepareForCapture()

    let y = 0
    const pics = [{ src: await captureScreen(), x: 0, y }]

    void (function hideDom() {
      hide(document.getElementById('TbliveStickyHeader'))
      document.querySelector(
        '.f-tblive-TbliveModuleCard'
      ).previousSibling.style.minHeight = '453px'
      hide(document.querySelector('.glory-toast'))
    })()

    while (window.innerHeight + y < document.body.scrollHeight) {
      y += window.innerHeight
      window.scrollBy(0, window.innerHeight)
      await sleep(1000)
      pics.push({ src: await captureScreen(), x: 0, y })
    }

    const fullHeight = document.body.scrollHeight

    const diff = window.innerHeight - (fullHeight % window.innerHeight)

    pics[pics.length - 1].y -= diff

    void (function restoreShowDom() {
      show(document.getElementById('TbliveStickyHeader'))
      show(operationPanel, true)
      document.querySelector(
        '.f-tblive-TbliveModuleCard'
      ).previousSibling.style.minHeight = ''
      show(document.querySelector('.glory-toast'))
    })()

    const dpr = devicePixelRatio || 1

    for (const pic of pics) {
      pic.y *= dpr
    }

    const base64 = await mergeImages(pics, {
      height: fullHeight * dpr
    })

    return [base64, fullHeight]
  },

  mergeImages(sources = [], options = {}) {
    const defaultOptions = {
      format: 'image/jpeg',
      quality: 0.95,
      width: undefined,
      height: undefined,
      Canvas: undefined,
      crossOrigin: undefined
    }
    return new Promise(resolve => {
      options = Object.assign({}, defaultOptions, options)

      // Setup browser/Node.js specific variables
      const canvas = options.Canvas
        ? new options.Canvas()
        : window.document.createElement('canvas')
      const Image = options.Image || window.Image

      // Load sources
      const images = sources.map(
        source =>
          new Promise((resolve, reject) => {
            // Convert sources to objects
            if (source.constructor.name !== 'Object') {
              source = { src: source }
            }

            // Resolve source and img when loaded
            const img = new Image()
            img.crossOrigin = options.crossOrigin
            img.onerror = () => reject(new Error("Couldn't load image"))
            img.onload = () => resolve(Object.assign({}, source, { img }))
            img.src = source.src
          })
      )

      // Get canvas context
      const ctx = canvas.getContext('2d')

      // When sources have loaded
      resolve(
        Promise.all(images).then(images => {
          // Set canvas dimensions
          const getSize = dim =>
            options[dim] || Math.max(...images.map(image => image.img[dim]))
          canvas.width = getSize('width')
          canvas.height = getSize('height')

          // Draw images to canvas
          images.forEach(image => {
            ctx.globalAlpha = image.opacity ? image.opacity : 1
            return ctx.drawImage(image.img, image.x || 0, image.y || 0)
          })

          if (options.Canvas && options.format === 'image/jpeg') {
            // Resolve data URI for node-canvas jpeg async
            return new Promise((resolve, reject) => {
              canvas.toDataURL(
                options.format,
                {
                  quality: options.quality,
                  progressive: false
                },
                (err, jpeg) => {
                  if (err) {
                    reject(err)
                    return
                  }
                  resolve(jpeg)
                }
              )
            })
          }

          // Resolve all other data URIs sync
          return canvas.toDataURL(options.format, options.quality)
        })
      )
    })
  },

  styleInject(css, { insertAt } = {}) {
    if (!css || typeof document === 'undefined') return

    const head = document.head || document.getElementsByTagName('head')[0]
    const style = document.createElement('style')
    style.type = 'text/css'

    if (insertAt === 'top') {
      if (head.firstChild) {
        head.insertBefore(style, head.firstChild)
      } else {
        head.appendChild(style)
      }
    } else {
      head.appendChild(style)
    }

    if (style.styleSheet) {
      style.styleSheet.cssText = css
    } else {
      style.appendChild(document.createTextNode(css))
    }
  },

  sleep(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  hide(dom, removeDom) {
    if (!dom) return
    if (removeDom) {
      dom.style.display = 'none'
    } else {
      dom.style.visibility = 'hidden'
    }
  },

  show(dom, removeDom) {
    if (!dom) return
    if (removeDom) dom.style.display = ''
    else dom.style.visibility = 'visible'
  },

  formatTime(time) {
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
  },
  toast(text, isError) {
    const div = document.createElement('div')
    div.classList.add('notification', isError ? 'is-danger' : 'is-primary')
    div.style.position = 'fixed'
    div.style.left = '50%'
    div.style.transform = 'translateX(-50%)'
    div.style.top = '30px'
    div.style.boxShadow = '5px 5px 10px grey'
    div.style.padding = '10px'
    div.style.zIndex = '999999'
    div.style.transition = 'all 600ms'
    div.style.opacity = 0
    div.textContent = text
    document.body.appendChild(div)
    setTimeout(() => {
      div.style.opacity = 1
    }, 0)
    setTimeout(() => {
      document.body.removeChild(div)
    }, 1000 * 1)
  },
  toastError(text) {
    return toast(text, true)
  },
  previewImage(src) {
    const div = document.createElement('div')
    div.style.width = '100%'
    div.style.height = '100%'
    div.style.overflow = 'auto'
    div.style.background = 'rgba(0, 0, 0, 0.5)'
    div.style.position = 'fixed'
    div.style.top = 0
    div.style.left = 0
    div.style.zIndex = 9999
    div.innerHTML = `
<img style="width: 40vw; padding-top: 50px; margin-left: 30vw;" src="${src}" />
    `

    document.body.style.width = '100vw'
    document.body.style.height = '100vh'
    document.body.style.overflow = 'hidden'

    div.addEventListener('click', () => {
      document.body.removeChild(div)

      document.body.style.width = ''
      document.body.style.height = ''
      document.body.style.overflow = ''
    })
    document.body.appendChild(div)
  }
}

const STORAGE_KEY = 'MOLI_LIVEPLATFORM_EXCEL_LIST_STORAGE_KEY'

const $$ = document.querySelector.bind(document)
const liveCard = $$('.live-info-card')

// create panel
const operationPanel = document.createElement('div')
operationPanel.classList.add('operation-panel')
operationPanel.style.position = 'fixed'
operationPanel.style.right = 0
operationPanel.style.top = 0
operationPanel.style.zIndex = 9999

// panle buttons
const createButton = (text, parentNode = operationPanel, className = '') => {
  const button = document.createElement('button')
  button.innerText = text
  button.className = `button ${className}`
  parentNode.appendChild(button)

  return button
}

const prepareForCapture = async () => {
  window.scrollTo(0, 0)
  try {
    const preSallRadio = $$('.f-tblive-Radio .radio.false')
  
    if (preSallRadio) {
      preSallRadio.click()
    }

    const buttonExpand = document.querySelector(
      '#TbliveStickyHeader .expand-btn'
    )
    if (buttonExpand.textContent.includes('展开')) {
      buttonExpand.click()
    }
    await sleep(300)
  } catch (error) {
    console.log('prepareForCapture', error)
  }
}

// analysis dom and get the data
const getData = async () => {
  const data = new Map()

  await prepareForCapture()

  data.set('_liveId', /liveId=\d+/.exec(location.search)[0])
  data.set('导出截图', null)
  data.set('数据统计时间', formatTime(Date.now()))
  data.set('_id', Date.now())
  data.set(
    '开播时间',
    /\d[^-]+/.exec($$('.live-info-card .time').textContent)[0].trim()
  )
  data.set('主播', $$('.f-tblive-TbliveHeader .name').textContent)
  // data.set('直播封面图')
  data.set('标题', $$('.live-info-card .title')?.textContent?.trim())
  // data.set('直播链接')

  const [base64, height] = await captureFullScreen()

  data.set('导出截图', {
    base64,
    width: window.innerWidth,
    height
  })

  document.querySelectorAll('.f-tblive-MeasureBlock').forEach(block => {
    const title = block.querySelector('.name .text')?.textContent?.trim()
    const number = block.querySelector('.number')?.textContent?.trim()

    let noteTitle = block.querySelector('.note .text')?.textContent?.trim()
    const noteNnumber = block
      .querySelector('.note .number')
      ?.textContent?.trim()

    data.set(title, number)

    if (title === '观看次数') {
      data.set(noteTitle, noteNnumber)
    } else if (noteTitle) {
      if (noteNnumber?.includes('%')) {
        noteTitle = noteTitle.replace(/占比$/, '占比')
      }

      data.set(noteTitle, noteNnumber)
    }
  })

  return data
}

// dispatcher for data list
const dispatchLiveList = async (action, payload) => {
  console.log('dispatchLiveList', action, payload)
  const getLiveListFromStorage = async () => {
    let list
    try {
      list = await idb.get(STORAGE_KEY)
      list = JSON.parse(list)
      list = list.map(item => new Map(item))
    } finally {
      return list || []
    }
  }

  const updateTable = liveList => {
    const len = liveList?.length
    buttonShowPopover.innerText = '批量导出' + (len ? `（${len}）` : '')

    if (len) {
      show(dataTable, true)
      hide(dataTableNoData, true)
    } else {
      hide(dataTable, true)
      show(dataTableNoData, true)
    }

    const mapList = () =>
      liveList
        .map(
          live => `
<tr>
<td><img
  data-preview="true"
  src="${live.get('导出截图').base64}"
  width="100"
  height="100"
  style="object-fit: cover; cursor: pointer;"
  title="点击预览"
/></td>
<td style="text-align: left;">
  ${live.get('_liveId')}<br />
  ${live.get('标题')}
</td>
<td>${live.get('数据统计时间')}</td>
<td>
  <button
    class="button is-small is-delete"
    data-_id="${live.get('_id')}"
  >删除</button>
  </td>
</tr>`
        )
        .join('')

    dataTable.innerHTML = `
<thead>
  <tr style="text-align: left;">
    <th width="100">截图</th>
    <th width="200">标题</th>
    <th>添加时间</th>
    <th>操作</th>
  </tr>
</thead>
${mapList()}`
  }

  let newLiveList = await getLiveListFromStorage()

  switch (action) {
    case 'get':
      return newLiveList
    case 'delete':
      newLiveList = newLiveList.filter(live => live.get('_id') !== payload)
      break

    case 'deleteAll':
      newLiveList = []
      break

    case 'add':
      newLiveList = [...newLiveList, payload]
      break

    case 'update':
      break
    default:
      return newLiveList
  }

  await idb.set(STORAGE_KEY, JSON.stringify(newLiveList))
  updateTable(newLiveList)

  return newLiveList
}

// create panel buttons and bind events
const buttonExport = createButton('单次导出数据', operationPanel)
const buttonShowPopoverContainer = document.createElement('div')
buttonShowPopoverContainer.classList.add('popover-button')
operationPanel.appendChild(buttonShowPopoverContainer)
const buttonShowPopover = createButton('批量导出', buttonShowPopoverContainer)
buttonExport.onclick = async () => {
  try {
    await exportExcel([await getData()])
    toast('导出成功！')
  } catch (error) {
    toastError(`导出失败！${error.message}`)
  }
}
buttonShowPopoverContainer.onmouseenter = () => {
  show(dataTablePopover)
}
buttonShowPopoverContainer.onmouseleave = () => {
  hide(dataTablePopover)
}

// popover table
const dataTablePopover = document.createElement('div')
const dataTable = document.createElement('table')
const dataTableNoData = document.createElement('div')
const dataTableNotice = document.createElement('div')
const dataTableFooter = document.createElement('div')
const dataTableButtons = document.createElement('div')
dataTableFooter.appendChild(dataTableNotice)
dataTableFooter.appendChild(dataTableButtons)

dataTableFooter.className = 'footer'
dataTableButtons.className = 'footer-buttons'
dataTableNoData.innerText = '暂无数据，请先添加'
dataTableNoData.style.textAlign = 'center'
dataTableNoData.style.padding = '20px'
hide(dataTableNoData, true)

dataTableNotice.className = 'footer-notice'
dataTableNotice.textContent = '注意：截图时请勿操作页面'

const initPopoverDom = () => {
  dataTablePopover.className = 'popover'
  dataTablePopover.appendChild(dataTable)
  dataTablePopover.appendChild(dataTableNoData)
  buttonShowPopoverContainer.appendChild(dataTablePopover)
  dataTable.onclick = e => {
    if (e.target.classList.contains('is-delete')) {
      const { _id } = e.target.dataset
      dispatchLiveList('delete', +_id)
    }
  }

  const buttonClear = createButton('清空', dataTableButtons)
  const buttonAddToList = createButton('添加', dataTableButtons)
  const buttonBatchExport = createButton(
    '批量导出',
    dataTableButtons,
    'is-primary'
  )

  buttonClear.onclick = () => {
    dispatchLiveList('deleteAll')
  }

  buttonAddToList.onclick = async () => {
    await dispatchLiveList('add', await getData())

    toast('添加成功')
  }

  buttonBatchExport.onclick = async () => {
    let list = await dispatchLiveList('get')

    if (!list.length) {
      return toastError('没有可导出的数据！')
    }

    try {
      buttonBatchExport.textContent = '导出中...'
      buttonBatchExport.disabled = true
      await exportExcel(list)
      toast('导出成功！')
    } catch (error) {
      toastError(`导出失败！${error.message}`)
    } finally {
      buttonBatchExport.disabled = false
      buttonBatchExport.textContent = '批量导出'
    }
  }

  dataTablePopover.appendChild(dataTableFooter)
}

initPopoverDom()
dispatchLiveList('update')

operationPanel.addEventListener('click', e => {
  const { target } = e
  if (target.dataset.preview) {
    e.stopPropagation()
    previewImage(target.getAttribute('src'))
  }
})

// create dom and css
document.body.appendChild(operationPanel)
styleInject(`
.button,
.file-cta,
.file-name,
.input,
.pagination-ellipsis,
.pagination-link,
.pagination-next,
.pagination-previous,
.select select,
.textarea {
  -moz-appearance: none;
  -webkit-appearance: none;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 4px;
  box-shadow: none;
  display: inline-flex;
  font-size: 14px;
  height: 2.5em;
  justify-content: flex-start;
  line-height: 1.5;
  padding-bottom: calc(.5em - 1px);
  padding-left: calc(.75em - 1px);
  padding-right: calc(.75em - 1px);
  padding-top: calc(.5em - 1px);
  position: relative;
  vertical-align: top
}

.button:active,
.button:focus,
.file-cta:active,
.file-cta:focus,
.file-name:active,
.file-name:focus,
.input:active,
.input:focus,
.is-active.button,
.is-active.file-cta,
.is-active.file-name,
.is-active.input,
.is-active.pagination-ellipsis,
.is-active.pagination-link,
.is-active.pagination-next,
.is-active.pagination-previous,
.is-active.textarea,
.is-focused.button,
.is-focused.file-cta,
.is-focused.file-name,
.is-focused.input,
.is-focused.pagination-ellipsis,
.is-focused.pagination-link,
.is-focused.pagination-next,
.is-focused.pagination-previous,
.is-focused.textarea,
.pagination-ellipsis:active,
.pagination-ellipsis:focus,
.pagination-link:active,
.pagination-link:focus,
.pagination-next:active,
.pagination-next:focus,
.pagination-previous:active,
.pagination-previous:focus,
.select select.is-active,
.select select.is-focused,
.select select:active,
.select select:focus,
.textarea:active,
.textarea:focus {
  outline: 0
}

.button[disabled],
.file-cta[disabled],
.file-name[disabled],
.input[disabled],
.pagination-ellipsis[disabled],
.pagination-link[disabled],
.pagination-next[disabled],
.pagination-previous[disabled],
.select fieldset[disabled] select,
.select select[disabled],
.textarea[disabled],
fieldset[disabled] .button,
fieldset[disabled] .file-cta,
fieldset[disabled] .file-name,
fieldset[disabled] .input,
fieldset[disabled] .pagination-ellipsis,
fieldset[disabled] .pagination-link,
fieldset[disabled] .pagination-next,
fieldset[disabled] .pagination-previous,
fieldset[disabled] .select select,
fieldset[disabled] .textarea {
  cursor: not-allowed
}
.button {
  background-color: #fff;
  border-color: #dbdbdb;
  border-width: 1px;
  color: #363636;
  cursor: pointer;
  justify-content: center;
  padding-bottom: calc(.5em - 1px);
  padding-left: 1em;
  padding-right: 1em;
  padding-top: calc(.5em - 1px);
  text-align: center;
  white-space: nowrap
}

.button strong {
  color: inherit
}

.button .icon,
.button .icon.is-large,
.button .icon.is-medium,
.button .icon.is-small {
  height: 1.5em;
  width: 1.5em
}

.button .icon:first-child:not(:last-child) {
  margin-left: calc(-.5em - 1px);
  margin-right: .25em
}

.button .icon:last-child:not(:first-child) {
  margin-left: .25em;
  margin-right: calc(-.5em - 1px)
}

.button .icon:first-child:last-child {
  margin-left: calc(-.5em - 1px);
  margin-right: calc(-.5em - 1px)
}

.button.is-hovered,
.button:hover {
  border-color: #b5b5b5;
  color: #363636
}

.button.is-focused,
.button:focus {
  border-color: #3273dc;
  color: #363636
}

.button.is-focused:not(:active),
.button:focus:not(:active) {
  box-shadow: 0 0 0 .125em rgba(50, 115, 220, .25)
}

.button.is-active,
.button:active {
  border-color: #4a4a4a;
  color: #363636
}

.button.is-text {
  background-color: transparent;
  border-color: transparent;
  color: #4a4a4a;
  text-decoration: underline
}

.button.is-text.is-focused,
.button.is-text.is-hovered,
.button.is-text:focus,
.button.is-text:hover {
  background-color: #f5f5f5;
  color: #363636
}

.button.is-text.is-active,
.button.is-text:active {
  background-color: #e8e8e8;
  color: #363636
}
.button.is-small {
  font-size: .75rem
}

.button.is-small:not(.is-rounded) {
  border-radius: 2px
}
.popover-button {
  position: relative;
}
.popover {
  background: #fff;
  width: 540px;
  padding: 0 10px;
  border-radius: 10px;
  position: absolute;
  top: 100%;
  right: 0;
  visibility: hidden;
  max-height: 50vh;
  overflow: auto;
  z-index: 999999;
}
.pd-10 {
  padding: 10px;
}
.button.is-primary{background-color:#00d1b2;border-color:transparent;color:#fff}.button.is-primary.is-hovered,.button.is-primary:hover{background-color:#00c4a7;border-color:transparent;color:#fff}.button.is-primary.is-focused,.button.is-primary:focus{border-color:transparent;color:#fff}.button.is-primary.is-focused:not(:active),.button.is-primary:focus:not(:active){box-shadow:0 0 0 .125em rgba(0,209,178,.25)}.button.is-primary.is-active,.button.is-primary:active{background-color:#00b89c;border-color:transparent;color:#fff}.button.is-primary[disabled],fieldset[disabled] .button.is-primary{background-color:#00d1b2;border-color:transparent;box-shadow:none}.button.is-primary.is-inverted{background-color:#fff;color:#00d1b2}.button.is-primary.is-inverted.is-hovered,.button.is-primary.is-inverted:hover{background-color:#f2f2f2}.button.is-primary.is-inverted[disabled],fieldset[disabled] .button.is-primary.is-inverted{background-color:#fff;border-color:transparent;box-shadow:none;color:#00d1b2}.button.is-primary.is-loading::after{border-color:transparent transparent #fff #fff!important}.button.is-primary.is-outlined{background-color:transparent;border-color:#00d1b2;color:#00d1b2}.button.is-primary.is-outlined.is-focused,.button.is-primary.is-outlined.is-hovered,.button.is-primary.is-outlined:focus,.button.is-primary.is-outlined:hover{background-color:#00d1b2;border-color:#00d1b2;color:#fff}.button.is-primary.is-outlined.is-loading::after{border-color:transparent transparent #00d1b2 #00d1b2!important}.button.is-primary.is-outlined.is-loading.is-focused::after,.button.is-primary.is-outlined.is-loading.is-hovered::after,.button.is-primary.is-outlined.is-loading:focus::after,.button.is-primary.is-outlined.is-loading:hover::after{border-color:transparent transparent #fff #fff!important}.button.is-primary.is-outlined[disabled],fieldset[disabled] .button.is-primary.is-outlined{background-color:transparent;border-color:#00d1b2;box-shadow:none;color:#00d1b2}.button.is-primary.is-inverted.is-outlined{background-color:transparent;border-color:#fff;color:#fff}.button.is-primary.is-inverted.is-outlined.is-focused,.button.is-primary.is-inverted.is-outlined.is-hovered,.button.is-primary.is-inverted.is-outlined:focus,.button.is-primary.is-inverted.is-outlined:hover{background-color:#fff;color:#00d1b2}.button.is-primary.is-inverted.is-outlined.is-loading.is-focused::after,.button.is-primary.is-inverted.is-outlined.is-loading.is-hovered::after,.button.is-primary.is-inverted.is-outlined.is-loading:focus::after,.button.is-primary.is-inverted.is-outlined.is-loading:hover::after{border-color:transparent transparent #00d1b2 #00d1b2!important}.button.is-primary.is-inverted.is-outlined[disabled],fieldset[disabled] .button.is-primary.is-inverted.is-outlined{background-color:transparent;border-color:#fff;box-shadow:none;color:#fff}.button.is-primary.is-light{background-color:#ebfffc;color:#00947e}.button.is-primary.is-light.is-hovered,.button.is-primary.is-light:hover{background-color:#defffa;border-color:transparent;color:#00947e}.button.is-primary.is-light.is-active,.button.is-primary.is-light:active{background-color:#d1fff8;border-color:transparent;color:#00947e}.button.is-link{background-color:#3273dc;border-color:transparent;color:#fff}.button.is-link.is-hovered,.button.is-link:hover{background-color:#276cda;border-color:transparent;color:#fff}.button.is-link.is-focused,.button.is-link:focus{border-color:transparent;color:#fff}.button.is-link.is-focused:not(:active),.button.is-link:focus:not(:active){box-shadow:0 0 0 .125em rgba(50,115,220,.25)}.button.is-link.is-active,.button.is-link:active{background-color:#2366d1;border-color:transparent;color:#fff}.button.is-link[disabled],fieldset[disabled] .button.is-link{background-color:#3273dc;border-color:transparent;box-shadow:none}.button.is-link.is-inverted{background-color:#fff;color:#3273dc}.button.is-link.is-inverted.is-hovered,.button.is-link.is-inverted:hover{background-color:#f2f2f2}.button.is-link.is-inverted[disabled],fieldset[disabled] .button.is-link.is-inverted{background-color:#fff;border-color:transparent;box-shadow:none;color:#3273dc}.button.is-link.is-loading::after{border-color:transparent transparent #fff #fff!important}.button.is-link.is-outlined{background-color:transparent;border-color:#3273dc;color:#3273dc}.button.is-link.is-outlined.is-focused,.button.is-link.is-outlined.is-hovered,.button.is-link.is-outlined:focus,.button.is-link.is-outlined:hover{background-color:#3273dc;border-color:#3273dc;color:#fff}.button.is-link.is-outlined.is-loading::after{border-color:transparent transparent #3273dc #3273dc!important}.button.is-link.is-outlined.is-loading.is-focused::after,.button.is-link.is-outlined.is-loading.is-hovered::after,.button.is-link.is-outlined.is-loading:focus::after,.button.is-link.is-outlined.is-loading:hover::after{border-color:transparent transparent #fff #fff!important}.button.is-link.is-outlined[disabled],fieldset[disabled] .button.is-link.is-outlined{background-color:transparent;border-color:#3273dc;box-shadow:none;color:#3273dc}.button.is-link.is-inverted.is-outlined{background-color:transparent;border-color:#fff;color:#fff}.button.is-link.is-inverted.is-outlined.is-focused,.button.is-link.is-inverted.is-outlined.is-hovered,.button.is-link.is-inverted.is-outlined:focus,.button.is-link.is-inverted.is-outlined:hover{background-color:#fff;color:#3273dc}.button.is-link.is-inverted.is-outlined.is-loading.is-focused::after,.button.is-link.is-inverted.is-outlined.is-loading.is-hovered::after,.button.is-link.is-inverted.is-outlined.is-loading:focus::after,.button.is-link.is-inverted.is-outlined.is-loading:hover::after{border-color:transparent transparent #3273dc #3273dc!important}.button.is-link.is-inverted.is-outlined[disabled],fieldset[disabled] .button.is-link.is-inverted.is-outlined{background-color:transparent;border-color:#fff;box-shadow:none;color:#fff}.button.is-link.is-light{background-color:#eef3fc;color:#2160c4}.button.is-link.is-light.is-hovered,.button.is-link.is-light:hover{background-color:#e3ecfa;border-color:transparent;color:#2160c4}.button.is-link.is-light.is-active,.button.is-link.is-light:active{background-color:#d8e4f8;border-color:transparent;color:#2160c4}.button.is-info{background-color:#3298dc;border-color:transparent;color:#fff}.button.is-info.is-hovered,.button.is-info:hover{background-color:#2793da;border-color:transparent;color:#fff}.button.is-info.is-focused,.button.is-info:focus{border-color:transparent;color:#fff}.button.is-info.is-focused:not(:active),.button.is-info:focus:not(:active){box-shadow:0 0 0 .125em rgba(50,152,220,.25)}.button.is-info.is-active,.button.is-info:active{background-color:#238cd1;border-color:transparent;color:#fff}.button.is-info[disabled],fieldset[disabled] .button.is-info{background-color:#3298dc;border-color:transparent;box-shadow:none}
table td, table th {
  padding: 10px;
  border-bottom: 1px solid #eee;
  background: #fff;
}
.popover thead th { position: sticky; top: 0; z-index: 1; }
.popover tbody th { position: sticky; left: 0; }
.footer {
  position: sticky;
  bottom: 0;
  background: #fff;
  width: 100%;
}
.footer-notice {
  display: flex;
  justify-content: flex-end;
  padding-right: 10px;
  font-size: 12px;
}
.footer-buttons {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  left: 0;
  padding: 10px;
  margin: 0;
}
.button:not(:first-child) {
  margin-left: 5px;
}
.operation-panel {
  display: flex;
}
.notification {
  background-color: #f5f5f5;
  border-radius: 4px;
  position: relative;
  padding: 1.25rem 2.5rem 1.25rem 1.5rem
}

.notification a:not(.button):not(.dropdown-item) {
  color: currentColor;
  text-decoration: underline
}

.notification strong {
  color: currentColor
}

.notification code,
.notification pre {
  background: #fff
}

.notification pre code {
  background: 0 0
}

.notification>.delete {
  right: .5rem;
  position: absolute;
  top: .5rem
}

.notification .content,
.notification .subtitle,
.notification .title {
  color: currentColor
}
.notification.is-primary {
  background-color: #00d1b2;
  color: #fff
}
.notification.is-danger {
  background-color: #f14668;
  color: #fff
}
`)
