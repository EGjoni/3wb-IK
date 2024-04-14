const THREE = await import('three')
import { Bone, Object3D } from 'three';
import { IKNode } from '../../util/nodes/IKNodes.js';
import { Rot } from '../../util/Rot.js';
import { IKTransform } from '../../util/nodes/IKTransform.js';
import { Vec3 } from '../../util/vecs.js';
import { Saveable } from '../../util/loader/saveable.js';
Math.TAU = Math.PI*2;

export class Constraint extends Saveable {
    static HALF_PI_RECIP = 1/(Math.PI/2);
    static PI_RECIP = 1/Math.PI;
    static TAU_RECIP = 1/(2*Math.PI);
    static totalInstances = 0;
    /**
     * @type {IKTransform}
     */
    boneOrientationBasis = new IKTransform(null, null, null, null, null);
    forBone = null;

    /**
     * @type {IKNode}
     */
    basisAxes = null;
    parentConstraint = null; 
    tempOutRot = Rot.IDENTITY.clone();
    enabled = true;
    _visible = true;
    cachedLeeways = {};
    cachedGiveups = {};

    /**@return {JSON} a json object by which this constraint may later be loaded*/
    toJSON() {
        let result = super.toJSON(); 
        result.enabled = this.enabled;
        return result;
    }

    getRequiredRefs() {
        let req = {};
        req.basisAxes = this.basisAxes;
        req.forBone = this.forBone;
        req.forArmature = this.forBone.parentArmature;
        req.boneOrientationAxes = this.boneOrientationAxes;
        
        if(this.parentConstraint != null) {
            req.parentConstraint = this?.parentConstraint; 
        }
        return req; 
    }

    async postPop(json, loader, pool, scene)  {
        let p = await Saveable.prepop(json.requires, loader, pool, scene);
        if(p.forBone != null) {
            this.forBone = p.forBone;
            if(!(this.forBone instanceof THREE.Bone) && p.forArmature != null) {
                this.forBone = p.forArmature.bonetags[json.forBone];
            } 
            if(this.forBone == null) {
                throw new Error(`Could not find bone to which ${this.constructor.name} ${this.ikd} purportedly belongs`);
            }
        }
        if(p.parentConstraint != null)
            this.parentConstraint = p.parentConstraint;
        this.basisAxes = p.basisAxes;
        this.enabled = json.enabled;
        this.boneOrientationAxes = p.boneOrientationAxes;
        this.initNodes();
        return this;
    }

    /**
    * @param {(Bone|ConstraintStack)} forBoneOrConstraint bone or constraint stack to attach this constraint to
    * if a bone is provided, this constraint will automatically wrap itself in a constraint stack before 
    * adding itself to the constraint stack and then adding the constraint stack to the bone.
    * @param {IKNode} basis a reference frame specific to this constraint against which the limit and pain tests will be performed,
     * this doesn't need to be explicitly parented to anything, but will always be interpreted as being parented
     * to whatever the bone is parent to. If one isn't provide, it's taken to mean one isn't needed
    * */    
    constructor(forBoneOrConstraint, basis=null, ikd = `Constraint-${Constraint.totalInstances++}`, pool=null) {
        super(ikd, new.target.name, new.target.totalInstances, pool);
        
        let bone = forBoneOrConstraint;
        this.inBasis = basis;
        this.tempHeading = new Vec3(0, 1, 0);
        this.tempVec1 = new Vec3(0, 1, 0);
        this.tempVec2 = new Vec3(0, 1, 0);
        this.tempVec3 = new Vec3(0, 1, 0);
        this.constraintResult = new ConstraintResult(this, this.pool);        
        if(!Saveable.loadMode) {
            if(forBoneOrConstraint instanceof ConstraintStack) {
                bone = forBoneOrConstraint.forBone;
                this.parentConstraint = forBoneOrConstraint;
                this.forBone = bone;
                this.parentConstraint.add(this);             
            } else if (forBoneOrConstraint instanceof Bone){
                this.forBone = forBoneOrConstraint;
                if(this.forBone.getConstraint() != null && !(this.forBone.getConstraint() instanceof ConstraintStack)) {
                    throw new Error(`Bone already has a constraint. And it's not of the ConstraintStack type. 
                    Having multiple constraints on the same bone is 100% supported and is exactly the thing ConstraintStacks are supposed to let you do
                    and there's even a bunch of code to wrap any attempt at a sole constraint up in a ConstraintStack before applying it to a bone
                    so quite frankly I don't understand how you got yourself into this situation, but you absolutely deserve getting this error thrown at you.`);
                } else if (this.forBone.getConstraint() != null) {
                    this.parentConstraint = this.forBone.getConstraint();
                    this.parentConstraint.add(this);
                } else if(!(this instanceof ConstraintStack)) {
                    this.parentConstraint = new ConstraintStack(this.forBone, "Constraint-stack-for-"+this.forBone.ikd, pool);
                    this.parentConstraint.add(this)
                }            
            }
            if(pool == null) {
                this.pool = this.forBone.parentArmature.stablePool;
            }
        
            this.initNodes();
            /*if(!this.forBone?.parent instanceof THREE.Bone) { 
                console.warn("Adding constraints on Root bones may lead to unintuitive behavior");        
            }*/
        }
    }

