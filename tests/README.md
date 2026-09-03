# Packing checks

Run pure geometry and registration-box tests with `npm test`.

For Canvas/Worker coverage, run `npm run dev`, open its URL, then run this in
the browser console (or through a browser test runner):

```js
await (await import('/tests/contour-browser.js')).runPackingRegression()
```

This checks three asymmetric/curved fixtures at 0, 0.12 and 0.3 inch gaps,
all four pattern/cardinal-angle baselines, the old contour candidate, manual
quantity and rotation off. Every final layout is checked in vector space.
Counts are compared only after validation: a higher raw count with overlapping
cuts is not a valid quality baseline. Timing is reported, not asserted; the
bounded local improvement may vary with machine speed.

Auto validation flattens curves at 0.01 mm flatness and uses a 0.03 mm
gap/margin tolerance. Area is finished cut area / full paper area, not artwork
or rotated bounding-box area. Step & Repeat placement arithmetic is shared
from Phase 2A. Imported cut bounds now use true Bezier extrema rather than
control handles. Honeycomb adds a vector check that adjusts complete raster
rows, avoiding overlap without removing alternating rows.

For release QA, also import real PDFs, verify loading/settings lock and both
preview sides, export a duplex PDF, and compare reflected cut paths across the
full sheet (including arbitrary rotations). Physical printer registration and
cutter calibration still require a print/cut test.
