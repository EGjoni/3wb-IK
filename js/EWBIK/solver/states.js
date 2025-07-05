import { IKTransform } from "../EWBIK.js";
import { IKNode } from "../util/nodes/IKNodes.js";
import { WorkingBone } from "./ShadowBones/WorkingBone.js";


/** manages recording of ShadowSkeleton internal state*/
export class StateRecorder {


    constructor(shadowSkeleton) {
        this.shadowSkeleton = shadowSkeleton;
        this.solves = [];
        this.solveCursor = -1;
        this.itrCursor = -1;
        this.setpCursor = -1;
    }

    /**marks a new solve call */
    newSolve() {
        this.solves.push([]);
        this.solveCursor = this.solves.length-1;
    }

    /**marks a new iteration*/
    newIttr() {
        let itrArr = this.solves[this.solves.length-1];
        itrArr.push([]);
        this.itrCursor = itrArr.length-1;
    }

    newStep() {
        let currState = new FullState(this.shadowSkeleton);
        let itrArr = this.solves[this.solves.length-1];
        let stepsArr = itrArr[itrArr.length-1];
        stepsArr.push(currState);
        this.stepCursor = stepsArr.length-1;
    }


}

/**
 * Immutably records the full state of a ShadowSkeleton 
 */
export class FullState {

}