    initNodes() {
        if(this.tempNode1.localMBasis == null) {
            //I made a poor decision with the save/load logic and this is the shameful hack to get around the consequences.
            this.tempNode1.localMBasis = new IKTransform(); this.tempNode1.globalMBasis = new IKTransform();
            this.tempNode2.localMBasis = new IKTransform(); this.tempNode2.globalMBasis = new IKTransform();
        }
        let basis = this.inBasis; 
        if(this.parentConstraint == null) {
            this.boneOrientationBasis.setFromObj3d(this.forBone.getIKBoneOrientation());
        } else {
            this.boneOrientationBasis = this.parentConstraint.boneOrientationBasis;
        }
        this.boneOrientationAxes = new IKNode(null,null,undefined);   
        this.basisAxes = new IKNode(null,null,undefined);
        this.boneOrientationAxes.setRelativeToParent(this.basisAxes); 
        if(basis != null) {          
            this.boneOrientationAxes.localMBasis.adoptValues(this.boneOrientationBasis);
        }
        this.inBasis = null;
    }

    /**sets the cached per iteration leeway to the value requested. 
     * returns true if the cache needs updating, false otherwise. 
     * Cache is expectd to be updating by classes extending this one.*/
    setPerIterationLeewayCache(iterations) {
        if(this.cachedLeeways[iterations] == null || this.cachedGiveups[iterations] == null) return true;
        else {
            this.giveup = this.cachedGiveups[iterations];
            this.leewayCache = this.cachedLeeways[iterations];
            return false;
        }
    }

    /**invalidates the leeway cache, indicating this constraint needs to recompute them the next time it's used*/
    invalidateCache() {
        if(this.leewayCache == null) return; //indicates cache has already been invalidated
        this.giveup = null;
        this.leewayCache = null;
        for(let [i, r] of Object.entries(this.cachedGiveups)) {
            this.cachedGiveups[i] = null;
        }
        for(let [i, r] of Object.entries(this.cachedLeeways)) {
            this.cachedLeeways[i] = null;
        }
    }
    

    remove() {
        if(this.parentConstraint != null) 
            this.parentConstraint.remove(this);
        else if(this.forBone != null)
            this.forBone.constraint = null;
    }

    isEnabled() {
        return this.enabled;
    }

    toggle() {
        this.enabled = !this.isEnabled();        
        this.forBone?.parentArmature?.noOp(); //just to give anything watching the armature truer info if its trying to update the pain display
    }

    enable() {
        this.enabled = true;
        if (this.parentConstraint != null) this.parentConstraint.childEnabled(); 
        if(this.parentConstraint == null) this.forBone.parentArmature.updateShadowSkelRateInfo();
        this.forBone?.parentArmature?.noOp(); //just to give anything watching the armature truer info if its trying to update the pain display
    }

    disable() {
        this.enabled = false;
        if (this.parentConstraint != null) this.parentConstraint.childDisabled();  
        this.constraintResult.__raw_postCallDiscomfort = null;
        this.constraintResult.__raw_preCallDiscomfort = null;
        if(this.parentConstraint == null) this.forBone.parentArmature.updateShadowSkelRateInfo();
        this.forBone?.parentArmature?.noOp(); //just to give anything watching the armature truer info if its trying to update the pain display
    }

