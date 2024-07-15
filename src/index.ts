import * as core from '@actions/core';
import { initialiseBrowser } from './browser';
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

        await setupk6(k6_version)

        if (browser) {
            core.exportVariable('K6_BROWSER_ARGS', 'no-sandbox')
            await initialiseBrowser();
        }
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message)
    }
}
