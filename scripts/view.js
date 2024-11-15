"use strict";

import * as model from "./model.js";

export let svg = document.querySelector("#theSVG");
export let svgTwo = document.querySelector("#theOtherSVG");

export const WIDTH = 700;
export const HEIGHT = 360;
export const PADDING = 10;
export const CLICK_TOLERANCE = 15;
export const OFFSET = 10;

export let X_STEP = 17;
export let Y_STEP = 17;

export function initSVG() {
    let layer = createSVGElement("g");
    layer.id = "rectangularDualLayer";
    svgTwo.append(layer);

    // layer = createSVGElement("g");
    // layer.id = "rectangularDualGraphELayer";
    // layer.classList.add("hidden");
    // svg.append(layer);
    // layer = createSVGElement("g");
    // layer.id = "rectangularDualGraphVLayer";
    // layer.classList.add("hidden");
    // svg.append(layer);

    layer = createSVGElement("g");
    layer.id = "highlightLayer";
    svg.append(layer);

    layer = createSVGElement("g");
    layer.id = "flipCyclesLayer";
    svg.append(layer);

    layer = createSVGElement("g");
    layer.id = "edgeLayer";
    svg.append(layer);

    layer = createSVGElement("g");
    layer.id = "vertexLayer";
    svg.append(layer);
}

export function initSizes(vertexSize, edgeSize) {
    document.documentElement.style.setProperty('--vertexSize', vertexSize);
    document.documentElement.style.setProperty('--edgeWidth', edgeSize);
    setArrowHeadAttributes();
    changeVertexHighlightSize(vertexSize);
}

export function setSteps(stepSize) {
    X_STEP = stepSize;
    Y_STEP = stepSize;
}

function changeVertexHighlightSize(vertexSize) {
    let highlightSize = parseInt(vertexSize) + parseInt(getComputedStyle(document.documentElement).getPropertyValue('--highlightDifference'));
    document.documentElement.style.setProperty('--vertexHighlightSize', highlightSize);
    return highlightSize;
}

function setArrowHeadAttributes() {
    let vertexSize = Number(document.documentElement.style.getPropertyValue('--vertexSize'));
    let edgeWidth = Number(document.documentElement.style.getPropertyValue('--edgeWidth'));


    let refX = (vertexSize / edgeWidth + 7);
    document.getElementById("arrowRed").setAttribute("refX", refX);
    document.getElementById("arrowBlue").setAttribute("refX", refX);


    let markerWidth = 9 - (edgeWidth - 1) * 0.6;
    document.getElementById("arrowRed").setAttribute("markerWidth", markerWidth);
    document.getElementById("arrowBlue").setAttribute("markerWidth", markerWidth);
}

export async function resetSVG() {
    for (let layer of svg.children) {
        resetLayer(layer.id);
    }
    for (let layer of svgTwo.children) {
        resetLayer(layer.id);
    }

    return true;
}

export async function resetLayer(id) {
    let layer = document.getElementById(id);
    while (layer.firstChild) {
        layer.removeChild(layer.lastChild);
    }
}

export function showLayer(id) {
    document.getElementById(id).classList.remove("hidden");
}

export function hideLayer(id) {
    document.getElementById(id).classList.add("hidden");
}

export async function drawGraph(graph) {
    // draw vertices
    for (let vertex of graph.vertices) {
        drawVertex(vertex);
    }

    // draw four outer edges
    let coordinates = {
        x: PADDING,
        y: PADDING
    }
    // vertex order: W, S, E, N
    // edge order WN, NE, ES, SW
    drawPolylineFromToVia(graph.vertices[0].svgVertex, graph.vertices[3].svgVertex, coordinates, graph.edges[0]);

    coordinates.x = WIDTH - PADDING;
    drawPolylineFromToVia(graph.vertices[3].svgVertex, graph.vertices[2].svgVertex, coordinates, graph.edges[1]);

    coordinates.y = (HEIGHT - PADDING);
    drawPolylineFromToVia(graph.vertices[2].svgVertex, graph.vertices[1].svgVertex, coordinates, graph.edges[2]);

    coordinates.x = PADDING;
    drawPolylineFromToVia(graph.vertices[1].svgVertex, graph.vertices[0].svgVertex, coordinates, graph.edges[3]);

    // draw other edges
    for (let i = 4; i < graph.edges.length; i++) {
        drawEdge(graph.edges[i]);
    }
}

