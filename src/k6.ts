// Module to setup k6
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import { Octokit } from "@octokit/rest";
import chmodr from 'chmodr';
import { renameSync } from 'fs-extra';
import { Arch, getPlatform } from "./platform";

interface SetupK6 {
    setupk6(version?: string): Promise<string>
}

const BaseK6DownloadURL = 'https://github.com/grafana/k6/releases/download/'

async function getLatestK6Version(): Promise<string> {
    let version = '';
    const octokit = new Octokit();
    const { data } = await octokit.repos.getLatestRelease({
        owner: 'grafana',
        repo: 'k6'
    })
    if (data.tag_name[0] === 'v') {
        version = data.tag_name.slice(1) // remove the 'v' prefix from the version string
    } else {
        version = data.tag_name
    }

    core.debug(`Latest k6 version is ${version}`)

    return version
}

/**
 * Adds the k6 binary in the PATH allowing to use `k6` directly in the workflow
 *
 * @param {string} extractedPath - The path where the downloaded k6 binary is located
 * @param {string} binaryName - The name of the downloaded k6 binary
 *
 * @returns {string} Complete path where the k6 binary is located and can be used from
 */
function addK6InPath(extractedPath: string, binaryName: string) {
    const downloadedK6BinaryPath = `${extractedPath}/${binaryName}`
    const expectedPath = `${downloadedK6BinaryPath}/k6`

    renameSync(downloadedK6BinaryPath, expectedPath)

    chmodr(expectedPath, 0o0755, err => {
        if (err) {
            throw err
        }
    })

    core.addPath(expectedPath)

    return expectedPath
}

class Linux implements SetupK6 {
    async setupk6(version?: string): Promise<string> {
        let binaryName = ``
        const platform = getPlatform()

        if (!version) {
            // Get the latest version
            version = await getLatestK6Version()
        }

        if (platform.arch === Arch.AMD64) {
            binaryName = `k6-v${version}-linux-amd64`
        } else if (platform.arch === Arch.ARM64) {
            binaryName = `k6-v${version}-linux-arm64`
        } else {
            throw new Error('Unsupported architecture for linux: ' + platform.arch)
        }

        const downloadUrl = `${BaseK6DownloadURL}v${version}/${binaryName}.tar.gz`

        core.debug(`Downloading k6 from ${downloadUrl}`)

        const download = await tc.downloadTool(downloadUrl)
        const extractedPath = await tc.extractTar(download)

        const k6executablePath = addK6InPath(extractedPath, binaryName);

        return k6executablePath;
    }
}

export async function setupk6(version?: string): Promise<string> {
    const platform = getPlatform();
    let k6SetupClass: SetupK6;

    if (platform.os === 'linux') {
        k6SetupClass = new Linux();
    } else {
        throw new Error(`Unsupported platform: ${platform.os}`);
    }

    return k6SetupClass.setupk6(version);
}