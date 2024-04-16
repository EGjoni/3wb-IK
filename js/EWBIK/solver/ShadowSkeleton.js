import { IKNode } from "../util/nodes/IKNodes.js";
import { Vec3Pool } from "../util/vecs.js";
import { ArmatureSegment } from "./ArmatureSegment.js";

export class ShadowSkeleton {
    /**@type {[ShadowNode]}*/
    targetList = []; //a list of all active targets everywhere on the armature
    commonAncestor = null; //the ShadowNode that everything being solved for has in common (for efficiency when solving otherwise shallow things deep in the node hierarchy)
    lastLiteral = false;
    /**
     * 
     * @param {EWBIK} parentArmature a reference to the vector pool this shadow skeleton should make use of for internal calculations
     * @param {Bone} rootBone a reference to the rootbone of the armature
     * @param {IKNode} rootNode an optional reference to the node calculations should be done with respect to. 
     * The further away from the scene center your skeleton / target is likely to be, the more you will want to err in favor
     * of specifying this, but at 64 bits of precision, it's a pretty rare use-case that would require it.
     * @param {Number} baseDampening the dampening parameter on the armature
     */
    constructor(parentArmature, rootBone, rootNode =null, baseDampening = Math.PI, precision = 64) {
        this.parentArmature = parentArmature;
        this.volatilePool = parentArmature.volatilePool;
        this.stablePool = parentArmature.stablePool; 
        this.precision = precision;
        this.rootBone = rootBone;
        this.armatureRootNode = rootNode == null || rootNode.nodeDepth >= this.parentArmature.armatureNode.nodeDepth ? this.parentArmature.armatureNode : rootNode;
        this.commonAncestor = this.armatureRootNode;
        this.baseDampening = baseDampening;
        this.lastPainTotal = 0;
        this.accumulatingPain = 0;
        this.maxPain = 0;
        this.constrainedBoneArray = [];
        /**@type {[WorkingBone]} */
        this.traversalArray = [];
        this.boneWorkingBoneIndexMap = new Map();
        this.buildArmaturSegmentHierarchy();
    }

