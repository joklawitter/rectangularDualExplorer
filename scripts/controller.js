"use strict";

import * as model from "./model.js";
import * as view from "./view.js";

let svg = null;

export function toolSelected(element) {
    if (svg == null) {
        svg = document.querySelector("#theSVG");
    }

    if (element.value == "drawGraph") {
        if (model.graph.vertices.length == 0) {
            addOuterFourCycle(svg);
        }

        let drawToolbar = document.querySelector("#drawToolbar")
        drawToolbar.classList.remove("hidden");

        // select add as default
        svg.addEventListener("click", addModeHandler);
        drawingMode = "add";
        document.querySelector("#addRadio").checked = true;

        for (let tool of drawToolbar.getElementsByClassName("drawMode")) {
            tool.addEventListener("input", drawModeHandler);
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
    let svgVertex = view.drawVertex(vertex);

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
            if (vertex.id < 4) {
                // cannot remove outer vertex
                return;
            }
            let edges = []
            for (let edge of vertex.edges) {
                edges.push(edge);
            }
            for (let edge of edges) {
                await removeEdge(edge);
            }

            svgVertex.remove();
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
    let edge = new model.Edge(model.graph.edges.length, startVertex.vertex, endVertex.vertex);
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
            removeEdge(event.currentTarget.edge);
        }
    }
}

async function removeEdge(edge) {
    let svgEdge = edge.svgEdge;
    svgEdge.remove();
    edge.source.removeEdge(edge);
    edge.target.removeEdge(edge);
    model.graph.removeEdge(edge);
}

export async function addOuterFourCycle(svg) {
    let width = 700;
    let height = 350;

    let padding = 10;
    let coordinates = {
        x: width / 2,
        y: padding
    }
    let svgVertexTop = await addVertex(coordinates, svg);

    coordinates.y = height - padding;
    let svgVertexBottom = await addVertex(coordinates, svg);
    coordinates.x = padding;
    coordinates.y = height / 2;
    let svgVertexLeft = await addVertex(coordinates, svg);
    coordinates.x = width - padding;
    let svgVertexRight = await addVertex(coordinates, svg);

    coordinates.x = padding;
    coordinates.y = padding;
    addOuterEdgeFromToVia(svgVertexLeft, svgVertexTop, coordinates);

    coordinates.y = height - padding;
    addOuterEdgeFromToVia(svgVertexLeft, svgVertexBottom, coordinates);

    coordinates.x = width - padding;
    addOuterEdgeFromToVia(svgVertexBottom, svgVertexRight, coordinates);

    coordinates.y = padding;
    addOuterEdgeFromToVia(svgVertexTop, svgVertexRight, coordinates);
}

function addOuterEdgeFromToVia(startVertex, targetVertex, midpoint) {
    let edge = new model.Edge("edge" + model.graph.edges.length, startVertex.vertex, targetVertex.vertex);
    model.graph.addEdge(edge);

    let svgEdge = view.drawPolylineFromToVia(startVertex, targetVertex, midpoint, edge.id);
    svgEdge.edge = edge;
    edge.svgEdge = svgEdge;

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

        // perform validation on file type & size if required

        // read the file
        const reader = new FileReader();

        // file reading started
        reader.addEventListener('loadstart', function () {
            console.log('File reading started');
        });

        // file reading finished successfully
        reader.addEventListener('load', function (event) {
            // contents of file in variable     
            let text = event.target.result;

            console.log(text);
            model.graph = model.Graph.parseGraph(text);
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
