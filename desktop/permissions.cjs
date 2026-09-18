function isTrustedNestCutOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'nestcut:' && url.host === 'app';
  } catch {
    return false;
  }
}

function allowsPermission(webContents, permission, requestingOrigin) {
  if (permission !== 'local-fonts') return false;
  return isTrustedNestCutOrigin(requestingOrigin || webContents?.getURL?.());
}

module.exports = { allowsPermission, isTrustedNestCutOrigin };
