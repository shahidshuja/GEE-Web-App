// ============================================================
//  LULC Mapping — Kashmir Valley
//  Sensors  : Sentinel-2 | Landsat-8
//  Models   : Random Forest | SVM | Gradient Tree Boost | CART
//  AOI      : Draw manually OR select districts via checkboxes
//  Author   : Shahid Shuja Shafai (shafai@skuastkashmir.ac.in)
//  Lab      : Remote Sensing and GIS Lab (RSGL), SKUAST-Kashmir
// ============================================================


// ── Map Initialisation ───────────────────────────────────────
Map.setOptions('ROADMAP');
Map.style().set('cursor', 'crosshair');
Map.addLayer(kmr, {}, 'KMR Boundary');
Map.centerObject(kmr, 9);


// ── Constants ────────────────────────────────────────────────
var LULC_ASSET_PREFIX     = 'projects/ee-shahidskuast/assets/lulc_app/';
var DISTRICT_ASSET_PREFIX = 'projects/ee-shahidskuast/assets/Districts/';
var KMR_BOUNDS            = kmr.geometry().bounds();

var LULC_CLASSES = [
  'Urban', 'Agriculture', 'Fallow', 'AlpineForest',
  'Forest', 'Water', 'Snow', 'AquaticVegetation', 'Grassland'
];

var DISTRICT_NAMES = [
  'Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Kishtwar',
  'Kulgam', 'Kupwara', 'Pulwama', 'Shopian', 'Srinagar'
];

// Distinct colours for up to 9 LULC classes
var CLASS_COLORS = [
  '#1f78b4', '#33a02c', '#e31a1c', '#ff7f00',
  '#6a3d9a', '#fdbf6f', '#a6cee3', '#b15928', '#fb9a99'
];


// ── Side Panel ───────────────────────────────────────────────
var mainPanel = ui.Panel({ style: { width: '400px' } });

mainPanel.add(ui.Label({
  value: 'LULC Mapping for Kashmir Valley',
  style: { fontSize: '26px', fontWeight: 'bold', margin: '10px 8px 4px 8px' }
}));

mainPanel.add(ui.Label({
  value:
    'This app uses machine learning algorithms to generate land use / land ' +
    'cover (LULC) maps. Choose Sentinel-2 or Landsat-8 as the input image ' +
    'stack, select your preferred classifier, pick the land cover classes ' +
    'and area of interest, then click Derive LULC.',
  style: { fontSize: '14px', margin: '4px 8px 10px 8px' }
}));


// ── ML Model Selector ────────────────────────────────────────
mainPanel.add(ui.Label({ value: 'Select ML Model', style: { fontSize: '13px', fontWeight: 'bold' } }));

var modelSelector = ui.Select({ placeholder: 'Loading models…' });
ee.List(['RF', 'SVM', 'GTB', 'CART'])
  .map(function(m) { return ee.String(m); })
  .evaluate(function(list) {
    modelSelector.items().reset(list);
    modelSelector.setPlaceholder('Choose a model');
  });
mainPanel.add(modelSelector);


// ── Sensor Selector ──────────────────────────────────────────
mainPanel.add(ui.Label({ value: 'Select Sensor', style: { fontSize: '13px', fontWeight: 'bold', margin: '6px 0 2px 0' } }));

var sensorSelector = ui.Select({ placeholder: 'Loading sensors…' });
ee.List(['Sentinel-2', 'Landsat-8'])
  .map(function(s) { return ee.String(s); })
  .evaluate(function(list) {
    sensorSelector.items().reset(list);
    sensorSelector.setPlaceholder('Choose a sensor');
  });
mainPanel.add(sensorSelector);


// ── Cloud Cover ──────────────────────────────────────────────
mainPanel.add(ui.Label({ value: 'Cloud Cover Threshold (1–100)', style: { fontSize: '13px', fontWeight: 'bold', margin: '6px 0 2px 0' } }));
var cloudCoverInput = ui.Textbox({ placeholder: 'e.g. 20' });
mainPanel.add(cloudCoverInput);


// ── Year Selector ────────────────────────────────────────────
mainPanel.add(ui.Label({ value: 'Select Year', style: { fontSize: '13px', fontWeight: 'bold', margin: '6px 0 2px 0' } }));
var yearSelector = ui.Select({ placeholder: 'Loading years…' });
ee.List.sequence(2014, 2024)
  .map(function(y) { return ee.Number(y).format('%04d'); })
  .evaluate(function(list) {
    yearSelector.items().reset(list);
    yearSelector.setPlaceholder('Select a year');
  });
