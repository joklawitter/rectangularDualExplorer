"use strict";

import * as model from "./model.js";
import * as controller from "./controller.js";
import * as view from "./view.js";
import * as algorithms from "./algorithms.js";

const splittingOffset = 15;

export let morphSomethingHandler = {
    async handleEvent(event) {
        await controller.loadExampleHandler.handleEvent({
            'target': {
                'id': "graph-largeRotation"
            }
        })

        await algorithms.computeREL(model.graph);
        await algorithms.computeRectangularDual(model.graph);
        await view.drawRD(model.graph);

        let flipCycles = model.graph.flipCycles;
        if ((flipCycles === null) || (flipCycles === undefined)) {
            flipCycles = algorithms.findFlipCycles(model.graph);
            model.graph.flipCycles = flipCycles;
        }

        let someFlipCycle = flipCycles[3];
        let highlight = true
        if (highlight) {
            setTimeout(function () {
                showHighlights(someFlipCycle);
            }, 500);
        }
        animateRotation(someFlipCycle, 2000, 6000, highlight);

        function showHighlights(fourCycle) {
            view.highlightVertex(fourCycle.u);
            view.highlightVertex(fourCycle.v);
            view.highlightVertex(fourCycle.w);
            view.highlightVertex(fourCycle.x);
            view.hightlightFlipCycle(someFlipCycle);
        }
    }
}

