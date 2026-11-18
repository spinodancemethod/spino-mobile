// CI gate for dependency vulnerabilities.
//
// Same rule as `npm audit --omit=dev --audit-level=high` (fail on any high or critical
// advisory in production dependencies), except for the advisories listed in ALLOWLIST.
// `npm audit` has no built-in way to skip a single advisory, which is why this exists.
//
// Only allowlist an advisory when no fixed version has been published. Remove the entry
// as soon as a fix exists; the script prints a reminder when an entry is no longer needed.
import { spawnSync } from 'node:child_process';

const ALLOWLIST = {
    // picomatch ReDoS (affects <=4.0.7). Checked 2026-11-18: 4.0.7 is the newest release,
    // so there is nothing to upgrade to. picomatch is only pulled in by build tooling
    // (Metro, Expo CLI, tinyglobby); it matches our own file globs on the build machine and
    // is not part of the shipped app bundle.
    'GHSA-fc5q-39xc-vjpf': 'picomatch ReDoS, no fixed version published yet',
};

const FAILING_SEVERITIES = new Set(['high', 'critical']);

// `npm audit` exits non-zero whenever it finds anything, so read stdout regardless.
// On Windows npm is a .cmd file and needs a shell to launch.
const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
});

let report;
try {
    report = JSON.parse(result.stdout);
} catch {
    console.error('Could not read `npm audit` output.');
    console.error(result.stderr || result.stdout);
    process.exit(2);
}

if (report.error) {
    console.error('`npm audit` failed:', report.error.summary ?? report.error.code);
    process.exit(2);
}

// Each package entry lists what it is vulnerable "via": either another package name
// (a string) or the advisory itself (an object). Collect the unique advisories.
const advisories = new Map();
for (const [packageName, entry] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of entry.via ?? []) {
        if (typeof via !== 'object') continue;
        const id = via.url?.split('/').pop() ?? String(via.source);
        advisories.set(id, { id, packageName, severity: via.severity, title: via.title, url: via.url });
    }
}

const blocking = [];
for (const advisory of advisories.values()) {
    if (!FAILING_SEVERITIES.has(advisory.severity)) continue;
    if (ALLOWLIST[advisory.id]) {
        console.log(`Allowed: ${advisory.id} (${advisory.packageName}) - ${ALLOWLIST[advisory.id]}`);
        continue;
    }
    blocking.push(advisory);
}

for (const id of Object.keys(ALLOWLIST)) {
    if (!advisories.has(id)) {
        console.log(`Note: ${id} is no longer reported. Remove it from ALLOWLIST in scripts/audit-check.mjs.`);
    }
}

if (blocking.length > 0) {
    console.error(`\n${blocking.length} high or critical advisory(ies) in production dependencies:`);
    for (const advisory of blocking) {
        console.error(`- [${advisory.severity}] ${advisory.packageName}: ${advisory.title}\n  ${advisory.url}`);
    }
    process.exit(1);
}

console.log('No unexpected high or critical advisories in production dependencies.');
