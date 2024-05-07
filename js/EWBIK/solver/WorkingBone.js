import { Ray } from "../util/Ray.js";
import { Rot } from "../util/Rot.js";
import { IKPin } from "../betterbones/IKpin.js";
import { ShadowNode } from "../util/nodes/ShadowNode.js";
import { IKNode } from "../EWBIK.js";

export class WorkingBone {
    /**@type {IKPin}*/
    ikPin = null;
    simBoneAxes = null;
    simLocalAxes = null;
    simTipAxes = null;
    simTargetAxes = null;
    cosHalfDampen = 0;
    cosHalfReturnDamp = 0;
    kickInStep = 0;
    returnDamp = 0;
    totalDampening = 0;
    currentPain = 0;
    currentHardPain = 0; //pain from violating limiting constraints
    currentSoftPain = 0; //pain from distance from returnful constraints
    totalDescendantPain = 0;
    lastReturnfulResult = null;
    springy = false;
    parentBone = null;
    forBone = null;
    pool = null;
    modeCode = -1; //the modeCode for this bone's pin if it has one.
    maxModeCode = -1; //the largest modeCode that's been registered on this bone. This is used internally to avoid expensive regenerations of the shadowSkeleton, since it's usually cheaper to just ignore the irrelevant headings
    
    /** @type {(Limiting | Returnful | LimitingReturnful | ConstraintStack)}*/
    constraint = null;
    myWeights = []; //personal copy of the weights array per this bone;
    solvableChildren = [];
    hasLimitingConstraint = false;
    cyclicTargets = new Set();
    /*used a convenience to allow specifying that a terminal effector should be weighted differently than the rest of the segment.
    * Taken to its logical extreme every bone in the chain should be allowed to specify its own separate orientation weights, but this would be annoying and unintuitive to specify,
    so this seems like a reasonable middle ground to allow the user to quickly indicate that the very last bone should do its best to match target orientation, while the rest of the chain may do less than its best*/
    isTerminal = false;
    _acceptableRotBy = new Rot(1, 0, 0, 0);
    _comfortableRotBy = new Rot(1, 0, 0, 0);
    _tempRot = new Rot(1,0,0,0);

    effectorList = [];
    _tempEffectorList = [];
    effectorBoneIndex = [];
    effectorMap = new Map();

    
    _reachIterations = 0; //tracks the number of times this bone has tried to rotate toward its effectors (does not include the number of rotations trying to get comfortable)
    _lastPainUpdate = 0; //tracks the last time (in terms of reach iterations) that this bone has checked how much pain its in.
    

    constructor(forBone, chain) {
        /** @type {BoneState} */
        this.forBone = forBone;
        this.forBone.wb = this;   
        this.updateState(chain);
        this.simLocalAxes.forceOrthogonality(true);
        this.simBoneAxes.forceOrthogonality(true);
        this.simTipAxes?.forceOrthogonality(true);
        this.simTargetAxes?.forceOrthogonality(true);
    }


    updateState(chain) {
        /**@type {WorkingBone}*/
        this.parentBone = this.forBone.parent instanceof THREE.Bone ? this.forBone.parent : null;
        this.chain = chain;
        this.pool = this.forBone.parentArmature.stablePool ?? globalVecPool;
        this.volatilePool = this.forBone.parentArmature.volatilePool ?? globalVecPool;
        /** @type {ConstraintState} */
        this.constraint = this.forBone.getConstraint();
        this.hasLimitingConstraint = this.constraint?.isLimiting();
        this.segmentRoot = null;
        
        if (this.forBone.trackedBy == null) 
            this.forBone.trackedBy = (new ShadowNode(this.forBone, undefined, this.pool));
        if (this.forBone.getIKBoneOrientation().trackedBy == null) 
            this.forBone.getIKBoneOrientation().trackedBy = new ShadowNode(this.forBone.getIKBoneOrientation(), undefined, this.pool);

        /** @type {IKNode} */
        this.simLocalAxes = this.forBone.trackedBy;
        /** @type {IKNode} */
        this.simBoneAxes = this.forBone.getIKBoneOrientation().trackedBy;

        if (this.forBone.getIKPin()?.isEnabled()) {
            this.ikPin = this.forBone.getIKPin();
            this.simTipAxes = this.ikPin.getAffectoredOffset();
            this.simTargetAxes = this.ikPin.targetNode;
        } else {
            this.ikPin = null;
            this.simTipAxes = null;
            this.simTargetAxes = null;
        }
        this.updateCosDampening();
    }

