"use strict";

import * as model from "./model.js";
import * as view from "./view.js";
import * as algorithms from "./algorithms.js";
import * as morphing from "./morphing.js";

let svg = null;

export function toolSelected(element) {
    if (svg == null) {
        svg = document.querySelector("#theSVG");
    }
    element.addEventListener("input", drawModeHandler);
}

let drawingMode = "none";

export let drawModeHandler = {
    handleEvent(event) {
        // reset anything from previous mode
        svg.removeEventListener("click", addModeHandler);
        endDragMode();
        resetHalfEdge();

        // set new modeS
        switch (event.currentTarget.value) {
            case "mouse":
                drawingMode = "mouse";
                break;
            case "add":
                if (model.graph.vertices.length == 0) {
                    addOuterFourCycle(svg);
                }
                drawingMode = "add";
                svg.addEventListener("click", addModeHandler);
                break;
            case "move":
                drawingMode = "move";
                setDragMode();
                break;
            case "remove":
                drawingMode = "remove";
                break;
            case "highlight":
                drawingMode = "highlight";
                break;
        }
    }
}

export let addModeHandler = {
    async handleEvent(event) {
        addVertexClick(event);
    }
}

function setDragMode() {
    for (let vertex of model.graph.vertices) {
        if (vertex.id >= 4) {
            vertex.svgVertex.classList.add("draggable");
        }
    }
    svg.addEventListener('mousedown', startDragHandler);
    svg.addEventListener('mousemove', dragHandler);
    svg.addEventListener('mouseup', endDragHandler);
    svg.addEventListener('mouseleave', endDragHandler);
}

function endDragMode() {
    for (let vertex of model.graph.vertices) {
        if (vertex.id >= 4) {
            vertex.svgVertex.classList.remove("draggable");
        }
    }
    svg.removeEventListener('mousedown', startDragHandler);
    svg.removeEventListener('mousemove', dragHandler);
    svg.removeEventListener('mouseup', endDragHandler);
    svg.removeEventListener('mouseleave', endDragHandler);
}

export async function addVertexClick(event) {
    if (drawingMode !== "add") {
        return;
    }
    if (startSvgVertex != null) {
        svg.removeEventListener("mousemove", mouseMoveHandler);
    }

    let coordinates = view.translateDOMtoSVGcoordinates(event.x, event.y);
    let svgVertex = await findVertexNearby(coordinates);
    if (svgVertex == null) {
        svgVertex = await addVertex(coordinates, svg);
    }

    console.log(startSvgVertex)

    if (startSvgVertex != null) {
        endHalfEdge(svgVertex, svg);
    } else {
        initHalfEdge(svgVertex,)
    }
}

async function findVertexNearby(coordinates) {
    let bestDistance = Infinity;
    let bestSvgVertex = null;
    for (let i = 0; i < model.graph.vertices.length; i++) {
        let vertex = model.graph.vertices[i];
        let distance = Math.sqrt(Math.pow(vertex.x - coordinates.x, 2) + Math.pow(vertex.y - coordinates.y, 2));
        if ((distance < view.CLICK_TOLERANCE) && (distance < bestDistance)) {
            bestDistance = distance;
            bestSvgVertex = vertex.svgVertex;
        }
    }
    return bestSvgVertex;
}

async function addVertex(coordinates) {
    // create vertex
    let vertex = new model.Vertex(model.graph.vertices.length, coordinates.x, coordinates.y);
    model.graph.addVertex(vertex);

    // draw it
    let svgVertex = await view.drawVertex(vertex);

    // add listener
    svgVertex.addEventListener("click", vertexClickHandler);

    return svgVertex;
}

let vertexClickHandler = {
    async handleEvent(event) {
        event.stopPropagation();
        if (drawingMode === "add") {
            if (startSvgVertex == null) {
                initHalfEdge(event.currentTarget);
            } else if (startSvgVertex == event.currentTarget) {
                svg.removeEventListener("mousemove", mouseMoveHandler);
                resetHalfEdge();
            } else {
                svg.removeEventListener("mousemove", mouseMoveHandler);
                let endVertex = event.currentTarget;
                endHalfEdge(endVertex);
            }
        } else if (drawingMode === "remove") {
            let svgVertex = event.currentTarget;
            let vertex = svgVertex.vertex;
            model.graph.removeVertex(vertex);
        } else if (drawingMode === "highlight") {
            const svgVertex = event.currentTarget;
            const vertex = svgVertex.vertex;
            if (vertex.svgHighlight != null) {
                view.unhighlightVertex(vertex);
            } else {
                view.highlightVertex(vertex);
            }
        }
    }
}

