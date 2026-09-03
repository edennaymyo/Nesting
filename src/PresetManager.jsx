import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
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
      <div className="preset-dialog-actions"><button type="button" autoFocus={deleting} onClick={onClose}>Cancel</button><button type="submit" className={deleting?'preset-danger':'preset-primary'}>{deleting?'Delete preset':mode==='rename'?'Rename':'Save preset'}</button></div>
    </form>
  </dialog>,document.body);
}

export function PresetManager({host,selected,saved,current,onChoose,onMutation,disabled,storageError}) {
  const [dialog,setDialog]=useState(null),[feedback,setFeedback]=useState(''),[error,setError]=useState('');
  const custom=Object.hasOwn(saved,selected)&&!Object.hasOwn(BUILTIN_PRESETS,selected);
  const changed=custom&&JSON.stringify(saved[selected])!==JSON.stringify(current);
  if (!host) return null;
  const apply=action=>{onMutation(action);setError('');setFeedback(action.type==='delete'?'Preset deleted. Current settings kept.':action.type==='rename'?'Preset renamed.':action.type==='update'?'Preset updated.':'Preset saved.');};
  return createPortal(<>
    <div className="preset-controls"><label htmlFor="paper-preset">Paper preset</label><select id="paper-preset" value={selected} disabled={disabled} onChange={e=>{setFeedback('');setError('');onChoose(e.target.value);}}>
      {Object.keys(BUILTIN_PRESETS).map(name=><option key={name}>{name}</option>)}
      {Object.keys(saved).filter(name=>!Object.hasOwn(BUILTIN_PRESETS,name)).map(name=><option value={name} key={name}>{name} · Saved</option>)}
      <option>Custom</option>
    </select><button type="button" disabled={disabled||!!storageError} onClick={()=>setDialog('create')}>Save as new</button></div>
    {custom&&<div className="preset-actions"><button type="button" className="preset-primary" disabled={disabled||!changed||!!storageError} onClick={()=>{try{apply({type:'update',name:selected,settings:current});}catch(e){setError(e.message);}}}>Update</button><button type="button" disabled={disabled||!!storageError} onClick={()=>setDialog('rename')}>Rename</button><button type="button" className="preset-danger" disabled={disabled||!!storageError} onClick={()=>setDialog('delete')}>Delete</button></div>}
    <p className={`preset-feedback ${changed?'changed':''}`} role="status">{changed?'Unsaved changes — Update to keep them.':feedback|| (custom?'Edit the settings below, then Update.':'Built-in presets are read-only. Save your own copy.')}</p>
    {(error||storageError)&&<p className="preset-error" role="alert">{error||storageError}</p>}
    {dialog&&<PresetDialog mode={dialog} selected={selected} onClose={()=>setDialog(null)} onSubmit={name=>apply(dialog==='create'?{type:'create',name,settings:current}:dialog==='rename'?{type:'rename',name:selected,newName:name}:{type:'delete',name:selected})}/>}
  </>,host);
}
