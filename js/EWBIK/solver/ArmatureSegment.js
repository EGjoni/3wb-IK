
import { Vec3 } from "../util/vecs.js";
import { Ray } from "../util/Ray.js";
import {Rot} from "../util/Rot.js";
import {QCP} from "../util/QCP.js";
import { TargetState, ConstraintState, TransformState, BoneState } from "./SkeletonState.js";
import { Rest } from "../betterbones/Constraints/Rest/Rest.js";
import { Limiting, LimitingReturnful, Returnful } from "../betterbones/Constraints/Constraint.js";
import { IKNode } from "../util/IKNodes.js";

export class ArmatureSegment {
    boneCenteredTargetHeadings = [];
    boneCenteredTipHeadings = [];
    uniform_boneCenteredTipHeadings = [];
    /**@type {[ArmatureSegment]} All descendant chains of this chain which are not split by an end-effector. (but does include chains which are split by an intermediary effector)*/
    subSegments = [];
    /**@type {[ArmatureSegment]} All immediate child chains of chain. Regardless of what caused the split*/
    immediateSubSegments = [];
    /**@type {[ArmatureSegment]} Only descendant segments that this chain can't see the effectors of*/
    childSegments = [];

    constructor(shadowSkel, startingFrom, parentSegment, hasPinnedAncestor, pool = noPool) {
        this.pool = pool;
        this.shadowSkel = shadowSkel;
        this.simTransforms = shadowSkel.simTransforms;
        this.previousDeviation = Infinity;
        this.parentSegment = parentSegment;
        this.hasPinnedAncestor = hasPinnedAncestor; 
        this.qcpConverger = new QCP(Number.EPSILON, Number.EPSILON);       
        this.rootSegment = this.hasPinnedAncestor || parentSegment == null ? this : this.parentSegment.rootSegment;
        this.hasPinnedAncestor = parentSegment != null && (parentSegment.hasPinnedAncestor || parentSegment.hasPinnedAncestor);
        this.buildSegment(startingFrom, parentSegment?.wb_segment_splitend);
        if (this.hasPinnedAncestor) this.wb_segmentRoot.setAsSegmentRoot();
    }

    init() {
        for (const s of this.subSegments) {
            s.init();
        }
        for (const s of this.childSegments) {
            s.init();
        }
        this.buildReverseTraversalArray();
        this.createHeadingArrays();
    }

    getDampening() {
        return this.shadowSkel.baseDampening;
    }

    buildSegment(startingFrom, parentBone) {
        const segEffectors = [];
        const strandBones = [];
        const subSgmts = [];
        const childSgmts = [];
        const immediateSubSgmts = [];
        let currentBS = startingFrom;
        let finished = false;
        while (!finished) {
            const currentWB = new WorkingBone(currentBS, parentBone, this);
            if (currentBS == startingFrom) this.wb_segmentRoot = currentWB;
            strandBones.push(currentWB);
            const target = currentBS.getTarget();
            const childCount = currentBS.getChildCount();
            if (target != null ||  childCount > 1) { //split condition
                if (target != null) 
                    segEffectors.push(currentWB);
                if (target?.getDepthFallOff() <= 0.0 || childCount == 0) {
                    finished = true;
                    this.wb_segmentTip = currentWB;
                    for (let i = 0; i < childCount; i++) 
                        childSgmts.push(new ArmatureSegment(this.shadowSkel, currentBS.getChild(i), this, true, this.pool));
                } else {
                    for (let i = 0; i < childCount; i++) {
                        this.wb_segment_splitend = currentWB;
                        const subseg = new ArmatureSegment(this.shadowSkel, currentBS.getChild(i), this, false, this.pool);
                        immediateSubSgmts.push(subseg);
                        subSgmts.push(subseg);
                        subSgmts.push(...subseg?.subSegments);
                        segEffectors.push(...subseg.pinnedBones);
                    }
                    finished = true;
                    this.wb_segmentTip = currentWB; //still mark as
                }
                
            } else if (childCount == 1) {
                currentBS = currentBS.getChild(0);
            } else {
                this.wb_segmentTip = currentWB;
                finished = true;
            }
            parentBone = currentWB;
        }
        this.subSegments = subSgmts;
        this.immediateSubSegments = immediateSubSgmts;
        this.pinnedBones = segEffectors;
        this.childSegments = childSgmts;
        this.solvableStrandBones = strandBones;
    }