export async function animateRotation(fourCycle, delay, duration, highlight = false) {
    // check if four cycle is empty
    let empty = ((fourCycle.u.rectangle.y1 == fourCycle.w.rectangle.y2) ||
        (fourCycle.u.rectangle.x2 == fourCycle.w.rectangle.x1));

    let interiorVertices = await model.getInteriorVerticesOfFourCycle(fourCycle);

    console.log("> rotate " + (empty ? "empty" : "separating") + " four cycle");

    console.log("i) compute intermediate rectangular duals ");

    // compute R_1* (nearly rectangular dual towards R_1)
    console.log("i.a) compute R_1* and its almost rectangular dual");
    // let graphR1 = model.graph.getCopy();
    let graphR1 = await model.copyGraph(model.graph);
    let graphR1Split = await computeR1Helper(graphR1, fourCycle, empty);
    // view.resetLayer("rectangularDualLayer");
    // view.drawRD(graphR1Split);

    // compute R_1 (rectangular dual, where four cycle has space to rotate)
    console.log("i.b) compute R_1 and its rectangular dual");
    await setRectangleSizesInR1(graphR1);
    // view.resetLayer("rectangularDualLayer");
    // view.drawGraph(graphR1);
    // view.drawRD(graphR1);

    // compute R_2 (rectangular dual after rotation)
    console.log("i.c) compute R_2");
    let copyName = "copyR2";
    let graphR2 = await model.copyGraph(model.graph, copyName);
    await computeR2(graphR2, graphR1, fourCycle, copyName, interiorVertices);
    // view.resetLayer("rectangularDualLayer");
    // view.drawGraph(graphR2);
    // view.drawRD(graphR2);

    // compute R' (rectangular dual that is compressed)
    console.log("i.d) compute R'");
    let graphR2compressed = await model.copyGraph(graphR2);
    await algorithms.computeRectangularDual(graphR2compressed);
    // view.resetLayer("rectangularDualLayer");
    // view.drawRD(graphR2compressed);
    // view.drawGraph(graphR2compressed);

    console.log("ii) animate rotation");
    // make sure appropriate layers are shown

    // animate from R to R_1
    let durationStep = duration / 3;
    console.log("ii.a) animate from R to R_1");
    let t = d3.transition().duration(durationStep).delay(delay);
    let transitioningOne = 0;
    for (const vertex of model.graph.vertices) {
        d3.select("#" + vertex.svgRect.id)
            .each(() => { transitioningOne++ })
            .transition(t)
            .attr("x", view.OFFSET + vertex.copy.rectangle.x1 * view.X_STEP)
            .attr("y", view.OFFSET + vertex.copy.rectangle.y1 * view.X_STEP)
            .attr("width", (vertex.copy.rectangle.x2 * view.X_STEP - vertex.copy.rectangle.x1 * view.X_STEP))
            .attr("height", (vertex.copy.rectangle.y2 * view.Y_STEP - vertex.copy.rectangle.y1 * view.Y_STEP))
            .on('end', () => {
                transitioningOne--;
                if (transitioningOne === 0) {
                    transitionOneEnded();
                }
            });
    }

    function transitionOneEnded() {
        for (const vertex of model.graph.vertices) {
            if ((vertex === fourCycle.u) || (vertex === fourCycle.v) || (vertex === fourCycle.w)
                || (vertex === fourCycle.x) || (interiorVertices.includes(vertex))) {
                vertex.svgRect.classList.add("hidden");
                vertex.polygon.classList.remove("hidden");
            }
        }
    }

    // animate from R_1 to R_2
    console.log("ii.b) animate from R_1 to R_2");
    let transitioningTwo = 0;
    t = d3.transition().duration(durationStep).delay(delay + durationStep);
    let rectangularDualLayer = view.svg.querySelector("#rectangularDualLayer");
    for (const vertex of model.graph.vertices) {
        let xLeftStart = view.OFFSET + vertex.copy.rectangle.x1 * view.X_STEP;
        let xLeftEnd = view.OFFSET + vertex[copyName].rectangle.x1 * view.X_STEP;
        let xRightStart = view.OFFSET + vertex.copy.rectangle.x2 * view.X_STEP;
        let xRightEnd = view.OFFSET + vertex[copyName].rectangle.x2 * view.X_STEP;
        let yBottomStart = view.OFFSET + vertex.copy.rectangle.y2 * view.Y_STEP;
        let yBottomEnd = view.OFFSET + vertex[copyName].rectangle.y2 * view.Y_STEP;
        let yTopStart = view.OFFSET + vertex.copy.rectangle.y1 * view.Y_STEP;
        let yTopEnd = view.OFFSET + vertex[copyName].rectangle.y1 * view.Y_STEP;

        if (vertex === fourCycle.u) {
            let polygon = await getPolygon(vertex, highlight);
            let xDiff = xRightStart - xRightEnd;
            let yDiff = yTopStart - yTopEnd;

            let dStart = "M" + xLeftStart + "," + yBottomStart + " ";
            let dEnd = " z";
            let d = dStart + xLeftStart + "," + yTopStart + " "
                + xRightEnd + "," + yTopStart + " "
                + xRightStart + "," + yTopStart + " "
                + xRightStart + "," + yBottomStart + dEnd;
            polygon.setAttribute("d", d);

            d3.select("#" + polygon.id)
                .each(() => { transitioningTwo++ })
                .transition(t)
                .attrTween('d', function () {
                    return function (t) {
                        let xIntermediate = xRightStart - t * xDiff;
                        let yIntermediate = yTopStart - t * yDiff;
                        return dStart + xLeftStart + "," + yIntermediate + " "
                            + xRightEnd + "," + yIntermediate + " "
                            + xIntermediate + "," + yTopStart + " "
                            + xIntermediate + "," + yBottomStart + dEnd;
                    };
                })
                .on('end', () => {
                    transitioningTwo--;
                    if (transitioningTwo === 0) {
                        transitionTwoEnded();
                    }
                })
                .remove();
        } else if (vertex === fourCycle.v) {
            let polygon = await getPolygon(vertex, highlight);
            let xDiff = xRightStart - xRightEnd;
            let yDiff = yBottomStart - yBottomEnd;

            let dStart = "M" + xLeftStart + "," + yTopStart + " ";
            let dEnd = " z";
            let d = dStart + xLeftStart + "," + yTopStart + " "
                + xRightStart + "," + yBottomEnd + " "
                + xRightStart + "," + yBottomStart + " "
                + xLeftStart + "," + yBottomStart + dEnd;
            polygon.setAttribute("d", d);

            d3.select("#" + polygon.id)
                .each(() => { transitioningTwo++ })
                .transition(t)
                .attrTween('d', function () {
                    return function (t) {
                        let xIntermediate = xRightStart - t * xDiff;
                        let yIntermediate = yBottomStart - t * yDiff;
                        return dStart + xIntermediate + "," + yTopStart + " "
                            + xIntermediate + "," + yBottomEnd + " "
                            + xRightStart + "," + yIntermediate + " "
                            + xLeftStart + "," + yIntermediate + dEnd;
                    };
                })
                .on('end', () => {
                    transitioningTwo--;
                    if (transitioningTwo === 0) {
                        transitionTwoEnded();
                    }
                })
                .remove();
        } else if (vertex === fourCycle.w) {
            let polygon = await getPolygon(vertex, highlight);
            let xDiff = xLeftStart - xLeftEnd;
            let yDiff = yBottomStart - yBottomEnd;

            let dStart = "M" + xRightStart + "," + yTopStart + " ";
            let dEnd = " z";
            let d = dStart + xRightStart + "," + yBottomStart + " "
                + xLeftEnd + "," + yBottomStart + " "
                + xLeftStart + "," + yBottomStart + " "
                + xLeftStart + "," + yTopStart + dEnd;
            polygon.setAttribute("d", d);

            d3.select("#" + polygon.id)
                .each(() => { transitioningTwo++ })
                .transition(t)
                .attrTween('d', function () {
                    return function (t) {
                        let xIntermediate = xLeftStart - t * xDiff;
                        let yIntermediate = yBottomStart - t * yDiff;
                        return dStart + xRightStart + "," + yIntermediate + " "
                            + xLeftEnd + "," + yIntermediate + " "
                            + xIntermediate + "," + yBottomStart + " "
                            + xIntermediate + "," + yTopStart + dEnd;
                    };
                })
                .on('end', () => {
                    transitioningTwo--;
                    if (transitioningTwo === 0) {
                        transitionTwoEnded();
                    }
                })
                .remove();
        } else if (vertex === fourCycle.x) {
            let polygon = await getPolygon(vertex, highlight);
            let xDiff = xLeftStart - xLeftEnd;
            let yDiff = yTopStart - yTopEnd;

            let dStart = "M" + xRightStart + "," + yBottomStart + " ";
            let dEnd = " z";
            let d = dStart + xLeftStart + "," + yBottomStart + " "
                + xLeftStart + "," + yTopEnd + " "
                + xLeftStart + "," + yTopStart + " "
                + xRightStart + "," + yTopStart + dEnd;
            polygon.setAttribute("d", d);

            d3.select("#" + polygon.id)
                .each(() => { transitioningTwo++ })
                .transition(t)
                .attrTween('d', function () {
                    return function (t) {
                        let xIntermediate = xLeftStart - t * xDiff;
                        let yIntermediate = yTopStart - t * yDiff;
                        return dStart + xIntermediate + "," + yBottomStart + " "
                            + xIntermediate + "," + yTopEnd + " "
                            + xLeftStart + "," + yIntermediate + " "
                            + xRightStart + "," + yIntermediate + dEnd;
                    };
                })
                .on('end', () => {
                    transitioningTwo--;
                    if (transitioningTwo === 0) {
                        transitionTwoEnded();
                    }
                })
                .remove();
        } else if (interiorVertices.includes(vertex)) {
            let polygon = await getPolygon(vertex);
            let dStart = "M";
            let dEnd = " z";
            let d = dStart + xLeftStart + "," + yTopStart + " "
                + xRightStart + "," + yTopStart + " "
                + xRightStart + "," + yBottomStart + " "
                + xLeftStart + "," + yBottomStart + dEnd;
            polygon.setAttribute("d", d);

            d3.select("#" + polygon.id)
                .each(() => { transitioningTwo++ })
                .transition(t)
                .attrTween('d', function () {
                    return function (t) {
                        let intermediateOneX = xLeftStart - t * (xLeftStart - xRightEnd);
                        let intermediateOneY = yTopStart - t * (yTopStart - yTopEnd);
                        let intermediateTwoX = xRightStart - t * (xRightStart - xRightEnd);
                        let intermediateTwoY = yTopStart - t * (yTopStart - yBottomEnd);
                        let intermediateThreeX = xRightStart - t * (xRightStart - xLeftEnd);
                        let intermediateThreeY = yBottomStart - t * (yBottomStart - yBottomEnd);
                        let intermediateFourX = xLeftStart - t * (xLeftStart - xLeftEnd);
                        let intermediateFourY = yBottomStart - t * (yBottomStart - yTopEnd);
                        return dStart + intermediateOneX + "," + intermediateOneY + " "
                            + intermediateTwoX + "," + intermediateTwoY + " "
                            + intermediateThreeX + "," + intermediateThreeY + " "
                            + intermediateFourX + "," + intermediateFourY + dEnd;
                    };
                })
                .on('end', () => {
                    transitioningTwo--;
                    if (transitioningTwo === 0) {
                        transitionTwoEnded();
                    }
                })
                .remove();
        }

        d3.select("#" + vertex.svgRect.id).transition(t)
            .attr("x", xLeftEnd)
            .attr("y", view.OFFSET + vertex[copyName].rectangle.y1 * view.X_STEP)
            .attr("width", (xRightEnd - xLeftEnd))
            .attr("height", (yBottomEnd - yTopEnd));
    }

    function transitionTwoEnded() {
        for (const vertex of model.graph.vertices) {
            if ((vertex === fourCycle.u) || (vertex === fourCycle.v) || (vertex === fourCycle.w)
                || (vertex === fourCycle.x) || (interiorVertices.includes(vertex))) {
                vertex.svgRect.classList.remove("hidden");
                vertex.polygon.classList.add("hidden");
            }
        }

        model.graph.flipFlipCycle(fourCycle);
    }

    // animate from R_2 to R'
    console.log("ii.c) animate from R_2 to R'");
    let transitioningThree = 0;
    t = d3.transition().duration(durationStep).delay(delay + 2 * durationStep);
    for (const vertex of model.graph.vertices) {
        d3.select("#" + vertex.svgRect.id).transition(t)
            .each(() => { transitioningThree++ })
            .attr("x", view.OFFSET + vertex[copyName].copy.rectangle.x1 * view.X_STEP)
            .attr("y", view.OFFSET + vertex[copyName].copy.rectangle.y1 * view.X_STEP)
            .attr("width", (vertex[copyName].copy.rectangle.x2 * view.X_STEP - vertex[copyName].copy.rectangle.x1 * view.X_STEP))
            .attr("height", (vertex[copyName].copy.rectangle.y2 * view.Y_STEP - vertex[copyName].copy.rectangle.y1 * view.Y_STEP))
            .on('end', () => {
                transitioningThree--;
                if (transitioningThree === 0) {
                    transitionThreeEnded();
                }
            });
    }

    function transitionThreeEnded() {
        if (highlight) {
            view.unhighlightVertex(fourCycle.u);
            view.unhighlightVertex(fourCycle.v);
            view.unhighlightVertex(fourCycle.w);
            view.unhighlightVertex(fourCycle.x);
            view.resetLayer("flipCyclesLayer");
        }
    }

    async function getPolygon(vertex, highlight = false) {
        let polygon = view.createSVGElement("path");
        polygon.setAttribute("stroke", "darkgray");
        polygon.setAttribute("id", "polygon-" + vertex.id);
        polygon.classList.add("hidden");
        if (highlight) {
            polygon.setAttribute("fill", getComputedStyle(document.documentElement).getPropertyValue('--highlightFill'));
        } else {
            polygon.setAttribute("fill", "none");
        }
        rectangularDualLayer.append(polygon);
        vertex.polygon = polygon;

        return polygon;
    }
}

