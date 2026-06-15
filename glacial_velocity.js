// ============================================================
//  Glacial Velocity Estimation — Western Himalayan Glaciers
//  Algorithm : CNC Cross-Correlation on Sentinel-1A (VV)
//  Author    : Shahid Shuja Shafai  <shahidshafai@gmail.com>
//  Lab       : Himalayan Cryospheric Research Lab, University of Kashmir
// ============================================================


// ── Map Initialisation ──────────────────────────────────────
Map.setOptions('Satellite');
Map.style().set('cursor', 'crosshair');
Map.setCenter(74.9081, 33.9828, 11);


// ── Colour Palette (cold-to-hot, 30 stops) ──────────────────
var VELOCITY_PALETTE = [
  '#000080','#0000a7','#0000cf','#0000f7','#000dff',
  '#0030ff','#0054ff','#0077ff','#009aff','#00bdff',
  '#00e0fb','#18ffdf','#34ffc2','#51ffa6','#6dff8a',
  '#8aff6d','#a6ff51','#c2ff34','#dfff18','#fbf100',
  '#ffd000','#ffb000','#ff8f00','#ff6e00','#ff4e00',
  '#ff2d00','#f70d00','#cf0000','#a70000','#800000'
];

// SAR signal clamp range (dB) — valid backscatter window for glacier ice
var SAR_MIN_DB = -20;
var SAR_MAX_DB = -6;

// Buffer around glacier bounding box (metres)
var GLACIER_BUFFER_M = 1500;

// Sentinel-1 relative orbit for Western Himalayas
var S1_ORBIT_NUMBER = 34;

// Asset path prefix for glacier shapefiles
var GLACIER_ASSET_PREFIX = 'users/shahidshafai/glaciers/';


// ── Side Panel ───────────────────────────────────────────────
var mainPanel = ui.Panel({ style: { width: '500px' } });

mainPanel.add(ui.Label({
  value: 'Glacial Velocity Estimation in Western Himalayan Glaciers',
  style: { fontSize: '26px', fontWeight: 'bold', margin: '10px 8px 4px 8px' }
}));

mainPanel.add(ui.Label({
  value:
    'This app computes glacial velocity between two time intervals using ' +
    'Sentinel-1A SAR intensity imagery. It is designed and tuned for ' +
    'Western Himalayan glaciers and employs the CNC cross-correlation ' +
    'algorithm to estimate pixel shift in the X and Y directions. ' +
    'Velocity is the resultant of those shifts between the acquisition dates.',
  style: { fontSize: '14px', margin: '4px 8px 8px 8px' }
}));

mainPanel.add(ui.Label({
  value: '© Himalayan Cryospheric Research Lab, University of Kashmir',
  style: { fontSize: '10px', color: '#555', margin: '0 8px 12px 8px' }
}));


// ── Glacier & Max-Velocity Row ───────────────────────────────
mainPanel.add(ui.Label({
  value: 'Select Glacier',
  style: { fontSize: '12px', fontWeight: 'bold' }
}));

var glacierSelector = ui.Select({ placeholder: 'Loading glaciers…' });

ee.List(['drung_drung', 'kolahoi', 'machoi', 'wakhalbal'])
  .map(function(name) { return ee.String(name); })
  .evaluate(function(list) {
    glacierSelector.items().reset(list);
    glacierSelector.setPlaceholder('Select a glacier');
  });

mainPanel.add(ui.Label({
  value: 'Select Approximate Maximum Velocity (m)',
  style: { fontSize: '12px', fontWeight: 'bold', margin: '8px 0 0 0' }
}));

var maxVelocitySelector = ui.Select({ placeholder: 'Loading velocities…' });

ee.List.sequence(5, 50, 5)
  .map(function(v) { return ee.Number(v).format('%02d'); })
  .evaluate(function(list) {
    maxVelocitySelector.items().reset(list);
    maxVelocitySelector.setPlaceholder('Select maximum velocity');
  });

var glacierVelRow = ui.Panel({
  widgets: [glacierSelector, maxVelocitySelector],
  layout: ui.Panel.Layout.flow('horizontal')
});
mainPanel.add(glacierVelRow);


// ── Date Range Selectors ─────────────────────────────────────
var START_YEARS = ee.List.sequence(2018, 2022);
var START_MONTHS = ee.List.sequence(5, 10);

var yearStrings  = START_YEARS .map(function(y) { return ee.Number(y).format('%04d'); });
var monthStrings = START_MONTHS.map(function(m) { return ee.Number(m).format('%02d'); });

