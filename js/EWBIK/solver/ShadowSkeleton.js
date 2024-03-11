import { IKNode } from "../util/IKNodes.js";
import { Vec3Pool } from "../util/vecs.js";
import { ArmatureSegment } from "./ArmatureSegment.js";

export class ShadowSkeleton {
    constructor(vecpool, skelState, baseDampening = Math.PI, precision = 64) {
        this.pool = vecpool;
        this.precision = precision;
        this.skelState = skelState;
        this.shadowSpace = new IKNode(null, null, undefined, this.pool);
        this.baseDampening = baseDampening;
        this.lastPainTotal = 0;
        this.accumulatingPain = 0;
        this.maxPain = 0;
        this.constrainedBoneArray= [];
        this.traversalArray = [];
        this.boneWorkingBoneIndexMap = {};
        this.buildSimTransformsHierarchy();
        this.buildArmaturSegmentHierarchy();
        this.buildTraversalArray();
    }

    /**doesn't solve for anything, just updates the pain info of each bone for debugging*/
    noOp(fromBone, iterations, onComplete, callbacks = null) {
        this.alignSimAxesToBoneStates();
        //this.pullBack(iterations, solveFrom, false, null);
        const endOnIndex = this.getEndOnIndex();
        this.updateReturnfulnessDamps(iterations);
        this.accumulatingPain = 0;
        this.maxPain = 0;
        for (let j = 0; j <= endOnIndex; j++) {
            this.traversalArray[j].updatePain(0);
            let bonepain = this.traversalArray[j].getOwnPain();
            if(bonepain > this.maxPain) {
                this.maxPain = bonepain;
                this.maxpainbone = this.traversalArray[j].forBone.directRef;
            }
            this.accumulatingPain += bonepain;
        }
        this.lastPainTotal = this.accumulatingPain;
        this.updateBoneStates(onComplete, callbacks)

    }

     /**
      * @param iterations number of times to run
       * @param stabilizationPasses set to 0 for maximum speed (but less stability given unreachable situations), 
       * Set to 1 for maximum stability while following constraints. 
       * Set to higher than 1 for negligible benefit at considerable cost. 
       * Set to -1 to indicate constraints can be broken on the last iteration of a solver call
       * @param solveFrom optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments
       * @param notifier a (potentially threaded) function to call every time the solver has updated the transforms for a given bone. 
       * Called once per solve, per bone. NOT once per iteration.
       * This can be used to take advantage of parallelism, so that you can update your Bone transforms while this is still writing into the skelState TransformState list
       */

    solve(iterations, stabilizationPasses, solveFrom, onComplete, callbacks=null) {
        this.alignSimAxesToBoneStates();
        const endOnIndex = this.getEndOnIndex(solveFrom)
        //this.pullBack(iterations, solveFrom, false, null);
        this.updateReturnfulnessDamps(iterations);

        for (let i = 0; i < iterations; i++) {
            this.solveToTargets(stabilizationPasses, endOnIndex, onComplete, callbacks, i);
        }
    }

    pullBackAll(iterations, solveFrom, onComplete, callbacks = null, currentIteration) {
        if(this.traversalArray?.length == 0 ) return;
        this.alignSimAxesToBoneStates();
        const endOnIndex = this.getEndOnIndex(solveFrom);
        this.updateReturnfulnessDamps(iterations);
        this.accumulatingPain = 0;
        this.maxPain = 0;
        for (let j = 0; j <= endOnIndex; j++) {
            this.traversalArray[j].pullBackTowardAllowableRegion(currentIteration, callbacks);
            let bonepain = this.traversalArray[j].getOwnPain();
            if(bonepain > this.maxPain) {
                this.maxPain = bonepain;
                this.maxpainbone = this.traversalArray[j].forBone.directRef;
            }
            this.accumulatingPain += bonepain;
        }
        this.lastPainTotal = this.accumulatingPain;
        this.updateBoneStates(onComplete, callbacks)
    }

