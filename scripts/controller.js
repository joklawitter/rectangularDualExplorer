"use strict";

import * as model from "./model.js";
import * as view from "./view.js";

export function toolSelected(element) {
    console.log("selcted:" + element.value);

    let svg = document.querySelector("#theSVG");

    if (element.value == "drawGraph") {
        console.log("click to add vertex");
        svg.addEventListener("click", function (event)  {
            clickedOnSVG(this, event);
        });
    }
}

export function clickedOnSVG(svg, event) {
    if (mouseDownVertex != null && !clicked) {
        clicked = true;
        return;
    }
    clicked = false;

    console.log("clicked at " + event.x + ", " + event.y);
    
    // create vertex
    let vertex = new model.Vertex(model.graph.vertices.length, event.x, event.y);
    model.graph.addVertex(vertex);
    
    // draw it
    let svgVertex = view.drawVertex(vertex);

    // add listener
    svgVertex.addEventListener("mousedown", event => {
        mouseDownVertex = event.currentTarget.vertex;
        clicked = false;
    })
    svgVertex.addEventListener("mouseup", event => {
        mouseUpVertex = event.currentTarget.vertex;
        drawEdgeEvent();
    })

    console.log(svgVertex);
}

let clicked = false;
let mouseDownVertex = null;
let mouseUpVertex = null;

function drawEdgeEvent(event) {
     // create vertex
     let edge = new model.Edge("edge" + model.graph.edges.length, mouseDownVertex, mouseUpVertex);
     model.graph.addEdge(edge);
     
     // draw it
     let svgEdge = view.drawEdge(edge);

     // clean up
    //  mouseDownVertex = null;
    //  mouseUpVertex = null;
    //  clicked = false;
}

