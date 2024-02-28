export class SkeletonState {
    constructor(assumeValid = false) {
        this.bonesList = [];
        this.transformsList = [];
        this.targetsList = [];
        this.constraintsList = [];
        this.boneMap = {};
        this.transformMap = {};
        this.targetMap = {};
        this.constraintMap = {};
        this.bones = null;
        this.targets = null;
        this.constraints = null;
        this.transforms = null;
        this.rootBoneState = null;
        this.assumeValid = assumeValid;
    }

    getTransformsArray() {
        return this.transforms;
    }

    getBoneState(index) {
        return this.bones[index];
    }

    getBoneStateById(id) {
        return this.boneMap[id];
    }

    getBoneCount() {
        return this.bones.length;
    }

    getTransformState(index) {
        return this.transforms[index];
    }

    getTransformCount() {
        return this.transforms.length;
    }

    getBoneStatesArray() {
        return this.bones;
    }

    getConstraintState(index) {
        return this.constraints[index];
    }

    getConstraintCount() {
        return this.constraints.length;
    }

    getTargetState(index) {
        return this.targets[index];
    }

    getTargetCount() {
        return this.targets.length;
    }

    validate() {
        for (const bs of Object.values(this.boneMap)) {
            if (bs.parent_id === null) {
                if (this.rootBoneState !== null) {
                    throw new Error(`A skeleton may only have 1 root bone, you attempted to initialize bone of id ${bs.ikd} as an implicit root (no parent bone), when bone with id '${this.rootBoneState.ikd}' is already determined as being the implicit root`);
                }
                this.rootBoneState = bs;
            }
        }
        for (const bs of Object.values(this.boneMap)) {
            bs.validate();
            this.bonesList.push(bs);
        }
        for (const ts of Object.values(this.transformMap)) {
            ts.validate();
            this.transformsList.push(ts);
        }
        for (const ts of Object.values(this.targetMap)) {
            ts.validate();
            this.targetsList.push(ts);
        }
        for (const cs of Object.values(this.constraintMap)) {
            cs.validate();
            this.constraintsList.push(cs);
        }
        this.optimize();
        this.prune();
    }

    /**
	* removes any bones/transforms/constraints that the solver would ignore, then 
	* reindexes and reconnects everything
	*/
    prune() {
        let leafCount = 1;
        while (leafCount > 0) {
            const leafBones = [];
            for (const bs of Object.values(this.boneMap)) {
                if (bs.getTempChildCount() === 0 && bs.target_id === null) leafBones.push(bs);
            }
            leafCount = leafBones.length;
            for (const leaf of leafBones) {
                let currentLeaf = leaf;
                while (currentLeaf !== null && currentLeaf.target_id === null) {
                    if (currentLeaf.getTempChildCount() === 0) {
                        currentLeaf.prune();
                        currentLeaf = currentLeaf.getParent();
                    } else {
                        break;
                    }
                }
            }
        }
        this.optimize();
    }
    
    /**
     * Creates simple arrays from the basic build maps for fast traversal and updates
     */
    optimize() {
        this.bones = this.bonesList.filter(bone => bone !== null);
        this.transforms = this.transformsList.filter(transform => transform !== null);
        this.constraints = this.constraintsList.filter(constraint => constraint !== null);
        this.targets = this.targetsList.filter(target => target !== null);
    
        for (let i = 0; i < this.bones.length; i++) this.bones[i].clearChildList();
    
        for (let i = 0; i < this.bones.length; i++) {
            const bs = this.bones[i];
            bs.setIndex(i);
        }
        for (let i = 0; i < this.transforms.length; i++) {
            const ts = this.transforms[i];
            ts.setIndex(i);
        }
        for (let i = 0; i < this.targets.length; i++) {
            const ts = this.targets[i];
            ts.setIndex(i);
        }
        for (let i = 0; i < this.constraints.length; i++) {
            const cs = this.constraints[i];
            cs.setIndex(i);
        }
        for (const bs of this.bones) bs.optimize();
        for (const ts of this.transforms) ts.optimize();
        for (const ts of this.targets) ts.optimize();
        for (const cs of this.constraints) cs.optimize();
    }

    /**
     * Adds a bone to the skeleton's bone map.
     * @param {string} id - A unique string identifier for this bone.
     * @param {string} boneFrame_transform_id - The id string of the transform defining the frame of this bone's translation, rotation, and scale relative to its parent or the skeleton.
     * @param {string} parent_id - Null if this bone is a root bone; otherwise, the id string of this bone's parent. The parent does not need to have been pre-registered but must be registered before validation.
     * @param {Object} directRef - An optional reference to the actual bone object for efficient access.    
     * @param {number} [stiffness=0.0] - Optional. A value from 1 to 0 indicating the bone's movement resistance. 1 means it never moves, 0 means it moves freely according to the dampening parameter.
     * @param {string} [constraint_id=null] - Optional. The id string of the constraint on this bone.
     * @param {string} [target_id=null] - Optional. Null if this bone is not an effector; otherwise, the id string of the target this bone should aim to match.
     * @param {string} [boneOrientation_transform_id=null] - The id string of the transform defining the physical orientation of this bone's translation, rotation, and scale relative to its BoneFrame. Only used if providing a constraint. May also be automatically generated by calling the inferBoneOrientations() function prior to validate().
     */
    addBone(id, boneFrame_transform_id, parent_id, directRef, stiffness = 0.0, constraint_id = null, target_id = null, boneOrientation_transform_id = null) {
        const result = new BoneState(id, boneFrame_transform_id, parent_id, directRef, stiffness, constraint_id, target_id, boneOrientation_transform_id, this);
        this.boneMap[id] = result;
        return result;
    }
    /**
     * Adds a constraint to the skeleton's constraint map, defining limits on a bone's movement.
     * @param {string} id - A unique string identifier for this constraint.
     * @param {string} forBone_id - The id string of the bone this constraint is applied to.
     * @param {Object} directReference - A reference to the actual Constraint instance; required for the solver to call its snapToLimitingAxes function.
     * @param {number} painfulness - Scalar indicating degree to which bone should be averse to approaching this constraint's boundary.
     * @param {string} swingOrientationTransform_id - The id of the transform specifying the orientation of the swing space for this constraint.
     * @param {string} [twistOrientationTransform_id=null] - Optional. The id of the transform specifying the orientation of the twist basis for ball and socket-type constraints. Relevant for constraints like Kusudamas, splines, and limit cones.
     */
    addConstraint(id, forBone_id, directReference, painfulness, swingOrientationTransform_id, twistOrientationTransform_id = null) {
        const con = new ConstraintState(id, forBone_id, painfulness, swingOrientationTransform_id, twistOrientationTransform_id, directReference, this);
        this.constraintMap[id] = con;
        return con;
    }
    
    /**
     * Adds a target to the skeleton's target map, specifying how an effector bone aims to match this target.
     * @param {string} id - A unique string identifier for this target.
     * @param {string} transform_id - The id string of the transform defining the target's translation, rotation, and scale, relative to the skeleton transform.
     * @param {string} forBoneid - The id string of the effector bone this target is for.
     * @param {number[]} [priorities=[1.0, 1.0, 0.0]] - The orientation priorities for this target, indicating the importance of matching the target's orientation along the x, y, and z components.
     * @param {number} [depthFalloff=0.0] - A value from 0 to 1 indicating the visibility of effectors downstream of this target to ancestors of this target's effector.
     * @param {number} [weight=1.0] - The weight of this target in the solving process.
     */
    addTarget(id, transform_id, forBoneid, priorities = [1.0, 1.0, 0.0], depthFalloff = 0.0, weight = 1.0) {
        const result = new TargetState(id, transform_id, forBoneid, priorities, depthFalloff, weight, this);
        this.targetMap[id] = result;
        return result;
    }
    
    /**
     * Adds or updates a transform in the skeleton's transform map.
     * @param {string} id - A unique string identifier for this transform.     *
     * @param {number[]} translation - An array of three numbers representing the translation of this transform relative to its parent transform.
     * @param {number[]} rotation - An array of four numbers representing the rotation of this transform in Hamilton (not JPL, important!) quaternion format (W, X, Y, Z), where W is the scalar component.
     * @param {number[]} scale - An array of three numbers representing the scale of the X, Y, and Z components of this transform. A value of [1,1,1] indicates a right-handed transform; [-1, 1, 1] indicates a left-handed transform with the X axis inverted.
     * @param {string} parent_id - A string indicating the parent transform this transform is defined in the space of, or null if defined relative to the identity transform (the identity transform is defined as the parent of the root bone's transform to maximize numerical precision).
     * @param {Object} directReference - An optional reference to the actual transform object for efficient access without hash lookup.
     */
    addTransform(id, translation, rotation, scale, parent_id, directReference) {
        const existingTransform = this.transformMap[id];
        if (existingTransform) {
            if (existingTransform.directReference === directReference) {
                existingTransform.update(translation, rotation, scale);
            } else {
                const translationMatch = JSON.stringify(existingTransform.translation) === JSON.stringify(translation);
                const rotationMatch = JSON.stringify(existingTransform.rotation) === JSON.stringify(rotation);
                const scaleMatch = JSON.stringify(existingTransform.scale) === JSON.stringify(scale);
                const parentMatch = existingTransform.parent_id === parent_id;
    
                if (!translationMatch || !rotationMatch || !scaleMatch || !parentMatch) {
                    throw new Error(`Transform with id '${id}' already exists and has contents which are not equivalent to the new transform being provided`);
                }
            }
        } else {
            this.transformMap[id] = new TransformState(id, translation, rotation, scale, parent_id, directReference, this);
        }
    }

    getRootBonestate() {
        return this.rootBoneState;
    }

}