export async function drawVertex(vertex, layer = "vertexLayer") {
    let vertexLayer = svg.getElementById(layer);

    let svgVertex = createSVGElement("circle");
    svgVertex.setAttribute("r", getComputedStyle(document.documentElement).getPropertyValue('--vertexSize'));
    svgVertex.setAttribute("cx", vertex.x);
    svgVertex.setAttribute("cy", vertex.y);
    svgVertex.id = "svg-" + vertex.id;

    vertex.svgVertex = svgVertex;
    svgVertex.vertex = vertex;

    vertexLayer.append(svgVertex);
    return svgVertex;
}

export function moveVertexTo(svgVertex, coordinates) {
    svgVertex.setAttribute("cx", coordinates.x);
    svgVertex.setAttribute("cy", coordinates.y);
    let vertex = svgVertex.vertex;
    vertex.x = coordinates.x;
    vertex.y = coordinates.y;

    let svgHighlight = vertex.svgHighlight;
    if (svgHighlight != null) {
        svgHighlight.setAttribute("cx", coordinates.x);
        svgHighlight.setAttribute("cy", coordinates.y);
    }


    let edges = vertex.edges;
    for (let edge of edges) {
        let svgEdge = edge.svgEdge;
        svgHighlight = edge.svgHighlight;
        if (edge.source === vertex) {
            svgEdge.setAttribute("x1", coordinates.x);
            svgEdge.setAttribute("y1", coordinates.y);
            if (svgHighlight != null) {
                svgHighlight.setAttribute("x1", coordinates.x);
                svgHighlight.setAttribute("y1", coordinates.y);
            }
        }
        else {
            svgEdge.setAttribute("x2", coordinates.x);
            svgEdge.setAttribute("y2", coordinates.y);
            if (svgHighlight != null) {
                svgHighlight.setAttribute("x2", coordinates.x);
                svgHighlight.setAttribute("y2", coordinates.y);
            }
        }
    }
}

export function drawEdge(edge) {
    let edgeLayer = svg.querySelector("#edgeLayer");

    let svgEdge = createSVGElement("line");
    svgEdge.setAttribute("x1", edge.source.x);
    svgEdge.setAttribute("y1", edge.source.y);
    svgEdge.setAttribute("x2", edge.target.x);
    svgEdge.setAttribute("y2", edge.target.y);
    svgEdge.setAttribute("stroke", "black");
    svgEdge.setAttribute("style", "stroke-width: "
        + getComputedStyle(document.documentElement).getPropertyValue('--edgeWidth'));
    svgEdge.id = "svg-e" + edge.id;
    svgEdge.classList.add("edge");

    edge.svgEdge = svgEdge;
    svgEdge.edge = edge;

    if (edge.color !== null) {
        colorEdge(edge);
    }

    edgeLayer.append(svgEdge);
    return svgEdge;
}

export function colorEdge(edge) {
    if (edge.svgEdge === null) {
        return;
    }
    if (edge.color === model.colors.RED) {
        edge.svgEdge.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue('--redStroke'));
        edge.svgEdge.setAttribute("marker-end", "url(#arrowRed)");
    } else if (edge.color === model.colors.BLUE) {
        edge.svgEdge.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue('--blueStroke'));
        edge.svgEdge.setAttribute("marker-end", "url(#arrowBlue)");
    } else if (edge.color === model.colors.GREN) {
        // edge.svgEdge.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue('--greenStroke'));
    }
}

export function hideEdgeColor(edge) {
    edge.svgEdge.setAttribute("stroke", "black");
    edge.svgEdge.removeAttribute("marker-end");
}

export function restoreEdgeColor(edge) {
    if (edge.color === model.colors.RED) {
        edge.svgEdge.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue('--redStroke'));
    } else if (edge.color === model.colors.BLUE) {
        edge.svgEdge.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue('--blueStroke'));
    }
}

export function addHalfEdge(svgVertex) {
    let edgeLayer = svg.querySelector("#edgeLayer");

    let svgEdge = createSVGElement("line");
    svgEdge.setAttribute("x1", svgVertex.getAttribute("cx"));
    svgEdge.setAttribute("y1", svgVertex.getAttribute("cy"));
    svgEdge.setAttribute("x2", svgVertex.getAttribute("cx"));
    svgEdge.setAttribute("y2", svgVertex.getAttribute("cy"));
    svgEdge.id = "svg-half";
    svgEdge.classList.add("edge");
    svgEdge.classList.add("halfedge");

    edgeLayer.append(svgEdge);
    return svgEdge;
}

