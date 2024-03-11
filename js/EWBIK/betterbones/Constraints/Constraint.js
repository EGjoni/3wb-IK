const THREE = await import('three')
import { Bone, Object3D } from 'three';
import { IKNode } from '../../util/IKNodes.js';
import { Rot } from '../../util/Rot.js';
Math.TAU = Math.PI*2;

export class Constraint {
    static totalConstraints = 0;
    /**
    * @type {(Bone|ConstrainstStack)} a bone or constraint stack to attach this constrain to*/
    forBone = null;
    basisAxes = null;
    parentConstraint = null; 
    tempOutRot = null;
    constructor(forBoneOrConstraint, basis=null, ikd = 'Constraint-'(Constraint.totalConstraints++), pool=noPool) {
        let bone = forBoneOrConstraint;
        if(forBoneOrConstraint instanceof Constraint) {
            bone = forBoneOrConstraint.forBone;
            this.parentConstraint = forBoneOrConstraint;
        }
        this.forBone = bone;
        if(bone != null) {
            this.forBone.setConstraint(this); 
        }
        this.ikd = ikd;
        this.pool = pool;    
        this.tempOutRot = Rot.IDENTITY.clone(); 
        this.basis = basis ?? new IKNode(null,null,undefined,this.pool);
        this.constraintResult = new ConstraintResult(this, this.pool);
    }
    

    /**
     * @param {Bone} bone optional, the bone to attach this constraint to
     * @returns the bone this constraint is for (which will be the same as the argument provided if the argument wasn't null, otherwise it will return the bone prior to your attempt to set it to null. How dare you.)
     */
    attachedTo(bone = this.forBone) {
        this.forBone = bone; 
        return this.forBone;
    }

    /**
     * returns the input as given if it's already an IKNode. Otherwise, returns an equivalent IKNode of the input Object3D
     * @param {{Object3D | IKNode}} maybeNotNode 
     * 
     * @return {IKNode} result;
     */
     asNode(maybeNotNode) {
        let result = null;
        if(maybeNotNode instanceof Object3D) {  
            result = new IKNode(null, null, undefined, this.pool);
            result.adoptLocalValuesFromObject3D(maybeNotNode);
            result.markDirty();
        } else if (maybeNotNode instanceof IKNode) {
            result = maybeNotNode
        } else {
            throw new Error("Input must be specifiied as either an Object3D or IKNode in the space of the parent bone");
        }
        return result;
    }

    asTempNode(maybeNotNode) {
        let result = null;
        if(maybeNotNode instanceof Object3D) {  
            result = this.tempNode1.reset();
            result.adoptLocalValuesFromObject3D(maybeNotNode);
            result.markDirty();
        } else if (maybeNotNode instanceof IKNode) {
            result = maybeNotNode
        } else {
            throw new Error("Input must be specifiied as either an Object3D or IKNode in the space of the parent bone");
        }
        return result;
    }


    tempNode1 = new IKNode();
}


export class Limiting extends Constraint {
    
    constructor(...params) {
        super(...params);
        if(!forBone?.parent instanceof THREE.Bone) { 
            console.warn("Root bones should not specify a constraint. Add this bone to a parent before attempting to register a constrain on it.");
        }
    }

    getBasisAxes() {
        return this.basisAxes;
    }
}
export class LimitingReturnful extends Constraint {
    tempOutRot;
    constructor(...params) {
        super(...params);
    }

    getBasisAxes() {
        return this.basisAxes;
    }
}


export class Returnful extends Constraint {
    painfulness = 0.5;
    constructor(...params) {
        super(...params);
    }    

    getBasisAxes() {
        return this.basisAxes;
    }
}



export class ConstraintStack extends LimitingReturnful {
    static totalConstraints = -1;
    allconstraints = new Set(); //all constraints
    returnfulled = new Set(); //only the constraints that extend Returnful
    limiting = new Set(); //only the constraints that orientation
    totalPain = 0;
    

    constructor(forBone, ikd='ConstraintStack-'+ConstraintStack.totalConstraints++, pool=noPool) {
        super(forBone, null, ikd, pool)
        this.lastPrefState = new IKNode(null, null, undefined, this.pool);
        this.lastBoneOrientation = new IKNode(null, null, undefined, this.pool);
        this.lastBoneOrientation.setParent(this.lastPrefState); 
        this.lastBoneOrientation.adoptValues(this.forBone?.getIKBoneOrientation());
        this.lastLimitState = new IKNode(null, null, undefined, this.pool);
    }

    add(...subconstraints) {
        let updateTotalPain = false;
        for(let c of subconstraints) {
            if(c instanceof Constraint) {
                if(c instanceof Limiting || c instanceof LimitingReturnful) {
                    this.limiting.add(c);
                }
                if(c instanceof Returnful || c instanceof LimitingReturnful) {
                    this.returnfulled.add(c);
                    updateTotalPain = true;
                }
                this.allconstraints.add(c);
            }
        }
        if(updateTotalPain) this._updateTotalPain();
    }