    _visibilityCondition(cnstrt, bone) {
        return false;
    }


    printInitializationString() {
        return '';
    }
    

    /**invalidates the ConstraintResult object maintained by this constraint (and all such child constraints*/
    markDirty() {
        this.constraintResult.markSet(false);
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

    invalidatePain() {
        this.constraintResult.__raw_postCallDiscomfort = null;
        this.constraintResult.__raw_preCallDiscomfort = null;
    }

    updateDisplay() {

    }
    tempNode1 = new IKNode();
    tempNode2 = new IKNode();
    
}


export class Limiting extends Constraint {
    
    constructor(...params) {
        super(...params);
        /*if(!this.forBone?.parent instanceof THREE.Bone) { 
            console.warn("Root bones should not specify a constraint. Add this bone to a parent before attempting to register a constrain on it.");
        }*/
    }

    toJSON(...params) {
        return super.toJSON(...params);
    }
    async postPop(...params) {
        return await super.postPop(...params);
    }

    getRequiredRefs(...params) {
        return super.getRequiredRefs(...params);
    }

    /**
     * 
     * @param {IKNode} currentState the node to constrain, ideally prior to any potentially objectionable rotation being applied. Should be a sibiling of @param desiredState. 
     * @param {IKNode} currentBoneOrientation the node corresponding to the physical bone orientation, should be a child of @param currentState. 
     * @param {Rot} desiredRotation the local space rotation you are attempting to apply to currentState.
     * @param {WorkingBone} calledBy a reference to the current solver's internal representation of the bone, in case you're maing a custom constraint that goes deep into the rabbit hole
     * @return {Rot} the rotation which, if applied to currentState, would bring it as close as this constraint allows to the orientation that applying desired rotation would bring it to.
     */
    getAcceptableRotation (currentState, currentBoneOrientation, desiredRotation, calledBy = null) {
        /**to be overriden by child classes */
        return desiredRotation; 
    }

    getBasisAxes() {
        return this.basisAxes;
    }

    isLimiting() {
        return true;
    }
    isReturnful() {
        return false;
    }


}


export class Returnful extends Constraint {
    painfulness = 0.5;
    stockholmRate = 0.2;
     /**last iteration this returnful constraint was called on. Used 
     * for quickly determining whether to bother running after the stockholm rate 
     * has determined to give up
    */
    lastCalled = 0;
    leewayCache = [];
    baseRadians = 0.08;
    constructor(...params) {
        super(...params);
    } 
    
    toJSON() {
        let result = super.toJSON();
        result.painfulness = this.painfulness;
        result.stockholmRate = this.stockholmRate;
        return result;
    }

    async postPop(json, loader, pool, scene)  {
        await super.postPop(json, loader, pool, scene);
        this.painfulness = json.painfulness;
        this.stockholmRate = json.stockholmRate;
        this.baseRadians = json.baseRadians;

    }

     /**
     * @param {IKNode} currentState the state the node is currently in. should be a sibling of @param previousState.
     * @param {IKNode} currentBoneOrientation the node corresponding to the physical bone orientation, should be a child of @param currentState.
     * @param {Number} iteration the current iteration of this solver pass
     * @param {WorkingBone} calledBy a reference to the current solver's internal representation of the bone, in case you're maing a custom constraint that goes deep into the rabbit hole
    * @return {ConstraintResult} an object providing information about how much to rotate the object in which direction to make it maximally comfortable. How much to rotate to do so while obeying clamp rules. how much pain the joint was in prior to fixing, how much after the proposed fix, etc.
      */   
     updateFullPreferenceRotation (currentState, currentBoneOrientation, iteration, calledBy = null) {
         this.constraintResult.fullRotation = Rot.IDENTITY;
         return this.constraintResult;
     }


