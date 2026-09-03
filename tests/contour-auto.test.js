import test from 'node:test';
import assert from 'node:assert/strict';
import { contourRings, filledArea, cutUsage, placedShape, shapesConflict, validateLayout, betterLayout } from '../src/contour-geometry.js';
import { compactAndFill, selectBestCandidates } from '../src/contour-auto.js';
import { repeatGeometry, packPattern } from '../src/packing-legacy.js';
import { circle, rectangle, concave } from './packing-fixtures.js';
const item = (art, x=0, y=0, angle=0) => ({ ...repeatGeometry(art, angle), x, y, i: 0 });

test('cut area excludes bleed and is independent of layout rotation', () => {
  const area = filledArea(contourRings(rectangle)); assert.equal(area, 96);
  assert.equal(cutUsage(10,area,{w:100,h:100}),9.6);
  assert.ok(Math.abs(filledArea(contourRings(circle)) - Math.PI*64)<0.3);
  for (const angle of [0,90,180,270,37]) {
    const shape = placedShape(contourRings(rectangle), item(rectangle,0,0,angle));
    assert.ok(Math.abs(filledArea(shape.rings)-96)<1e-8);
  }
  assert.equal(cutUsage(10,null,{w:100,h:100}),null);
});
test('nonzero holes subtract area and nested same-winding paths do not double count', () => {
  const outer = [[0,0],[10,0],[10,10],[0,10]], inner = [[2,2],[8,2],[8,8],[2,8]];
  assert.equal(filledArea([outer,inner]),100);
  assert.equal(filledArea([outer,[...inner].reverse()]),64);
});
test('touching cuts at zero gap are allowed; overlap and insufficient gap are rejected', () => {
  const rings=contourRings(rectangle), a=placedShape(rings,item(rectangle));
  assert.equal(shapesConflict(a,placedShape(rings,item(rectangle,12)),0),false);
  assert.equal(shapesConflict(a,placedShape(rings,item(rectangle,11)),0),true);
  assert.equal(shapesConflict(a,placedShape(rings,item(rectangle)),0),true);
  assert.equal(shapesConflict(a,placedShape(rings,item(rectangle,13)),3.048),true);
  assert.equal(shapesConflict(a,placedShape(rings,item(rectangle,15.048)),3.048),false);
});
test('identical circles conflict and separated contours may overlap artwork bounds', () => {
  const rings=contourRings(circle), a=placedShape(rings,item(circle));
  assert.equal(shapesConflict(a,placedShape(rings,item(circle)),0),true);
  assert.equal(shapesConflict(a,placedShape(rings,item(circle,16)),0),false);
  assert.equal(shapesConflict(a,placedShape(rings,item(circle,15)),0),true);
});
test('select only after margin/gap validation, count before envelope tie-break', () => {
  const rings=contourRings(rectangle), sheet={w:40,h:30};
  const best=selectBestCandidates([
    {method:'invalid',items:[item(rectangle,-5),item(rectangle),item(rectangle),item(rectangle,100)]},
    {method:'valid',items:[item(rectangle),item(rectangle,14)]},
  ],rings,sheet,2);
  assert.equal(best.method,'valid');assert.equal(best.items.length,2);
  assert.equal(betterLayout([item(rectangle),item(rectangle,14)],[item(rectangle)]),true);
});
test('compaction/refill gains copies without changing seed or PDF origin/angle', () => {
  const rings=contourRings(rectangle),sheet={w:28,h:18},seed=[item(rectangle,5,5)];
  const snapshot=structuredClone(seed), improved=compactAndFill(seed,rings,rectangle,4,sheet,2,false,{budgetMs:10000});
  assert.equal(improved.items.length,4);assert.equal(improved.added,3);
  assert.deepEqual(seed,snapshot);
  assert.equal(validateLayout(improved.items,rings,sheet,2).rejected,0);
  for (const p of improved.items) { assert.equal(p.angle,0);assert.equal(p.pdfMinX,2);assert.equal(p.pdfMinY,3); }
});
test('expired improvement budget preserves valid best layout', () => {
  const seed=[item(concave,2,3,180)];
  const result=compactAndFill(seed,contourRings(concave),concave,20,{w:50,h:50},3,true,{budgetMs:0});
  assert.deepEqual(result.items,seed);assert.equal(result.timedOut,true);
});
test('Step & Repeat rectangular placement regression stays unchanged', () => {
  const sheet={w:40,h:30};
  assert.equal(packPattern(rectangle,100,sheet,2,'grid',0).length,9);
  assert.equal(packPattern(rectangle,100,sheet,2,'grid',90).length,8);
  assert.equal(packPattern(rectangle,100,sheet,2,'staggered',0).length,8);
  assert.equal(packPattern(rectangle,100,sheet,2,'brick',0).length,8);
  assert.equal(packPattern(rectangle,7,sheet,2,'grid',180).length,7);
});

test('cardinal-angle floating point contact is not an overlapping cut', () => {
  const sheet={w:72,h:96},rings=contourRings(concave);
  for(const angle of [0,90,180,270]) {
    const items=packPattern(concave,100,sheet,0,'grid',angle);
    assert.equal(validateLayout(items,rings,sheet,0).rejected,0);
  }
});
