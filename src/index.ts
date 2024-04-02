import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'
import chmodr from 'chmodr'
import * as fs from 'fs-extra'

run()

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
    try {
        const k6_version = core.getInput('k6-version', { required: true })
        const browser = core.getInput('browser') === 'true'

        if (process.platform !== 'linux') {
            throw new Error('Unsupported platform: ' + process.platform)
        }

        if (process.arch === 'arm64' && !browser) {
            throw new Error('Browser is not supported on arm64')
        }

        await setupk6(k6_version)

        if (browser) {
            core.exportVariable('K6_BROWSER_ARGS', 'no-sandbox')
            await setupBrowser()
        }
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message)
    }
}

// TODO: Cache the k6 binary and add support for MacOS and Windows
async function setupk6(version: string): Promise<string> {
    let binaryName = ``
    if (process.arch === "x64") {
        binaryName = `k6-v${version}-linux-amd64`
    } else if (process.arch === "arm64") {
        binaryName = `k6-v${version}-linux-arm64`
    } else {
        throw new Error('Unsupported architecture: ' + process.arch)
    }

    const download = await tc.downloadTool(`https://github.com/grafana/k6/releases/download/v${version}/${binaryName}.tar.gz`)
    const extractedPath = await tc.extractTar(download)

    const extractedBinaryPath = `${extractedPath}/${binaryName}`
    const binaryPath = `${extractedPath}/k6`
    fs.renameSync(extractedBinaryPath, binaryPath)

    chmodr(binaryPath, 0o0755, err => {
        if (err) {
            throw err
        }
    })

    core.addPath(binaryPath)

    return binaryPath
}

// TODO: Support MacOS and Windows
async function setupBrowser(): Promise<void> {
    const downloadKey = await tc.downloadTool('https://dl-ssl.google.com/linux/linux_signing_key.pub')
    await exec.exec(`sudo apt-key add ${downloadKey}`)
    await exec.exec(`sudo sh -c "echo 'deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main' >> /etc/apt/sources.list.d/google-chrome.list"`)
    await exec.exec('sudo apt-get update')
    await exec.exec('sudo apt-get install -y google-chrome-stable')
}