     /**
     * @param {IKNode} currentState the state the node is currently in. should be a sibling of @param previousState.
     * @param {IKNode} currentBoneOrientation the node corresponding to the physical bone orientation, should be a child of @param currentState.
     * @param {Number} iteration the current iteration of this solver pass
    * @return {ConstraintResult} an object providing information about how much to rotate the object in which direction to make it maximally comfortable. How much to rotate to do so while obeying clamp rules. how much pain the joint was in prior to fixing, how much after the proposed fix, etc.
      */   
     getClampedPreferenceRotation(currentState, currentBoneOrientation, iteration, reset = true, calledBy) {
        if(!this.constraintResult.isSet()) {
            this.updateFullPreferenceRotation(currentState, currentBoneOrientation, iteration, calledBy)
        }
        this.constraintResult.clampedRotation = this.constraintResult.fullRotation;
        this.constraintResult._clampedRotation.clampToCosHalfAngle(this.leewayCache[iteration]);   
        
        return this.constraintResult;
    }



     /**
      * like getClampedRotation, but allows for somewhat imprecise but better than nothing weight factor over clamping.
     * @param {IKNode} currentState the state the node is currently in. should be a sibling of @param previousState.
     * @param {IKNode} currentBoneOrientation the node corresponding to the physical bone orientation, should be a child of @param currentState.
     * @param {Number} iteration the current iteration of this solver pass
     * @param {Boolean} weight optional amount to increase the clamp by. Nonlinear, but better than nothing if negotiating between clamps based on some metric
    * @return {ConstraintResult} an object providing information about how much to rotate the object in which direction to make it maximally comfortable. How much to rotate to do so while obeying clamp rules. how much pain the joint was in prior to fixing, how much after the proposed fix, etc.
      */   
     getWeightClampedPreferenceRotation(currentState, currentBoneOrientation, iteration, weight=1, calledBy) {
        if(!this.constraintResult.isSet()) {
            this.updateFullPreferenceRotation(currentState, currentBoneOrientation, iteration, calledBy)
        }
        this.constraintResult.clampedRotation = this.constraintResult.fullRotation;
        this.constraintResult._clampedRotation.clampToCosHalfAngle(1-((1-this.leewayCache[iteration])*weight*this.constraintResult.preCallDiscomfort));   
        
        return this.constraintResult;
    }
 
     /**
      * @param {Function} callback this constraint will provide the callback with some constraint specific value from 0-1 (meaning will vary per constraint). Your function should return some value within that range to adjust how quickly something will be deemed how painful. If one isn't provided, the default range will be usedl
      */
      setDiscomfortFunction(callback = (val) => val) {
         this.discomfortScale = callback;
      }
 
     discomfortScale(val) {
         return val;
     }
 
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
     }
     getPainfulness () {
         return this.painfulness;
     }
 
     /**
      * 
      * @param {Number} specifies the maximum angle in radians that this constraint is allowed give pullback values of.
      * this should be multiplied by the panfulness and used to calculate the pullback per iteration cache later
      */
     setPreferenceLeeway (radians = this.baseRadians) {
         this.lastCalled = 0;
         this.baseRadians = radians;
         let newLeeway = this.painfulness * radians;
         if(newLeeway != this.preferenceLeeway)
            this.invalidateCache();
         this.preferenceLeeway = this.painfulness * radians;
     }
 
     getPreferenceLeeway () {
         return this.preferenceLeeway;
     }
     
 
     /**
      * 
      * @param {Number} val 0-1 indicating how many iterations into a solver request this constraint resigns itself to just accepting the pain.
      */
     setStockholmRate (val) {
         this.stockholmRate = val;
         if (this.forBone && this.forBone.parentArmature) {
            this.forBone.parentArmature.updateShadowSkelRateInfo(); 
        }
     }
 
     getStockholmRate () {
         return this.stockholmRate;
     }
     
     setPerIterationLeewayCache(iterations) {
        if(!super.setPerIterationLeewayCache(iterations)) return;
        this.giveup = Math.floor(iterations*this.stockholmRate);
        this.leewayCache = new Array(Math.floor(this.giveup));
        let max = this.preferenceLeeway;
        for(let i = 0; i<this.giveup; i++) {
            let t = 1-(i/this.giveup); 
            let angle = max * t;
            this.leewayCache[i] = Math.cos(angle*0.5);
        }
        this.cachedLeeways[iterations] = this.leewayCache;
        this.cachedGiveups[iterations] = this.giveup;
     }
     
     /**
      * computes the raw unscaled discomfort associated with this historical value presuming pre-alleviation
      * @param {ConstraintResult} previousResult
      * @returns a number from 0 - 1, implying amount of pain
      * */
     _computePast_Pre_RawDiscomfortFor(previousResult) {
        throw new Error("Returnful Constraints must return Pre_RawDiscomfort");
     }
 