export class BoneState {
    constructor(id, boneFrame_transform_id, parent_id, directRef, stiffness, constraint_id, target_id, boneOrientation_transform_id, parentSkelState) {
        this.ikd = id;
        this.parent_id = parent_id;
        this.transformFrame_id = boneFrame_transform_id;
        this.orientationtransform_id = boneOrientation_transform_id,
        this.target_id = target_id;
        this.constraint_id = constraint_id;
        this.stiffness = stiffness;
        this.childMap = new Map(); // Replacing HashMap with JavaScript's Map object
        this.index = -1;
        this.parentIdx = -1;
        this.childIndices = [];
        this.frame_transformIdx = -1;
        this.orientationtransform_idx = -1;
        this.constraintIdx = -1;
        this.targetIdx = -1;
        this.directRef = directRef; // Direct object reference for debugging
        this.skeletonState = parentSkelState;
    }

    getFrameTransform() {
        return this.skeletonState.transforms[this.frame_transformIdx];
    }

    getOrientationTransform() {
        if(this.orientationtransform_idx > -1) return this.skeletonState.transforms[this.orientationtransform_idx];
        else return this.getFrameTransform();
    }

    getTarget() {
        return this.targetIdx !== -1 ? this.skeletonState.targets[this.targetIdx] : null;
    }

