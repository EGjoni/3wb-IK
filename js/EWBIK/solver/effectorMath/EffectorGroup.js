
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

    constructor(effectorList) {
        this.effectors = effectorList;
        this.effectorSet = new Set(this.effectors);
        this.generateBoneList();
        for (let e of this.effectors) {
            e.registerGroup(this);
        }
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
