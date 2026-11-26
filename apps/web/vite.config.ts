import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { defineConfig, type Plugin } from 'vite'

const COMPRESSIBLE_EXTS = new Set(['.js', '.css', '.html', '.svg', '.json'])

function precompressAssets(): Plugin {
  let outDir = 'dist'
  return {
    name: 'homedash-precompress',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    async closeBundle() {
      async function walk(dir: string): Promise<void> {
        const entries = await readdir(dir, { withFileTypes: true })
        await Promise.all(entries.map(async entry => {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            await walk(fullPath)
            return
          }
          const ext = extname(entry.name).toLowerCase()
          if (!COMPRESSIBLE_EXTS.has(ext)) return
          const raw = await readFile(fullPath)
          if (raw.byteLength < 256) return
          const gz = gzipSync(raw, { level: 9 })
          const br = brotliCompressSync(raw, {
            params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
          })
          await Promise.all([
            writeFile(`${fullPath}.gz`, gz),
            writeFile(`${fullPath}.br`, br),
          ])
        }))
      }
      await walk(outDir)
    },
  }
}

function writeExtensionManifest(origin: string, version: string): Plugin {
  let outDir = 'dist-extension'
  return {
    name: 'homedash-extension-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    async closeBundle() {
      const manifest = {
        manifest_version: 2,
        name: 'HomeDash New Tab',
        version,
        description: 'HomeDash homelab startpage as your Firefox New Tab.',
        icons: {
          48: 'favicon.svg',
          96: 'favicon.svg',
        },
        chrome_url_overrides: {
          newtab: 'index.html',
        },
        permissions: [`${origin}/*`],
        browser_specific_settings: {
          gecko: {
            id: 'homedash-newtab@frandm.dev',
            strict_min_version: '140.0',
            data_collection_permissions: {
              required: ['none'],
            },
          },
        },
      }
      await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isExtension = mode === 'extension'
  const extensionApiBaseUrl = (process.env.VITE_API_BASE_URL || 'https://startpage.frandm.dev/api').replace(/\/+$/, '')
  const extensionOrigin = isExtension ? new URL(extensionApiBaseUrl).origin : ''
  const extensionVersion = process.env.EXTENSION_VERSION || '1.0.0'

  return {
    base: isExtension ? './' : '/',
    plugins: isExtension
      ? [writeExtensionManifest(extensionOrigin, extensionVersion)]
      : [precompressAssets()],
    define: isExtension
      ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(extensionApiBaseUrl) }
      : undefined,
    resolve: {
      alias: [
        { find: /^react$/, replacement: 'preact/compat' },
        { find: /^react\/jsx-runtime$/, replacement: 'preact/compat/jsx-runtime' },
        { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/compat/jsx-dev-runtime' },
        { find: /^react-dom$/, replacement: 'preact/compat' },
        { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
        { find: /^react-dom\/test-utils$/, replacement: 'preact/compat/test-utils' },
      ],
    },
    build: {
      outDir: isExtension ? 'dist-extension' : 'dist',
      target: 'esnext',
      cssMinify: 'lightningcss',
      modulePreload: {
        polyfill: false,
        resolveDependencies(_filename, deps) {
          return deps.filter(dep => !dep.includes('EditOverlays') && !dep.includes('LoginScreen'))
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/preact')) {
              return 'vendor'
            }
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
