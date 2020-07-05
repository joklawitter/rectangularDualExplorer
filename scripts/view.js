"use strict";

import * as model from "./model.js";

let svg = document.querySelector("#theSVG");
const vertexSize = 7;

export function initSVG() {
    let layer = createSVGElement("g");
    layer.id = "hightlightLayer";
    svg.append(layer);
    
    layer = createSVGElement("g");
    layer.id = "edgeLayer";
    svg.append(layer);

    layer = createSVGElement("g");
    layer.id = "vertexLayer";
    svg.append(layer);
}

export function drawVertex(vertex) {
    let vertexLayer = svg.querySelector("#vertexLayer");
    let coordinates = translateDOMtoSVGcoordinates(vertex.x, vertex.y);

    let svgVertex = createSVGElement("circle");
    svgVertex.setAttribute("r", vertexSize);
    svgVertex.setAttribute("cx", coordinates.x);
    svgVertex.setAttribute("cy", coordinates.y);
    svgVertex.id = "svg-" + vertex.id;

    vertex.svgVertex = this.svgVertex;
    svgVertex.vertex = vertex;

    vertexLayer.append(svgVertex);
    return svgVertex;
}

export function drawEdge(edge) {
    let edgeLayer = svg.querySelector("#edgeLayer");
    let coordinatesSource = translateDOMtoSVGcoordinates(edge.source.x, edge.source.y);
    let coordinatesTarget = translateDOMtoSVGcoordinates(edge.target.x, edge.target.y);
    

    let svgEdge = createSVGElement("line");
    svgEdge.setAttribute("x1", coordinatesSource.x);
    svgEdge.setAttribute("y1", coordinatesSource.y);
    svgEdge.setAttribute("x2", coordinatesTarget.x);
    svgEdge.setAttribute("y2", coordinatesTarget.y);
    svgEdge.id = "svg-" + edge.id;
    svgEdge.classList.add("edge");

    edge.svgEdge = this.svgEdge;
    svgEdge.edge = edge;

    edgeLayer.append(svgEdge);
    return svgEdge;
}

const SVGNS = "http://www.w3.org/2000/svg";

function createSVGElement(tagName) {
    return document.createElementNS(SVGNS, tagName);
}

function translateDOMtoSVGcoordinates(x, y) {
    let point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    let svgCoordinates = point.matrixTransform(svg.getScreenCTM().inverse());
    return svgCoordinates;
}