    buildReverseTraversalArray() {
        const reverseTraversalArray = [];
        for (const wb of this.solvableStrandBones) {           
            reverseTraversalArray.push(wb);
        }

        for (const subsgmt of this.immediateSubSegments) {
            reverseTraversalArray.push(...subsgmt.reversedTraversalArray);
        }

        for (const childsgmt of this.childSegments) {
            reverseTraversalArray.push(...childsgmt.reversedTraversalArray);
        }

        

        this.reversedTraversalArray = reverseTraversalArray;
    }

    recursivelyCreateHeadingArrays() {
        this.createHeadingArrays();
        for (const s of this.subSegments) {
            s.recursivelyCreateHeadingArrays();
        }
        for (const s of this.childSegments) {
            s.recursivelyCreateHeadingArrays();
        }
        for(let i = (this.solvableStrandBones.length - 1) ; i>= 0; i--) {
            const wb = this.solvableStrandBones[i];
            wb.setPerPinDescendantCounts(this.pinnedBones);
            wb.myWeights = [...this.weights]
        }
    }

    createHeadingArrays() {
        const penaltyArray = [];
        const pinSequence = []; //TODO: remove after debugging
        this.recursivelyCreatePenaltyArray(penaltyArray, pinSequence, 1);
        let totalHeadings = 0;
        for (const a of penaltyArray) {
            totalHeadings += a.length;
        }
        let initVecs = false;
        let startAt = 0;
        let currentHeading = 0;
        if(this.boneCenteredTargetHeadings?.length <= totalHeadings) {
            startAt = this.boneCenteredTargetHeadings.length;
            initVecs = true;
        }
        this.weights = new Array(totalHeadings);
        
        for (const a of penaltyArray) {
            for (const ad of a) {
                this.weights[currentHeading] = ad;
                currentHeading++;
            }
        }

        if(initVecs) {
            for(let i = startAt; i < totalHeadings; i++) {
                this.boneCenteredTargetHeadings.push(this.pool.new_Vec3());
                this.boneCenteredTipHeadings.push(this.pool.new_Vec3());
                this.uniform_boneCenteredTipHeadings.push(this.pool.new_Vec3());
            }
        }

        while(totalHeadings < this.boneCenteredTargetHeadings.length) {
            this.boneCenteredTargetHeadings.pop().release();
            this.boneCenteredTipHeadings.pop().release();
            this.uniform_boneCenteredTipHeadings.pop().release();
        }
    }

    recursivelyCreatePenaltyArray(weightArray, pinSequence, currentFalloff) {
        if (currentFalloff == 0) {
            return;
        } else {
            const target = this.wb_segmentTip.targetState;
            if (target != null) {
                const innerWeightArray = [];
                weightArray.push(innerWeightArray);
                const targWeight = target.getWeight();
                const modeCode = target.getModeCode();
                if(targWeight > 0) { 
                    innerWeightArray.push(targWeight * currentFalloff);

                    if ((modeCode & TargetState.XDir) != 0) {
                        const subTargetWeight = targWeight * target.getPriority(TargetState.XDir) * currentFalloff;
                        innerWeightArray.push(subTargetWeight);
                        innerWeightArray.push(subTargetWeight);
                    }
                    if ((modeCode & TargetState.YDir) != 0) {
                        const subTargetWeight = targWeight * target.getPriority(TargetState.YDir) * currentFalloff;
                        innerWeightArray.push(subTargetWeight);
                        innerWeightArray.push(subTargetWeight);
                    }
                    if ((modeCode & TargetState.ZDir) != 0) {
                        const subTargetWeight = targWeight * target.getPriority(TargetState.ZDir) * currentFalloff;
                        innerWeightArray.push(subTargetWeight);
                        innerWeightArray.push(subTargetWeight);
                    }
                }
                pinSequence.push(this.wb_segmentTip);
            }
            const thisFalloff = target == null ? 1 : target.getDepthFallOff();
            for (const s of this.subSegments) {
                s.recursivelyCreatePenaltyArray(weightArray, pinSequence, currentFalloff * thisFalloff);
            }
        }
    }