    remove(...subconstraints) {
        let updateTotalPain = false;
        for(let c of subconstraints) {
            if(c instanceof Constraint) {
                if(c instanceof Limiting || c instanceof LimitingReturnful) {
                    this.limiting.delete(c);
                }
                if(c instanceof Returnful || c instanceof LimitingReturnful) {
                    this.returnfulled.delete(c);
                    updateTotalPain = true;
                }
                this.allconstraints.delete(c);
            }
        }
        if(updateTotalPain) this._updateTotalPain();
    }

    _updateTotalPain() {
        this.maxPain = 0;
        this.totalPain = 0;
        for(let c of this.returnfulled) {            
            this.totalPain += c.getPainfulness();
        }
    }

    /**
     * 
     * @param {Number} specifies the maximum angle in radians that this constraint is allowed give pullback values of.
     * this should be multiplied by the panfulness and used to calculate the pullback per iteration cache later
     */

    setPreferenceLeeway(val) {
        super.setPreferenceLeeway(val);
        for(let c of this.returnfulled) {
            c.setPreferenceLeeway(this.getPreferenceLeeway()*(c.getPainfulness()/this.totalPain));
        }
    }

    updatePerIterationLeewayCache(iterations) {
        for(let c of this.returnfulled) {
            c.updatePerIterationLeewayCache(iterations);
        }
    }

    getRectifyingRotation(desiredState, currentState, boneOrientation, constraintBasis, cosHalfReturnfullness, angleReturnfullness) {

    }

    
    getPreferenceRotation(desiredState, desiredBoneOrientation, currentState, currentBoneOrientation) {
        let accumulatedRot = this.tempOutRot.set(1,0,0,0);
        if(this.lastCalled > this.giveup) return accumulatedRot;

        this.lastPrefState.localMBasis.adoptValues(currentState.localMBasis);
        this.lastPrefState.globalMBasis.adoptValues(currentState.globalMBasis);
        
        for(let c of this.limiting) {
            if(c.lastCalled > c.giveup) continue;
            let rotBy = c.getPreferenceRotation(desiredState, desiredBoneOrientation, this.lastPrefState, this.lastBoneOrientation, constraintBasis, iteration, cosHalfReturnfullness, angleReturnfullness);
            this.lastPrefState.rotateBy(rotBy);
            rotBy.applyToRot(accumulatedRot, accumulatedRot);
        }
        this.lastCalled = iteration;
        return accumulatedRot;
    }

    getPainfulness() {
        return this.maxPain;  
    }

}


export class ConstraintResult {
    _fullRotation = Rot.IDENTITY.clone();
    _clampedRotation = Rot.IDENTITY.clone();
    _fullAngle = Math.TAU;
    _clampedAngle = Math.TAU;
    __preCallDiscomfort = null;
    __postCallDiscomfort = null;
    __raw_preCallDiscomfort = null;
    __raw_postCallDiscomfort = null;
    last_iteration = 0;
    pool = noPool;
    forConstraint = null;

    constructor(forConstraint, pool = noPool) {
        this.pool = noPool; 
        this.forConstraint = forConstraint;
    }
    reset(iteration) {
        this.iteration = iteration;
        this._fullRotation.setComponents(1,0,0,0);
        this._clampedRotation.setComponents(1,0,0,0);
        this.__preCallDiscomfort = null;
        this.__postCallDiscomfort = null;
        this.__raw_preCallDiscomfort = null;
        this.__raw_postCallDiscomfort = null;
        this._fullAngle = null;
        this._clampedAngle = null;
    }

    get clampedAngle() {
        if(this._clampedAngle == null)
            this._clampedAngle = this._clampedRotation.getAngle();
        return this._clampedAngle;
    }

    get fullAngle() {
        if(this._fullAngle == null)
            this._fullAngle = this._fullRotation.getAngle();
        return this._fullAngle;
    }

    set fullRotation(rot) {
        this._fullRotation.setComponents(rot.x, rot.y, rot.z, rot.w);
    }

    set clampedRotation(rot) {
        this._clampedRotation.setComponents(rot.x, rot.y, rot.z, rot.w);
    }

    get fullRotation() {
        return this._fullRotation;
    }
    get clampedRotation() {
        return this._clampedRotation;
    }
    get preCallDiscomfort() {
        if(this.__preCallDiscomfort == null) 
            this.__preCallDiscomfort = this.forConstraint.discomfortScale(this.raw_preCallDiscomfort);
        return this.__preCallDiscomfort;
        
    }

    get postCallDiscomfort() {
        if(this.__postCallDiscomfort == null) 
            this.__postCallDiscomfort = this.forConstraint.discomfortScale(this.raw_postCallDiscomfort);
        return this.__postCallDiscomfort;
    }

    get raw_preCallDiscomfort() {
        if(this.__raw_preCallDiscomfort == null) 
            this.__raw_preCallDiscomfort = this.forConstraint._computePast_Pre_RawDiscomfortFor(this);
        return this.__raw_preCallDiscomfort;
    }