async function computeR2(graphR2, graphR1, fourCycle, copyName, interiorVertices) {
    // duplicate fourCycle
    let fourCycleR1 = {};
    fourCycleR1.u = fourCycle.u.copy
    fourCycleR1.v = fourCycle.v.copy;
    fourCycleR1.w = fourCycle.w.copy;
    fourCycleR1.x = fourCycle.x.copy;
    fourCycleR1.ue = fourCycle.ue.copy;
    fourCycleR1.ve = fourCycle.ve.copy;
    fourCycleR1.we = fourCycle.we.copy;
    fourCycleR1.xe = fourCycle.xe.copy;
    fourCycleR1.orientation = fourCycle.orientation;
    let fourCycleR2 = {};
    fourCycleR2.u = fourCycle.u[copyName];
    fourCycleR2.v = fourCycle.v[copyName];
    fourCycleR2.w = fourCycle.w[copyName];
    fourCycleR2.x = fourCycle.x[copyName];
    fourCycleR2.ue = fourCycle.ue[copyName];
    fourCycleR2.ve = fourCycle.ve[copyName];
    fourCycleR2.we = fourCycle.we[copyName];
    fourCycleR2.xe = fourCycle.xe[copyName];
    fourCycleR2.orientation = fourCycle.orientation;

    // flip fourCycle in R2
    await graphR2.flipFlipCycle(fourCycleR2);

    // most vertices of R2 have rectangle has in R1...
    for (const vertex of graphR2.vertices) {
        vertex.rOne = vertex.original.copy;
        vertex.rOne.rTwo = vertex;
        let rectangle = {};
        rectangle.x1 = vertex.rOne.rectangle.x1;
        rectangle.x2 = vertex.rOne.rectangle.x2;
        rectangle.y1 = vertex.rOne.rectangle.y1;
        rectangle.y2 = vertex.rOne.rectangle.y2;
        vertex.rectangle = rectangle;
    }

    // ... but for some we have to set them apropriately
    // in particular, for vertices of four cycle, its interior and along the four paths
    let xLeft, xRight, yBottom, yTop;
    if (fourCycle.orientation === model.orientations.CW) {
        xLeft = fourCycleR1.v.rectangle.x2;
        yTop = fourCycleR1.w.rectangle.y2;
        xRight = fourCycleR1.x.rectangle.x1;
        yBottom = fourCycleR1.u.rectangle.y1;
    } else {
        xLeft = fourCycleR1.u.rectangle.x2;
        yTop = fourCycleR1.v.rectangle.y2;
        xRight = fourCycleR1.w.rectangle.x1;
        yBottom = fourCycleR1.x.rectangle.y1;

    }

    // 1) for vertices on the four paths (which includes the four vertices of four cycle)
    let vertexR2;
    if (fourCycle.orientation === model.orientations.CW) {
        let outsideFourCycle = false;
        for (const vertex of graphR1.copy.pathWest) {
            if (vertex === graphR1.copy.pathWest[graphR1.copy.pathWest.length - 1]) {
                continue;
            }
            // for first vertex of path, we get v
            vertexR2 = vertex.original.rTwo;
            vertexR2.rectangle.y2 = yTop;
            for (const edge of vertexR2.edges) {
                if ((edge.color === model.colors.BLUE) && (edge.target === vertexR2)) {
                    if (edge.source === fourCycleR2.u) {
                        // only after we passed incoming blue from u,
                        // do we get vertices on other side of path
                        outsideFourCycle = true;
                    }
                    if (outsideFourCycle) {
                        edge.source.rectangle.y1 = yTop;
                    }
                }
            }
        }
        outsideFourCycle = false;
        for (const vertex of graphR1.copy.pathNorth) {
            if (vertex === graphR1.copy.pathNorth[graphR1.copy.pathNorth.length - 1]) {
                continue;
            }
            // for first vertex of path, we get w
            vertexR2 = vertex.original.rTwo;
            vertexR2.rectangle.x1 = xRight;
            for (const edge of vertexR2.edges) {
                if ((edge.color === model.colors.RED) && (edge.target === vertexR2)) {
                    if (edge.source === fourCycleR2.v) {
                        // have to pass v
                        outsideFourCycle = true;
                    }
                    if (outsideFourCycle) {
                        edge.source.rectangle.x2 = xRight;
                    }
                }
            }
        }
        outsideFourCycle = false;
        for (const vertex of graphR1.copy.pathEast) {
            if (vertex === graphR1.copy.pathEast[graphR1.copy.pathEast.length - 1]) {
                continue;
            }
            // for first vertex of path, we get x
            vertexR2 = vertex.original.rTwo;
            vertexR2.rectangle.y1 = yBottom;
            for (const edge of vertexR2.edges) {
                if ((edge.color === model.colors.BLUE) && (edge.source === vertexR2)) {
                    if (edge.target === fourCycleR2.w) {
                        // have to pass w
                        outsideFourCycle = true;
                    }
                    if (outsideFourCycle) {
                        edge.target.rectangle.y2 = yBottom;
                    }
                }
            }
        }
        for (const vertex of graphR1.copy.pathSouth) {
            if (vertex === graphR1.copy.pathSouth[graphR1.copy.pathSouth.length - 1]) {
                continue;
            }
            // for first vertex of path, we get u
            vertexR2 = vertex.original.rTwo;
            vertexR2.rectangle.x2 = xLeft;
            for (const edge of vertexR2.edges) {
                if ((edge.color === model.colors.RED) && (edge.source === vertexR2)) {
                    if (edge.target === fourCycleR2.x) {
                        // have to pass x
                        outsideFourCycle = true;
                    }
                    if (outsideFourCycle) {
                        edge.target.rectangle.x1 = xLeft;
                    }
                }
            }
        }
    } else {
        for (const vertex of graphR1.copy.pathWest) {
            if (vertex === graphR1.copy.pathWest[graphR1.copy.pathWest.length - 1]) {
                continue;
            }
            // for first vertex of path, we get u
            vertexR2 = vertex.original.rTwo;
            vertexR2.rectangle.y1 = yBottom;
            outsideFourCycle = true;
            for (const edge of vertexR2.edges) {
                if ((edge.color === model.colors.BLUE) && (edge.source === vertexR2)) {
                    edge.target.rectangle.y2 = yBottom;
                    if (edge.target === fourCycleR2.v) {
                        // now no longer on edges between path
                        outsideFourCycle = false;
                    }
                }
            }
        }
        for (const vertex of graphR1.copy.pathNorth) {
            if (vertex === graphR1.copy.pathNorth[graphR1.copy.pathNorth.length - 1]) {
                continue;
            }
            // for first vertex of path, we get v
            vertexR2 = vertex.original.rTwo;
            vertexR2.rectangle.x2 = xLeft;
            outsideFourCycle = true;
            for (const edge of vertexR2.edges) {
                if ((edge.color === model.colors.RED) && (edge.source === vertexR2)) {
                    edge.target.rectangle.x1 = xLeft;
                    if (edge.target === fourCycleR2.w) {
                        outsideFourCycle = false;
                    }
                }
            }
        }
        for (const vertex of graphR1.copy.pathEast) {
            if (vertex === graphR1.copy.pathEast[graphR1.copy.pathEast.length - 1]) {
                continue;
            }
            // for first vertex of path, we get w
            vertexR2 = vertex.original.rTwo;
            vertexR2.rectangle.y2 = yTop;
            outsideFourCycle = true;
            for (const edge of vertexR2.edges) {
                if ((edge.color === model.colors.BLUE) && (edge.target === vertexR2)) {
                    edge.source.rectangle.y1 = yTop;
                    if (edge.source === fourCycleR2.x) {
                        outsideFourCycle = false;
                    }
                }
            }
        }
        for (const vertex of graphR1.copy.pathSouth) {
            if (vertex === graphR1.copy.pathSouth[graphR1.copy.pathSouth.length - 1]) {
                continue;
            }
            // for first vertex of path, we get x
            vertexR2 = vertex.original.rTwo;
            vertexR2.rectangle.x1 = xRight;
            outsideFourCycle = true;
            for (const edge of vertexR2.edges) {
                if ((edge.color === model.colors.RED) && (edge.target === vertexR2)) {
                    edge.source.rectangle.x2 = xRight;
                    if (edge.source === fourCycleR2.u) {
                        outsideFourCycle = false;
                    }
                }
            }
        }
    }

    // 2) for interior vertices
    // 2a) find interior vertices
    let interiorVerticesR2 = [];
    for (const vertex of interiorVertices) {
        interiorVerticesR2.push(vertex[copyName]);
    }
    // 2b) rotate them
    for (const vertex of interiorVerticesR2) {
        let rectangle = vertex.rectangle;
        let oldX1 = rectangle.x1;
        let oldX2 = rectangle.x2;
        let oldY1 = rectangle.y1;
        let oldY2 = rectangle.y2;
        let xOffset = oldX1 - xLeft;
        let yOffset = oldY1 - yTop;

        if (fourCycle.orientation === model.orientations.CW) {
            rectangle.x2 = xRight - yOffset;
            rectangle.x1 = rectangle.x2 - (oldY2 - oldY1);
            rectangle.y1 = yTop + xOffset;
            rectangle.y2 = rectangle.y1 + (oldX2 - oldX1);
        } else {
            rectangle.y2 = yBottom - xOffset;
            rectangle.y1 = rectangle.y2 - (oldX2 - oldX1);
            rectangle.x1 = xLeft + yOffset;
            rectangle.x2 = rectangle.x1 + (oldY2 - oldY1);
        }
    }
}