mainPanel.add(yearSelector);


// ── Land Cover Class Checkboxes ──────────────────────────────
mainPanel.add(ui.Label({ value: 'Select Land Cover Classes', style: { fontSize: '13px', fontWeight: 'bold', margin: '8px 0 2px 0' } }));

var lulcCheckboxes = {};
LULC_CLASSES.forEach(function(cls) {
  lulcCheckboxes[cls] = ui.Checkbox(cls);
});

mainPanel.add(ui.Panel({
  widgets: [lulcCheckboxes['Urban'], lulcCheckboxes['Agriculture'], lulcCheckboxes['Fallow'], lulcCheckboxes['AlpineForest']],
  layout: ui.Panel.Layout.flow('horizontal')
}));
mainPanel.add(ui.Panel({
  widgets: [lulcCheckboxes['Forest'], lulcCheckboxes['Water'], lulcCheckboxes['Snow'], lulcCheckboxes['AquaticVegetation']],
  layout: ui.Panel.Layout.flow('horizontal')
}));
mainPanel.add(ui.Panel({
  widgets: [lulcCheckboxes['Grassland']],
  layout: ui.Panel.Layout.flow('horizontal')
}));

function getSelectedClasses() {
  return LULC_CLASSES.filter(function(cls) {
    return lulcCheckboxes[cls].getValue();
  });
}


// ── District Checkboxes ──────────────────────────────────────
mainPanel.add(ui.Label({
  value: 'Select District(s) as AOI  —  or draw below',
  style: { fontSize: '13px', fontWeight: 'bold', margin: '8px 0 2px 0' }
}));

var districtCheckboxes = {};
DISTRICT_NAMES.forEach(function(d) {
  districtCheckboxes[d] = ui.Checkbox(d);
});

mainPanel.add(ui.Panel({
  widgets: [districtCheckboxes['Anantnag'], districtCheckboxes['Bandipora'], districtCheckboxes['Baramulla']],
  layout: ui.Panel.Layout.flow('horizontal')
}));
mainPanel.add(ui.Panel({
  widgets: [districtCheckboxes['Budgam'], districtCheckboxes['Kishtwar'], districtCheckboxes['Kupwara']],
  layout: ui.Panel.Layout.flow('horizontal')
}));
mainPanel.add(ui.Panel({
  widgets: [districtCheckboxes['Kulgam'], districtCheckboxes['Pulwama'], districtCheckboxes['Shopian']],
  layout: ui.Panel.Layout.flow('horizontal')
}));
mainPanel.add(ui.Panel({
  widgets: [districtCheckboxes['Srinagar']],
  layout: ui.Panel.Layout.flow('horizontal')
}));

function getSelectedDistricts() {
  return DISTRICT_NAMES.filter(function(d) {
    return districtCheckboxes[d].getValue();
  });
}


// ── AOI Drawing Tools ────────────────────────────────────────
mainPanel.add(ui.Label({
  value: 'Draw AOI Manually (if no districts selected above)',
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
    ui.Button({
      label: '⬛ Rectangle',
      onClick: function() { clearGeometry(); drawingTools.setShape('rectangle'); drawingTools.draw(); },
      style: { width: '110px' }
    }),
    ui.Button({
      label: '🔺 Polygon',
      onClick: function() { clearGeometry(); drawingTools.setShape('polygon'); drawingTools.draw(); },
      style: { width: '110px' }
    })
  ],
  layout: ui.Panel.Layout.flow('horizontal')
}));


// ── Shared Panels (created once) ─────────────────────────────
var chartPanel = ui.Panel({
  style: { height: '235px', width: '400px', position: 'bottom-right', shown: false }
});
var statsButton = ui.Button({ label: 'Get Statistics', style: { margin: '8px 0' } });
mainPanel.add(statsButton);


// ── Helper: Load Training Shapefiles ─────────────────────────
// Loads each selected LULC class asset and merges into one FeatureCollection
function loadTrainingData(selectedClasses) {
  var merged = ee.FeatureCollection([]);
  selectedClasses.forEach(function(cls) {
    var assetPath = LULC_ASSET_PREFIX + cls;
    var fc = ee.FeatureCollection(assetPath);
    merged = merged.merge(fc);
  });
  return merged.filter(ee.Filter.notNull(['lulc']));
}


// ── Helper: Load District Shapefiles ─────────────────────────
function loadDistrictShapes(selectedDistricts) {
  var merged = ee.FeatureCollection([]);
  selectedDistricts.forEach(function(dist) {
    var assetPath = DISTRICT_ASSET_PREFIX + dist;
    merged = merged.merge(ee.FeatureCollection(assetPath));
  });
  return merged.filter(ee.Filter.notNull(['Dist_Name']));
}


