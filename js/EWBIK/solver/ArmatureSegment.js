
import { Vec3 } from "../util/vecs.js";
import { Ray } from "../util/Ray.js";
import {Rot} from "../util/Rot.js";
import {QCP} from "../util/QCP.js";
import { TargetState, ConstraintState, TransformState, BoneState } from "./SkeletonState.js";
import { Rest } from "../betterbones/Constraints/Rest/Rest.js";
import { Limiting, LimitingReturnful, Returnful } from "../betterbones/Constraints/Constraint.js";
import { IKNode } from "../util/nodes/IKNodes.js";

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
        this.qcpConverger = new QCP(1e-6, 1e-11);       
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
        const reverseTraversalSet = new Set();
        for (const wb of this.solvableStrandBones) {           
            reverseTraversalSet.add(wb);
        }

        for (const subsgmt of this.immediateSubSegments) {
            subsgmt.reversedTraversalArray.forEach(wb => reverseTraversalSet.add(wb));
        }

        for (const childsgmt of this.childSegments) {
            childsgmt.reversedTraversalArray.forEach(wb => reverseTraversalSet.add(wb));
        }

        this.reversedTraversalArray = [...reverseTraversalSet];
    }

    toConsole(currentDepth) {
        for(let sb of this.solvableStrandBones) {
            console.log('\t'.repeat(currentDepth)+sb.forBone.directRef.ikd);
            currentDepth++;
        }
        for(let iss of this.immediateSubSegments) {
            iss.toConsole(currentDepth);
        }
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
            for (const s of this.immediateSubSegments) {
                s.recursivelyCreatePenaltyArray(weightArray, pinSequence, currentFalloff * thisFalloff);
            }
        }
    }

    /**returns all child and subsegments*/
    getAllDescendantSegments() {
        const result = new Set();
        result.add(this);
        for (const sub of this.immediateSubSegments) {
            let descsub = sub.getAllDescendantSegments();
            descsub.forEach(s => result.add(s));
        }

        for (const child of this.childSegments) {
            let descchi = child.getAllDescendantSegments();
            descchi.forEach(c => result.add(c));
        }
        return [...result];
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

    tempRot = new Rot(1,0,0,0);
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
    hasLimitingConstraint = false;
    cyclicTargets = new Set();

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
        this.hasLimitingConstraint = this.constraint != null && !(this.constraint instanceof Returnful);
        /** @type {TransformState} */
        this.simLocalAxes = chain.simTransforms[forBone.getFrameTransform().getIndex()];
        this.simBoneAxes = chain.simTransforms[forBone.getOrientationTransform().getIndex()];
        /**@type {IKNode} */
        this.desiredState = this.simLocalAxes.attachedClone();
        this.desiredBoneOrientation = this.simBoneAxes.freeClone().setRelativeToParent(this.desiredState);
        this.previousState= this.simLocalAxes.attachedClone(); 
        this.previousBoneOrientation = this.simBoneAxes.freeClone().setRelativeToParent(this.desiredState);
        this.chain = chain;
        this.hasPinnedAncestor = this.chain.hasPinnedAncestor;

        /** @type {TransformState} */
        if(forBone.getTarget() != null) {
            this.targetState = forBone.getTarget();
            this.simTargetAxes = this.chain.simTransforms[forBone.getTarget().getTransform().getIndex()];
            let np = this.simTargetAxes; let d = 1000;
            while(np.parent != null) { 
                if(np == this) {
                    this.cyclicTargets.add(this.simTargetAxes);
                    break;
                } 
                if(np.parent == this.simTargetAxes) {
                    throw new Error("You fucked something up and now a target is its own ancestor??? For shame.");
                }
                np = np.parent;
            }
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
        this.hasLimitingConstraint = this.constraint != null && !(this.constraint instanceof Returnful);
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
        if(window.perfing) performance.mark("fastUpdateOptimalRotationToPinnedDescendants start");
        if(this.cosHalfDampen == 1) {
            if(this.chain.wb_segmentRoot == this) 
                this.chain.previousDeviation = Infinity;
            return;
        }
        this.updateDescendantsPain();
        this.updateTargetHeadings(this.chain.boneCenteredTargetHeadings, this.chain.weights, this.myWeights);
        //const prevOrientation = Rot.fromRot(this.simLocalAxes.localMBasis.rotation);
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
        /*if (!gotCloser) {
            this.simLocalAxes.setLocalOrientationTo(prevOrientation);
        }*/

        //We've finished with this chain for this iteration, so next time we try to get deviation we start fresh
        if (this.chain.wb_segmentRoot == this) 
            this.chain.previousDeviation = Infinity;
        //this.simLocalAxes.markDirty();
        if(window.perfing) performance.mark("fastUpdateOptimalRotationToPinnedDescendants end");
        if(window.perfing) performance.measure("fastUpdateOptimalRotationToPinnedDescendants", "fastUpdateOptimalRotationToPinnedDescendants start", "fastUpdateOptimalRotationToPinnedDescendants end");   
    }

    /**returns the rotation that was applied (in local space), but does indeed apply it*/
    updateOptimalRotationToPinnedDescendants(translate, skipConstraints, localizedTipHeadings, localizedTargetHeadings, weights) {
        //if(window.perfing) performance.mark("updateOptimalRotationToPinnedDescendants start");
        let desiredRotation = this.chain.qcpConverger.weightedSuperpose(localizedTipHeadings, localizedTargetHeadings, weights, translate);
        //qcpRot = Rot.fromVecs(localizedTipHeadings[1], localizedTargetHeadings[1]);
        const translateBy = this.chain.qcpConverger.getTranslation();
        const boneDamp = this.cosHalfDampen; 
        if (!translate) {
            desiredRotation.clampToCosHalfAngle(boneDamp);
        }
        let localDesiredRotby = this.simLocalAxes.getParentAxes().getGlobalMBasis().getLocalOfRotation(desiredRotation, this.chain.tempRot);
        let reglobalizedRot = desiredRotation;
        if (this.hasLimitingConstraint) {
            
            let rotBy = this.constraint.getRectifyingRotation(this.simLocalAxes, this.simBoneAxes, localDesiredRotby);
            this.currentHardPain = 0;
            if(rotBy != localDesiredRotby) { 
                this.currentHardPain = 1; //violating a hard constraint should be maximally painful.
            }
            reglobalizedRot = this.simLocalAxes.parent.globalMBasis.getGlobalOfRotation(localDesiredRotby);
            this.simLocalAxes.rotateByLocal(rotBy);
            
        } else {
            if (translate) {
                this.simLocalAxes.translateByGlobal(translateBy);
            }
            this.simLocalAxes.rotateByLocal(localDesiredRotby);
        }
        /*if(!translate) {
            this.chain.hasFastPass = true; 
            this.post_UpdateTargetHeadings(localizedTargetHeadings, weights, reglobalizedRot);
            this.post_UpdateTipHeadings(localizedTipHeadings, true, reglobalizedRot);           
        } else {
            this.chain.hasFastPass = false;

        }*
        if(window.perfing) performance.mark("updateOptimalRotationToPinnedDescendants end");
        if(window.perfing) performance.measure("updateOptimalRotationToPinnedDescendants", "updateOptimalRotationToPinnedDescendants start", "updateOptimalRotationToPinnedDescendants end");   */
        return localDesiredRotby;
    }

    /**sets an array specifying the number of descendants to reach each pin. 
     * this is as an iteration count independent part of the painfulness scheme
     * where each bone weighs targets more heavily based on the amount of pain their descendants report toward that target.
    */
    setPerPinDescendantCounts(pinnedBones) {
        if(window.perfing) performance.mark("setPerPinDescendantCounts start");
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
            if(window.perfing) performance.mark("setPerPinDescendantCounts end");
            if(window.perfing) performance.measure("setPerPinDescendantCounts", "setPerPinDescendantCounts start", "setPerPinDescendantCounts end");   
        }
    }
    updateTargetHeadings(localizedTargetHeadings, baseWeights, weights) {
        if(window.perfing) performance.mark("updateTargetHeadings start");
        let hdx = 0;
        const workingRay = this.workingRay;
        let origin = this.simLocalAxes.origin(); //null
        for (let i = 0; i < this.chain.pinnedBones.length; i++) {
            const sb = this.chain.pinnedBones[i];
            const targetAxes = sb.simTargetAxes;
            /*if(sb != this && sb.chain.hasFastPass && this.simLocalAxes.dirty == false) {
                origin = this.simLocalAxes.globalMBasis.translate;
                hdx += this.fast_updateTargetHeadings(localizedTargetHeadings, baseWeights, weights, hdx, sb, i, origin); 
                continue;
            } 
            if(origin == null) origin = this.simLocalAxes.origin();
            sb.chain.hasFastPass = false;*/
            
            targetAxes.updateGlobal();            
            localizedTargetHeadings[hdx].set(targetAxes.origin()).sub(origin);
            let painScalar = (1+this.descendantAveragePain[i]);
            weights[hdx] = painScalar * baseWeights[hdx];
            const modeCode = sb.targetState.getModeCode();
            hdx++;
            if (modeCode & TargetState.XDir) {
                weights[hdx] = painScalar*baseWeights[hdx];
                weights[hdx+1] = painScalar*baseWeights[hdx+1];
                const xTarget = workingRay;
                xTarget.set(targetAxes.xRay());
                xTarget.scaleBy(weights[hdx]);
                localizedTargetHeadings[hdx].set(xTarget.p2).sub(origin);
                xTarget.setToInvertedTip(localizedTargetHeadings[hdx + 1]).sub(origin);
                hdx += 2;
            }
            if (modeCode & TargetState.YDir) {
                weights[hdx] = painScalar*baseWeights[hdx];
                weights[hdx+1] = painScalar*baseWeights[hdx+1];
                const yTarget = workingRay;
                yTarget.set(targetAxes.yRay());
                yTarget.scaleBy(weights[hdx]);
                localizedTargetHeadings[hdx].set(yTarget.p2).sub(origin);
                yTarget.setToInvertedTip(localizedTargetHeadings[hdx + 1]).sub(origin);
                
                hdx += 2;
            }
            if (modeCode & TargetState.ZDir) {
                weights[hdx] = painScalar*baseWeights[hdx];
                weights[hdx+1] = painScalar*baseWeights[hdx+1];
                const zTarget = workingRay;
                zTarget.set(targetAxes.zRay());
                zTarget.scaleBy(weights[hdx]);
                localizedTargetHeadings[hdx].set(zTarget.p2).sub(origin);
                zTarget.setToInvertedTip(localizedTargetHeadings[hdx + 1]).sub(origin);
                hdx += 2;
            }
        }
        if(window.perfing) performance.mark("updateTargetHeadings end");
        if(window.perfing) performance.measure("updateTargetHeadings", "updateTargetHeadings start", "updateTargetHeadings end");    
    }
    
    updateTipHeadings(localizedTipHeadings, scale) {
        if(window.perfing) performance.mark("updateTipHeadings start");
        let hdx = 0;
        const myOrigin = this.simLocalAxes.origin();
        const workingRay = this.workingRay;
        for (let i = 0; i < this.chain.pinnedBones.length; i++) {
            const sb = this.chain.pinnedBones[i];
            /*if(sb != this && sb.chain.hasFastPass && this.simLocalAxes.dirty == false) {
                hdx += this.fast_updateTipHeadings(localizedTipHeadings, scale, hdx, sb, myOrigin); 
                continue;
            }
            sb.chain.hasFastPass = false;*/

            const tipAxes = sb.simBoneAxes;
            tipAxes.updateGlobal();    
            const tipOrigin = tipAxes.origin();        
            const target = sb.targetState;
            const modeCode = target.getModeCode();

            const targetAxes = sb.simTargetAxes;
            targetAxes.updateGlobal();

            localizedTipHeadings[hdx].set(tipOrigin).sub(myOrigin);
            let scaleBy = scale ? 1+myOrigin.dist(tipOrigin) : 1;
            hdx++;

            if ((modeCode & TargetState.XDir) != 0) {
                const xTip = workingRay;
                xTip.set(tipAxes.xRay());
                xTip.scaleBy(scaleBy);
                localizedTipHeadings[hdx].set(xTip.p2).sub(myOrigin);
                xTip.setToInvertedTip(localizedTipHeadings[hdx + 1]).sub(myOrigin);
                hdx += 2;
            }
            if ((modeCode & TargetState.YDir) != 0) {
                const yTip = workingRay;
                yTip.set(tipAxes.yRay());
                yTip.scaleBy(scaleBy);
                localizedTipHeadings[hdx].set(yTip.p2).sub(myOrigin);
                yTip.setToInvertedTip(localizedTipHeadings[hdx + 1]).sub(myOrigin);
                hdx += 2;
            }
            if ((modeCode & TargetState.ZDir) != 0) {
                const zTip = workingRay;
                zTip.set(tipAxes.zRay());
                zTip.scaleBy(scaleBy);
                localizedTipHeadings[hdx].set(zTip.p2).sub(myOrigin);
                zTip.setToInvertedTip(localizedTipHeadings[hdx + 1]).sub(myOrigin);
                hdx += 2;
            }
        }
        if(window.perfing) performance.mark("updateTipHeadings end");
        if(window.perfing) performance.measure("updateTipHeadings", "updateTipHeadings start", "updateTipHeadings end");   
    }

    updateDescendantsPain() {
        if(window.perfing) performance.mark("updateDescendantsPain start");
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
        if(window.perfing) performance.mark("updateDescendantsPain end");
        if(window.perfing) performance.measure("updateDescendantsPain", "updateDescendantsPain start", "updateDescendantsPain end");   
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
             this.constraint.markDirty();
             const res = this.constraint.getClampedPreferenceRotation(this.simLocalAxes, this.simBoneAxes, iteration, this);
             this.chain.previousDeviation = Infinity;
             this.lastReturnfulResult = res;
         }
     }
 
     pullBackTowardAllowableRegion(iteration, callbacks) {
        if(window.perfing) performance.mark("pullBackTowardAllowableRegion start");
         if (this.springy) {
            this.constraint.markDirty();
            //callbacks?.beforePullback(this.forBone.directRef, this.forBone.getFrameTransform(), this);
            const res = this.constraint.getClampedPreferenceRotation(this.simLocalAxes, this.simBoneAxes, iteration, this);
            this.chain.previousDeviation = Infinity;
            this.lastReturnfulResult = res;
            this.simLocalAxes.rotateByLocal(res.clampedRotation);
            //callbacks?.afterPullback(this.forBone.directRef, this.forBone.getFrameTransform(), this);
         }
         if(window.perfing) performance.mark("pullBackTowardAllowableRegion end");
         if(window.perfing) performance.measure("pullBackTowardAllowableRegion", "pullBackTowardAllowableRegion start", "pullBackTowardAllowableRegion end"); 
     }
 

    updateReturnfullnessDamp(iterations) {
        if(window.perfing) performance.mark("updateReturnfullnessDamp start");
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
        if(window.perfing) performance.mark("updateReturnfullnessDamp end");
        if(window.perfing) performance.measure("updateReturnfullnessDamp", "updateReturnfullnessDamp start", "updateReturnfullnessDamp end"); 
    }
    

    maybeSpringy() {
        return (this.constraint != null && (this.constraint instanceof Returnful));
    }

    applyRotToVecArray(rot, vecArr, storeIn = []) {
        for(let i=0; i<vecArr.length; i++) {
            storeIn[i] = rot.applyToVec(vecArr[i], vecArr[i]);
        }
        return storeIn;
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
        for(let i =0; i <vecArr1.length; i++) {
            Rot.fromVecs(vecArr1[i], vecArr2[i]).toConsole(); 
        }
    }

}