     /**
      * computes the raw unscaled discomfort associated with this historical value presuming post alleviation
      * @param {ConstraintResult} previousResult
      * @returns a number from 0 - 1, implying amount of pain
      * */
     _computePast_Post_RawDiscomfortFor(previousResult) {
        throw new Error("Returnful Constraints must return Post_RawDiscomfort");
     }

    getBasisAxes() {
        return this.basisAxes;
    }
    isLimiting() {
        return false;
    }
    isReturnful() {
        return this.isEnabled();
    }
}


export class LimitingReturnful extends Returnful {
    toJSON() {
        let result = super.toJSON();
        result.limitingActive = this.limitingActive;
        result.returnfulActive = this.returnfulActive;
        return result;
    }

    constructor(...params) {
        super(...params);
    }

    /**
     * 
     * @param {IKNode} currentState the node to constrain, ideally prior to any potentially objectionable rotation being applied. Should be a sibiling of @param desiredState. 
     * @param {IKNode} currentBoneOrientation the node corresponding to the physical bone orientation, should be a child of @param currentState. 
     * @param {Rot} desiredRotation the local space rotation you are attempting to apply to currentState.
     * @param {WorkingBone} calledBy a reference to the current solver's internal representation of the bone, in case you're maing a custom constraint that goes deep into the rabbit hole
     * @return {Rot} the rotation which, if applied to currentState, would bring it as close as this constraint allows to the orientation that applying desired rotation would bring it to.
     */
    getAcceptableRotation (currentState, currentBoneOrientation, desiredRotation, calledBy = null) {
        /**to be overriden by child classes */
        return desiredRotation; 
    }

    getBasisAxes() {
        return this.basisAxes;
    }

    limitingActive = true; 
    returnfulActive = true;

    setLimitState(val) {
        this.limitingActive = val;
    }
    setReturnfulState(val) {
        this.returnfulActive = val;
    }

    isLimiting() {
        return this.isEnabled() && this.limitingActive;
    }
    isReturnful() {
        return this.isEnabled() && this.returnfulActive;
    }
}


export class ConstraintStack extends LimitingReturnful {
    static totalInstances = -1;
    preferenceLeeway = Math.PI*2;
    stockholmRate = 1;
    allconstraints = new Set(); //all constraints
    returnfulled = new Set(); //only the constraints that extend Returnful
    limiting = new Set(); //only the constraints that orientation
    giveup = null;



    static fromJSON(json, loader, pool, scene) {
        let result = new ConstraintStack(undefined, json.ikd, pool);
        return result;
    }
    toJSON() {
        let result = super.toJSON();
        result.stockholmRate = this.stockholmRate;
        result.preferenceLeeway = this.preferenceLeeway;
        return result;
    }
    getRequiredRefs() {
        let req = super.getRequiredRefs();
        req.allconstraints = [];
        req.limiting = [];
        req.returnfulled = [];
        for(let ac of this.allconstraints) {
            req.allconstraints.push(ac);
        }
        for(let l of this.limiting) {
            req.limiting.push(l);
        }
        for(let r of this.returnfulled) {
            req.returnfulled.push(r);
        }
        return req;
    }

    async postPop(json, loader, pool, scene)  {
        await super.postPop(json, loader, pool, scene);
        if(this.parentConstraint == null && this.forBone != null)
            this.forBone.constraint = this;
        let p = await Saveable.prepop(json.requires, loader, pool, scene);
        this.initNodes();
        for(let ac of p.allconstraints) {
            this.allconstraints.add(ac); 
        }
        for(let r of p.returnfulled) {
            if(r.isEnabled()) {
                this.returnfulled.add(r); 
            }
        }
        for(let l of p.limiting) {
            if(l.isEnabled()) {
                this.limiting.add(l); 
            }
        }
    }
    
