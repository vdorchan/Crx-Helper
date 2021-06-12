import svelte from 'rollup-plugin-svelte'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'
import nodent from 'rollup-plugin-nodent'
import css from 'rollup-plugin-css-only'
import copy from 'rollup-plugin-copy'
import replace from '@rollup/plugin-replace'
import path from 'path'

const pkg = require('./package.json')

const production = !process.env.ROLLUP_WATCH

const __VERSION__ = pkg.version
const __CRX_NAME__ = '茉莉助手'
const __CRX_NAME_EN__ = 'Moli Helper'

const output = `dist/${__CRX_NAME_EN__}-${__VERSION__}`

const createOptionsPageConfig = () => {
  const _output = path.resolve(output, 'options')
  return {
    input: 'src/options/main.js',
    output: {
      sourcemap: true,
      format: 'iife',
      name: 'app',
      file: path.resolve(_output, 'options.js')
    },
    plugins: [
      copy({
        targets: [
          { src: 'src/options/index.html', dest: _output },
          { src: 'src/common/bluma.min.css', dest: _output },
        ]
      }),
      svelte({
        compilerOptions: {
          // enable run-time checks when not in production
          dev: !production
        }
      }),
      // we'll extract any component CSS out into
      // a separate file - better for performance
      css({ output: 'bundle.css' }),

      // If you have external dependencies installed from
      // npm, you'll most likely need these plugins. In
      // some cases you'll need additional configuration -
      // consult the documentation for details:
      // https://github.com/rollup/plugins/tree/master/packages/commonjs
      resolve({
        browser: true,
        dedupe: ['svelte']
      }),
      commonjs(),

      // If we're building for production (npm run build
      // instead of npm run dev), minify
      production && terser()
    ],
    watch: {
      clearScreen: false
    }
  }
}

const copyFiles = () => {
  return copy({
    targets: [
      { src: 'src/popup/index.html', dest: path.resolve(output, 'popup') },
      { src: 'src/images/**/*', dest: path.resolve(output, 'images') },
      { src: 'src/popup/popup.css', dest: path.resolve(output, 'popup') },
      {
        src: 'src/manifest.json',
        dest: output,
        transform: contents =>
          contents
            .toString()
            .replace(/__CRX_NAME__/g, `${__CRX_NAME__}`)
            .replace('__VERSION__', __VERSION__)
      }
    ]
  })
}

const getPlugins = () => {
  return [
    resolve(),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'runtime'
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify(
        process.env.ROLLUP_WATCH ? 'development' : 'production'
      )
    }),
    nodent(),

    production &&
      terser({
        compress: {
          pure_getters: true,
          unsafe: true,
          unsafe_comps: true,
          warnings: false
        }
      }),

    commonjs()
  ]
}

const createConfigs = () => {
  return [
    createOptionsPageConfig(),
    {
      input: 'src/background/background.js',
      output: {
        file: path.resolve(output, 'background/background.js'),
        format: 'umd',
        name: 'background',
        indent: false
      },
      plugins: [copyFiles(), ...getPlugins()],
      onwarn: function (warning, warn) {
        warning.code !== 'EVAL' && warn(warning)
      }
    },

    {
      input: 'src/popup/popup.js',
      output: {
        file: path.resolve(output, 'popup/popup.js'),
        format: 'umd',
        name: 'popup',
        indent: false
      },
      plugins: getPlugins()
    },

    {
      input: 'src/contentScript.js',
      output: {
        file: path.resolve(output, 'contentScript.js'),
        format: 'umd',
        name: 'contentScript',
        indent: false
      },
      // plugins: getPlugins()
    }
  ]
}

export default [...createConfigs()]