    /**
       * @param stabilizationPasses set to 0 for maximum speed (but less stability given unreachable situations), 
       * Set to 1 for maximum stability while following constraints. 
       * Set to higher than 1 for negligible benefit at considerable cost. 
       * Set to -1 to indicate constraints can be broken on the last iteration of a solver call
       * @param solveFrom optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments
       * @param notifier a (potentially threaded) function to call every time the solver has updated the transforms for a given bone. 
       * Called once per solve, per bone. NOT once per iteration.
       * This can be used to take advantage of parallelism, so that you can update your Bone transforms while this is still writing into the skelState TransformState list
       */
    solveToTargets(stabilizationPasses, endOnIndex, onComplete, callbacks, currentIteration) {
        if(this.traversalArray?.length == 0 ) return;
        ;
        let translate = endOnIndex === this.traversalArray.length - 1;
        let skipConstraints = stabilizationPasses < 0;
        stabilizationPasses = Math.max(0, stabilizationPasses);
        if (translate) { //special case. translate and rotate the rootbone first to minimize deviation from innermost targets
            this.traversalArray[endOnIndex].fastUpdateOptimalRotationToPinnedDescendants(0, translate, true, currentIteration);
        }
        this.accumulatingPain = 0;
        this.maxPain = 0;
        for (let j = 0; j <= endOnIndex; j++) {
            const wb = this.traversalArray[j];
            callbacks?.beforeIteration(wb.forBone.directRef, wb.forBone.getFrameTransform(), wb);
            wb.pullBackTowardAllowableRegion(currentIteration, callbacks);
            wb.fastUpdateOptimalRotationToPinnedDescendants(stabilizationPasses, translate && j === endOnIndex, skipConstraints, currentIteration);
            let bonepain = wb.getOwnPain();
            if(bonepain > this.maxPain) {
                this.maxPain = bonepain;
                this.maxpainbone = this.traversalArray[j].forBone.directRef;
            }
            this.accumulatingPain += bonepain;
            callbacks?.afterIteration(wb.forBone.directRef, wb.forBone.getFrameTransform(), wb);
        }
        this.lastPainTotal = this.accumulatingPain;

        this.updateBoneStates(onComplete, callbacks);
        this.pool.releaseAll();
    }

    /**
       * lazy lookup. Get the traversal array index for the root of the pinned segment the working bone corresponding to this bonestate resides on, 
       * but only if it's different than the last one that was tracked.
       * @param solveFrom
       * @return
       */
    getEndOnIndex(solveFrom) {
        if (solveFrom != this.lastRequested) {
            if (solveFrom == null) {
                this.lastRequestedEndIndex = this.traversalArray.length - 1;
                this.lastRequested = null;
            } else {
                console.log("new solve from: " +solveFrom.ikd);
                const idx = this.boneWorkingBoneIndexMap[solveFrom.ikd];
                const wb = this.traversalArray[idx];
                const root = wb.getRootSegment().wb_segmentRoot;
                this.lastRequestedEndIndex = this.boneWorkingBoneIndexMap[root.forBone.ikd];
                this.lastRequested = solveFrom;
            }
        }
        return this.lastRequestedEndIndex;
    }
    /**
         * lazy update of returnfullness dampening if the number of iterations for this solver call is different than the previous one
         * @param iterations
         */
    updateReturnfulnessDamps(iterations) {
        if (this.previousIterationRequest !== iterations) {
            for (let j = 0; j < this.constrainedBoneArray.length; j++) {
                this.constrainedBoneArray[j].updateReturnfullnessDamp(iterations);
            }
        }
        this.previousIterationRequest = iterations;
    }


    /**wrapper for conditional debugging */
    /*conditionalNotify(doNotify, notifier) {
        if (doNotify) {
            this.alignBoneStatesToSimAxes(notifier);
        }
    }*/

