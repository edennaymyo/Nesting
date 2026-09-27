import { DEFAULT_GRAPHTEC_MARK_TYPE, registrationMarkLayerName, registrationMarkPolygons, registrationMarksFitSheet } from './registration-marks.js';

function polygonBounds(points) {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function sideGeometry(box, type, length, thickness) {
  return {
    marks: registrationMarkPolygons(box, type, length, thickness).map(polygonBounds),
    box: [box.x, box.y, box.x + box.w, box.y + box.h],
  };
}

export function createIllustratorLayerConfig({ sheet, box, mode = 'marks', type = DEFAULT_GRAPHTEC_MARK_TYPE, length = 5, thickness = 1 }) {
  if (!['box', 'marks', 'both'].includes(mode)) throw new Error('Invalid registration output mode.');
  if (!sheet || !box || ![sheet.w, sheet.h, box.x, box.y, box.w, box.h].every(Number.isFinite) || box.x < 0 || box.y < 0 || box.w <= 0 || box.h <= 0 || box.x + box.w > sheet.w || box.y + box.h > sheet.h) throw new Error('Registration box must fit inside the paper.');
  if (mode !== 'box' && !registrationMarksFitSheet(sheet, box, type, length, thickness)) throw new Error('Registration marks must fit inside the paper.');
  const backBox = { ...box, x: sheet.w - box.x - box.w };
  return {
    sheet: [sheet.w, sheet.h],
    box: { ...box },
    mode,
    type,
    length,
    thickness,
    markLayer: registrationMarkLayerName(type, thickness, length),
    front: sideGeometry(box, type, length, thickness),
    back: sideGeometry(backBox, type, length, thickness),
  };
}

// Illustrator imports ordinary PDF optional-content groups inside one native
// layer. This companion script moves the imported vector paths into real layers.
export function buildIllustratorLayerScript(options = {}) {
  const { sheet, box, mode = 'marks', type = DEFAULT_GRAPHTEC_MARK_TYPE, length = 5, thickness = 1, fromMetadata = false } = options;
  let config = null;
  if (!fromMetadata) config = createIllustratorLayerConfig({ sheet, box, mode, type, length, thickness });
  return `// NestCut Illustrator layer organizer. Open the matching exported PDF first.
// ${fromMetadata ? 'Install once in Illustrator’s Scripting folder, then run from File > Scripts.' : 'Run with File > Scripts > Other Script.'}
// Inspect the Layers panel after running, then Save As an .ai file.
(function () {
  var config = ${JSON.stringify(config)};
  var pt = 72 / 25.4;
  var tolerance = 1.5; // PDF import coordinate rounding, in points.
  if (!app.documents.length) { alert('Open the matching NestCut PDF in Illustrator first.'); return; }
  var doc = app.activeDocument;
  if (!config) {
    var xmp = '';
    try { xmp = doc.XMPString || ''; } catch (ignored) {}
    var metadata = xmp.match(/<nestcut:registrationSettings>([^<]+)<\\/nestcut:registrationSettings>/);
    var settings = null;
    try { if (metadata) settings = decodeURIComponent(metadata[1]).split(','); } catch (ignored) { settings = null; }
    if (settings && settings.length === 12 && settings[0] === '1') {
      var sheetW = Number(settings[1]), sheetH = Number(settings[2]);
      var regBox = { x: Number(settings[3]), y: Number(settings[4]), w: Number(settings[5]), h: Number(settings[6]) };
      var regMode = settings[7], markLayer = settings[8];
      var type = Number(settings[9]) === 2 ? 'type2' : 'type1';
      var length = Number(settings[10]), thickness = Number(settings[11]);
      function markBounds(box) {
        var inward = type === 'type2', half = thickness / 2;
        var corners = [
          [box.x, box.y, inward ? 1 : -1, inward ? 1 : -1],
          [box.x + box.w, box.y, inward ? -1 : 1, inward ? 1 : -1],
          [box.x, box.y + box.h, inward ? 1 : -1, inward ? -1 : 1],
          [box.x + box.w, box.y + box.h, inward ? -1 : 1, inward ? -1 : 1]
        ];
        var result = [];
        for (var c = 0; c < corners.length; c++) {
          var x = corners[c][0], y = corners[c][1], dx = corners[c][2], dy = corners[c][3];
          var points = [[x-dx*half,y-dy*half],[x+dx*length,y-dy*half],[x+dx*length,y+dy*half],[x+dx*half,y+dy*half],[x+dx*half,y+dy*length],[x-dx*half,y+dy*length]];
          var xs = [], ys = [];
          for (var p = 0; p < points.length; p++) { xs.push(points[p][0]); ys.push(points[p][1]); }
          result.push([Math.min.apply(null,xs),Math.min.apply(null,ys),Math.max.apply(null,xs),Math.max.apply(null,ys)]);
        }
        return result;
      }
      function side(box) { return { marks: regMode === 'box' ? [] : markBounds(box), box: [box.x,box.y,box.x+box.w,box.y+box.h] }; }
      var backBox = { x: sheetW - regBox.x - regBox.w, y: regBox.y, w: regBox.w, h: regBox.h };
      config = { sheet: [sheetW,sheetH], mode: regMode, markLayer: markLayer, front: side(regBox), back: side(backBox) };
    }
    if (!config) { alert('This PDF has no readable NestCut layer settings. Export it again from the updated NestCut app.'); return; }
  }
  var artboard = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
  var width = artboard[2] - artboard[0];
  var height = artboard[1] - artboard[3];
  if (Math.abs(width - config.sheet[0] * pt) > 2 || Math.abs(height - config.sheet[1] * pt) > 2) {
    alert('The active artboard size does not match this NestCut export. No layers were changed.');
    return;
  }

  function expectedBounds(mm) {
    return [artboard[0] + mm[0] * pt, artboard[1] - mm[1] * pt,
      artboard[0] + mm[2] * pt, artboard[1] - mm[3] * pt];
  }
  function scoreBounds(item, expected) {
    var actual;
    try { actual = item.geometricBounds; } catch (ignored) { return -1; }
    var score = 0;
    for (var i = 0; i < 4; i++) {
      var difference = Math.abs(actual[i] - expected[i]);
      if (difference > tolerance) return -1;
      score += difference;
    }
    return score;
  }
  function collectCandidates() {
    var result = [], i, item;
    for (i = 0; i < doc.compoundPathItems.length; i++) {
      item = doc.compoundPathItems[i];
      if (!item.locked && !item.hidden && !alreadyOrganized(item)) result.push(item);
    }
    for (i = 0; i < doc.pathItems.length; i++) {
      item = doc.pathItems[i];
      if (item.parent.typename === 'CompoundPathItem' || item.locked || item.hidden || item.clipping || alreadyOrganized(item)) continue;
      result.push(item);
    }
    return result;
  }
  function alreadyOrganized(item) {
    var name = item.layer ? item.layer.name : '';
    return name === config.markLayer || name === 'registration_box';
  }
  var candidates = collectCandidates();
  function alreadyUsed(used, item) {
    for (var i = 0; i < used.length; i++) if (used[i] === item) return true;
    return false;
  }
  function matchOne(bounds, used, requireStroke) {
    var expected = expectedBounds(bounds), best = null, bestScore = 999999;
    for (var i = 0; i < candidates.length; i++) {
      var item = candidates[i];
      if (alreadyUsed(used, item)) continue;
      var appearance = item.typename === 'CompoundPathItem' ? item.pathItems[0] : item;
      if (!appearance || (requireStroke ? (!appearance.stroked || appearance.filled) : !appearance.filled)) continue;
      var score = scoreBounds(item, expected);
      if (score >= 0 && score < bestScore) { best = item; bestScore = score; }
    }
    return best;
  }
  function matchSide(side) {
    var used = [], marks = [], i, item;
    if (config.mode !== 'box') {
      for (i = 0; i < side.marks.length; i++) {
        item = matchOne(side.marks[i], used, false);
        if (!item) return null;
        used.push(item); marks.push(item);
      }
    }
    var box = null;
    if (config.mode !== 'marks') {
      box = matchOne(side.box, used, true);
      if (!box) return null;
    }
    return { marks: marks, box: box };
  }
  var matched = matchSide(config.front) || matchSide(config.back);
  if (!matched) {
    alert('Could not identify all registration vector objects. No layers were changed. Open the matching exported PDF directly, without scaling it.');
    return;
  }
  function findOrCreateLayer(name) {
    for (var j = 0; j < doc.layers.length; j++) if (doc.layers[j].name === name) return doc.layers[j];
    var layer = doc.layers.add();
    layer.name = name;
    return layer;
  }
  if (doc.layers.length === 1 && doc.layers[0].name === 'Layer 1') doc.layers[0].name = 'print';
  if (matched.box) {
    var boxLayer = findOrCreateLayer('registration_box');
    matched.box.move(boxLayer, ElementPlacement.PLACEATBEGINNING);
  }
  if (matched.marks.length) {
    var markLayer = findOrCreateLayer(config.markLayer);
    for (var k = 0; k < matched.marks.length; k++) {
      matched.marks[k].move(markLayer, ElementPlacement.PLACEATBEGINNING);
    }
  }
  app.redraw();
  alert('Registration objects moved to native Illustrator layers. Inspect the Layers panel, then Save As an .ai file.');
}());
`;
}
