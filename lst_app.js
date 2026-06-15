// ============================================================
//  Land Surface Temperature (LST) Estimation
//  Sensors  : Landsat 5, 7, 8 (Thermal Band → LST in °C)
//  Algorithm: TOA Radiance → Brightness Temp → NDVI-based
//             Emissivity → LST (Weng et al. 2004)
//  Author   : NMSHE Team — SKUAST-K (rsgl@skuastkashmir.ac.in)
//  Lab      : Remote Sensing and GIS Lab (RSGL), SKUAST-Kashmir
// ============================================================


// ── Map Initialisation ───────────────────────────────────────
Map.setOptions('TERRAIN');
Map.style().set('cursor', 'crosshair');
Map.setCenter(74.8167, 34.112, 9);


// ── Constants ────────────────────────────────────────────────
var LST_PALETTE = [
  '#000080','#0000a7','#0000cf','#0000f7','#000dff',
  '#0030ff','#0054ff','#0077ff','#009aff','#00bdff',
  '#00e0fb','#18ffdf','#34ffc2','#51ffa6','#6dff8a',
  '#8aff6d','#a6ff51','#c2ff34','#dfff18','#fbf100',
  '#ffd000','#ffb000','#ff8f00','#ff6e00','#ff4e00',
  '#ff2d00','#f70d00','#cf0000','#a70000','#800000'
];

// Sensor configuration — all sensor-specific values in one place
var SENSOR_CONFIG = {
  'LANDSAT-5': {
    collection  : 'LANDSAT/LT05/C02/T1',
    thermalBand : 'B6',
    k1Key       : 'K1_CONSTANT_BAND_6',
    k2Key       : 'K2_CONSTANT_BAND_6',
    mlKey       : 'RADIANCE_MULT_BAND_6',
    alKey       : 'RADIANCE_ADD_BAND_6',
    ndviBands   : ['B4', 'B3'],   // NIR, Red
    rgbBands    : ['B4', 'B3', 'B2'],
    rgbVis      : { min: 20, max: 100 }
  },
  'LANDSAT-7': {
    collection  : 'LANDSAT/LE07/C01/T1',
    thermalBand : 'B6_VCID_1',
    k1Key       : 'K1_CONSTANT_BAND_6_VCID_1',
    k2Key       : 'K2_CONSTANT_BAND_6_VCID_1',
    mlKey       : 'RADIANCE_MULT_BAND_6_VCID_1',
    alKey       : 'RADIANCE_ADD_BAND_6_VCID_1',
    ndviBands   : ['B4', 'B3'],
    rgbBands    : ['B4', 'B3', 'B2'],
    rgbVis      : { min: 20, max: 100 }
  },
  'LANDSAT-8': {
    collection  : 'LANDSAT/LC08/C02/T1',
    thermalBand : 'B10',
    k1Key       : 'K1_CONSTANT_BAND_10',
    k2Key       : 'K2_CONSTANT_BAND_10',
    mlKey       : 'RADIANCE_MULT_BAND_10',
    alKey       : 'RADIANCE_ADD_BAND_10',
    ndviBands   : ['B5', 'B4'],   // NIR, Red
    rgbBands    : ['B5', 'B4', 'B3'],
    rgbVis      : { min: 0, max: 30000 }
  }
};


// ── Side Panel ───────────────────────────────────────────────
var mainPanel = ui.Panel({ style: { width: '350px' } });

mainPanel.add(ui.Label({
  value: 'Land Surface Temperature Estimates',
  style: { fontSize: '26px', fontWeight: 'bold', margin: '10px 8px 4px 8px' }
}));

mainPanel.add(ui.Label({
  value:
    'Land surface temperature (LST) is a key variable for modelling climate ' +
    'change, hydrology, and urban land use/land cover processes. This app ' +
    'automatically maps LST in degrees Celsius from Landsat 5, 7, and 8 ' +
    'using thermal brightness temperature values.',
  style: { fontSize: '14px', margin: '4px 8px 10px 8px' }
}));


// ── Sensor Selector ──────────────────────────────────────────
mainPanel.add(ui.Label({
  value: 'Select Imaging Sensor',
  style: { fontSize: '13px', fontWeight: 'bold', margin: '6px 0 2px 0' }
}));

var sensorSelector = ui.Select({ placeholder: 'Loading sensors…' });

ee.List(['LANDSAT-5', 'LANDSAT-7', 'LANDSAT-8'])
  .map(function(s) { return ee.String(s); })
  .evaluate(function(list) {
    sensorSelector.items().reset(list);
    sensorSelector.setPlaceholder('Select a sensor');
  });

mainPanel.add(sensorSelector);

