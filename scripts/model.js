"use strict";

import * as view from "./view.js";

export let graph = null;

export function initGraph(id = 0, name = "graph") {
    graph = new Graph(id, null, null, name);
}

export class Graph {
    constructor(id, vertices, edges, name = "") {
        this.id = id;
        this.name = name;
        this.vertices = vertices;
        this.edges = edges;
        if (this.vertices === null) {
            this.vertices = [];
        }
        if (this.edges === null) {
            this.edges = [];
        }
        this.svgLabel = null;
        this.svgGraphPanel = null;

        for (let vertex of this.vertices) {
            vertex.graph = this;
        }
    }

    static parseGraph(JSONstring) {
        let JSONgraph = JSON.parse(JSONstring);
        let vertices = [];
        let edges = [];

        let id = JSONgraph.id;
        console.log(JSONgraph.vertices);

        JSONgraph.vertices.forEach((vertex) => {
            let newVertex = new Vertex(vertex.id, vertex.x, vertex.y);
            vertices.push(newVertex);
        });

        JSONgraph.edges.forEach((edge) => {
            let source = vertices[edge.source];
            let target = vertices[edge.target];
            let newEdge = new Edge(edge.id, source, target);
            edges.push(newEdge);
        });

        let name = (JSONgraph.hasOwnProperty("name")) ? JSONgraph.name : "";

        graph = new Graph(JSONgraph.id, vertices, edges, name);
    }

    toJSON() {
        let JSONgraph = {};
        JSONgraph.id = this.id;
        JSONgraph.name = this.name;
        JSONgraph.vertices = [];
        for (let vertex of this.vertices) {
            JSONgraph.vertices.push({
                "id": vertex.id,
                "x": vertex.x,
                "y": vertex.y
            })
        }

        JSONgraph.edges = [];
        for (let edge of this.edges) {
            JSONgraph.edges.push({
                "id": edge.id,
                "source": edge.source.id,
                "target": edge.target.id
            })
        }

        return JSON.stringify(JSONgraph);
    }

    addVertex(vertex) {
        this.vertices.push(vertex);
    }

    removeVertex(vertex) {
        const index = this.vertices.indexOf(vertex);
        if (index > -1) {
            this.vertices.splice(index, 1);
        }
    }

    addEdge(edge) {
        this.edges.push(edge);
    }

    removeEdge(edge) {
        const index = this.edges.indexOf(edge);
        if (index > -1) {
            this.edges.splice(index, 1);
        }
    }

