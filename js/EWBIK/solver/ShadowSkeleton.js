import { IKTransform } from "../EWBIK.js";
import { IKNode } from "../util/nodes/IKNodes.js";
import { Vec3Pool } from "../util/vecs.js";

export class ShadowSkeleton {
    /**@type {[ShadowNode]}*/
    targetList = []; //a list of all active targets everywhere on the armature
    commonAncestor = null; //the ShadowNode that everything being solved for has in common (for efficiency when solving otherwise shallow things deep in the node hierarchy)
    lastLiteral = false;
    debugState = null;
    effectorBuffers = null;
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
        this.effectorBuffers = parentArmature.effectorBuffers;
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
        this.debugState = new DebugState(this);
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
        //this.updateReturnfulnessDamps(iterations);

        if (this.traversalArray?.length == 0) return;
        let translate = endOnIndex === this.traversalArray.length - 1;
        
        //if(window.perfing) performance.mark("solveToTargetsp1 start");
        stabilizationPasses = Math.max(0, stabilizationPasses);
        
        for (let i = 0; i < iterations; i++) {
            this.pullBackAll(iterations, endOnIndex, callbacks, i);
            this.solveToTargets(stabilizationPasses, translate, endOnIndex, null, callbacks, i);
        }
        this.stablePool.releaseTemp();
        this.volatilePool.releaseTemp();