    effectors_finalized = true;

    /**assigns the actual effectors and indices (as opposed to the temporary ones used for structural analysis)
     * 
     * Sorry yeah i know I need to clean it up.
    */
    assignEffectors(effectorList) {
        this.effectorList = effectorList;
        this.effectorBoneIndex = [];
        for(let e of effectorList) {
            this.effectorBoneIndex.push(e.wboneList.indexOf(this));
        }
        //this._tempEffectorList.splice(0, this._tempEffectorList.length-1);
    }

    clear_tempEffectorList() {
        this._tempEffectorList = [];
        this.effectorList = [];
        this.effectorBoneIndex = [];
        
        this.effectorMap.clear();
        this.effectors_finalized = false;
    }

    register_tempEffector(effectorReference, boneIdx) {
        if(boneIdx == -1) 
            this.effectorMap.delete(effectorReference);
        else
            this.effectorMap.set(effectorReference, boneIdx);
    }

    finalize_tempEffectors() {
        for(let [effector, idx] of this.effectorMap) {
            this._tempEffectorList.push(effector);
        }
        this.effectors_finalized = true;
    }

    /**reports how much pain its in to its parent bone */
    lament() {
        const par = this.parentBone;
        par.totalReports++;
        par.totalChildPain += this.getOwnPain();
        //par.
    }

    /*mimicDesiredAxes() {
        this.desiredState.adoptLocalValuesFromIKNode(this.simLocalAxes);
        this.desiredBoneOrientation.adoptLocalValuesFromIKNode(this.simLocalAxes);
        this.previousState.adoptLocalValuesFromIKNode(this.simLocalAxes);
        this.previousBoneOrientation.adoptLocalValuesFromIKNode(this.simLocalAxes);
    }*/
    updateCosDampening() {
        this.hasLimitingConstraint = this.constraint?.isLimiting();
        const stiffness = this.forBone.getStiffness();
        const defaultDampening = this.chain.getDampening();
        let stiffdampening = this.forBone.parent == null ? Math.PI : (1 - stiffness) * defaultDampening;
        let clampedKickinRate = 1 - Math.max(Math.min(0.99, this.forBone.IKKickIn), 0);
        this.totalDampening = stiffdampening / clampedKickinRate;
        this.cosHalfDampen = Math.cos(Math.min(this.totalDampening / 2, 2 * Math.PI));
    }


    updateSolvableChildren() {
        this.solvableChildren = this.solvableChildren.splice(0, this.solvableChildren.length-1);
        for(let b of this.forBone.children) {
            if(b instanceof THREE.Bone) {
                if(b?.wb?.effectorList?.length > 0 || b?.wb?._tempEffectorList?.length > 0)
                    this.solvableChildren.push(b.wb);
            }
        }
    }

    setAsSegmentRoot(wb) {
         /*segment roots are reset to null on shadowskel regeneration, 
            and then repopulated again from ArmatureEffectors, which does the repopulation starting from the tips and moving rootward.
            So basically this means we propogate the root segment to any descendants which haven't had it
            set already earlier in the procedure*/
        if(this.segmentRoot == null) {
            if(wb == this)  {
                this.isSegmentRoot = true;
            } 
            this.segmentRoot = wb; 
            for(let c of this.solvableChildren) {
                c.setAsSegmentRoot(wb);
            }
        }
        
    }

    getRootSegment() {
        return this.segmentRoot;
    }


