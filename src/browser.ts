// Module to verify and setup the browser
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import { OS, getPlatform } from './platform';

interface Browser {
    checkChromeInstalled(): Promise<boolean>
    setupBrowser(): Promise<void>
}

/**
 * Check if the browser is installed
 *
 * @param {string} command - The command to check if the browser is installed
 * @param {string[]} args - The arguments to pass to the command
 * @param {string} checkString - The string to check in the output of the command
 *
 * @return {*}  {Promise<boolean>} - Returns true if the browser is installed, false otherwise
 */
async function checkIfBrowserInstalled(command: string, args: string[], checkString: string): Promise<boolean> {
    let myOutput = '', myError = '', options = {
        listeners: {
            stdout: (data: Buffer) => {
                myOutput += data.toString();
            },
            stderr: (data: Buffer) => {
                myError += data.toString();
            }
        }
    };
    try {
        await exec.exec(command, args, options);

        core.debug(`~checkIfBrowserInstalled~ Output: ${myOutput}`);
        core.debug(`~checkIfBrowserInstalled~ Error: ${myError}`);
    } catch (error) {
        core.error(`Error in checking chrome version: ${error}`);
        return false;
    }

    if (myOutput.includes(checkString)) {
        return true;
    }

    return false;
}

class Macos implements Browser {
    async checkChromeInstalled(): Promise<boolean> {
        // Check for Chrome.app in the standard location where Homebrew installs it
        // Use ls to check if the directory exists (more reliable than mdfind which depends on Spotlight indexing)
        return await checkIfBrowserInstalled('ls', ['-d', '/Applications/Google Chrome.app'], 'Google Chrome.app');
    }

    async setupBrowser(): Promise<void> {
        await exec.exec('brew', ['install', '--cask', 'google-chrome']);
    }
}

class Windows implements Browser {
    async checkChromeInstalled(): Promise<boolean> {
        return await checkIfBrowserInstalled('choco', ['list', '-i'], 'Google Chrome|');
    }

    async setupBrowser(): Promise<void> {
        await exec.exec('choco', ['install', 'googlechrome', '-y']);
    }
}

class Linux implements Browser {
    async checkChromeInstalled(): Promise<boolean> {
        return await checkIfBrowserInstalled('google-chrome', ['--version'], 'Google Chrome');
    }

    async setupBrowser(): Promise<void> {
        const downloadKey = await tc.downloadTool('https://dl-ssl.google.com/linux/linux_signing_key.pub')
        await exec.exec(`sudo apt-key add ${downloadKey}`)
        await exec.exec(`sudo sh -c "echo 'deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main' >> /etc/apt/sources.list.d/google-chrome.list"`)
        await exec.exec('sudo apt-get update')
        await exec.exec('sudo apt-get install -y google-chrome-stable')
    }
}


export async function initialiseBrowser(): Promise<void> {
    const platform = getPlatform();
    let browserSetupClass: Browser;

    if (platform.os === OS.DARWIN) {
        browserSetupClass = new Macos();
    } else if (platform.os === OS.LINUX) {
        browserSetupClass = new Linux();
    } else if (platform.os === OS.WINDOWS) {
        browserSetupClass = new Windows();
    } else {
        throw new Error(`Unsupported platform: ${platform.os}`);
    }

    // Check if browser is already installed
    const isBrowserInstalled = await browserSetupClass.checkChromeInstalled();

    if (isBrowserInstalled) {
        core.info('Browser is already installed, skipping installation');
        return;
    }

    // Install browser
    core.info('Installing browser');
    await browserSetupClass.setupBrowser();

    // Check if browser is installed
    const isBrowserInstalledAfterSetup = await browserSetupClass.checkChromeInstalled();
    if (!isBrowserInstalledAfterSetup) {
        throw new Error('Failed to install browser');
    }
}