var startYearSelector  = ui.Select({ placeholder: 'Loading…' });
var startMonthSelector = ui.Select({ placeholder: 'Loading…' });
var endYearSelector    = ui.Select({ placeholder: 'Loading…' });
var endMonthSelector   = ui.Select({ placeholder: 'Loading…' });

// Populate all four dropdowns from a single evaluate call each
yearStrings.evaluate(function(list) {
  startYearSelector .items().reset(list); startYearSelector .setPlaceholder('Year');
  endYearSelector   .items().reset(list); endYearSelector   .setPlaceholder('Year');
});

monthStrings.evaluate(function(list) {
  startMonthSelector.items().reset(list); startMonthSelector.setPlaceholder('Month');
  endMonthSelector  .items().reset(list); endMonthSelector  .setPlaceholder('Month');
});

mainPanel.add(ui.Label({ value: 'Start Date', style: { fontSize: '12px', fontWeight: 'bold', margin: '8px 0 0 0' } }));
mainPanel.add(ui.Panel({
  widgets: [startYearSelector, startMonthSelector],
  layout: ui.Panel.Layout.flow('horizontal')
}));

mainPanel.add(ui.Label({ value: 'End Date', style: { fontSize: '12px', fontWeight: 'bold', margin: '8px 0 0 0' } }));
mainPanel.add(ui.Panel({
  widgets: [endYearSelector, endMonthSelector],
  layout: ui.Panel.Layout.flow('horizontal')
}));


// ── Algorithm Parameters ─────────────────────────────────────
mainPanel.add(ui.Label({
  value: 'Cross-Correlation Max Gap (default: 5)',
  style: { fontSize: '12px', fontWeight: 'bold', margin: '8px 0 0 0' }
}));
var maxGapInput = ui.Textbox({ placeholder: '5' });
mainPanel.add(maxGapInput);

mainPanel.add(ui.Label({
  value: 'Cross-Correlation Window Size (default: 19)',
  style: { fontSize: '12px', fontWeight: 'bold', margin: '8px 0 0 0' }
}));
var windowSizeInput = ui.Textbox({ placeholder: '19' });
mainPanel.add(windowSizeInput);


// ── Submit Button ────────────────────────────────────────────
var submitButton = ui.Button({ label: 'Get Glacial Velocity', style: { margin: '12px 0' } });
mainPanel.add(submitButton);


// ── Legend Builder ───────────────────────────────────────────
function buildLegend(minVal, maxVal) {
  var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: {
      bbox: [0, 0, 1, 0.1],
      dimensions: '100x10',
      format: 'png',
      min: 0,
      max: 1,
      palette: VELOCITY_PALETTE
    },
    style: { stretch: 'horizontal', margin: '0 8px', maxHeight: '24px' }
  });

  var midVal = ((maxVal - minVal) / 2 + minVal);

  var legendLabels = ui.Panel({
    widgets: [
      ui.Label(minVal,  { margin: '4px 8px' }),
      ui.Label(midVal,  { margin: '4px 8px', textAlign: 'center', stretch: 'horizontal' }),
      ui.Label(maxVal,  { margin: '4px 8px' })
    ],
    layout: ui.Panel.Layout.flow('horizontal')
  });

  return ui.Panel([
    ui.Label({ value: 'Cumulative Glacial Velocity Estimates (m)', style: { fontWeight: 'bold' } }),
    colorBar,
    legendLabels
  ]);
}


