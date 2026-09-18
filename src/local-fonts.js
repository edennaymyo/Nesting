const normalize = value => String(value || '')
  .replace(/^[A-Z]{6}\+/, '')
  .replace(/[^a-z0-9]/gi, '')
  .toLowerCase();

export function requestLocalFontCatalog(host = globalThis) {
  if (typeof host.queryLocalFonts !== 'function') {
    return Promise.resolve({ status:'unsupported', names:[] });
  }
  // Query on every import so installing/removing a font while NestCut is open
  // does not leave our own cache stale. Chromium itself may still require a
  // browser/app restart after the operating-system font registry changes.
  return host.queryLocalFonts()
    .then(fonts => ({
      status:'available',
      names:fonts.flatMap(font => [
        font.postscriptName,
        font.fullName,
        font.family && font.style ? `${font.family}-${font.style}` : null,
      ]).filter(Boolean),
    }))
    .catch(error => ({
      status:error?.name === 'NotAllowedError' ? 'denied' : 'error',
      names:[],
    }));
}

export function addLocalFontAvailability(preflight, catalog) {
  if (!preflight) return preflight;
  const required = [...new Set([...(preflight.embedded || []), ...(preflight.nonEmbedded || [])])];
  const available = new Set((catalog?.names || []).map(normalize).filter(Boolean));
  const notInstalled = catalog?.status === 'available'
    ? required.filter(name => !available.has(normalize(name)))
    : [];
  return {
    ...preflight,
    localFontStatus:catalog?.status || 'unsupported',
    notInstalled,
  };
}
