import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESET_STORAGE_KEY,readPresets,changePresets,presetSnapshot,persistPresetChange} from '../src/presets.js';
const settings=presetSnapshot({sheet:{w:330.2,h:482.6},margins:{top:25.4,right:12.7,bottom:12.7,left:12.7},gap:5.08,arrangeMode:'step',repeatPattern:'honeycomb',repeatAngle:90,rotation:false,graphtec:{enabled:true,linked:false,insets:{top:15,right:10,bottom:10,left:10},locked:false}});
const memory=initial=>{const data=new Map(Object.entries(initial||{}));return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};

test('save/update persist every job setting and leave other presets untouched',()=>{
  const store=memory({'unrelated-key':'keep'});
  persistPresetChange(store,{type:'create',name:' First ',settings});
  persistPresetChange(store,{type:'create',name:'Other',settings});
  const next={...settings,gap:0,margins:{...settings.margins,top:10},sheet:{w:300,h:450},repeatAngle:180};
  persistPresetChange(store,{type:'update',name:'First',settings:next});
  assert.deepEqual(readPresets(store).First,next);
  assert.deepEqual(readPresets(store).Other,settings);
  assert.equal(store.getItem('unrelated-key'),'keep');
  assert.equal('locked' in readPresets(store).First.registrationBox,false);
});
test('rename preserves the stored snapshot; delete removes only the selected preset',()=>{
  const saved={First:settings,Other:{...settings,gap:3}};
  const renamed=changePresets(saved,{type:'rename',name:'First',newName:'Renamed'});
  assert.deepEqual(renamed.Renamed,settings);assert.equal(Object.hasOwn(renamed,'First'),false);
  const removed=changePresets(renamed,{type:'delete',name:'Renamed'});
  assert.deepEqual(removed,{Other:saved.Other});assert.deepEqual(saved.First,settings);
});
test('duplicate names and protected names never overwrite existing presets',()=>{
  const saved={First:settings,Other:settings};
  assert.throws(()=>changePresets(saved,{type:'create',name:'First',settings}),/already exists/);
  assert.throws(()=>changePresets(saved,{type:'rename',name:'First',newName:'Other'}),/already exists/);
  for(const name of ['13 × 19 in','12.4 × 18.4 in','Custom','custom','49x24.5','59x25.1','__epson_custom_size__','__proto__','constructor','prototype']){
    for(const type of ['create','update','delete'])assert.throws(()=>changePresets(saved,{type,name,settings}),/reserved/);
  }
  assert.throws(()=>changePresets(saved,{type:'create',name:'   ',settings}),/name/);
});
test('Epson snapshots retain printer and selected stock size for isolated media presets',()=>{
  const mediaSplit={enabled:true,panelW:598.5,panelH:317.5,clearance:6.35};
  const epson=presetSnapshot({sheet:{w:1498.6,h:638.04},margins:{top:6.35,right:6.35,bottom:6.35,left:6.35},gap:2,arrangeMode:'contour',repeatPattern:'grid',repeatAngle:0,rotation:true,showGuides:false,graphtec:{enabled:true,linked:false,insets:{top:10,right:10,bottom:10,left:10}},printer:'epson',mediaSize:'59x25.1',mediaSplit});
  assert.equal(epson.printer,'epson');assert.equal(epson.mediaSize,'59x25.1');assert.deepEqual(epson.sheet,{w:1498.6,h:638.04});assert.deepEqual(epson.mediaSplit,mediaSplit);assert.equal(epson.gap,2);assert.equal(epson.showGuides,false);
  const store=memory();persistPresetChange(store,{type:'create',name:'Epson roll',settings:epson});const loaded=readPresets(store)['Epson roll'];assert.deepEqual(loaded.mediaSplit,mediaSplit);assert.equal(loaded.gap,2);assert.equal(loaded.showGuides,false);
});
test('malformed storage and invalid settings cannot silently replace stored data',()=>{
  for(const raw of ['null','[]','{broken','{"bad":null}']){
    const store=memory({[PRESET_STORAGE_KEY]:raw});
    assert.throws(()=>persistPresetChange(store,{type:'create',name:'New',settings}));
    assert.equal(store.getItem(PRESET_STORAGE_KEY),raw);
  }
  assert.throws(()=>changePresets({},{type:'create',name:'Bad',settings:{...settings,gap:8}}),/gap/);
  assert.throws(()=>changePresets({},{type:'create',name:'Bad',settings:{...settings,margins:{...settings.margins,top:500}}}),/Margins/);
});
test('storage write failure is reported and existing data is retained',()=>{
  const raw=JSON.stringify({First:settings});
  const store={getItem:()=>raw,setItem:()=>{throw new Error('QuotaExceededError');}};
  assert.throws(()=>persistPresetChange(store,{type:'delete',name:'First'}),/No preset changes/);
  assert.equal(store.getItem(PRESET_STORAGE_KEY),raw);
});
