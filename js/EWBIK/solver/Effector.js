import * as THREE from 'three'; 
import { Ray } from "../util/Ray.js";
import { Rot } from "../util/Rot.js";
import { IKPin } from "../betterbones/IKpin.js";
import { ShadowNode } from "../util/nodes/ShadowNode.js";
import { WorkingBone } from "./WorkingBone.js";
import { IKNode, Vec3, Vec3Pool } from "../EWBIK.js";
import {QCP} from "../util/QCP.js";


export class EffectorGroup {
    effectors = null;
    /**@type {[WorkingBone]} list of bones that all effectors in this group have in common, sorted from descendant to ancestor*/
    bonelist = [];
    boneSet = null;
    deduped = false;
    effectorSet = null;

    constructor(effectorList) {
        this.effectors = effectorList;
        this.effectorSet = new Set(this.effectors); 
        this.generateBoneList();
        for(let e of this.effectors) {
            e.registerGroup(this);
        }
    }

    /**unregisters this group from any effectors */
    kill() {
        for(let e of this.effectors) {
            e.unregisterGroup(this);
        }
        return this;
    }

    /**generates a list of bones that all effectors in this group have in common, sorted from descendant to ancestor*/
    generateBoneList() {
        let _boneSet = new Set();
        for(let e of this.effectors) {
            for(let wb of e.wboneList) {
                _boneSet.add(wb);
            }
        }
        for(let e of this.effectors) {
            _boneSet = _boneSet.intersection(new Set(e.wboneList));
        }
        this.bonelist = [..._boneSet];
        this.boneSet = _boneSet;
    }

    /**
     * Takes a list of effector groups and considers just the groups which are supersets of this group.
     * prunes this group's bonelist to contain only the bones not in the union of this group's bonelist and the superset group's bonelist 
     * 
     * (there should be no situation in which an intersection of effector groups is not due to one being a superset of the other so long as each each target can only be reached for by one bone and the the bones are in a tree structure)
     * @param {[EffectorGroups]} othergroups 
     */
    dedupe(othergroups) {     
        for(let eg of othergroups) {
            let intersect = this.effectorSet.intersection(eg.effectorSet);
            if(intersect.size == this.effectorSet.size && !this.effectorSet.equals(eg.effectorSet)) {
                let boneunion = this.boneSet.union(eg.boneSet);
                this.boneSet = boneunion.not_in(eg.boneSet); 
            }
        }
        this.bonelist = [...this.boneSet];
        this.deduped = true; 
    }

    /**sets this effectorgroups list as the canonical one its workingbones should use*/
    assign() {
        for(let wb of this.bonelist) {
            wb.assignEffectors(this.effectors);
        }
    }

    /**prints just the common bone list */
    toConsole() {
        for(let b of this.bonelist) {
            console.log(`${b.forBone.name}`);
        }
    }

    /**prints all effector bonelists in a table for comparison */
    toTable() {
        let effectors = this.effectors;
        let maxLength = Math.max(...effectors.map(eff => eff.wbonelist.length));
        let tableData = Array.from({ length: maxLength }, () => ({}));
        effectors.forEach((effector, index) => {
        for (let i = 0; i < maxLength; i++) {
            let wboneName = effector.wbonelist[i] ? effector.wbonelist[i].forBone.name : '';
            tableData[i][`Effector ${index + 1}`] = wboneName;
        }});
        console.table(tableData);
    }
}


/**stores data shared by all effectors on an armature in pursuit of efficiency, but not shared across armatures due to cowardice*/
export class ArmatureEffectors {
    /**to take advantage of spatial locality / save space / try to maximize l1 cache hits 
     * we try to hold all target and tip headings across all segments of an armature in 
     * dedicated buffers mapping to contiguous regions of memory.
    */
    weightArray = [];
    tipHeadings = [];
    targetHeadings = [];    
    effectorPool = null;
    poolSize = 0;
    all_effectors = [];
    effectorGroups = [];
    activeShadowSkel = null;
    solvableBoneSet = new Set();
    solvableBones = [];
    qcpConverger = null;
    tempRot = null;
    
