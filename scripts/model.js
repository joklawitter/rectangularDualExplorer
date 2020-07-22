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

        if (this.id < 4) {
            delete this.edge0;
            delete this.edge1;
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

    isIncomingEdge(edge) {
        return (this === edge.target);
    }

    isOutgoingEdge(edge) {
        return (this === edge.source);
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

    reverse() {
        let swap = this.source;
        this.source = this.target;
        this.target = swap;

        if ((this.svgEdge != null) && (this.svgEdge.tagName === "line")) {
            this.svgEdge.setAttribute("x1", this.source.x);
            this.svgEdge.setAttribute("y1", this.source.y);
            this.svgEdge.setAttribute("x2", this.target.x);
            this.svgEdge.setAttribute("y2", this.target.y);
        }
    }
}

export const colors = {
    RED: "red",
    BLUE: "blue"
}

export const orientations = {
    CW: "cw",
    CCW: "ccw"
}

