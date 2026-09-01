import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/**
 * Injects the version derived from the git tag into the bundle input `index.js`
 * (produced by concat.mjs, git-ignored), so the version reported to the
 * measurement server follows the git tag - including the commit hash so a build
 * can always be traced back to an exact commit.
 *
 * This runs AFTER concat.mjs and only rewrites the git-ignored `index.js`; the
 * tracked source (`src/`) and `package.json` keep their `0.0.0-dev` placeholder,
 * so a plain checkout never shows a stale hardcoded version and the build leaves
 * the repository clean.
 *
 * Example version: `0.9.6-0-g17e77d0d` (tag v0.9.6, 0 commits after, commit
 * 17e77d0d). Falls back to `0.0.0-dev` when git or a tag is unavailable.
 */
const PLACEHOLDER = "0.0.0-dev";

function getVersion() {
    try {
        const described = execSync(
            "git describe --tags --long --always --dirty",
            { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
        ).trim();
        return described.replace(/^v/, "") || PLACEHOLDER;
    } catch {
        return PLACEHOLDER;
    }
}

function main() {
    const indexPath = path.resolve("index.js");
    if (!fs.existsSync(indexPath)) {
        throw new Error("index.js not found - run concat.mjs before set-version.mjs");
    }
    const version = getVersion();
    const pattern = /(client_software_version\s*=\s*)"[^"]*"/;
    const content = fs.readFileSync(indexPath, "utf-8");
    if (!pattern.test(content)) {
        throw new Error("Could not find client_software_version assignment in index.js");
    }
    fs.writeFileSync(
        indexPath,
        content.replace(pattern, `$1"${version}"`),
        "utf-8",
    );
    console.log(`rmbtws build version: ${version} (from git tag)`);
}

main();
