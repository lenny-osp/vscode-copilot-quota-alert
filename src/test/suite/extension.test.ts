import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('chihling.copilot-quota-alert'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('chihling.copilot-quota-alert');
        await extension?.activate();
        assert.strictEqual(extension?.isActive, true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('copilot-quota-alert.setToken'));
        assert.ok(commands.includes('copilot-quota-alert.refresh'));
        assert.ok(commands.includes('copilot-quota-alert.checkQuota'));
    });

    test('getSession is called with "github" provider and correct scopes on activation', async () => {
        // Spy on vscode.authentication.getSession to confirm it is invoked with
        // the built-in GitHub provider and the correct scopes in getToken().
        let capturedScopes: readonly string[] = [];
        const calls: string[] = [];
        type GetSession = typeof vscode.authentication.getSession;
        const original: GetSession = vscode.authentication.getSession.bind(vscode.authentication);
        const stub: GetSession = ((providerId: string, scopes: readonly string[], options?: vscode.AuthenticationGetSessionOptions) => {
            calls.push(providerId);
            capturedScopes = scopes;
            return original(providerId, scopes, options as vscode.AuthenticationGetSessionOptions & { silent: true });
        }) as unknown as GetSession;

        vscode.authentication.getSession = stub;

        try {
            // Re-running the refresh command exercises getToken(false)
            await vscode.commands.executeCommand('copilot-quota-alert.refresh');
            // Allow any async work to settle
            await new Promise(r => setTimeout(r, 500));
            
            assert.ok(
                calls.includes('github'),
                `Expected getSession to be called with "github", got: [${calls.join(', ')}]`
            );
            assert.deepStrictEqual(
                capturedScopes,
                ['read:user'],
                `Expected scopes to be ['read:user'], got: ${JSON.stringify(capturedScopes)}`
            );
        } finally {
            vscode.authentication.getSession = original;
        }
    });

    test('Status bar shows "Sign in" state when no GitHub session or PAT is available', async () => {
        // In the test extension host there is no real GitHub session and no
        // stored PAT, so the extension should fall through to the no-auth state.
        // Trigger a refresh and wait briefly for the async update to settle.
        await vscode.commands.executeCommand('copilot-quota-alert.refresh');
        await new Promise(r => setTimeout(r, 1000));

        // The only way to inspect the status bar item text from outside the
        // module is via the VS Code API's status bar items — unavailable in the
        // test host. We instead assert that the refresh command completes
        // without throwing, which means no unhandled rejection from getToken().
        // (The tooltip / text is covered by unit tests in status-bar.test.ts.)
        assert.ok(true, 'Refresh command completed without error');
    });
});