function initHalfEdge(svgVertex) {
    startSvgVertex = svgVertex;
    halfEdge = view.addHalfEdge(svgVertex);

    svg.addEventListener("mousemove", mouseMoveHandler);
}

function endHalfEdge(endVertex) {
    console.log("end half edge");
    let edge = new model.Edge("e" + model.graph.edges.length, startSvgVertex.vertex, endVertex.vertex);
    model.graph.addEdge(edge);
    let svgEdge = view.drawEdge(edge);
    edge.svgEdge = svgEdge;

    svgEdge.addEventListener("click", edgeClickHandler);

    console.log("add edge: " + edge);

    resetHalfEdge();
}

function resetHalfEdge() {
    svg.removeEventListener("mousemove", mouseMoveHandler);
    startSvgVertex = null;
    if (halfEdge != null) {
        halfEdge.remove();
        halfEdge = null;
    }
}

let mouseMoveHandler = {
    handleEvent(event) {
        view.drawHalfEdge(halfEdge, view.translateDOMtoSVGcoordinates(event.x, event.y));
    }
}

export let rangeEventHandler = {
    handleEvent(event) {
        if (event.currentTarget.id === "vertexSizeRange") {
            view.changeVertexSize(event.currentTarget.value);
        } else if (event.currentTarget.id = "edgeWidthRange") {
            view.changeEdgeWidth(event.currentTarget.value);
        }
    }
}

let startSvgVertex = null;
let halfEdge = null;

let edgeClickHandler = {
    handleEvent(event) {
        console.log("edge clicked");
        event.stopPropagation();
        if (drawingMode === "remove") {
            let svgEdge = event.currentTarget;
            let edge = svgEdge.edge;
            model.graph.removeEdge(edge);
        } else if (drawingMode === "highlight") {
            const svgEdge = event.currentTarget;
            const edge = svgEdge.edge;
            if (edge.svgHighlight != null) {
                view.unhighlightEdge(edge);
            } else {
                view.highlightEdge(edge);
            }
        }
    }
}

export async function addOuterFourCycle(svg) {
    let width = view.WIDTH;
    let height = view.HEIGHT;

    // order: W, N, E, S
    let padding = view.PADDING;
    let coordinates = {
        x: padding,
        y: height / 2
    }
    let svgVertexW = await addVertex(coordinates, svg);
    svgVertexW.vertex.isOnOuterFace = true;
    coordinates.x = width / 2;
    coordinates.y = height - padding;
    let svgVertexS = await addVertex(coordinates, svg);
    svgVertexS.vertex.isOnOuterFace = true;
    coordinates.x = width - padding;
    coordinates.y = height / 2;
    let svgVertexE = await addVertex(coordinates, svg);
    svgVertexE.vertex.isOnOuterFace = true;
    coordinates.x = width / 2;
    coordinates.y = padding;
    let svgVertexN = await addVertex(coordinates, svg);
    svgVertexN.vertex.isOnOuterFace = true;

    // order WN, NE, ES, SW
    coordinates.x = padding;
    coordinates.y = padding;
    addOuterEdgeFromToVia(svgVertexW, svgVertexN, coordinates);

    coordinates.x = width - padding;
    addOuterEdgeFromToVia(svgVertexE, svgVertexN, coordinates);

    coordinates.y = height - padding;
    addOuterEdgeFromToVia(svgVertexS, svgVertexE, coordinates);

    coordinates.x = padding;
    addOuterEdgeFromToVia(svgVertexS, svgVertexW, coordinates);

    function addOuterEdgeFromToVia(startVertex, targetVertex, midpoint) {
        let edge = new model.Edge("e" + model.graph.edges.length, startVertex.vertex, targetVertex.vertex);
        model.graph.addEdge(edge);
        view.drawPolylineFromToVia(startVertex, targetVertex, midpoint, edge);
        return edge;
    }
}

let selectedVertex = null;

