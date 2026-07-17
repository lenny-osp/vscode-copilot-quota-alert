import * as assert from 'assert';
import {
    getReleaseDownloadUrl,
    isNewerVersion,
    type GitHubRelease,
} from '../../update-checker';

suite('Update Checker Test Suite', () => {
    // -----------------------------------------------------------------------
    // isNewerVersion
    // -----------------------------------------------------------------------

    test('isNewerVersion returns true when latest is a higher patch', () => {
        assert.strictEqual(isNewerVersion('0.0.1', '0.0.2'), true);
    });

    test('isNewerVersion returns false when latest is a lower patch', () => {
        assert.strictEqual(isNewerVersion('0.0.2', '0.0.1'), false);
    });

    test('isNewerVersion returns false when versions are equal', () => {
        assert.strictEqual(isNewerVersion('0.0.1', '0.0.1'), false);
    });

    test('isNewerVersion returns false when current is higher major', () => {
        assert.strictEqual(isNewerVersion('1.0.0', '0.9.9'), false);
    });

    test('isNewerVersion returns true when latest has higher major', () => {
        assert.strictEqual(isNewerVersion('0.9.9', '1.0.0'), true);
    });

    test('isNewerVersion handles "v" prefix on latest', () => {
        assert.strictEqual(isNewerVersion('0.0.1', 'v0.0.2'), true);
    });

    test('isNewerVersion handles "v" prefix on current', () => {
        assert.strictEqual(isNewerVersion('v0.0.2', '0.0.1'), false);
    });

    test('isNewerVersion handles "v" prefix on both', () => {
        assert.strictEqual(isNewerVersion('v1.0.0', 'v1.0.1'), true);
    });

    test('isNewerVersion handles higher minor version', () => {
        assert.strictEqual(isNewerVersion('1.0.5', '1.1.0'), true);
    });

    test('isNewerVersion handles lower minor version', () => {
        assert.strictEqual(isNewerVersion('1.1.0', '1.0.5'), false);
    });

    test('isNewerVersion handles versions with different segment lengths', () => {
        // "1.0" is treated as "1.0.0"
        assert.strictEqual(isNewerVersion('1.0', '1.0.1'), true);
    });

    test('getReleaseDownloadUrl selects the latest release VSIX asset', () => {
        const release: GitHubRelease = {
            tag_name: 'v2.1.0',
            html_url: 'https://github.com/lenny-osp/vscode-copilot-quota-alert/releases/tag/v2.1.0',
            assets: [
                {
                    name: 'checksums.txt',
                    browser_download_url: 'https://github.com/example/checksums.txt',
                },
                {
                    name: 'copilot-quota-alert-v2.1.0.VSIX',
                    browser_download_url: 'https://github.com/lenny-osp/vscode-copilot-quota-alert/releases/download/v2.1.0/copilot-quota-alert-v2.1.0.vsix',
                },
            ],
        };

        assert.strictEqual(
            getReleaseDownloadUrl(release),
            release.assets?.[1].browser_download_url
        );
    });

    test('getReleaseDownloadUrl falls back to the GitHub release page', () => {
        const release: GitHubRelease = {
            tag_name: 'v2.1.0',
            html_url: 'https://github.com/lenny-osp/vscode-copilot-quota-alert/releases/tag/v2.1.0',
            assets: [],
        };

        assert.strictEqual(getReleaseDownloadUrl(release), release.html_url);
    });
});