    getStiffness() {
        return this.stiffness;
    }

    getParent() {
        return this.parentIdx >= 0 ? this.skeletonState.bones[this.parentIdx] : null;
    }

    getChild(index) {
        return this.skeletonState.bones[this.childIndices[index]];
    }

    clearChildList() {
        this.childMap.clear();
        this.childIndices = [];
    }

    getChildCount() {
        return this.childIndices.length;
    }

    getTempChildCount() {
        return this.childMap.size;
    }

    getConstraint() {
        return this.constraintIdx >= 0 ? this.skeletonState.constraints[this.constraintIdx] : null;
    }

    prune() {
        this.skeletonState.bonesList[this.index] = null;
        delete this.skeletonState.boneMap[this.ikd];
        this.getFrameTransform().prune();
        this.getOrientationTransform().prune();
        if (this.getConstraint() !== null) this.getConstraint().prune();
        if (this.parent_id !== null) {
            this.skeletonState.boneMap[this.parent_id].childMap.delete(this.ikd);
        }
        if (this.skeletonState.rootBoneState === this) this.skeletonState.rootBoneState = null;
    }

    setIndex(index) {
        this.index = index;
        if (this.parent_id !== null) {
            const parentBone = this.skeletonState.boneMap[this.parent_id];
            parentBone.addChild(this.ikd, this.index);
        }
    }

    addChild(id, childIndex) {
        this.childMap.set(id, childIndex);
    }