    get raw_postCallDiscomfort() {
        if(this.__raw_postCallDiscomfort == null) 
            this.__raw_postCallDiscomfort = this.forConstraint._computePast_Post_RawDiscomfortFor(this);
        return this.__raw_postCallDiscomfort;
    }
}

let limitingMixing = {
    /**
     * @param {IKNode} desiredState the state the node wants to be in if there were no constraints. should be a sibling of @param currentState.
     * @param {IKNode} desiredBoneOrientation the physical bone orientation of the state the node wants to be in if there were no constraints. Should be a child of @param desiredState. 
     * @param {IKNode} currentState the node to constrain. Should be a sibiling of @param desiredState. 
     * @param {IKNode} currentBoneOrientation the node corresponding to the physical bone orientation, should be a child of @param currentState. 
     * @param {WorkingBone} calledBy a reference to the current solver's internal representation of the bone, in case you're maing a custom constraint that goes deep into the rabbit hole
     * @return {Rot} the rotation which, if applied to currentState, would bring it as close to desiredState as this constraint allows.
     */
    getRectifyingRotation (desiredState, desiredBoneOrientation, currentState, currentBoneOrientation, calledBy = null) {
        return Rot.IDENTITY; 
    }
}

let returnfulMixin = {

    /**last iteration this returnful constraint was called on. Used 
     * for quickly determining whether to bother running after the stockholm rate 
     * has determined to give up
    */
    lastCalled : 0, 

    /**
    * @param {IKNode} currentState the state the node is currently in. should be a sibling of @param previousState.
    * @param {IKNode} currentBoneOrientation the node corresponding to the physical bone orientation, should be a child of @param currentState.
    * @param {IKNode} previousState the node as it was prior to the . Should be a sibiling of @param desiredState. 
    * @param {Number} iteration the current iteration of this solver pass
    * @param {WorkingBone} calledBy a reference to the current solver's internal representation of the bone, in case you're maing a custom constraint that goes deep into the rabbit hole
     * @return {ConstraintResult} an object providing information about how much to rotate the object in which direction to make it maximally comfortable. How much to rotate to do so while obeying clamp rules. how much pain the joint was in prior to fixing, how much after the proposed fix, etc.
     */   
    getPreferenceRotation (currentState, currentBS, boneOrientation, iteration, calledBy = null) {
        return Rot.IDENTITY; 
    }, 

    /**
     * @param {Function} callback this constraint will provide the callback with some constraint specific value from 0-1 (meaning will vary per constraint). Your function should return some value within that range to adjust how quickly something will be deemed how painful. If one isn't provided, the default range will be usedl
     */
     setDiscomfortFunction(callback = (val) => val) {
        this.discomfortScale = callback;
    },

    discomfortScale(val) {
        return val;
    },

    /**
     * 
     * @param {Number} val a number from 0-1, interpreted as the maximum percentage of the dampening parameter the joint is allowed 
     * to try to rotate back toward a less painful region.
     */
    setPainfulness (val) {
        this.painfulness = val;
        if (this.forBone && this.forBone.parentArmature) {
            this.forBone.parentArmature.updateShadowSkelRateInfo(); 
        }
    },
    getPainfulness () {
        return this.painfulness;
    },

    /**
     * 
     * @param {Number} specifies the maximum angle in radians that this constraint is allowed give pullback values of.
     * this should be multiplied by the panfulness and used to calculate the pullback per iteration cache later
     */
    setPreferenceLeeway (radians) {
        this.lastCalled = 0;
        this.preferenceLeeway = this.painfulness * radians;
    },

    getPreferenceLeeway () {
        return this.preferenceLeeway;
    },
    stockholmRate : 0.5,

    /**
     * 
     * @param {Number} val 0-1 indicating how many iterations into a solver request this constraint resigns itself to just accepting the pain.
     */
    setStockholmRate (val) {
        this.stockholmRate = val;
    },

    getStockholmRate () {
        return this.stockholmRate;
    },
    leewayCache : [],
    updatePerIterationLeewayCache(iterations) {
        this.giveup = iterations*this.stockholmRate;
        this.leewayCache = new Array(Math.floor(this.giveup));
        let max = this.preferenceLeeway;
        for(let i = 0; i<this.giveup; i++) {
            let t = 1-(i/this.giveup); 
            let angle = max * t;
            this.leewayCache[i] = Math.cos(angle*0.5);
        }
    },
    
    /**
     * computes the raw unscaled discomfort associated with this historical value presuming pre-alleviation
     * @param {ConstraintResult} previousResult
     * @returns a number from 0 - 1, implying amount of pain
     * */
    _computePast_Pre_RawDiscomfortFor(previousResult) {

    },

    /**
     * computes the raw unscaled discomfort associated with this historical value presuming post alleviation
     * @param {ConstraintResult} previousResult
     * @returns a number from 0 - 1, implying amount of pain
     * */
    _computePast_Post_RawDiscomfortFor(previousResult) {

    }
    
}

Object.assign(Limiting.prototype, limitingMixing);
Object.assign(Returnful.prototype, returnfulMixin); 
Object.assign(LimitingReturnful.prototype, limitingMixing, returnfulMixin)