    alignSimAxesToBoneStates() {
        const transforms = this.skelState.getTransformsArray();
        const shadowSpace = this.shadowSpace; 
        for (let i = 0; i < transforms.length; i++) {
            const ts = this.simTransforms[i];
            if(ts.parent != shadowSpace) { 
                this.simTransforms[i].getLocalMBasis().setFromArrays(transforms[i].translation, transforms[i].rotation, transforms[i].scale);
                this.simTransforms[i]._exclusiveMarkDirty(); //we're marking the entire hierarchy dirty anyway, so avoid the recursion
            }
            
        }
        for (let i = 0; i < this.constrainedBoneArray.length; i++) {
            this.constrainedBoneArray[i].mimicDesiredAxes(); //make sure any bones with constraints have reliable data
        }
    }

    updateBoneStates(onComplete, callbacks) {
        //if (notifier == null) {
        for (let i = 0; i < this.traversalArray.length; i++) {
            const wb = this.traversalArray[i];
            const bs = wb.forBone;
            const ts = bs.getFrameTransform();
            bs._setCurrentPain(wb.getOwnPain());
            wb.simLocalAxes.localMBasis.translate.toArray(ts.translation);
            wb.simLocalAxes.localMBasis.rotation.toArray(ts.rotation);
            callbacks?.afterSolve(bs.directRef, ts, wb);
            onComplete(bs, ts, wb);
        }
        /*} else {
            for (let i = 0; i < this.traversalArray.length; i++) {
                this.alignBone(this.traversalArray[i]);
                notifier(this.traversalArray[i].forBone);
            }
        }*/
    }

    buildSimTransformsHierarchy() {
        const transformCount = this.skelState.getTransformCount();
        if (transformCount === 0) return;

        /**@type {[IKNode]} */
        this.simTransforms = [];
        let fakeOrigin = -1;
        for (let i = 0; i < transformCount; i++) {
            const ts = this.skelState.getTransformState(i);
            const parTSidx = ts.getParentIndex();
            const newTransform = new IKNode(null, this.shadowSpace, undefined, this.pool);
            newTransform.getLocalMBasis().adoptValuesFromTransformState(ts);
            this.simTransforms.push(newTransform);
            if(parTSidx == -1) fakeOrigin = i;
        }

        for (let i = 0; i < transformCount; i++) {
            const ts = this.skelState.getTransformState(i);
            const parTSidx = ts.getParentIndex();
            const simT = this.simTransforms[i];
            if (parTSidx == -1) {
                simT.reset();
                simT.setRelativeToParent(this.shadowSpace);
            }
            else simT.setRelativeToParent(this.simTransforms[parTSidx]);
        }
    }

    buildArmaturSegmentHierarchy() {
        const rootBone = this.skelState.getRootBonestate();
        if (!rootBone) return;

        this.rootSegment = new ArmatureSegment(this, rootBone, null, false, this.pool);
        this.rootSegment.init();
    }

    buildTraversalArray() {
        if (!this.rootSegment) return;

        const segmentTraversalArray = this.rootSegment.getDescendantSegments();
        const reversedTraversalArray = [];
        this.boneWorkingBoneIndexMap = {};

        for (const segment of segmentTraversalArray) {
            reversedTraversalArray.push(...segment.reversedTraversalArray);
        }

        this.traversalArray = new Array(reversedTraversalArray.length);
        let j = 0;
        this.constrainedBoneArray= [];
        for (let i = reversedTraversalArray.length - 1; i >= 0; i--) {
            this.traversalArray[j] = reversedTraversalArray[i];
            this.boneWorkingBoneIndexMap[this.traversalArray[j].forBone.ikd] =  j;
            if(reversedTraversalArray[i].constraint != null) {
                this.constrainedBoneArray.push(reversedTraversalArray[i]);
            }
            j++;
        }

        this.lastRequested = null;
        this.lastRequestedEndIndex = this.traversalArray.length - 1;
    }

