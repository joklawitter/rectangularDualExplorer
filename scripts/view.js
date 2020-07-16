"use strict";

import * as model from "./model.js";

let svg = document.querySelector("#theSVG");

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
    svgEdge.id = "svg-" + edge.id;
    svgEdge.classList.add("edge");

    edge.svgEdge = this.svgEdge;
    svgEdge.edge = edge;

    edgeLayer.append(svgEdge);
    return svgEdge;
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

export function drawPolylineFromToVia(startVertex, targetVertex, midpoint, id) {
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

    svgEdge.id = "svg-" + id;
    svgEdge.classList.add("edge");

    edgeLayer.append(svgEdge);
    return svgEdge;
}

export function changeVertexSize(vertexSize) {
    document.documentElement.style.setProperty('--vertexSize', vertexSize);

    for (let vertex of model.graph.vertices) {
        vertex.svgVertex.setAttribute("r", vertexSize);
    }
}

export function changeEdgeWidth(edgeWidth) {
    document.documentElement.style.setProperty('--edgeWidth', edgeWidth);

    for (let edge of model.graph.edges) {
        edge.svgEdge.setAttribute("style", "stroke-width: " 
        + getComputedStyle(document.documentElement).getPropertyValue('--edgeWidth'));
    }
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