    constructor(poolSize, armature) {
        this.poolSize = poolSize;
        this.armature = armature;
        this.tempRot = new Rot(1,0,0,0);
        //immediately finalize the pool, since we don't want it growing to accommodate anything
        this.effectorPool = new Vec3Pool(this.poolSize, this).finalize();
        let bufferCount = this.poolSize/2;
        for(let i=0; i<bufferCount; i++){
            this.tipHeadings.push(this.effectorPool.any_Vec3());
            this.targetHeadings.push(this.effectorPool.any_Vec3());
            this.weightArray.push(1);
        }
        this.qcpConverger = new QCP(64);
    }

    /**(re)initializes instances of effectors for this armature*/
    initEffectors(shadowSkel) {
        this.activeShadowSkel = shadowSkel;
        for(let b of this.armature.bones) {
            if(b.wb == null) {
                this.armature.stablePool.unfinalize(this);
                new WorkingBone(b, this);
            }
            else {
                b.wb.updateState(this);
            }
        }
        this.all_effectors.splice(0, this.all_effectors.length);
        for(let [pin, bone] of this.armature.pinBoneMap) {
            if(pin.isEnabled()) {
                this.all_effectors.push(new Effector(this.effectorPool, bone.wb, pin));
            }
        }

        this.updateEffectorBoneLists();
        this.consolidateEffectors();
        this.updateSolveOrder();

        /**notify the bones of which effectors to care about */
        for(let eg of this.effectorGroups) {
            eg.assign();
        }

        return this;
    }



    getDampening() {
        return this.activeShadowSkel.baseDampening;
    }

    /**for each effector, updates the list of bones it affects and the list of influences it has on those bones*/
    updateEffectorBoneLists() {
        this.solvableBoneSet.clear();
        
        let onBoneAdd = (wb) => {
            if(!this.solvableBoneSet.has(wb)) {
                wb.clear_tempEffectorList();
                wb.rootSegment = null;
                this.solvableBoneSet.add(wb);
            }
        }
        let conflictingMap = new Map();
        for(let e of this.all_effectors) {
            let conflicts = e.updateAffectedBoneList(onBoneAdd); 
            if(conflicts.length > 0) conflictingMap.set(e, conflicts);
        }
        for(let e of this.all_effectors) {
            e.updateInfluenceOpacityList();
        }

        for(let [effector, bonelist] of conflictingMap) {
            effector.trimBones(bonelist);
        }
        for(let wb of this.solvableBoneSet) {
            wb.finalize_tempEffectors();
            if(wb._tempEffectorList.length == 0) {
                this.solvableBoneSet.delete(wb);
                wb.clear_tempEffectorList();
                wb.finalize_tempEffectors();
            }
            
        }

        this.solvableBones = [...this.solvableBoneSet];


        for(let wb of this.solvableBones) {
            wb.updateSolvableChildren();
        }
    }

    
    /**
     * heavy operation with O(n^2). Only run on shadowskeleton regeneration.
     * 
     * Compares the effectorlist of all bones, and sets any bones with identical lists to refer to the same list.
     */
    consolidateEffectors() {
        let uniqueSets = [];
        let uniqueLists = [];
        let candidateGroups = new Set();
        this.effectorGroups.splice(0, this.effectorGroups.length-1);

        for(let wb of this.solvableBones) {            
            let wbEffectorSet = new Set(wb._tempEffectorList);
            let found = false;
            for(let i =0; i<uniqueSets.length; i++) {
                if(uniqueSets[i].equals(wbEffectorSet)) {
                    found = true;
                    break;
                }
            }
            if(!found) {
                if(wb._tempEffectorList.length > 0 ) {
                    uniqueSets.push(wbEffectorSet);
                    uniqueLists.push(wb._tempEffectorList);
                }
            }
        }
        for(let ul of uniqueLists) {
            candidateGroups.add(new EffectorGroup(ul));
        }
        for(let e of this.all_effectors) {
            for(let eig of e.inGroups) {
                eig.dedupe(e.inGroups.not_in(new Set([eig])));
            }
        }
        for(let cg of candidateGroups) {
            if(cg.bonelist.length == 0) 
                candidateGroups.delete(cg.kill());
        }        
        this.effectorGroups = [...candidateGroups];
    }

