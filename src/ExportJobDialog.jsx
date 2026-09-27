import React from 'react';
import { ExportJobSettings } from './ExportJobSettings.jsx';

export function ExportJobDialog({ open, sourceName, value, onChange, onCancel, onExport, onDownloadLayerScript, exporting }) {
  if (!open) return null;
  return <div className="export-job-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !exporting) onCancel(); }}>
    <div className="export-job-dialog" role="dialog" aria-modal="true" aria-labelledby="export-job-title" onKeyDown={event => { if (event.key === 'Escape' && !exporting) onCancel(); }}>
      <div className="export-dialog-title"><div><h2 id="export-job-title">Export Job Details</h2><p>Set the production filename before downloading the PDF.</p></div><button type="button" aria-label="Close export details" disabled={exporting} onClick={onCancel}>×</button></div>
      <ExportJobSettings sourceName={sourceName} value={value} onChange={onChange} disabled={exporting} />
      {onDownloadLayerScript && <p className="export-layer-help">First time only: download and install the reusable Organizer script in Illustrator’s Scripting folder, then restart Illustrator. For each job, export only this PDF; open it and run File → Scripts → NestCut Layer Organizer. Check the layers and Save As .ai.</p>}
      <div className="export-dialog-actions"><button type="button" disabled={exporting} onClick={onCancel}>Cancel</button>{onDownloadLayerScript && <button type="button" disabled={exporting} onClick={onDownloadLayerScript}>Download Organizer (first time)</button>}<button type="button" className="export-confirm" disabled={exporting} onClick={onExport}>{exporting ? 'Building PDF…' : 'Export PDF'}</button></div>
    </div>
  </div>;
}