// ── Helper: Build Classifier ──────────────────────────────────
function buildClassifier(modelName, training, bands) {
  var classifier;
  if (modelName === 'RF') {
    classifier = ee.Classifier.smileRandomForest({
      numberOfTrees    : 100,
      variablesPerSplit: 2,
      minLeafPopulation: 5,
      bagFraction      : 0.8,
      maxNodes         : null,
      seed             : 0
    });
  } else if (modelName === 'SVM') {
    classifier = ee.Classifier.libsvm({ kernelType: 'LINEAR', cost: 1 });
  } else if (modelName === 'GTB') {
    classifier = ee.Classifier.smileGradientTreeBoost({ numberOfTrees: 100, samplingRate: 0.5 });
  } else {
    classifier = ee.Classifier.smileCart(100);
  }
  return classifier.train({ features: training, classProperty: 'lulc', inputProperties: bands });
}


// ── Helper: Classify, Remap, Add Legend & Stats ───────────────
function classifyAndDisplay(stack, training, bands, modelName, aoi, commonElements, chartPanel, statsButton, year) {

  var real = ee.List(LULC_CLASSES);

  // Map selected class names to their 1-based index positions in LULC_CLASSES
  var fromValues = commonElements.map(function(el) {
    return real.indexOf(el).add(1);
  });
  var toValues = ee.List.sequence(1, commonElements.length());
  var nClasses = commonElements.length().getInfo();

  var classifier  = buildClassifier(modelName, training, bands);
  var classified  = stack.classify(classifier);

  var remapped = classified.remap({
    from    : fromValues,
    to      : toValues,
    bandName: 'classification'
  });

  var palette = ee.List(CLASS_COLORS.slice(0, nClasses));
  var layerName = 'LULC — ' + modelName;
  Map.addLayer(remapped.clip(aoi), { min: 1, max: nClasses, palette: palette.getInfo() }, layerName);

  // Dynamic legend
  var legend = ui.Panel({ style: { position: 'bottom-left', padding: '8px 15px' } });
  legend.add(ui.Label({ value: 'Land Cover Type', style: { margin: '0 0 4px 0', fontWeight: 'bold' } }));

  var classNames = commonElements.getInfo();
  var paletteArr = palette.getInfo();
  for (var i = 0; i < nClasses; i++) {
    legend.add(ui.Panel({
      widgets: [
        ui.Label({ style: { backgroundColor: paletteArr[i], border: '1px solid black', padding: '8px', margin: '0 0 4px 0' } }),
        ui.Label({ value: classNames[i], style: { margin: '0 0 4px 6px' } })
      ],
      layout: ui.Panel.Layout.Flow('horizontal')
    }));
  }
  Map.add(legend);

  // Area statistics chart
  var yearName = yearSelector.getValue();
  var chartTitle = 'LULC Class Areas (' + yearName + ') — ' + modelName;

  var areas = ee.Image.pixelArea().divide(10000)
    .addBands(remapped)
    .reduceRegion({ reducer: ee.Reducer.sum().group(1), geometry: aoi, scale: 100 })
    .get('groups');

  var defaults = ee.Dictionary(commonElements.map(function(label) {
    return [label, 0];
  }).flatten());

  areas = ee.Dictionary(ee.List(areas).map(function(dict) {
    dict = ee.Dictionary(dict);
    var klass = dict.getNumber('group');
    var index = toValues.indexOf(klass);
    var label = commonElements.get(index);
    return [label, dict.getNumber('sum')];
  }).flatten());

  var result = areas.combine(defaults, false).map(function(k, v) {
    var index = commonElements.indexOf(k);
    return [k, v, palette.get(index)];
  }).values(commonElements);

  result = result.insert(0, ['Label', 'Area (ha)', { role: 'style' }]);

  statsButton.onClick(ui.util.debounce(function() {
    var chart = ui.Chart(result.getInfo())
      .setChartType('ColumnChart')
      .setOptions({
        title: chartTitle,
        vAxis: { title: 'Area (hectares)', titleTextStyle: { bold: true }, gridlines: { color: '#FFF' }, format: 'short', baselineColor: '#000' },
        hAxis: { title: 'Land Cover Class', titleTextStyle: { bold: true } },
        legend: { position: 'right', title: 'LULC Classes' }
      });
    chartPanel.widgets().reset([chart]);
  }, 500));
}