        //if(window.perfing) performance.mark("shadowSkelSolve end");
        //if(window.perfing) performance.measure("shadowSkelSolve", "shadowSkelSolve start", "shadowSkelSolve end");   
        this.updateBoneStates(onComplete, callbacks);
        this.debugState.solveCalls++;      
    }

    /*experimental*/
    notifyBoneStart(index, iteration) {
        const someDirty = IKTransform.allDirty & ~IKTransform.precompInverseDirty;
        /*if(iteration == 0) {
            let effectorlist = this.effectorBuffers.all_effectors;
            for(let i = 0; i<effectorlist.length; i++) {
                effectorlist[i].iteration_Start();
            }
        }*/
        for(let i=index; i>=0; i--) {
            let wb = this.traversalArray[i];
            let ax = wb.simLocalAxes;
            let loc = ax.localMBasis;
            let glob =ax.globalMBasis;
            let _parglob = ax.parent.globalMBasis;
            _parglob.scale.compMultInto(loc.translate, glob.translate);
            _parglob.rotation.applyAfter(loc.rotation, glob.rotation);
            _parglob.rotation.applyToVec(glob.translate, glob.translate);
            glob.translate.add(_parglob.translate);
            glob.rotation.invertInto(glob._inverseRotation);
            glob.state = someDirty;
            ax.dirty = false;

            _parglob = ax.globalMBasis;
            ax = wb.simBoneAxes;
            loc = ax.localMBasis;
            glob = ax.globalMBasis;
            _parglob.scale.compMultInto(loc.translate, glob.translate);
            _parglob.rotation.applyAfter(loc.rotation, glob.rotation);
            _parglob.rotation.applyToVec(glob.translate, glob.translate);
            glob.translate.add(_parglob.translate);
            glob.rotation.invertInto(glob._inverseRotation);
            glob.state = someDirty;
            ax.dirty = false;

            /*if(wb.simTipAxes !== null) {
                _parglob = ax.globalMBasis;
                ax = wb.simTipAxes;
                loc = ax.localMBasis;
                glob = ax.globalMBasis;
                _parglob.scale.compMultInto(loc.translate, glob.translate);
                _parglob.rotation.applyAfter(loc.rotation, glob.rotation);
                _parglob.rotation.applyToVec(glob.translate, glob.translate);
                glob.translate.add(_parglob.translate);
                glob.rotation.invertInto(glob._inverseRotation);
                glob.state = someDirty;
                ax.dirty = false;
            }*/
        }
        /*
        let effectorlist = this.effectorBuffers.all_effectors;
        for(let i = 0; i<effectorlist.length; i++) {
            effectorlist[i].iteration_Start();
        }*/
    }

    notifyIterationStart(endOnIndex, iteration) {
        const someDirty = IKTransform.allDirty & ~IKTransform.precompInverseDirty;
        if(iteration == 0) {
            let effectorlist = this.effectorBuffers.all_effectors;
            for(let i = 0; i<effectorlist.length; i++) {
                effectorlist[i].iteration_Start();
            }
        }
        for(let i=index; i>=0; i--) {
            let wb = this.traversalArray[i];
            let ax = wb.simLocalAxes;
            let loc = ax.localMBasis;
            let glob =ax.globalMBasis;
            let _parglob = ax.parent.globalMBasis;
            _parglob.scale.compMultInto(loc.translate, glob.translate);
            _parglob.rotation.applyAfter(loc.rotation, glob.rotation);
            _parglob.rotation.applyToVec(glob.translate, glob.translate);
            glob.translate.add(_parglob.translate);
            glob.rotation.invertInto(glob._inverseRotation);
            glob.state = someDirty;
            ax.dirty = false;

            _parglob = ax.globalMBasis;
            ax = wb.simBoneAxes;
            loc = ax.localMBasis;
            glob = ax.globalMBasis;
            _parglob.scale.compMultInto(loc.translate, glob.translate);
            _parglob.rotation.applyAfter(loc.rotation, glob.rotation);
            _parglob.rotation.applyToVec(glob.translate, glob.translate);
            glob.translate.add(_parglob.translate);
            glob.rotation.invertInto(glob._inverseRotation);
            glob.state = someDirty;
            ax.dirty = false;

            if(wb.simTipAxes !== null) {
                _parglob = ax.globalMBasis;
                ax = wb.simTipAxes;
                loc = ax.localMBasis;
                glob = ax.globalMBasis;
                _parglob.scale.compMultInto(loc.translate, glob.translate);
                _parglob.rotation.applyAfter(loc.rotation, glob.rotation);
                _parglob.rotation.applyToVec(glob.translate, glob.translate);
                glob.translate.add(_parglob.translate);
                glob.rotation.invertInto(glob._inverseRotation);
                glob.state = someDirty;
                ax.dirty = false;
            }
        }
        /*
        let effectorlist = this.effectorBuffers.all_effectors;
        for(let i = 0; i<effectorlist.length; i++) {
            effectorlist[i].iteration_Start();
        }*/
    }

    pullBackAll(iterations, endOnIndex, callbacks = null, currentIteration) {
        if (this.traversalArray?.length == 0) return;
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
        
        /**TODO: remove after profiling */
        /*let all_effectors = this.effectorBuffers.all_effectors;
        for(let i =0; i < all_effectors.length; i++) {
            all_effectors[i].tipAxes.updateGlobal();
            all_effectors[i].targetAxes.updateGlobal();
        }*/
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
    solveToTargets(stabilizationPasses, doTranslate, endOnIndex, onComplete, callbacks, currentIteration) {
        let skipConstraints = stabilizationPasses < 0;
        if (doTranslate) { //special case. translate and rotate the rootbone first to minimize deviation from innermost targets
            this.traversalArray[endOnIndex].fastUpdateOptimalRotationToPinnedDescendants(doTranslate, true, currentIteration);
        }
        //if(window.perfing) performance.mark("solveToTargetsp1 end");
        //if(window.perfing) performance.measure("solveToTargetsp1", "solveToTargetsp1 start", "solveToTargetsp1 end");  
        this.accumulatingPain = 0;
        this.maxPain = 0;
        //if(window.perfing) performance.mark("solveToTargetsp2 start");
        for (let j = 0; j <= endOnIndex; j++) {
            const wb = this.traversalArray[j];
            //this.notifyBoneStart(j, currentIteration);
            //callbacks?.beforeIteration(wb.forBone, wb.forBone.getFrameTransform(), wb);
            //wb.pullBackTowardAllowableRegion(currentIteration, callbacks);
            wb.fastUpdateOptimalRotationToPinnedDescendants(doTranslate && j === endOnIndex, skipConstraints, currentIteration);
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
                        const root = wb.getRootSegment();
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
            b.simBoneAxes.quickMimic();
            b.simLocalAxes.quickMimic();
            if(b.simTipAxes != null) b.simTipAxes.quickMimic();
        }
        /*for (let i = 0; i < this.constrainedBoneArray.length; i++) {
            this.constrainedBoneArray[i].mimicDesiredAxes(); //make sure any bones with constraints have reliable data
        }*/
    }

    updateBoneStates(onComplete, callbacks) {
        this.commonAncestor.quickMimic();
        if(onComplete != null) {
            for (let i = 0; i < this.traversalArray.length; i++) {
                onComplete(this.traversalArray[i]);
            }
        }
        if(callbacks != null) {
            for (let i = 0; i < this.traversalArray.length; i++) {
                callbacks.afterSolve(this.traversalArray[i]);
            }
        }
        /**I'm just trying to squeeze out every last bit of performance I can, okay?
         * I don't come into *your* codebase and get all judgy with you, do I?
        */
        if(callbacks != null && onComplete != null) {
            for (let i = 0; i < this.traversalArray.length; i++) {
                callbacks.afterSolve(this.traversalArray[i]);
                onComplete(this.traversalArray[i]);
            }
        }
        
    }

    buildArmaturSegmentHierarchy() {
        const rootBone = this.parentArmature.rootBone;
        if (!rootBone) return;

        this.effectorBuffers = this.parentArmature.effectorBuffers
        this.rootSegment = this.effectorBuffers.initEffectors(this);
        this.buildTraversalArray();
    }

    buildTraversalArray() {
        if (!this.rootSegment) return;

        this.boneWorkingBoneIndexMap.clear();
        this.constrainedBoneArray = [];

        this.traversalArray = this.effectorBuffers.traversalArray;

        for(let i=0; i<this.traversalArray.length; i++) { 
            let wb = this.traversalArray[i];
            this.boneWorkingBoneIndexMap.set(wb.forBone, i);
            if(wb.constraint != null) {
                this.constrainedBoneArray.push(wb);
            }
        }

        this.targetList = []

        for(let e of this.effectorBuffers.all_effectors) {
            this.targetList.push(e.targetAxes);
        }
        let forCommon = [this.armatureRootNode, ...this.targetList];
        this.commonAncestor = IKNode.getCommonAncestor(forCommon);
        //this.traversalArray = new Array(reversedTraversalArray.length);
        
        this.lastRequested = null;
        this.lastRequestedEndIndex = this.traversalArray.length - 1;
    }

    setDampening(dampening, defaultIterations) {
        this.baseDampening = dampening;
        this.updateRates(defaultIterations);
    }

    updateRates(iterations) {
        /*if (this.rootSegment == null) {
            console.error("No root segment");
            return;
            //throw Error("No rootsegment");
        }*/
        for(let e of this.effectorBuffers.all_effectors) {
            let mismatch = e.updateInfluenceOpacityList();
            if(mismatch) throw new Error("Unexpected structure when updating pin weights. Call to regenerateShadowSkeleton required");
        }
        for (let j = 0; j < this.traversalArray.length; j++) {
            this.traversalArray[j].updateCosDampening();
            this.traversalArray[j].updateReturnfullnessDamp(iterations);
        }
        this.previousIterationRequest = iterations;
    }


    /**doesn't solve for anything, just updates the pain info of each bone for debugging*/
    debug_noOp(fromBone, iterations, onComplete, callbacks = null, ds) {
        ds.incrIteration_start(iterations);
        this.alignSimAxesToBoneStates();
        //this.pullBack(iterations, solveUntil, false, null);
        const endOnIndex = this.getEndOnIndex();
        ds.endOnIndex = endOnIndex;
        this.updateReturnfulnessDamps(iterations);
        this.accumulatingPain = 0;
        this.maxPain = 0;
        for (let j = 0; j <= endOnIndex; j++) {
            ds.currentTraversalIndex = j;
            ds.incrBone_start(iterations);
            this.traversalArray[j].updatePain(0);
            let bonepain = this.traversalArray[j].getOwnPain();
            if (bonepain > this.maxPain) {
                this.maxPain = bonepain;
                this.maxpainbone = this.traversalArray[j].forBone;
            }
            this.accumulatingPain += bonepain;
            ds.incrBone_start(iterations);
        }
        this.lastPainTotal = this.accumulatingPain;
        ds.incrIteration_end(iterations);
        this.updateBoneStates(onComplete, callbacks)
    }
    debugState = new DebugState(this);




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
        if (ds._currentStep == 0) {
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
        if (translate && ds.completedIteration) { //special case. translate and rotate the rootbone first to minimize deviation from innermost targets
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
        ds.incrStep_start();
        const wb = this.traversalArray[ds.currentTraversalIndex];
        if (ds.steps[ds.currentStep] == 'pullback') {
            wb.pullBackTowardAllowableRegion(ds.currentIteration, callbacks);
            ds.incrStep_end();
            return;
        } else if (ds.steps[ds.currentStep] == 'preTarget') {
            wb.updateDescendantsPain();
            wb.updateTargetHeadings(wb.chain.boneCenteredTargetHeadings, wb.chain.weights, wb.myWeights);
            wb.updateTipHeadings(wb.chain.boneCenteredTipHeadings, !translate);
            callbacks?.beforeIteration(wb);
            ds.incrStep_end();
            return;
        } else if (ds.steps[ds.currentStep] == 'postTarget') {
            wb.fastUpdateOptimalRotationToPinnedDescendants(translate && ds.currentTraversalIndex == endOnIndex, false, ds.currentIteration);
            wb.updateTargetHeadings(wb.chain.boneCenteredTargetHeadings, wb.chain.weights, wb.myWeights);
            wb.updateTipHeadings(wb.chain.boneCenteredTipHeadings, !translate);
            callbacks?.afterIteration(wb);
            ds.incrStep_end();
            return;
        } else if (ds.steps[ds.currentStep] == 'pain') {
            let bonepain = wb.getOwnPain();
            if (bonepain > ds.maxPain) {
                ds.maxPain = bonepain;
                ds.maxpainbone = wb.forBone;
            }
            ds.accumulatingPain += bonepain;
            ds.currentStep = 0;
            ds.incrStep_end();
            return;
        }
    }

    incrStep(iterations) {
        let ds = this.debugState;
        

    }

    /**returns true if the provided bone is relevant to the IKSolver.
     * @param {Bone}
     * @return {boolean}
     */
    isSolvable(bone) {
        if(bone?.wb == null) return false;
        return this.boneWorkingBoneIndexMap.has(bone); 
    }


    /**prints the traversal array for this skeleton to the console, as well as the values of any solvable working bones in the array at the time this is called.
     * 
     * Note, the list is prented in reverse order, as this allows for printing a single root
     *  
     * @param {Bone | WorkingBone} markActive keeps this node expanded by default
    */
    toConsole(markActive = null) {
        markActive = markActive instanceof Bone ? markActive.wb : markActive;
        let prevB = null;
        let prevGroupName = "effectorGroups";
        let lastGroup = null;

        for(let i = 0; i<this.traversalArray.length; i++) {
            let b = this.traversalArray[i];
            let groupName = b.forBone.name;
            if(b.effectorList != lastGroup) {
                console.group(groupName); 
            }
            else {
                console.log(b.forBone.name);
            }
            if(prevGroupName != groupName) {
                console.groupEnd(prevGroupName);
            }
            prevB = b;
            prevGroupName = groupName;
            lastGroup = b.effectorList;
        }
    }
}


export class DebugState {
        shadowSkel = null;
        currentTraversalIndex = 0;
        currentIteration= 0;
        currentStep= 0;
        endOnIndex= null;
        accumulatingPain = 0;
        maxPain = 0;
        _solveCalls = 0;
        steps = [
            'pullback',
            'preTarget',
            'postTarget',
            'pain',
        ]

        constructor(shadowSkel) {this.shadowSkel = shadowSkel;}
        get solveCalls(){return this._solveCalls;}
        set solveCalls(val) {
            this._solveCalls = val;
            if(this.shadowSkel.parentArmature.recordHeadings && this.shadowSkel.parentArmature.recordSteps == this._solveCalls) {
                this.shadowSkel.parentArmature.recorderPool.finalize();
            }
        };

    reset() {
        this.currentIteration = -1;
        this.currentStep = -1; 
        this.currentTraversalIndex = -1;
        this.currentSolveCall = -1;
        this.solveCalls = -1;
    }
        
    get step() {
        return this.steps[this._currentStep];
    }

    incrBone_start(totalIterationsPerSolve=this.shadowSkel.parentArmature.defaultIterations) {
        this.completedBone = false;
        this.currentTraversalIndex++;
        
    }

    incrBone_end(totalIterationsPerSolve=this.shadowSkel.parentArmature.defaultIterations) {
        this.willCompleteBone = false;
        this.completedBone = true;
        if(this.willCompleteIteration) {
            this.incrIteration_end(totalIterationsPerSolve);           
        } 
    }

    incrStep_start(totalIterationsPerSolve=this.shadowSkel.parentArmature.defaultIterations){
        this._currentStep++;
        if(this.completedBone || this._currentStep == 0) {
            this.incrBone_start(totalIterationsPerSolve);
        }
        if(this._currentStep == this.steps.length-1) {
            this.willCompleteBone = true;
            this.currentTraversalIndex++;
            if (this.currentTraversalIndex == this.endOnIndex) {
                this.incrIteration_start(totalIterationsPerSolve);
            }
        }
    }

    incrStep_end(totalIterationsPerSolve=this.shadowSkel.parentArmature.defaultIterations) {
        if(this.willCompleteBone) {
            this._currentStep = -1;
            if(this.willCompleteBone) {
                this.incrBone_end(totalIterationsPerSolve);
            }                  
        }        
    }

    
    
    incrIteration_start(totalIterationsPerSolve=this.shadowSkel.parentArmature.defaultIterations){
        this.willCompleteIteration = true;
        this.currentTraversalIndex = 0;
        this.currentIteration++;
        if (this.currentIteration == totalIterationsPerSolve) {
            this.incrSolve_start(totalIterationsPerSolve);
        }
    }


    incrIteration_end(totalIterationsPerSolve=this.shadowSkel.parentArmature.defaultIterations){               
        this.completedIteration = true;
        this.currentTraversalIndex = -1;
        this.accumulatingPain = 0;
        this.maxPain = 0;
        this.maxpainbone = null;
        
        this.willCompleteIteration = false;
        console.log('solve#: ' + this.completedSolveCalls + '\t:: itr :: ' + this.currentIteration);
        if(this.willCompleteSolve) {
            this.incrSolve_end(totalIterationsPerSolve);
        }
        
    }

    currentSolveCall = 0;
    completedSolveCalls = 0;
    incrSolve_start(totalIterationsPerSolve=this.shadowSkel.parentArmature.defaultIterations) {
        this.currentSolveCall++;
        this.willCompleteSolve = true;        
    }
    incrSolve_end(totalIterationsPerSolve=this.shadowSkel.parentArmature.defaultIterations) {
        this.currentIteration = -1;
        this.completedSolveCalls++;
        this.completedSolve = true;
        this.willCompleteSolve = false;
    }
}