    slowUpdateOptimalRotationToPinnedDescendants(stabilizePasses, translate, skipConstraint) {
        //if(window.perfing) performance.mark("slowUpdateOptimalRotationToPinnedDescendants start");
        if (this.cosHalfDampen == 1) {
            if (this.segmentRoot == this)
                this.chain.previousDeviation = Infinity;
        }
        
        this.updateTargetHeadings(this.chain.boneCenteredTargetHeadings, this.myWeights, this.painWeights);
        //const prevOrientation = Rot.fromRot(this.simLocalAxes.localMBasis.rotation);
        let gotCloser = true;
        for (let i = 0; i <= stabilizePasses; i++) {
            this.updateTipHeadings(this.chain.boneCenteredTipHeadings, !translate);
            this.updateOptimalRotationToPinnedDescendants(translate, skipConstraint, this.chain.boneCenteredTipHeadings, this.chain.boneCenteredTargetHeadings, this.painWeights);
            if (stabilizePasses > 0) {
                this.updateTipHeadings(this.chain.uniform_boneCenteredTipHeadings, !translate);
                const currentmsd = this.chain.getManualMSD(this.chain.uniform_boneCenteredTipHeadings, this.chain.boneCenteredTargetHeadings, this.painWeights);
                if (currentmsd <= this.chain.previousDeviation * 1.000001) {
                    this.chain.previousDeviation = currentmsd;
                    gotCloser = true;
                    break;
                } else gotCloser = false;
            }
        }
        if (!gotCloser) {
            this.simLocalAxes.setLocalOrientationTo(prevOrientation);
        }

        //We've finished with this chain for this iteration, so next time we try to get deviation we start fresh
        if (this.segmentRoot == this)
            this.chain.previousDeviation = Infinity;

        //if(window.perfing) performance.mark("slowUpdateOptimalRotationToPinnedDescendants end");
        //if(window.perfing) performance.measure("slowUpdateOptimalRotationToPinnedDescendants", "slowUpdateOptimalRotationToPinnedDescendants start", "slowUpdateOptimalRotationToPinnedDescendants end");   
    }


    fastUpdateOptimalRotationToPinnedDescendants(translate, skipConstraints, currentIteration) {
        if (currentIteration < this.kickInStep) return;

        let length = this.updateTargetHeadings(!translate);
        this.updateTipHeadings(!translate);
        this.maybeRecordHeadings(this.chain.targetHeadings, this.chain.tipHeadings, currentIteration, 0);
        this.updateOptimalRotationToPinnedDescendants(translate, skipConstraints, length);
        if(this.springy && !skipConstraints) {
            this.constraint?.markDirty();
        }

        if (this.forBone.parentArmature.recordHeadings) {
            this.updateTargetHeadings(!translate);
            this.updateTipHeadings(!translate);
            this.maybeRecordHeadings(this.chain.targetHeadings, this.chain.tipHeadings, currentIteration, 1);
        }
    }

    /**returns the rotation that was applied (in local space), but does indeed apply it*/
    updateOptimalRotationToPinnedDescendants(translate, skipConstraints, length) {
        let desiredRotation = this.chain.qcpConverger.weightedSuperpose(this.chain.tipHeadings, this.chain.targetHeadings, this.chain.weightArray, length, translate);
        const translateBy = this.chain.qcpConverger.getTranslation();
        const boneDamp = this.cosHalfDampen;
        //if (!translate) {
            desiredRotation.clampToCosHalfAngle(boneDamp);
        //}
        let localDesiredRotby = this.simLocalAxes.getParentAxes().getGlobalMBasis().getLocalOfRotation(desiredRotation, this.chain.tempRot);
        //let reglobalizedRot = desiredRotation;
        if(!skipConstraints) {
            if (this.hasLimitingConstraint) {
                let rotBy = this.constraint.getAcceptableRotation(this.simLocalAxes, this.simBoneAxes, localDesiredRotby, this._acceptableRotBy);
                this.currentHardPain = 1;
                if(Math.abs(rotBy.applyConjugateToRot(localDesiredRotby, this._tempRot).w) > 1e-6) {
                    this.currentHardPain = 1; //violating a hard constraint should be maximally painful.
                }
                this.simLocalAxes.rotateByLocal(rotBy);
            } else {
                if (translate) {
                    this.simLocalAxes.translateByGlobal(translateBy);
                }
                this.simLocalAxes.rotateByLocal(localDesiredRotby);
            }
        }
        
        return localDesiredRotby;
    }

    updateTargetHeadings(scale) {
        let writeIdx = 0;
        let descendantsPain = this.updateDescendantPain();
        for(let i=0; i<this.effectorList.length;i++) {
            let writtenCount = this.effectorList[i].updateTargetHeadings(
                writeIdx, 
                this.chain.targetHeadings,
                this.chain.weightArray,
                descendantsPain,
                this.effectorList.length,
                this.effectorBoneIndex[i],
                this,
                scale
            )
            writeIdx += writtenCount;
        }
        return writeIdx;
    }

