import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import { setupk6 } from './k6';

run()

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
    try {
        const k6_version = core.getInput('k6-version', { required: false })
        const browser = core.getInput('browser') === 'true'

        if (process.platform !== 'linux') {
            throw new Error('Unsupported platform: ' + process.platform)
        }
        if (process.arch === 'arm64' && browser) {
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

// TODO: Support MacOS and Windows
async function setupBrowser(): Promise<void> {
    const downloadKey = await tc.downloadTool('https://dl-ssl.google.com/linux/linux_signing_key.pub')
    await exec.exec(`sudo apt-key add ${downloadKey}`)
    await exec.exec(`sudo sh -c "echo 'deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main' >> /etc/apt/sources.list.d/google-chrome.list"`)
    await exec.exec('sudo apt-get update')
    await exec.exec('sudo apt-get install -y google-chrome-stable')
}