let startDragHandler = {
    async handleEvent(event) {
        if (drawingMode != "move") {
            return;
        }

        if (event.target.classList.contains("draggable")) {
            selectedVertex = event.target;
        } else {
            let coordinates = view.translateDOMtoSVGcoordinates(event.x, event.y);
            selectedVertex = await findVertexNearby(coordinates);
        }

    }
}

let dragHandler = {
    handleEvent(event) {
        if (drawingMode != "move") {
            return;
        }

        event.stopPropagation;
        if (selectedVertex != null) {
            let coordinates = view.translateDOMtoSVGcoordinates(event.x, event.y);
            view.moveVertexTo(selectedVertex, coordinates);
        }
    }
}

let endDragHandler = {
    handleEvent(event) {
        if (drawingMode == "move") {
            selectedVertex = null;
        }
    }
}

export let saveSVGHandler = {
    handleEvent(event) {
        let svg = document.querySelector("#theSVG");
        let svgData = svg.outerHTML;
        let preface = '<?xml version="1.0" standalone="no"?>\r\n';
        let svgBlob = new Blob([preface, svgData], { type: "image/svg+xml;charset=utf-8" });
        let svgUrl = URL.createObjectURL(svgBlob);
        let downloadLink = document.createElement("a");
        downloadLink.href = svgUrl;
        downloadLink.download = name;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        closeSaveFileForm();
    }
}

export let saveGraphHandler = {
    handleEvent(event) {
        let graphString = model.graph.toJSON();
        console.log(graphString);

        let jsonBlob = new Blob([graphString], { type: "application/json" });
        let jsonUrl = URL.createObjectURL(jsonBlob);
        let downloadLink = document.createElement("a");
        downloadLink.href = jsonUrl;
        downloadLink.download = name;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        closeSaveFileForm();
    }
}

export function openOpenFileForm() {
    document.getElementById("popupOpenFile").style.display = "block";
}

export function closeOpenFileForm() {
    hideElement("popupOpenFile");
}

export function openSaveFileForm() {
    document.getElementById("popupSaveFile").style.display = "block";
}

export function closeSaveFileForm() {
    hideElement("popupSaveFile");
}

function hideElement(elementId) {
    document.getElementById(elementId).style.display = "none";
}

export let readFileHandler = {
    handleEvent(event) {
        if (document.querySelector("#file-input").files.length == 0) {
            alert('Error : No file selected');
            return;
        }

        // first file selected by user
        const file = document.querySelector("#file-input").files[0];
        // console.log("this is files[0]:" + file);
        // console.log(file);

        // perform validation on file type & size if required

        // read the file
        const reader = new FileReader();

        // file reading started
        reader.addEventListener('loadstart', function () {
            console.log('File reading started');
        });

        // file reading finished successfully
        reader.addEventListener('load', async function (event) {
            // contents of file in variable     
            let text = event.target.result;
            // console.log(text);

            await loadGraphIntoSVG(JSON.parse(text));
        });

        // file reading failed
        reader.addEventListener('error', function () {
            alert('Error : Failed to read file');
        });

        // file read progress 
        reader.addEventListener('progress', function (event) {
            if (event.lengthComputable == true) {
                var percent_read = Math.floor((event.loaded / event.total) * 100);
                console.log(percent_read + '% read');
            }
        });

        // read as text file
        reader.readAsText(file);

        hideElement("popupOpenFile");
    }
}

async function loadGraphIntoSVG(JSONgraph) {
    model.Graph.parseGraph(JSONgraph);
    console.log(model.graph);

    await view.resetSVG();
    await view.drawGraph(model.graph);

    if (model.graph.hasREL) {
        for (const vertex of model.graph.vertices) {
            vertex.orderEdgesCircularly();
            vertex.orderEdgesInOut();
        }
    }

    for (let vertex of model.graph.vertices) {
        vertex.svgVertex.addEventListener("click", vertexClickHandler);
    }
    for (let i = 4; i < model.graph.edges.length; i++) {
        model.graph.edges[i].svgEdge.addEventListener("click", edgeClickHandler);
    }

    await resetViewedLayers();
    document.getElementById("showLayerGraph").checked = true;
}

