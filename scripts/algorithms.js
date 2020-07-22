"use strict";


export function computeREL(graph, canonicalOrder) {
    // const canonicalOrder = computeCanonicalOrder(graph);
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
    vertices[0].outer = vertices[1].outer = vertices[2].outer = vertices[3].outer = true;
    vertices[0].marked = vertices[1].marked = true;

    // candidates for vk
    let candidates = [];
    candidates.push(vertices[3]);
    candidates.push(vertices[2]);

    // lets find the next vertex in reverse order 
    for (let k = n - 1; k >= 2; k--) {
        console.log("find vk (k = " + k + ")");
        let vk = candidates.shift();
        console.log(vk);
        order[k] = vk;
        vk.marked = true;
        vk.outer = false;
        let outerIntvalvk = [];

        for (let edgeki of vk.edges) {
            const vi = edgeki.getOtherEndpoint(vk);
            if (vi.outer) {
                outerIntvalvk.push(vi);
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

                if (vi.numChords == 0) {
                    candidates.push(vi);
                }
            }
        }

        // if vk has only two neighours on cycle_k-1 
        // (and was not on outer four cycle)
        // then those two had a chord
        if ((outerIntvalvk.length === 2) && (k <= n - 3)) {
            outerIntvalvk[0].numChords--;
            if (outerIntvalvk[0].numChords == 0) {
                candidates.push(outerIntvalvk[0]);
            }
            outerIntvalvk[1].numChords--;
            if (outerIntvalvk[1].numChords == 0) {
                candidates.push(outerIntvalvk[1]);
            }
        }
    }


    return order;
}