async function setRectangleSizesInR1(graphR1) {
    for (const vertex of graphR1.vertices) {
        let copy = vertex.copy; // get vertex in R_1*
        let copySplit = copy.splitCopy;
        if (copySplit === undefined) {
            // if vertex has not been split, then can just reuse its rectangle
            vertex.rectangle = copy.rectangle;
        } else {
            // otherwise, we have to combine dimensions with its split copy
            let copySplit = copy.splitCopy;
            let rect = {};
            rect.x1 = Math.min(copy.rectangle.x1, copySplit.rectangle.x1);
            rect.x2 = Math.max(copy.rectangle.x2, copySplit.rectangle.x2);
            rect.y1 = Math.min(copy.rectangle.y1, copySplit.rectangle.y1);
            rect.y2 = Math.max(copy.rectangle.y2, copySplit.rectangle.y2);
            vertex.rectangle = rect;
        }
    }

    let extendRightwards = graphR1.extendRightwards
    if (extendRightwards !== undefined) {
        for (const vertex of extendRightwards) {
            let redOut;
            for (const edge of vertex.edges) {
                if ((edge.color === model.colors.RED) && (edge.source === vertex)) {
                    redOut = edge;
                    break;
                }
            }
            vertex.rectangle.x2 = redOut.target.rectangle.x1;
        }
    }
    let extendUpwards = graphR1.extendUpwards
    if (extendUpwards !== undefined) {
        for (const vertex of extendUpwards) {
            let blueOut;
            for (const edge of vertex.edges) {
                if ((edge.color === model.colors.BLUE) && (edge.source === vertex)) {
                    blueOut = edge;
                    break;
                }
            }
            vertex.rectangle.y2 = blueOut.target.rectangle.y1;
        }
    }

}