    /**doesn't solve for anything, 
     * just updates the pain info of each bone for visualization purposes*/
    noOp(fromBone, iterations, onComplete, callbacks = null) {
        this.alignSimAxesToBoneStates();
        //this.pullBack(iterations, solveUntil, false, null);
        const endOnIndex = this.getEndOnIndex();
        this.updateReturnfulnessDamps(iterations);
        this.accumulatingPain = 0;
        this.maxPain = 0;
        for (let j = 0; j <= endOnIndex; j++) {
            const wb = this.traversalArray[j];
            wb.updatePain(0);
            /*if(wb.hasLimitingConstraint) {
                let clampBy = wb.constraint.getAcceptableRotation(
                    wb.simLocalAxes,
                    wb.simBoneAxes,
                    Rot.IDENTITY,
                    wb
                );
                wb.simLocalAxes.rotateByLocal(clampBy);
            }*/
            let bonepain = wb.getOwnPain();
            if (bonepain > this.maxPain) {
                this.maxPain = bonepain;
                this.maxpainbone = wb.forBone;
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
      * @param solveUntil optional, if given, the solver will only solve to the segment the given bone is on (and any of its descendant segments
      * @param notifier a (potentially threaded) function to call every time the solver has updated the transforms for a given bone. 
      * Called once per solve, per bone. NOT once per iteration.
      */

    solve(iterations, stabilizationPasses, solveUntil, literal = false, onComplete, callbacks = null) {
        //if(window.perfing) performance.mark("shadowSkelSolve start");
        this.alignSimAxesToBoneStates();
        const endOnIndex = this.getEndOnIndex(solveUntil, literal)
        //this.pullBack(iterations, solveUntil, false, null);
        this.updateReturnfulnessDamps(iterations);

        for (let i = 0; i < iterations; i++) {
            this.solveToTargets(stabilizationPasses, endOnIndex, null, callbacks, i);
        }

        //if(window.perfing) performance.mark("shadowSkelSolve end");
        //if(window.perfing) performance.measure("shadowSkelSolve", "shadowSkelSolve start", "shadowSkelSolve end");   
        this.updateBoneStates(onComplete, callbacks);        
    }

    pullBackAll(iterations, solveUntil, literal, onComplete, callbacks = null, currentIteration) {
        if (this.traversalArray?.length == 0) return;
        this.alignSimAxesToBoneStates();
        const endOnIndex = this.getEndOnIndex(solveUntil, literal);
        this.updateReturnfulnessDamps(iterations);
        this.accumulatingPain = 0;
        this.maxPain = 0;
        for (let j = 0; j <= endOnIndex; j++) {
            this.traversalArray[j].pullBackTowardAllowableRegion(currentIteration, callbacks);
            let bonepain = this.traversalArray[j].getOwnPain();
            if (bonepain > this.maxPain) {
                this.maxPain = bonepain;
                this.maxpainbone = this.traversalArray[j].forBone;
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
       * @param solveUntil optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments
       * @param notifier a (potentially threaded) function to call every time the solver has updated the transforms for a given bone. 
       * Called once per solve, per bone. NOT once per iteration.
       */
    solveToTargets(stabilizationPasses, endOnIndex, onComplete, callbacks, currentIteration) {
        if (this.traversalArray?.length == 0) return;
        ;
        let translate = endOnIndex === this.traversalArray.length - 1;
        let skipConstraints = stabilizationPasses < 0;
        //if(window.perfing) performance.mark("solveToTargetsp1 start");
        stabilizationPasses = Math.max(0, stabilizationPasses);
        if (translate) { //special case. translate and rotate the rootbone first to minimize deviation from innermost targets
            this.traversalArray[endOnIndex].fastUpdateOptimalRotationToPinnedDescendants(translate, true, currentIteration);
        }
        //if(window.perfing) performance.mark("solveToTargetsp1 end");
        //if(window.perfing) performance.measure("solveToTargetsp1", "solveToTargetsp1 start", "solveToTargetsp1 end");  
        this.accumulatingPain = 0;
        this.maxPain = 0;
        //if(window.perfing) performance.mark("solveToTargetsp2 start");
        for (let j = 0; j <= endOnIndex; j++) {
            const wb = this.traversalArray[j];
            //callbacks?.beforeIteration(wb.forBone, wb.forBone.getFrameTransform(), wb);
            wb.pullBackTowardAllowableRegion(currentIteration, callbacks);
            wb.fastUpdateOptimalRotationToPinnedDescendants(translate && j === endOnIndex, skipConstraints, currentIteration);
            let bonepain = wb.getOwnPain();
            if (bonepain > this.maxPain) {
                this.maxPain = bonepain;
                this.maxpainbone = this.traversalArray[j].forBone;
            }
            this.accumulatingPain += bonepain;
            //callbacks?.afterIteration(wb.forBone, wb.forBone.getFrameTransform(), wb);
        }
        this.lastPainTotal = this.accumulatingPain;

        //this.updateBoneStates(onComplete, callbacks);
        this.stablePool.releaseTemp();
        this.volatilePool.releaseTemp();
        //if(window.perfing) performance.mark("solveToTargetsp2 end");
        //if(window.perfing) performance.measure("solveToTargetsp2", "solveToTargetsp2 start", "solveToTargetsp2 end");  
        //if(window.perfing) performance.measure("solveToTargets", "solveToTargetsp1 start", "solveToTargetsp2 end");  
    }

    /**
       * lazy lookup. Get the traversal array index for the root of the pinned segment the working bone corresponding to the input bonestate resides on, 
       * but only if it's different than the last one that was tracked.
       * @param solveUntil
       * @param literal if true, will end on the literal bone (inclusive) instead of the chain start.
       * @return
       */
    getEndOnIndex(solveUntil, literal = false) {
        if (solveUntil != this.lastRequested || this.lastLiteral == literal) {
            if (solveUntil == null) {
                this.lastRequestedEndIndex = this.traversalArray.length - 1;
                this.lastRequested = null;
            } else {
                const idx = this.boneWorkingBoneIndexMap.get(solveUntil);
                if(idx == null) {
                    this.lastRequestedEndIndex = this.traversalArray.length - 1;
                    this.lastRequested = -1; 
                } else {
                    if(literal) {
                        this.lastRequestedEndIndex = idx;
                        this.lastLiteral = true;
                    } else {
                        const wb = this.traversalArray[idx];
                        const root = wb.getRootSegment().wb_segmentRoot;
                        this.lastRequestedEndIndex = this.boneWorkingBoneIndexMap.get(root.forBone);
                        this.lastLiteral = false;
                    }
                    this.lastRequested = solveUntil;
                }
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


    alignSimAxesToBoneStates() {
        this.commonAncestor.tempAdoptTrackedGlobal();
        for(let t of this.targetList) {
            t.mimic(false, this.commonAncestor);
        }
        this.rootBone.trackedBy.mimic(false, this.commonAncestor);
        for(let b of this.traversalArray) {
            b.simLocalAxes.quickMimic();
        }
        /*for (let i = 0; i < this.constrainedBoneArray.length; i++) {
            this.constrainedBoneArray[i].mimicDesiredAxes(); //make sure any bones with constraints have reliable data
        }*/
    }

    updateBoneStates(onComplete, callbacks) {
        for (let i = 0; i < this.traversalArray.length; i++) {
            const wb = this.traversalArray[i];
            callbacks?.afterSolve(wb);
            if(onComplete)
                onComplete(wb);
        }
    }

    buildArmaturSegmentHierarchy() {
        const rootBone = this.parentArmature.rootBone;
        if (!rootBone) return;

        this.rootSegment = new ArmatureSegment(this, rootBone, null, false);
        this.rootSegment.init();
        this.buildTraversalArray();
    }

    buildTraversalArray() {
        if (!this.rootSegment) return;

        const segmentTraversalArray = this.rootSegment.getAllDescendantSegments();
        const reversedTraversalArray = [];
        this.boneWorkingBoneIndexMap.clear();
        let pinsSet = new Set();

        for (const segment of segmentTraversalArray) {
            if(segment.pinnedBones.length > 0) {
                reversedTraversalArray.push(...segment.solvableStrandBones);
                for(let wb of segment.pinnedBones) {
                    this.commonRootDepth = Math.min(wb.ikPin.targetNode.nodeDepth, this.commonRootDepth);
                    pinsSet.add(wb.ikPin.targetNode);
                }
            }
        }
        this.targetList = [...pinsSet];
        let forCommon = [this.armatureRootNode, ...this.targetList];
        this.commonAncestor = IKNode.getCommonAncestor(forCommon);

        this.traversalArray = new Array(reversedTraversalArray.length);
        let j = 0;
        this.constrainedBoneArray = [];
        for (let i = reversedTraversalArray.length - 1; i >= 0; i--) {
            this.traversalArray[j] = reversedTraversalArray[i];
            this.boneWorkingBoneIndexMap.set(this.traversalArray[j].forBone, j);
            if (reversedTraversalArray[i].constraint != null) {
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
        //this.pullBack(iterations, solveUntil, false, null);
        const endOnIndex = this.getEndOnIndex();
        ds.endOnIndex = endOnIndex;
        this.updateReturnfulnessDamps(iterations);
        this.accumulatingPain = 0;
        this.maxPain = 0;
        for (let j = 0; j <= endOnIndex; j++) {
            this.traversalArray[j].updatePain(0);
            let bonepain = this.traversalArray[j].getOwnPain();
            if (bonepain > this.maxPain) {
                this.maxPain = bonepain;
                this.maxpainbone = this.traversalArray[j].forBone;
            }
            this.accumulatingPain += bonepain;
        }
        this.lastPainTotal = this.accumulatingPain;
        this.updateBoneStates(onComplete, callbacks)

    }
    debugState = {
        currentTraversalIndex: 0,
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
      * @param solveUntil optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments
      * @param notifier a (potentially threaded) function to call every time the solver has updated the transforms for a given bone. 
      * Called once per solve, per bone. NOT once per iteration.
      * This can be used to take advantage of parallelism, so that you can update your Bone transforms while this is still writing into the skelState TransformState list
      */

    debug_solve(iterations, stabilizationPasses, solveUntil, onComplete, callbacks = null, ds = this.debugState) {
        ds.completedSolve = false; ds.completedIteration=false;
        if (ds.currentStep == 0) {
            this.alignSimAxesToBoneStates();
        }
        const endOnIndex = ds.endOnIndex == null ? this.getEndOnIndex(solveUntil) : ds.endOnIndex;
        ds.endOnIndex = endOnIndex;
        this.updateReturnfulnessDamps(iterations);

        this.accumulatingPain = ds.accumulatingPain;
        this.maxPain = ds.maxPain;
        this.debug_iteration_solveToTargets(stabilizationPasses, endOnIndex, onComplete, callbacks, ds);
        if (ds.completedIteration && ds.currentIteration == iterations - 1) {
            ds.completedSolve = true;
        }
    }

    /**
       * @param stabilizationPasses set to 0 for maximum speed (but less stability given unreachable situations), 
       * Set to 1 for maximum stability while following constraints. 
       * Set to higher than 1 for negligible benefit at considerable cost. 
       * Set to -1 to indicate constraints can be broken on the last iteration of a solver call
       * @param solveUntil optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments
       * @param notifier a (potentially threaded) function to call every time the solver has updated the transforms for a given bone. 
       * Called once per solve, per bone. NOT once per iteration.
       * This can be used to take advantage of parallelism, so that you can update your Bone transforms while this is still writing into the skelState TransformState list
       */
    debug_iteration_solveToTargets(stabilizationPasses, endOnIndex, onComplete, callbacks, ds = this.debugState) {
        ds.completedSolve = false;
        if (this.traversalArray?.length == 0) return;
        const wb = this.traversalArray[ds.currentTraversalIndex];

        let translate = endOnIndex === this.traversalArray.length - 1;
        let skipConstraints = stabilizationPasses < 0;
        stabilizationPasses = Math.max(0, stabilizationPasses);
        if (translate && ds.completedSolve) { //special case. translate and rotate the rootbone first to minimize deviation from innermost targets
            wb.fastUpdateOptimalRotationToPinnedDescendants(translate, true, ds.currentIteration);
        }

        if (ds.currentTraversalIndex <= endOnIndex) {
            this.debug_bone_solveToTargets(stabilizationPasses, false, endOnIndex, onComplete, callbacks, ds);
        } else {
            this.lastPainTotal = this.accumulatingPain;
        }

        this.updateBoneStates(onComplete, callbacks);
        this.stablePool.releaseTemp();
        this.volatilePool.releaseTemp();
    }

    debug_bone_solveToTargets(stabilizationPasses, translate, endOnIndex, onComplete, callbacks, ds = this.debugState) {
        const wb = this.traversalArray[ds.currentTraversalIndex];
        if (ds.steps[ds.currentStep] == 'pullback') {
            wb.pullBackTowardAllowableRegion(ds.currentIteration, callbacks);
            ds.currentStep++;
            return;
        } else if (ds.steps[ds.currentStep] == 'preTarget') {
            wb.updateDescendantsPain();
            wb.updateTargetHeadings(wb.chain.boneCenteredTargetHeadings, wb.chain.weights, wb.myWeights);
            wb.updateTipHeadings(wb.chain.boneCenteredTipHeadings, !translate);
            callbacks?.beforeIteration(wb);
            ds.currentStep++;
            return;
        } else if (ds.steps[ds.currentStep] == 'postTarget') {
            wb.fastUpdateOptimalRotationToPinnedDescendants(translate && ds.currentTraversalIndex == endOnIndex, false);
            wb.updateTargetHeadings(wb.chain.boneCenteredTargetHeadings, wb.chain.weights, wb.myWeights);
            wb.updateTipHeadings(wb.chain.boneCenteredTipHeadings, !translate);
            callbacks?.afterIteration(wb);
            ds.currentStep++;
            ds.willCompleteBone = true;
            return;
        } else if (ds.steps[ds.currentStep] == 'pain') {
            let bonepain = wb.getOwnPain();
            if (bonepain > ds.maxPain) {
                ds.maxPain = bonepain;
                ds.maxpainbone = wb.forBone;
            }
            ds.accumulatingPain += bonepain;
            ds.currentStep = 0;
            ds.currentTraversalIndex++;
            ds.willCompleteBone = false;
            if (ds.currentTraversalIndex == endOnIndex) {
                ds.willCompleteIteration = true;
                ds.currentIteration++;
            } else if (ds.willCompleteIteration) {
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
        if (ds.completedIteration) {
            if (ds.completedSolve) {
                ds.currentIteration = 0;
                ds.currentStep = 0;
                ds.currentTraversalIndex = 0;
            }
            ds.accumulatingPain = 0;
            ds.maxPain = 0;
            ds.maxpainbone = null;
        }

    }

    /**returns true if the provided bone is relevant to the IKSolver.
     * @param {Bone}
     * @return {boolean}
     */
    isSolvable(bone) {
        if(bone?.wb == null) return false;
        return this.boneWorkingBoneIndexMap.has(bone); 
    }
}