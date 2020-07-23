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
                                            console.log("determine orientation");
                                            console.log(v);
                                            console.log("deg(v) = " + v.edges.length);
                                            console.log("vi = " + vi);
                                            console.log("vj = " + vj);
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
                                            // view.highlightVertex(u);
                                            // view.highlightVertex(v);
                                            // view.highlightVertex(w);
                                            // view.highlightVertex(x);
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