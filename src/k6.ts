// Module to setup k6
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import { Octokit } from "@octokit/rest";
import chmodr from 'chmodr';
import { renameSync } from 'fs-extra';
import { Arch, getPlatform, OS } from "./platform";

const BaseK6DownloadURL = 'https://github.com/grafana/k6/releases/download'
const SUPPORTED_OS_TO_ARCH_MAP: { [key: string]: Arch[] } = {
    [OS.LINUX]: [Arch.AMD64, Arch.ARM64],
    [OS.DARWIN]: [Arch.AMD64, Arch.ARM64],
}

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
 * Downloads and extracts the k6 binary for the given version, OS and architecture
 *
 * @param {string} version - The version of k6 to download
 * @param {OS} os - The OS for which to download the k6 binary
 * @param {Arch} architecture - The architecture for which to download the k6 binary
 * @return {*}  {Promise<[string, string]>} The path where the k6 binary is extracted and the name of the binary
 */
async function downloadAndExtractK6Binary(version: string, os: OS, architecture: Arch): Promise<[string, string]> {
    const k6BinaryName = `k6-v${version}-${os}-${architecture}`
    const zipExtension = os === OS.LINUX ? 'tar.gz' : 'zip'
    const downloadUrl = `${BaseK6DownloadURL}/v${version}/${k6BinaryName}.${zipExtension}`

    core.debug(`Downloading k6 from ${downloadUrl}`)


    const download = await tc.downloadTool(downloadUrl)
    const extractedPath = await tc.extractTar(download)

    return [extractedPath, k6BinaryName]
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
    // Rename .../k6-vX.Y.Z-OS-ARCH to .../k6
    const downloadedK6BinaryPath = `${extractedPath}/${binaryName}`
    const expectedPath = `${extractedPath}/k6`

    renameSync(downloadedK6BinaryPath, expectedPath)

    chmodr(expectedPath, 0o0755, err => {
        if (err) {
            throw err
        }
    })

    core.addPath(expectedPath)

    return expectedPath
}

export async function setupk6(version?: string): Promise<string> {
    const platform = getPlatform();

    core.debug(`Setting up k6 for ${platform.os} ${platform.arch}`)

    if (!(platform.os in SUPPORTED_OS_TO_ARCH_MAP)) {
        throw new Error(`Unsupported platform: ${platform.os}`);
    }

    const supportedArchitectures = SUPPORTED_OS_TO_ARCH_MAP[platform.os];

    if (!supportedArchitectures.includes(platform.arch)) {
        throw new Error(`Unsupported architecture: ${platform.arch}. Supported architectures for ${platform.os} are: ${supportedArchitectures}`);
    }

    if (!version) {
        // Get the latest version
        version = await getLatestK6Version()
    }

    const [extractedPath, binaryName] = await downloadAndExtractK6Binary(version, platform.os, platform.arch)

    const k6executablePath = addK6InPath(extractedPath, binaryName);

    return k6executablePath;
}