async function computeR1Helper(graphR1, fourCycle, empty) {
    let g = await model.copyGraph(graphR1)
    let gRed = await algorithms.computeColorSubgraph(g, model.colors.RED);
    let gBlue = await algorithms.computeColorSubgraph(g, model.colors.BLUE);

    // find paths to split along (except last vertex)
    let pathWest = await computeSplitPath(fourCycle.u, fourCycle.v, gRed, directions.BACKWARD, directions.WEST, fourCycle.orientation);
    let pathNorth = await computeSplitPath(fourCycle.v, fourCycle.w, gBlue, directions.FORWARD, directions.NORTH, fourCycle.orientation);
    let pathEast = await computeSplitPath(fourCycle.w, fourCycle.x, gRed, directions.FORWARD, directions.EAST, fourCycle.orientation);
    let pathSouth = await computeSplitPath(fourCycle.x, fourCycle.u, gBlue, directions.BACKWARD, directions.SOUTH, fourCycle.orientation);
    // for (const vertex of pathWest) {
    //     view.highlightVertex(vertex);
    // }
    // for (const vertex of pathNorth) {
    //     view.highlightVertex(vertex);
    // }
    // for (const vertex of pathEast) {
    //     view.highlightVertex(vertex);
    // }
    // for (const vertex of pathSouth) {
    //     view.highlightVertex(vertex);
    // }

    g.pathWest = pathWest;
    g.pathNorth = pathNorth;
    g.pathEast = pathEast;
    g.pathSouth = pathSouth;

    // split paths
    await splitPath(pathWest, fourCycle.ve.copy.copy, g, directions.WEST, fourCycle.orientation);
    await splitPath(pathNorth, fourCycle.we.copy.copy, g, directions.NORTH, fourCycle.orientation);
    await splitPath(pathEast, fourCycle.xe.copy.copy, g, directions.EAST, fourCycle.orientation);
    await splitPath(pathSouth, fourCycle.ue.copy.copy, g, directions.SOUTH, fourCycle.orientation);

    await algorithms.computeRectangularDual(g);

    // if four-cycle separating, check if interior is square
    if (!empty) {
        await makeInteriorSquare(g, fourCycle);
        await algorithms.computeRectangularDual(g);
    }

    return g;
}

async function makeInteriorSquare(g, fourCycle) {
    let xDiff, yDiff;
    let u = fourCycle.u.copy.copy;
    let v = fourCycle.v.copy.copy;
    let w = fourCycle.w.copy.copy;
    let x = fourCycle.x.copy.copy;
    if (fourCycle.orientation === model.orientations.CW) {
        // console.log("v.rectangle.x2", v.rectangle.x2, v);
        // console.log("x.rectangle.x1", x.rectangle.x1, x);
        // console.log("u.rectangle.y1", u.rectangle.y1, u);
        // console.log("w.rectangle.y2", w.rectangle.y2, w);
        xDiff = x.rectangle.x1 - v.rectangle.x2;
        yDiff = u.rectangle.y1 - w.rectangle.y2;
    } else {
        xDiff = u.rectangle.x2 - w.rectangle.x1;
        yDiff = x.rectangle.y1 - v.rectangle.y2;
    }

    console.log("xDiff", xDiff);
    console.log("yDiff", yDiff);

    if (xDiff !== yDiff) {
        let diff = Math.abs(xDiff - yDiff);
        // inside not a square, so have to extend in the respective direction
        let leftSplit;
        let topSplit;
        let rightSplit;
        let bottomSplit
        if (xDiff < yDiff) {
            console.log(" interioir of four cycle less wide then heigh; add " + diff + " extra vertices");
            if (fourCycle.orientation === model.orientations.CW) {
                topSplit = w.splitCopy;
                rightSplit = x.splitCopy;
                bottomSplit = u.splitCopy;
            } else {
                topSplit = v.splitCopy;
                rightSplit = w.splitCopy;
                bottomSplit = x.splitCopy;
            }
            // we add diff many vertices into the right side of interior
            let fillerVertices = [];
            for (let i = 0; i < diff; i++) {
                // TODO computed coordinate for x risky, because might not actually lie to left
                let fillerVertex = new model.Vertex(g.vertices.length, rightSplit.x - 5 * (diff - i + 1), rightSplit.y);
                fillerVertices.push(fillerVertex);
                g.vertices.push(fillerVertex);
            }

            // find out where to insert in bottom split vertex
            let bottomOutIndex = 0;
            for (const edge of bottomSplit.edges) {
                if ((edge.color === model.colors.RED) && (edge.source === bottomSplit)) {
                    bottomOutIndex = bottomSplit.edges.indexOf(edge);
                    break;
                }
            }

            // find out where to insert in right split vertex
            let rightInIndex;
            for (const edge of rightSplit.edges) {
                if ((edge.color === model.colors.RED) && (edge.target === rightSplit)) {
                    rightInIndex = rightSplit.edges.indexOf(edge);
                    break;
                }
            }

            // BLUE IN (adding)
            let newEdge;
            for (let i = 0; i < fillerVertices.length; i++) {
                newEdge = new model.Edge(g.edges.length, bottomSplit, fillerVertices[i]);
                newEdge.graph = g;
                newEdge.color = model.colors.BLUE;
                g.edges.push(newEdge);
                fillerVertices[i].edges.push(newEdge);
                bottomSplit.edges.splice(bottomOutIndex++, 0, newEdge);
            }
            // RED IN (resetting)
            let resetEdges = 0;
            g.original.extendRightwards = []; // store vertices that extend to right
            for (const edge of rightSplit.edges) {
                if ((edge.color === model.colors.RED) && (edge.target === rightSplit)) {
                    edge.replaceEndpoint(rightSplit, fillerVertices[0]);
                    resetEdges++;
                    g.original.extendRightwards.push(edge.source.original);
                }
            }
            let replacedEdges = rightSplit.edges.splice(rightInIndex, resetEdges);
            // RED IN (adding)
            fillerVertices[0].edges.push(replacedEdges);
            for (let i = 0; i < fillerVertices.length - 1; i++) {
                newEdge = new model.Edge(g.edges.length, fillerVertices[i], fillerVertices[i + 1]);
                newEdge.graph = g;
                newEdge.color = model.colors.RED;
                g.edges.push(newEdge);
                fillerVertices[i + 1].edges.push(newEdge);
            }
            // BLUE OUT (adding)
            for (let i = 0; i < fillerVertices.length; i++) {
                newEdge = new model.Edge(g.edges.length, fillerVertices[i], topSplit);
                newEdge.graph = g;
                newEdge.color = model.colors.BLUE;
                g.edges.push(newEdge);
                fillerVertices[i].edges.push(newEdge);
                topSplit.edges.splice(0, 0, newEdge);
            }
            // RED OUT (setting)
            for (let i = 0; i < fillerVertices.length - 1; i++) {
                let edge = fillerVertices[i + 1].edges[1];
                fillerVertices[i].edges.push(edge);
            }
            let lastFillerVertex = fillerVertices[fillerVertices.length - 1];
            newEdge = new model.Edge(g.edges.length, lastFillerVertex, rightSplit);
            newEdge.graph = g;
            newEdge.color = model.colors.RED;
            g.edges.push(newEdge);
            lastFillerVertex.edges.push(newEdge);
            rightSplit.edges.splice(rightInIndex, 0, newEdge);
        } else {
            if (fourCycle.orientation === model.orientations.CW) {
                leftSplit = v.splitCopy;
                topSplit = w.splitCopy;
                rightSplit = x.splitCopy;
            } else {
                leftSplit = u.splitCopy
                topSplit = v.splitCopy;
                rightSplit = w.splitCopy;
            }
            // we add diff many vertices at top side of interior
            let fillerVertices = [];
            for (let i = 0; i <= diff; i++) {
                // TODO computed coordinate for y risky, because might not actually lie below 
                let fillerVertex = new model.Vertex(g.vertices.length, topSplit.x, topSplit.y + 2 * (diff - i));
                fillerVertices.push(fillerVertex);
                g.vertices.push(fillerVertex);
            }

            // find out where to insert in left split vertex
            let leftOutIndex;
            for (const edge of leftSplit.edges) {
                if ((edge.color === model.colors.RED) && (edge.source === leftSplit)) {
                    leftOutIndex = leftSplit.edges.indexOf(edge);
                    break;
                }
            }
            // find out where to insert in right split vertex
            let rightInIndex;
            for (const edge of rightSplit.edges) {
                if ((edge.color === model.colors.BLUE) && (edge.source === rightSplit)) {
                    rightInIndex = rightSplit.edges.indexOf(edge);
                    break;
                }
            }
            // we always add at 0 in top split vertex

            // BLUE IN (resetting)
            let resetEdges = 0;
            g.original.extendUpwards = []; // store vertices that extend to right
            for (const edge of topSplit.edges) {
                if ((edge.color === model.colors.BLUE) && (edge.target === topSplit)) {
                    edge.replaceEndpoint(topSplit, fillerVertices[0]);
                    resetEdges++;
                    g.original.extendUpwards.push(edge.source.original);
                }
            }
            let replacedEdges = topSplit.edges.splice(0, resetEdges);
            // BLUE IN (adding)
            fillerVertices[0].edges.push(replacedEdges);
            let newEdge;
            for (let i = 0; i < fillerVertices.length - 1; i++) {
                newEdge = new model.Edge(g.edges.length, fillerVertices[i], fillerVertices[i + 1]);
                newEdge.graph = g;
                newEdge.color = model.colors.BLUE;
                g.edges.push(newEdge);
                fillerVertices[i + 1].edges.push(newEdge);
            }
            // RED IN (adding)
            for (let i = 0; i < fillerVertices.length; i++) {
                newEdge = new model.Edge(g.edges.length, leftSplit, fillerVertices[i]);
                newEdge.graph = g;
                newEdge.color = model.colors.RED;
                g.edges.push(newEdge);
                fillerVertices[i].edges.push(newEdge);
                leftSplit.edges.splice(leftOutIndex, 0, newEdge);
            }
            // BLUE OUT (setting)
            for (let i = 0; i < fillerVertices.length - 1; i++) {
                let edge = fillerVertices[i + 1].edges[0];
                fillerVertices[i].edges.push(edge);
            }
            let lastFillerVertex = fillerVertices[fillerVertices.length - 1];
            newEdge = new model.Edge(g.edges.length, lastFillerVertex, topSplit);
            newEdge.graph = g;
            newEdge.color = model.colors.BLUE;
            g.edges.push(newEdge);
            lastFillerVertex.edges.push(newEdge);
            topSplit.edges.splice(0, 0, newEdge);
            // RED OUT (adding)
            for (let i = 0; i < fillerVertices.length; i++) {
                newEdge = new model.Edge(g.edges.length, fillerVertices[i], rightSplit);
                newEdge.graph = g;
                newEdge.color = model.colors.RED;
                g.edges.push(newEdge);
                fillerVertices[i].edges.push(newEdge);
                rightSplit.edges.splice(rightInIndex++, 0, newEdge);
            }
        }
    }
}

