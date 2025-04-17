// Illustrator ExtendScript (JSX) to export artwork paths as Summa PLT
// Computes dynamic OPOS markers and converts AI coordinates to plotter units

#target illustrator

function main() {
    if (app.documents.length === 0) {
        alert("No document open.");
        return;
    }
    var doc = app.activeDocument;

    // === User Settings ===
    var markerXN = parseInt(prompt("Number of markers across X (e.g., 2 for left & right):", "2"), 10);
    if (isNaN(markerXN) || markerXN < 2) markerXN = 2;
    var markerXSize = 120;  // marker width (120 units = 3mm)
    var markerYSize = 120;

    // Conversion: Illustrator points to plotter units
    var unitsPerPt = 1016.0 / 72.0;

    // === Use actual artwork bounds for positioning and marker distances ===
    var bounds = getArtworkBounds(doc);
    // Summa software uses origin from artboard top-left corner, override artwork origin
    var artLeft = 0;
    var artTop = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect[1];
    var artWidthPts = bounds.width;
    var artHeightPts = bounds.height;

    // Ensure X is the longer side for markerXDis
    var markerXDis = Math.round(Math.max(artWidthPts, artHeightPts) * unitsPerPt);
    var markerYDis = Math.round(Math.min(artWidthPts, artHeightPts) * unitsPerPt);

    // === Save dialog ===
    var outFile = File.saveDialog("Save PLT file as", "*.plt");
    if (!outFile) return;
    outFile.encoding = "UTF-8";
    outFile.open("w");

    // === Write PLT Header ===
    outFile.writeln("\u001B;@:");
    outFile.writeln("SET MARKER_X_DIS=" + markerXDis + ".");
    outFile.writeln("SET MARKER_Y_DIS=" + markerYDis + ".");
    outFile.writeln("SET MARKER_X_SIZE=" + markerXSize + ".");
    outFile.writeln("SET MARKER_Y_SIZE=" + markerYSize + ".");
    outFile.writeln("SET MARKER_X_N=" + markerXN + ".");
    outFile.writeln("LOAD_MARKERS.END.");
    outFile.writeln("END.");
    outFile.writeln(";:HOA,ECN,U,");
    outFile.writeln(";:HOA,ECN,U,");

    // === Gather path data by layer ===
    var kissPaths = getLayerPaths("KissCut", artLeft, artTop, unitsPerPt, true);
    var diePaths = getLayerPaths("DieCut", artLeft, artTop, unitsPerPt, false);

    // Write KissCut paths
    for (var i = 0; i < kissPaths.length; i++) {
        outFile.writeln(kissPaths[i]);
    }

    // Write P6 tool change
    if (diePaths.length > 0) {
        outFile.writeln("P6,");
    }

    // Write DieCut paths
    for (var j = 0; j < diePaths.length; j++) {
        outFile.writeln(diePaths[j]);
    }

    // === End of PLT ===
    outFile.writeln("e@");
    outFile.close();

    alert("PLT export complete: " + outFile.fsName);
}

function getLayerPaths(layerName, origX, origY, unitsPerPt, prependComma) {
    var doc = app.activeDocument;
    var layer;
    var output = [];
    try {
        layer = doc.layers.getByName(layerName);
    } catch (e) {
        return output;
    }
    if (!layer.visible) return output;

    for (var i = 0; i < layer.pathItems.length; i++) {
        var path = layer.pathItems[i];
        if (path.pathPoints.length === 0) continue;

        var p0 = path.pathPoints[0].anchor;
        var x0 = Math.round((p0[0] - origX) * unitsPerPt);
        var y0 = Math.round((origY - p0[1]) * unitsPerPt); // Inverted Y-axis

        // U command line
        var uPrefix = prependComma ? ",U," : "U,";
        var uStr = uPrefix + x0 + "," + y0 + ",";
        output.push(uStr);

        // D command line
        var dStr = "D";
        for (var j = 0; j < path.pathPoints.length; j++) {
            var pt = path.pathPoints[j].anchor;
            var x = Math.round((pt[0] - origX) * unitsPerPt);
            var y = Math.round((origY - pt[1]) * unitsPerPt); // Inverted Y-axis
            dStr += "," + x + "," + y;
        }
        dStr += ",";
        output.push(dStr);
    }
    return output;
}

function getArtworkBounds(doc) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var layersToCheck = ["KissCut", "DieCut"]; // only use these layers, ignore Regmark
    for (var l = 0; l < layersToCheck.length; l++) {
        try {
            var layer = doc.layers.getByName(layersToCheck[l]);
            for (var i = 0; i < layer.pathItems.length; i++) {
                var path = layer.pathItems[i];
                for (var j = 0; j < path.pathPoints.length; j++) {
                    var pt = path.pathPoints[j].anchor;
                    minX = Math.min(minX, pt[0]);
                    minY = Math.min(minY, pt[1]);
                    maxX = Math.max(maxX, pt[0]);
                    maxY = Math.max(maxY, pt[1]);
                }
            }
        } catch (e) {}
    }
    return {
        left: minX,
        top: maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

main();