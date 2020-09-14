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
        this.hasREL = false;

        for (let vertex of this.vertices) {
            vertex.graph = this;
        }
    }

    static parseGraph(JSONgraph) {
        let vertices = [];
        let edges = [];

        let id = JSONgraph.id;

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

    async removeVertex(vertex) {
        if (vertex.id < 4) {
            // cannot remove outer vertex
            return;
        }

        let edges = []
        for (let edge of vertex.edges) {
            edges.push(edge);
        }
        for (let edge of edges) {
            await this.removeEdge(edge);
        }

        const index = this.vertices.indexOf(vertex);
        if (index > -1) {
            let lastVertex = this.vertices.pop();
            if (lastVertex !== vertex) {
                lastVertex.id = index;
                lastVertex.svgVertex.id = "svg-" + lastVertex.id;
                this.vertices.splice(index, 1, lastVertex);
            }
        }

        if (vertex.svgVertex != null) {
            vertex.svgVertex.remove();
        }
    }

    addEdge(edge) {
        this.edges.push(edge);
    }

    async removeEdge(edge) {
        const index = this.edges.indexOf(edge);
        if (index > -1) {
            let lastEdge = this.edges.pop();
            if (lastEdge !== edge) {
                lastEdge.id = index;
                lastEdge.svgEdge.id = "svg-e" + lastEdge.id;
                this.edges.splice(index, 1, lastEdge);
            }
        }

        edge.source.removeEdge(edge);
        edge.target.removeEdge(edge);

        if (edge.svgEdge != null) {
            edge.svgEdge.remove();
        }
    }

    async computeEdgeOrders() {
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i].orderEdgesCircularly();
        }
    }

    async hasSeparatingTriangle() {
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

    async isTriangulated() {
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

    flipFlipCycle(flipCycle) {
        let u = flipCycle.u;
        let v = flipCycle.v;
        let w = flipCycle.w;
        let x = flipCycle.x;

        let edgesToFlip = [];
        let verticesWithChange = [];

        verticesWithChange.push(u);
        u.marked = true;
        verticesWithChange.push(v);
        v.marked = true;
        verticesWithChange.push(w);
        w.marked = true;
        verticesWithChange.push(x);
        x.marked = true;

        for (let i = u.edges.indexOf(flipCycle.ue) + 1; i < u.edges.length; i++) {
            const e = u.edges[i];
            const neighbor = e.getOtherEndpoint(u);
            if (neighbor === x) {
                break;
            } else {
                edgesToFlip.push(e);
                if (!neighbor.hasOwnProperty("marked") || (neighbor.marked === false)) {
                    traverseFlipCycle(neighbor, flipCycle, edgesToFlip, verticesWithChange);
                }
            }
        }

        for (let i = v.edges.indexOf(flipCycle.ve) + 1; i < v.edges.length; i++) {
            const e = v.edges[i];
            const neighbor = e.getOtherEndpoint(v);
            edgesToFlip.push(e);
            if (!neighbor.hasOwnProperty("marked") || (neighbor.marked === false)) {
                traverseFlipCycle(neighbor, flipCycle, edgesToFlip, verticesWithChange);
            }
        }

        for (let i = x.numIncomingEdges; i < x.edges.length; i++) {
            const e = x.edges[i];
            const neighbor = e.getOtherEndpoint(x);
            if (neighbor === w) {
                break;
            } else {
                edgesToFlip.push(e);
                if (!neighbor.hasOwnProperty("marked") || (neighbor.marked === false)) {
                    traverseFlipCycle(neighbor, flipCycle, edgesToFlip, verticesWithChange);
                }
            }
        }

        for (const edge of edgesToFlip) {
            if (flipCycle.orientation === orientations.CW) {
                if (edge.color === colors.BLUE) {
                    edge.reverse();
                    edge.color = colors.RED;
                } else {
                    edge.color = colors.BLUE;
                }
            } else {
                if (edge.color === colors.RED) {
                    edge.reverse();
                    edge.color = colors.BLUE;
                } else {
                    edge.color = colors.RED;
                }
            }
            view.colorEdge(edge);
        }

        for (const vertex of verticesWithChange) {
            vertex.orderEdgesInOut();
            vertex.marked = false;
        }

        function traverseFlipCycle(vertex, flipCycle, edgesToFlip, verticesWithChange) {
            vertex.marked = true;
            verticesWithChange.push(vertex);
            for (let i = vertex.numIncomingEdges; i < vertex.edges.length; i++) {
                const e = vertex.edges[i];
                const neighbor = e.getOtherEndpoint(vertex);
                edgesToFlip.push(e);
                if (!neighbor.hasOwnProperty("marked") || (neighbor.marked === false)) {
                    traverseFlipCycle(neighbor, flipCycle, edgesToFlip, verticesWithChange);
                }
            }
        }
    }
}

export class Vertex {
    constructor(id, x, y, type = "disc") {
        this.id = id;
        this.x = x;
        this.y = y;
        this.type = type;
        this.edges = [];
        this.numIncomingEdges = -1;
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
        if (this.edges.length == 0) {
            this.numIncomingEdges = 0;
            return this;
        }

        this.edges.sort((a, b) => {
            let angleA = a.computeAngleFrom(this);
            let angleB = b.computeAngleFrom(this);

            if (angleA > angleB) return 1;
            if (angleA == angleB) return 0;
            if (angleA < angleB) return -1;
        })

        return this;
    }

    async orderEdgesInOut() {
        if (this.edges.length == 0) {
            this.numIncomingEdges = 0;
            return this;
        }

        let endIntervalOutgoing = -1;
        for (let i = 0; i < this.edges.length; i++) {
            if (this.isOutgoingEdge(this.edges[i])) {
                endIntervalOutgoing = i;
            } else {
                break;
            }
        }

        if (endIntervalOutgoing >= 0) {
            // there were outgoing edges at the start
            let outEdges = this.edges.splice(0, endIntervalOutgoing + 1);
            this.edges = this.edges.concat(outEdges);
        } else {
            // we might have incoming edges at start and end
            let endIntervalIncoming = this.edges.length;
            for (let i = this.edges.length - 1; i >= 0; i--) {
                const edge = this.edges[i];
                if (this.isIncomingEdge(edge)) {
                    endIntervalIncoming = i;
                } else {
                    break;
                }
            }

            if (endIntervalIncoming < this.edges.length) {
                // there were outgoing edges at the start
                let inEdges = this.edges.splice(endIntervalIncoming);
                this.edges = inEdges.concat(this.edges);
            }
        }

        // set number of incoming edges
        await this.setNumberIncomingEdges();

        return this;
    }

    async setNumberIncomingEdges() {
        let count = 0;
        for (const edge of this.edges) {
            if (this.isIncomingEdge(edge)) {
                count++;
            }
        }
        this.numIncomingEdges = count;

        return this.numIncomingEdges;
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

    nextEdge(edge) { // CW
        const index = this.edges.indexOf(edge);
        return (index === this.edges.length - 1) ? this.edges[0] : this.edges[index + 1];
    }

    prevEdge(edge) { // CCW
        const index = this.edges.indexOf(edge);
        return (index === 0) ? this.edges[this.edges.length - 1] : this.edges[index - 1];
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
        let vx, vy;
        if (this.svgEdge !== null) {
            if (this.svgEdge.tagName === "line") {
                vx = v.x;
                vy = v.y;
            } else {
                let points = this.svgEdge.points;
                let i = (this.source === u) ? 1 : points.length - 2;
                vx = points[i].x;
                vy = points[i].y;
            }
        } else {
            if (this.original.svgEdge.tagName === "line") {
                vx = v.x;
                vy = v.y;
            } else {
                let points = this.original.svgEdge.points;
                let i = (this.source === u) ? 1 : points.length - 2;
                vx = points[i].x;
                vy = points[i].y;
            }
        }
        const vRelativeX = vx - u.x;
        const vRelativeY = vy - u.y;
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
    BLUE: "blue",
    GREEN: "green"
}

export const orientations = {
    CW: "cw",
    CCW: "ccw"
}

