"use strict";

import * as model from "./model.js";

let svg = document.querySelector("#theSVG");

const WIDTH = 700;
const HEIGHT = 360;
const PADDING = 10;

export function initSVG() {
    let layer = createSVGElement("g");
    layer.id = "rectangularDualLayer";
    svg.append(layer);
    
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
    changeVertexHighlightSize(vertexSize);
}

function changeVertexHighlightSize(vertexSize) {
    let highlightSize = parseInt(vertexSize) + parseInt(getComputedStyle(document.documentElement).getPropertyValue('--highlightDifference'));
    document.documentElement.style.setProperty('--vertexHighlightSize', highlightSize);
    return highlightSize;
}

export async function resetSVG() {
    for (let layer of svg.children) {
        resetLayer(layer.id);
    }

    return true;
}

export async function resetLayer(id) {
    let layer = svg.querySelector("#" + id);
    while (layer.firstChild) {
        layer.removeChild(layer.lastChild);
    }
}

export async function drawGraph(graph) {
    // draw vertices
    for (let vertex of graph.vertices) {
        let svgVertex = drawVertex(vertex);
    }

    // draw four outer edges
    let width = 700;
    let height = 350;
    let padding = 10;
    let coordinates = {
        x: padding,
        y: padding
    }
    // vertex order: W, S, E, N
    // edge order WN, NE, ES, SW
    drawPolylineFromToVia(graph.vertices[0].svgVertex, graph.vertices[3].svgVertex, coordinates, graph.edges[0]);

    coordinates.x = width - padding;
    drawPolylineFromToVia(graph.vertices[3].svgVertex, graph.vertices[2].svgVertex, coordinates, graph.edges[1]);

    coordinates.y = height - padding;
    drawPolylineFromToVia(graph.vertices[2].svgVertex, graph.vertices[1].svgVertex, coordinates, graph.edges[2]);

    coordinates.x = padding;
    drawPolylineFromToVia(graph.vertices[1].svgVertex, graph.vertices[0].svgVertex, coordinates, graph.edges[3]);

    // draw other edges
    for (let i = 4; i < graph.edges.length; i++) {
        drawEdge(graph.edges[i]);
    }
}

export async function drawVertex(vertex) {
    let vertexLayer = svg.querySelector("#vertexLayer");

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

    let edges = vertex.edges;
    for (let edge of edges) {
        let svgEdge = edge.svgEdge;
        if (edge.source === vertex) {
            svgEdge.setAttribute("x1", coordinates.x);
            svgEdge.setAttribute("y1", coordinates.y);
        }
        else {
            svgEdge.setAttribute("x2", coordinates.x);
            svgEdge.setAttribute("y2", coordinates.y);
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

    edgeLayer.append(svgEdge);
    return svgEdge;
}

export function colorEdge(edge) {
    if (edge.color === model.colors.RED) {
        edge.svgEdge.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue('--redStroke'));
        edge.svgEdge.setAttribute("marker-end", "url(#arrowRed)");
    } else if (edge.color === model.colors.BLUE) {
        edge.svgEdge.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue('--blueStroke'));
        edge.svgEdge.setAttribute("marker-end", "url(#arrowBlue)");
    } else if (edge.color === model.colors.GREN) {
        edge.svgEdge.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue('--greenStroke'));
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
    let highlightSize = changeVertexHighlightSize(vertexSize)

    for (let vertex of model.graph.vertices) {
        vertex.svgVertex.setAttribute("r", vertexSize);
        if (vertex.svgHighlight != null) {
            vertex.svgHighlight.setAttribute("r", highlightSize);
        }
    }
}

export function changeEdgeWidth(edgeWidth) {
    document.documentElement.style.setProperty('--edgeWidth', edgeWidth);

    for (let edge of model.graph.edges) {
        edge.svgEdge.setAttribute("style", "stroke-width: "
            + getComputedStyle(document.documentElement).getPropertyValue('--edgeWidth'));
    }
}

export function highlightVertex(vertex) {
    let hightlightLayer = svg.querySelector("#hightlightLayer");

    let svgHighlight = createSVGElement("circle");
    svgHighlight.setAttribute("r", getComputedStyle(document.documentElement).getPropertyValue('--vertexHighlightSize'));
    svgHighlight.setAttribute("cx", vertex.x);
    svgHighlight.setAttribute("cy", vertex.y);
    svgHighlight.classList.add("highlight");
    svgHighlight.id = "svg-highlight-" + vertex.id;

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
    }
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

export function drawRectangle(vertex, xmax, ymax) {
    // console.log("draw rectangle");
    // console.log(vertex);
    let offset = 1;
    let xStep = (WIDTH - 2) / xmax;
    let yStep = (HEIGHT - 2) / ymax;
    
    let rectangularDualLayer = svg.querySelector("#rectangularDualLayer");
    let svgRect = createSVGElement("rect");
    svgRect.setAttribute("x", offset + vertex.rectangle.x1 * xStep);
    svgRect.setAttribute("y", offset + vertex.rectangle.y1 * yStep);
    svgRect.setAttribute("width", (vertex.rectangle.x2 * xStep - vertex.rectangle.x1 * xStep));
    svgRect.setAttribute("height", (vertex.rectangle.y2 * yStep - vertex.rectangle.y1 * yStep));
    svgRect.setAttribute("stroke", "darkgray");
    svgRect.setAttribute("fill", "none");
    rectangularDualLayer.append(svgRect);

    vertex.svgRect = svgRect;
    svgRect.vertex = vertex;
}

const SVGNS = "http://www.w3.org/2000/svg";

function createSVGElement(tagName) {
    return document.createElementNS(SVGNS, tagName);
}

export function translateDOMtoSVGcoordinates(x, y) {
    let point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    let svgCoordinates = point.matrixTransform(svg.getScreenCTM().inverse());
    return svgCoordinates;
}