import { cleanJobPart } from './export-job.js';

export const MEDIA_STORAGE_KEY = 'nestcut-media-library-v1';
export const DEFAULT_MEDIA = Object.freeze(['PP Gloss', 'PP Matte', 'Art Paper Glossy', 'Glossy Silver']);

const normalize = value => {
  const name = cleanJobPart(value);
  if (!name || name.length > 50) throw new Error('Media name must be 1 to 50 English characters.');
  return name;
};

export function readMediaLibrary(storage) {
  const raw = storage.getItem(MEDIA_STORAGE_KEY);
  if (raw === null) return [...DEFAULT_MEDIA];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.length || parsed.some(value => typeof value !== 'string' || normalize(value) !== value)) throw new Error('Saved media list is invalid. Defaults are shown without overwriting it.');
  return [...new Set(parsed)];
}

export function changeMediaLibrary(items, action) {
  const current = [...items];
  if (action.type === 'create') {
    const name = normalize(action.name);
    if (current.some(item => item.toLowerCase() === name.toLowerCase())) throw new Error('That media name already exists.');
    return [...current, name];
  }
  const index = current.indexOf(action.name);
  if (index < 0) throw new Error('Select an existing media name.');
  if (action.type === 'rename') {
    const name = normalize(action.newName);
    if (current.some((item, itemIndex) => itemIndex !== index && item.toLowerCase() === name.toLowerCase())) throw new Error('That media name already exists.');
    current[index] = name;
    return current;
  }
  if (action.type === 'delete') {
    if (current.length === 1) throw new Error('Keep at least one media name.');
    current.splice(index, 1);
    return current;
  }
  throw new Error('Unknown media action.');
}

export function persistMediaLibrary(storage, items) {
  storage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(items));
}
