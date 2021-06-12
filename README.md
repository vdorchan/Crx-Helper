 <!-- no toc -->
# Moli Helper

- [Userscript Header](#userscript-header)
  - [@name](#name)
  - [@description](#description)
  - [@match](#match)
  - [@version](#version)
  - [@require](#require)
  - [@hidden](#hidden)
- [开发](#开发)

## Userscript Header

脚本头部属性设置，`==MoliHelperUserScript==` 开始获取，直到 `==/MoliHelperUserScript==`。

```javascript
// ==MoliHelperUserScript==
// @name           Demo
// @description    This is a Demo.
// ...
// ==/MoliHelperUserScript==
```

### @name

脚本名字。

### @description

简短的脚本描述说明。

### @match

脚本运行的页面 url 通配符，如 `https://*.baowenonline.com/`，具体可参考[这里](https://developer.chrome.com/docs/extensions/mv2/match_patterns/)。

可使用多次匹配多个 url。

```javascript
// @match  https://*.baowenonline.com/
// @match  https://*.google.com/
```

### @version

脚本版本号。

### @require

引入 js 文件，将在脚本运行前顺序加载。可使用多次匹配多个 js 文件。

```javascript
// @require   https://cdn.jsdelivr.net/npm/lodash@4.17.20/lodash.min.js
// @require   https://code.jquery.com/jquery-3.5.1.min.js
```

### @hidden

是否在用户脚本（功能）管理隐藏

## 开发