    /**
     * 
     * @param {(Bone|ConstraintStack)} forBoneOrConstraint the bone or parent constraint stack this stack is for
     * @param {*} ikd 
     * @param {*} pool 
     */
    constructor(forBoneOrConstraint, ikd='ConstraintStack-'+ConstraintStack.totalInstances++, pool=null) {
        super(forBoneOrConstraint, null, ikd, pool);
        if(this.forBone != null && this.parentConstraint == null) {
            this.forBone.setConstraint(this); 
        }
        if(!Saveable.loadMode)
            this.initNodes();
        this.layers = new LayerGroup(this, (val)=>this.layerSet(val), 
            (val)=>this.layersEnable(val), (val)=>this.layersDisable(val));
    }

    initNodes() {
        this.lastPrefState = new IKNode(null, null, undefined);
        this.lastBoneOrientation = new IKNode(null, null, undefined);
        this.lastBoneOrientation.setParent(this.lastPrefState); 
        this.lastBoneOrientation.adoptLocalValuesFromObject3D(this.forBone?.getIKBoneOrientation());
        this.lastLimitState = new IKNode(null, null, undefined);
        this.lastLimitBoneOrientation = new IKNode(null, null, undefined);
        this.lastLimitBoneOrientation.setParent(this.lastLimitState); 
        this.lastLimitBoneOrientation.adoptLocalValuesFromObject3D(this.forBone?.getIKBoneOrientation());
        if(this.parentConstraint != null) this.visible = this.parentConstraint.visible;
    }

    add(...subconstraints) {
        for(let c of subconstraints) {
                this.allconstraints.add(c);
            }
        this.updateLimitingSet();
        this.updateReturnfulledSet();
    }

    remove(...subconstraints) {
        for(let c of subconstraints) {
            this.allconstraints.delete(c);
        }
        this.updateLimitingSet();
        this.updateReturnfulledSet();
    }


    printInitializationString(doPrint = this.parentConstraint == null, parname = null) {
        let result = ``;
        let varname = `cstack_${this.instanceNumber}`;
        let hassubConstraintStack = false; 
        for(let c of this.allconstraints) { 
            if(c instanceof ConstraintStack) {
                hassubConstraintStack = true;
                break;
            }
        }
        if(parname == null && hassubConstraintStack) {
            let tag = "";
            for(let [t, b] of Object.entries(this.forBone.parentArmature.bonetags)) {
                if(b == this.forBone) {
                    tag = t; break;
                }
            }
            parname = `armature.bonetags["${tag}"]`;
        }

        if(hassubConstraintStack) {
            result += `let ${varname} = new ConstraintStack(${parname}, "${this.ikd}");
`
        } else varname = null;

        for(let c of this.allconstraints) {
            result+= `${c.printInitializationString(false, varname)}
`;
        }
        if(doPrint) {
            console.log(result);
        } else return result;
    }


    updateReturnfulledSet() {
        this.returnfulled = new Set();
        for(let c of this.allconstraints) {     
            if(c instanceof Returnful) {
                if(c.isEnabled())
                    this.returnfulled.add(c);
            }
        }
    }

    updateLimitingSet() {
        this.limiting = new Set();
        for(let c of this.allconstraints) {            
            if(c instanceof Limiting || c instanceof LimitingReturnful) {
               if(c.isEnabled())
                    this.limiting.add(c);
            }
        }
    }

    /**invalidates the ConstraintResult object maintained by this constraint (and all such child constraints*/
    markDirty() {
        this.constraintResult.markSet(false);
        for(let c of this.allconstraints)
            c.constraintResult.markSet(false);
    }

    updateDisplay() {
        for(let c of this.allconstraints)
            c.updateDisplay();
    }
    
    layerSet(val) {
        for(let c of this.allconstraints) {
            c.layers.set(val);
        }
    }
    layersEnable(val) {
        for(let c of this.allconstraints) {
            c.layers.enable(val);
        }
    }
    layersDisable(val) {
        for(let c of this.allconstraints) {
            c.layers.disable(val);
        }
    }

    _visible = true;
    get visible() {
        let parconstvis = this.parentConstraint == null ? true : this.parentConstraint.visible;
        return this._visible 
        && this.forBone.parentArmature.visible 
        && this.forBone.visible
        && parconstvis;
    }

    set visible(val) {
        this._visible = val; 
        for(let c of this.allconstraints) {
            c.visible = false;
            c.updateDisplay();
        }
    }