// ── Sentinel-2 Image Stack ────────────────────────────────────
function buildSentinel2Stack(startDate, endDate, cloudThreshold, aoi) {
  var img = ee.ImageCollection('COPERNICUS/S2')
    .filterDate(startDate, endDate)
    .filterBounds(KMR_BOUNDS)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudThreshold))
    .mean()
    .select(['B2', 'B3', 'B4', 'B8'])
    .clip(kmr);

  var ndvi = img.normalizedDifference(['B8', 'B4']).rename('ndvi').clamp(0.2, 0.8);
  return img.addBands(ndvi);
}


// ── Landsat-8 Image Stack ─────────────────────────────────────
function buildLandsat8Stack(startDate, endDate, cloudThreshold) {
  var collection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterDate(startDate, endDate)
    .filterBounds(KMR_BOUNDS.centroid({ maxError: 1 }))
    .filter(ee.Filter.lte('CLOUD_COVER_LAND', cloudThreshold))
    .map(function(image) { return image.clip(kmr); });

  var img = collection.sort('CLOUD_COVER_LAND')
    .select(['SR_B3', 'SR_B4', 'SR_B5', 'SR_B6'])
    .median();

  var ndvi = img.normalizedDifference(['SR_B5', 'SR_B4']).rename('ndvi').clamp(0.2, 0.8);
  return img.addBands(ndvi);
}


// ── Main LULC Derivation Function ────────────────────────────
function deriveLULC() {

  Map.clear();
  chartPanel.style().set('shown', true);
  Map.add(chartPanel);

  var modelName      = modelSelector.getValue();
  var sensorName     = sensorSelector.getValue();
  var cloudThreshold = ee.Number.parse(cloudCoverInput.getValue() || '20');
  var year           = ee.Number.parse(yearSelector.getValue());

  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate   = ee.Date.fromYMD(year, 12, 28);

  // ── AOI RESOLUTION — THE KEY FIX ────────────────────────────
  // Priority: district checkboxes first, then drawn geometry
  var selectedDistricts = getSelectedDistricts();
  var aoi;

  if (selectedDistricts.length > 0) {
    // Use selected district shapes merged together
    aoi = loadDistrictShapes(selectedDistricts);
    Map.centerObject(aoi, 10);
  } else {
    // Fall back to drawn geometry
    aoi = drawingTools.layers().get(0).getEeObject();
    drawingTools.layers().get(0).setShown(false);
    drawingTools.setShape(null);
    Map.centerObject(aoi, 11);
  }

  // ── Training Data ────────────────────────────────────────────
  var selectedClasses = getSelectedClasses();
  if (selectedClasses.length === 0) {
    print('⚠️ Please select at least one land cover class.');
    return;
  }
  var trainingFC      = loadTrainingData(selectedClasses);
  var commonElements  = ee.List(selectedClasses);

  // ── Image Stack ──────────────────────────────────────────────
  var stack;
  if (sensorName === 'Sentinel-2') {
    stack = buildSentinel2Stack(startDate, endDate, cloudThreshold, aoi);
    Map.addLayer(stack.clip(aoi), { bands: ['B4', 'B3', 'B2'], min: 0, max: 3000 }, 'True Colour (S2)');
  } else {
    stack = buildLandsat8Stack(startDate, endDate, cloudThreshold);
    Map.addLayer(stack.clip(aoi), { bands: ['SR_B4', 'SR_B3', 'SR_B3'], min: 0, max: 0.3 }, 'True Colour (LS8)');
  }

  var bands = stack.bandNames();

  // Sample training regions
  var sampleScale = (sensorName === 'Sentinel-2') ? 20 : 30;
  var training = stack.sampleRegions({
    collection: trainingFC,
    properties: ['lulc'],
    tileScale  : 16,
    scale      : sampleScale
  });

  // Classify and display — single shared function handles all models
  classifyAndDisplay(stack, training, bands, modelName, aoi, commonElements, chartPanel, statsButton, yearSelector.getValue());
}


// ── Submit Button ────────────────────────────────────────────
var submitButton = ui.Button({ label: 'Derive LULC', style: { margin: '10px 0 4px 0' } });
mainPanel.add(submitButton);
submitButton.onClick(deriveLULC);


// ── Footer ───────────────────────────────────────────────────
mainPanel.add(ui.Label({
  value: '© Remote Sensing and GIS Lab (RSGL), SKUAST-Kashmir\nDeveloped by: Shahid Shuja Shafai (shafai@skuastkashmir.ac.in)',
  style: { fontSize: '10px', color: '#555', margin: '6px 8px 8px 8px', whiteSpace: 'pre' }
}));

ui.root.add(mainPanel);
