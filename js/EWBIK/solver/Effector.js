import * as THREE from 'three'; 
import { Ray } from "../util/Ray.js";
import { Rot } from "../util/Rot.js";
import { IKPin } from "../betterbones/IKpin.js";
import { ShadowNode } from "../util/nodes/ShadowNode.js";
import { WorkingBone } from "./WorkingBone.js";
import { IKNode, Vec3, Vec3Pool } from "../EWBIK.js";

export class Effector {
    

    oidx = 0; //index of position vector / weights
    xidx = 1; yidx = 3; zidx=5; //indices of positive basis directions
    xidx_n = 2; yidx_n = 4; //indices of negative basis directions
    /**@type {WorkingBone}*/
    tip = null;
    /**@type {IKPin}*/
    target = null;
    wboneList = [];
    visibilityWeightedList = [];
    bonePainTotals = [];
    
    constructor(effectorPool, tip, target) {
        this.tip = tip;
        this.target = target;
        this.effectorPool = effectorPool;
        this.wboneList.push(tip);
        this.visibilityWeightedList.push(1);
    }

    /**updates the list of bones that reach for this effector. The list is created from tip to root.
     * the list ends when either the root is reached or the a fully opaque pin is encounterd
    */
    updateAffectedBoneList() {        
        let transparency = 1; // 1 = fully transparent, 0 = fully opaque
        let currBone = this.tip;
        let listidx = 0;
        while(currBone instanceof THREE.Bone) {
            if(this.wboneList.length <= listidx) this.wboneList.push(currBone);
            else this.wboneList[listidx] = currBone;
            
            /**@type {IKPin} */
            let ancestorPin = currBone.getIKPin();
            if(ancestorPin != null) {
                transparency *= (1-ancestorPin.getInfluenceOpacity());
            }
            if(transparency == 0) break;
                currBone = currBone.parent;
            listidx++;
        }
        if(this.wboneList.length > listidx) {
            this.wboneList = this.wboneList.slice(0, listidx);
            this.visibilityWeightedList = this.wboneList.slice(0, listidx);
        }
    }

    /**update the list containing how visible this pin is to each ancestor bone 
     * @return {boolean} indicates if the need for regeneration was detected. If this returns true, some topological change has occurred without a proper call to regenerateShadowSkeleton.
     * TODO: decide if it's reasonable to automatically regenerate the shadow skeleton on mismatch detection, or whether to throw an error instead
     */
    updateInfluenceOpacityList() {
        let currBone = this.tip.forBone.parent;
        let transparency = 1; // 1 = fully transparent, 0 = fully opaque
        let mismatch = false;
        let myWeight = pin.getPinWeight();
        while(currBone instanceof THREE.Bone) {
            if(this.visibilityWeightedList.length <= listidx) {
                 this.visibilityWeightedList.push(transparency * myWeight);
                 mismatch = true;
            }
            else visibilityWeightedList[listidx] = transparency;
            
            if(transparency == 0) break;
            currBone = currBone.parent;
            listidx++;
            
            /**@type {IKPin} */
            let ancestorPin = currBone.getIKPin();
            if(ancestorPin != null) {
                transparency *= (1-ancestorPin.getInfluenceOpacity());
            }            
        }

        if(this.visibilityWeightedList.length > listidx) {
            this.visibilityWeightedList = this.visibilityWeightedList.slice(0, listidx);
            mismatch = true;
        }
       return mismatch;
    }