    childDisabled() {
        this.invalidatePain();
        this.updateLimitingSet(); 
        this.updateReturnfulledSet();
        this.setPreferenceLeeway();
        if(this.parentConstraint != null)
            this.parentConstraint.childDisabled();
        if(this.parentConstraint == null)
            this.forBone.parentArmature.updateShadowSkelRateInfo();
    }
    childEnabled() {
        this.invalidatePain();
        this.updateLimitingSet(); 
        this.updateReturnfulledSet();
        this.setPreferenceLeeway();
        if(this.parentConstraint != null)
            this.parentConstraint.childEnabled();
        this.forBone.parentArmature.updateShadowSkelRateInfo();
    }



    /**
     * @param {Number} val specifies the maximum angle in radians that this constraint is allowed give pullback values of.
     * this should be multiplied by the painfulness and used to calculate the pullback per iteration cache later
     */

    setPreferenceLeeway(radians = this.baseRadians) {
        this.lastCalled = 0;
        this.baseRadians = radians;
        this.preferenceLeeway = this.painfulness * this.baseRadians;        
        for(let c of this.returnfulled) {
            c.setPreferenceLeeway(this.getPreferenceLeeway()*(c.getPainfulness()));
        }
    }
    

    setPerIterationLeewayCache(iterations) {
        //super.setPerIterationLeewayCache(iterations)
        this.giveup = Math.floor(this.stockholmRate  ? iterations*this.stockholmRate : iterations); 
        this.leewayCache = new Array(Math.floor(this.giveup));
        let max = this.preferenceLeeway;

        let maxChildGiveup = 0;
        for(let c of this.returnfulled) {
            c.setPerIterationLeewayCache(iterations);
            maxChildGiveup = Math.max(this.giveup, c.giveup);     
        }
        this.giveup = Math.min(this.giveup, maxChildGiveup);        

        this.leewayCache = new Array(Math.min(iterations, Math.floor(this.giveup)));
        for(let c of this.returnfulled) {
            if(c.isEnabled());
            for(let i = 0; i<this.leewayCache.length; i++) {
                let t = 1-(i/this.giveup); 
                if(this.stockholmRate == null || this.stockholmRate == 1) t = 1;
                let angle = max * t;
                this.leewayCache[i] = Math.min(Math.cos(angle*0.5), c.leewayCache[i] ?? 1);
            }
        }
        this.cachedLeeways[iterations] = this.leewayCache;
        this.cachedGiveups[iterations] = this.giveup;
    }

    getAcceptableRotation(currentState, currentBoneOrientation, desiredRotation, calledBy, cosHalfReturnfullness, angleReturnfullness) {
        if(this.limiting.size == 1) { //skip the rigamarole when there's no point
            //maybe using a set here was a poor choice.
            for(let c of this.limiting) return c.getAcceptableRotation(currentState, currentBoneOrientation, desiredRotation, calledBy, cosHalfReturnfullness, angleReturnfullness);
        } else {
            this.lastLimitState.localMBasis.adoptValues(currentState.localMBasis);
            this.lastLimitBoneOrientation.localMBasis.adoptValues(currentBoneOrientation.localMBasis);
            
            let accumulatedRot = this.tempOutRot.setFromRot(desiredRotation);
            for(let c of this.limiting) {
                let allowableRot = c.getAcceptableRotation(this.lastLimitState, this.lastLimitBoneOrientation, accumulatedRot, calledBy);
                accumulatedRot.setFromRot(allowableRot);
            }
            return accumulatedRot;
        }
    }

    
    updateFullPreferenceRotation(currentState, currentBoneOrientation, iteration, calledBy, cosHalfReturnfullness, angleReturnfullness) {
        this.constraintResult.reset(iteration);
        
        if(iteration >= this.giveup) {
            return this.constraintResult;
        }
        this.lastCalled = iteration;
        let accumulatedRot = this.tempOutRot.setComponents(1,0,0,0);

        this.lastPrefState.localMBasis.adoptValues(currentState.localMBasis);
        for(let c of this.returnfulled) {
            if(c.lastCalled >= c.giveup) continue;            
            c.updateFullPreferenceRotation(this.lastPrefState, currentBoneOrientation, iteration, calledBy, cosHalfReturnfullness, angleReturnfullness);
        }
        let maxDiscomfort = this.constraintResult.raw_preCallDiscomfort;
        let discomfortNorm = 1/(maxDiscomfort == 0? 1 : maxDiscomfort);
        if(this.returnfulled.size > 1) {
            for(let c of this.returnfulled) {
                if(c.lastCalled > c.giveup) continue;
                let constraintResult = c.getWeightClampedPreferenceRotation(this.lastPrefState, currentBoneOrientation, iteration, 
                                        c.constraintResult.preCallDiscomfort*discomfortNorm, calledBy);
                let rotBy = constraintResult.clampedRotation;
                this.lastPrefState.rotateByLocal(rotBy);
                rotBy.applyAfter(accumulatedRot, accumulatedRot);
            }
        } else {
            for(let c of this.returnfulled) {
                if(c.lastCalled >= c.giveup) continue;
                let constraintResult = c.getWeightClampedPreferenceRotation(this.lastPrefState, currentBoneOrientation, iteration, calledBy);
                let rotBy = constraintResult.clampedRotation;
                this.lastPrefState.rotateByLocal(rotBy);
                rotBy.applyAfter(accumulatedRot, accumulatedRot);
            }
        }
        this.constraintResult.fullRotation = accumulatedRot.shorten();
        this.constraintResult.markSet(true);        
        return this.constraintResult;
    }
    


