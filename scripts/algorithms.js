"use strict";
import * as view from "./view.js";
import * as model from "./model.js";

export function computeREL(graph, canonicalOrder) {
    // canonical order should have been computed
    // and engrained in graph
    // i.e. vertices have .orderIndex, edges oriented and sorted in->out

    // REL represented colour (red horizontal, blue vertical)

    for (let i = 0; i < graph.vertices.length; i++) {
        const vertex = graph.vertices[i];

        // a) find base edge of incoming edges
        // = min index among incoming 
        let baseEdgeIndex = -1;
        let baseOrderIndex = graph.vertices.length;
        for (let k = 0; k < vertex.edges.length; k++) {
            const edge = vertex.edges[k];
            if (vertex.isIncomingEdge(edge)) {
                const neighbour = edge.getOtherEndpoint(vertex);
                if (neighbour.orderIndex < baseOrderIndex) {
                    baseEdgeIndex = k;
                    baseOrderIndex = neighbour.orderIndex;
                }
            } else {
                // note: not reached for v_n (id == 3)
                break;
            }

        }

        // b) based on index of base edge
        // colour the edges
        for (let k = 0; k < vertex.numIncomingEdges; k++) {
            const edge = vertex.edges[k];
            if (edge.svgEdge.tagName != "line") {
                continue;
            }

            if (k < baseEdgeIndex) {
                // left edge
                markEdgeWithColor(edge, model.colors.BLUE);
            } else if (k > baseEdgeIndex) {
                // right edge
                markEdgeWithColor(edge, model.colors.RED);
            } else if (baseEdgeIndex === 0) {
                // base edge must be left edge
                markEdgeWithColor(edge, model.colors.BLUE);
            } else if (baseEdgeIndex === vertex.numIncomingEdges - 1) {
                // base edge must be right edge
                markEdgeWithColor(edge, model.colors.RED);
            } else {
                // base edge can be either, say left
                markEdgeWithColor(edge, model.colors.BLUE);
            }
        }

    }

    // marks edge red or blue
    function markEdgeWithColor(edge, color) {
        edge.color = color;
        view.colorEdge(edge);
    }

    graph.hasREL = true;
}

export function computeCanonicalOrder(graph) {
    const vertices = graph.vertices;
    const n = vertices.length;
    let order = [];
    order[0] = vertices[0];
    order[1] = vertices[1];

    // 1. init vertex labels
    // outer: whether vertex belongs to current outer face
    // numChords: current number of chords
    // marked: whether vertex was numbered
    for (const vertex of vertices) {
        vertex.outer = false;
        vertex.numChords = 0;
        vertex.marked = false;
    }

    // 2. outer four cycle is at start on outer face
    vertices[0].outer = true;
    vertices[1].outer = true;
    vertices[2].outer = true;
    vertices[3].outer = true;
    vertices[0].marked = true;
    vertices[1].marked = true;

    // candidates for vk
    let candidates = [];
    candidates.push(vertices[3]);

    // lets find the next vertex in reverse order 
    for (let k = n - 1; k >= 2; k--) {
        let vk = candidates.shift();
        order[k] = vk;
        vk.marked = true;
        vk.outer = false;
        let outerIntvalvk = [];

        for (let edgeki of vk.edges) {
            const vi = edgeki.getOtherEndpoint(vk);

            if (vi.outer) {
                outerIntvalvk.push(vi);
                // vi visited at least second time, so could become candidate
                if ((vi.numChords == 0) && !vi.marked && (candidates.indexOf(vi) < 0)) {
                    candidates.push(vi);
                }
            } else if (!vi.outer && !vi.marked) {
                vi.outer = true;
                outerIntvalvk.push(vi);
                const indexEdgeik = vi.edges.indexOf(edgeki);

                // check if vi has chord to neighbour vj 
                for (let edgeij of vi.edges) {
                    const vj = edgeij.getOtherEndpoint(vi);
                    // only consider neighbours on current outer cycle
                    // (no chord with v_n-1 possible since no separating triangle)
                    if (vj.outer) {
                        const indexEdgeij = vi.edges.indexOf(edgeij);
                        const difIndices = Math.abs(indexEdgeij - indexEdgeik);
                        if ((difIndices != 1) && (difIndices != (vi.edges.length - 1))) {
                            vi.numChords++;
                            vj.numChords++;

                            // vj is no longer a candidate
                            const indexvj = candidates.indexOf(vj);
                            if (indexvj >= 0) {
                                candidates.splice(indexvj, 1);
                            }
                        }
                    }
                }
            }
        }

        // if vk has only two neighours on cycle_k-1 
        // (and was not on outer four cycle)
        // then those two had a chord
        if ((outerIntvalvk.length === 2) && (k <= n - 3)) {
            outerIntvalvk[0].numChords--;
            if ((outerIntvalvk[0].numChords == 0) && !outerIntvalvk[0].marked) {
                candidates.push(outerIntvalvk[0]);
            }
            outerIntvalvk[1].numChords--;
            if ((outerIntvalvk[1].numChords == 0) && !outerIntvalvk[1].marked) {
                candidates.push(outerIntvalvk[1]);
            }
        }
    }

    for (const vertex of vertices) {
        delete vertex.outer;
        delete vertex.numChords;
        delete vertex.marked;
    }

    return order;
}

