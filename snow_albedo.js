// ============================================================
//  Snow / Glacial Albedo Estimation — Himalayas
//  Sensor    : Landsat 8 (Surface Reflectance, Collection 2)
//  Methods   : Knap et al. (1999) | Liang et al. (2000)
//  Author    : Shahid Shuja Shafai  <shahidshafai@gmail.com>
//  Lab       : Himalayan Cryospheric Research Lab, University of Kashmir
// ============================================================


// ── Map Initialisation ───────────────────────────────────────
Map.setOptions('TERRAIN');
Map.style().set('cursor', 'crosshair');
Map.setCenter(75.8124, 35.8858, 9);


// ── Constants ────────────────────────────────────────────────
var ALBEDO_PALETTE = [
  '#000080','#0000a7','#0000cf','#0000f7','#000dff',
  '#0030ff','#0054ff','#0077ff','#009aff','#00bdff',
  '#00e0fb','#18ffdf','#34ffc2','#51ffa6','#6dff8a',
  '#8aff6d','#a6ff51','#c2ff34','#dfff18','#fbf100',
  '#ffd000','#ffb000','#ff8f00','#ff6e00','#ff4e00',
  '#ff2d00','#f70d00','#cf0000','#a70000','#800000'
];

// Landsat 8 C02 L2 SR scale factors (USGS standard)
var SR_SCALE  = 0.0000275;
var SR_OFFSET = -0.2;


// ── Side Panel ───────────────────────────────────────────────
var mainPanel = ui.Panel({ style: { width: '350px' } });

mainPanel.add(ui.Label({
  value: 'Snow Albedo in the Himalayas',
  style: { fontSize: '26px', fontWeight: 'bold', margin: '10px 8px 4px 8px' }
}));

mainPanel.add(ui.Label({
  value:
    'This app estimates spectral albedo of snow and glacial surfaces using ' +
    'Landsat 8 surface reflectance imagery. Two broadband albedo algorithms ' +
    'are provided: Knap et al. (1999) using green and NIR bands, and ' +
    'Liang et al. (2000) using a multi-band weighted combination.',
  style: { fontSize: '14px', margin: '4px 8px 4px 8px' }
}));

mainPanel.add(ui.Label({
  value: 'References: Knap et al. 1999 | Liang et al. 2000',
  style: { fontSize: '11px', color: '#555', margin: '0 8px 10px 8px' }
}));


// ── Algorithm Selector ───────────────────────────────────────
mainPanel.add(ui.Label({
  value: 'Select Albedo Algorithm',
  style: { fontSize: '13px', fontWeight: 'bold', margin: '4px 0 2px 0' }
}));

var methodSelector = ui.Select({ placeholder: 'Loading methods…' });

ee.List(['Knap', 'Liang'])
  .map(function(m) { return ee.String(m); })
  .evaluate(function(list) {
    methodSelector.items().reset(list);
    methodSelector.setPlaceholder('Choose an algorithm');
  });

mainPanel.add(methodSelector);


// ── Date Range Selectors ─────────────────────────────────────
var yearStrings  = ee.List.sequence(2014, 2022).map(function(y) { return ee.Number(y).format('%04d'); });
var monthStrings = ee.List.sequence(1, 12)     .map(function(m) { return ee.Number(m).format('%02d'); });

var startYearSelector  = ui.Select({ placeholder: 'Loading…' });
var startMonthSelector = ui.Select({ placeholder: 'Loading…' });
var endYearSelector    = ui.Select({ placeholder: 'Loading…' });
var endMonthSelector   = ui.Select({ placeholder: 'Loading…' });

// Single evaluate call per list — populates both start and end dropdowns
yearStrings.evaluate(function(list) {
  startYearSelector .items().reset(list); startYearSelector .setPlaceholder('Year');
  endYearSelector   .items().reset(list); endYearSelector   .setPlaceholder('Year');
});
monthStrings.evaluate(function(list) {
  startMonthSelector.items().reset(list); startMonthSelector.setPlaceholder('Month');
  endMonthSelector  .items().reset(list); endMonthSelector  .setPlaceholder('Month');
});

