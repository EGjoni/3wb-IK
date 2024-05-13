import * as THREE from 'three';
import { Rot } from "../../util/Rot.js";
import { WorkingBone } from "../ShadowBones/WorkingBone.js";
import { Vec3Pool } from "../../EWBIK.js";
import { QCP } from "../../util/QCP.js";
import { EffectorGroup } from './EffectorGroup.js';
import { Effector } from './effectors/Effector.js';
import { FastEffector } from './effectors/FastEffector.js';

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
        this.tempRot = new Rot(1, 0, 0, 0);
        //immediately finalize the pool, since we don't want it growing to accommodate anything
        this.effectorPool = new Vec3Pool(this.poolSize, this).finalize();
        let bufferCount = this.poolSize / 2;
        for (let i = 0; i < bufferCount; i++) {
            this.tipHeadings.push(this.effectorPool.any_Vec3());
            this.targetHeadings.push(this.effectorPool.any_Vec3());
            this.weightArray.push(1);
        }
        this.qcpConverger = new QCP(64);
    }

    /**(re)initializes instances of effectors for this armature*/
    initEffectors(shadowSkel) {
        this.activeShadowSkel = shadowSkel;
        for (let b of this.armature.bones) {
            if (b.wb == null) {
                this.armature.stablePool.unfinalize(this);
                new WorkingBone(b, this);
            }
            else {
                b.wb.updateState(this);
            }
        }
        this.all_effectors.splice(0, this.all_effectors.length);
        for (let [pin, bone] of this.armature.pinBoneMap) {
            if (pin.isEnabled()) {
                this.all_effectors.push(new Effector(this, bone.wb, pin));
            }
        }

        this.updateEffectorBoneLists();
        this.consolidateEffectors();
        this.updateSolveOrder();

        /**notify the bones of which effectors to care about */
        for (let eg of this.effectorGroups) {
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
            if (!this.solvableBoneSet.has(wb)) {
                wb.clear_tempEffectorList();
                wb.rootSegment = null;
                this.solvableBoneSet.add(wb);
            }
        };
        let conflictingMap = new Map();
        for (let e of this.all_effectors) {
            let conflicts = e.updateAffectedBoneList(onBoneAdd);
            if (conflicts.length > 0) conflictingMap.set(e, conflicts);
        }
        for (let e of this.all_effectors) {
            e.updateInfluenceOpacityList();
        }

        for (let [effector, bonelist] of conflictingMap) {
            effector.trimBones(bonelist);
        }
        for (let wb of this.solvableBoneSet) {
            wb.finalize_tempEffectors();
            if (wb._tempEffectorList.length == 0) {
                this.solvableBoneSet.delete(wb);
                wb.clear_tempEffectorList();
                wb.finalize_tempEffectors();
            }

        }

        this.solvableBones = [...this.solvableBoneSet];


        for (let wb of this.solvableBones) {
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
        this.effectorGroups.splice(0, this.effectorGroups.length - 1);

        for (let wb of this.solvableBones) {
            let wbEffectorSet = new Set(wb._tempEffectorList);
            let found = false;
            for (let i = 0; i < uniqueSets.length; i++) {
                if (uniqueSets[i].equals(wbEffectorSet)) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                if (wb._tempEffectorList.length > 0) {
                    uniqueSets.push(wbEffectorSet);
                    uniqueLists.push(wb._tempEffectorList);
                }
            }
        }
        for (let ul of uniqueLists) {
            candidateGroups.add(new EffectorGroup(ul));
        }
        for (let e of this.all_effectors) {
            for (let eig of e.inGroups) {
                eig.dedupe(e.inGroups.not_in(new Set([eig])));
            }
        }
        for (let cg of candidateGroups) {
            if (cg.bonelist.length == 0)
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
        for (let eg of this.effectorGroups) {
            eg.effectors.sort((a, b) => b.wboneList[b.wboneList.length - 1].simLocalAxes.nodeDepth - a.wboneList[a.wboneList.length - 1].simLocalAxes.nodeDepth);
        }

        //order the groups such that supersets of groups are solved after subsets. 
        //For comparison of non-overlapping groups, solve whichever gorup starts furthest from the root
        this.effectorGroups.sort((a, b) => {
            let inclusionType = a.effectorSet.isSuperset(b.effectorSet);
            if (inclusionType == 0) {
                let a_start = a.bonelist[a.bonelist.length - 1].simLocalAxes.nodeDepth;
                let b_start = b.bonelist[b.bonelist.length - 1].simLocalAxes.nodeDepth;
                return b_start - a_start;
            } else return inclusionType;
        });

        /**
         * Now starting from the deepest effector in each group, push to the traversal array starting from its deepest bone.
        */
        for (let eg of this.effectorGroups) {
            for (let wb of eg.bonelist) {
                if (traversalSet.has(wb)) {
                    continue;
                }
                traversalSet.add(wb);
                this.traversalArray.push(wb);
            }
        }


        /**Mark any working bones with a pinned fully opaque parent as segment roots
         * segment roots are used to determine where to stop solving when the user wants to solve from just a particular bone
        */
        for (let wb of this.traversalArray) {
            if (wb.forBone.parent != null) {
                let par = wb.forBone.parent;
                if (!(par instanceof THREE.Bone)) {
                    //the root bone is a segment root even if unpinned.
                    wb.segmentRoot = null;
                    wb.setAsSegmentRoot(wb);

                } else if (par.getIKPin() != null
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