async function splitPath(path, edge, g, direction, orientation) {
    let vertexIndex = 0;
    let curVertex = path[vertexIndex++];
    let prevVertex = null;
    let prevVertexSplit = null
    let curEdge = edge;
    // where to insert edge between split vertices in prev split vertex
    let insertPosition = -1;
    let edgeIndex = curVertex.edges.indexOf(curEdge);
    let curEdges = curVertex.edges;
    let curVertexSplit = null;

    while (curVertex !== path[path.length - 1]) {
        curVertexSplit = await splitVertex(curVertex, g);
        if ((orientation === model.orientations.CW) && (direction === directions.WEST)) {
            // - WEST - WEST - WEST - WEST - WEST - WEST - WEST - WEST -
            curVertexSplit.y = curVertexSplit.y + splittingOffset; // TODO this is very risky, because path might not actually run in correct direction

            // set endpoint of appropriate edges from current vertex to split vertex
            let resetEdges = 0;
            let removedEdgesEnd = null;
            // RED OUT (resetting)
            if (vertexIndex === 1) {
                for (let i = edgeIndex + 1; i < curEdges.length; i++) {
                    // after current edge, should only be red edges to inside of square
                    let nextEdge = curEdges[i];
                    nextEdge.replaceEndpoint(curVertex, curVertexSplit);
                    resetEdges++;
                }
                removedEdgesEnd = curEdges.splice(edgeIndex + 1, resetEdges);
            }
            edgeIndex = -1;
            resetEdges = 0;
            // BLUE IN (resetting)
            for (let i = edgeIndex + 1; i < curEdges.length; i++) {
                let nextEdge = curEdges[i];
                // move all the incoming blue edges to split vertex
                if ((nextEdge.color === model.colors.BLUE) && (nextEdge.target === curVertex)) {
                    nextEdge.replaceEndpoint(curVertex, curVertexSplit);
                    resetEdges++;
                } else {
                    break;
                }
            }

            // BLUE IN (adding)
            let removedEdgesStart = curEdges.splice(edgeIndex + 1, resetEdges);
            curVertexSplit.edges = curVertexSplit.edges.concat(removedEdgesStart);
            let nextInsertPosition = curVertexSplit.edges.length;

            // RED IN (adding): last vertex to split connected to last vertex of path
            let newEdge = null;
            if (curVertex === path[path.length - 2]) {
                let lastVertex = path[path.length - 1];
                newEdge = new model.Edge("e" + g.edges.length, lastVertex, curVertexSplit, false);
                newEdge.graph = g;
                newEdge.color = model.colors.RED;
                curVertexSplit.edges.push(newEdge);
                let lastEdge = lastVertex.getEdgeToNeighbor(curVertex);
                lastVertex.edges.splice(lastVertex.edges.indexOf(lastEdge) + 1, 0, newEdge);
                g.edges.push(newEdge);
            }

            // BLUE OUT (adding): create and insert new edge between split pair
            newEdge = new model.Edge("e" + g.edges.length, curVertexSplit, curVertex, false);
            newEdge.graph = g;
            newEdge.color = model.colors.BLUE;
            curVertexSplit.edges.push(newEdge);
            curEdges.splice(0, 0, newEdge);
            g.edges.push(newEdge);

            // RED OUT (adding): 
            // if not first vertex on path, then connect current split vertex with previous one
            if (prevVertexSplit != null) {
                newEdge = new model.Edge("e" + g.edges.length, curVertexSplit, prevVertexSplit, false);
                newEdge.graph = g;
                newEdge.color = model.colors.RED;
                g.edges.push(newEdge);
                prevVertexSplit.edges.push(newEdge);
                curVertexSplit.edges.splice(insertPosition, 0, newEdge);
            }
            insertPosition = nextInsertPosition;

            // RED OUT (adding, continued) add edges that now have split vertex as target to the edge list
            if (vertexIndex === 1) {
                curVertexSplit.edges = curVertexSplit.edges.concat(removedEdgesEnd);
            }

            // for WEST, next edge is not needed after first vertex
            curEdge = curEdges[0];

        } else if ((orientation === model.orientations.CW) && (direction === directions.NORTH)) {
            // - NORTH - NORTH - NORTH - NORTH - NORTH - NORTH - NORTH - NORTH -
            curVertexSplit.x = curVertexSplit.x - splittingOffset;

            // BLUE IN + RED IN (resetting):
            // set endpoint of appropriate edges from current vertex to split vertex
            let resetEdges = 0;
            for (let i = edgeIndex + 1; i < curEdges.length; i++) {
                let nextEdge = curEdges[i];
                if (nextEdge.target === curVertex) {
                    nextEdge.replaceEndpoint(curVertex, curVertexSplit);
                    resetEdges++;
                } else {
                    break;
                }
            }

            // BLUE IN (adding): if not first vertex on path, then connect current split vertex with previous one
            let newEdge = null;
            if (prevVertexSplit != null) {
                newEdge = new model.Edge("e" + g.edges.length, prevVertexSplit, curVertexSplit, false);
                newEdge.graph = g;
                newEdge.color = model.colors.BLUE;
                curVertexSplit.edges.push(newEdge);
                prevVertexSplit.edges.splice(insertPosition, 0, newEdge);
                g.edges.push(newEdge);
            }

            // remove edges from current vertex that have target changed ...
            let removedEdges = curEdges.splice(edgeIndex + 1, resetEdges);
            // BLUE IN + RED IN (adding): ... and add to split vertex
            curVertexSplit.edges = curVertexSplit.edges.concat(removedEdges);
            insertPosition = curVertexSplit.edges.length;

            // BLUE OUT (adding): last vertex to split connected to last vertex of path
            if (curVertex === path[path.length - 2]) {
                let lastVertex = path[path.length - 1];
                newEdge = new model.Edge("e" + g.edges.length, curVertexSplit, lastVertex, false);
                newEdge.graph = g;
                newEdge.color = model.colors.BLUE;
                curVertexSplit.edges.push(newEdge);
                let lastEdge = lastVertex.getEdgeToNeighbor(curVertex);
                lastVertex.edges.splice(lastVertex.edges.indexOf(lastEdge) + 1, 0, newEdge);
                g.edges.push(newEdge);
            }

            // RED OUT (adding): create and insert new edge between split pair
            newEdge = new model.Edge("e" + g.edges.length, curVertexSplit, curVertex, false);
            newEdge.graph = g;
            newEdge.color = model.colors.RED;
            curVertexSplit.edges.push(newEdge);
            curEdges.splice(edgeIndex + 1, 0, newEdge);
            g.edges.push(newEdge);

            // set current edge to edge to next vertex on path
            curEdge = curEdges[edgeIndex + 2];
        } else if ((orientation === model.orientations.CW) && (direction === directions.EAST)) {
            // - EAST - EAST - EAST - EAST - EAST - EAST - EAST - EAST -
            curVertexSplit.y = curVertexSplit.y - splittingOffset;

            // RED IN + BLUE OUT (resetting):
            // set endpoint of appropriate edges from current vertex to split vertex
            let resetEdges = 0;
            for (let i = edgeIndex + 1; i < curEdges.length; i++) {
                let nextEdge = curEdges[i];
                if (((nextEdge.color === model.colors.RED) && (vertexIndex === 1) && (nextEdge.target === curVertex)) ||
                    ((nextEdge.color === model.colors.BLUE) && (nextEdge.source === curVertex))) {
                    nextEdge.replaceEndpoint(curVertex, curVertexSplit);
                    resetEdges++;
                } else {
                    break;
                }
            }

            //  RED IN + BLUE OUT (removing): 
            // remove edges from current vertex that have target changed
            let removedEdges = curEdges.splice(edgeIndex + 1, resetEdges);

            // BLUE IN (adding): create and insert new edge between split pair
            let newEdge = new model.Edge("e" + g.edges.length, curVertex, curVertexSplit, false);
            newEdge.graph = g;
            newEdge.color = model.colors.BLUE;
            curVertexSplit.edges.push(newEdge);
            curEdges.splice(edgeIndex + 1, 0, newEdge);
            g.edges.push(newEdge);

            // RED IN (adding): 
            // if not first vertex on path, then connect current split vertex with previous one
            if (prevVertexSplit != null) {
                newEdge = new model.Edge("e" + g.edges.length, prevVertexSplit, curVertexSplit, false);
                newEdge.graph = g;
                newEdge.color = model.colors.RED;
                curVertexSplit.edges.push(newEdge);
                g.edges.push(newEdge);
                // in EAST case, we simply add edge as last edge
                prevVertexSplit.edges.push(newEdge);
            }

            // RED IN + BLUE OUT (adding):
            // add edges that now have split vertex as target to the edge list
            curVertexSplit.edges = curVertexSplit.edges.concat(removedEdges);

            // RED OUT (adding): last vertex to split connected to last vertex of path
            if (curVertex === path[path.length - 2]) {
                let lastVertex = path[path.length - 1];
                newEdge = new model.Edge("e" + g.edges.length, curVertexSplit, lastVertex, false);
                newEdge.graph = g;
                newEdge.color = model.colors.RED;
                curVertexSplit.edges.push(newEdge);
                let lastEdge = lastVertex.getEdgeToNeighbor(curVertex);
                lastVertex.edges.splice(lastVertex.edges.indexOf(lastEdge) + 1, 0, newEdge);
                g.edges.push(newEdge);
            }

            // set current edge to edge to next vertex on path
            curEdge = curEdges[edgeIndex + 2];

        } else if ((orientation === model.orientations.CW) && (direction === directions.SOUTH)) {
            // - SOUTH - SOUTH - SOUTH - SOUTH - SOUTH - SOUTH - SOUTH - SOUTH -
            curVertexSplit.x = curVertexSplit.x + splittingOffset;

            // BLUE OUT + RED OUT (resetting):
            // set endpoint of appropriate edges from current vertex to split vertex
            let resetEdges = 0;
            for (let i = edgeIndex + 1; i < curEdges.length; i++) {
                // all edges after current edge go to split vertex
                let nextEdge = curEdges[i];
                nextEdge.replaceEndpoint(curVertex, curVertexSplit);
                resetEdges++;
            }

            // remove edges from current vertex that have target changed
            let removedEdges = curEdges.splice(edgeIndex + 1, resetEdges);

            // BLUE IN (adding): last vertex to split connected to last vertex of path
            let newEdge = null;
            if (curVertex === path[path.length - 2]) {
                let lastVertex = path[path.length - 1];
                newEdge = new model.Edge("e" + g.edges.length, lastVertex, curVertexSplit, false);
                curVertexSplit.edges.push(newEdge);
                newEdge.graph = g;
                newEdge.color = model.colors.BLUE;
                let lastEdge = lastVertex.getEdgeToNeighbor(curVertex);
                lastVertex.edges.splice(lastVertex.edges.indexOf(lastEdge) + 1, 0, newEdge);
                g.edges.push(newEdge);
            }

            // RED IN (adding): create and insert new edge between split pair
            newEdge = new model.Edge("e" + g.edges.length, curVertex, curVertexSplit, false);
            newEdge.graph = g;
            newEdge.color = model.colors.RED;
            curVertexSplit.edges.push(newEdge);
            curEdges.push(newEdge);
            g.edges.push(newEdge);

            // BLUE OUT (adding): if not first vertex on path, then connect current split vertex with previous one
            if (prevVertexSplit != null) {
                newEdge = new model.Edge("e" + g.edges.length, curVertexSplit, prevVertexSplit, false);
                newEdge.graph = g;
                newEdge.color = model.colors.BLUE;
                curVertexSplit.edges.push(newEdge);
                prevVertexSplit.edges.splice(0, 0, newEdge);
                g.edges.push(newEdge);
            }

            // BLUE OUT + RED OUT (adding):
            // add edges remove from current vertex to split vertex
            curVertexSplit.edges = curVertexSplit.edges.concat(removedEdges);

            // set current edge to edge to next vertex on path
            curEdge = curEdges[0];
        }

        if (prevVertex !== null) {
            prevVertex.setNumberIncomingEdges();
        }

        curVertexSplit.graph = g;

        // set variables for next vertex
        prevVertex = curVertex
        prevVertexSplit = curVertexSplit;
        curVertex = path[vertexIndex++];

        curEdges = curVertex.edges;
        edgeIndex = curVertex.edges.indexOf(curEdge);
    }
}

