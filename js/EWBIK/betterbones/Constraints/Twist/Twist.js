const THREE = await import('three')
import { Bone, Object3D, Group } from 'three';
import { Rot } from "../../../util/Rot.js";
import { Vec3, any_Vec3, any_Vec3fv } from "../../../util/vecs.js";
import { Ray } from "../../../util/Ray.js";
import { IKNode, TrackingNode } from "../../../util/nodes/IKNodes.js";
import { generateUUID } from "../../../util/uuid.js";
const { Constraint, LimitingReturnful} = await import( "../Constraint.js");
import { Saveable } from '../../../util/loader/saveable.js';
import { Vector3 } from '../../../../three/three.module.js';
import { LayerGroup } from '../Constraint.js';


export class Twist extends LimitingReturnful {
    static TAU = Math.PI * 2;
    static PI = Math.PI;
    static totalInstances = 0;
    display = null// new TwistConstraintDisplay();
    zHint = null //line along the z-axis to visualize twist affordance;
    displayGroup = new Group();
    swing = new Rot(1,0,0,0);
    twist = new Rot(1,0,0,0); 
    workingVec = new Vec3(0,0,0);
    baseZ = 0;
    twistAxis = new Vec3(0,1,0);
    painfulness = 0.2;
    stockholmRate = 0.2;
    