export async function engrainCanonicalOrder(graph, canonicalOrder) {
    // 1. write order onto vertices
    for (let i = 0; i < canonicalOrder.length; i++) {
        canonicalOrder[i].orderIndex = i;
    }

    // 2. orient edges based on this
    for (const edge of graph.edges) {
        if (edge.id === "e3") {
            continue;
        }
        let sOrderIndex = edge.source.orderIndex;
        let tOrderIndex = edge.target.orderIndex;
        if (sOrderIndex > tOrderIndex) {
            edge.reverse();
        }
    }

    // 3. sort edges to start with incoming edges
    // for (const vertex of graph.vertices) {
    //     vertex.orderEdgesInOut();
    // }
    for (const vertex of graph.vertices) {
        if (vertex.id == 3) {
            vertex.setNumberIncomingEdges();
            continue;
        }

        let endIntervalOutgoing = -1;
        for (let i = 0; i < vertex.edges.length; i++) {
            const edge = vertex.edges[i];
            if (vertex.isOutgoingEdge(edge)) {
                endIntervalOutgoing = i;
            } else {
                break;
            }
        }

        if (endIntervalOutgoing >= 0) {
            // there were outgoing edges at the start
            let outEdges = vertex.edges.splice(0, endIntervalOutgoing + 1);
            vertex.edges = vertex.edges.concat(outEdges);
        } else {
            // we might have incoming edges at start and end
            let endIntervalIncoming = vertex.edges.length;
            for (let i = vertex.edges.length - 1; i >= 0; i--) {
                const edge = vertex.edges[i];
                if (vertex.isIncomingEdge(edge)) {
                    endIntervalIncoming = i;
                } else {
                    break;
                }
            }

            if (endIntervalIncoming < vertex.edges.length) {
                // there were outgoing edges at the start
                let inEdges = vertex.edges.splice(endIntervalIncoming);
                vertex.edges = inEdges.concat(vertex.edges);
            }
        }
        vertex.setNumberIncomingEdges();
    }
}

export function findFlipCycles(graph) {
    let flipCycles = [];

    // try to find cycle u, v, w, x
    for (const u of graph.vertices) {

        // find v
        for (let ui = u.numIncomingEdges; ui < u.edges.length; ui++) {
            const ue = u.edges[ui];
            if (ue.color == model.colors.BLUE) {
                const v = ue.getOtherEndpoint(u);

                // find w
                for (let vi = v.numIncomingEdges; vi < v.edges.length; vi++) {
                    const ve = v.edges[vi];
                    if (ve.color == model.colors.RED) {
                        const w = ve.getOtherEndpoint(v);

                        // find x
                        for (let wi = 0; wi < w.numIncomingEdges; wi++) {
                            const we = w.edges[wi];
                            if (we.color == model.colors.BLUE) {
                                const x = we.getOtherEndpoint(w);

                                // can we close circle?
                                for (let xi = 0; xi < x.numIncomingEdges; xi++) {
                                    const xe = x.edges[xi];
                                    if (xe.color == model.colors.RED) {
                                        const u2 = xe.getOtherEndpoint(w);
                                        if (u2 === u) {
                                            let orientation = null;


                                            // > find orientation
                                            // vi = index of ve
                                            // vj = index of ue for v
                                            let vj = v.edges.indexOf(ue);
                                            if ((vj === 0) && (vi !== (v.edges.length - 1))) {
                                                // there are red edges inwards at v
                                                orientation = model.orientations.CCW;
                                            } else if ((vj !== 0) && (vi === (v.edges.length - 1))) {
                                                // there are blue edges inwards at v
                                                orientation = model.orientations.CW;
                                            } else {
                                                // v has no edges pointing inwards -> check w
                                                // wi = index of we
                                                if (w.edges[wi + 1].color === model.colors.BLUE) {
                                                    orientation = model.orientations.CCW;
                                                } else {
                                                    orientation = model.orientations.CW;
                                                }
                                            }


                                            // save
                                            flipCycles.push({
                                                'id': flipCycles.length,
                                                'u': u,
                                                'ue': ue,
                                                'v': v,
                                                've': ve,
                                                'w': w,
                                                'we': we,
                                                'x': x,
                                                'xe': xe,
                                                'orientation': orientation
                                            })
                                        }
                                    }
                                }

                            }
                        }

                    }
                }

            }
        }
    }


    return flipCycles;
}