    optimize() {
        this.childIndices = Array.from(this.childMap.values());
        if (this.parent_id !== null) this.parentIdx = this.skeletonState.boneMap[this.parent_id].index;

        this.frame_transformIdx = this.skeletonState.transformMap[this.transformFrame_id].getIndex();
        if(this.orientationtransform_id != null)
            this.orientationtransform_idx = this.skeletonState.transformMap[this.orientationtransform_id].getIndex();
        else this.orientationtransform_idx = -1;

        if (this.constraint_id !== null) this.constraintIdx = this.skeletonState.constraintMap[this.constraint_id].getIndex();
        if (this.target_id !== null) this.targetIdx = this.skeletonState.targetMap[this.target_id].getIndex();
    }

    validate() {
        if (this.skeletonState.assumeValid) return;
        const transform = this.skeletonState.transformMap[this.transformFrame_id];
        if (!transform) {
            throw new Error(`Bone '${this.ikd}' references transform with id '${this.transformFrame_id}', but '${this.transformFrame_id}' has not been registered with the SkeletonState.`);
        }
        if (this.parent_id !== null) {
            const parent = this.skeletonState.boneMap[this.parent_id];
            if (!parent) {
                throw new Error(`Bone '${this.ikd}' references parent bone with id '${this.parent_id}', but '${this.parent_id}' has not been registered with the SkeletonState.`);
            }
            const parentBonesTransform = this.skeletonState.transformMap[parent.transformFrame_id];
            const transformsParent = this.skeletonState.transformMap[transform.parent_id];
            if (parentBonesTransform !== transformsParent) {
                throw new Error(`Bone '${this.ikd}' has listed bone with id '${this.parent_id}' as its parent, which has a transformFrame_id of '${parent.transformFrame_id}' but the parent transform of this bone's transform is listed as '${transform.parent_id}'. A bone's transform must have the parent bone's transform as its parent.`);
            }
            // Avoid grandfather paradoxes
            let ancestor = parent;
            while (ancestor !== null) {
                if (ancestor === this) {
                    throw new Error(`Bone '${this.ikd}' is listed as being both a descendant and an ancestor of itself.`);
                }
                if (ancestor.parent_id === null) {
                    ancestor = null;
                } else {
                    const curr = ancestor;
                    ancestor = this.skeletonState.boneMap[ancestor.parent_id];
                    if (!ancestor) {
                        throw new Error(`Bone with id '${curr.ikd}' lists its parent bone as having id '${curr.parent_id}', but no such bone has been registered with the SkeletonState.`);
                    }
                }
            }
        } else {
            if (this.constraint_id !== null) {
                throw new Error(`Bone '${this.ikd}' has been determined to be a root bone. However, root bones may not be constrained. If you wish to constrain the root bone anyway, please insert a fake unconstrained root bone prior to this bone. Give that bone's transform values equal to this bone's, and set this bone's transforms to identity.`);
            }
        }
        if (this.constraint_id !== null) {
            const constraint = this.skeletonState.constraintMap[this.constraint_id];
            if (!constraint) {
                throw new Error(`Bone '${this.ikd}' claims to be constrained by '${this.constraint_id}', but no such constraint has been registered with this SkeletonState`);
            }
            if (constraint.forBone_id !== this.ikd) {
                throw new Error(`Bone '${this.ikd}' claims to be constrained by '${constraint.ikd}', but constraint of id '${constraint.ikd}' claims to be constraining bone with id '${constraint.forBone_id}'`);
            }
        }
    }

   
    getIndex() {
        return this.index;
    }

    getIdString() {
        return this.ikd;
    }

    setStiffness(stiffness) {
        this.stiffness = stiffness;
    }


}
export class TransformState {
    constructor(id, translation, rotation, scale, parent_id, directReference, skeletonState) {
        this.ikd = id;
        this.translation = translation;
        console.log(this.translation);
        this.rotation = rotation;
        this.scale = scale;
        this.parent_id = parent_id;
        this.directReference = directReference;
        this.skeletonState = skeletonState; // Reference to the SkeletonState instance
        this.index = -1;
        this.parentIdx = -1;
        this.childIndices = [];
        this.childIdxsList = [];
    }

