import { Vec3, Vec3Pool } from "../util/vecs.js";
import {Rot} from "../util/Rot.js";
import {QCP} from "../util/QCP.js";
import { IKPin } from "../betterbones/IKpin.js";
import { Rest } from "../betterbones/Constraints/Rest/Rest.js";
import { Limiting, LimitingReturnful, Returnful } from "../betterbones/Constraints/Constraint.js";
import { IKNode } from "../util/nodes/IKNodes.js";
import { WorkingBone } from "./WorkingBone.js";
import { FakeEffector } from "./effector.js";

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

    /**@type {[Effector|FakeEffector]} a list of all of the effectors or fake effectors common to all bones on this chain*/
    effectors = [];

    constructor(shadowSkel, startingFrom, parentSegment, hasPinnedAncestor) {
        this.volatilePool = shadowSkel.volatilePool;
        this.stablePool = shadowSkel.stablePool;
        this.shadowSkel = shadowSkel;
        this.effectorPool = this.shadowSkel.effectorPool;
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
            let target = currentBS.getIKPin()?.isEnabled() ? currentBS.getIKPin() : null;
            const childBones = currentBS.getChildBoneList();
            const childCount = childBones.length;
            if (target != null ||  childCount > 1) { //split condition
                 /*We only add a bone to the list of effectors if its pin actually has an effect.
                  But we still let the fact that a pin of 0 weight is enabled be meaningful because it allows for 
                 some fancy tricks with parenting that would otherwise result in an armature chasing its own tail
                 (check the actuators in the spot demo for example).
                 Basically, this just means the pin is behaving as a hint to the solver that it should forcibly treat
                 two segments as seperate.
                 */
                if (target != null && target.getPinWeight() > 0)
                    segEffectors.push(currentWB);
                if (target?.getInfluenceOpacity() >= 1.0 || childCount == 0) {
                    finished = true;
                    this.wb_segmentTip = currentWB;
                    currentWB.isTerminal = true;
                    for (let i = 0; i < childCount; i++) 
                        childSgmts.push(new ArmatureSegment(this.shadowSkel, childBones[i], this, true));
                } else {
                    for (let i = 0; i < childCount; i++) {
                        this.wb_segment_splitend = currentWB;
                        const subseg = new ArmatureSegment(this.shadowSkel, childBones[i], this, false);
                        immediateSubSgmts.push(subseg);
                        subSgmts.push(subseg);
                        subSgmts.push(...subseg?.subSegments);
                        segEffectors.push(...subseg.pinnedBones);
                    }
                    finished = true;
                    this.wb_segmentTip = currentWB; //still mark as
                }
                
            } else if (childCount == 1) {
                currentBS = childBones[0];
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
        if(segEffectors.length > 0)
            this.solvableStrandBones = strandBones;
        else
            this.solvableStrandBones = [];
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
        console.group(`seg start: ${this.wb_segmentRoot.forBone.name}`);
        for(let sb of this.solvableStrandBones) {
            console.groupCollapsed('my weights');
            console.log(sb.myWeights);
            console.groupEnd('my weights');
            currentDepth++;
        }
        for(let iss of this.immediateSubSegments) {
            iss.toConsole(currentDepth);
        }
        console.groupEnd(`seg start: ${this.wb_segmentRoot.forBone.name}`);
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
            wb.myWeights = this.weights;
            wb.painWeights = [...this.weights];
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
                this.boneCenteredTargetHeadings.push(this.volatilePool.new_Vec3());
                this.boneCenteredTipHeadings.push(this.volatilePool.new_Vec3());
                this.uniform_boneCenteredTipHeadings.push(this.volatilePool.new_Vec3());
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
            const target = this.wb_segmentTip.ikPin;
            if (target != null) {
                const innerWeightArray = [];
                weightArray.push(innerWeightArray);
                const targWeight = target.isEnabled() ? target.getPinWeight() : 0;                
                if(targWeight > 0) { 
                    this.wb_segmentTip.modeCode = target.getModeCode();
                    this.wb_segmentTip.maxModeCode = Math.max(this.wb_segmentTip.modeCode, this.wb_segmentTip.maxModeCode);
                    const modeCode = target.getModeCode();
                    innerWeightArray.push(targWeight * currentFalloff);
                    if ((modeCode & IKPin.XDir) != 0) {
                        const subTargetWeight = targWeight * target.getNormedPriority(IKPin.XDir) * currentFalloff;
                        innerWeightArray.push(subTargetWeight);
                        innerWeightArray.push(subTargetWeight);
                    }
                    if ((modeCode & IKPin.YDir) != 0) {
                        const subTargetWeight = targWeight * target.getNormedPriority(IKPin.YDir) * currentFalloff;
                        innerWeightArray.push(subTargetWeight);
                        innerWeightArray.push(subTargetWeight);
                    }
                    if ((modeCode & IKPin.ZDir) != 0) {
                        const subTargetWeight = targWeight * target.getNormedPriority(IKPin.ZDir) * currentFalloff;
                        innerWeightArray.push(subTargetWeight);
                        innerWeightArray.push(subTargetWeight);
                    }
                    pinSequence.push(this.wb_segmentTip);
                }
                
            }
            const thisFalloff = target == null ? 0 : target.getInfluenceOpacity();
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

export default ArmatureSegment;