export function drawHalfEdge(halfEdge, coordinates) {
    halfEdge.setAttribute("x2", coordinates.x);
    halfEdge.setAttribute("y2", coordinates.y);
}

export function drawPolylineFromToVia(startVertex, targetVertex, midpoint, edge) {
    let edgeLayer = svg.querySelector("#edgeLayer");

    let svgEdge = createSVGElement("polyline");
    let points = startVertex.getAttribute("cx") + "," + startVertex.getAttribute("cy") + " "
        + midpoint.x + "," + midpoint.y + " "
        + targetVertex.getAttribute("cx") + "," + targetVertex.getAttribute("cy");
    svgEdge.setAttribute("points", points);
    svgEdge.setAttribute("fill", "none");
    svgEdge.setAttribute("stroke", "black");
    svgEdge.setAttribute("style", "stroke-width: "
        + getComputedStyle(document.documentElement).getPropertyValue('--edgeWidth'));

    svgEdge.id = "svg-" + edge.id;
    svgEdge.classList.add("edge");

    edgeLayer.append(svgEdge);

    svgEdge.edge = edge;
    edge.svgEdge = svgEdge;

    return svgEdge;
}

export function changeVertexSize(vertexSize) {
    document.documentElement.style.setProperty('--vertexSize', vertexSize);

    setArrowHeadAttributes();
    let highlightSize = changeVertexHighlightSize(vertexSize);

    for (let vertex of model.graph.vertices) {
        vertex.svgVertex.setAttribute("r", vertexSize);
        if (vertex.svgHighlight != null) {
            vertex.svgHighlight.setAttribute("r", highlightSize);
        }
    }
}

export function changeEdgeWidth(edgeWidth) {
    edgeWidth = 1 + (edgeWidth - 1) * 0.5;
    document.documentElement.style.setProperty('--edgeWidth', edgeWidth);

    setArrowHeadAttributes()

    for (let edge of model.graph.edges) {
        edge.svgEdge.setAttribute("style", "stroke-width: " + edgeWidth);
    }
}

export function highlightVertex(vertex, colorClass = null) {
    let hightlightLayer = svg.querySelector("#highlightLayer");

    let svgHighlight = createSVGElement("circle");
    let highlightRadius = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--vertexSize'))
        + parseInt(getComputedStyle(document.documentElement).getPropertyValue('--highlightDifference'));
    svgHighlight.setAttribute("r", highlightRadius);
    svgHighlight.setAttribute("cx", vertex.x);
    svgHighlight.setAttribute("cy", vertex.y);
    if (colorClass === null) {
        svgHighlight.classList.add("highlight");
    } else {
        svgHighlight.classList.add(colorClass);
    }
    svgHighlight.id = "svg-highlight-" + vertex.id;

    if (vertex.svgRect != null) {
        if (colorClass === null) {
            vertex.svgRect.setAttribute("fill", getComputedStyle(document.documentElement).getPropertyValue('--highlightFill'));
        } else {
            vertex.svgRect.setAttribute("fill", getComputedStyle(document.documentElement).getPropertyValue('--highlightCCW'));
        }
    }

    vertex.svgHighlight = svgHighlight;
    svgHighlight.vertex = vertex;

    hightlightLayer.append(svgHighlight);
    return svgHighlight;
}

export function unhighlightVertex(vertex) {
    let svgHighlight = vertex.svgHighlight;
    if (svgHighlight != null) {
        svgHighlight.remove();
        vertex.svgHighlight = null;
        if (vertex.svgRect != null) {
            vertex.svgRect.setAttribute("fill", "none");
        }
    }
}

export function highlightEdge(edge) {
    let hightlightLayer = svg.querySelector("#highlightLayer");

    let svgHighlight = edge.svgEdge.cloneNode(false);
    svgHighlight.classList.add("highlight");
    svgHighlight.id = "svg-ehighlight-" + edge.id;
    let strokWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--edgeWidth'))
        + parseInt(getComputedStyle(document.documentElement).getPropertyValue('--highlightDifference'));
    svgHighlight.setAttribute("style", "stroke-width: " + strokWidth);
    svgHighlight.removeAttribute("marker-end");

    edge.svgHighlight = svgHighlight;
    svgHighlight.edge = edge;

    hightlightLayer.append(svgHighlight);
    return svgHighlight;
}

