const { execSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function (context) {
  const { electronPlatformName } = context;
  if (electronPlatformName !== 'darwin') return;

  const { appOutDir, packager } = context;
  const appPath = path.join(appOutDir, `${packager.appInfo.productFilename}.app`);
  const appId = packager.config.appId;

  // Read the signing identity from the already-signed app
  // (electron-builder signed it with the Developer ID certificate)
  const identity = execSync(
    `codesign -d -v "${appPath}" 2>&1 | awk -F= '/Authority=/ {print $2; exit}'`,
    { encoding: 'utf-8' },
  ).trim();

  if (!identity) {
    console.warn('No signing identity found, skipping re-sign');
    return;
  }

  // Re-sign with the same identity, stamping a stable designated requirement
  // so Squirrel.Mac's code signature validation passes for future updates.
  const requirement = `identifier "${appId}"`;
  execSync(
    `codesign --force -s "${identity}" --options runtime --requirements "=designated => ${requirement}" --timestamp "${appPath}"`,
    { stdio: 'inherit' },
  );
};