    async computeEdgeOrders() {
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i].orderEdgesCircularly();
        }
    }

    hasSeparatingTriangle() {
        for (let i = 4; i < this.vertices.length; i++) {
            const vertex = this.vertices[i];
            for (let j = 0; j < vertex.edges.length - 2; j++) {
                const edgeA = vertex.edges[j];
                const vertexA = edgeA.getOtherEndpoint(vertex);
                for (let k = j + 2; k < vertex.edges.length; k++) {
                    const edgeB = vertex.edges[k];
                    const vertexB = edgeB.getOtherEndpoint(vertex);

                    // if they are adjacent, they form a triangle
                    if (vertexA.hasNeighbour(vertexB)) {
                        // which is separating if edgeA and edgeB not consecuitive
                        // which is mostly excluded by choice of j and k
                        // unless we looped around in first round
                        if (!((j === 0) && (k === (vertex.edges.length - 1)))) {
                            view.highlightVertex(vertex);
                            view.highlightVertex(vertexA);
                            view.highlightVertex(vertexB);
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    isTriangulated() {
        for (let i = 4; i < this.vertices.length; i++) {
            const vertex = this.vertices[i];
            if (vertex.edges.length <= 2) {
                console.log("Vertex " + vertex.id + " is isolated or on path.");
                return false;
            }

            for (let j = 0; j < vertex.edges.length - 1; j++) {
                const vertexA = vertex.edges[j].getOtherEndpoint(vertex);
                const vertexB = vertex.edges[j + 1].getOtherEndpoint(vertex);

                // if they are adjacent, they form a triangle
                if (!vertexA.hasNeighbour(vertexB)) {
                    view.highlightVertex(vertex);
                    view.highlightVertex(vertexA);
                    view.highlightVertex(vertexB);
                    return false;
                }
            }
        }
        return true;
    }

    setPositionAsOrigin() {
        for (let vertex of this.vertices) {
            vertex.setPositionAsOrigin();
        }
    }

    moveBy(difX, difY, transition = d3.transition(), redraw = true) {
        for (let vertex of this.vertices) {
            vertex.moveByWithEdges(difX, difY, transition, redraw);
        }
    }

    collapseInto(x, y, transition = d3.transition()) {
        this.unhighlight(transition);
        for (let vertex of this.vertices) {
            vertex.oldx = vertex.x;
            vertex.oldy = vertex.y;
            vertex.moveToWithEdges(x, y, transition);
            vertex.fadeLabel(transition);
        }

        let that = this;
        setTimeout(() => {
            that.hide();
        }, 400);
    }

    uncollapse(transition = d3.transition()) {
        this.unhide();
        for (let vertex of this.vertices) {
            vertex.moveToOriginWithEdges(transition);
            vertex.appearLabel(transition);
        }
    }

    hide() {
        for (let vertex of this.vertices) {
            vertex.hide();
        }

        for (let edge of this.edges) {
            edge.hide();
        }

        if (this.hasName()) {
            this.svgLabel.classList.add("hidden");
        }
    }

    unhide() {
        for (let vertex of this.vertices) {
            vertex.unhide();
        }

        for (let edge of this.edges) {
            edge.unhide();
        }

        if (this.hasName()) {
            this.svgLabel.classList.remove("hidden");
        }
    }

    appear(transition = d3.transition()) {
        for (let vertex of this.vertices) {
            vertex.appear(transition);
        }

        for (let edge of this.edges) {
            edge.appear(transition);
        }
    }

    unhighlight(transition = d3.transition()) {
        for (let vertex of this.vertices) {
            vertex.unhighlight(transition);
        }
        for (let edge of this.edges) {
            edge.unhighlight(transition);
        }
    }

    removeDrawing() {
        for (let vertex of this.vertices) {
            let element = vertex.svgVertex;
            element.parentNode.removeChild(element);
            vertex.svgVertex = null;
            if (vertex.hasLabel()) {
                element = vertex.svgLabel;
                element.parentNode.removeChild(element);
                vertex.svgLabel = null;
            }
        }

        for (let edge of this.edges) {
            let element = edge.svgEdge;
            element.parentNode.removeChild(element);
            edge.svgEdge = null;
        }

        if (this.hasName()) {
            let element = this.svgLabel;
            element.parentNode.removeChild(element);
            this.svgLabel = null;
        }

        this.drawn = false;
    }

    hasName() {
        return (this.name !== "");
    }
}

export class Vertex {
    constructor(id, x, y, type = "disc") {
        if (type == "") {
            type = "disc";
        }

        this.id = id;
        this.x = x;
        this.y = y;
        this.type = type;
        this.edges = [];
        this.isOnOuterFace = false;

        this.svgVertex = null;
        this.svgLabel = null;

        this.svgHighlight = null;
        this.isHighlighted = false;
    }

    async removeEdge(edge) {
        const index = this.edges.indexOf(edge);
        if (index > -1) {
            this.edges.splice(index, 1);
        }
    }

    async orderEdgesCircularly() {
        if (this.id < 4) {
            this.edge0 = this.edges[0];
            this.edge1 = this.edges[1];
        }

        this.edges.sort((a, b) => {
            let angleA = a.computeAngleFrom(this);
            let angleB = b.computeAngleFrom(this);
            // console.log("computed angles");
            // console.log(a.id + ": " + angleA);
            // console.log(b.id + ": " + angleB);

            if (angleA > angleB) return 1;
            if (angleA == angleB) return 0;
            if (angleA < angleB) return -1;
        })

        switch (this.id) {
            case 0:
                this.edges.splice(this.edges.indexOf(this.edge0), 1);
                this.edges.splice(this.edges.indexOf(this.edge1), 1);
                this.edges.unshift(this.edge0);
                this.edges.push(this.edge1);

                break;
            case 1:
            case 2:
            case 3:
                this.edges.splice(this.edges.indexOf(this.edge0), 1);
                this.edges.splice(this.edges.indexOf(this.edge1), 1);
                this.edges.unshift(this.edge1);
                this.edges.push(this.edge0);
                break;
        }
    }

    hasNeighbour(other) {
        for (let edge of this.edges) {
            if (edge.getOtherEndpoint(this) === other) {
                return true;
            }
        }
        return false;
    }

    // hide and unhide
    hide() {
        this.svgVertex.classList.add("hidden");

        if (this.hasLabel()) {
            this.svgLabel.classList.add("hidden");
        }

        if (this.hasHighlight()) {
            this.svgHighlight.classList.add("hidden");
        }
    }

    unhide() {
        this.svgVertex.classList.remove("hidden");

        if (this.hasLabel()) {
            this.svgLabel.classList.remove("hidden");
        }

        if (this.hasHighlight()) {
            this.svgHighlight.classList.remove("hidden");
        }
    }

    hideWithEdges() {
        this.hide();
        for (let edge of this.edges) {
            edge.hide();
        }
    }

    unhideWithEdges() {
        this.unhide();
        for (let edge of this.edges) {
            edge.unhide();
        }
    }

    appear(transition) {
        let d3Vertex = d3.select("#" + this.svgVertex.id);
        if (this.isDisc()) {
            d3Vertex
                .attr("r", 0)
                .classed("hidden", false)
                .style("stroke-width", 0)
                .transition(transition)
                .style("stroke-width", "")
                .attr("r", vertexSize);
        } else if (this.isRect()) {
            d3Vertex
                .attr("width", 0)
                .attr("height", 0)
                .attr("x", this.getSVGX())
                .attr("y", this.getSVGY())
                .classed("hidden", false)
                .style("stroke-width", 0)
                .transition(transition)
                .style("stroke-width", "")
                .attr("width", 2 * vertexSize)
                .attr("height", 2 * vertexSize)
                .attr("x", this.getSVGX() - vertexSize)
                .attr("y", this.getSVGY() - vertexSize);
        }

        if (this.hasLabel()) {
            this.appearLabel(transition);
        }
    }

    appearLabel(transition) {
        if (this.hasLabel()) {
            let d3label = d3.select("#" + this.svgLabel.id);
            d3label
                .style("font-size", 0)
                .classed("hidden", false)
                .transition(transition)
                .style("font-size", "");

        }
    }

    fade(transition) {
        let d3Selection = d3.select("#" + this.svgVertex.id);
        if (this.isDisc()) {
            d3Selection
                .transition(transition)
                .attr("r", 0);
        } else if (this.isRect()) {
            d3Selection
                .transition(transition)
                .attr("width", 0)
                .attr("height", 0)
                .attr("x", this.getSVGX())
                .attr("y", this.getSVGY());
        }

        if (this.hasLabel()) {
            if (this.svgLabel !== null) {
                this.svgLabel.classList.add("hidden");
            }
        }
    }

    fadeLabel(transition) {
        if (this.hasLabel()) {
            let d3label = d3.select("#" + this.svgLabel.id);
            d3label
                .transition(transition)
                .style("font-size", 0);

        }
    }

    // move
    moveTo(newX, newY, transition) {
        this.x = newX;
        this.y = newY;

        this.redraw(transition);
    }

    moveBy(difX, difY, transition, redraw = true) {
        this.x += difX;
        this.y += difY;

        if (redraw) {
            this.redraw(transition);
        }
    }

    redraw(transition) {
        let d3Selection = d3.select("#" + this.svgVertex.id);
        if (this.isDisc()) {
            d3Selection
                .transition(transition)
                .attr("cx", this.getSVGX())
                .attr("cy", this.getSVGY());
        } else if (this.isRect()) {
            d3Selection
                .transition(transition)
                .attr("x", this.getSVGX() - vertexSize)
                .attr("y", this.getSVGY() - vertexSize);
        } else {
            console.log("Vertex of unknown type.");
        }

        if (this.svgHighlight !== null) {
            let d3Selection = d3.select("#" + this.svgHighlight.id);
            if (this.isDisc()) {
                d3Selection
                    .transition(transition)
                    .attr("cx", this.getSVGX())
                    .attr("cy", this.getSVGY());
            } else if (this.isRect()) {
                d3Selection
                    .transition(transition)
                    .attr("x", this.getSVGX() - highlightSize)
                    .attr("y", this.getSVGY() - highlightSize);
            }
        }

        if (this.svgLabel !== null) {
            let d3selection = d3.select("#" + this.svgLabel.id);
            d3selection
                .transition(transition)
                .attr("x", this.getSVGX())
                .attr("y", this.getSVGY());
        }
    }

    moveToWithEdges(newX, newY, transition) {
        this.moveByWithEdges(newX - this.x, newY - this.y, transition);
    }

    moveByWithEdges(difX, difY, transition, redraw = true) {
        this.moveBy(difX, difY, transition, redraw);
        if (redraw) {
            for (let edge of this.edges) {
                edge.update(transition);
            }
        }

        if ((this.id === 0) && this.graph.hasName() && this.graph.drawn) {
            let d3Selection = d3.select("#" + this.graph.svgLabel.id);
            d3Selection
                .transition(transition)
                .attr("x", this.svgGraphPanel.getPixelForXCoordinate(this.x))
                .attr("y", this.svgGraphPanel.getPixelForYCoordinate(this.y));
        }
    }

    moveToOriginWithEdges(transition = d3.transition()) {
        this.moveToWithEdges(this.origx, this.origy, transition);
    }

    // highlight
    highlight(transition = d3.transition(), colorNumber = 0, layerNumber = 0) {
        if (this.svgHighlight !== null) {
            this.svgHighlight.remove();
        }
        this.svgGraphPanel.createVertexHighlight(this, colorNumber, layerNumber);

        let d3Highlight = d3.select("#" + this.svgHighlight.id);
        if (this.isDisc()) {
            d3Highlight
                .attr("r", 0)
                .classed("hidden", false)
                .transition(transition)
                .style("stroke-width", "")
                .attr("r", highlightSize);
        } else if (this.isRect()) {
            d3Highlight
                .attr("width", 0)
                .attr("height", 0)
                .attr("x", this.getSVGX())
                .attr("y", this.getSVGY())
                .classed("hidden", false)
                .transition(transition)
                .attr("width", 2 * highlightSize)
                .attr("height", 2 * highlightSize)
                .attr("x", this.getSVGX() - highlightSize)
                .attr("y", this.getSVGY() - highlightSize);
        }

        this.isHighlighted = true;
    }

    unhighlight(transition = d3.transition()) {
        if (this.svgHighlight !== null) {
            let d3Highlight = d3.select("#" + this.svgHighlight.id);
            if (this.isDisc()) {
                d3Highlight
                    .transition(transition)
                    .attr("r", 0)
                    .remove();
            } else if (this.isRect()) {
                d3Highlight
                    .transition(transition)
                    .attr("width", 0)
                    .attr("height", 0)
                    .attr("x", this.getSVGX())
                    .attr("y", this.getSVGY())
                    .remove();
            }
        }

        this.isHighlighted = false;
    }

    // helpers
    getSVGX() {
        return this.svgGraphPanel.getPixelForXCoordinate(this.x);
    }

    getSVGY() {
        return this.svgGraphPanel.getPixelForYCoordinate(this.y);
    }

    isDisc() {
        return ((this.type === "disc") || (this.type === "fdisc"));
    }

    isRect() {
        return ((this.type === "square") || (this.type === "fsquare"));
    }

    hasLabel() {
        return this.label !== "";
    }

    hasHighlight() {
        return this.svgHighlight !== null;
    }

    setPositionAsOrigin() {
        this.origx = this.x;
        this.origy = this.y;
    }
}

export class Edge {
    constructor(id, source, target) {
        this.id = id;
        this.source = source;
        this.target = target;
        this.string = "(" + source.id + "," + target.id + ")";

        this.svgEdge = null;

        this.svgHighlight = null;
        this.isHighlighted = false;

        this.source.edges.push(this);
        this.target.edges.push(this);
    }

    computeSlope() {
        return (this.target.y - this.source.y) / (this.target.x - this.source.x);
    }

    computeAngleFrom(u) {
        const v = this.getOtherEndpoint(u);
        const vRelativeX = v.x - u.x;
        const vRelativeY = v.y - u.y;
        // console.log("rel x: " + vRelativeX + ", rel y: " + vRelativeY);
        // const angle = Math.atan((v.y - u.y) / (v.x - u.x)) * (180 / Math.PI);
        const angle = Math.atan2(vRelativeY, vRelativeX) * 180 / Math.PI;
        return angle;
    }

    getOtherEndpoint(vertex) {
        return (this.source === vertex) ? this.target : this.source;
    }

    hide() {
        this.svgEdge.classList.add("hidden");

        if (this.isHighlighted) {
            this.svgHighlight.classList.add("hidden");
        }
    }

    unhide() {
        this.svgEdge.classList.remove("hidden");

        if (this.isHighlighted) {
            this.svgHighlight.classList.remove("hidden");
        }
    }

    appear(transition) {
        d3.select("#" + this.svgEdge.id)
            .style("stroke-width", 0)
            .classed("hidden", false)
            .transition(transition)
            .style("stroke-width", 2.5);
    }

    fade(transition) {
        d3.select("#" + this.svgEdge.id)
            .transition(transition)
            .style("stroke-width", 0);
        // .classed("hidden", true);


        this.unhighlight(transition);
    }

    draw(transition, forward = true) {
        if (forward) {
            d3.select("#" + this.svgEdge.id)
                .attr("x2", this.source.getSVGX())
                .attr("y2", this.source.getSVGY())
                .classed("hidden", false)
                .style("stroke", "transparent")
                .transition(transition)
                .style("stroke", "")
                .attr("x2", this.target.getSVGX())
                .attr("y2", this.target.getSVGY());
        } else {
            d3.select("#" + this.svgEdge.id)
                .attr("x1", this.target.getSVGX())
                .attr("y1", this.target.getSVGY())
                .classed("hidden", false)
                .style("stroke", "transparent")
                .transition(transition)
                .style("stroke", "")
                .attr("x1", this.source.getSVGX())
                .attr("y1", this.source.getSVGY());

        }
    }

    update(transition) {
        d3.select("#" + this.svgEdge.id)
            .transition(transition)
            .attr("x1", this.source.getSVGX())
            .attr("y1", this.source.getSVGY())
            .attr("x2", this.target.getSVGX())
            .attr("y2", this.target.getSVGY());

        if (this.svgHighlight !== null) {
            d3.select("#" + this.svgHighlight.id)
                .transition(transition)
                .attr("x1", this.source.getSVGX())
                .attr("y1", this.source.getSVGY())
                .attr("x2", this.target.getSVGX())
                .attr("y2", this.target.getSVGY());
        }
    }

    highlight(transition, colorNumber = 0, layerNumber) {
        if (this.isHighlighted) {
            this.svgHighlight.remove();
        }

        this.svgGraphPanel.createEdgeHighlight(this, colorNumber, layerNumber);


        d3.select("#" + this.svgHighlight.id)
            .classed("hidden", false)
            .style("stroke-width", 0)
            .transition(transition)
            .style("stroke-width", "");

        this.isHighlighted = true;
    }

    drawHighlight(transition, colorNumber = 0, forward = true, layerNumber) {
        this.svgGraphPanel.createEdgeHighlight(this, colorNumber, layerNumber);

        if (forward) {
            d3.select("#" + this.svgHighlight.id)
                .classed("hidden", false)
                .attr("x2", this.source.getSVGX())
                .attr("y2", this.source.getSVGY())
                .transition(transition)
                .attr("x2", this.target.getSVGX())
                .attr("y2", this.target.getSVGY());
        } else {
            d3.select("#" + this.svgHighlight.id)
                .classed("hidden", false)
                .attr("x1", this.target.getSVGX())
                .attr("y1", this.target.getSVGY())
                .transition(transition)
                .attr("x1", this.source.getSVGX())
                .attr("y1", this.source.getSVGY());
        }


        this.isHighlighted = true;
    }

    unhighlight(transition) {
        if (this.svgHighlight !== null) {
            d3.select("#" + this.svgHighlight.id)
                .transition(transition)
                .style("stroke-width", 0)
                .remove();
        }

        this.isHighlighted = false;
    }
}