    updateTipHeadings(scale) {
        let writeIdx = 0;
        for(let i=0; i<this.effectorList.length;i++) {
            let writtenCount = this.effectorList[i].updateTipHeadings(
                writeIdx, 
                this.chain.tipHeadings, 
                this.effectorBoneIndex[i],
                this,
                scale
            )
            writeIdx += writtenCount;
        }
        return writeIdx;
    }

    
    /**@return the amount of pain this bone itself is experiencing */
    getOwnPain() {
        this.currentSoftPain = this.lastReturnfulResult?.preCallDiscomfort;
        this.currentSoftPain = isNaN(this.currentSoftPain) ? 0 : this.currentSoftPain;
        return Math.max(this.currentHardPain, this.currentSoftPain);
    }

    /**
     * @return the total pain all solved descandants of this bone are in 
     */
    updateDescendantPain() {
        this.totalDescendantPain = 0;
        for(let cb of this.solvableChildren) {
            this.totalDescendantPain += cb.currentPain + cb.totalDescendantPain;
        }
        return this.totalDescendantPain;
    }

    updatePain(iteration) {
        this.currentSoftPain = 0;
        if(!this.hasLimitingConstraint) {
            this.currentHardPain = 0;
            this.currentSoftPain = 0;
        }
        if (this.springy && iteration >= this.kickInStep) {
            //this.currentPain = this.getOwnPain();
            
            const res = this.constraint.getClampedPreferenceRotation(this.simLocalAxes, this.simBoneAxes, iteration - this.kickInStep, this);
            this.currentSoftPain = this.lastReturnfulResult?.preCallDiscomfort;
            this.currentSoftPain = isNaN(this.currentSoftPain) ? 0 : this.currentSoftPain;
            this.chain.previousDeviation = Infinity;
            this.lastReturnfulResult = res;
        }
        this.currentPain = Math.max(this.currentHardPain, this.currentSoftPain);
        this._lastPainUpdate = this._reachIterations;
    }

    pullBackTowardAllowableRegion(iteration, callbacks) {
        if (this.springy && iteration >= this.kickInStep) {
            //this.constraint.markDirty();
            //callbacks?.beforePullback(this.forBone.directRef, this.forBone.getFrameTransform(), this);
            //const res = this.constraint.getClampedPreferenceRotation(this.simLocalAxes, this.simBoneAxes, iteration - this.kickInStep, this);
            this.updatePain(iteration); //this function already calls getClampedPreferenceRotation
            this.simLocalAxes.rotateByLocal(this.lastReturnfulResult.clampedRotation);
            this.constraint.markDirty(); //the constraint state isn't correct anymore because we just rotated.
            //callbacks?.afterPullback(this.forBone.directRef, this.forBone.getFrameTransform(), this);
        }
    }


    updateReturnfullnessDamp(iterations) {
        //if(window.perfing) performance.mark("updateReturnfullnessDamp start");
        this.kickInStep = parseInt(iterations * (this.forBone.IKKickIn));
        this.kickInStep = Math.max(0, Math.min(iterations - 1, this.kickInStep));
        if (this.maybeSpringy()) {
            this.constraint.setPreferenceLeeway(this.totalDampening);
            this.constraint.setPerIterationLeewayCache(iterations - this.kickInStep);
            /**
             * determine maximum pullback that would still allow the solver to converge if applied once per pass
             */
            if (this.constraint.giveup >= 1) {
                this.springy = true;
            }
        }
        //if(window.perfing) performance.mark("updateReturnfullnessDamp end");
        //if(window.perfing) performance.measure("updateReturnfullnessDamp", "updateReturnfullnessDamp start", "updateReturnfullnessDamp end"); 
    }


    maybeSpringy() {
        this.hasLimitingConstraint = this.constraint?.isLimiting();
        return (this.constraint?.isReturnful());
    }

    applyRotToVecArray(rot, vecArr, storeIn = []) {
        for (let i = 0; i < vecArr.length; i++) {
            storeIn[i] = rot.applyToVec(vecArr[i], vecArr[i]);
        }
        return storeIn;
    }