export default ArmatureSegment;




/**
 * 
 * 
 * fast_updateTargetHeadings(localizedTargetHeadings, baseWeights, weights, hdxStart, sb, i, myOrigin) {
        if(window.perfing) performance.mark("fast_updateTargetHeadings start");
        const modeCode = sb.targetState.getModeCode();
        const targetOrigin = localizedTargetHeadings[hdxStart];
        let updated = 0;
        let hdx = hdxStart;
        const tipOrigin = myOrigin;
        let painScalar = (1+this.descendantAveragePain[i]);
        let combinedOffset = this.pool.any_Vec3(targetOrigin.x - myOrigin.x, targetOrigin.y -myOrigin.y, targetOrigin.z - myOrigin.z);
        weights[hdx] = painScalar * baseWeights[hdx];
            
        hdx++; updated++;

        if ((modeCode & TargetState.XDir) != 0) {
            //weights[hdx] = painScalar*baseWeights[hdx];
            //weights[hdx+1] = painScalar*baseWeights[hdx+1];
            localizedTargetHeadings[hdx].sub(targetOrigin).mult(1/weights[hdx]).add(combinedOffset);
            localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(1/weights[hdx+1]).add(combinedOffset);   //set(xTip.p2).sub(myOrigin);
            hdx += 2;
            updated+=2;
        }
        if ((modeCode & TargetState.YDir) != 0) {
            //weights[hdx] = painScalar*baseWeights[hdx];
            //weights[hdx+1] = painScalar*baseWeights[hdx+1];
            localizedTargetHeadings[hdx].sub(targetOrigin).mult(1/weights[hdx]).add(combinedOffset); ;
            localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(1/weights[hdx+1]).add(combinedOffset); ;
            hdx += 2;
            updated+=2;
        }
        if ((modeCode & TargetState.ZDir) != 0) {
            //weights[hdx] = painScalar*baseWeights[hdx];
            //weights[hdx+1] = painScalar*baseWeights[hdx+1];
            localizedTargetHeadings[hdx].sub(targetOrigin).mult(1/weights[hdx]).add(combinedOffset); ;
            localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(1/weights[hdx+1]).add(combinedOffset); ;
            hdx += 2;
            updated+=2;
        }

        localizedTargetHeadings[hdxStart].set(combinedOffset);
        if(window.perfing) performance.mark("fast_updateTargetHeadings end");
        if(window.perfing) performance.measure("fast_updateTargetHeadings", "fast_updateTargetHeadings start", "fast_updateTargetHeadings end");
            
        return updated;
    }

    fast_updateTipHeadings(localizedTipHeadings, scale, hdxStart, sb, myOrigin) {
        if(window.perfing) performance.mark("fast_updateTipHeadings start");
        const modeCode = sb.targetState.getModeCode();
        let updated = 0;
        let hdx = hdxStart;
        const tipOrigin = localizedTipHeadings[hdx];
        let scaleBy = scale ? 1+myOrigin.dist(tipOrigin) : 1;
        let combinedOffset = this.pool.any_Vec3(tipOrigin.x - myOrigin.x, tipOrigin.y -myOrigin.y, tipOrigin.z - myOrigin.z);
        hdx++; updated++;

        if ((modeCode & TargetState.XDir) != 0) {
            localizedTipHeadings[hdx].sub(tipOrigin).mult(scaleBy).add(combinedOffset);
            localizedTipHeadings[hdx+1].sub(tipOrigin).mult(scaleBy).add(combinedOffset);  
            hdx += 2;
            updated+=2;
        }
        if ((modeCode & TargetState.YDir) != 0) {
            localizedTipHeadings[hdx].sub(tipOrigin).mult(scaleBy).add(combinedOffset); ;
            localizedTipHeadings[hdx+1].sub(tipOrigin).mult(scaleBy).add(combinedOffset); ;
            hdx += 2;
            updated+=2;
        }
        if ((modeCode & TargetState.ZDir) != 0) {
            localizedTipHeadings[hdx].sub(tipOrigin).mult(scaleBy).add(combinedOffset); ;
            localizedTipHeadings[hdx+1].sub(tipOrigin).mult(scaleBy).add(combinedOffset); ;
            hdx += 2;
            updated+=2;
        }
        localizedTipHeadings[hdxStart].set(combinedOffset);

        if(window.perfing) performance.mark("fast_updateTipHeadings end");
        if(window.perfing) performance.measure("fast_updateTipHeadings", "fast_updateTipHeadings start", "fast_updateTipHeadings end");   
        return updated;
    }

 * 
    /**Updates the tip headings to match the rotation all of the multiplications to prepare them for any ancestor of this bone,
     * also undoes any scaling or translation it applied to the headings prior to solving. 
     * This concept only works if bases are orthornormal, and it shouldn't be used by tips themselves. but the speedups are significant when you can
     * get away with it.*/

    /**
    post_UpdateTipHeadings(localizedTipHeadings, scale, applyRot) {
        if(window.perfing) performance.mark("post_updateTipHeadings start");
        let hdx = 0;
        if(this.targetState != null) this.simBoneAxes.updateGlobal();
        const myOrigin = this.simLocalAxes.globalMBasis.translate;
        this.applyRotToVecArray(applyRot, localizedTipHeadings, localizedTipHeadings);
        for (let i = 0; i < this.chain.pinnedBones.length; i++) {
            const sb = this.chain.pinnedBones[i];
            const tipOrigin = localizedTipHeadings[hdx];        
            const target = sb.targetState;
            const modeCode = target.getModeCode();
            const combinedOffset = this.pool.any_Vec3(tipOrigin.x +myOrigin.x, tipOrigin.y +myOrigin.y, tipOrigin.z + myOrigin.z);
            
            let origidx = hdx;
            let unscaleBy = scale ? 1/(1+combinedOffset.mag()) : 1;                       
            hdx++;

            if ((modeCode & TargetState.XDir) != 0) {
                localizedTipHeadings[hdx].sub(tipOrigin).mult(unscaleBy).add(combinedOffset);
                localizedTipHeadings[hdx+1].sub(tipOrigin).mult(unscaleBy).add(combinedOffset);   //set(xTip.p2).sub(myOrigin);
                hdx += 2;
            }
            if ((modeCode & TargetState.YDir) != 0) {
                localizedTipHeadings[hdx].sub(tipOrigin).mult(unscaleBy).add(combinedOffset); ;
                localizedTipHeadings[hdx+1].sub(tipOrigin).mult(unscaleBy).add(combinedOffset); ;
                hdx += 2;
            }
            if ((modeCode & TargetState.ZDir) != 0) {
                localizedTipHeadings[hdx].sub(tipOrigin).mult(unscaleBy).add(combinedOffset); ;
                localizedTipHeadings[hdx+1].sub(tipOrigin).mult(unscaleBy).add(combinedOffset); ;
                hdx += 2;
            }
            localizedTipHeadings[origidx].add(myOrigin);
            sb.chain.hasFastPass = true; 
        }
        this.chain.hasFastPass = true;
        if(window.perfing) performance.mark("post_updateTipHeadings end");
        if(window.perfing) performance.measure("post_updateTipHeadings", "post_updateTipHeadings start", "post_updateTipHeadings end");   
    }

    post_UpdateTargetHeadings(localizedTargetHeadings, weights, applyRot) {
        if(window.perfing) performance.mark("post_UpdateTargetHeadings start");
        let hdx = 0;
        if(this.targetState != null) this.simBoneAxes.updateGlobal();
        const workingRay = this.workingRay;
        const myOrigin = this.simLocalAxes.globalMBasis.translate;
        const {XDir, YDir, ZDir} = TargetState;
        for (let i = 0; i < this.chain.pinnedBones.length; i++) {
            const sb = this.chain.pinnedBones[i];            
            let doApplyRot = false;
            let orighdx = hdx;
            if(this.cyclicTargets.has(sb.targetAxes)) { 
                // if the target is a child of the axes we're rotating, we'll need to account for the fact that we're chasing our own tail
                doApplyRot = true;
                applyRot.applyToVec(localizedTargetHeadings[hdx], localizedTargetHeadings[hdx]);
            }
            const targetOrigin =  localizedTargetHeadings[hdx];
            const combinedOffset = this.pool.any_Vec3(targetOrigin.x +myOrigin.x, targetOrigin.y +myOrigin.y, targetOrigin.z + myOrigin.z);
            let painScalar = (1+this.descendantAveragePain[i]);
            const modeCode = sb.targetState.getModeCode();
            hdx++;
            if (modeCode & XDir) {
                let invPain = 1/(painScalar*weights[hdx]);
                if(doApplyRot) {
                    applyRot.applyToVec(localizedTargetHeadings[hdx], localizedTargetHeadings[hdx]);
                    applyRot.applyToVec(localizedTargetHeadings[hdx+1], localizedTargetHeadings[hdx+1]);
                }
                localizedTargetHeadings[hdx].sub(targetOrigin).mult(invPain).add(combinedOffset);
                localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(invPain).add(combinedOffset);  
                hdx += 2;
            }
            if (modeCode & YDir) {
                let invPain = 1/(painScalar*weights[hdx]);
                if(doApplyRot) {
                    applyRot.applyToVec(localizedTargetHeadings[hdx], localizedTargetHeadings[hdx]);
                    applyRot.applyToVec(localizedTargetHeadings[hdx+1], localizedTargetHeadings[hdx+1]);
                }                
                localizedTargetHeadings[hdx].sub(targetOrigin).mult(invPain).add(combinedOffset);
                localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(invPain).add(combinedOffset);                
                hdx += 2;
            }
            if (modeCode & ZDir) {
                let invPain = 1/(painScalar*weights[hdx]);
                if(doApplyRot) {
                    applyRot.applyToVec(localizedTargetHeadings[hdx], localizedTargetHeadings[hdx]);
                    applyRot.applyToVec(localizedTargetHeadings[hdx+1], localizedTargetHeadings[hdx+1]);
                }
                localizedTargetHeadings[hdx].sub(targetOrigin).mult(invPain).add(combinedOffset);
                localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(invPain).add(combinedOffset);     
                hdx += 2;
            }
            localizedTargetHeadings[orighdx].add(myOrigin);
            sb.chain.hasFastPass = true;
        }
        if(window.perfing) performance.mark("post_UpdateTargetHeadings end");
        if(window.perfing) performance.measure("post_UpdateTargetHeadings", "post_UpdateTargetHeadings start", "post_UpdateTargetHeadings end");   
    }

 */