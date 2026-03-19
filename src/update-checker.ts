/**
 * Update checker for the Copilot Quota Alert extension.
 *
 * Periodically checks the GitHub Releases API for a newer version
 * and shows a non-intrusive notification with an "Install" action
 * that opens the VS Code Marketplace page.
 */

import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTENSION_ID = "chihling.copilot-quota-alert";
const GITHUB_RELEASES_URL =
    "https://api.github.com/repos/lenny-osp/vscode-copilot-quota-alert/releases/latest";
const MARKETPLACE_URL =
    "https://marketplace.visualstudio.com/items?itemName=chihling.copilot-quota-alert";
const DISMISSED_VERSION_KEY = "copilot-quota-alert.lastDismissedVersion";

// ---------------------------------------------------------------------------
// Types and State
// ---------------------------------------------------------------------------

let latestDiscoveredVersion: string | undefined;

export function getLatestDiscoveredVersion(): string | undefined {
    return latestDiscoveredVersion;
}

export interface GitHubRelease {
    tag_name: string;
    html_url: string;
}

// ---------------------------------------------------------------------------
// Version comparison
// ---------------------------------------------------------------------------

/**
 * Compares two semver version strings and returns true if `latest` is
 * strictly newer than `current`.
 *
 * Strips a leading "v" if present (e.g. "v1.2.3" → "1.2.3").
 *
 * @param current  The currently installed version (e.g. "0.0.1")
 * @param latest   The latest available version (e.g. "v0.0.2")
 */
export function isNewerVersion(current: string, latest: string): boolean {
    const normalize = (v: string) =>
        v.replace(/^v/i, "").split(".").map(Number);

    const cur = normalize(current);
    const lat = normalize(latest);

    const maxLen = Math.max(cur.length, lat.length);
    for (let i = 0; i < maxLen; i++) {
        const c = cur[i] ?? 0;
        const l = lat[i] ?? 0;
        if (l > c) {
            return true;
        }
        if (l < c) {
            return false;
        }
    }

    return false; // equal
}

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------

/**
 * Fetches the latest release from the GitHub repository.
 * Uses the public API (unauthenticated) since the repo is public.
 *
 * @returns The latest release info, or undefined if the request fails.
 */
export async function fetchLatestRelease(): Promise<GitHubRelease | undefined> {
    try {
        const response = await fetch(GITHUB_RELEASES_URL, {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "vscode-copilot-quota-alert",
            },
        });

        if (!response.ok) {
            console.warn(
                `Copilot Quota Alert: update check failed (HTTP ${response.status})`
            );
            return undefined;
        }

        const data = (await response.json()) as GitHubRelease;
        return data;
    } catch (error) {
        // Network errors, DNS failures, etc. — fail silently.
        console.warn("Copilot Quota Alert: update check failed:", error);
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Main update-check flow
// ---------------------------------------------------------------------------

/**
 * Checks for a newer version on GitHub and shows a notification if one
 * is available. Respects the user's "checkForUpdates" setting and tracks
 * dismissed versions so the same prompt is not repeated.
 *
 * @param context  The extension context (used for globalState persistence).
 * @param manual   If true, always checks regardless of settings and shows
 *                 "up to date" feedback when no update is found.
 */
export async function checkForUpdates(
    context: vscode.ExtensionContext,
    manual = false
): Promise<void> {
    // Respect opt-out setting (skip for manual invocations)
    if (!manual) {
        const config = vscode.workspace.getConfiguration("copilot-quota-alert");
        const enabled = config.get<boolean>("checkForUpdates") ?? true;
        if (!enabled) {
            return;
        }
    }

    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    const currentVersion: string =
        extension?.packageJSON.version ?? "0.0.0";

    const release = await fetchLatestRelease();
    if (!release) {
        if (manual) {
            vscode.window.showWarningMessage(
                "Copilot Quota Alert: Unable to check for updates. Please try again later."
            );
        }
        return;
    }

    const latestVersion = release.tag_name;
    latestDiscoveredVersion = latestVersion;

    if (!isNewerVersion(currentVersion, latestVersion)) {
        if (manual) {
            vscode.window.showInformationMessage(
                `Copilot Quota Alert: You're up to date (v${currentVersion}).`
            );
        }
        return;
    }

    // Skip if the user already dismissed this specific version
    const dismissed = context.globalState.get<string>(DISMISSED_VERSION_KEY);
    if (!manual && dismissed === latestVersion) {
        return;
    }

    const cleanVersion = latestVersion.replace(/^v/i, "");

    const action = await vscode.window.showInformationMessage(
        `Copilot Quota Alert: A new version (v${cleanVersion}) is available! ` +
            `You are currently on v${currentVersion}.`,
        "Install",
        "Dismiss"
    );

    if (action === "Install") {
        vscode.env.openExternal(vscode.Uri.parse(MARKETPLACE_URL));
    } else if (action === "Dismiss") {
        await context.globalState.update(DISMISSED_VERSION_KEY, latestVersion);
    }
}
