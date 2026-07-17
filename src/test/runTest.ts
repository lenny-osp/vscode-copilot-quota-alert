import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    // macOS limits Unix-domain socket paths to 103 characters. GitHub Actions
    // checkouts are long enough that VS Code's default .vscode-test/user-data
    // IPC socket can exceed that limit, so use a short temporary profile.
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqa-'));

    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [`--user-data-dir=${userDataDir}`],
        });
    } catch (err) {
        console.error('Failed to run tests');
        process.exitCode = 1;
    } finally {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    }
}

main();
