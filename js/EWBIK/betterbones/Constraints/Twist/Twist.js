const THREE = await import('three')
import { Bone, Object3D, Group } from 'three';
import { Rot } from "../../../util/Rot.js";
import { Vec3, any_Vec3 } from "../../../util/vecs.js";
import { Ray } from "../../../util/Ray.js";
import { IKNode, TrackingNode } from "../../../util/nodes/IKNodes.js";
import { generateUUID } from "../../../util/uuid.js";
import { Constraint, Limiting, LimitingReturnful } from "../Constraint.js";


export class Twist extends Limiting {
    static TAU = Math.PI * 2;
    static PI = Math.PI;
    static totalTwists = 0;
    display = null// new TwistConstraintDisplay();
    zHint = null //line along the z-axis to visualize twist affordance;
    displayGroup = new Group();
    swing = new Rot(1,0,0,0);
    twist = new Rot(1,0,0,0); 
    workingVec = new Vec3(0,0,0);
    

    /**
     * Defines "twist" like limits around an axis. The input expected is a reference frame in the space of the parent bone.
     * the direction in this frame corresponding to the vector y = (0, 1, 0) defines the axis around which rotation is limited,
     * while the direction in this frame corresponding to the vector z = (0, 0, 1) defines the twist orientation furthest from the limits.
     * 
     * The limit operates by the following basic idea (which is only for conceptual illustration, and not actually how the math is being done)
     * 
     * 1. Take whatever orientation the bone is currently in, and rotate it by the shortest path such that its y-axis aligns with this constraint's y-axis. 
     * 2. Next, take the z-axis basis vector of the y-axis aligned bone, and find its angle from the z-axis of this constraint's z-axis basis vector. If the angle is larger than the range this constraint allows, rotate it along the y-axis by whatever amount would put it back into range. 
     * 3. rotate the bone's y-axis back to where you found it by the shortest path.
     * 
     * 
     * Now, I'm not just telling you all of this because it's interesting. It's super not. 
     * I'm telling you because steps 1 and 3 up there are super dangerous if your bone's y-axis is pointing in an opposite direction to this transform's y-axis. Which is what the optimize function is for and you should use it if you don't have a rest pose to use as a reference.
     * this way, you can set up the y-axis of this constraint to point away from whatever direction you know the bone isn't supposed to point in anyway, and then everything will be great. (but a rest pose is still preferable if for no other reason than that fewer things can go wrong with your implementation)
     * 
     * @param {*} forBone
     * @param {Number} range an angle in radians (no larger than 2*PI), indicating how much freedom to rotate about the y-axis is allowed
     * @param {IKNode} basis the reference basis to check the bone against. This is expected to be defined in the space of the bone's parent. This constraint will operate such that the transform returned by bone.getIKBoneOrientation() aligns with this basis. (Remember that the IKBoneOrientation of any bone doesn't necessarily have to align with the bone transform, as it is defined in the space of the bone transform). If you do not provide this, the constraint will initialize with whatever the current orientation of the bone is. You can change it by calling either optimize() or setCurrentAsReference();
     * @param {function} visibilityCondition a callback function to determine whether to display this constraint. The callback will be provided with a reference to this constraint and its bone as arguments.
     * @param {*} ikd optional  unique string identifier
     * @param {*} pool 
     */
    constructor(forBone, range=2*Math.PI-0.0001, inBasis = undefined, visibilityCondition=undefined, ikd = 'Twist-'+(Twist.totalTwists++), pool=noPool) {
        let basis = inBasis;
        if(inBasis == null)
            basis = new IKNode(null, null, undefined, pool);
        super(forBone, basis, ikd, pool);
        
        this.tempNode2 = new IKNode(null, null, undefined, pool);
        if(this.forBone) {
            this.forBone.springy = true;
        }
        this.visibilityCondition = visibilityCondition;
        this.display = new TwistConstraintDisplay(range, 1, this);
        this.range = range; 
        this.coshalfhalfRange = Math.cos(0.25*range);
        if(visibilityCondition != null)
            this.display.setVisibilityCondition(this.visibilityCondition);

        this.zhintgeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,1)]);
        this.zhintmat_safe = new THREE.LineBasicMaterial({ color: new THREE.Color(0,0,1), linewidth: 3});
        this.zhintmat_ouch = new THREE.LineBasicMaterial({ color: new THREE.Color(0.9,0,0.3), linewidth: 3});
        this.zhint = new THREE.Line(this.zhintgeo, this.zhintmat_safe);
        this.displayGroup.add(this.zhint);
        this.layers = new LayerGroup(this);
        this.__frame_internal = this.tempNode1; 
        this.__bone_internal = this.tempNode2;
        this.__bone_internal.setParent(this.__frame_internal); 
        this.__frame_calc_internal = new IKNode(undefined, undefined, undefined, this.pool);
        this.__bone_calc_internal = new IKNode(undefined, undefined, undefined,  this.pool);
        this.__bone_calc_internal.setRelativeToParent(this.__frame_calc_internal);
        /**@type {IKNode} */
        this.frameCanonical = this.basisAxes;
        this.boneCanonical = this.basisAxes.freeClone();
        this.boneCanonical.setParent(this.frameCanonical);


        if(inBasis == undefined && this.forBone != null) {
            this.setCurrentAsReference();
        }
        
        let me = this;
        this.displayGroup._visible = true;
        Object.defineProperty(this.displayGroup, 'visible', 
        {
            get() {return this._visible && me._visibilityCondition(me, me.forBone)},
            set(val) {this._visible = val}
        });

        this.updateDisplay();
    }


    /**sets the reference basis of the bone this constraint is attached to as being whatever pose the bone is currently in
     * @return {Twist} this for chaining
    */
    setCurrentAsReference() {
        //this.frameCanonical.adoptLocalValuesFromObject3D(this.forBone.getIKBoneOrientation());
        this.__frame_internal.emancipate();
        this.__frame_internal.localMBasis.lazyRefresh();
        this.__bone_internal.adoptLocalValuesFromObject3D(this.forBone.getIKBoneOrientation());
        this.__frame_internal.adoptLocalValuesFromObject3D(this.forBone);
        //this.__frame_internal.setRelativeToParent(this.frameCanonical);
        
        this.frameCanonical.localMBasis.adoptValues(this.__bone_internal.getGlobalMBasis());
        this.__frame_internal.emancipate();
        this.__frame_internal.localMBasis.lazyRefresh();
        this.frameCanonical.localMBasis.lazyRefresh();
        this.boneCanonical.adoptLocalValuesFromObject3D(this.forBone.getIKBoneOrientation());
        TrackingNode.transferLocalToObj3d(this.frameCanonical.localMBasis, this.displayGroup);
        this.frameCanonical.markDirty();
        this.updateDisplay();
        return this;
    }

    /**
     * 
     * @param {Number} baseZ the base angle against which range/2 on either side defines an allowable twist region
     */
    setBaseZ(baseZ) {
        this.baseZ = baseZ;
        this.__frame_internal.emancipate();
        this.__frame_internal.reset();
        this.__frame_internal.localMBasis.rotation.setFromAxisAngle(this.pool.any_Vec3(0,1,0), baseZ);
        this.__frame_internal.markDirty();
        this.__frame_internal.localMBasis.lazyRefresh();
        let yAlignRot = Rot.fromVecs(this.__frame_internal.localMBasis.getYHeading(), this.frameCanonical.localMBasis.getYHeading());
        yAlignRot.applyAfter(this.__frame_internal.localMBasis.rotation, this.frameCanonical.localMBasis.rotation);
        this.frameCanonical.localMBasis.lazyRefresh();
        this.frameCanonical.markDirty();
        this.frameCanonical.updateGlobal();
        TrackingNode.transferLocalToObj3d(this.frameCanonical.getGlobalMBasis(), this.displayGroup);
        this.__frame_internal.emancipate();
        this.__frame_internal.reset();
        this.__frame_internal.markDirty();
        this.__frame_internal.updateGlobal();        
        this.updateDisplay();
    }


    getBaseZ() {
        return this.baseZ;
    }

    /**
     * 
     * @param {Number} range total range of twist motion allowed through the base 
     */
    setRange(range) {
        this.range = range;
        this.coshalfhalfRange = Math.cos(0.25*range); // set to a fourth, because the range is defined as being on either side of the reference orientation.
        this.updateDisplay();
    }

    getRange() {
        return this.range;
    }

    updateDisplay() {        
        this.display.updateGeo(this.range, this.forBone.height);
        TrackingNode.transferLocalToObj3d(this.frameCanonical.localMBasis, this.displayGroup);
        if(this.display.parent == null && this.forBone?.parent != null)
            this.forBone.parent.add(this.displayGroup);
        if(this.display.parent == null)
            this.displayGroup.add(this.display);
        this.updateZHint();
    }

    /**
     * @param {IKNode} currentState the node to constrain, ideally prior to any potentially objectionable rotation being applied. Should be a sibiling of @param desiredState. 
     * @param {IKNode} currentBoneOrientation the node corresponding to the physical bone orientation, should be a child of @param currentState. 
     * @param {Rot} desiredRotation the local space rotation you are attempting to apply to currentState.
     * @param {WorkingBone} calledBy a reference to the current solver's internal representation of the bone, in case you're maing a custom constraint that goes deep into the rabbit hole
     * @return {Rot} the rotation which, if applied to currentState, would bring it as close as this constraint allows to the orientation that applying desired rotation would bring it to.
     */
    getAcceptableRotation (currentState, currentBoneOrientation, desiredRotation, calledBy = null) {

        //let correctAnswer = Rot.fromRot(currentState.localMBasis.rotation);
        this.__frame_calc_internal.adoptLocalValuesFromIKNode(currentState);       
        this.__bone_calc_internal.adoptLocalValuesFromIKNode(currentBoneOrientation);
        this.__frame_calc_internal.rotateByLocal(desiredRotation);        
        let desiredHeading = this.workingVec.set(this.__bone_calc_internal.getGlobalMBasis().getYHeading());
        this.__bone_calc_internal.setParent(this.frameCanonical);
        this.__frame_calc_internal.setParent(this.__bone_calc_internal); 
        let yAlignRot = this.tempOutRot.setFromVecs(this.__bone_calc_internal.localMBasis.getYHeading(), this.pool.any_Vec3(0,1,0));
        this.__bone_calc_internal.rotateByLocal(yAlignRot.shorten());
        this.__bone_calc_internal.localMBasis.rotation.clampToCosHalfAngle(this.coshalfhalfRange);
        this.__bone_calc_internal.markDirty(); 
        let backWhence = this.tempOutRot.setFromVecs(this.__bone_calc_internal.getGlobalMBasis().getYHeading(), desiredHeading);
        this.__bone_calc_internal.rotateByGlobal(backWhence.shorten());
        this.__frame_calc_internal.updateGlobal();
        this.__frame_calc_internal.emancipate(); 
        this.__bone_calc_internal.setRelativeToParent(this.__frame_calc_internal);
        //this.tempOutRot.setFromRot(this.__frame_calc_internal.localMBasis.rotation);
        return currentState.localMBasis.rotation.getRotationTo(this.__frame_calc_internal.localMBasis.rotation, this.tempOutRot).shorten();
    }

    /**
      * computes the raw unscaled discomfort associated with this historical value presuming pre-alleviation
      * @param {ConstraintResult} previousResult
      * @returns a number from 0 - 1, implying amount of pain
      * */
    _computePast_Pre_RawDiscomfortFor(previousResult) {
        return 0;
     }
 
     /**
      * computes the raw unscaled discomfort associated with this historical value presuming post alleviation
      * @param {ConstraintResult} previousResult
      * @returns a number from 0 - 1, implying amount of pain
      * */
     _computePast_Post_RawDiscomfortFor(previousResult) {
        return 0;
     }

    
    updateZHint() {
        /**This zhint code is a literal implementation of what the docstring explains, just to 
         * 1. get the literal z-axis coordinates and
         * 2. prove that it's true.
         * 
         * But the actual constraining algo is much more efficient and just amounts to a swing-twist decomposition.
         */

        //if(this.__bone_internal.parent != this.__frame_internal) {
            //sheer paranoia
            this.__bone_internal.emancipate();
            this.__bone_internal.reset();
            this.__bone_internal.localMBasis.lazyRefresh();
            this.__frame_internal.emancipate();
            this.__frame_internal.reset();
            this.__frame_internal.localMBasis.lazyRefresh();
            this.__frame_internal.markDirty()
            this.__bone_internal.setRelativeToParent(this.__frame_internal);
            this.__bone_internal.adoptLocalValuesFromObject3D(this.forBone.getIKBoneOrientation());
        //}

        this.__frame_internal.adoptLocalValuesFromObject3D(this.forBone);        

        //now that we're sure the lineage is properly set up, let's destroy it entirely.
        //set the internal bone relative to the canonical frame / basis axes in global space so we can y-axis align in local space
        this.__bone_internal.setParent(this.frameCanonical);
        let yAlignRot = Rot.fromVecs(this.__bone_internal.localMBasis.getYHeading(), this.pool.any_Vec3(0,1,0));
        this.__bone_internal.rotateByLocal(yAlignRot);        
        let newZ = this.__bone_internal.localMBasis.getZHeading();
        newZ.normalize();
        newZ.mult(this.display.displayRadius);
        
        //we're already in the same space the visualization is defined in, so we just draw the z-heading from here.
        const positions = this.zhint.geometry.attributes.position;
        positions.array[3] = newZ.x;
        positions.array[4] = newZ.y;
        positions.array[5] = newZ.z;
        positions.needsUpdate = true;

        if(this.__bone_internal.localMBasis.rotation.shorten().getAngle() > this.range/2) {
            this.zhint.material = this.zhintmat_ouch;
        } else {
            this.zhint.material = this.zhintmat_safe;
        }

        //put everything back the way we found it.
        this.__bone_internal.setRelativeToParent(this.__frame_internal);
        this.__bone_internal.adoptLocalValuesFromIKNode(this.boneCanonical);
        this.__frame_internal.adoptLocalValuesFromIKNode(this.frameCanonical);
    }

    /**a callback function to determine whether to display this constraint */
    setVisibilityCondition(visibleCallback) {
        if (visibleCallback ==null) 
            this._visibilityCondition = (forConstraint, forBone) => true;
        else { 
            this._visibilityCondition = visibleCallback;
        }
        this.display.setVisibilityCondition(visibleCallback);
        return this;
    }
    _visibilityCondition(forConstraint, forBone) {
        return true;
    }

    set visible(val) {
        this.displayGroup.visible = val; 
    }
    get visible() {
        return this.displayGroup.visible;
    }
}


