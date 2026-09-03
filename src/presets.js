export const PRESET_STORAGE_KEY = 'nestcut-presets';
export const BUILTIN_PRESETS = { '13 × 19 in': [330.2,482.6], '12.4 × 18.4 in': [315,467.4] };
const owns = (object,key) => Object.hasOwn(object,key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function readPresets(storage) {
  const raw=storage.getItem(PRESET_STORAGE_KEY);
  if (raw === null) return {};
  const data=JSON.parse(raw);
  if (!record(data) || Object.values(data).some(value=>!record(value))) throw new Error('Saved preset data is invalid. Existing data has not been overwritten.');
  return data;
}

export function initialPresetState() {
  try { return { presets:readPresets(window.localStorage), error:'' }; }
  catch { return { presets:{}, error:'Could not read saved presets. Existing data will not be overwritten. Check app storage access.' }; }
}

function nameFor(value) {
  const name=String(value||'').trim();
  if (!name || name.length>80) throw new Error('Enter a preset name between 1 and 80 characters.');
  if (owns(BUILTIN_PRESETS,name) || ['Custom','__proto__','constructor','prototype'].includes(name)) throw new Error('This name is reserved. Choose another name.');
  return name;
}

export function presetSnapshot({sheet,margins,gap,arrangeMode,repeatPattern,repeatAngle,rotation,graphtec}) {
  return { sheet:{...sheet}, margins:{...margins}, gap, arrangeMode, repeatPattern, repeatAngle, rotation,
    registrationBox:{enabled:graphtec.enabled,linked:graphtec.linked,insets:{...graphtec.insets}} };
}

function validateSettings(settings) {
  if (!record(settings?.sheet) || ![settings.sheet.w,settings.sheet.h].every(n=>Number.isFinite(n)&&n>0)) throw new Error('Paper width and height must be positive numbers.');
  const m=settings.margins;
  if (!record(m) || !['top','right','bottom','left'].every(side=>Number.isFinite(m[side])&&m[side]>=0) || m.left+m.right>=settings.sheet.w || m.top+m.bottom>=settings.sheet.h) throw new Error('Margins must leave usable paper space.');
  if (!Number.isFinite(settings.gap)||settings.gap<0||settings.gap>7.62) throw new Error('Cut gap must be between 0 and 0.3 in (7.62 mm).');
}

export function changePresets(saved, action) {
  const name=nameFor(action.name),next={...saved};
  if (action.type==='create') {
    if (owns(saved,name)) throw new Error('That preset name already exists. Choose another name or use Update.');
    validateSettings(action.settings);next[name]=structuredClone(action.settings);
  } else {
    if (!owns(saved,name)) throw new Error('This saved preset no longer exists. Select it again.');
    if (action.type==='update') { validateSettings(action.settings);next[name]=structuredClone(action.settings); }
    else if (action.type==='rename') {
      const renamed=nameFor(action.newName);
      if (renamed!==name && owns(saved,renamed)) throw new Error('That preset name already exists.');
      if (renamed!==name) { delete next[name];next[renamed]=saved[name]; }
    } else if (action.type==='delete') delete next[name];
    else throw new Error('Unknown preset action.');
  }
  return next;
}

// Read fresh storage before every mutation so other presets are not lost.
// Commit storage first: failed writes must not report success or change UI state.
export function persistPresetChange(storage,action) {
  const next=changePresets(readPresets(storage),action);
  try { storage.setItem(PRESET_STORAGE_KEY,JSON.stringify(next)); }
  catch { throw new Error('Could not save presets to app storage. No preset changes were applied.'); }
  return next;
}
