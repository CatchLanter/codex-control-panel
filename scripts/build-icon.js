const fs = require('fs')
const os = require('os')
const path = require('path')
const pngToIco = require('png-to-ico').default

const sizes = [16, 24, 32, 48, 64, 128, 256]
const filePaths = sizes.map((size) =>
  path.join(os.tmpdir(), `ccp-icon-${size}.png`),
)

pngToIco(filePaths)
  .then((ico) => {
    const output = path.join(__dirname, '..', 'build', 'icon.ico')
    fs.writeFileSync(output, ico)
    console.log(`icon.ico written: ${ico.length} bytes`)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
