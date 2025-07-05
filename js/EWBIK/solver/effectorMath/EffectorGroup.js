
import { WorkingBone } from "../ShadowBones/WorkingBone.js";
import { FastEffector } from "./effectors/FastEffector.js";
import { Effector } from "./effectors/Effector.js";

export class EffectorGroup {
    effectors = null;
    /**@type {[WorkingBone]} list of bones that all effectors in this group have in common, sorted from descendant to ancestor*/
    bonelist = [];
    boneSet = null;
    deduped = false;
    effectorSet = null;
    startDeviation = Infinity;
    endDeviation = Infinity;

    constructor(effectorList) {
        this.effectors = effectorList;
        this.effectorSet = new Set(this.effectors);
        this.generateBoneList();
        for (let e of this.effectors) {
            e.registerGroup(this);
        }
    }

    /**applies the input rotation to the provided array of headings up to the provided length. (used mostly for deviation calculation) */
    applyRotToHeadings(rot, headingsArray, length) {
        for(let i = 0; i<length; i++) {
            let v = headingsArray[i];
            rot.applyToVec(v, v); 
        }
    }

    /**returns the average distance between the vector pairs in the two sets */
    measureDeviation(tipHeadings, targetHeadings, length) {
        let totalDist = 0;
        for(let i=0; i<length; i++) {
            let tip=tipHeadings[i];
            let targ=targetHeadings[i];
            totalDist += tip.distSq(targ);
        }
        let sqmean = totalDist/length; 
        return sqmean;
    }

    /**unregisters this group from any effectors */
    kill() {
        for (let e of this.effectors) {
            e.unregisterGroup(this);
        }
        return this;
    }

    /**generates a list of bones that all effectors in this group have in common, sorted from descendant to ancestor*/
    generateBoneList() {
        let _boneSet = new Set();
        for (let e of this.effectors) {
            for (let wb of e.wboneList) {
                _boneSet.add(wb);
            }
        }
        for (let e of this.effectors) {
            _boneSet = _boneSet.intersection(new Set(e.wboneList));
        }
        this.bonelist = [..._boneSet];
        this.boneSet = _boneSet;
    }

    /**
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
    updateHeadings() {

    }

    /**
     * Takes a list of effector groups and considers just the groups which are supersets of this group.
     * prunes this group's bonelist to contain only the bones not in the union of this group's bonelist and the superset group's bonelist
     *
     * (there should be no situation in which an intersection of effector groups is not due to one group being a superset of the other so long as each each target can only be reached for by one bone and the the bones are in a tree structure)
     * @param {[EffectorGroup]} othergroups
     */
    dedupe(othergroups) {
        for (let eg of othergroups) {
            let intersect = this.effectorSet.intersection(eg.effectorSet);
            if (intersect.size == this.effectorSet.size && !this.effectorSet.equals(eg.effectorSet)) {
                let boneunion = this.boneSet.union(eg.boneSet);
                this.boneSet = boneunion.not_in(eg.boneSet);
            }
        }
        this.bonelist = [...this.boneSet];
        this.deduped = true;
    }

    /**sets this effectorgroups list as the canonical one its workingbones should use*/
    assign() {
        for (let wb of this.bonelist) {
            wb.assignEffectors(this);
        }
    }

    /**prints just the common bone list */
    toConsole() {
        for (let b of this.bonelist) {
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
            }
        });
        console.table(tableData);
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
