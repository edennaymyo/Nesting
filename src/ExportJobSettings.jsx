import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { buildExportFileName, extractSNumber, LAMINATION_OPTIONS } from './export-job.js';
import { changeMediaLibrary, DEFAULT_MEDIA, persistMediaLibrary, readMediaLibrary } from './media-library.js';

function initialMediaState() {
  try { return { items: readMediaLibrary(window.localStorage), error: '' }; }
  catch (error) { return { items: [...DEFAULT_MEDIA], error: error.message }; }
}

export function ExportJobSettings({ sourceName, value, onChange, disabled }) {
  const [library, setLibrary] = useState(initialMediaState);
  const [manage, setManage] = useState(false);
  const [draft, setDraft] = useState('');
  const jobNumber = extractSNumber(sourceName);
  const selectedMedia = library.items.includes(value.media) ? value.media : library.items[0];
  const settings = { ...value, media: selectedMedia, sourceName };
  const suggestedFileName = buildExportFileName({ ...settings, customName: '' });
  const displayedFileName = value.customName || suggestedFileName;
  const update = patch => onChange(current => ({ ...current, ...patch }));
  useEffect(() => {
    if (value.media !== selectedMedia) onChange(current => ({ ...current, media: selectedMedia }));
  }, [onChange, selectedMedia, value.media]);
  const mutate = action => {
    try {
      const next = changeMediaLibrary(library.items, action);
      persistMediaLibrary(window.localStorage, next);
      setLibrary({ items: next, error: '' });
      const nextSelected = action.type === 'delete' ? next[0] : action.type === 'rename' ? next[library.items.indexOf(action.name)] : next.at(-1);
      update({ media: nextSelected });
      setDraft('');
    } catch (error) { setLibrary(current => ({ ...current, error: error.message })); }
  };
  return <section className="export-job-settings" aria-label="Export job details">
    <div className="export-job-head"><div><h4>EXPORT JOB DETAILS</h4><small>{jobNumber ? `Detected ${jobNumber}` : 'No S-number detected'}</small></div><button type="button" disabled={disabled} aria-expanded={manage} onClick={() => { setManage(open => !open); setDraft(selectedMedia); }}>{manage ? 'Done' : 'Manage media'}</button></div>
    <label>Media<select aria-label="Export media" disabled={disabled} value={selectedMedia} onChange={event => update({ media: event.target.value })}>{library.items.map(media => <option key={media}>{media}</option>)}</select></label>
    <label>Lamination<select aria-label="Export lamination" disabled={disabled} value={value.lamination} onChange={event => update({ lamination: event.target.value })}>{LAMINATION_OPTIONS.map(option => <option key={option}>{option}</option>)}</select></label>
    <label className="gold-foil"><span>Gold foil</span><button type="button" className={`toggle ${value.goldFoil ? 'active' : ''}`} aria-label="Toggle Gold Foil" aria-pressed={value.goldFoil} disabled={disabled} onClick={() => update({ goldFoil: !value.goldFoil })}><i /></button></label>
    <label>Sheet qty<input aria-label="Export sheet quantity" type="number" min="1" step="1" disabled={disabled} value={value.sheets} onChange={event => update({ sheets: Math.max(1, Math.floor(Number(event.target.value) || 1)) })} /></label>
    {manage && <div className="media-manager"><input aria-label="Media name editor" value={draft} maxLength="50" placeholder="Media name" onChange={event => setDraft(event.target.value)} /><div><button type="button" disabled={disabled} onClick={() => mutate({ type: 'create', name: draft })}>Add new</button><button type="button" disabled={disabled} onClick={() => mutate({ type: 'rename', name: selectedMedia, newName: draft })}>Update</button><button type="button" className="danger" disabled={disabled || library.items.length === 1} onClick={() => mutate({ type: 'delete', name: selectedMedia })}>Delete</button></div></div>}
    {library.error && <p className="export-job-error" role="alert">{library.error}</p>}
    <label className="export-name-field"><span>Export file name</span><div><input aria-label="Export file name" maxLength="120" disabled={disabled} value={displayedFileName} onChange={event => update({ customName: event.target.value })}/><button type="button" className={`reset-icon ${value.customName ? 'is-dirty' : ''}`} aria-label="Reset export file name" title="Reset to suggested file name" disabled={disabled || !value.customName} onClick={() => update({ customName: '' })}><RotateCcw size={14}/></button></div></label>
    <p className="export-name-preview"><span>Download name</span><b>{buildExportFileName(settings)}</b></p>
  </section>;
}