export function initExamples() {
    document.getElementById("n34").addEventListener("click", loadExampleHandler);
    document.getElementById("n58").addEventListener("click", loadExampleHandler);
    document.getElementById("n75").addEventListener("click", loadExampleHandler);
}

export let loadExampleHandler = {
    async handleEvent(event) {

        let filename = null;
        switch (event.target.id) {
            case "n75":
                filename = "./examples/graph-n75.json";
                break;
            case "n34":
                filename = "./examples/graph-n34.json";
                break;
            case "n58":
                filename = "./examples/graph-n58.json";
                break;
            case "graph-largeRotation":
                filename = "./examples/graph-largeRotation.json";
                break;
        }

        closeOpenFileForm();

        if (filename) {
            let response = await fetch(filename);
            if (response.ok) { // if HTTP-status is 200-299
                // get the response body (the method explained below)
                let JSONgraph = await response.json();
                loadGraphIntoSVG(JSONgraph);
            } else {
                alert("HTTP-Error: " + response.status);
            }
        }
    }
}

export let checkGraphHandler = {
    async handleEvent(event) {
        view.resetLayer("highlightLayer");
        console.log("> check graph properties");
        await model.graph.computeEdgeOrders();
        if (await model.graph.hasSeparatingTriangle()) {
            console.log("Error, graph has separating triangle.");
        }
        if (!(await model.graph.isTriangulated())) {
            console.log("Error, graph is not triangulated.");
        }
    }
}

let showCWFlips;
let showCCWFlips;
let showAllFlips;

export function initFlipStatus() {
    showCWFlips = false;
    showCCWFlips = false;
    showAllFlips = false;
}

export let showFlipCyclesHandler = {
    async handleEvent(event) {
        // clean up
        model.graph.flipCycles = null;
        view.resetLayer("flipCyclesLayer");
        // resetRD();
        resetDrawMode();

        if (!model.graph.hasREL) {
            await computeREL();
            document.getElementById("showREL").checked = true;
        }

        // (re)compute
        console.log("> find flip cycles");
        let flipCycles = await computeFlipCycles();

        // set state as clicked
        if (event.currentTarget.id == "allFlipsLabel") {
            showAllFlips = !showAllFlips;
            showCWFlips = showAllFlips;
            showCCWFlips = showAllFlips;
        } else if (event.currentTarget.id == "cwFlipsLabel") {
            showCWFlips = !showCWFlips;
        } else if (event.currentTarget.id == "ccwFlipsLabel") {
            showCCWFlips = !showCCWFlips;
        }

        if (showCWFlips != showCCWFlips) {
            showAllFlips = false;
        } else if (showCWFlips) {
            showAllFlips = true;
        }

        // set label highlights correspodingly
        document.getElementById("allFlips").checked = showAllFlips;
        document.getElementById("cwFlips").checked = showCWFlips;
        document.getElementById("ccwFlips").checked = showCCWFlips;

        // show/hide correct flips
        for (const flipCycle of flipCycles) {
            if (((flipCycle.orientation === model.orientations.CW) && showCWFlips)
                || ((flipCycle.orientation === model.orientations.CCW) && showCCWFlips)) {
                view.hightlightFlipCycle(flipCycle);
                flipCycle.svgFlipCycle.addEventListener("click", flipCycleHandler);
                flipCycle.svgFlipCycle.addEventListener("mouseenter", flipCycleHoverInHandler);
                flipCycle.svgFlipCycle.addEventListener("mouseleave", flipCycleHoverOutHandler);
            }
        }
    }
}

export let extremalFlipCyclesHandler = {
    async handleEvent(event) {
        // clean up
        model.graph.flipCycles = null;
        view.resetLayer("flipCyclesLayer");
        // resetRD();
        resetDrawMode();

        if (!model.graph.hasREL) {
            await computeREL();
        }

        if ((event.currentTarget.id == "cwAllFlipsLabel") || (event.currentTarget.id == "ccwAllFlipsLabel")) {
            console.log("> flip all c/cw flip cycles");
            let orientation = (event.currentTarget.id == "ccwAllFlipsLabel") ? model.orientations.CCW : model.orientations.CW;
            let flippedACycle = false;
            do {
                flippedACycle = false;
                let flipCycles = await computeFlipCycles();
                for (const flipCycle of flipCycles) {
                    if (flipCycle.orientation === orientation) {
                        model.graph.flipFlipCycle(flipCycle);
                        model.graph.flipCycles = null;
                        flippedACycle = true;
                        break;
                    }
                }
            } while (flippedACycle)
        }

        computeRD()
    }
}