mainPanel.add(ui.Label({
  value:
    'Regional data availability:\n' +
    '• Landsat-5 : 1990–1999 and 2008–2012\n' +
    '• Landsat-7 : 1999 onwards\n' +
    '• Landsat-8 : 2013 onwards',
  style: { fontSize: '11px', color: '#444', margin: '4px 0 10px 0', whiteSpace: 'pre' }
}));


// ── Date Range Selectors ─────────────────────────────────────
var yearStrings  = ee.List.sequence(1990, 2022).map(function(y) { return ee.Number(y).format('%04d'); });
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

mainPanel.add(ui.Label({ value: 'Start Date', style: { fontSize: '13px', fontWeight: 'bold', margin: '4px 0 2px 0' } }));
mainPanel.add(ui.Panel({
  widgets: [startYearSelector, startMonthSelector],
  layout: ui.Panel.Layout.flow('horizontal')
}));

mainPanel.add(ui.Label({ value: 'End Date', style: { fontSize: '13px', fontWeight: 'bold', margin: '6px 0 2px 0' } }));
mainPanel.add(ui.Panel({
  widgets: [endYearSelector, endMonthSelector],
  layout: ui.Panel.Layout.flow('horizontal')
}));


// ── Cloud Cover Threshold ────────────────────────────────────
mainPanel.add(ui.Label({
  value: 'Cloud Cover Threshold (1–100)',
  style: { fontSize: '13px', fontWeight: 'bold', margin: '6px 0 2px 0' }
}));
var cloudCoverInput = ui.Textbox({ placeholder: 'e.g. 20' });
mainPanel.add(cloudCoverInput);


// ── AOI Drawing Tools ────────────────────────────────────────
mainPanel.add(ui.Label({
  value: 'Draw Area of Interest (AOI)',
  style: { fontSize: '13px', fontWeight: 'bold', margin: '8px 0 2px 0' }
}));

var drawingTools = Map.drawingTools();
drawingTools.setShown(true);