export function unhighlightEdge(edge) {
    let svgHighlight = edge.svgHighlight;
    if (svgHighlight != null) {
        svgHighlight.remove();
        edge.svgHighlight = null;
    }
}

export function highlightFlipCycleFully(fourCycle) {
    if (fourCycle.orientation === model.orientations.CW) {
        highlightVertex(fourCycle.u);
        highlightVertex(fourCycle.v);
        highlightVertex(fourCycle.w);
        highlightVertex(fourCycle.x);
    } else {
        highlightVertex(fourCycle.u, "highlightCCW");
        highlightVertex(fourCycle.v, "highlightCCW");
        highlightVertex(fourCycle.w, "highlightCCW");
        highlightVertex(fourCycle.x, "highlightCCW");
    }
    hightlightFlipCycle(fourCycle);
}

export function hightlightFlipCycle(flipCycle) {
    let flipCyclesLayer = svg.querySelector("#flipCyclesLayer");

    let svgFlipCycle = createSVGElement("polygon");
    let points = flipCycle.u.svgVertex.getAttribute("cx") + "," + flipCycle.u.svgVertex.getAttribute("cy") + " "
        + flipCycle.v.svgVertex.getAttribute("cx") + "," + flipCycle.v.svgVertex.getAttribute("cy") + " "
        + flipCycle.w.svgVertex.getAttribute("cx") + "," + flipCycle.w.svgVertex.getAttribute("cy") + " "
        + flipCycle.x.svgVertex.getAttribute("cx") + "," + flipCycle.x.svgVertex.getAttribute("cy");
    svgFlipCycle.setAttribute("points", points);
    svgFlipCycle.setAttribute("stroke", "none");
    svgFlipCycle.setAttribute("fill-opacity", 0.5);
    if (flipCycle.orientation === model.orientations.CW) {
        svgFlipCycle.setAttribute("fill", getComputedStyle(document.documentElement).getPropertyValue('--flipCircleFillCW'));
    } else {
        svgFlipCycle.setAttribute("fill", getComputedStyle(document.documentElement).getPropertyValue('--flipCircleFillCCW'));
    }
    svgFlipCycle.id = "svg-flip-" + flipCycle.id;

    flipCycle.svgFlipCycle = svgFlipCycle;
    svgFlipCycle.flipCycle = flipCycle;

    flipCyclesLayer.append(svgFlipCycle);
    return svgFlipCycle;
}

export async function drawRD(graph) {
    for (const vertex of graph.vertices) {
        drawRectangle(vertex, graph.xmax + 1, graph.ymax + 1);
    }
}

export async function redrawRectangularDual() {
    if (model.graph.vertices.svgRect !== null) {
        for (const vertex of model.graph.vertices) {
            vertex.svgRect.setAttribute("x", OFFSET + vertex.rectangle.x1 * X_STEP);
            vertex.svgRect.setAttribute("y", OFFSET + vertex.rectangle.y1 * Y_STEP);
            vertex.svgRect.setAttribute("width", (vertex.rectangle.x2 * X_STEP - vertex.rectangle.x1 * X_STEP));
            vertex.svgRect.setAttribute("height", (vertex.rectangle.y2 * Y_STEP - vertex.rectangle.y1 * Y_STEP));
        }
    }
}

export function drawRectangle(vertex, xmax, ymax) {
    // let X_STEP = (WIDTH - 2 * OFFSET) / xmax;
    // let Y_STEP = (HEIGHT - 2 * OFFSET) / ymax;
    // X_STEP = Math.min(X_STEP, Y_STEP);
    // Y_STEP = Math.min(X_STEP, Y_STEP);

    let rectangularDualLayer = svgTwo.querySelector("#rectangularDualLayer");
    let svgRect = createSVGElement("rect");
    svgRect.setAttribute("x", OFFSET + vertex.rectangle.x1 * X_STEP);
    svgRect.setAttribute("y", OFFSET + vertex.rectangle.y1 * Y_STEP);
    svgRect.setAttribute("width", (vertex.rectangle.x2 * X_STEP - vertex.rectangle.x1 * X_STEP));
    svgRect.setAttribute("height", (vertex.rectangle.y2 * Y_STEP - vertex.rectangle.y1 * Y_STEP));
    svgRect.setAttribute("stroke", "darkgray");
    svgRect.setAttribute("id", "svgRect" + vertex.id);
    svgRect.classList.add("fillOpacity");
    if (vertex.svgHighlight != null) {
        svgRect.setAttribute("fill", getComputedStyle(document.documentElement).getPropertyValue('--highlightFill'));
    } else {
        svgRect.setAttribute("fill", "none");
    }
    rectangularDualLayer.append(svgRect);

    vertex.svgRect = svgRect;
    svgRect.vertex = vertex;
    svgRect.rectangle = vertex.rectangle;
}