mainPanel.add(ui.Label({ value: 'Start Date', style: { fontSize: '13px', fontWeight: 'bold', margin: '6px 0 2px 0' } }));
mainPanel.add(ui.Panel({
  widgets: [startYearSelector, startMonthSelector],
  layout: ui.Panel.Layout.flow('horizontal')
}));

mainPanel.add(ui.Label({ value: 'End Date', style: { fontSize: '13px', fontWeight: 'bold', margin: '6px 0 2px 0' } }));
mainPanel.add(ui.Panel({
  widgets: [endYearSelector, endMonthSelector],
  layout: ui.Panel.Layout.flow('horizontal')
}));


// ── AOI Drawing Tools ────────────────────────────────────────
mainPanel.add(ui.Label({
  value: 'Draw Area of Interest (AOI)',
  style: { fontSize: '13px', fontWeight: 'bold', margin: '8px 0 2px 0' }
}));

var drawingTools = Map.drawingTools();
drawingTools.setShown(true);

while (drawingTools.layers().length() > 0) {
  drawingTools.layers().remove(drawingTools.layers().get(0));
}
drawingTools.layers().add(
  ui.Map.GeometryLayer({ geometries: null, name: 'geometry', color: '#000080', shown: false })
);

function clearGeometry() {
  var layers = drawingTools.layers();
  layers.get(0).geometries().remove(layers.get(0).geometries().get(0));
}

mainPanel.add(ui.Panel({
  widgets: [
    ui.Label({ value: 'Draw AOI', style: { fontSize: '11px' } }),
    ui.Button({
      label: '⬛ Rectangle',
      onClick: function() { clearGeometry(); drawingTools.setShape('rectangle'); drawingTools.draw(); },
      style: { stretch: 'horizontal', width: '90px' }
    }),
    ui.Button({
      label: '🔺 Polygon',
      onClick: function() { clearGeometry(); drawingTools.setShape('polygon'); drawingTools.draw(); },
      style: { stretch: 'horizontal', width: '90px' }
    })
  ],
  layout: ui.Panel.Layout.flow('horizontal')
}));


// ── Legend Builder ───────────────────────────────────────────
function buildLegend(minVal, maxVal) {
  var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: { bbox: [0, 0, 1, 0.1], dimensions: '100x10', format: 'png', min: 0, max: 1, palette: ALBEDO_PALETTE },
    style: { stretch: 'horizontal', margin: '0 8px', maxHeight: '24px' }
  });

  return ui.Panel([
    ui.Label({ value: 'Spectral Albedo (0–1)', style: { fontWeight: 'bold', textAlign: 'center' } }),
    colorBar,
    ui.Panel({
      widgets: [
        ui.Label(minVal, { margin: '4px 8px' }),
        ui.Label(((maxVal - minVal) / 2 + minVal), { margin: '4px 8px', textAlign: 'center', stretch: 'horizontal' }),
        ui.Label(maxVal, { margin: '4px 8px' })
      ],
      layout: ui.Panel.Layout.flow('horizontal')
    })
  ]);
}


// ── Chart Panel & Stats Button (created once) ────────────────
var chartPanel = ui.Panel({
  style: { height: '235px', width: '400px', position: 'bottom-right', shown: false }
});

var statsButton = ui.Button({ label: 'Get Statistics', style: { margin: '8px 0' } });
mainPanel.add(statsButton);


// ── Landsat 8 L2 Preprocessing ──────────────────────────────
// Apply USGS scale factors to convert DN to surface reflectance
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(SR_SCALE).add(SR_OFFSET);
  return image.addBands(opticalBands, null, true);
}

// Mask clouds and cloud shadows using the QA_PIXEL band (Landsat C02 L2)
function maskClouds(image) {
  var qa = image.select('QA_PIXEL');
  // Bit 3 = cloud, Bit 4 = cloud shadow
  var cloudMask = qa.bitwiseAnd(1 << 3).eq(0)
                    .and(qa.bitwiseAnd(1 << 4).eq(0));
  return image.updateMask(cloudMask);
}


