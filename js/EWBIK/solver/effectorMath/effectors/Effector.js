import * as THREE from 'three'; 
import { Ray } from "../../../util/Ray.js";
import { IKPin } from "../../../betterbones/IKpin.js";
import { ShadowNode } from "../../../util/nodes/ShadowNode.js";
import { WorkingBone } from "../../ShadowBones/WorkingBone.js";
import { IKNode, Vec3 } from "../../../EWBIK.js";


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
    boneSet = new Set();
    stopOn = null; //set by trimBones to notify updateInfluences that what would otherwise be considered a mismatch is on purpose.
    inGroups = new Set(); // a set of effector groups this effector belongs to.


    /**@type {Vec3} */
    temp_tipOriginVec = null;
    /**@type {Vec3} */
    temp_targOriginVec = null;
    /**@type {Vec3} */
    temp_boneOriginVec = null;
    
    constructor(armatureEffectors, tip, target) {
        this.tip = tip;
        this.target = target;
        this.targetAxes = target.targetNode;
        this.tipAxes = tip.simTipAxes;
        this.armatureEffectors = armatureEffectors;
        this.armatureEffectors.armature.volatilePool.unfinalize(this);
        this.effectorPool = this.armatureEffectors.effectorPool;
        this.temp_tipOriginVec = this.armatureEffectors.armature.volatilePool.new_Vec3();
        this.temp_targOriginVec = this.armatureEffectors.armature.volatilePool.new_Vec3();
        this.temp_boneOriginVec = this.armatureEffectors.armature.volatilePool.new_Vec3();
    }

    /**updates the list of bones that reach for this effector. The list is created from tip to root.
     * the list ends when either the root is reached or a fully opaque pin is encounterd
     * 
     * @return a sublist specifying the bones reaching for this taerget which themselves modify this target. This is to allow for followup strategy selection to resolve the conflict. The simplest strategy is to just provide the list back to this effector's trimBones function
    */
    updateAffectedBoneList(onBoneAdd) {        
        this.boneSet.clear();
        
        let transparency = 1; // 1 = fully transparent, 0 = fully opaque
        let currBone = this.tip.forBone?.wb;
        let listidx = 0;
        let complistidx = 0;
        let conflictList = [];
        let added = false;
        /**@type {IKPin} */
        let ancestorPin = this.target;

        //there's a special/natural-ish case where a pin can have no weight but be completely opaque, 
        //this is useful to have some pins segment the bone hierarchy but QCP does better when we don't flood it with 0 values so, let's just be nice.
        if((1-this.target.getInfluenceOpacity() == 0) && this.target.getPinWeight() == 0){
            return [];
        }
        onBoneAdd(this.tip);
        this.boneSet.add(this.tip);
        this.tip.register_tempEffector(this, 0);


        while(currBone instanceof WorkingBone) {
            
            if(this.wboneList.length <= listidx) {
                this.wboneList.push(currBone);
                added = true;
            }
            else this.wboneList[listidx] = currBone;

            this.boneSet.add(currBone);
            onBoneAdd(currBone);

            if(this.target.targetNode.hasAncestor(currBone.simLocalAxes)) {
                conflictList.push(currBone); 
            }

            currBone.register_tempEffector(this, listidx);

            if(this.visibilityWeightedList.length <= listidx) 
                this.visibilityWeightedList.push(1);

            currBone = currBone.forBone.parent;
            listidx++;
            complistidx+=4;

            if(currBone instanceof THREE.Bone) 
                currBone = currBone.wb;
            else
                break;

            ancestorPin = currBone.forBone.getIKPin();
            if(ancestorPin != null && ancestorPin.isEnabled()) {
                transparency *= (1-ancestorPin.getInfluenceOpacity());
            }
            if(transparency == 0) break;
        }
        if(this.wboneList.length-1 > listidx) {
            this.wboneList.splice(listidx, this.wboneList.length-listidx);
            this.visibilityWeightedList.splice(listidx, this.wboneList.length-listidx);
        }

        return conflictList;
    }

    /**update the list containing how visible this pin is to each ancestor bone 
     * @return {boolean} indicates if the need for regeneration was detected. If this returns true, some topological change has occurred without a proper call to regenerateShadowSkeleton.
     * TODO: decide if it's reasonable to automatically regenerate the shadow skeleton on mismatch detection, or whether to throw an error instead
     */
    updateInfluenceOpacityList() {        
        let transparency = 1; // 1 = fully transparent, 0 = fully opaque
        let mismatch = false;
        let myWeight = this.target.getPinWeight();
        let listidx = 0; let complistidx = 0;
        let currBone = this.target.forBone;
        let ancestorPin = this.target;

        //there's a special/natural-ish case where a pin can have no weight but be completely opaque, 
        //this is useful to have some pins segment the bone hierarchy but QCP does better when we don't flood it with 0 values so, let's just be nice.
        if((1-this.target.getInfluenceOpacity() == 0) && this.target.getPinWeight() == 0){
            return this.wboneList > 0;
        }

        while(currBone instanceof THREE.Bone) {
           
            if(this.visibilityWeightedList.length <= listidx) {
                 this.visibilityWeightedList.push(transparency*myWeight);
                 mismatch = true;
            }
            else {
                this.visibilityWeightedList[listidx] = transparency*myWeight;
            }
            
            listidx++; complistidx ++;

            if(!(currBone.parent instanceof THREE.Bone))
                break;

            currBone = currBone.parent;
            if(currBone == this.stopOn?.forBone) 
                break;
             
            let ancestorPin = currBone.getIKPin();
            if(ancestorPin != null && ancestorPin.isEnabled()) {
                transparency *= (1-ancestorPin.getInfluenceOpacity());
            }
            if(transparency == 0) break;
            
        }

        if(this.visibilityWeightedList.length > this.wboneList.length) {
            this.visibilityWeightedList.splice(listidx, this.wboneList.length-listidx);
            mismatch = true;
        }
        
        return mismatch;
    }


    /**
     * removes the workingbones in the provided list from this effector. Note that the workingbone needs to have an unfinalized effectorlist for this to work
     */
    trimBones(bonelist) {
        let curridx = 0;
        for(let wb of bonelist) { 
            curridx = this.wboneList.indexOf(wb);
            this.wboneList.splice(curridx, 1);
            this.visibilityWeightedList.splice(curridx, 1);
            this.boneSet.delete(wb);
            wb.register_tempEffector(this, -1);
        }
        this.stopOn = this.wboneList[this.wboneList.length-1];
    }


    /**
     * @param {Number} startIdx the start index of the headings array and outWeightArray. The headings will be written into the provided arrays starting at this index
     * @param {[Vec3]} targHeadingsArray an array of vectors into which the target headings will be stored
     * @param {[Vec3]} tipHeadingsArray an array of vectors into which the tip headings will be stored
     * @param {[Number]} outWeightArray an array of numbers into which the relative weights of each heading will be stored 
     * @param {Number} descendantPainTotal the total discomfort of all pinned descendant bones the requesting bone is attempting to solve for. This is used to scale the weights of this pin such that if the total pain tracked by affected bones toward this pin is less than the total pain across all descendant pins, then this pin loses priority, because it has more opportunity to reach the target via more comfortable bones.
     * @param {Number} totalTargetCount number of targets the bone is attempting to solve for. This is used as part of the pain weighting calculation
     * @param {Number} boneIdx the index of the entry corresponding to the requesting bone in this pin's wboneList array. This is used to determine the total pain with respect only to the descendants of the given bone
     * @param {WorkingBone} boneRef a reference to the WorkingBone being solved for
     * @param {Boolean} doScale Whether or not to scale the headings as per the targetScales parameter. This is basically just to prevent an outsized effect when translation and distanceBased orientation are both enabled.
     * @returns the number of entries that were written into, such that @param startIdx + returned value yields the next index it would be safe to write into
     */
    updateHeadings(startIdx, targHeadingsArray, tipHeadingsArray, outWeightArray, descendantPainTotal, totalTargetCount, boneIdx, boneRef, doScale) {
        
        const pin = this.target;
        let currIdx = startIdx;
        let nextIdx = currIdx+1;
        let writeCount = 0;
        let pos_priority = pin._positionPriority;
        let myDescendantsPain = boneIdx == 0 ? 0 : this.wboneList[boneIdx-1].currentPain;
        let painScalar = 1;//TODO: fix this so it doesn't go over 1./(1+myDescendantsPain)/(descendantPainTotal + totalTargetCount);
        let visibilityWeight = this.visibilityWeightedList[boneIdx];
        let painWeighted = painScalar*visibilityWeight;

        
        const targetAxes = this.targetAxes;
        const tipAxes = this.tipAxes;
        const tipOrigin = tipAxes.origin(this.temp_tipOriginVec);
        const targetOrigin = targetAxes.origin(this.temp_targOriginVec);
        const boneOrigin =  boneRef.simLocalAxes.origin(this.temp_boneOriginVec);
        
        targetOrigin.lerp(tipOrigin, 1-(painScalar*pos_priority*visibilityWeight));
        
        let distScaled = doScale ? 1+boneOrigin.dist(targetOrigin) : 1; 
        
        const localizedTargOrig = targHeadingsArray[currIdx].set(targetOrigin).sub(boneOrigin);
        const localizedTipOrig = tipHeadingsArray[currIdx].set(tipOrigin).sub(boneOrigin);
        outWeightArray[currIdx] = painWeighted * pin.positionPriority;
        writeCount++; currIdx++; nextIdx++;
        
        if(pin._swingMagnitude > 0) {
            outWeightArray[currIdx] = outWeightArray[nextIdx] = painWeighted * pin.swingPriority;
            targetAxes.setVecToOrthonGlobalHeading(pin._scaled_swing_heading, targHeadingsArray[currIdx]).mult(distScaled); //.mult(outWeights[currIdx]).mult(scaleBy);
            targHeadingsArray[currIdx].multInto(-1, targHeadingsArray[nextIdx]).add(localizedTargOrig);
            targHeadingsArray[currIdx].add(localizedTargOrig);

            tipAxes.setVecToOrthonGlobalHeading(pin._scaled_swing_heading, tipHeadingsArray[currIdx]).mult(distScaled); //.mult(outWeights[currIdx]).mult(scaleBy);
            tipHeadingsArray[currIdx].multInto(-1, tipHeadingsArray[nextIdx]).add(localizedTipOrig);
            tipHeadingsArray[currIdx].add(localizedTipOrig);

            writeCount+=2; currIdx += 2; nextIdx+=2
        }
        if (pin._twistMagnitude > 0) {
            outWeightArray[currIdx] = outWeightArray[nextIdx] = painWeighted * pin.twistPriority;
            targetAxes.setVecToOrthonGlobalHeading(pin._scaled_twist_heading, targHeadingsArray[currIdx]).mult(distScaled); //.mult(outWeights[currIdx]).mult(scaleBy);
            targHeadingsArray[currIdx].multInto(-1, targHeadingsArray[nextIdx]).add(localizedTargOrig);
            targHeadingsArray[currIdx].add(localizedTargOrig);

            tipAxes.setVecToOrthonGlobalHeading(pin._scaled_twist_heading, tipHeadingsArray[currIdx]).mult(distScaled); //.mult(outWeights[currIdx]).mult(scaleBy);
            tipHeadingsArray[currIdx].multInto(-1, tipHeadingsArray[nextIdx]).add(localizedTipOrig);
            tipHeadingsArray[currIdx].add(localizedTipOrig);

            writeCount+=2; currIdx += 2; nextIdx+=2
        }
        return writeCount;
    }

    /**
     * @param {Number} startIdx the start index of the headings array and outWeightArray. The headings will be written into the provided arrays starting at this index
     * @param {[Vec3]} headingsArray an array of vectors into which the headings will be stored
     * @param {[Number]} outWeightArray an array of numbers into which the relative weights of each heading will be stored 
     * @param {Number} descendantPainTotal the total discomfort of all pinned descendant bones the requesting bone is attempting to solve for. This is used to scale the weights of this pin such that if the total pain tracked by affected bones toward this pin is less than the total pain across all descendant pins, then this pin loses priority, because it has more opportunity to reach the target via more comfortable bones.
     * @param {Number} totalTargetCount number of targets the bone is attempting to solve for. This is used as part of the pain weighting calculation
     * @param {Number} boneIdx the index of the entry corresponding to the requesting bone in this pin's wboneList array. This is used to determine the total pain with respect only to the descendants of the given bone
     * @param {WorkingBone} boneRef a reference to the WorkingBone being solved for
     * @param {Boolean} doScale Whether or not to scale the headings as per the targetScales parameter. This is basically just to prevent an outsized effect when translation and distanceBased orientation are both enabled.
     * @returns the number of entries that were written into, such that @param startIdx + returned value yields the next index it would be safe to write into
     */
    updateTargetHeadings(startIdx, headingsArray, outWeightArray, descendantPainTotal, totalTargetCount, boneIdx, boneRef, doScale) {
        let currIdx = startIdx;
        let nextIdx = currIdx+1;
        let writeCount = 0;
        let complistidx = boneIdx*4;
        let cwv = this.componentWiseVisibilityWeightedList;
        let pos_priority = this.visibilityWeightedList[boneIdx];
        let myDescendantsPain = boneIdx == 0 ? 0 : this.wboneList[boneIdx-1].currentPain;
        let painScalar = 1;//TODO: fix this so it doesn't go over 1./(1+myDescendantsPain)/(descendantPainTotal + totalTargetCount);
        let painWeighted = painScalar*pos_priority;

        const pin = this.target;
        const targetAxes = this.targetAxes;
        const tipOrigin = this.tipAxes.origin(this.temp_tipOriginVec);
        const targetOrigin = targetAxes.origin(this.temp_targOriginVec);
        const boneOrigin =  boneRef.simLocalAxes.origin(this.temp_boneOriginVec);
        
        targetOrigin.lerp(tipOrigin, 1-painWeighted);
        
        let distScaled = doScale ? 1+boneOrigin.dist(targetOrigin) : 1; 
        
        
        const localizedOrig = headingsArray[currIdx].set(targetOrigin).sub(boneOrigin);
        outWeightArray[currIdx] = painWeighted;
        writeCount++; currIdx++; nextIdx++;
        
        painWeighted = pin.swingPriority*painScalar;
        if(painWeighted > 0) {
            outWeightArray[currIdx] = outWeightArray[nextIdx] = painWeighted;
            targetAxes.setVecToOrthonGlobalHeading(pin.swingHeading, headingsArray[currIdx]).mult(distScaled); //.mult(outWeights[currIdx]).mult(scaleBy);
            headingsArray[currIdx].multInto(-1, headingsArray[nextIdx]).add(localizedOrig);
            headingsArray[currIdx].add(localizedOrig);
            writeCount+=2; currIdx += 2; nextIdx+=2
        }
        painWeighted = pin.twistPriority*painScalar;
        if (painWeighted > 0) {
            outWeightArray[currIdx] = outWeightArray[nextIdx] = painWeighted;
            targetAxes.setVecToOrthonGlobalHeading(pin.twistHeading, headingsArray[currIdx]).mult(distScaled); //.mult(outWeights[currIdx]).mult(scaleBy);
            headingsArray[currIdx].multInto(-1, headingsArray[nextIdx]).add(localizedOrig);
            headingsArray[currIdx].add(localizedOrig);


            writeCount+=2; currIdx += 2; nextIdx+=2
        }
        return writeCount;
    }


    /**
     * @param {Number} startIdx the start index of the headings array and outWeightArray. The headings will be written into the provided arrays starting at this index
     * @param {[Vec3]} headingsArray an array of vectors into which the headings will be stored in
     * @param {Number} boneIdx the index of the entry corresponding to the requesting bone in this pin's wboneList array. This is used to determine the total pain with respect only to the descendants of the given bone
     * @param {Boolean} doScale Whether or not to scale the headings as per the targetScales parameter. This is basically just to prevent an outsized effect when translation and distanceBased orientation are both enabled.
     * @returns the number of entries that were written into, such that @param startIdx + returned value yields the next index it would be safe to write into
     */
    updateTipHeadings(startIdx, headingsArray, boneIdx, boneRef, doScale) {
        let currIdx = startIdx;
        let nextIdx = currIdx+1;
        let writeCount = 0;

        let complistidx = boneIdx*4;

        const pin = this.target;
        const tipAxes = this.tipAxes;
        const tipOrigin = tipAxes.origin(this.temp_tipOriginVec);
        const targetOrigin = this.targetAxes.origin(this.temp_targOriginVec);
        const boneOrigin = boneRef.simLocalAxes.origin(this.temp_boneOriginVec);
        let pos_normweight_complement = 1-this.componentWiseVisibilityWeightedList[complistidx];
        let distScaled = doScale ? pos_normweight_complement + boneOrigin.dist(targetOrigin) : pos_normweight_complement; 
        let cwv = this.componentWiseVisibilityWeightedList;
        
       
        const localizedOrig = headingsArray[currIdx].set(tipOrigin).sub(boneOrigin);
        writeCount++; currIdx++; nextIdx++;

        let visibilityWeighted = this.componentWiseVisibilityWeightedList[complistidx+1];
        if(visibilityWeighted > 0) {
            tipAxes.setVecToOrthonGlobalHeading(pin._scaled_swing_heading, headingsArray[currIdx]).mult(distScaled);
            headingsArray[currIdx].multInto(-1, headingsArray[nextIdx]).add(localizedOrig);
            headingsArray[currIdx].add(localizedOrig);
            writeCount+=2; currIdx += 2; nextIdx+=2
        }
        visibilityWeighted = this.componentWiseVisibilityWeightedList[complistidx+2];
        if (visibilityWeighted > 0) {
            tipAxes.setVecToOrthonGlobalHeading(pin._scaled_twist_heading, headingsArray[currIdx]).mult(distScaled * target._yScale);
            headingsArray[currIdx].multInto(-1, headingsArray[nextIdx]).add(localizedOrig);
            headingsArray[currIdx].add(localizedOrig);
            writeCount+=2; currIdx += 2; nextIdx+=2
        }
        return writeCount;
    }


    registerGroup(eg) {
        this.inGroups.add(eg);
    }

    unregisterGroup(eg) {
        this.inGroups.delete(eg);
    }

    /**intended for classes extending this one */
    optimStep_Start(wboneRef, boneIdx) {

    }

    /**intended for classes extending this one */
    optimStep_End(wboneRef, boneIdx) {

    }

     /**intended for classes extending this one */
     iteration_Start() {

     }

    /**prints the list of bones going toward this effector */
    toConsole() {
        console.group(`${this.target.forBone.name}`);
        for(let wb of this.wboneList) console.log(wb.forBone.name);
        console.groupEnd(`${this.target.forBone.name}`);

    }
}