async function splitVertex(curVertex, graph) {
    let curVertexSplit = new model.Vertex(graph.vertices.length, curVertex.x, curVertex.y);
    curVertexSplit.name = curVertex.name + "s";
    curVertexSplit.splitOriginal = curVertex;
    curVertex.splitCopy = curVertexSplit;
    let original = curVertex.original;
    if (original !== null) {
        curVertexSplit.original = curVertex.original;
        if (original.copies === null) {
            original.copies = [];
            original.copies.push(curVertex);
            original.copies.push(curVertexSplit);
        }
    }
    graph.vertices.push(curVertexSplit);

    return curVertexSplit;
}

async function computeSplitPath(uOriginal, vOriginal, gColor, forwardBackward, direction, orientation) {
    console.log("  compute split path", direction);// uOriginal, vOriginal, direction, orientation);

    let path = [];
    if (orientation == model.orientations.CW) {
        path.push(vOriginal.copy.copy);
    } else {
        path.push(uOriginal.copy.copy);
    }
    let u = (gColor.color === model.colors.BLUE) ? uOriginal.copy.copy.blueCopy : uOriginal.copy.copy.redCopy;
    let v = (gColor.color === model.colors.BLUE) ? vOriginal.copy.copy.blueCopy : vOriginal.copy.copy.redCopy;

    // both have to go at least one step
    let uNext = await getNextVertex(u, forwardBackward, tendencies.RIGHMOST);
    let vNext = await getNextVertex(v, forwardBackward, tendencies.LEFTMOST);

    // console.log("uNext", uNext);
    // console.log("vNext", vNext);

    while (uNext !== vNext) {
        let uAway = 0;
        let vAway = 0;
        let updateU;
        if (direction === directions.EAST) {
            uAway = uNext.original.original.original.rectangle.x2;
            vAway = vNext.original.original.original.rectangle.x2;
            updateU = uAway < vAway;
        } else if (direction === directions.NORTH) {
            uAway = uNext.original.original.original.rectangle.y1;
            vAway = vNext.original.original.original.rectangle.y1;
            updateU = uAway > vAway;
        } else if (direction === directions.WEST) {
            uAway = uNext.original.original.original.rectangle.x1;
            vAway = vNext.original.original.original.rectangle.x1;
            updateU = uAway > vAway;
        } else if (direction === directions.SOUTH) {
            uAway = uNext.original.original.original.rectangle.y2;
            vAway = vNext.original.original.original.rectangle.y2;
            updateU = uAway < vAway;
        }

        if (updateU) {
            if (orientation === model.orientations.CCW) {
                path.push(uNext.original);
            }
            uNext = await getNextVertex(uNext, forwardBackward, tendencies.RIGHMOST);
            // console.log("uNext", uNext);
        } else {
            if (orientation == model.orientations.CW) {
                path.push(vNext.original);
            }
            vNext = await getNextVertex(vNext, forwardBackward, tendencies.LEFTMOST);
            // console.log("vNext", vNext);
        }
    }
    path.push(uNext.original);

    return path;
}

async function getNextVertex(vertex, forwardBackward, tendency) {
    let edge = null;

    if ((forwardBackward === directions.FORWARD) && (tendency === tendencies.RIGHMOST)) {
        // last outgoing edge, since edges ordered clockwise
        edge = vertex.edges[vertex.edges.length - 1];
    } else if ((forwardBackward === directions.FORWARD) && (tendency === tendencies.LEFTMOST)) {
        // first outgoing edge
        edge = vertex.edges[vertex.numIncomingEdges];
    } else if ((forwardBackward === directions.BACKWARD) && (tendency === tendencies.RIGHMOST)) {
        // first incoming edge
        edge = vertex.edges[vertex.numIncomingEdges - 1];
    } else {
        // last incoming edge
        edge = vertex.edges[0];
    }

    return edge.getOtherEndpoint(vertex);
}

export const directions = {
    FORWARD: true,
    BACKWARD: false,
    EAST: "E",
    NORTH: "N",
    WEST: "W",
    SOUTH: "S"
}

export const tendencies = {
    RIGHMOST: true,
    LEFTMOST: false
}