export async function computeRectangularDual(graph) {
    console.log("i.a) compute blue subgraph");
    const blueSubgraph = await computeColorSubgraph(graph, model.colors.BLUE);
    console.log("i.b) and its blue dual");
    const blueDual = await computeDual(blueSubgraph);
    console.log("i.c) and an order on that one");
    
    
    console.log("ii.a) compute red subgraph");
    const redSubgraph = await computeColorSubgraph(graph, model.colors.RED);
    console.log("ii.b) and its red dual");
    const redDual = await computeDual(redSubgraph);
    console.log("ii.c) and an order on that one");
    const blueMax = await computeTopologicalOrder(blueDual);
    const redMax = await computeTopologicalOrder(redDual);

    console.log("blue max: " + blueMax);
    console.log("red max: " + redMax);

    graph.xmax = blueMax + 1;
    graph.ymax = redMax + 1;

    console.log("iii) compute rectangle for each vertex");
    for (let i = 0; i < graph.vertices.length; i++) {
        let v = graph.vertices[i];
        v.rectangle = await computeRectangle(i, v);
        view.drawRectangle(v, blueMax + 1, redMax + 1);
    }

    async function computeRectangle(i, v) {
        let rect = {};
        switch (i) {
            case 0: // W;
                rect.x1 = 0;
                rect.x2 = 1;
                rect.y1 = 0;
                rect.y2 = redMax;
                rect.name = "rectWest";
                break;
                case 1: // S
                rect.x1 = 0;
                rect.x2 = blueMax;
                rect.y1 = redMax;
                rect.y2 = redMax + 1;
                rect.name = "rectSouth";
                break;
                case 2: // E;
                rect.x1 = blueMax;
                rect.x2 = blueMax + 1;
                rect.y1 = 1;
                rect.y2 = redMax + 1;
                rect.name = "rectEast";
                break;
                case 3: // N
                rect.x1 = 1;
                rect.x2 = blueMax + 1;
                rect.y1 = 0;
                rect.y2 = 1;
                rect.name = "rectNorth";
                break;
            default:
                rect.x1 = blueSubgraph.vertices[i].leftFace.orderIndex;
                rect.x2 = blueSubgraph.vertices[i].rightFace.orderIndex;
                rect.y1 = redSubgraph.vertices[i].leftFace.orderIndex;
                rect.y2 = redSubgraph.vertices[i].rightFace.orderIndex;
                break;
        }

        return rect;
    }
}

export async function computeColorSubgraph(graph, color) {
    const name = color + "Subgraph";
    let vertices = [];
    let edges = [];

    for (let i = 0; i < graph.vertices.length; i++) {
        const v = graph.vertices[i];
        const copy = new model.Vertex(v.id, v.x, v.y)
        copy.original = v;
        vertices.push(copy);

    }

    for (const e of graph.edges) {
        if (e.color === color) {
            const copy = new model.Edge(e.id, vertices[e.source.id], vertices[e.target.id]);
            copy.original = e;
            edges.push(copy);
        }
    }

    // add phantom edge between source and sink
    let s, t;
    for (const v of vertices) {
        await v.setNumberIncomingEdges();
        if ((v.numIncomingEdges === 0) && (v.edges.length > 0)) {
            s = v;
        } else if ((v.numIncomingEdges == v.edges.length) && (v.edges.length > 0)) {
            t = v;
        }
    }
    s.isSource = true;
    t.isSink = true;
    let e = new model.Edge("phantom" + color, t, s);
    e.isPhantomEdge = true;
    phantomPolylineEdge(e, s, t, color);

    let subgraph = new model.Graph(graph.id + color, vertices, edges, name);
    return await orderGraph(subgraph);

    async function orderGraph(graph) {
        for (let vertex of graph.vertices) {
            let v = await vertex.orderEdgesCircularly();
            v = await v.orderEdgesInOut();
        }
        return graph;
    }

    async function phantomPolylineEdge(edge, s, t, color) {
        let edgeLayer = view.svg.querySelector("#edgeLayer");
    
        let svgEdge = view.createSVGElement("polyline");
        let points = t.x + "," + t.y + " ";
        if (color == model.colors.BLUE) {
            points += t.x + "," + (parseInt(t.y) - 10) + " "
            + s.x + "," + (parseInt(s.y) + 10) + " ";
        } else {
            points += (parseInt(t.x) + 10) + "," + t.y + " "
            + (parseInt(s.x) - 10) + "," + s.y + " ";
        }
        points += s.x + "," + s.y;
        svgEdge.setAttribute("points", points);
        svgEdge.setAttribute("fill", "none");
        svgEdge.setAttribute("stroke", "none");
        svgEdge.id = "svg-" + edge.id;
    
        edgeLayer.append(svgEdge);
    
        svgEdge.edge = edge;
        edge.svgEdge = svgEdge;
    
        return svgEdge;
    }
}

