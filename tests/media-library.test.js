import test from 'node:test';
import assert from 'node:assert/strict';
import { changeMediaLibrary, DEFAULT_MEDIA, MEDIA_STORAGE_KEY, persistMediaLibrary, readMediaLibrary } from '../src/media-library.js';

const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

test('media names can be created, renamed, deleted and persisted', () => {
  const store = memory();
  assert.deepEqual(readMediaLibrary(store), [...DEFAULT_MEDIA]);
  let items = changeMediaLibrary(['PP Gloss'], { type: 'create', name: ' Vinyl Matte ' });
  assert.deepEqual(items, ['PP Gloss', 'Vinyl Matte']);
  items = changeMediaLibrary(items, { type: 'rename', name: 'Vinyl Matte', newName: 'Vinyl Gloss' });
  assert.deepEqual(items, ['PP Gloss', 'Vinyl Gloss']);
  items = changeMediaLibrary(items, { type: 'delete', name: 'PP Gloss' });
  persistMediaLibrary(store, items);
  assert.deepEqual(JSON.parse(store.getItem(MEDIA_STORAGE_KEY)), ['Vinyl Gloss']);
});

test('media library rejects duplicates, invalid names and deleting the final item', () => {
  assert.throws(() => changeMediaLibrary(['PP Gloss'], { type: 'create', name: 'pp gloss' }), /already exists/);
  assert.throws(() => changeMediaLibrary(['PP Gloss'], { type: 'create', name: 'မြန်မာ' }), /English/);
  assert.throws(() => changeMediaLibrary(['PP Gloss'], { type: 'delete', name: 'PP Gloss' }), /at least one/);
});