// ── Main Computation ─────────────────────────────────────────
function computeGlacialVelocity() {

  Map.clear();

  // Read UI values with safe defaults
  var maxVel   = ee.Number.parse(maxVelocitySelector.getValue() || '30');
  var maxGap   = ee.Number.parse(maxGapInput.getValue()         || '5');
  var winSize  = ee.Number.parse(windowSizeInput.getValue()     || '19');

  // Build glacier AOI
  var glacierPath = GLACIER_ASSET_PREFIX + glacierSelector.getValue();
  var glacierFC   = ee.FeatureCollection(glacierPath);
  var aoiBounds   = glacierFC.geometry().bounds().buffer(GLACIER_BUFFER_M);

  Map.addLayer(glacierFC, {}, 'Glacier Shapefile');
  Map.centerObject(aoiBounds, 12);
  Map.add(buildLegend(0, maxVelocitySelector.getValue()));

  // Build date range (use day 1–28 to be safe across all months)
  var startDate = ee.Date.fromYMD(
    ee.Number.parse(startYearSelector.getValue()),
    ee.Number.parse(startMonthSelector.getValue()), 1);
  var endDate = ee.Date.fromYMD(
    ee.Number.parse(endYearSelector.getValue()),
    ee.Number.parse(endMonthSelector.getValue()), 28);

  // Sentinel-1 IW Descending collection filtered to study orbit
  var s1Collection = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
    .filterMetadata('resolution_meters', 'equals', 10)
    .filterBounds(aoiBounds)
    .filter(ee.Filter.inList('relativeOrbitNumber_start', [S1_ORBIT_NUMBER]))
    .select(['VV', 'VH', 'angle']);

  var s1Filtered = s1Collection.filterDate(startDate, endDate);

  // Temporal RGB composite (VV, VH, VV/VH) for visual reference
  var vvMean  = s1Filtered.select('VV').mean().clamp(SAR_MIN_DB, SAR_MAX_DB);
  var vhMean  = s1Filtered.select('VH').mean().clamp(SAR_MIN_DB, SAR_MAX_DB);
  var ratioVV = vvMean.divide(vhMean);
  Map.addLayer(
    vvMean.addBands(vhMean).addBands(ratioVV).clip(glacierFC),
    {}, 'Temporal RGB Composite (VV / VH / VV÷VH)'
  );

  // VV-only time series for velocity computation
  var vvSeries = s1Filtered.select('VV');
  var imageList = vvSeries.toList(vvSeries.size());

  // Compute pairwise displacement & cross-correlation velocity
  var velocityList = imageList.map(function(currentImg) {
    var idx  = imageList.indexOf(currentImg);
    var prevIdx = ee.Algorithms.If(idx.eq(0), 0, idx.subtract(1));

    var img1 = ee.Image(imageList.get(prevIdx)).clip(aoiBounds).clamp(SAR_MIN_DB, SAR_MAX_DB);
    var img2 = ee.Image(currentImg)            .clip(aoiBounds).clamp(SAR_MIN_DB, SAR_MAX_DB);

    // Build a readable band name: "YYYY-MM-DD x YYYY-MM-DD"
    var date1Str = ee.Date(img1.get('system:time_start')).format('YYYY-MM-dd');
    var date2Str = ee.Date(img2.get('system:time_start')).format('YYYY-MM-dd');
    var bandName = date1Str.cat('_to_').cat(date2Str);

    // Co-register img2 onto img1 before cross-correlation
    var displacement = img2.displacement({
      referenceImage: img1,
      maxOffset: 50.0,    // max expected offset in metres
      patchWidth: 100.0   // matching patch size in metres
    });
    var registeredImg2 = img2.displace(displacement);

    // CNC cross-correlation → pixel shift magnitude (metres)
    var crossCorr = ee.Algorithms.CrossCorrelation({
      imageA: img1,
      imageB: registeredImg2,
      maxGap: maxGap,
      windowSize: winSize
    });

    var velocity = crossCorr.expression(
      'sqrt(dx * dx + dy * dy)',
      { dx: crossCorr.select('deltaX'), dy: crossCorr.select('deltaY') }
    ).rename(bandName).clip(aoiBounds);

    return velocity;
  });

  // Normalise band names so ImageCollection can be built
  var normalisedList = velocityList.map(function(img) {
    return ee.Image(img).rename('velocity').set('system:index', 'img');
  });

  var velocityCollection = ee.ImageCollection(normalisedList);
  var visParams = { palette: VELOCITY_PALETTE };

  var cumulativeVelocity = velocityCollection
    .reduce(ee.Reducer.sum())
    .clamp(0, maxVel)
    .clipToCollection(glacierFC);

  var meanVelocity = velocityCollection
    .reduce(ee.Reducer.mean())
    .clipToCollection(glacierFC);

  Map.addLayer(meanVelocity,       visParams, 'Mean Bi-Weekly Glacial Velocity');
  Map.addLayer(cumulativeVelocity, visParams, 'Cumulative Glacial Velocity');
}

submitButton.onClick(computeGlacialVelocity);


// ── Footer ───────────────────────────────────────────────────
mainPanel.add(ui.Label({
  value: 'Developed by: Shahid Shuja Shafai (shahidshafai@gmail.com)',
  style: { fontSize: '10px', color: '#555', margin: '4px 8px 8px 8px' }
}));

ui.root.add(mainPanel);