export async function computeFlipCycles() {
    let flipCycles = await algorithms.findFlipCycles(model.graph);
    model.graph.flipCycles = flipCycles;

    return flipCycles;
}

export let flipCycleHandler = {
    async handleEvent(event) {
        // 
        for (const fourCycle of model.graph.flipCycles) {
            if (fourCycle.svgFlipCycle !== undefined) {
                fourCycle.svgFlipCycle.removeEventListener("mouseenter", flipCycleHoverInHandler);
                fourCycle.svgFlipCycle.removeEventListener("mouseleave", flipCycleHoverOutHandler);
                if (fourCycle.u.svgRect !== null) {
                    unhighlightFlipCycleHover(fourCycle);
                }
            }
        }
        let svgFlipCycle = event.target;
        if (document.getElementById("showLayerRD").checked) {
            await morphing.animateRotation(svgFlipCycle.flipCycle, 100, 3000, true);
            view.resetLayer("flipCyclesLayer");
        } else {
            await model.graph.flipFlipCycle(svgFlipCycle.flipCycle);

            // resetRD();
            // await algorithms.computeRectangularDual(model.graph);
            // view.drawRD(model.graph);

            showFlipCyclesHandler.handleEvent({
                'currentTarget': {
                    'id': "keep-as-is"
                }
            });
        }
    }
}

export let flipCycleHoverInHandler = {
    async handleEvent(event) {
        let svgFlipCycle = event.target;
        let fourCycle = svgFlipCycle.flipCycle;
        if (fourCycle.u.svgRect !== null) {
            if (fourCycle.orientation === model.orientations.CW) {
                fourCycle.u.svgRect.classList.add("highlightHoverCW");
                fourCycle.v.svgRect.classList.add("highlightHoverCW");
                fourCycle.w.svgRect.classList.add("highlightHoverCW");
                fourCycle.x.svgRect.classList.add("highlightHoverCW");
            } else {
                fourCycle.u.svgRect.classList.add("highlightHoverCCW");
                fourCycle.v.svgRect.classList.add("highlightHoverCCW");
                fourCycle.w.svgRect.classList.add("highlightHoverCCW");
                fourCycle.x.svgRect.classList.add("highlightHoverCCW");
            }
        }
    }
}

export let flipCycleHoverOutHandler = {
    async handleEvent(event) {
        let svgFlipCycle = event.target;
        let fourCycle = svgFlipCycle.flipCycle;
        if (fourCycle.u.svgRect !== null) {
            unhighlightFlipCycleHover(fourCycle);
        }
    }
}

function unhighlightFlipCycleHover(fourCycle) {
    fourCycle.u.svgRect.classList.remove("highlightHoverCW");
    fourCycle.v.svgRect.classList.remove("highlightHoverCW");
    fourCycle.w.svgRect.classList.remove("highlightHoverCW");
    fourCycle.x.svgRect.classList.remove("highlightHoverCW");
    fourCycle.u.svgRect.classList.remove("highlightHoverCCW");
    fourCycle.v.svgRect.classList.remove("highlightHoverCCW");
    fourCycle.w.svgRect.classList.remove("highlightHoverCCW");
    fourCycle.x.svgRect.classList.remove("highlightHoverCCW");
}