    setDampening(dampening, defaultIterations) {
        this.baseDampening = dampening;
        this.updateRates(defaultIterations);
    }

    updateRates(iterations) {
        if (this.rootSegment == null) {
            console.error("No root segment");
            return;
            //throw Error("No rootsegment");
        }
        this.rootSegment.recursivelyCreateHeadingArrays();
        for (let j = 0; j < this.traversalArray.length; j++) {
            this.traversalArray[j].updateCosDampening();
            this.traversalArray[j].updateReturnfullnessDamp(iterations);
        }
    }


    /**doesn't solve for anything, just updates the pain info of each bone for debugging*/
    debug_noOp(fromBone, iterations, onComplete, callbacks = null, ds) {
        this.alignSimAxesToBoneStates();
        //this.pullBack(iterations, solveFrom, false, null);
        const endOnIndex = this.getEndOnIndex();
        ds.endOnIndex = endOnIndex;
        this.updateReturnfulnessDamps(iterations);
        this.accumulatingPain = 0;
        this.maxPain = 0;
        for (let j = 0; j <= endOnIndex; j++) {
            this.traversalArray[j].updatePain(0);
            let bonepain = this.traversalArray[j].getOwnPain();
            if(bonepain > this.maxPain) {
                this.maxPain = bonepain;
                this.maxpainbone = this.traversalArray[j].forBone.directRef;
            }
            this.accumulatingPain += bonepain;
        }
        this.lastPainTotal = this.accumulatingPain;
        this.updateBoneStates(onComplete, callbacks)

    }
    debugState = {        
        currentTraversalIndex : 0,
        currentIteration: 0,
        currentStep: 0,
        endOnIndex: null,
        accumulatingPain: 0,
        maxPain: 0,
        solveCalls: 0,
        steps: [
            'pullback',
            'preTarget',
            'postTarget',
            'pain',
        ]
    }

    
   

     /**
      * @param iterations number of times to run
       * @param stabilizationPasses set to 0 for maximum speed (but less stability given unreachable situations), 
       * Set to 1 for maximum stability while following constraints. 
       * Set to higher than 1 for negligible benefit at considerable cost. 
       * Set to -1 to indicate constraints can be broken on the last iteration of a solver call
       * @param solveFrom optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments
       * @param notifier a (potentially threaded) function to call every time the solver has updated the transforms for a given bone. 
       * Called once per solve, per bone. NOT once per iteration.
       * This can be used to take advantage of parallelism, so that you can update your Bone transforms while this is still writing into the skelState TransformState list
       */

    debug_solve(iterations, stabilizationPasses, solveFrom, onComplete, callbacks=null, ds = this.debugState) {
        ds.completedSolve = false;
        if(ds.currentStep == 0) {
            this.alignSimAxesToBoneStates();
        }
        const endOnIndex = ds.endOnIndex == null ? this.getEndOnIndex(solveFrom) : ds.endOnIndex;
        ds.endOnIndex = endOnIndex;
        this.updateReturnfulnessDamps(iterations);

        this.accumulatingPain = ds.accumulatingPain;
        this.maxPain = ds.maxPain;
        this.debug_iteration_solveToTargets(stabilizationPasses, endOnIndex, onComplete, callbacks, ds);
        if(ds.completedIteration && ds.currentIteration == iterations-1) {
            ds.completedSolve=true;
        }
    }

