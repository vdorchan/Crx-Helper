<script>
  import { chromeStorage, formatTime } from '../common/helper'
  import {
    USER_SCRIPTS,
    USER_SCRIPTS_OPTIONS,
    MSG_TYPE
  } from '../common/constant'

  let userScripts = []
  let userScriptsOptions = {
    userScriptDisabled: {},
    lastUpdate: null
  }

  chromeStorage.get(USER_SCRIPTS_OPTIONS).then(res => {
    if (res) {
      userScriptsOptions = {
        ...userScriptsOptions,
        ...res
      }
    }
  })

  function onSwitchChange(checked, userScriptName) {
    userScriptsOptions.userScriptDisabled = {
      ...userScriptsOptions.userScriptDisabled,
      [userScriptName]: !checked
    }

    chromeStorage.set(USER_SCRIPTS_OPTIONS, {
      ...userScriptsOptions,
      userScriptDisabled: userScriptsOptions.userScriptDisabled
    })
  }

  function updateUserScripts(showAlert = true) {
    chrome.runtime.sendMessage({ type: MSG_TYPE.UPDATE_USER_SCRIPTS }, res => {
      userScripts = res.userScripts.filter(u => !u.hidden)
      userScriptsOptions = res.userScriptsOptions

      setTimeout(() => {
        showAlert && alert('更新成功！')
      }, 0)
    })
  }

  updateUserScripts(false)
</script>

<main>
  <div class="content">
    <h1 class="has-text-primary">茉莉助手</h1>

    <table class="table">
      {#each userScripts as script}
        <tr>
          <td class="is-vcentered">
            <div class="intro is-size-5">
              <span class="tag mr-2">{script.version}</span>
              <span class="mr-2">
                {script.name}
              </span>
              <span class="has-text-grey is-size-6">{script.description}</span>
            </div>
          </td>
          <td>
            <label class="switch">
              <input
                type="checkbox"
                checked={!userScriptsOptions.userScriptDisabled[script.name]}
                on:change={e => onSwitchChange(e.target.checked, script.name)}
              />
              <span class="slider" />
            </label>
          </td>
        </tr>
      {/each}
    </table>

    <div style="display: flex;justify-content: flex-end;align-items: flex-end;">
      <div class="has-text-grey is-small mr-4">
        最后更新时间：{formatTime(userScriptsOptions.lastUpdate)}
      </div>
      <button class="button is-primary is-light" on:click={updateUserScripts}>
        更新脚本
      </button>
    </div>
  </div>
</main>

<style>
  :root {
    --primary-color: #00d1b2;
  }
  main {
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }
  .content {
    max-width: 1000px;
    margin: 0 auto;
  }

  .intro {
    display: flex;
    align-items: center;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 60px;
    height: 34px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    -webkit-transition: 0.4s;
    transition: 0.4s;
    border-radius: 34px;
  }

  .slider:before {
    position: absolute;
    content: '';
    height: 26px;
    width: 26px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    -webkit-transition: 0.4s;
    transition: 0.4s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: var(--primary-color);
  }

  input:checked + .slider {
    box-shadow: 0 0 1px var(--primary-color);
  }

  input:checked + .slider:before {
    -webkit-transform: translateX(26px);
    -ms-transform: translateX(26px);
    transform: translateX(26px);
  }
</style>
