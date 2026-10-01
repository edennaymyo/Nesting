import React, { useState } from 'react';
import { createSampleDesign } from './sample-design.js';

export function SampleDesignDialog({ open, onCancel, onCreate }) {
  const [shape, setShape] = useState('rectangle');
  const [width, setWidth] = useState('88.9');
  const [height, setHeight] = useState('50.8');
  const [unit, setUnit] = useState('mm');
  const [error, setError] = useState('');
  if (!open) return null;
  const circle = shape === 'circle';
  const switchUnit = nextUnit => {
    if (nextUnit === unit) return;
    const convert = value => {
      const number = Number(value);
      if (!Number.isFinite(number)) return value;
      const converted = unit === 'mm' ? number / 25.4 : number * 25.4;
      return String(Number(converted.toFixed(nextUnit === 'in' ? 4 : 2)));
    };
    setWidth(convert(width));
    setHeight(convert(height));
    setUnit(nextUnit);
  };
  const create = () => {
    try {
      const factor = unit === 'in' ? 25.4 : 1;
      const w = Number(width) * factor, h = circle ? w : Number(height) * factor;
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
        <div className="sample-units" role="group" aria-label="Sample measurement units">
          <button type="button" className={unit === 'mm' ? 'active' : ''} aria-pressed={unit === 'mm'} onClick={() => switchUnit('mm')}>mm</button>
          <button type="button" className={unit === 'in' ? 'active' : ''} aria-pressed={unit === 'in'} onClick={() => switchUnit('in')}>in</button>
        </div>
        <label>{circle ? 'Diameter' : 'Width'} <input aria-label={circle ? 'Sample diameter' : 'Sample width'} type="number" min={unit === 'mm' ? '1' : String(1 / 25.4)} max={unit === 'mm' ? '3000' : String(3000 / 25.4)} step={unit === 'mm' ? '0.1' : '0.01'} value={width} onChange={event => { setWidth(event.target.value); if (circle) setHeight(event.target.value); }}/><small>{unit}</small></label>
        {!circle && <label>Height <input aria-label="Sample height" type="number" min={unit === 'mm' ? '1' : String(1 / 25.4)} max={unit === 'mm' ? '3000' : String(3000 / 25.4)} step={unit === 'mm' ? '0.1' : '0.01'} value={height} onChange={event => setHeight(event.target.value)}/><small>{unit}</small></label>}
        {error && <p className="sample-dialog-error" role="alert">{error}</p>}
      </div>
      <div className="sample-dialog-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="sample-create" onClick={create}>Create sample</button></div>
    </div>
  </div>;
}
