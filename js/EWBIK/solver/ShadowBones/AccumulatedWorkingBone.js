import { Ray } from "../../util/Ray.js";
import { Rot } from "../../util/Rot.js";
import { IKPin } from "../../betterbones/IKpin.js";
import { ShadowNode } from "../../util/nodes/ShadowNode.js";
import { IKNode } from "../../EWBIK.js";
import { WorkingBone } from "./WorkingBone.js";

export class AccumulatedWorkingBone extends WorkingBone{
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
    

    /**@type {Rot} stores the local space rotation component of the bone at the start of the last optimization step*/
    _r_unopt_locstart = null; 
    /**@type {Rot} stores the local space rotation component of the bone at the start of the last optimization step*/
    //_r_unopt_globstart = null; 
    /**@type {Rot} stores the accumulated local space rotations on the bone since the last optimization step */
    _r_local_accumulator =null;
    /**@type {Rot} stores the accumulated worldspace rotations on the bone since the last optimization step */
    _r_global_accumulator = null;
    
    
    /**@type {Vec3} stores the worldspace translation components of the bone at the start of the last optimization step*/
    //_t_unopt_globstart = null; 
    /**@type {Vec3} stores the local translation component of the bone at the start of the last optimization step*/
    _t_unopt_locstart = null; 
    /**@type {Vec3} stores the accumulated worldspace translations on the bone since the last optimization step*/
    _t_global_accumulator = null; 


    constructor(forBone, chain) {
        super(forBone, chain);

        this._r_unopt_locstart = Rot.IDENTITY.clone();
        this._r_local_accumulator = Rot.IDENTITY.clone();
        this._r_global_accumulator = Rot.IDENTITY.clone();

        this._t_unopt_locstart = this.pool.new_Vec3();
        this._t_global_accumulator = this.pool.new_Vec3();
    }

    preOpt() {
        this._r_local_accumulator.setComponents(1,0,0,0);
        this._r_global_accumulator.setComponents(1,0,0,0);
        //this._r_unopt_globstart.setComponents(this.simLocalAxes.getGlobalMBasis().rotation);
        this._r_unopt_locstart.setComponents(this.simLocalAxes.getGlobalMBasis().rotation);
    }


    fastUpdateOptimalRotationToPinnedDescendants(translate, skipConstraints, currentIteration) {
        if (currentIteration < this.kickInStep) return;
        
        this.preOpt();
        let length = this.updateTargetHeadings(!translate);
        this.updateTipHeadings(!translate);
        if (!translate) //this conditional accounts for the special case where we solve the rootbone first
            this.simLocalAxes.exclusivelyMarkChildrenDirty(); 
        
        this.updateOptimalRotationToPinnedDescendants(translate, skipConstraints, length);
        if(this.springy && !skipConstraints) {
            this.constraint?.markDirty();
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

        //the parent worldspace transform should already be updated at this point in the procedure so it should be safe to get its globalMBasis directly for a tiny perf boost
        //less safe however might be the fact that this is using a rawLocalOfRotation, which doesn't normalize anything. 
        let localDesiredRotby = this.simLocalAxes.getParentAxes().globalMBasis.getRawLocalOfRotation(desiredRotation, this.chain.tempRot);
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

    
    /**applies the computed rotations onto this bone*/
    accumulate() {
        
    }

    updateTargetHeadings(scale) {
        let writeIdx = 0;
        let descendantsPain = this.updateDescendantPain();
        for(let i=0; i<this.effectorList.length;i++) {
            //this.effectorList[i].optimStep_Start(this, this.effectorBoneIndex[i]);
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

     /**
     * updates the amount of pain the bone is currently in, and which way it would like to rotate to be in less pain
     * @param {Number} iteration current iteration
     * @param {Number} totalIterations total iterations intended by the solver
     * @param {Number} completionT iteration / totalIterations  (this is to avoid recomputing each time)
     */
    updatePain(iteration) {
        this.currentSoftPain = 0;
        if(!this.hasLimitingConstraint) {
            this.currentHardPain = 0;
            this.currentSoftPain = 0;
        }
        if (this.springy && iteration >= this.kickInStep) {
            //this.currentPain = this.getOwnPain();
            
            const res = this.constraint.getClampedPreferenceRotation(
                this.simLocalAxes, this.simBoneAxes, 
                iteration - this.kickInStep,
                this.kickInStep == 0 ? completionT : iteration / (totalIterations - this.kickInStep),
                this);
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
            this.updatePain(iteration);
            this.simLocalAxes.rotateByLocal(this.lastReturnfulResult.clampedRotation);
            this.constraint.markDirty();
        }
    }


    updateReturnfullnessDamp(iterations) {
        this.kickInStep = parseInt(iterations * (this.forBone.IKKickIn));
        this.kickInStep = Math.max(0, Math.min(iterations - 1, this.kickInStep));
        if (this.maybeSpringy()) {
            this.constraint.setPreferenceLeeway(this.totalDampening);
            this.constraint.setPerIterationLeewayCache(iterations - this.kickInStep);
            //determine maximum pullback that would still allow the solver to converge if applied once per pass
            if (this.constraint.giveup >= 1) {
                this.springy = true;
            }
        }
    }

    
}