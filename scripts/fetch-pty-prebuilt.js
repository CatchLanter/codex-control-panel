const fs = require('fs')
const https = require('https')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.join(__dirname, '..')
const pkgDir = path.join(
  root,
  'node_modules',
  '@homebridge',
  'node-pty-prebuilt-multiarch',
)

function download(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error('too many redirects'))
      return
    }
    https
      .get(url, (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume()
          resolve(download(response.headers.location, destination, redirects + 1))
          return
        }
        if (response.statusCode !== 200) {
          response.resume()
          reject(new Error(`download failed: HTTP ${response.statusCode}`))
          return
        }
        const file = fs.createWriteStream(destination)
        response.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
        file.on('error', reject)
      })
      .on('error', reject)
  })
}

async function main() {
  if (process.platform !== 'win32') {
    console.log('[ccp] non-Windows platform, skipping pty prebuilt fetch')
    return
  }
  if (!fs.existsSync(path.join(pkgDir, 'package.json'))) {
    console.log('[ccp] pty package not installed, skipping')
    return
  }

  const releaseDir = path.join(pkgDir, 'build', 'Release')
  const hasBinaries =
    fs.existsSync(path.join(releaseDir, 'conpty.node')) &&
    fs.existsSync(path.join(releaseDir, 'pty.node'))
  if (hasBinaries) {
    console.log('[ccp] pty prebuilt binaries already present')
    return
  }

  const version = JSON.parse(
    fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'),
  ).version
  const abi = process.versions.modules
  const archiveName = `node-pty-prebuilt-multiarch-v${version}-node-v${abi}-win32-x64.tar.gz`
  const url = `https://github.com/homebridge/node-pty-prebuilt-multiarch/releases/download/v${version}/${archiveName}`
  const tempArchive = path.join(os.tmpdir(), `ccp-${archiveName}`)

  console.log(`[ccp] fetching pty prebuilt binaries for node ABI ${abi}...`)
  await download(url, tempArchive)

  const extract = spawnSync(
    'tar.exe',
    ['-xzf', tempArchive, '-C', pkgDir],
    { stdio: 'inherit' },
  )
  if (extract.status !== 0) {
    throw new Error(`tar extraction failed with exit code ${extract.status}`)
  }

  const postInstall = spawnSync(
    process.execPath,
    [path.join(pkgDir, 'scripts', 'post-install.js')],
    { stdio: 'inherit' },
  )
  if (postInstall.status !== 0) {
    throw new Error(`pty post-install failed with exit code ${postInstall.status}`)
  }

  fs.rmSync(tempArchive, { force: true })
  console.log('[ccp] pty prebuilt binaries installed')
}

main().catch((error) => {
  console.error(`[ccp] pty prebuilt fetch failed: ${error.message}`)
  process.exit(1)
})
