import React, { useState } from 'react';
import { createSampleDesign } from './sample-design.js';

export function SampleDesignDialog({ open, onCancel, onCreate }) {
  const [shape, setShape] = useState('rectangle');
  const [width, setWidth] = useState('88.9');
  const [height, setHeight] = useState('50.8');
  const [error, setError] = useState('');
  if (!open) return null;
  const circle = shape === 'circle';
  const create = () => {
    try {
      const w = Number(width), h = circle ? w : Number(height);
      onCreate(createSampleDesign({ shape, width: w, height: h }));
      setError('');
      onCancel();
    } catch (failure) { setError(failure.message); }
  };
  return <div className="sample-dialog-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <div className="sample-dialog" role="dialog" aria-modal="true" aria-labelledby="sample-dialog-title">
      <div className="sample-dialog-title"><div><h2 id="sample-dialog-title">Try sample design</h2><p>Choose a cut shape and its finished size.</p></div><button type="button" aria-label="Close sample design" onClick={onCancel}>×</button></div>
      <div className="sample-dialog-body">
        <div className="sample-shapes" role="group" aria-label="Sample shape">
          <button type="button" className={shape === 'rectangle' ? 'active' : ''} aria-pressed={shape === 'rectangle'} onClick={() => setShape('rectangle')}><i className="sample-rectangle"/>Rectangle</button>
          <button type="button" className={circle ? 'active' : ''} aria-pressed={circle} onClick={() => { setShape('circle'); setHeight(width); }}><i className="sample-circle"/>Circle</button>
        </div>
        <label>{circle ? 'Diameter' : 'Width'} <input aria-label={circle ? 'Sample diameter' : 'Sample width'} type="number" min="1" max="3000" step="0.1" value={width} onChange={event => { setWidth(event.target.value); if (circle) setHeight(event.target.value); }}/><small>mm</small></label>
        {!circle && <label>Height <input aria-label="Sample height" type="number" min="1" max="3000" step="0.1" value={height} onChange={event => setHeight(event.target.value)}/><small>mm</small></label>}
        {error && <p className="sample-dialog-error" role="alert">{error}</p>}
      </div>
      <div className="sample-dialog-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="sample-create" onClick={create}>Create sample</button></div>
    </div>
  </div>;
}