    toConsole(showCurrentHeadings) {
        console.groupCollapsed('current state');


        console.groupCollapsed('targets');
        for (let p of this.chain.pinnedBones) {
            p.simTargetAxes.toConsole();
        }
        console.groupEnd('targets');
        console.groupCollapsed('tips');
        for (let p of this.chain.pinnedBones) {
            p.simTipAxes.toConsole();
        }
        console.groupEnd('tips');

        console.groupCollapsed('simLocal');
        this.simLocalAxes.toConsole();
        console.groupEnd('simLocal');

        console.groupCollapsed('simBone');
        this.simBoneAxes.toConsole();
        console.groupEnd('simBone');

        console.groupCollapsed('my weights');
        console.log(this.myWeights);
        console.groupEnd('my weights');
        console.groupEnd('current state');
        if (this.forBone.parentArmature.recordHeadings) {
            console.groupCollapsed('historical');
            let solvesRecorded = this.forBone.parentArmature.recordSteps;
            let solveIdx = (this.chain.shadowSkel.debugState.solveCalls - solvesRecorded) % solvesRecorded;
            for (let s = 0; s < solvesRecorded; s++) {
                let frameidx = (s + solveIdx) % solvesRecorded;
                console.groupCollapsed('frame ' + s + ' (idx: ' + frameidx + '), (' + (this.chain.shadowSkel.debugState.solveCalls - (solvesRecorded + s)) + ')');
                let strg = this.rec_TargetHeadings[frameidx];
                for (let i = 0; i < strg.length; i++) {
                    console.groupCollapsed(i + 'iteration');
                    let steps = strg[i];
                    for (let subidx = 0; subidx < steps.length; subidx++) {
                        console.groupCollapsed(subidx + ' substep');
                        let targHeads = this.rec_TargetHeadings[s][i][subidx];
                        let tipHeads = this.rec_TargetHeadings[s][i][subidx];
                        console.groupCollapsed(`target headings`);
                        for (let v of targHeads) v.toConsole();
                        console.groupEnd('target headings');
                        console.groupCollapsed('tip headings');
                        for (let v of tipHeads) v.toConsole();
                        console.groupEnd('tip headings');

                        console.groupEnd(subidx + ' substep');
                    }
                    console.groupEnd(i + 'iteration');
                }
                console.groupEnd('frame ' + s + ' (idx: ' + frameidx + '), (' + (this.chain.shadowSkel.debugState.solveCalls - (solvesRecorded + s)) + ')');
            }

            console.groupEnd('historical');
        }
    }

    //debug function
    applyCompare(rot, arr1, arr2) {
        console.log("pre-rotation");
        this.compareAngDist(arr1, arr2);
        let clr = this.applyRotToVecArray(rot, arr1);
        this.compareAngDist(clr, arr2);
        console.log("post-rotation");
    }

    compareAngDist(vecArr1, vecArr2) {
        for (let i = 0; i < vecArr1.length; i++) {
            this._tempRot.setFromVecs(vecArr1[i], vecArr2[i]).toConsole();
        }
    }

    /**for debugging */
    maybeRecordHeadings(targetHeadings, tipHeadings, iteration, subStep) {
        if (this.forBone.parentArmature.recordHeadings) {
            let recorderPool = this.forBone.parentArmature.recorderPool;
            let revolvingIdx = this.chain.shadowSkel.debugState.solveCalls % this.forBone.parentArmature.recordSteps;

            if (this.rec_TargetHeadings == null) this.rec_TargetHeadings = [];
            while (this.rec_TargetHeadings.length <= revolvingIdx) this.rec_TargetHeadings.push([]);
            let solvecall_targetHeadings = this.rec_TargetHeadings[revolvingIdx];
            while (solvecall_targetHeadings.length <= iteration) solvecall_targetHeadings.push([]);
            let itrTargs = solvecall_targetHeadings[iteration];
            while (itrTargs.length <= subStep) itrTargs.push([]);
            let rec_targs = itrTargs[subStep];
            for (let i = 0; i < targetHeadings.length; i++) {
                if (rec_targs[i] == null) rec_targs[i] = recorderPool.new_Vec3();
                rec_targs[i].set(targetHeadings[i]);
            }

            if (this.rec_TipHeadings == null) this.rec_TipHeadings = [];
            while (this.rec_TipHeadings.length <= revolvingIdx) this.rec_TipHeadings.push([]);
            let solvecall_tipHeadings = this.rec_TipHeadings[revolvingIdx];
            while (solvecall_tipHeadings.length <= iteration) solvecall_tipHeadings.push([]);
            let itrTips = solvecall_tipHeadings[iteration];
            while (itrTips.length <= subStep) itrTips.push([]);
            let rec_tips = itrTips[subStep];
            for (let i = 0; i < tipHeadings.length; i++) {
                if (rec_tips[i] == null) rec_tips[i] = recorderPool.new_Vec3();
                rec_tips[i].set(tipHeadings[i]);
            }
        }
    }
}