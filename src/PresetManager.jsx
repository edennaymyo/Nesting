import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {FilePlus2,Pencil,Save,Trash2} from 'lucide-react';
import {BUILTIN_PRESETS} from './presets.js';

function PresetDialog({mode,selected,onClose,onSubmit}) {
  const ref=useRef(null),[name,setName]=useState(mode==='rename'?selected:''),[error,setError]=useState('');
  const deleting=mode==='delete',title=deleting?'Delete preset?':mode==='rename'?'Rename preset':'Save as new preset';
  useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);
  return createPortal(<dialog ref={ref} className="preset-dialog" aria-labelledby="preset-dialog-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <form onSubmit={event=>{event.preventDefault();try{onSubmit(name);onClose();}catch(e){setError(e.message);}}}>
      <h2 id="preset-dialog-title">{title}</h2>
      {deleting?<p>Delete <strong>{selected}</strong> from saved presets? This cannot be undone. Your current design and settings will stay unchanged.</p>:<label>Preset name<input autoFocus maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. 13×19 sticker"/></label>}
      {mode==='create'&&<p>Includes paper size, margins, cut gap, arrangement, rotation and registration box settings.</p>}
      {mode==='rename'&&<p>Only the name changes. Use Update to save any edited settings.</p>}
      {error&&<p role="alert" className="preset-error">{error}</p>}
      <div className="preset-dialog-actions"><button type="button" autoFocus={deleting} onClick={onClose}>Cancel</button><button type="submit" className={deleting?'preset-danger':'preset-primary'}>{deleting?<Trash2 size={14} aria-hidden="true"/>:mode==='rename'?<Pencil size={14} aria-hidden="true"/>:<Save size={14} aria-hidden="true"/>}{deleting?'Delete preset':mode==='rename'?'Rename':'Save preset'}</button></div>
    </form>
  </dialog>,document.body);
}

export function PresetManager({host,selected,saved,current,onChoose,onMutation,disabled,storageError,builtins=BUILTIN_PRESETS,label='Paper preset',customOption}) {
  const [dialog,setDialog]=useState(null),[feedback,setFeedback]=useState(''),[error,setError]=useState('');
  const custom=Object.hasOwn(saved,selected)&&!Object.hasOwn(builtins,selected);
  const changed=custom&&JSON.stringify(saved[selected])!==JSON.stringify(current);
  if (!host) return null;
  const apply=action=>{onMutation(action);setError('');setFeedback(action.type==='delete'?'Preset deleted. Current settings kept.':action.type==='rename'?'Preset renamed.':action.type==='update'?'Preset updated.':'Preset saved.');};
  return createPortal(<>
    <div className="preset-controls"><label htmlFor="paper-preset">{label}</label><select id="paper-preset" value={selected} disabled={disabled} onChange={e=>{setFeedback('');setError('');onChoose(e.target.value);}}>
      {Object.entries(builtins).map(([value,title])=><option value={value} key={value}>{Array.isArray(title)?value:title}</option>)}
      {Object.keys(saved).filter(name=>!Object.hasOwn(builtins,name)).map(name=><option value={name} key={name}>{name} · Saved</option>)}
      {customOption&&<option value={customOption.value}>{customOption.label}</option>}
    </select><button type="button" className="preset-save-new" aria-label="Save as new" title="Save as new" disabled={disabled||!!storageError} onClick={()=>setDialog('create')}><FilePlus2 size={15} aria-hidden="true"/></button></div>
    {custom&&<div className="preset-actions"><button type="button" className="preset-primary" disabled={disabled||!changed||!!storageError} onClick={()=>{try{apply({type:'update',name:selected,settings:current});}catch(e){setError(e.message);}}}><Save size={14} aria-hidden="true"/>Save</button><button type="button" disabled={disabled||!!storageError} onClick={()=>setDialog('rename')}><Pencil size={14} aria-hidden="true"/>Edit</button><button type="button" className="preset-danger" disabled={disabled||!!storageError} onClick={()=>setDialog('delete')}><Trash2 size={14} aria-hidden="true"/>Delete</button></div>}
    <p className={`preset-feedback ${changed?'changed':''}`} role="status">{changed?'Unsaved changes — Update to keep them.':feedback|| (custom?'Edit the settings below, then Update.':'Built-in presets are read-only. Save your own copy.')}</p>
    {(error||storageError)&&<p className="preset-error" role="alert">{error||storageError}</p>}
    {dialog&&<PresetDialog mode={dialog} selected={selected} onClose={()=>setDialog(null)} onSubmit={name=>apply(dialog==='create'?{type:'create',name,settings:current}:dialog==='rename'?{type:'rename',name:selected,newName:name}:{type:'delete',name:selected})}/>}
  </>,host);
}