export let showLayersHandler = {
    handleEvent(event) {
        let selection = event.target;
        if (selection.value === "showG") {
            if (selection.checked) {
                view.showLayer("edgeLayer");
                view.showLayer("vertexLayer");
                view.showLayer("highlightLayer");
                // view.hideLayer("rectangularDualGraphELayer");
                // view.hideLayer("rectangularDualGraphVLayer");
                // document.getElementById("showLayerRDGraph").checked = false;
            } else {
                view.hideLayer("edgeLayer");
                view.hideLayer("vertexLayer");
                view.hideLayer("highlightLayer");
                view.hideLayer("flipCyclesLayer");
            }
        } else if (selection.value === "showREL") {
            if (selection.checked) {
                if (!model.graph.hasREL) {
                    computeREL();
                } else {
                    for (const edge of model.graph.edges) {
                        view.colorEdge(edge);
                    }
                    if (model.graphRD != null) {
                        for (const edge of model.graphRD.edges) {
                            view.restoreEdgeColor(edge);
                        }
                    }
                }
            } else {
                for (const edge of model.graph.edges) {
                    view.hideEdgeColor(edge);
                }
                if (model.graphRD != null) {
                    for (const edge of model.graphRD.edges) {
                        view.hideEdgeColor(edge);
                    }
                }
            }
        } else if (selection.value === "showRD") {
            if (selection.checked) {
                computeRD();
                document.getElementById("showREL").checked = true;
                view.showLayer("rectangularDualLayer");
            } else {
                view.hideLayer("rectangularDualLayer");
            }
            // } else if (selection.value === "showRDG") {
            //     if (selection.checked) {
            //         if (model.graph.vertices[0].rectangle == null) {
            //             computeRD();
            //         }
            //         view.showLayer("rectangularDualLayer");
            //         document.getElementById("showREL").checked = true;
            //         document.getElementById("showLayerRD").checked = true;

            //         view.hideLayer("edgeLayer");
            //         view.hideLayer("vertexLayer");
            //         view.hideLayer("highlightLayer");

            //         view.showLayer("rectangularDualGraphELayer");
            //         view.showLayer("rectangularDualGraphVLayer");
            //         document.getElementById("showLayerGraph").checked = false;
            //     } else {
            //         // hide RD graph
            //         view.hideLayer("rectangularDualGraphELayer");
            //         view.hideLayer("rectangularDualGraphVLayer");
            //         // show normal graph
            //         view.showLayer("edgeLayer");
            //         view.showLayer("vertexLayer");
            //         view.showLayer("highlightLayer");
            //         document.getElementById("showLayerGraph").checked = true;
            //     }
            // }
        }
    }
}

async function computeREL() {
    resetDrawMode();

    if (model.graph.hasREL) {
        document.getElementById("cwFlips").checked = false;
    }

    console.log("> compute REL");
    console.log("i) check if PTP graph");
    await model.graph.computeEdgeOrders();
    if (await model.graph.hasSeparatingTriangle()) {
        console.log("Error, graph has separating triangle.");
        return;
    }
    if (!(await model.graph.isTriangulated())) {
        console.log("Error, graph is not triangulated.");
        return;
    }

    console.log("ii) compute canonical order");
    const canonicalOrder = algorithms.computeCanonicalOrder(model.graph);

    console.log("iii) orient edges according to order");
    await algorithms.engrainCanonicalOrder(model.graph, canonicalOrder);

    console.log("iv) compute REL");
    algorithms.computeREL(model.graph);
}

async function computeRD() {
    resetDrawMode();
    view.resetLayer("rectangularDualLayer");

    if (!model.graph.hasREL) {
        await computeREL();
    }
    console.log("> compute rectangular dual");
    await algorithms.computeRectangularDual(model.graph);
    await view.drawRD(model.graph);
    view.drawRDGraph(model.graph);
}

function resetRD() {
    view.resetLayer("rectangularDualLayer");
    // view.resetLayer("rectangularDualGraphELayer");
    // view.resetLayer("rectangularDualGraphVLayer");
    document.getElementById("showLayerRD").checked = false;
    // for (const vertex of model.graph.vertices) {
    //     vertex.rectangle = null;
    // }
}

function resetDrawMode() {
    if (svg == null) {
        svg = document.querySelector("#theSVG");
    }

    drawingMode = "mouse";
    svg.removeEventListener("click", addModeHandler);
    resetHalfEdge();
    endDragMode();

    document.getElementById("mouseRadio").checked = true;
    document.getElementById("addRadio").checked = false;
    document.getElementById("moveRadio").checked = false;
    document.getElementById("removeRadio").checked = false;
    document.getElementById("highlightRadio").checked = false;
}

async function resetViewedLayers() {
    document.getElementById("cwFlips").checked = false;
    document.getElementById("allFlips").checked = false;
    document.getElementById("ccwFlips").checked = false;

    document.getElementById("showREL").checked = false;
    document.getElementById("showLayerGraph").checked = false;
    document.getElementById("showLayerRD").checked = false;
    // document.getElementById("showLayerRDGraph").checked = false;
}