    getDescendantSegments() {
        const result = [];
        result.push(this);
        for (const child of this.childSegments) {
            result.push(...child.getDescendantSegments());
        }
        return result;
    }

    getManualMSD(locTips, locTargets, weights) {
        let manualRMSD = 0;
        let wsum = 0;
        for (let i = 0; i < locTargets.length; i++) {
            const xd = locTargets[i].x - locTips[i].x;
            const yd = locTargets[i].y - locTips[i].y;
            const zd = locTargets[i].z - locTips[i].z;
            const magsq = weights[i] * (xd * xd + yd * yd + zd * zd);
            manualRMSD += magsq;
            wsum += weights[i];
        }
        manualRMSD /= wsum * wsum;
        return manualRMSD;
    }
}

class WorkingBone {
    cosHalfDampen = 0;
    cosHalfReturnDamp = 0;
    returnDamp = 0;
    stiffdampening = 0;
    currentHardPain = 0; //pain from violating limiting constraints
    currentSoftPain = 0; //pain from distance from returnful constraints
    lastReturnfulResult = null;
    springy = false;
    /** @type {(Limiting | Returnful | LimitingReturnful | ConstraintStack)}*/
    constraint = null;
    myWeights = [] //personal copy of the weights array per this bone;

    constructor(forBone, parentBone, chain) {
        /** @type {BoneState} */
        this.forBone = forBone;
        forBone.wb = this;
        forBone.directRef.wb = this;
        this.pool = chain?.pool ?? noPool;
        this.workingRay = new Ray(this.pool.new_Vec3(0,0,0), this.pool.new_Vec3(0,0,0), this.pool);
        /**@type {WorkingBone}*/
        this.parentBone = parentBone;
        /** @type {ConstraintState} */
        this.cnstrntstate = forBone.getConstraint();
        this.constraint = this.cnstrntstate?.directReference;
        /** @type {TransformState} */
        this.simLocalAxes = chain.simTransforms[forBone.getFrameTransform().getIndex()];
        this.simBoneAxes = chain.simTransforms[forBone.getOrientationTransform().getIndex()];
        /**@type {IKNode} */
        this.desiredState = this.simLocalAxes.attachedclone();
        this.desiredBoneOrientation = this.simBoneAxes.freeclone().setRelativeToParent(this.desiredState);
        this.previousState= this.simLocalAxes.attachedclone(); 
        this.previousBoneOrientation = this.simBoneAxes.freeclone().setRelativeToParent(this.desiredState);
        this.chain = chain;
        this.hasPinnedAncestor = this.chain.hasPinnedAncestor;

        /** @type {TransformState} */
        if(forBone.getTarget() != null) {
            this.targetState = forBone.getTarget();
            this.simTargetAxes = this.chain.simTransforms[forBone.getTarget().getTransform().getIndex()];
        }
        
        this.updateCosDampening();
    }

    /**reports how much pain its in to its parent bone */
    lament() {
        const par = this.parentBone;
        par.totalReports++; 
        par.totalChildPain += this.getOwnPain();
        //par.
    }

    mimicDesiredAxes() {
        this.desiredState.adoptLocalValuesFromIKNode(this.simLocalAxes); 
        this.desiredBoneOrientation.adoptLocalValuesFromIKNode(this.simLocalAxes);
        this.previousState.adoptLocalValuesFromIKNode(this.simLocalAxes); 
        this.previousBoneOrientation.adoptLocalValuesFromIKNode(this.simLocalAxes);
    }

    updateCosDampening() {
        const stiffness = this.forBone.getStiffness();
        const defaultDampening = this.chain.getDampening();
        this.stiffdampening = this.forBone.getParent() == null ? Math.PI : (1 - stiffness) * defaultDampening;
        this.cosHalfDampen = Math.cos(this.stiffdampening / 2);
    }

    setAsSegmentRoot() {
        this.isSegmentRoot = true;
    }

    getRootSegment() {
        return this.chain.rootSegment;
    }