class LayerGroup {
    constructor(forG) {
        this.forG = forG;
    }
    set(val) {
        this.forG.display.layers.set(val);
        this.forG.zhint.layers.set(val);
    }
    enable(val) {
        this.forG.display.layers.enable(val);
        this.forG.zhint.layers.enable(val);
    }
    disable(val) {
        this.forG.display.layers.disable(val);
        this.forG.zhint.layers.disable(val);
    }
}

class TwistConstraintDisplay extends THREE.Mesh {
    forTwist = null;
    mesh = null;
    static material = new THREE.MeshBasicMaterial({ color: 0xaa9922, side: THREE.DoubleSide, transparent: true, opacity: 0.8});
    constructor(range = Math.PI*2-0.0001, displayRadius = 1, forTwist = null) {
        let geo = new THREE.CircleGeometry(displayRadius, 100, (Math.PI / 2) - (range/2), range);
        super(geo, TwistConstraintDisplay.material);
        this.displayRadius = displayRadius;
        this.rotation.x = Math.PI/2;
        this.forTwist = forTwist;
    }

    updateGeo(range = this?.forTwist?.range ?? null, radius = this.displayRadius) {
        if(range == null) 
            throw new Error("needs a range");
        this.displayRadius = radius;
        this.geometry.dispose();
        this.geometry = new THREE.CircleGeometry(radius, 100, (Math.PI / 2) - (range/2), range);
        this.rotation.x = Math.PI/2;
    }

    /**a callback function to determine whether to display this constraint */
    setVisibilityCondition(visibleCallback) {
        if (visibleCallback ==null) 
            this._visibilityCondition = (forConstraint, forBone) => true;
        else { 
            this._visibilityCondition = visibleCallback;
        }
    }
    _visibilityCondition(forConstraint, forBone) {
        return true;
    }

    set visible(val) {
        this._visible = val; 
    }
    get visible() {
        return this._visible && this._visibilityCondition(this.forTwist, this.forTwist.forBone);
    }
}