    /**
     * determines the order in which to traverse the bone list when solving. 
     * There are only two rules, and both of which must be broken by a secret third rule at solve time
     * 1. Within an iteration, no bone should be solved before all of its descendants have been solved. 
     * 2. Within an iteration, no effector should be solved for before one being reached for by a bone deeper than it in the hierarchy
     * (secretly 3. The rootbone must be solved first.)
     */
    updateSolveOrder() {
        let traversalSet = new Set();
        this.traversalArray = [];
        //order the effectors in each group such that the effector starting furthest from the root is first in the group
        for(let eg of this.effectorGroups) {
            eg.effectors.sort( (a, b) => b.wboneList[b.wboneList.length-1].simLocalAxes.nodeDepth - a.wboneList[a.wboneList.length-1].simLocalAxes.nodeDepth);
        }

        //order the groups such that supersets of groups are solved after subsets. 
        //For comparison of non-overlapping groups, solve whichever gorup starts furthest from the root
        this.effectorGroups.sort((a, b) => {
            let inclusionType = a.effectorSet.isSuperset(b.effectorSet);
            if(inclusionType == 0) {
                let a_start = a.bonelist[a.bonelist.length-1].simLocalAxes.nodeDepth;
                let b_start =  b.bonelist[b.bonelist.length-1].simLocalAxes.nodeDepth;
                return  b_start - a_start;
            } else return inclusionType
        });
        
        /**
         * Now starting from the deepest effector in each group, push to the traversal array starting from its deepest bone.
        */
        for(let eg of this.effectorGroups) {
            for(let wb of eg.bonelist) {
                if(traversalSet.has(wb)) {
                    continue;
                }
                traversalSet.add(wb);
                this.traversalArray.push(wb);
            }
        }


        /**Mark any working bones with a pinned fully opaque parent as segment roots
         * segment roots are used to determine where to stop solving when the user wants to solve from just a particular bone
        */
        for(let wb of this.traversalArray) {
            if(wb.forBone.parent != null) {
                let par = wb.forBone.parent;
                if(!(par instanceof THREE.Bone)) {
                    //the root bone is a segment root even if unpinned.
                    wb.segmentRoot = null;
                    wb.setAsSegmentRoot(wb);

                } else if(par.getIKPin() != null 
                && par.getIKPin().isEnabled()
                && par.getIKPin().getInfluenceOpacity() < 1) {
                    wb.segmentRoot = null;
                    wb.setAsSegmentRoot(wb);           
                }
            }            
        }

        /**That's it. Thank you for coming to my TED talk. */
    }
}

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
    componentWiseVisibilityWeightedList = [];
    bonePainTotals = [];
    boneSet = new Set();
    stopOn = null; //set by trimBones to notify updateInfluences that what would otherwise be considered a mismatch is on purpose.
    inGroups = new Set(); // a set of effector groups this effector belongs to.
    
    constructor(effectorPool, tip, target) {
        this.tip = tip;
        this.target = target;
        this.targetAxes = target.targetNode;
        this.tipAxes = target.affectoredOffset;
        this.effectorPool = effectorPool;
        
        /*if((1-target.getInfluenceOpacity())*(target.getPinWeight() > 0)) {
            this.wboneList.push(tip);
            this.visibilityWeightedList.push(1);
            this.componentWiseVisibilityWeightedList.push(1/3, 1/6, 1/3, 1/6);
        }*/
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

            if(this.componentWiseVisibilityWeightedList.length < complistidx+4) {
                this.componentWiseVisibilityWeightedList.push(1/3, 1/6, 1/3, 1/6);
            }

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
            this.componentWiseVisibilityWeightedList.splice(listidx*4, (this.wboneList.length*4)-(listidx*4));
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
        let myWeightedPriorities = this.target.normed_weights;
        let listidx = 0; let complistidx = 0;
        let currBone = this.target.forBone;
        let ancestorPin = this.target;

        //there's a special/natural-ish case where a pin can have no weight but be completely opaque, 
        //this is useful to have some pins segment the bone hierarchy but QCP does better when we don't flood it with 0 values so, let's just be nice.
        if((1-this.target.getInfluenceOpacity() == 0) && this.target.getPinWeight() == 0){
            return this.wboneList > 0;
        }

        while(currBone instanceof THREE.Bone) {
            
            /**update a cached list with premultiplied weights and opacities per component per bone.
                * it's a flat list of 4 components, corresponding to 
                 *  position*weight*transparency*priority, 
                 *  x_headings*weight*transparency*priority,
                 *  y_headings*weight*transparency*priority,
                 *  z_headings*weight*transparency*priority.
             */
            let sublist = [
                transparency*myWeightedPriorities[0], 
                transparency*myWeightedPriorities[1], 
                transparency*myWeightedPriorities[2], 
                transparency*myWeightedPriorities[3]];
            if(this.visibilityWeightedList.length <= listidx) {
                 this.visibilityWeightedList.push(transparency*myWeight);
                 mismatch = true;
            }
            else {
                this.visibilityWeightedList[listidx] = transparency*myWeight;
            }
            if(this.componentWiseVisibilityWeightedList.length < complistidx+4) {
                this.componentWiseVisibilityWeightedList.push(...sublist);
                mismatch = true;
            } else {
                this.componentWiseVisibilityWeightedList[complistidx] = sublist[0];
                this.componentWiseVisibilityWeightedList[complistidx+1] = sublist[1];
                this.componentWiseVisibilityWeightedList[complistidx+2] = sublist[2];
                this.componentWiseVisibilityWeightedList[complistidx+3] = sublist[3];
            }

            
            listidx++; complistidx += sublist.length;

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
            this.componentWiseVisibilityWeightedList.splice(listidx*4, (this.wboneList.length*4)-(listidx*4));
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
            this.componentWiseVisibilityWeightedList.splice(curridx, 4); 
            this.boneSet.delete(wb);
            wb.register_tempEffector(this, -1);
        }
        this.stopOn = this.wboneList[this.wboneList.length-1];
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

        const pin = this.target;
        const targetAxes = this.targetAxes;
        const tipOrigin = this.tipAxes.origin();
        const targetOrigin = targetAxes.origin();
        const boneOrigin =  boneRef.simLocalAxes.origin();
        let cwv = this.componentWiseVisibilityWeightedList;
        let pos_normweight_complement = 1-cwv[complistidx];
        let distScaled = doScale ? pos_normweight_complement + boneOrigin.dist(targetOrigin) : pos_normweight_complement; 
        
        let myDescendantsPain = boneIdx == 0 ? 0 : this.wboneList[boneIdx-1].currentPain;
        let painScalar = 1;//TODO: fix this so it doesn't go over 1./(1+myDescendantsPain)/(descendantPainTotal + totalTargetCount);
        
        //multiply by sum of components to undo the normalization on position. Since that norm is just there for distscaling and not what the user actually wants with regard to position itself
        //should probably just precompute this
        let painWeighted = painScalar*(cwv[complistidx]* (cwv[complistidx] + cwv[complistidx+1] + cwv[complistidx+2] + cwv[complistidx+3]));

        const localizedOrig = headingsArray[currIdx].set(targetOrigin).lerp(tipOrigin, painWeighted).sub(boneOrigin);
        outWeightArray[currIdx] = painWeighted;
        //const modeCode = pin.modeCode;
        if(painWeighted > 0) {
            writeCount++; currIdx++; nextIdx++;
        }
        painWeighted = painScalar*this.componentWiseVisibilityWeightedList[complistidx+1];
        if(painWeighted > 0) {
            outWeightArray[currIdx] = outWeightArray[nextIdx] = painWeighted;
            targetAxes.setToOrthon_XHeading(headingsArray[currIdx]).mult(distScaled * pin._xScale); //.mult(outWeights[currIdx]).mult(scaleBy);
            headingsArray[currIdx].multInto(-1, headingsArray[nextIdx]).add(localizedOrig);
            headingsArray[currIdx].add(localizedOrig);
            writeCount+=2; currIdx += 2; nextIdx+=2
        }
        painWeighted = painScalar*this.componentWiseVisibilityWeightedList[complistidx+2];
        if (painWeighted > 0) {
            outWeightArray[currIdx] = outWeightArray[nextIdx] = painWeighted;
            targetAxes.setToOrthon_YHeading(headingsArray[currIdx]).mult(distScaled * pin._yScale); //.mult(outWeights[currIdx]).mult(scaleBy);
            headingsArray[currIdx].multInto(-1, headingsArray[nextIdx]).add(localizedOrig);
            headingsArray[currIdx].add(localizedOrig);
            writeCount+=2; currIdx += 2; nextIdx+=2
        }
        painWeighted = painScalar*this.componentWiseVisibilityWeightedList[complistidx+3];
        if (painWeighted > 0) {
            outWeightArray[currIdx] = outWeightArray[nextIdx] = painWeighted;
            targetAxes.setToOrthon_ZHeading(headingsArray[currIdx]).mult(distScaled * pin._zScale); //.mult(outWeights[currIdx]).mult(scaleBy);
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

        const target = this.target;
        const tipAxes = this.target.affectoredOffset;
        const tipOrigin = this.tip.simTipAxes.origin();
        const targetOrigin = this.targetAxes.origin();
        const boneOrigin = boneRef.simLocalAxes.origin();
        let pos_normweight_complement = 1-this.componentWiseVisibilityWeightedList[complistidx];
        let distScaled = doScale ? pos_normweight_complement + boneOrigin.dist(targetOrigin) : pos_normweight_complement; 
        let cwv = this.componentWiseVisibilityWeightedList
        
        //multiply by 3 to undo the normalization on position. Since that norm is mostly just there for distscaling and not what the user actually wants with regard to position itself
        let visibilityWeighted = cwv[complistidx]* (cwv[complistidx] + cwv[complistidx+1] + cwv[complistidx+2] + cwv[complistidx+3]);

        const localizedOrig = headingsArray[currIdx].set(tipOrigin).sub(boneOrigin);
        if(visibilityWeighted > 0) {
            writeCount++; currIdx++; nextIdx++;
        }
        visibilityWeighted = this.componentWiseVisibilityWeightedList[complistidx+1];
        if(visibilityWeighted > 0) {
            tipAxes.setToOrthon_XHeading(headingsArray[currIdx]).mult(distScaled * target._xScale);
            headingsArray[currIdx].multInto(-1, headingsArray[nextIdx]).add(localizedOrig);
            headingsArray[currIdx].add(localizedOrig);
            writeCount+=2; currIdx += 2; nextIdx+=2
        }
        visibilityWeighted = this.componentWiseVisibilityWeightedList[complistidx+2];
        if (visibilityWeighted > 0) {
            tipAxes.setToOrthon_YHeading(headingsArray[currIdx]).mult(distScaled * target._yScale);
            headingsArray[currIdx].multInto(-1, headingsArray[nextIdx]).add(localizedOrig);
            headingsArray[currIdx].add(localizedOrig);
            writeCount+=2; currIdx += 2; nextIdx+=2
        }
        visibilityWeighted = this.componentWiseVisibilityWeightedList[complistidx+3];
        if (visibilityWeighted > 0) {
            tipAxes.setToOrthon_ZHeading(headingsArray[currIdx]).mult(distScaled * target._zScale);
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

    /**prints the list of bones going toward this effector */
    toConsole() {
        console.group(`${this.target.forBone.name}`);
        for(let wb of this.wboneList) console.log(wb.forBone.name);
        console.groupEnd(`${this.target.forBone.name}`);

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

Set.prototype.equals = function (otherSet) {
    if (this.size !== otherSet.size) 
        return false;
    if (this.intersection(otherSet).size != this.size) 
        return false; 
    return true;
}

Set.prototype.intersection = function(otherSet) {
    let result = new Set();
    let smallerSet = this.size < otherSet.size ? this : otherSet;
    let setB = this == smallerSet ? otherSet : this;
    for (let elem of smallerSet) {
        if(setB.has(elem)) 
            result.add(elem);
    }
    return result;
}

Set.prototype.not_in = function(otherSet) {
    let result = new Set();
    for(let e of this) {
        if(!otherSet.has(e)) {
            result.add(e);
        }
    }
    return result;
}

Set.prototype.union = function(otherSet) {
    let result = new Set([...this]);
    result.add_multiple(...otherSet);
    return result;
}


Set.prototype.add_multiple= function(...elems) {
    for(let e of elems) {
        this.add(e);
    }
}


Set.prototype.isSuperset = 
/**
 * 
 * @param {Set} otherSet 
 * @return -1 if this set is a subset of otherSet, 1 if this set is a superset, 0 in all other cases
 */
function (otherSet) {
    let itx = this.intersection(otherSet); 
    if(itx.size != this.size) return 0;
    else {
        if(otherSet.size > this.size) return -1; 
        else if(otherSet.size < this.size) return 1;
        return 0;
    }
}
