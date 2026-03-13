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
});