    fastUpdateOptimalRotationToPinnedDescendants(stabilizePasses, translate, skipConstraint) {
        this.simLocalAxes.updateGlobal();
        this.previousState.adoptLocalValuesFromIKNode(this.simLocalAxes); 
        if(this.cosHalfDampen == 1) {
            if(this.chain.wb_segmentRoot == this) 
                this.chain.previousDeviation = Infinity;
            return;
        }
        this.updateDescendantsPain();
        this.updateTargetHeadings(this.chain.boneCenteredTargetHeadings, this.chain.weights, this.myWeights);
        const prevOrientation = Rot.fromRot(this.simLocalAxes.globalMBasis.rotation);
        let gotCloser = true;
        for (let i = 0; i <= stabilizePasses; i++) {
            this.updateTipHeadings(this.chain.boneCenteredTipHeadings, !translate);
            this.updateOptimalRotationToPinnedDescendants(translate, skipConstraint, this.chain.boneCenteredTipHeadings, this.chain.boneCenteredTargetHeadings, this.chain.weights);
            if (stabilizePasses > 0) {
                this.updateTipHeadings(this.chain.uniform_boneCenteredTipHeadings, !translate);
                const currentmsd = this.chain.getManualMSD(this.chain.uniform_boneCenteredTipHeadings, this.chain.boneCenteredTargetHeadings, this.chain.weights);
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
        if (this.chain.wb_segmentRoot == this) 
            this.chain.previousDeviation = Infinity;
        this.simLocalAxes.markDirty();
    }

    /**returns the previousState if this bone has a constraint and might require additional passes, otherwise returns null*/
    updateOptimalRotationToPinnedDescendants(translate, skipConstraints, localizedTipHeadings, localizedTargetHeadings, weights) {
        const qcpRot = this.chain.qcpConverger.weightedSuperpose(localizedTipHeadings, localizedTargetHeadings, weights, translate);
    
        const translateBy = this.chain.qcpConverger.getTranslation();
        const boneDamp = this.cosHalfDampen; 
       // if (!translate) {
            qcpRot.clampToCosHalfAngle(boneDamp);
        //}
        if (this.constraint != null && !skipConstraints && !(this.constraint instanceof Returnful)) {
            this.desiredState.rotateBy(qcpRot);
            this.desiredState.updateGlobal();
            let rotBy = this.constraint.getRectifyingRotation(this.desiredState, this.desiredBoneOrientation, this.simLocalAxes, this.simBoneAxes);
            this.currentHardPain = 0;
            if(rotBy != Rot.IDENTITY) { 
                this.currentHardPain = 1; //violating a hard constraint should be maximally painful.
            }
            this.desiredState.rotateBy(rotBy); //rectify the desired state to a valid state
            IKNode.swap(this.previousState, this.simLocalAxes); //save the old value of simLocalAxes
            this.simLocalAxes.setLocalOrientationTo(this.desiredState.getLocalMBasis().rotation); //set the new values of simLocalAxes to the rectified result
            return this.previousState;
        } else {
            if (translate) {
                this.simLocalAxes.translateByGlobal(translateBy);
            }
            this.simLocalAxes.rotateBy(qcpRot);
        } 
        return qcpRot;
    }

    /**sets an array specifying the number of descendants to reach each pin. 
     * this is as an iteration count independent part of the painfulness scheme
     * where each bone weighs targets more heavily based on the amount of pain their descendants report toward that target.
    */
    setPerPinDescendantCounts(pinnedBones) {
        this.descendantCounts = new Array(pinnedBones.length);
        this.descendantAveragePain = new Array(pinnedBones.length);
        this.childPathToPin = new Array(pinnedBones.length);
        this.indexOnDescendant = new Array(pinnedBones.length);
        for(let i =0; i < pinnedBones.length; i++) {
            let count = 1;
            let currentBone = pinnedBones[i];
            while(currentBone != this) {
                count++;
                if(currentBone.parentBone == this) {
                    this.childPathToPin[i] = currentBone;
                }
                this.indexOnDescendant[i] = currentBone.chain.pinnedBones.indexOf(pinnedBones[i]);
                currentBone = currentBone.parentBone;
            }
            this.descendantCounts[i] = count;
            this.descendantAveragePain[i] = 0;
        }
    }

    updateDescendantsPain() {
        let ownPain = this.getOwnPain();
        let distrOwnPain = ownPain / this.descendantCounts.length;
        this.justDescendantPainTotal = 0;
        this.totalDescendants = 0;
        this.justDescendantsAverage = 0;
        this.justDescendantsDeviation = 0; 
        
        if(this.childPathToPin.length == 1) {
            let childToPin = this.childPathToPin[0];
            if(childToPin == undefined) { //leaf node
                this.descendantAveragePain[0] = ownPain;
            }else {
                for(let i =0; i < this.descendantCounts.length; i++) {
                    let descToPin = this.descendantCounts[i];
                    let avgDescendantPain = childToPin.descendantAveragePain[i];
                    let segdescendantTotal = ((descToPin-1)*avgDescendantPain);
                    avgDescendantPain = (segdescendantTotal + distrOwnPain)/descToPin;
                    this.totalDescendants += descToPin;
                    this.justDescendantPainTotal += segdescendantTotal;
                    this.descendantAveragePain[i] = avgDescendantPain;
                }
            }
        }
        else if (this.childPathToPin.length > 1) {            
            for(let i =0; i < this.descendantCounts.length; i++) {
                let descToPin = this.descendantCounts[i];
                let indexOfPinInDescendant = this.indexOnDescendant[i]
                let avgDescendantPain = this.childPathToPin[i].getDescendantPain(indexOfPinInDescendant);
                let segdescendantTotal = ((descToPin-1)*avgDescendantPain);
                avgDescendantPain = (segdescendantTotal + distrOwnPain)/descToPin;
                this.totalDescendants += descToPin;
                this.justDescendantPainTotal += segdescendantTotal;
                this.descendantAveragePain[i] = avgDescendantPain;
            }
        } else if(this.descendantCounts.length >= 1) {
            console.log("what")
        }
        this.descendantPainTotal = this.avgDescendantPain*this.descToPin
    }

     /**@return the amount of pain this bone itself is experiencing */
    getOwnPain() {
       this.currentSoftPain = this.lastReturnfulResult?.preCallDiscomfort;
       this.currentSoftPain = isNaN(this.currentSoftPain) ? 0 : this.currentSoftPain;
       return Math.max(this.currentHardPain,  this.currentSoftPain);
    }

    /**@return the average amount of pain this bone and all descendants attempting to reach this pin are experiencing**/
    getDescendantPain(pinIndex) {
        return this.descendantAveragePain[pinIndex];
    }
    
    updatePain(iteration) {
        if (this.springy) {
            const res = this.constraint.getPreferenceRotation(this.simLocalAxes, this.simBoneAxes, this.previousState, this.previousBoneOrientation, iteration, this);
            this.chain.previousDeviation = Infinity;
            this.lastReturnfulResult = res;
        }
    }

    pullBackTowardAllowableRegion(iteration, callbacks) {
        if (this.springy) {
            if(this.constraint != null && (this.constraint instanceof Rest || this.constraint instanceof Kusudama)) {
                //callbacks?.beforePullback(this.forBone.directRef, this.forBone.getFrameTransform(), this);
                const res = this.constraint.getPreferenceRotation(this.simLocalAxes, this.simBoneAxes, this.previousState, this.previousBoneOrientation, iteration, this);
                this.chain.previousDeviation = Infinity;
                this.lastReturnfulResult = res;
                this.simLocalAxes.rotateBy(res.clampedRotation);
                //callbacks?.afterPullback(this.forBone.directRef, this.forBone.getFrameTransform(), this);
            }
        }
    }

    updateTargetHeadings(localizedTargetHeadings, baseWeights, weights) {
        let hdx = 0;
        const workingRay = this.workingRay;
        for (let i = 0; i < this.chain.pinnedBones.length; i++) {
            const sb = this.chain.pinnedBones[i];
            const targetAxes = sb.simTargetAxes;
            targetAxes.updateGlobal();
            const origin = this.simLocalAxes.origin();
            localizedTargetHeadings[hdx].set(targetAxes.origin()).sub(origin);
            let painScalar = 1;//(1+this.descendantAveragePain[i]);
            weights[hdx] = painScalar * baseWeights[hdx];
            const modeCode = sb.targetState.getModeCode();
            hdx++;
            if ((modeCode & TargetState.XDir) != 0) {
                weights[hdx] = painScalar*baseWeights[hdx];
                weights[hdx+1] = painScalar*baseWeights[hdx+1];
                const xTarget = workingRay;
                xTarget.set(targetAxes.xRay());
                //xTarget.scaleBy(weights[hdx]);
                localizedTargetHeadings[hdx].set(xTarget.p2).sub(origin);
                xTarget.setToInvertedTip(localizedTargetHeadings[hdx + 1]).sub(origin);
                hdx += 2;
            }
            if ((modeCode & TargetState.YDir) != 0) {
                weights[hdx] = painScalar*baseWeights[hdx];
                weights[hdx+1] = painScalar*baseWeights[hdx+1];
                const yTarget = workingRay;
                yTarget.set(targetAxes.yRay());
                //yTarget.scaleBy(weights[hdx]);
                localizedTargetHeadings[hdx].set(yTarget.p2).sub(origin);
                yTarget.setToInvertedTip(localizedTargetHeadings[hdx + 1]).sub(origin);
                
                hdx += 2;
            }
            if ((modeCode & TargetState.ZDir) != 0) {
                weights[hdx] = painScalar*baseWeights[hdx];
                weights[hdx+1] = painScalar*baseWeights[hdx+1];
                const zTarget = workingRay;
                zTarget.set(targetAxes.zRay());
                //zTarget.scaleBy(weights[hdx]);
                localizedTargetHeadings[hdx].set(zTarget.p2).sub(origin);
                zTarget.setToInvertedTip(localizedTargetHeadings[hdx + 1]).sub(origin);
                hdx += 2;
            }
        }
    }

    updateTipHeadings(localizedTipHeadings, scale) {
        let hdx = 0;
        const origin = this.simBoneAxes.origin();
        const workingRay = this.workingRay;
        for (let i = 0; i < this.chain.pinnedBones.length; i++) {
            const sb = this.chain.pinnedBones[i];
            const tipAxes = sb.simBoneAxes;
            tipAxes.updateGlobal();            
            const target = sb.targetState;
            const modeCode = target.getModeCode();

            const targetAxes = sb.simTargetAxes;
            targetAxes.updateGlobal();

            localizedTipHeadings[hdx].set(tipAxes.origin()).sub(origin);
            let scaleBy = scale ? 1+origin.dist(targetAxes.origin()) : 1;
            hdx++;

            if ((modeCode & TargetState.XDir) != 0) {
                const xTip = workingRay;
                xTip.set(tipAxes.xRay());
                xTip.scaleBy(scaleBy);
                localizedTipHeadings[hdx].set(xTip.p2).sub(origin);
                xTip.setToInvertedTip(localizedTipHeadings[hdx + 1]).sub(origin);
                hdx += 2;
            }
            if ((modeCode & TargetState.YDir) != 0) {
                const yTip = workingRay;
                yTip.set(tipAxes.yRay());
                yTip.scaleBy(scaleBy);
                localizedTipHeadings[hdx].set(yTip.p2).sub(origin);
                yTip.setToInvertedTip(localizedTipHeadings[hdx + 1]).sub(origin);
                hdx += 2;
            }
            if ((modeCode & TargetState.ZDir) != 0) {
                const zTip = workingRay;
                zTip.set(tipAxes.zRay());
                zTip.scaleBy(scaleBy);
                localizedTipHeadings[hdx].set(zTip.p2).sub(origin);
                zTip.setToInvertedTip(localizedTipHeadings[hdx + 1]).sub(origin);
                hdx += 2;
            }
        }
    }

    updateReturnfullnessDamp(iterations) {
        if(this.maybeSpringy()) {
            this.constraint.setPreferenceLeeway(this.stiffdampening);
            this.constraint.updatePerIterationLeewayCache(iterations);
            /**
             * determine maximum pullback that would still allow the solver to converge if applied once per pass 
             */
            if(this.constraint.giveup >= 1) {
                this.springy = true;
            }
        }
    }

    maybeSpringy() {
        return (this.constraint != null && (this.constraint instanceof Returnful || this.constraint instanceof LimitingReturnful ));
    }
}

export default ArmatureSegment;