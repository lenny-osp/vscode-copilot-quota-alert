import * as assert from 'assert';
import { isNewerVersion } from '../../update-checker';

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
});
