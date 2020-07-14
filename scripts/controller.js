"use strict";

import * as model from "./model.js";
import * as view from "./view.js";

export function toolSelected(element) {
    console.log("selcted:" + element.value);

    let svg = document.querySelector("#theSVG");

    if (element.value == "drawGraph") {
        addOuterFourCycle(svg);
        svg.addEventListener("click", function (event) {
            clickedOnSVG(event, this);
        });
    }
}

export async function clickedOnSVG(event, svg) {
    if (startVertex != null) {
        svg.removeEventListener("mousemove", mouseMoveHandler);
    }

    let coordinates = view.translateDOMtoSVGcoordinates(event.x, event.y);
    let svgVertex = await addVertex(coordinates, svg);

    if (startVertex != null) {
        endHalfEdge(svgVertex, svg);
    }
}

async function addVertex(coordinates, svg) {
    // create vertex
    let vertex = new model.Vertex(model.graph.vertices.length, coordinates.x, coordinates.y);
    model.graph.addVertex(vertex);

    // draw it
    let svgVertex = view.drawVertex(vertex);

    // add listener
    svgVertex.addEventListener("click", event => {
        event.stopPropagation();
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
    })

    return svgVertex;
}

function initHalfEdge(event, svg) {
    startVertex = event.currentTarget;
    halfEdge = view.addHalfEdge(startVertex);

    svg.addEventListener("mousemove", mouseMoveHandler);
}

function endHalfEdge(endVertex, svg) {
    let edge = new model.Edge("edge" + model.graph.edges.length, startVertex.vertex, endVertex.vertex);
    model.graph.addEdge(edge);
    let svgEdge = view.drawEdge(edge);

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
        let vertexSize = event.currentTarget.value
        document.documentElement.style.setProperty('--vertexSize', vertexSize);

        for (let vertex of model.graph.vertices) {
            vertex.svgVertex.setAttribute("r", vertexSize);
        }
    }
}

let startVertex = null;
let halfEdge = null;

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