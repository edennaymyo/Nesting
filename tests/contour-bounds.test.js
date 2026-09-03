import test from 'node:test';
import assert from 'node:assert/strict';
import { contourPathBounds } from '../src/contour-bounds.js';
import { repeatGeometry, packPattern } from '../src/packing-legacy.js';
import { refineHoneycombRows } from '../src/honeycomb-spacing.js';
import { contourRings, validateLayout } from '../src/contour-geometry.js';
import { circle } from './packing-fixtures.js';

test('cubic handles outside the cut do not inflate its rectangle', () => {
  assert.deepEqual(contourPathBounds('M0 0 C100 0 100 100 0 100 Z'), [0,0,75,100]);
  assert.deepEqual(contourPathBounds('M0 0 C-100 0 -100 100 0 100 Z'), [-75,0,75,100]);
  assert.deepEqual(contourPathBounds('M0 0 C0 -100 100 -100 100 0 Z'), [0,-75,100,75]);
});
test('line, degenerate cubic, multiple subpaths and exponent coordinates', () => {
  assert.deepEqual(contourPathBounds('M1e1 20 L30 20 L30 50 L10 50 Z'), [10,20,20,30]);
  assert.deepEqual(contourPathBounds('M0 0 C0 0 10 10 10 10 L0 10 Z'), [0,0,10,10]);
  assert.deepEqual(contourPathBounds('M0 0 L1 0 L1 1 Z M10 10 L20 10 L20 20 Z'), [0,0,20,20]);
  for (const path of ['', 'M0 0', 'M0 0 C1 2', 'M0 0 Q1 2 3 4']) assert.equal(contourPathBounds(path),null);
});
test('all cardinal Step bounds and pitches use the tight cut, not handles or artwork', () => {
  const d='M0 0 C100 0 100 100 0 100 Z',box=contourPathBounds(d);
  const art={w:140,h:140,contour:{d,box,mmBox:[10,20,box[2],box[3]]}};
  for (const angle of [0,90,180,270]) {
    const g=repeatGeometry(art,angle),swap=angle===90||angle===270;
    assert.equal(g.w,swap?100:75);assert.equal(g.h,swap?75:100);
    for(const pattern of ['grid','staggered','brick']) {
      const items=packPattern(art,100,{w:400,h:400},5,pattern,angle);
      assert.ok(items.length>0);assert.ok(items.every(p=>p.w===g.w&&p.h===g.h));
    }
    const grid=packPattern(art,100,{w:400,h:400},5,'grid',angle);
    assert.equal(grid[1].x-grid[0].x,g.w+5);
  }
});

test('Honeycomb corrects too-tight raster rows without skipping alternating rows', () => {
  const g=repeatGeometry(circle),items=[];
  for(let row=0;row<4;row++)for(let col=0;col<2;col++)items.push({...g,x:col*16+(row%2)*8,y:row*13,i:items.length});
  const sheet={w:50,h:65},result=refineHoneycombRows(items,circle,sheet,0);
  assert.equal(result.length,8);
  assert.equal(validateLayout(result,contourRings(circle),sheet,0).rejected,0);
  assert.ok(result[2].y>items[2].y);
  for(let i=0;i<items.length;i++){
    assert.equal(result[i].x,items[i].x);
    assert.equal(result[i].pdfMinX,items[i].pdfMinX);
    assert.equal(result[i].pdfMinY,items[i].pdfMinY);
  }
  assert.equal(result[2].y,result[3].y);
});
