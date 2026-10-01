import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildIllustratorLayerScript, createIllustratorLayerConfig } from '../src/illustrator-layer-script.js';
import { registrationMarkPolygons } from '../src/registration-marks.js';

const pt = 72 / 25.4;
const sheet = { w: 330.2, h: 482.6 };
const box = { x: 20, y: 30, w: 200, h: 300 };

function pdfBounds(points) {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return [Math.min(...xs) * pt, (sheet.h - Math.min(...ys)) * pt,
    Math.max(...xs) * pt, (sheet.h - Math.max(...ys)) * pt];
}

function makeDocument({ wrongSize = false, withBox = true, back = false } = {}) {
  const activeBox = back ? { ...box, x: sheet.w - box.x - box.w } : box;
  const layers = [];
  function makeLayer(name) {
    return {
      name,
      zOrder(method) {
        const index = layers.indexOf(this);
        layers.splice(index, 1);
        if (method === 'BRINGTOFRONT') layers.unshift(this);
        else if (method === 'SENDTOBACK') layers.push(this);
      },
    };
  }
  layers.push(makeLayer('Layer 1'));
  layers.add = function () { const layer = makeLayer(''); this.push(layer); return layer; };
  const moved = [];
  const items = registrationMarkPolygons(activeBox, 'type2', 5, 1).map(points => ({
    typename: 'PathItem', parent: { typename: 'Layer' }, locked: false, hidden: false,
    clipping: false, filled: true, stroked: false, geometricBounds: pdfBounds(points),
    move(layer) { this.layer = layer; moved.push({ item: this, layer }); },
  }));
  if (withBox) items.push({
    typename: 'PathItem', parent: { typename: 'Layer' }, locked: false, hidden: false,
    clipping: false, filled: false, stroked: true,
    geometricBounds: [activeBox.x * pt, (sheet.h - activeBox.y) * pt, (activeBox.x + activeBox.w) * pt, (sheet.h - activeBox.y - activeBox.h) * pt],
    move(layer) { this.layer = layer; moved.push({ item: this, layer }); },
  });
  const artboards = [{ artboardRect: [0, sheet.h * pt, (wrongSize ? sheet.w - 10 : sheet.w) * pt, 0] }];
  artboards.getActiveArtboardIndex = () => 0;
  return { document: { artboards, pathItems: items, compoundPathItems: [], layers }, moved };
}

test('Illustrator helper moves the four existing filled L objects and box into named native layers', () => {
  const script = buildIllustratorLayerScript({ sheet, box, mode: 'both', type: 'type2', length: 5, thickness: 1 });
  new vm.Script(script);
  const { document, moved } = makeDocument();
  const messages = [];
  vm.runInNewContext(script, { app: { documents: [document], activeDocument: document, redraw() {} }, alert: message => messages.push(message), ElementPlacement: { PLACEATBEGINNING: 1 }, ZOrderMethod: { BRINGTOFRONT: 'BRINGTOFRONT', SENDTOBACK: 'SENDTOBACK' } });
  assert.deepEqual(document.layers.map(layer => layer.name), ['reg_1 2 0 25.00 1.00 5.00 100.00 1 0 2 0 0.00', 'registration_box', 'print']);
  assert.equal(moved.length, 5);
  assert.equal(moved.filter(entry => entry.layer.name.startsWith('reg_1')).length, 4);
  assert.equal(moved.filter(entry => entry.layer.name === 'registration_box').length, 1);
  assert.match(messages[0], /native Illustrator layers/);
});

test('Illustrator helper groups every Cut Line spot vector into one native Cut Line layer', () => {
  const script = buildIllustratorLayerScript({ sheet, box, mode: 'both', type: 'type2', length: 5, thickness: 1 });
  const { document, moved } = makeDocument();
  const cutLineColor = { typename: 'SpotColor', spot: { name: 'Cut Line' } };
  const sourceLayer = { name: 'print' };
  const makeCutPath = (appearance, parent = { typename: 'Layer' }) => ({
    typename: 'PathItem', parent, layer: sourceLayer, locked: false, hidden: false, clipping: false,
    filled: appearance === 'fill', stroked: appearance === 'stroke',
    fillColor: appearance === 'fill' ? cutLineColor : { typename: 'RGBColor' },
    strokeColor: appearance === 'stroke' ? cutLineColor : { typename: 'RGBColor' },
    geometricBounds: [0, 0, 1, 1], move(layer) { this.layer = layer; moved.push({ item: this, layer }); },
  });
  const stroke = makeCutPath('stroke'), fill = makeCutPath('fill');
  sourceLayer.locked = true;
  stroke.locked = true;
  const compoundChild = makeCutPath('fill', { typename: 'CompoundPathItem' });
  const compound = {
    typename: 'CompoundPathItem', pathItems: [compoundChild], layer: sourceLayer, locked: false, hidden: false,
    geometricBounds: [0, 0, 2, 2], move(layer) { this.layer = layer; moved.push({ item: this, layer }); },
  };
  document.pathItems.push(stroke, fill, compoundChild);
  document.compoundPathItems.push(compound);
  const messages = [];
  vm.runInNewContext(script, { app: { documents: [document], activeDocument: document, redraw() {} }, alert: message => messages.push(message), ElementPlacement: { PLACEATBEGINNING: 1 }, ZOrderMethod: { BRINGTOFRONT: 'BRINGTOFRONT', SENDTOBACK: 'SENDTOBACK' } });
  assert.deepEqual(document.layers.map(layer => layer.name), ['reg_1 2 0 25.00 1.00 5.00 100.00 1 0 2 0 0.00', 'registration_box', 'Cut Line', 'print']);
  assert.equal(document.layers[0].name.startsWith('reg_'), true);
  assert.equal(document.layers[2].name, 'Cut Line');
  assert.equal(document.layers[3].name, 'print');
  const organizedCuts = moved.filter(entry => entry.layer.name === 'Cut Line').map(entry => entry.item);
  assert.equal(organizedCuts.length, 3);
  assert.ok(organizedCuts.includes(stroke) && organizedCuts.includes(fill) && organizedCuts.includes(compound));
  assert.equal(stroke.locked, true);
  assert.equal(sourceLayer.locked, true);
  assert.match(messages[0], /Cut Line vectors \(3\)/);
});