export async function computeDual(graph) {
    // we assume graph is st-digraph
    const name = graph.name + "*";
    let faces = [];
    let dualEdges = [];

    // 1. faces
    // every vertex v is local source of a face
    // start at an outgoing edge e that is not rightmost outgoing edge
    // go up as long edge is rightmost incoming edge, say at w
    // then go up along edge after e at v until w
    // i) s & t
    const s = new model.Vertex("f0");
    faces.push(s);
    const t = new model.Vertex("f" + faces.length);
    faces.push(t);
    await computeFaces();

    // 2. dual edges
    // every edge gives dual edge from leftFace to rightFace
    // but we want to avoid multi-edges
    // if edge is only outgoing edge of in1out1 vertex v
    // dual edge has been added of in edge of v (or earlier)
    await computeEdges();

    return new model.Graph("dg" + graph.id, faces, dualEdges, graph.name + "Dual");

    async function computeFaces() {
        for (let v of graph.vertices) {
            // ii) inner faces
            for (let i = v.numIncomingEdges; i < v.edges.length - 1; i++) {
                let e = v.edges[i];
                const f = new model.Vertex("f" + faces.length);
                faces.push(f);
                await walkLeftBoundary(e, f);

                e = v.edges[i + 1];
                await walkRightBoundary(e, f);
            }

            // iv) points to s and t
            if (v.isSource) {
                // left outer boundary
                v.leftFace = s;
                let w = v;
                let e = null;

                while (!w.isSink && (w.numIncomingEdges < w.edges.length)) {
                    e = w.edges[w.numIncomingEdges];
                    e.leftFace = s;
                    w = e.target;
                    w.leftFace = s;
                }

                // right outer boundary
                v.rightFace = t;
                w = v;
                while (!w.isSink && (w.numIncomingEdges < w.edges.length)) {
                    e = w.edges[w.edges.length - 1];
                    e.rightFace = t;
                    w = e.target;
                    w.rightFace = t;
                }
            }
        }
    }

    async function walkLeftBoundary(e, f) {
        e.rightFace = f;
        const w = e.target;
        // if e is the rightmost incoming edge of w
        // we continue left boundary of f
        if (w.edges[0] === e) {
            w.rightFace = f;
            let eNext = w.edges[w.edges.length - 1];
            walkLeftBoundary(eNext, f);
        }
    }

    async function walkRightBoundary(e, f) {
        e.leftFace = f;
        const w = e.target;
        // if e is the leftmost incoming edge of w
        // we continue right boundary of f
        if (w.edges[w.numIncomingEdges - 1] === e) {
            w.leftFace = f;
            let eNext = w.edges[w.numIncomingEdges];
            if (eNext == undefined) {
                console.log("error");
                console.log(eNext);
                console.log(w);
                return true;
            }
            if (await walkRightBoundary(eNext, f)) {
                console.log(eNext);
                console.log(w);
            }
        }
        return false;
    }

    async function computeEdges() {
        for (const e of graph.edges) {
            const v = e.source;
            if ((v.edges.length !== 2) || (v.numIncomingEdges !== 1)) {
                const dualEdge = new model.Edge("dual" + dualEdges.length, e.leftFace, e.rightFace);
                dualEdges.push(dualEdge);
            }
        }
    }
}

export async function computeTopologicalOrder(graph) {
    let highestIndex = 1;
    for (const v of graph.vertices) {
        await v.setNumberIncomingEdges();
        if (v.numIncomingEdges === 0) {
            v.orderIndex = 1;
        } else {
            v.orderIndex = -1;
        }
    }

    for (const v of graph.vertices) {
        if (v.orderIndex < 0) {
            await computeOrderRecursion(v);
            highestIndex = (highestIndex >= v.orderIndex) ? highestIndex : v.orderIndex;
        }
    }

    return highestIndex;

    async function computeOrderRecursion(v) {
        let max = 0;
        for (let i = 0; i < v.edges.length; i++) {
            const e = v.edges[i];
            if (v.isIncomingEdge(e)) {
                let w = e.source;
                if (w.orderIndex < 0) {
                    await computeOrderRecursion(w);
                }
                max = (max >= w.orderIndex) ? max : w.orderIndex;
            }
        }

        v.orderIndex = max + 1;
    }
}