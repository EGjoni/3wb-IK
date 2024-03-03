
import { Vec3, new_Vec3 } from "../util/vecs.js";
import { Ray } from "../util/Ray.js";
import {Rot} from "../util/Rot.js";
import {QCP} from "../util/QCP.js";
import { TargetState, ConstraintState, TransformState, BoneState } from "./SkeletonState.js";
import { Rest } from "../betterbones/Constraints/Rest/Rest.js";

export class ArmatureSegment {
    boneCenteredTargetHeadings = [];
    boneCenteredTipHeadings = [];
    uniform_boneCenteredTipHeadings = [];
    constructor(shadowSkel, startingFrom, parentSegment, hasPinnedAncestor) {
        this.shadowSkel = shadowSkel;
        this.simTransforms = shadowSkel.simTransforms;
        this.previousDeviation = Infinity;
        this.parentSegment = parentSegment;
        this.hasPinnedAncestor = hasPinnedAncestor; 
        this.qcpConverger = new QCP(Number.EPSILON, Number.EPSILON);       
        this.rootSegment = this.hasPinnedAncestor || parentSegment == null ? this : this.parentSegment.rootSegment;
        this.hasPinnedAncestor = parentSegment != null && (parentSegment.hasPinnedAncestor || parentSegment.hasPinnedAncestor);
        this.buildSegment(startingFrom);
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

    buildSegment(startingFrom) {
        const segEffectors = [];
        const strandBones = [];
        const subSgmts = [];
        const childSgmts = [];
        let currentBS = startingFrom;
        let finished = false;
        while (!finished) {
            const currentWB = new WorkingBone(currentBS, this);
            if (currentBS == startingFrom) this.wb_segmentRoot = currentWB;
            strandBones.push(currentWB);
            const target = currentBS.getTarget();
            if (target != null || currentBS.getChildCount() > 1) {
                if (target != null) {
                    segEffectors.push(currentWB);
                    if (target.getDepthFallOff() <= 0.0) finished = true;
                }
                if (finished) {
                    this.wb_segmentTip = currentWB;
                    for (let i = 0; i < currentBS.getChildCount(); i++) childSgmts.push(new ArmatureSegment(this.shadowSkel, currentBS.getChild(i), this, true));
                }
                else {
                    for (let i = 0; i < currentBS.getChildCount(); i++) {
                        const subseg = new ArmatureSegment(this.shadowSkel, currentBS.getChild(i), this, false);
                        subSgmts.push(subseg);
                        //subSgmts.push(...subseg.subSegments);
                        segEffectors.push(...subseg.pinnedBones);
                    }
                    finished = true;
                    this.wb_segmentTip = currentWB; //still mark as
                }
            } else if (currentBS.getChildCount() == 1) {
                currentBS = currentBS.getChild(0);
            } else {
                this.wb_segmentTip = currentWB;
            }
        }
        this.subSegments = subSgmts;
        this.pinnedBones = segEffectors;
        this.childSegments = childSgmts;
        this.solvableStrandBones = strandBones;
    }

    buildReverseTraversalArray() {
        const reverseTraversalArray = [];
        for (const wb of this.solvableStrandBones) {           
            reverseTraversalArray.push(wb);
        }

        for (const subsgmt of this.subSegments) {
            reverseTraversalArray.push(...subsgmt.reversedTraversalArray);
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
                this.boneCenteredTargetHeadings.push(new_Vec3());
                this.boneCenteredTipHeadings.push(new_Vec3());
                this.uniform_boneCenteredTipHeadings.push(new_Vec3());
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
    simConstraintSwingAxes = null;
    simConstraintTwistAxes = null;
    cosHalfDampen = 0;
    cosHalfReturnDamp = 0;
    returnDamp = 0;
    springy = false;

    constructor(forBone, chain) {
        /** @type {BoneState} */
        this.forBone = forBone;
        /** @type {ConstraintState} */
        this.cnstrntstate = forBone.getConstraint();
        /** @type {TransformState} */
        this.simLocalAxes = chain.simTransforms[forBone.getFrameTransform().getIndex()];
        this.simBoneAxes = chain.simTransforms[forBone.getOrientationTransform().getIndex()];
        this.chain = chain;
        this.hasPinnedAncestor = this.chain.hasPinnedAncestor;
        let predamp = 1 - forBone.getStiffness();
		let defaultDampening = this.chain.getDampening();
		let dampening = forBone.getParent() == null ? Math.PI : predamp * defaultDampening;
		this.cosHalfDampen = Math.cos(dampening / 2);

        /** @type {TransformState} */
        if(forBone.getTarget() != null) {
            this.targetState = forBone.getTarget();
            this.simTargetAxes = this.chain.simTransforms[forBone.getTarget().getTransform().getIndex()];
        }
        if(this.cnstrntstate != null) {
            this.constraint = this.cnstrntstate.getDirectReference();
            /** @type {TransformState} */
            this.simConstraintSwingAxes = forBone.getConstraint()?.getSwingTransform() == null ? null :  chain.simTransforms[forBone.getConstraint().getSwingTransform().getIndex()];
            /** @type {TransformState} */
            this.simConstraintTwistAxes = forBone.getConstraint()?.getTwistTransform() == null ? null : chain.simTransforms[forBone.getConstraint().getTwistTransform().getIndex()];
            if (this.cnstrntstate.getPainfulness() > 0) {
                this.springy = true;
            } else {
                this.springy = false;
            }
        }
        
        this.updateCosDampening();
    }

    updateCosDampening() {
        const stiffness = this.forBone.getStiffness();
        const defaultDampening = this.chain.getDampening();
        const dampening = this.forBone.getParent() == null ? Math.PI : (1 - stiffness) * defaultDampening;
        this.cosHalfDampen = Math.cos(dampening / 2);
    }

    setAsSegmentRoot() {
        this.isSegmentRoot = true;
    }

    getRootSegment() {
        return this.chain.rootSegment;
    }

    fastUpdateOptimalRotationToPinnedDescendants(stabilizePasses, translate, skipConstraint) {
        this.simLocalAxes.updateGlobal();
        if(this.cosHalfDampen == 1) {
            if(this.chain.wb_segmentRoot == this) 
                this.chain.previousDeviation = Infinity;
            return;
        }
        this.updateTargetHeadings(this.chain.boneCenteredTargetHeadings, this.chain.weights);
        const prevOrientation = new Rot(this.simLocalAxes.globalMBasis.rotation);
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
        if (!gotCloser) this.simLocalAxes.setLocalOrientationTo(prevOrientation);

        //We've finished with this chain for this iteration, so next time we try to get deviation we start fresh
        if (this.chain.wb_segmentRoot == this) 
            this.chain.previousDeviation = Infinity;
        this.simLocalAxes.markDirty();
    }

    updateOptimalRotationToPinnedDescendants(translate, skipConstraints, localizedTipHeadings, localizedTargetHeadings, weights) {
        const qcpRot = this.chain.qcpConverger.weightedSuperpose(localizedTipHeadings, localizedTargetHeadings, weights, translate);
    
        const translateBy = this.chain.qcpConverger.getTranslation();
        const boneDamp = this.cosHalfDampen; 
        if (!translate) {
            qcpRot.rotation.clampToQuadranceAngle(boneDamp);
        }
        this.simLocalAxes.rotateBy(qcpRot.rotation);
        if (translate) {
            this.simLocalAxes.translateByGlobal(translateBy);
        }
        this.simLocalAxes.updateGlobal();
        
        if (this.constraint != null && !skipConstraints) {
            this.constraint.setAxesToSnapped(this.simLocalAxes, this.simConstraintSwingAxes, this.simConstraintTwistAxes);
            //we should never hit this condition because root bones shouldn't have constraints, but I know people are gonna do it anyway so
            if (translate) {
                this.simConstraintSwingAxes.translateByGlobal(translateBy);
                this.simConstraintTwistAxes.translateByGlobal(translateBy);
            }
        }
        return qcpRot;
    }
    


    pullBackTowardAllowableRegion() {
        if (this.springy) {
            if(this.constraint != null && (this.constraint instanceof Rest || this.constraint instanceof Kusudama)) {
                this.constraint.setAxesToReturnfulled(this.simLocalAxes, this.simBoneAxes, this.simConstraintSwingAxes, this.simConstraintTwistAxes, this.cosHalfReturnDamp, this.returnDamp);
                this.chain.previousDeviation = Infinity;
            }
        }
    }

    workingRay = new Ray(new_Vec3(0,0,0), new_Vec3(0,0,0));

    updateTargetHeadings(localizedTargetHeadings, weights) {
        let hdx = 0;
        const workingRay = this.workingRay;
        for (let i = 0; i < this.chain.pinnedBones.length; i++) {
            const sb = this.chain.pinnedBones[i];
            const targetAxes = sb.simTargetAxes;
            targetAxes.updateGlobal();
            const origin = this.simLocalAxes.origin();
            localizedTargetHeadings[hdx].set(targetAxes.origin()).sub(origin);
            const modeCode = sb.targetState.getModeCode();
            hdx++;
            if ((modeCode & TargetState.XDir) != 0) {
                const xTarget = workingRay;
                xTarget.set(targetAxes.xRay());
                xTarget.scaleBy(weights[hdx]);
                localizedTargetHeadings[hdx].set(xTarget.p2).sub(origin);
                xTarget.setToInvertedTip(localizedTargetHeadings[hdx + 1]).sub(origin);
                hdx += 2;
            }
            if ((modeCode & TargetState.YDir) != 0) {
                const yTarget = workingRay;
                yTarget.set(targetAxes.yRay());
                yTarget.scaleBy(weights[hdx]);
                localizedTargetHeadings[hdx].set(yTarget.p2).sub(origin);
                yTarget.setToInvertedTip(localizedTargetHeadings[hdx + 1]).sub(origin);
                hdx += 2;
            }
            if ((modeCode & TargetState.ZDir) != 0) {
                const zTarget = workingRay;
                zTarget.set(targetAxes.zRay());
                zTarget.scaleBy(weights[hdx]);
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
        if(this.cnstrntstate != null) {
            /**
             * determine maximum pullback that would still allow the solver to converge if applied once per pass 
             */
            if (this.cnstrntstate.getPainfulness() >= 0) {
                const dampening = this.forBone.getParent() == null ? MathUtils.PI : (1 - this.forBone.getStiffness()) * this.chain.getDampening();
                this.returnDamp = (dampening - (Math.PI / (2 * (Math.PI / (iterations * dampening) * iterations))))*this.cnstrntstate.getPainfulness();
                this.cosHalfReturnDamp = Math.cos(this.returnDamp / 2);
                this.springy = true;
                //populateReturnDampeningIterationArray(k);
            } else {
                this.springy = false;
            }
        }
    }
}

export default ArmatureSegment;