    update(translation, rotation, scale) {
        this.translation = translation;
        console.log(this.translation);
        this.rotation = rotation;
        this.scale = scale;
    }

    prune() {
        this.skeletonState.transformsList[this.index] = null;
        delete this.skeletonState.transformMap[this.ikd];
    }

    getIndex() {
        return this.index;
    }

    getParentIndex() {
        return this.parentIdx;
    }

    getParentTransform() {
        return this.skeletonState.transforms[this.parentIdx];
    }

    setIndex(index) {
        this.index = index;
        const parTransform = this.skeletonState.transformMap[this.parent_id];
        if (parTransform) {
            parTransform.addChild(this.index);
        }
    }

    addChild(childIndex) {
        this.childIdxsList.push(childIndex);
    }

    optimize() {
        this.childIndices = this.childIdxsList;
        if (this.parent_id != null) {
            this.parentIdx = this.skeletonState.transformMap[this.parent_id].getIndex();
        }
    }

    validate() {
        if (this.skeletonState.assumeValid) return;
        if (this.parent_id == null) return;

        const parent = this.skeletonState.transformMap[this.parent_id];
        if (parent == null) {
            throw new Error(`Transform '${this.ikd}' lists '${this.parent_id}' as its parent, but no transform with id '${this.parent_id}' has been registered with this SkeletonState`);
        }
        let ancestor = parent;
        while (ancestor != null) {
            if (ancestor === this) {
                throw new Error(`Transform '${this.ikd}' is listed as being both a descendant and an ancestor of itself.`);
            }
            if (ancestor.parent_id == null) {
                ancestor = null;
            } else {
                const curr = ancestor;
                ancestor = this.skeletonState.transformMap[ancestor.parent_id];
                if (ancestor == null) {
                    throw new Error(`Transform with id '${curr.ikd}' lists its parent transform as having id '${curr.parent_id}', but no such transform has been registered with the SkeletonState`);
                }
            }
        }
    }

    getIdString() {
        return this.ikd;
    }

    toString() {
        // Assuming Rot is a class or function you've defined elsewhere for handling rotations.
        // This part needs adaptation based on how you handle rotations in your JavaScript context.
        const rotationStr = `Rotation representation not implemented`; // Placeholder
        return `TransformState: \n origin: (${this.translation[0].toFixed(4)}, ${this.translation[1].toFixed(4)}, ${this.translation[2].toFixed(4)})\n rotation: ${rotationStr}`;
    }
}

export class TargetState {
    constructor(id, transform_id, forBoneid, priorities, depthFalloff, weight, parentSkelState) {
        this.init(id, transform_id, forBoneid, priorities, depthFalloff, weight);
        this.skeletonState = parentSkelState;
    }

    init(id, transform_id, forBoneid, priorities, depthFalloff, weight) {
        this.ikd = id;
        this.forBone_id = forBoneid;
        this.transform_id = transform_id;
        this.modeCode = 0;        
        this.depthFalloff = depthFalloff;
        this.weight = weight;
        this.priorities = priorities;
        const xDir = this.priorities[0] > 0;
        const yDir = this.priorities[1] > 0;
        const zDir = this.priorities[2] > 0;
        this.modeCode = 0;
        if (xDir) this.modeCode += TargetState.XDir;
        if (yDir) this.modeCode += TargetState.YDir;
        if (zDir) this.modeCode += TargetState.ZDir;
    }

    setIndex(index) {
        this.index = index;
    }

    optimize() {
        this.forBoneIdx = this.skeletonState.boneMap[this.forBone_id].getIndex();
        this.transformIdx = this.skeletonState.transformMap[this.transform_id].getIndex();
    }

    getTransform() {
        return this.skeletonState.transforms[this.transformIdx];
    }

    validate() {
        const transform = this.skeletonState.transformMap[this.transform_id];
        if (!transform)
            throw new Error(`Target with id '${this.ikd}' lists its transform as having id '${this.transform_id}', but no such transform has been registered with this StateSkeleton`);
        if (transform.parent_id !== null)
            throw new Error(`Target with id '${this.ikd}' lists its transform as having a parent transform. However, target transforms are not allowed to have a parent, as they must be given in the space of the skeleton transform. Please provide a transform object that has been converted into skeleton space and has no parent.`);
    }