// ── Albedo Algorithms ────────────────────────────────────────
// Knap et al. (1999): α = 0.726·B3 − 0.322·B3² − 0.015·B5 + 0.581·B5²
//   B3 = Green (SR_B3), B5 = NIR (SR_B5)
function computeKnap(image) {
  var albedo = image.expression(
    '0.726*b3 - 0.322*b3*b3 - 0.015*b5 + 0.581*b5*b5',
    { b3: image.select('SR_B3'), b5: image.select('SR_B5') }
  ).rename('ALBD');
  return image.addBands(albedo);
}

// Liang et al. (2000): α = 0.356·B2 + 0.130·B4 + 0.373·B5 + 0.085·B6 + 0.072·B7 − 0.0018
//   B2=Blue, B4=Red, B5=NIR, B6=SWIR-1, B7=SWIR-2
function computeLiang(image) {
  var albedo = image.expression(
    '0.356*b2 + 0.130*b4 + 0.373*b5 + 0.085*b6 + 0.072*b7 - 0.0018',
    {
      b2: image.select('SR_B2'),
      b4: image.select('SR_B4'),
      b5: image.select('SR_B5'),
      b6: image.select('SR_B6'),
      b7: image.select('SR_B7')
    }
  ).rename('ALBD');
  return image.addBands(albedo);
}


// ── Main Estimation Function ─────────────────────────────────
function estimateAlbedo() {

  Map.clear();

  var aoi    = drawingTools.layers().get(0).getEeObject();
  var method = methodSelector.getValue();

  drawingTools.layers().get(0).setShown(false);
  drawingTools.setShape(null);
  Map.centerObject(aoi, 11);

  // Re-add chart panel after Map.clear()
  chartPanel.style().set('shown', true);
  Map.add(chartPanel);

  // Date range
  var startDate = ee.Date.fromYMD(
    ee.Number.parse(startYearSelector.getValue()),
    ee.Number.parse(startMonthSelector.getValue()), 1);
  var endDate = ee.Date.fromYMD(
    ee.Number.parse(endYearSelector.getValue()),
    ee.Number.parse(endMonthSelector.getValue()), 28);

  // Build Landsat 8 C02 L2 collection with cloud masking and scale factors
  var collection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterDate(startDate, endDate)
    .filterBounds(aoi)
    .map(maskClouds)
    .map(applyScaleFactors)
    .select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7']);

  // Apply selected algorithm to every image in the collection
  var albedoCollection = (method === 'Knap')
    ? collection.map(computeKnap)
    : collection.map(computeLiang);

  var meanAlbedo = albedoCollection.select('ALBD').mean().clamp(0, 1).clip(aoi);
  var layerName  = 'Albedo — ' + method + ' Method';

  // True colour composite for context
  Map.addLayer(
    collection.mean().clip(aoi),
    { bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 0.02, max: 0.3 },
    'True Colour Composite'
  );
  Map.addLayer(meanAlbedo, { palette: ALBEDO_PALETTE }, layerName);
  Map.add(buildLegend(0, 1));

  // Wire up statistics time-series chart
  statsButton.onClick(ui.util.debounce(function() {
    var chart = ui.Chart.image.seriesByRegion({
      imageCollection: albedoCollection,
      regions        : aoi,
      reducer        : ee.Reducer.mean(),
      band           : 'ALBD',
      scale          : 30,
      xProperty      : 'system:time_start'
    }).setOptions({
      title : 'Spatial Average Albedo — ' + method + ' Method',
      legend: { position: 'none' },
      hAxis : { title: 'Date' },
      vAxis : { title: 'Albedo (0–1)', viewWindow: { min: 0, max: 1 } },
      series: { 0: { color: '23cba7' } }
    });

    chartPanel.widgets().reset([chart]);
  }, 500));
}


// ── Submit Button ────────────────────────────────────────────
var submitButton = ui.Button({ label: 'Estimate Albedo', style: { margin: '10px 0 4px 0' } });
mainPanel.add(submitButton);
submitButton.onClick(estimateAlbedo);


// ── Footer ───────────────────────────────────────────────────
mainPanel.add(ui.Label({
  value: '© Himalayan Cryospheric Research Lab, University of Kashmir\nDeveloped by: Shahid Shuja Shafai (shahidshafai@gmail.com)',
  style: { fontSize: '10px', color: '#555', margin: '6px 8px 8px 8px', whiteSpace: 'pre' }
}));

ui.root.add(mainPanel);