test('Illustrator layer config defaults to Type 2 registration marks only', () => {
  const config = createIllustratorLayerConfig({ sheet, box });
  assert.equal(config.mode, 'marks');
  assert.equal(config.type, 'type2');
  assert.equal(config.markLayer, 'reg_1 2 0 25.00 1.00 5.00 100.00 1 0 2 0 0.00');
});

test('reusable Illustrator helper reads the registration settings embedded in the PDF metadata', () => {
  const settings = createIllustratorLayerConfig({ sheet, box, mode: 'both', type: 'type2', length: 5, thickness: 1 });
  const fields = [1, ...settings.sheet, settings.box.x, settings.box.y, settings.box.w, settings.box.h, settings.mode, settings.markLayer, 2, 5, 1];
  const { document, moved } = makeDocument();
  document.XMPString = '<nestcut:registrationSettings>' + encodeURIComponent(fields.join(',')) + '</nestcut:registrationSettings>';
  const script = buildIllustratorLayerScript({ fromMetadata: true });
  assert.doesNotThrow(() => new vm.Script(script));
  vm.runInNewContext(script, { app: { documents: [document], activeDocument: document, redraw() {} }, alert() {}, ElementPlacement: { PLACEATBEGINNING: 1 }, ZOrderMethod: { BRINGTOFRONT: 'BRINGTOFRONT', SENDTOBACK: 'SENDTOBACK' } });
  assert.equal(moved.length, 5);
  assert.deepEqual(document.layers.map(layer => layer.name), [settings.markLayer, 'registration_box', 'print']);
});

test('Illustrator helper leaves a mismatched document untouched', () => {
  const script = buildIllustratorLayerScript({ sheet, box, mode: 'marks', type: 'type2' });
  const { document, moved } = makeDocument({ wrongSize: true });
  const messages = [];
  vm.runInNewContext(script, { app: { documents: [document], activeDocument: document, redraw() {} }, alert: message => messages.push(message), ElementPlacement: { PLACEATBEGINNING: 1 }, ZOrderMethod: { BRINGTOFRONT: 'BRINGTOFRONT', SENDTOBACK: 'SENDTOBACK' } });
  assert.deepEqual(document.layers.map(layer => layer.name), ['Layer 1']);
  assert.equal(moved.length, 0);
  assert.match(messages[0], /does not match/);
});

test('Illustrator helper recognizes the reflected Back page without changing its alignment', () => {
  const script = buildIllustratorLayerScript({ sheet, box, mode: 'both', type: 'type2' });
  const { document, moved } = makeDocument({ back: true });
  vm.runInNewContext(script, { app: { documents: [document], activeDocument: document, redraw() {} }, alert() {}, ElementPlacement: { PLACEATBEGINNING: 1 }, ZOrderMethod: { BRINGTOFRONT: 'BRINGTOFRONT', SENDTOBACK: 'SENDTOBACK' } });
  assert.equal(moved.length, 5);
  assert.equal(document.layers[0].name, 'reg_1 2 0 25.00 1.00 5.00 100.00 1 0 2 0 0.00');
  assert.equal(document.pathItems[0].geometricBounds[0], registrationMarkPolygons({ ...box, x: sheet.w - box.x - box.w }, 'type2', 5, 1)[0][0][0] * pt);
});

test('Illustrator helper does not duplicate registration objects when rerun on the same page', () => {
  const script = buildIllustratorLayerScript({ sheet, box, mode: 'both', type: 'type2' });
  const { document, moved } = makeDocument();
  const messages = [];
  const context = { app: { documents: [document], activeDocument: document, redraw() {} }, alert: message => messages.push(message), ElementPlacement: { PLACEATBEGINNING: 1 }, ZOrderMethod: { BRINGTOFRONT: 'BRINGTOFRONT', SENDTOBACK: 'SENDTOBACK' } };
  vm.runInNewContext(script, context);
  vm.runInNewContext(script, context);
  assert.equal(moved.length, 5);
  assert.equal(document.layers.length, 3);
  assert.match(messages[1], /Could not identify/);
});

test('Illustrator helper requires every imported mark before changing layers', () => {
  const script = buildIllustratorLayerScript({ sheet, box, mode: 'marks', type: 'type2' });
  const { document, moved } = makeDocument();
  document.pathItems.pop(); // Remove guide box, then one L mark.
  document.pathItems.pop();
  const messages = [];
  vm.runInNewContext(script, { app: { documents: [document], activeDocument: document, redraw() {} }, alert: message => messages.push(message), ElementPlacement: { PLACEATBEGINNING: 1 }, ZOrderMethod: { BRINGTOFRONT: 'BRINGTOFRONT', SENDTOBACK: 'SENDTOBACK' } });
  assert.deepEqual(document.layers.map(layer => layer.name), ['Layer 1']);
  assert.equal(moved.length, 0);
  assert.match(messages[0], /Could not identify/);
});
