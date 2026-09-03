import React, { useRef, useState } from 'react';
import { boxFromInsets, insetsFromBox, moveBox, reflectBox, validBox } from './registration-box.js';

export function PaperDimensions({ sheet, unit }) {
  const label = value => `${+(value / (unit === 'in' ? 25.4 : 1)).toFixed(3)} ${unit}`;
  return <div className="paper-dimensions" aria-label={`Paper size ${label(sheet.w)} by ${label(sheet.h)}`}>
    <div className="paper-width"><span>{label(sheet.w)}</span></div>
    <div className="paper-height"><span>{label(sheet.h)}</span></div>
    <span className="paper-edge-label">PAPER EDGE</span>
  </div>;
}

export function RegistrationBoxOverlay({ sheet, margins, settings, onChange, side, disabled }) {
  const [draft, setDraft] = useState(null);
  const drag = useRef(null);
  const frontBox = boxFromInsets(sheet, settings.linked ? margins : settings.insets);
  const box = draft || (side === 'back' ? reflectBox(sheet, frontBox) : frontBox);
  const editable = !settings.locked && side !== 'back' && !disabled;
  if (!settings.enabled || !validBox(sheet, box)) return null;
  const commit = next => onChange(value => ({ ...value, linked: false, insets: insetsFromBox(sheet, next) }));
  const finish = event => {
    if (!drag.current) return;
    if (event.type !== 'pointercancel') commit(drag.current.next);
    drag.current = null;
    setDraft(null);
  };
  const start = (event, handle) => {
    if (!editable || event.button !== 0) return;
    event.preventDefault();
    const bed = event.currentTarget.closest('.bed').getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, box, next: box, handle, bed };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = event => {
    const d = drag.current;
    if (!d) return;
    d.next = moveBox(sheet, d.box, d.handle, (event.clientX - d.x) * sheet.w / d.bed.width, (event.clientY - d.y) * sheet.h / d.bed.height);
    setDraft(d.next);
  };
  const key = (event, handle) => {
    if (!editable) return;
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 1 : 0.1;
    commit(moveBox(sheet, box, handle, delta[0] * step, delta[1] * step));
  };
  const handlers = handle => ({ onPointerDown: e => start(e, handle), onPointerMove: move, onPointerUp: finish, onPointerCancel: finish, onKeyDown: e => key(e, handle) });
  return <div className={`registration-box ${editable ? 'editable' : ''}`} data-side={side} style={{ left: `${box.x / sheet.w * 100}%`, top: `${box.y / sheet.h * 100}%`, width: `${box.w / sheet.w * 100}%`, height: `${box.h / sheet.h * 100}%` }}>
    <button type="button" className="box-move" aria-label="Move registration box" disabled={!editable} {...handlers('move')}>REGISTRATION BOX{side === 'back' ? ' · REFLECTED' : editable ? ' · DRAG' : ' · LOCKED'}</button>
    {editable && <><div className="box-drag-area" {...handlers('move')} />{['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(handle => <button key={handle} type="button" className={`box-handle handle-${handle}`} aria-label={`Resize registration box ${handle}`} {...handlers(handle)} />)}</>}
  </div>;
}

function BoxField({ name, value, unit, disabled, onCommit }) {
  const scale = unit === 'in' ? 25.4 : 1;
  const shown = +(value / scale).toFixed(3);
  const [draft, setDraft] = useState(null);
  return <label>{name}<input aria-label={`Registration box ${name}`} type="number" step={unit === 'in' ? '0.01' : '0.1'} disabled={disabled} value={draft ?? shown} onChange={e => setDraft(e.target.value)} onBlur={e => { if (e.target.value.trim()) onCommit(Number(e.target.value) * scale); setDraft(null); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(null); } }} /><small>{unit}</small></label>;
}

export function RegistrationBoxControls({ sheet, margins, settings, onChange, unit, side, disabled }) {
  const [error, setError] = useState('');
  const box = boxFromInsets(sheet, settings.linked ? margins : settings.insets);
  const valid = validBox(sheet, box);
  const editField = (key, value) => {
    const next = { ...box, [key]: value };
    if (!validBox(sheet, next)) { setError('Box must fit inside the paper with width and height of at least 1 mm.'); return; }
    setError('');
    onChange(current => ({ ...current, linked: false, insets: insetsFromBox(sheet, next) }));
  };
  return <section className="registration-settings" aria-label="Registration box settings">
    <div className="graphtec-head"><div><h4>REGISTRATION BOX</h4><small>Illustrator / Cutting Master</small></div><button type="button" className={`toggle ${settings.enabled ? 'active' : ''}`} aria-label="Toggle registration box" aria-pressed={settings.enabled} disabled={disabled} onClick={() => onChange(v => ({ ...v, enabled: !v.enabled }))}><i /></button></div>
    {settings.enabled && <><div className="box-actions"><button type="button" disabled={disabled || side === 'back'} aria-pressed={!settings.locked} onClick={() => onChange(v => ({ ...v, locked: !v.locked }))}>{settings.locked ? 'Edit box' : 'Lock box'}</button><button type="button" disabled={disabled || side === 'back'} onClick={() => { setError(''); onChange(v => ({ ...v, linked: true })); }}>Reset to margins</button></div>
      <div className="box-numbers">{[['x', 'X'], ['y', 'Y'], ['w', 'Width'], ['h', 'Height']].map(([key, name]) => <BoxField key={`${key}-${unit}`} name={name} value={box[key]} unit={unit} disabled={disabled || settings.locked || side === 'back'} onCommit={value => editField(key, value)} />)}</div>
      <p>{side === 'back' ? 'Back box follows the reflected Front box. Edit on Front.' : `${settings.linked ? 'Linked to margins.' : 'Custom box.'} X / Y are measured from the Front paper’s top-left.`}</p>
      <p>Reference only — not a cut path or machine-readable ARMS mark. Convert the rectangle in Cutting Master before printing. Check mark clearance there.</p>
      {(!valid || error) && <p className="box-error" role="alert">{error || 'Box does not fit the current paper. Reset to margins or adjust its values.'}</p>}
    </>}
  </section>;
}
