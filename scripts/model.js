"use strict";

import * as view from "./view.js";

export let graph = null;
export let graphRD = null;

export function initGraph(id = 0, name = "graph") {
    graph = new Graph(id, null, null, name);
}

export function setGraphRD(graph) {
    graphRD = graph;
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
        for (let edge of this.edges) {
            edge.graph = this;
        }
    }

    static parseGraph(JSONgraph) {
        let vertices = [];
        let edges = [];

        let id = JSONgraph.id;
        let hasREL = JSONgraph.hasREL;

        JSONgraph.vertices.forEach((vertex) => {
            let newVertex = new Vertex(vertex.id, vertex.x, vertex.y);
            vertices.push(newVertex);
        });

        JSONgraph.edges.forEach((edge) => {
            let source = vertices[edge.source];
            let target = vertices[edge.target];
            let newEdge = new Edge(edge.id, source, target);
            newEdge.color = edge.color;
            edges.push(newEdge);
        });

        let name = (JSONgraph.hasOwnProperty("name")) ? JSONgraph.name : "";

        graph = new Graph(JSONgraph.id, vertices, edges, name);
        graph.hasREL = hasREL;
    }

    toJSON() {
        let JSONgraph = {};
        JSONgraph.id = this.id;
        JSONgraph.name = this.name;
        JSONgraph.vertices = [];
        JSONgraph.hasREL = this.hasREL;
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
                "target": edge.target.id,
                "color": edge.color
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
                            view.highlightVertex(vertex, "highlightError");
                            view.highlightVertex(vertexA, "highlightError");
                            view.highlightVertex(vertexB, "highlightError");
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

    async flipFlipCycle(flipCycle) {
        console.log("> flip four-cycle", flipCycle);
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
            if (flipCycle.orientation === orientations.CCW) {
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

export async function copyGraph(graphToCopy, copyName = null) {
    let vertexCopies = [];
    let edgeCopies = [];

    // copy vertices
    for (const vertex of graphToCopy.vertices) {
        let vertexCopy = await copyVertex(vertex, copyName);
        vertexCopies.push(vertexCopy);
    }

    // copy edges
    for (const edge of graphToCopy.edges) {
        let sourceCopy, targetCopy;
        if (copyName !== null) {
            sourceCopy = edge.source[copyName];
            targetCopy = edge.target[copyName];
        } else {
            sourceCopy = edge.source.copy;
            targetCopy = edge.target.copy;
        }
        let edgeCopy = new Edge(edge.id, sourceCopy, targetCopy);
        edgeCopy.isHighlighted = edge.isHighlighted;
        edgeCopy.color = edge.color;
        edgeCopy.original = edge;
        if (copyName !== null) {
            edge[copyName] = edgeCopy;
            edgeCopy.svgEdge = edge.svgEdge;
        } else {
            edge.copy = edgeCopy;
        }

        edgeCopies.push(edgeCopy);
    }

    // set edges at vertices
    for (const vertex of graphToCopy.vertices) {
        let edgesCopiesAtVertex = [];
        for (const edge of vertex.edges) {
            if (copyName !== null) {
                edgesCopiesAtVertex.push(edge[copyName]);
            } else {
                edgesCopiesAtVertex.push(edge.copy);
            }
        }
        if (copyName !== null) {
            vertex[copyName].edges = edgesCopiesAtVertex;
        } else {
            vertex.copy.edges = edgesCopiesAtVertex;
        }
    }

    // create and return copy
    let graphCopy = new Graph(graphToCopy.id + "'", vertexCopies, edgeCopies, graphToCopy.name + "-copy");
    graphCopy.hasREL = graphToCopy.hasREL;
    graphCopy.original = graphToCopy;
    if (copyName !== null) {
        graphToCopy[copyName] = graphCopy;
    } else {
        graphToCopy.copy = graphCopy;
    }

    return graphCopy;
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
        this.svgRect = null;

        this.svgHighlight = null;
        this.isHighlighted = false;

        this.blueCopy = null;
        this.redCopy = null;
    }

    async removeEdge(edge) {
        const index = this.edges.indexOf(edge);
        if (index > -1) {
            this.edges.splice(index, 1);
        }
    }

    async orderEdgesCircularly() {
        // edges get order CW
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

    getEdgeToNeighbor(other) {
        for (let edge of this.edges) {
            if (edge.getOtherEndpoint(this) === other) {
                return edge;
            }
        }
        return null;
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

export async function copyVertex(vertexToCopy, copyName = null) {
    let vertexCopy = new Vertex(vertexToCopy.id, vertexToCopy.x, vertexToCopy.y, vertexToCopy.type);
    vertexCopy.numIncomingEdges = vertexToCopy.numIncomingEdges;
    vertexCopy.isOnOuterFace = vertexToCopy.isOnOuterFace;
    vertexCopy.isHighlighted = vertexToCopy.isHighlighted;
    vertexCopy.original = vertexToCopy;
    if (copyName !== null) {
        vertexToCopy[copyName] = vertexCopy;
    } else {
        vertexToCopy.copy = vertexCopy;
    }

    if (vertexToCopy.svgVertex !== null) {
        vertexCopy.svgVertex = vertexToCopy.svgVertex;
    }
    if (vertexToCopy.svgRect !== null) {
        vertexCopy.svgRect = vertexToCopy.svgRect;
    }

    return vertexCopy;
}

export class Edge {
    constructor(id, source, target, push = true) {
        this.id = id;
        this.source = source;
        this.target = target;
        this.string = "(" + source.id + "," + target.id + ")";

        this.svgEdge = null;

        this.svgHighlight = null;
        this.isHighlighted = false;

        if (push) {
            this.source.edges.push(this);
            this.target.edges.push(this);
        }
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
        } else if (this.original.svgEdge !== null) {
            if (this.original.svgEdge.tagName === "line") {
                vx = v.x;
                vy = v.y;
            } else {
                let points = this.original.svgEdge.points;
                let i = (this.source === u) ? 1 : points.length - 2;
                vx = points[i].x;
                vy = points[i].y;
            }
        } else {
            vx = v.x;
            vy = v.y;
        }
        const vRelativeX = vx - u.x;
        const vRelativeY = vy - u.y;
        const angle = Math.atan2(vRelativeY, vRelativeX) * 180 / Math.PI;
        return angle;
    }

    getOtherEndpoint(vertex) {
        return (this.source === vertex) ? this.target : this.source;
    }

    replaceEndpoint(oldEndpoint, newEndpoint) {
        if (this.source === oldEndpoint) {
            this.source = newEndpoint
        } else if (this.target === oldEndpoint) {
            this.target = newEndpoint;
        } else {
            console.error("request to replace old endpoint of edge, that is not actually an endpoint of the edge",
                "old endpoint " + oldEndpoint, "new endpoint " + newEndpoint);
        }
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

export function replaceEndpoint(edge, oldEndpoint, newEndpoint) {
    if (edge.source === oldEndpoint) {
        edge.source = newEndpoint
    } else if (edge.target === oldEndpoint) {
        edge.target = newEndpoint;
    } else {
        console.error("request to replace old endpoint of edge, that is not actually an endpoint of the edge",
            "old endpoint " + oldEndpoint, "new endpoint " + newEndpoint);
    }
}

export class FlipCycle {
    constructor(id, u, uEdge, v, vEdge, w, wEdge, x, xEdge, orientation, type = flipCycleType.UNSET) {
        this.id = id;
        this.u = u;
        this.ue = uEdge;
        this.v = v;
        this.ve = vEdge;
        this.w = w;
        this.we = wEdge;
        this.x = x;
        this.xe = xEdge;
        this.orientation = orientation;
        this.type = type;
        this.emptyType = null;
    }

    isEmpty() {
        return (this.type === flipCycleType.EMPTY);
    }
}

export async function setFlipCycleType(fourCycle) {
    if (fourCycle.u.hasNeighbour(fourCycle.w)) {
        fourCycle.type = flipCycleType.EMPTY;
        if (fourCycle.orientation === orientations.CW) {
            fourCycle.emptyType = flipCycleType.EMPTY_H2V;
        } else {
            fourCycle.emptyType = flipCycleType.EMPTY_V2H;
        }
    } else if (fourCycle.v.hasNeighbour(fourCycle.x)) {
        fourCycle.type = flipCycleType.EMPTY;
        if (fourCycle.orientation === orientations.CCW) {
            fourCycle.emptyType = flipCycleType.EMPTY_H2V;
        } else {
            fourCycle.emptyType = flipCycleType.EMPTY_V2H;
        }
    } else {
        fourCycle.type = flipCycleType.SEPARATING;
    }

    return fourCycle.type;
}

export async function getInteriorVerticesOfFourCycle(fourCycle) {
    let interiorVertices = [];
    let queue = [];
    let endVertex;
    if (fourCycle.orientation === orientations.CW) {
        // cw rotation: v is now on left of four cycle, so can take all outgoing red until x
        endVertex = fourCycle.x;
        let pastW = false
        for (const edge of fourCycle.v.edges) {
            let nextVertex = edge.target;
            if (nextVertex === fourCycle.w) {
                pastW = true;
                continue;
            }
            if (pastW) {
                queue.push(edge.target);
                interiorVertices.push(edge.target);
            }
        }

    } else {
        // ccw rotation: u and w have these roles
        endVertex = fourCycle.w;
        for (const edge of fourCycle.u.edges) {
            let nextVertex = edge.target;
            if (nextVertex === fourCycle.x) {
                break;
            }
            if ((edge.color === colors.RED) && (edge.source === fourCycle.u) && (nextVertex !== endVertex)) {
                queue.push(edge.target);
                interiorVertices.push(edge.target);
            }
        }
    }
    while (queue.length > 0) {
        let curVertex = queue.pop();
        for (const edge of curVertex.edges) {
            let nextVertex = edge.target;
            if ((edge.color === colors.RED) && (edge.source === curVertex) && (nextVertex !== endVertex)) {
                if (!interiorVertices.includes(nextVertex)) {
                    queue.push(edge.target);
                    interiorVertices.push(edge.target);
                }
            }
        }
    }

    return interiorVertices;
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

export const flipCycleType = {
    UNSET: "unset",
    SEPARATING: "sep",
    EMPTY: "empty",
    EMPTY_V2H: "empty-v2h", // vertical to horizontal
    EMPTY_H2V: "empty-h2v" // horizontal to vertical
}