    /**
     * 
     * @param {Number} startIdx the start index of the headings array and outWeightArray. The headings will be written into the provided arrays starting at this index
     * @param {[Vec3]} headingsArray an array of vectors into which the headings will be stored
     * @param {[Number]} outWeightArray an array of numbers into which the relative weights of each heading will be stored 
     * @param {Number} descendantPainTotal the total discomfort of all pinned descendant bones the requesting bone is attempting to solve for. This is used to scale the weights of this pin such that if the total pain tracked by affected bones toward this pin is less than the total pain across all descendant pins, then this pin loses priority, because it has more opportunity to reach the target via more comfortable bones.
     * @param {Number} totalTargetCount number of pins the bone is attempting to solve for. This is used as part of the pain weighting calculation
     * @param {Number} boneIdx the index of the entry corresponding to the requesting bone in this pin's wboneList array. This is used to determine the total pain with respect only to the descendants of the given bone
     * @param {Boolean} doScale Whether or not to scale the headings as per the targetScales parameter. This is basically just to prevent an outsized effect when translation and distanceBased orientation are both enabled.
     * @returns the next index which it would be safe to write into
     */
    updateTargetHeadings(startIdx, headingsArray, outWeightArray, descendantPainTotal, totalTargetCount, boneIdx, doScale) {
        let currIdx = startIdx;
        let nextIdx = currIdx+1;
        const sb = this.chain.pinnedBones[i];
        const targetAxes = sb.simTargetAxes;
        const tipOrigin = this.tipAxes.origin();
        targetAxes.updateGlobal();

        let myDescendantsPain = boneIdx == 0 ? 0 : this.bonePainTotals[boneIdx-1];
        let painScalar = (1+myDescendantsPain)/(descendantPainTotal + totalTargetCount);

        localizedTargetHeadings[currIdx].set(targetAxes.origin()).sub(origin);
        const localizedOrig = localizedTargetHeadings[currIdx];
        let painWeighted = painScalar*this.visibilityWeightedList[boneIdx];
        let distScaled = doScale ? 1 + origin.dist(tipOrigin) : 1; 

        outWeightArray[currIdx] = painWeighted;
        const modeCode = pin.modeCode;
        currIdx++;
        let normed_priorities = pin.normed_priorities;
        if (modeCode & IKPin.XDir) {
            outWeightArray[currIdx] = outWeights[nextIdx] = painWeighted * normed_priorities[IKPin.XDir];
            targetAxes.setToOrthon_XHeading(localizedTargetHeadings[currIdx]).mult(distScaled * pin.xScale); //.mult(outWeights[currIdx]).mult(scaleBy);
            headingsArray[nextIdx].multInto(-1, localizedTargetHeadings[currIdx]).add(localizedOrig);
            headingsArray[currIdx].add(localizedOrig);
            currIdx += 2; nextIdx+=2
        }
        if (modeCode & IKPin.YDir) {
            outWeightArray[currIdx] = outWeights[nextIdx] = painWeighted * normed_priorities[IKPin.YDir];
            targetAxes.setToOrthon_YHeading(localizedTargetHeadings[currIdx]).mult(distScaled * pin.yScale); //.mult(outWeights[currIdx]).mult(scaleBy);
            headingsArray[nextIdx].multInto(-1, localizedTargetHeadings[currIdx]).add(localizedOrig);
            headingsArray[currIdx].add(localizedOrig);
            currIdx += 2; nextIdx+=2
        }
        if (modeCode & IKPin.ZDir) {
            outWeightArray[currIdx] = outWeights[nextIdx] = painWeighted * normed_priorities[IKPin.ZDir];
            targetAxes.setToOrthon_ZHeading(localizedTargetHeadings[currIdx]).mult(distScaled * pin.zScale);; //.mult(outWeights[currIdx]).mult(scaleBy);
            headingsArray[nextIdx].multInto(-1, localizedTargetHeadings[currIdx]).add(localizedOrig);
            headingsArray[currIdx].add(localizedOrig);
            currIdx += 2; nextIdx+=2
        }
        
        return currIdx;
    }
}


export class FakeEffector extends Effector {
    xPriority = 1;
    yPriority = 1;
    zPriority = 1;
    weight = 1; 
    
    xScale = 1;
    yScale = 1;
    zScale = 1;

    tipAxes = null;
    targetAxes = null;
    pool = null;

    /**
     * similar to effector but takes raw axes as input. This allows you to make untrue claims about which things are reaching for what.
     * this is useful primarily for resolving dependency conflicts (cycles in the mixed graph of influences) 
     * By default fakeeffectors have max weights on all components
     * 
    */
   /**
    * 
    * @param {Vec3Pool} effectorPool backing effectorpool instance
    * @param {IKNode} tipAxes 
    * @param {IKNode} targetAxes 
    */
    constructor(effectorPool, tipAxes, targetAxes) {   
        super(effectorPool, null, null)

    }


    updateAffectedBoneList() {
        //override because fake pins have whatever bones we tell them to
    }
}


/**stores data shared by all effectors on an armature in pursuit of efficiency, but not shared across armatures due to cowardice*/
export class ArmatureEffectors {
    /**to take advantage of spatial locality / save space / try to maximize l1 cache hits 
     * we try to hold all target and tip headings across all segments of an armature in 
     * dedicated buffers mapping to contiguous regions of memory.
    */
    weightArray = null;
    tipHeadings = null;
    targetHeadings = null;    
    effectorPool = null;
    poolSize = 0;

    constructor(poolSize) {
        this.poolSize = poolSize;
        //immediately finalize the pool, since we don't want it growing to accommodate anything
        this.effectorPool = new Vec3Pool(this.poolSize, this).finalize();
    }
}