    /**
       * @param stabilizationPasses set to 0 for maximum speed (but less stability given unreachable situations), 
       * Set to 1 for maximum stability while following constraints. 
       * Set to higher than 1 for negligible benefit at considerable cost. 
       * Set to -1 to indicate constraints can be broken on the last iteration of a solver call
       * @param solveFrom optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments
       * @param notifier a (potentially threaded) function to call every time the solver has updated the transforms for a given bone. 
       * Called once per solve, per bone. NOT once per iteration.
       * This can be used to take advantage of parallelism, so that you can update your Bone transforms while this is still writing into the skelState TransformState list
       */
    debug_iteration_solveToTargets(stabilizationPasses, endOnIndex, onComplete, callbacks, ds = this.debugState) {
        ds.completedSolve = false;
        if(this.traversalArray?.length == 0 ) return;
        const wb = this.traversalArray[ds.currentTraversalIndex];
        
        let translate = endOnIndex === this.traversalArray.length - 1;
        let skipConstraints = stabilizationPasses < 0;
        stabilizationPasses = Math.max(0, stabilizationPasses);
        if (translate && ds.currentTraversalIndex == 0) { //special case. translate and rotate the rootbone first to minimize deviation from innermost targets
            wb.fastUpdateOptimalRotationToPinnedDescendants(0, translate, true, ds.currentIteration);
        }
        
        if(ds.currentTraversalIndex <= endOnIndex) {
            this.debug_bone_solveToTargets(stabilizationPasses, translate, endOnIndex, onComplete, callbacks, ds);
        } else {
            this.lastPainTotal = this.accumulatingPain;
        }
       
        this.updateBoneStates(onComplete, callbacks);
        this.pool.releaseAll();
    }

    debug_bone_solveToTargets(stabilizationPasses, translate, endOnIndex, onComplete, callbacks, ds=this.debugState) {
        const wb = this.traversalArray[ds.currentTraversalIndex];
        if(ds.steps[ds.currentStep] == 'pullback') {            
            wb.pullBackTowardAllowableRegion(ds.currentIteration, callbacks);
            ds.currentStep++;
            return;
        } else if(ds.steps[ds.currentStep] == 'preTarget') {
            wb.updateDescendantsPain();
            wb.updateTargetHeadings(wb.chain.boneCenteredTargetHeadings, wb.chain.weights, wb.myWeights); 
            wb.updateTipHeadings(wb.chain.boneCenteredTipHeadings, !translate);
            callbacks?.beforeIteration(wb.forBone.directRef, wb.forBone.getFrameTransform(), wb);
            ds.currentStep++;
            return;
        } else if(ds.steps[ds.currentStep] == 'postTarget') {
            wb.fastUpdateOptimalRotationToPinnedDescendants(stabilizationPasses, translate && ds.currentTraversalIndex === endOnIndex, false);
            wb.updateTargetHeadings(wb.chain.boneCenteredTargetHeadings, wb.chain.weights, wb.myWeights); 
            wb.updateTipHeadings(wb.chain.boneCenteredTipHeadings, !translate);
            callbacks?.afterIteration(wb.forBone.directRef, wb.forBone.getFrameTransform(), wb);
            ds.currentStep++;
            ds.willCompleteBone = true;
            return;
        } else if(ds.steps[ds.currentStep] == 'pain') {
            let bonepain = wb.getOwnPain();
            if(bonepain > ds.maxPain) {
                ds.maxPain = bonepain;
                ds.maxpainbone = wb.forBone.directRef;
            }
            ds.accumulatingPain += bonepain;
            ds.currentStep = 0;
            ds.currentTraversalIndex++;
            ds.willCompleteBone = false;
            if(ds.currentTraversalIndex == endOnIndex) {
                ds.willCompleteIteration = true;
                ds.currentIteration++;
            } else if(ds.willCompleteIteration) {
                ds.willCompleteIteration = false;
                ds.completedIteration = true;
                ds.currentIteration++;
                ds.currentTraversalIndex = 0
            }
            return;
        }        
    }

    incrStep(iterations) {
        let ds = this.debugState;
        if(ds.completedIteration) {
            if(ds.completedSolve) {
                ds.currentIteration = 0;
                ds.currentStep = 0; 
                ds.currentTraversalIndex = 0;
            }
            ds.accumulatingPain = 0;
            ds.maxPain = 0;
            ds.maxpainbone = null;
        }
               
    }
}