    getIdString() {
        return this.ikd;
    }

    getModeCode() {
        return this.modeCode;
    }

    getDepthFallOff() {
        return this.depthFalloff;
    }

    getWeight() {
        return this.weight;
    }

    getIndex() {
        return this.index;
    }

    getPriority(basisDirection) {
        return this.priorities[Math.floor(basisDirection / 2)];
    }

    /**takes an array of target direction weights and modifies them in accordance with the priorities this targetstate specifies */
    setPriorities(priorities) {
        let totalPriority = 0;
        let priorityCount = 0;
        let normedPriority = 0;
        let maxPriority = 0;

        priorities.forEach((priority, i) => {
            if ((this.modeCode & (1 << Math.floor(i / 2))) !== 0) {
                priorityCount++;
                totalPriority += priorities[i];
                maxPriority = Math.max(priorities[i], maxPriority);
            }
        });

        if (priorityCount > 0)
            normedPriority = totalPriority / priorityCount;

        this.priorities = priorities.map(priority => priority * normedPriority * maxPriority);
    }

    setWeight(weight) {
        this.weight = weight;
    }

    static XDir = 1;
    static YDir = 2;
    static ZDir = 4;
}


export class ConstraintState {
    constructor(id, forBone_id, painfulness, swingOrientationTransform_id, twistOrientationTransform_id, directReference, parentSkelState) {
        this.ikd = id;
        this.forBone_id = forBone_id;
        this.swingOrientationTransform_id = swingOrientationTransform_id;
        this.twistOrientationTransform_id = twistOrientationTransform_id;
        this.directReference = directReference;
        this.painfulness = painfulness;
        this.skeletonState = parentSkelState; 
        this.index = -1;
        this.swingTranform_idx = -1;
        this.twistTransform_idx = -1;
    }

    prune() {
        if (this.getTwistTransform() !== null) this.getTwistTransform().prune();
        this.getSwingTransform().prune();
        delete this.skeletonState.constraintMap[this.ikd];
        this.skeletonState.constraintsList[this.index] = null;
    }

    getSwingTransform() {
        return this.skeletonState.transforms[this.swingTranform_idx];
    }

    getTwistTransform() {
        if (this.twistTransform_idx === -1) return null;
        return this.skeletonState.transforms[this.twistTransform_idx];
    }

    setIndex(index) {
        this.index = index;
    }

    getIndex() {
        return this.index;
    }

    getPainfulness() {
        return this.painfulness;
    }

    optimize() {
        if (this.twistOrientationTransform_id !== null) {
            const twistTransform = this.skeletonState.transformMap[this.twistOrientationTransform_id];
            this.twistTransform_idx = twistTransform.getIndex();
        }
        const swingTransform = this.skeletonState.transformMap[this.swingOrientationTransform_id];
        this.swingTranform_idx = swingTransform.getIndex();
    }

    validate() {
        if (this.skeletonState.assumeValid) return;
        const forBone = this.skeletonState.boneMap[this.forBone_id];
        if (forBone === undefined) {
            throw new Error(`Constraint '${this.ikd}' claims to constrain bone '${this.forBone_id}', but no such bone has been registered with this SkeletonState`);
        }
        if (this.swingOrientationTransform_id === null) {
            throw new Error(`Constraint with id '${this.ikd}' claims to have no swing transform, but this transform is required.`);
        }
        const constraintSwing = this.skeletonState.transformMap[this.swingOrientationTransform_id];
        if (constraintSwing === undefined) {
            throw new Error(`Constraint with id '${this.ikd}' claims to have a swingOrientationTransform with id '${this.swingOrientationTransform_id}', but no such transform has been registered with this SkeletonState`);
        }
        if (this.twistOrientationTransform_id !== null) {
            const constraintTwist = this.skeletonState.transformMap[this.twistOrientationTransform_id];
            if (constraintTwist === undefined) {
                throw new Error(`Constraint with id '${this.ikd}' claims to have a twist transform with id '${this.twistOrientationTransform_id}', but no such transform has been registered with this SkeletonState`);
            }
        }
    }

    getIdString() {
        return this.ikd;
    }

    getDirectReference() {
        return this.directReference;
    }
}