     /**
     * computes the average raw unscaled discomfort of this contraintstacks children prior to alleviation
     * @param {ConstraintResult} previousResult
     * @returns a number from 0 - 1, indicating amount of pain
     * */
     _computePast_Pre_RawDiscomfortFor(previousResult) {
        let maxPain = 0;
        let count = 0;
        for(let c of this.returnfulled) {
            maxPain = Math.max(maxPain, c.constraintResult.raw_preCallDiscomfort);
            count++;
        }
        if(count == 0) return 0;
        return maxPain;//this.remainingPain(previousResult.fullRotation, Rot.IDENTITY);
     }


    /**lets this ConstraintStack know it should invalidate the pain of its children, as the total has likely changed  */
    invalidatePain() {
        //this.constraintResult.postCallDiscomfort = null;
        for(let c of this.allconstraints) {
            c.invalidatePain();
        }
        this.constraintResult.__raw_postCallDiscomfort = null;
        this.constraintResult.__raw_preCallDiscomfort = null;
        //this.constraintResult.preCallDiscomfort = null;
    }
 
     /**
      * computes the raw unscaled discomfort associated with this historical value presuming post alleviation
      * @param {ConstraintResult} previousResult
      * @returns a number from 0 - 1, indicating amount of pain
      * */
     _computePast_Post_RawDiscomfortFor(previousResult) {
        let totalPain = 0;
        let count = 0;
        for(let c of this.returnfulled) {
            totalPain += c.constraintResult.raw_preCallDiscomfort;
            count++;
        }
        if(count == 0) return 0;
        return previousResult.raw_preCallDiscomfort - totalPain/count;
     }

    getPainfulness() {
        return this.maxPain;  
    }

    limitingActive = true; 
    returnfulActive = true;

    setLimitState(val) {
        this.limitingActive = val;
    }
    setReturnfulState(val) {
        this.returnfulActive = val;
    }

    isLimiting() {
        return this.limitingActive && this.limiting.size > 0 && this.isEnabled();
    }
    isReturnful() {
        return this.returnfulActive && this.returnfulled.size > 0 && this.isEnabled();
    }

    tempOutRot = Rot.IDENTITY.clone();
    tempRot2 = Rot.IDENTITY.clone();

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
    pool = globalVecPool;
    forConstraint = null;
    wasChecked = false;

    constructor(forConstraint, pool = globalVecPool) {
        this.pool = globalVecPool; 
        this.forConstraint = forConstraint;
    }
    reset(iteration) {
        this.wasChecked = false;
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

    markSet(val) {this.wasChecked = val;}

    isSet() {return this.wasChecked;}
    
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
        this._fullRotation.setComponents(rot.w, rot.x, rot.y, rot.z);
    }

    set clampedRotation(rot) {
        this._clampedRotation.setComponents(rot.w, rot.x, rot.y, rot.z);
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


export class LayerGroup {
    constructor(forG, onSet, onEnable, onDisable) {
        this.forG = forG;
        this.set = onSet;
        this.onEnable = onEnable;
        this.onDisable = onDisable;
    }
}