    static fromJSON(json, loader, pool, scene) {
        let result = new Twist(null, json.range, null, null, json.ikd, pool);
        return result;
    }
    async postPop(json, loader, pool) {
        await super.postPop(json, loader, pool, scene);
        this.initTwistNodes();
        this.setBaseZ(parseFloat(json.baseZ));
        this.setRange(parseFloat(json.range));
        return this;
    }

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
     * @param {IKNode} referenceBasis the reference basis to check the bone against. This is expected to be defined in the space of the bone's parent. This constraint will operate such that the transform returned by bone.getIKBoneOrientation() aligns with this basis. (Remember that the IKBoneOrientation of any bone doesn't necessarily have to align with the bone transform, as it is defined in the space of the bone transform). If you do not provide this, the constraint will initialize with whatever the current orientation of the bone is. You can change it by calling either optimize() or setCurrentAsReference();
     * @param {Vec3|Vector3} twistAxis as an alternative to specifying the referenceBasis, you can specify a reference y-axis direction in oonjunction with a reference baseZ angle.
     * @param {Number} baseZ the base angle against which range/2 on either side defines an allowable twist region
     * @param {function} visibilityCondition a callback function to determine whether to display this constraint. The callback will be provided with a reference to this constraint and its bone as arguments.
     * @param {*} ikd optional  unique string identifier
     * @param {*} pool 
     */
    constructor(forBone, range=2*Math.PI-0.0001, referenceBasis = undefined, twistAxis = undefined, baseZ = undefined, visibilityCondition=undefined, ikd = 'Twist-'+(Twist.totalInstances++), pool=globalVecPool) {
        let basis = referenceBasis;
        if(referenceBasis == null && !Constraint.loadMode)
            basis = new IKNode(null, null, null, pool);
        super(forBone, basis, ikd, pool);
        
        
        if(this.forBone) {
            this.forBone.springy = true;
        }
        
        this.display = new TwistConstraintDisplay(range, 1, this);
        this.setVisibilityCondition(visibilityCondition);
        this.range = range; 
        this.coshalfhalfRange = Math.cos(0.25*range);
        if(visibilityCondition != null)
            this.display.setVisibilityCondition(visibilityCondition);

        this.zhintgeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,1)]);
        this.zhintmat_safe = new THREE.LineBasicMaterial({ color: new THREE.Color(0,0,1), linewidth: 3});
        this.zhintmat_ouch = new THREE.LineBasicMaterial({ color: new THREE.Color(0.9,0,0.3), linewidth: 3});
        this.zhint = new THREE.Line(this.zhintgeo, this.zhintmat_safe);
        this.displayGroup.add(this.zhint);
        this.layers = new LayerGroup(this, (val) => {
            this.display.layers.set(val);
            this.zhint.layers.set(val);
        }, 
        (val) => {
            this.display.layers.enable(val);
            this.zhint.layers.enable(val);
        },
        (val) => {
            this.display.layers.disable(val);
            this.zhint.layers.disable(val);
        });      
        
        if(!Constraint.loadMode) {
            this.initTwistNodes();
            if(referenceBasis == undefined && this.forBone != null) {
                if(twistAxis == undefined || baseZ == undefined) {
                    this.setCurrentAsReference();
                }
             }   
             if(baseZ != undefined) {
                this.setBaseZ(baseZ);
            }
            if(twistAxis != undefined) {
                this.setTwistAxis(twistAxis);
            }         
        }        
    }

    initTwistNodes() {
        this.__frame_internal = this.tempNode1; 
        this.__bone_internal = this.tempNode2;
        this.__bone_internal.setParent(this.__frame_internal); 
        this.__frame_calc_internal = new IKNode(undefined, undefined, null, this.pool);
        this.__bone_calc_internal = new IKNode(undefined, undefined, null, this.pool);
        this.__bone_calc_internal.setRelativeToParent(this.__frame_calc_internal);
        /**@type {IKNode} */
        this.frameCanonical = this.basisAxes;
        this.boneCanonical = this.basisAxes.freeClone();
        this.boneCanonical.setParent(this.frameCanonical);
        let me = this;
        this.displayGroup._visible = true;
        Object.defineProperty(this.displayGroup, 'visible', 
        {
            get() {return this._visible && me._visibilityCondition(me, me.forBone)},
            set(val) {this._visible = val}
        });

        this.setCurrentAsReference()
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
        this.__frame_calc_internal.adoptLocalValuesFromIKNode(this.frameCanonical);
        this.__bone_calc_internal.adoptLocalValuesFromIKNode(this.boneCanonical);
        this.__bone_calc_internal.setRelativeToParent(this.__frame_calc_internal);
        this.twistAxis.set(this.frameCanonical.localMBasis.yHeading);
        this.frameCanonical.localMBasis.rotation.getSwingTwist(this.pool.any_Vec3(0,1,0), this.swing, this.twist);
        this.baseZ = this.twist.getAngle();
        this.frameCanonical.localMBasis.writeToTHREE(this.displayGroup);
        this.frameCanonical.markDirty();
        this.updateDisplay();
        return this;
    }

    /**
     * 
     * @param {Number} baseZ the base angle against which range/2 on either side defines an allowable twist region
     */
    setBaseZ(baseZ, ensureTwistAxis = true) {
        let startTwistAx = this.pool.any_Vec3fv(this.twistAxis);
        if(!ensureTwistAxis) {
            this.setCurrentAsReference();
        } else {
            this.setTwistAxis(startTwistAx, false);
        }
        this.baseZ = baseZ;
        this.__frame_internal.emancipate();
        this.__frame_internal.reset();
        this.__frame_internal.localMBasis.rotation.setFromAxisAngle(this.pool.any_Vec3(0,1,0), baseZ);
        this.__frame_internal.markDirty();
        this.__frame_internal.localMBasis.lazyRefresh();
        let yAlignRot = Rot.fromVecs(this.__frame_internal.localMBasis.getYHeading(), this.twistAxis);
        yAlignRot.applyAfter(this.__frame_internal.localMBasis.rotation, this.frameCanonical.localMBasis.rotation);
        this.frameCanonical.localMBasis.lazyRefresh();
        this.frameCanonical.markDirty();
        this.frameCanonical.updateGlobal();
        this.frameCanonical.getGlobalMBasis().writeToTHREE(this.displayGroup);
        this.__frame_internal.emancipate();
        this.__frame_internal.reset();
        this.__frame_internal.markDirty();
        this.__frame_internal.updateGlobal(); 
               
        this.updateDisplay();
        return this;
    }

    


    /**sets the direction of the twist axis relative to the parent bone frame
     * @param {Vec3|Vector3} vec the twist axis
    */
    setTwistAxis(vec, ensureBaseZ = true) {
        let startZ = this.baseZ;
        this.setCurrentAsReference();
        this.twistAxis.x = vec.x;
        this.twistAxis.y = vec.y;
        this.twistAxis.z = vec.z;
        this.twistAxis.normalize();
        this.frameCanonical.localMBasis.rotation.setFromVecs(this.pool.any_Vec3(0,1,0), this.twistAxis);
        this.frameCanonical.localMBasis.lazyRefresh();
        this.frameCanonical.markDirty();
        if(ensureBaseZ) {
            this.setBaseZ(startZ, false);
        }
        return this;
    }

    printInitializationString(doPrint=true, parname) {
        let tag = "";
        for(let [t, b] of Object.entries(this.forBone.parentArmature.bonetags)) {
            if(b == this.forBone) {
                tag = t; break;
            }
        }
        parname = parname == null ? `armature.bonetags["${tag}"]` : parname;
        let postPar = parname==null ? '' : `.forBone`;
        let ta = this.twistAxis;
        let result = `new Twist(${parname}, ${this.range}, undefined, 
                armature.stablePool.any_Vec3(${ta.x}, ${ta.y}, ${ta.z}), 
                ${this.baseZ}, ${this._visibilityCondition},
                "${this.ikd}", armature.stablePool)`;
        if(this.enabled == false) 
            result += '.disable()';
        result+=';';
        if(doPrint) 
            console.log(result);
        else return result;
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
        return this;
    }

    getRange() {
        return this.range;
    }

    remove() {
        this.displayGroup.remove();
        this.zhint.remove();
        this.zhintgeo.dispose();
        if(this.parentConstraint != null) 
            this.parentConstraint.remove(this);
        else if(this.forBone != null)
            this.forBone.constraint = null;
    }

    updateDisplay() {        
        this.frameCanonical.localMBasis.writeToTHREE(this.displayGroup);
        if(this.display.parent == null && this.forBone?.parent != null)
            this.forBone.parent.add(this.displayGroup);
        if(this.display.parent == null)
            this.displayGroup.add(this.display);
        this.display.updateGeo(this.range, this.forBone.height);
        this.updateZHint();
    }

    /**
     * @param {IKNode} currentState the node to constrain, ideally prior to any potentially objectionable rotation being applied. 
     * @param {IKNode} currentBoneOrientation the node corresponding to the physical bone orientation, should be a child of @param currentState. 
     * @param {Rot} desiredRotation the local space rotation you are attempting to apply to currentState.
     * @param {Rot} storeIn an optional Rot object in which to store the result 
     * @param {WorkingBone} calledBy a reference to the current solver's internal representation of the bone, in case you're maing a custom constraint that goes deep into the rabbit hole
     * @return {Rot} the rotation which, if applied to currentState, would bring it as close as this constraint allows to the orientation that applying desired rotation would bring it to.
     */
    getAcceptableRotation (currentState, currentBoneOrientation, desiredRotation, storeIn=this.tempOutRot, calledBy = null) {
        /**get the desired orientation in parentbone space from the composition of currentstate*currentboneorienteation*desiredrotation
         * get the rotation that brings framecanonical to the desired orientation.
         * do a swingtwist decomposition.
         * clamp the twist, recompose it with the swing, then apply that to framecanonical's rotation to get back to the acceptable version of the desired orientation.
         * finally, return the difference between the currentstate and the resulting frame orientation
         */
        //this.__frame_calc_internal.adoptLocalValuesFromIKNode(currentState); 
        //this.__frame_calc_internal.rotateByLocal(desiredRotation);
        let currentOrientation = currentState.localMBasis.rotation.applyAfter(currentBoneOrientation.localMBasis.rotation, this.tempRot1);
        let desiredOrientation = desiredRotation.applyAfter(currentOrientation, this.tempRot2);
        let canonToDesired = this.frameCanonical.getGlobalMBasis().rotation.getRotationTo(desiredOrientation, this.tempRot2);
        this.tempVec1.setComponents(0, 1, 0);
        this.frameCanonical.localMBasis.rotation.applyToVec(this.tempVec1, this.tempVec1);
        canonToDesired.getSwingTwist(this.tempVec1, this.swing, this.twist);
        this.twist.clampToCosHalfAngle(this.coshalfhalfRange);
        let clampedDesireTarget = this.swing.applyAfter(this.twist, this.tempOutRot)
        let frameToClampedTarget = clampedDesireTarget.applyAfter(this.frameCanonical.localMBasis.rotation, this.tempOutRot);
        let result = currentOrientation.getRotationTo(frameToClampedTarget, storeIn);
        return result;
    }

    updateFullPreferenceRotation(currentState, currentBoneOrientation, iteration, calledBy) {
        this.constraintResult.reset(iteration);
        /**
         * get the desired orientation in parentbone space from the composition of currentstate*currentboneorienteation
         * get the rotation that brings framecanonical to the desired orientation.
         * do a swingtwist decomposition.
         * apply just the swing to framecanonical's rotation to get back to the twistless version of the desired orientation.
         * finally, return the difference between the currentstate and the resulting frame orientation
         */
        if(iteration >= this.giveup) return this.constraintResult;

        let currentOrientation = currentState.localMBasis.rotation.applyAfter(currentBoneOrientation.localMBasis.rotation, this.tempRot1);
        let canonToCurrent = this.frameCanonical.getGlobalMBasis().rotation.getRotationTo(currentOrientation, this.tempRot2);
        this.tempVec1.setComponents(0, 1, 0);
        this.frameCanonical.localMBasis.rotation.applyToVec(this.tempVec1, this.tempVec1);
        canonToCurrent.getSwingTwist(this.tempVec1, this.swing, this.twist);
        //here we can just ignore the twist component, since the full preference rotation is the one that amounts to no twist.
        let frameToTwistlessCurrentState = this.swing.applyAfter(this.frameCanonical.localMBasis.rotation, this.tempOutRot);
        currentOrientation.getRotationTo(frameToTwistlessCurrentState, this.constraintResult.fullRotation);
        this.constraintResult.fullRotation.shorten();      
        this.constraintResult.markSet(true);
        return this.constraintResult;
    }

    discomfortScale(val) {
        return val;
    }


     /**
     * computes the raw unscaled discomfort associated with this historical value presuming pre-alleviation
     * @param {ConstraintResult} previousResult
     * @returns a number from 0 - 1, implying amount of pain
     * */
     _computePast_Pre_RawDiscomfortFor(previousResult) {
        /**doing acos() instead of 2*acos() because division by PI*2 instead of TAU means the multiplication by 2 cancels out */
        return Math.acos(Math.abs(previousResult.fullRotation.normalize().w)) * Constraint.HALF_PI_RECIP;
     }
 
     /**
      * computes the raw unscaled discomfort associated with this historical value presuming post alleviation
      * @param {ConstraintResult} previousResult
      * @returns a number from 0 - 1, implying amount of pain
      * */
     _computePast_Post_RawDiscomfortFor(previousResult) {
        /*just the ratio of the angle of the full rotation to the preferred orientation minus the angle to the clamped rotation, 
        doing acos() instead of 2*acos() because division by PI instead of TAU means the multiplication by 2 cancels out */
        return previousResult.raw_preCallDiscomfort - ((Math.acos(Math.abs(previousResult.clampedRotation.w))) * Constraint.HALF_PI_RECIP);
     }

    
    updateZHint() {
        /**This zhint code is a literal implementation of what the class docstring explains, just to 
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
            this._visibilityCondition = (forConstraint, forBone) => false;
        else { 
            this._visibilityCondition = visibleCallback;
        }
        this.display.setVisibilityCondition(visibleCallback);
        return this;
    }
    _visibilityCondition(forConstraint, forBone) {
        return false;
    }

    set visible(val) {
        this.displayGroup.visible = val; 
    }
    get visible() {
        return this.displayGroup.visible;
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
            this._visibilityCondition = (forConstraint, forBone) => false;
        else { 
            this._visibilityCondition = visibleCallback;
        }
    }
    _visibilityCondition(forConstraint, forBone) {
        return false;
    }

    set visible(val) {
        this._visible = val; 
    }
    get visible() {
        return this._visible && this._visibilityCondition(this.forTwist, this.forTwist.forBone);
    }

    dispose() {
        this.geometry.dispose();
        this.remove();
    }
}

