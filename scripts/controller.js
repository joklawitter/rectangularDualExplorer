"use strict";

import * as model from "./model.js";
import * as view from "./view.js";
import * as algorithms from "./algorithms.js";

let svg = null;

export function toolSelected(element) {
    if (svg == null) {
        svg = document.querySelector("#theSVG");
    }

    if (element.value == "drawGraph") {
        let drawToolbar = document.querySelector("#drawToolbar")
        drawToolbar.classList.remove("hidden");
        for (let tool of drawToolbar.getElementsByClassName("drawMode")) {
            tool.addEventListener("input", drawModeHandler);
        }

        if (model.graph.vertices.length == 0) {
            addOuterFourCycle(svg);

            // select add as default
            svg.addEventListener("click", addModeHandler);
            drawingMode = "add";
            document.querySelector("#addRadio").checked = true;

        } else {
            drawingMode = "move";
            document.querySelector("#moveRadio").checked = true;
            setDragMode();
        }
    } else {
        drawingMode = "none";
        document.querySelector("#drawToolbar").classList.add("hidden");
    }
}

let drawingMode = "none";

let drawModeHandler = {
    handleEvent(event) {
        switch (event.currentTarget.value) {
            case "add":
                drawingMode = "add";
                svg.addEventListener("click", addModeHandler);
                endDragMode();
                break;
            case "move":
                drawingMode = "move";
                setDragMode();
                svg.removeEventListener("click", addModeHandler);
                break;
            case "remove":
                drawingMode = "remove";
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
    if (startVertex != null) {
        svg.removeEventListener("mousemove", mouseMoveHandler);
    }
    if (drawingMode !== "add") {
        return;
    }

    let coordinates = view.translateDOMtoSVGcoordinates(event.x, event.y);
    let svgVertex = await addVertex(coordinates, svg);

    if (startVertex != null) {
        endHalfEdge(svgVertex, svg);
    }
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
        console.log("vertex clicked");
        event.stopPropagation();
        if (drawingMode === "add") {
            if (startVertex == null) {
                initHalfEdge(event, svg);
            } else if (startVertex == event.currentTarget) {
                svg.removeEventListener("mousemove", mouseMoveHandler);
                resetHalfEdge();
            } else {
                svg.removeEventListener("mousemove", mouseMoveHandler);
                let endVertex = event.currentTarget;
                endHalfEdge(endVertex, svg);
            }
        } else if (drawingMode === "remove") {
            let svgVertex = event.currentTarget;
            let vertex = svgVertex.vertex;
            model.graph.removeVertex(vertex);
        }
    }
}

function initHalfEdge(event, svg) {
    startVertex = event.currentTarget;
    halfEdge = view.addHalfEdge(startVertex);

    svg.addEventListener("mousemove", mouseMoveHandler);
}

function endHalfEdge(endVertex, svg) {
    let edge = new model.Edge("e" + model.graph.edges.length, startVertex.vertex, endVertex.vertex);
    model.graph.addEdge(edge);
    let svgEdge = view.drawEdge(edge);
    edge.svgEdge = svgEdge;

    svgEdge.addEventListener("click", edgeClickHandler);

    resetHalfEdge();
}

function resetHalfEdge() {
    startVertex = null;
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

let startVertex = null;
let halfEdge = null;

let edgeClickHandler = {
    handleEvent(event) {
        console.log("edge clicked");
        event.stopPropagation();
        if (drawingMode === "remove") {
            let svgEdge = event.currentTarget;
            let edge = svgEdge.edge;
            model.graph.removeEdge(edge);
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
    handleEvent(event) {
        if (drawingMode != "move") {
            return;
        }

        if (event.target.classList.contains("draggable")) {
            selectedVertex = event.target;
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
    }
}

export let readFileHandler = {
    handleEvent(event) {
        if (document.querySelector("#file-input").files.length == 0) {
            alert('Error : No file selected');
            return;
        }

        // first file selected by user
        const file = document.querySelector("#file-input").files[0];
        console.log("this is files[0]:" + file);
        console.log(file);

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
            console.log(text);

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
    }
}

async function loadGraphIntoSVG(JSONgraph) {
    model.Graph.parseGraph(JSONgraph);
    console.log(model.graph);

    await view.resetSVG();
    await view.drawGraph(model.graph);

    for (let vertex of model.graph.vertices) {
        vertex.svgVertex.addEventListener("click", vertexClickHandler);
    }
    for (let i = 4; i < model.graph.edges.length; i++) {
        model.graph.edges[i].svgEdge.addEventListener("click", edgeClickHandler);
    }
}

export function initExamples() {
    document.getElementById("examplesButton").addEventListener("click", () => {
        console.log("clicked drop down button");
        document.getElementById("examplesDropDown").classList.toggle("hidden");
    })

    document.getElementById("n75").addEventListener("click", loadExampleHandler);
    document.getElementById("n34").addEventListener("click", loadExampleHandler);
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
        }

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

export let computeRELHandler = {
    async handleEvent() {
        resetDrawMode();
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
}

export let showFlipCyclesHandler = {
    handleEvent(event) {
        // clean up
        model.graph.flipCycles = null;
        view.resetLayer("flipCyclesLayer");
        resetRD();

        // (re)compute
        if (event.currentTarget.id == "showFlipCycles") {
            console.log("> find flip cycles");
            let flipCycles = computeFlipCycles();

            let showCWFlips = document.querySelector("#cwFlips").checked;
            let showCCWFlips = document.querySelector("#ccwFlips").checked;

            for (const flipCycle of flipCycles) {
                if (((flipCycle.orientation === model.orientations.CW) && showCWFlips)
                    || ((flipCycle.orientation === model.orientations.CCW) && showCCWFlips)) {
                    view.hightlightFlipCycle(flipCycle);
                    flipCycle.svgFlipCycle.addEventListener("click", flipCycleHandler);
                }
            }
        } else if ((event.currentTarget.id == "cwAllFlipsLabel") || (event.currentTarget.id == "ccwAllFlipsLabel")) {
            console.log("> flip all c/cw flip cycles");
            let orientation = (event.currentTarget.id == "ccwAllFlipsLabel") ? model.orientations.CCW : model.orientations.CW;
            let flippedACycle = false;
            do {
                flippedACycle = false;
                let flipCycles = computeFlipCycles();
                for (const flipCycle of flipCycles) {
                    if (flipCycle.orientation === orientation) {
                        model.graph.flipFlipCycle(flipCycle);
                        model.graph.flipCycles = null;
                        flippedACycle = true;
                        break;
                    }
                }
            } while (flippedACycle)
            console.log("no c/cw flip left");
        }

        function computeFlipCycles() {
            let flipCycles = algorithms.findFlipCycles(model.graph);
            model.graph.flipCycles = flipCycles;
            return flipCycles;
        }
    }
}

export let flipCycleHandler = {
    handleEvent(event) {
        resetRD();
        let svgFlipCycle = event.target;
        model.graph.flipFlipCycle(svgFlipCycle.flipCycle);

        model.graph.flipCycles = null;
        view.resetLayer("flipCyclesLayer");

        showFlipCyclesHandler.handleEvent({
            'currentTarget': {
                'id': "showFlipCycles"
            }
        });
    }
}

export let computeRDHandler = {
    async handleEvent() {
        resetDrawMode();
        view.resetLayer("flipCyclesLayer");
        if (!model.graph.hasREL) {
            await computeRELHandler.handleEvent();
        }
        console.log("> compute rectangular dual");
        await algorithms.computeRectangularDual(model.graph);
        view.drawRDGraph(model.graph);
    }
}

export let showLayersHandler = {
    handleEvent(event) {
        let selection = event.target;
        if (selection.value === "showG") {
            if (selection.checked) {
                view.showLayer("edgeLayer");
                view.showLayer("vertexLayer");
                view.showLayer("highlightLayer");
                view.hideLayer("rectangularDualGraphELayer");
                view.hideLayer("rectangularDualGraphVLayer");
                document.getElementById("showLayerRDGraph").checked = false;
            } else {
                view.hideLayer("edgeLayer");
                view.hideLayer("vertexLayer");
                view.hideLayer("highlightLayer");
            }
        } else if (selection.value === "showRD") {
            if (selection.checked) {
                view.showLayer("rectangularDualLayer");
            } else {
                view.hideLayer("rectangularDualLayer");
            }
        } else if (selection.value === "showRDG") {
            if (selection.checked) {
                view.hideLayer("edgeLayer");
                view.hideLayer("vertexLayer");
                view.hideLayer("highlightLayer");
                view.showLayer("rectangularDualGraphELayer");
                view.showLayer("rectangularDualGraphVLayer");
                document.getElementById("showLayerGraph").checked = false;
            } else {
                view.hideLayer("rectangularDualGraphELayer");
                view.hideLayer("rectangularDualGraphVLayer");
            }
        }
    }
}

function resetRD() {
    view.resetLayer("rectangularDualLayer");
    view.resetLayer("rectangularDualGraphELayer");
    view.resetLayer("rectangularDualGraphVLayer");
    for (const vertex of model.graph.vertices) {
        vertex.rectangle = null;
    }
}

function resetDrawMode() {
    if (svg == null) {
        svg = document.querySelector("#theSVG");
    }

    drawingMode = "none";
    document.querySelector("#drawToolbar").classList.add("hidden");
    svg.removeEventListener("click", addModeHandler);
    endDragMode();

    document.querySelector("#addRadio").checked = false;
    document.querySelector("#moveRadio").checked = false;
    document.querySelector("#removeRadio").checked = false;
}