export async function drawRDGraph(graph) {
    return;
    let xStep = (WIDTH - 2 * OFFSET) / graph.xmax;
    let yStep = (HEIGHT - 2 * OFFSET) / graph.ymax;

    // copy vertices
    let vertexCopies = [];
    for (let i = 0; i < graph.vertices.length; i++) {
        const v = graph.vertices[i];
        const x = OFFSET + (v.rectangle.x1 + v.rectangle.x2) / 2 * xStep;
        const y = OFFSET + (v.rectangle.y1 + v.rectangle.y2) / 2 * yStep;
        let copy = new model.Vertex("rd" + i, x, y);
        copy.original = v;

        let svgVertex = drawVertex(copy, "rectangularDualGraphVLayer");
        svgVertex.vertex = copy;
        svgVertex.original = v;
        vertexCopies[i] = copy;
    }

    // draw edges
    let edgeCopies = [];
    for (const edge of graph.edges) {
        const s = edge.source;
        const sCopy = vertexCopies[edge.source.id];
        const t = edge.target;
        const tCopy = vertexCopies[edge.target.id];

        let edgeCopy = new model.Edge(edge.id, sCopy, tCopy)
        edgeCopy.color = edge.color;
        edgeCopy.original = edge;
        edgeCopies.push(edgeCopy);

        let midpoint = {
            x: 0,
            y: 0
        }
        if ((edge.color === model.colors.RED) || (edge.id == "e0") || (edge.id == "e2")) {
            midpoint.x = OFFSET + s.rectangle.x2 * xStep;
            let yCoords = [s.rectangle.y1, s.rectangle.y2, t.rectangle.y1, t.rectangle.y2];
            yCoords.sort((a, b) => (b - a));
            midpoint.y = OFFSET + (yCoords[1] + yCoords[2]) / 2 * yStep;
        } else if ((edge.color === model.colors.BLUE) || (edge.id === "e1") || (edge.id === "e3")) {
            midpoint.y = OFFSET + s.rectangle.y1 * yStep;
            let xCoords = [s.rectangle.x1, s.rectangle.x2, t.rectangle.x1, t.rectangle.x2];
            xCoords.sort((a, b) => (b - a));
            midpoint.x = OFFSET + (xCoords[1] + xCoords[2]) / 2 * xStep;
        } else {
            console.log("Problem: edge of unknown color");
            console.log(edge);
            continue
        }

        let line = drawRDEdge(sCopy, tCopy, midpoint, edge.color);
        edgeCopy.svgEdge = line;
    }

    model.setGraphRD(new model.Graph(graph.id + "-RD", vertexCopies, edgeCopies, graph.name + "-RD"));

    //draw vertices
    for (const v of graph.vertices) {


    }

    function drawRDEdge(startVertex, targetVertex, midpoint, color) {
        let rectangularDualGraphLayer = svg.querySelector("#rectangularDualGraphELayer");

        let svgEdge = createSVGElement("polyline");
        let points = startVertex.x + "," + startVertex.y + " "
            + midpoint.x + "," + midpoint.y + " "
            + targetVertex.x + "," + targetVertex.y;
        svgEdge.setAttribute("points", points);
        svgEdge.setAttribute("fill", "none");
        svgEdge.setAttribute("style", "stroke-width: "
            + getComputedStyle(document.documentElement).getPropertyValue('--edgeWidth'));

        if (color === model.colors.RED) {
            svgEdge.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue('--redStroke'));
        } else if (color === model.colors.BLUE) {
            svgEdge.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue('--blueStroke'));
        }

        rectangularDualGraphLayer.append(svgEdge);

        return svgEdge;
    }

}

const SVGNS = "http://www.w3.org/2000/svg";

export function createSVGElement(tagName) {
    return document.createElementNS(SVGNS, tagName);
}

export function translateDOMtoSVGcoordinates(x, y) {
    let point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    let svgCoordinates = point.matrixTransform(svg.getScreenCTM().inverse());
    return svgCoordinates;
}