// Clear any pre-existing layers
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
    params: { bbox: [0, 0, 1, 0.1], dimensions: '100x10', format: 'png', min: 0, max: 1, palette: LST_PALETTE },
    style: { stretch: 'horizontal', margin: '0 8px', maxHeight: '24px' }
  });

  return ui.Panel([
    ui.Label({ value: 'Land Surface Temperature (°C)', style: { fontWeight: 'bold', textAlign: 'center' } }),
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


// ── Statistics Chart Panel (created once, reused) ────────────
var chartPanel = ui.Panel({
  style: { height: '235px', width: '400px', position: 'bottom-right', shown: false }
});

// ── Statistics Button (created once, prevents duplicates) ────
var statsButton = ui.Button({ label: 'Get Statistics', style: { margin: '8px 0' } });
mainPanel.add(statsButton);


// ── Core LST Algorithm (runs for any sensor via config) ──────
function computeLST(img, cfg, aoi) {

  var k1 = img.get(cfg.k1Key);
  var k2 = img.get(cfg.k2Key);
  var ML = img.get(cfg.mlKey);
  var AL = img.get(cfg.alKey);

  // Step 1 — Top-of-Atmosphere radiance: L = ML × Qcal + AL
  var toaRadiance = img.expression(
    'ML * Qcal + AL',
    { ML: ee.Number(ML), Qcal: img.select(cfg.thermalBand), AL: ee.Number(AL) }
  ).rename('TOA');

  // Step 2 — Brightness temperature (Kelvin → Celsius)
  //   BT = K2 / ln(K1/L + 1) − 273.15
  var lnK1    = ee.Image.constant(k1).log();
  var lnTOA   = toaRadiance.log();
  var logDiff = lnK1.subtract(lnTOA);
  var bt      = ee.Image.constant(k2).add(logDiff)
                  .divide(logDiff)
                  .subtract(ee.Image.constant(273.15))
                  .rename('BTemp');

  // Step 3 — NDVI and Proportion of Vegetation (Pv)
  var ndvi   = img.normalizedDifference(cfg.ndviBands);
  var ndviMin = ee.Number(ndvi.reduceRegion({ reducer: ee.Reducer.min(), geometry: aoi, scale: 30, maxPixels: 1e9 }).values().get(0));
  var ndviMax = ee.Number(ndvi.reduceRegion({ reducer: ee.Reducer.max(), geometry: aoi, scale: 30, maxPixels: 1e9 }).values().get(0));

  var pv = ndvi.expression(
    '((x - xMin) / (xMax - xMin)) * ((x - xMin) / (xMax - xMin))',
    { x: ndvi.select('nd'), xMin: ndviMin, xMax: ndviMax }
  ).rename('pv');

  // Step 4 — Land Surface Emissivity: ε = 0.004 × Pv + 0.986
  var emissivity = pv.expression(
    '0.004 * Pv + 0.986', { Pv: pv.select('pv') }
  ).rename('emissivity').log();

  // Step 5 — LST: T / (1 + (λ × T / ρ) × ln ε)
  //   λ = 0.00115 µm (Landsat thermal band centre wavelength)
  //   ρ = 1.4388 µm·K
  var lst = bt.expression(
    'Bt / (1 + (0.00115 * Bt / 1.4388) * ln_em)',
    { Bt: bt.select('BTemp'), ln_em: emissivity.select('emissivity') }
  ).rename('LST');

  return lst;
}


// ── Main Estimation Function ─────────────────────────────────
function estimateLST() {

  Map.clear();

  // Re-add chart panel after Map.clear()
  chartPanel.style().set('shown', true);
  Map.add(chartPanel);

  var aoi        = drawingTools.layers().get(0).getEeObject();
  var sensorName = sensorSelector.getValue();
  var cfg        = SENSOR_CONFIG[sensorName];

  drawingTools.layers().get(0).setShown(false);
  drawingTools.setShape(null);
  Map.centerObject(aoi, 11);

  // Build date range
  var startDate = ee.Date.fromYMD(
    ee.Number.parse(startYearSelector.getValue()),
    ee.Number.parse(startMonthSelector.getValue()), 1);
  var endDate = ee.Date.fromYMD(
    ee.Number.parse(endYearSelector.getValue()),
    ee.Number.parse(endMonthSelector.getValue()), 28);

  // Filter collection
  var cloudThreshold = ee.Number.parse(cloudCoverInput.getValue() || '20');

  var requiredBands = cfg.rgbBands.concat([cfg.thermalBand])
    .filter(function(b) { return cfg.rgbBands.indexOf(b) === -1 || b === cfg.thermalBand; });

  var collection = ee.ImageCollection(cfg.collection)
    .filterDate(startDate, endDate)
    .filterBounds(aoi.centroid({ maxError: 1 }))
    .filter(ee.Filter.lte('CLOUD_COVER_LAND', cloudThreshold))
    .map(function(image) { return image.clip(aoi); })
    .select(cfg.rgbBands.concat([cfg.thermalBand]));

  // Pick least-cloudy image
  var bestImage = collection.sort('CLOUD_COVER_LAND').first();

  // Compute LST
  var lst = computeLST(bestImage, cfg, aoi);

  // Percentile stretch for display (robust to outliers)
  var minTemp = ee.Number(lst.reduceRegion({
    reducer: ee.Reducer.percentile([2.5]), geometry: aoi, scale: 30, maxPixels: 1e9
  }).values().get(0)).round();

  var maxTemp = ee.Number(lst.reduceRegion({
    reducer: ee.Reducer.percentile([97.5]), geometry: aoi, scale: 30, maxPixels: 1e9
  }).values().get(0)).round();

  // Add layers
  Map.addLayer(bestImage.clip(aoi), { bands: cfg.rgbBands, min: cfg.rgbVis.min, max: cfg.rgbVis.max }, 'True Colour Composite');
  Map.addLayer(lst.clamp(minTemp, maxTemp).clip(aoi), { palette: LST_PALETTE }, 'Land Surface Temperature');
  Map.add(buildLegend(minTemp.getInfo(), maxTemp.getInfo()));

  // Wire up statistics chart
  var acqDate  = ee.String(bestImage.get('DATE_ACQUIRED'));
  var chartTitle = ee.String('LST Distribution — ').cat(acqDate);

  statsButton.onClick(ui.util.debounce(function() {
    var chart = ui.Chart.image.histogram({
      image : lst,
      region: aoi,
      scale : 30
    }).setOptions({
      title   : chartTitle.getInfo(),
      legend  : { position: 'none' },
      hAxis   : { title: 'Temperature (°C)' },
      vAxis   : { title: 'Pixel Count' },
      series  : { 0: { color: '23cba7' } }
    });
    chartPanel.widgets().reset([chart]);
  }, 500));
}


// ── Submit Button ────────────────────────────────────────────
var submitButton = ui.Button({ label: 'Estimate LST', style: { margin: '10px 0 4px 0' } });
mainPanel.add(submitButton);
submitButton.onClick(estimateLST);


// ── Footer ───────────────────────────────────────────────────
mainPanel.add(ui.Label({
  value: '© Remote Sensing and GIS Lab (RSGL), SKUAST-Kashmir\nDeveloped by NMSHE Team (rsgl@skuastkashmir.ac.in)',
  style: { fontSize: '10px', color: '#555', margin: '6px 8px 8px 8px', whiteSpace: 'pre' }
}));

ui.root.add(mainPanel);
