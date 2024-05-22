import { IKTransform } from "../util/nodes/Transforms/IKTransform.js";
import { IKNode, TrackingNode} from "../util/nodes/IKNodes.js";
import { generateUUID } from "../util/uuid.js";
const THREE = await import('three');
import { Object3D } from "three";
import { Saveable } from "../util/loader/saveable.js";
import { ShadowNode } from "../util/nodes/ShadowNode.js";
import { NoPool } from "../util/vecs.js";
import { notVector3 } from "../util/notVecs.js";


export class IKPin extends Saveable {
    static totalInstances = 0;
    forBone = null;
    target = null;
    enabled = true;
    /**@type {IKNode} */
    targetNode = null;
    pinWeight = 1;
    influenceOpacity = 1;

    _swingPriority = 1;
    _swingMagnitude = 1;
    _twistPriority = 1;
    _twistMagnitude = 1;
    _positionPriority = 1;

    _twistHeading = new notVector3(0,0,1);
    _scaled_twist_heading = new Vec3(0,0,1);
    _swingHeading = new notVector3(0,1,0);
    _scaled_swing_heading = new Vec3(0,1,0);

    normed_weights = [0.5,.25,.5,.25];
    pinModListeners = [];
    
    static XDir = 0b001;
    static YDir = 0b010;
    static ZDir = 0b100;

    toJSON() {
        let result = super.toJSON();
        result.pinWeight = this.pinWeight;
        result.positionPriority = this.positionPriority;
        result.swingPriority = this.swingPriority;
        result.twistPriority = this.twistPriority;
        result.enabled = this.enabled;
        result.influenceOpacity = this.influenceOpacity;
        return result;
    }

    static async fromJSON(json, loader, pool, scene) {
        let result = new IKPin(
            Loader.findSceneObject(json.requires.forBone, scene),
            undefined,
            undefined,
            !json.enabled,
            json.ikd,
            pool
        )
        result.pinWeight = json.pinWeight;
        result.positionPriority = json.positionPriority;
        result.swingPriority = json.swingPriority;
        result.twistPriority = json.twistPriority;
        result.enabled = json.enabled;
        result.influenceOpacity = json.influenceOpacity;
         
        return result;
    }
    getRequiredRefs () {
        let req = {
            forBone: this.forBone,
            targetNode: this.targetNode
        };
        return req;
    }

    async postPop(json, loader, pool, scene)  {
        let p = await Saveable.prepop(json.requires, loader, pool, scene); 
        this.targetNode = p.targetNode;
        this.target_threejs = this.targetNode.toTrack;
        return this;
    }

    /**
     * 
     * @param {Bone} forBone the bone to treat as an effector (which is, the thing that attemptes to align with the target)
     * @param {Object3D | IKNode | ShadowNode} targetNode The IKNode or Object3D instance serving as this pin's target. If not provided, one will be created and pre aligned to the bone (or its effectorOffset). This input respects the scene hierarchy specified by the object.
     * @param {boolean} disabled if true, will register the pin without activating it (meaning the effector bone won't attempt to solve for the pin). You can manually enable the pin by calling pin.enable()
     * @param {string} ikd an optional unique identifier string for this pin
     * @param {Vec3Pool} pool an optional vector pool for efficiency
     */
    constructor(forBone, targetNode, disabled = false, ikd = 'IKPin-'+(IKPin.totalInstances++), pool=globalVecPool) {

        if((pool == null || pool instanceof NoPool || pool == globalVecPool) &&
            forBone?.parentArmature != null ) {
                pool = forBone.parentArmature.stablePool;
        }
        let pinName = forBone?.name ? 'IKPin_for '+forBone.name : ikd;
        super(pinName, 'IKPin', IKPin.totalInstances, pool);
        if(forBone.getIKPin() != null) {
            throw Error("The provided Bone already has an IKPin set.");
        }
        this.forBone = forBone;
        
        if(!Saveable.loadMode) {
            if (targetNode == null) {
                let targthree = new THREE.Object3D();
                forBone.getIKBoneOrientation().updateWorldMatrix(true, false);
                targthree.matrix.copy(forBone.getIKBoneOrientation().matrixWorld);
                targthree.matrix.decompose(targthree.position, targthree.quaternion, targthree.scale);
                forBone.parentArmature.armatureObj3d.attach(targthree);
                this.targetNode = new ShadowNode(targthree, 'ShadowNode-of-target_'+this.ikd, this.pool);
                this.targetNode.updateGlobal();
                this.targetNode.project();
            } else if(targetNode instanceof THREE.Object3D) {
                if(targetNode.trackedBy != null) {
                    this.targetNode = targetNode.trackedBy;
                } else {
                    this.targetNode = new ShadowNode(targetNode, undefined, this.pool);
                }
            } else {
                this.targetNode = targetNode;
            }
            this.target_threejs = this.targetNode.toTrack;
            this.target_threejs.forPin = this;
        }
        this.targetNode.forceOrthoUniformity(true);
        this.targetNode.registerTrackChangeListener((node, oldtracked, newtracked)=>this.onTargetNodeTrackChange(node, oldtracked, newtracked));
        this.enabled = !disabled;
        this.forBone.setIKPin(this);       
        this.position = new notVector3(this.target_threejs.position.x, this.target_threejs.position.y, this.target_threejs.position.z);
        this.scale = new notVector3(this.target_threejs.scale.x, this.target_threejs.scale.y, this.target_threejs.scale.z);
        this.quaternion = this.target_threejs.quaternion;
        this.rotation = this.target_threejs.rotation;
        this.position.setOnChange((...params)=>{this.target_threejs.position.set(...params); this.targetNode.mimic()});
        this.scale.setOnChange((...params)=>{this.target_threejs.scale.set(...params); this.targetNode.mimic()});
        this.target_threejs.quaternion.__originalOnchange = this.target_threejs.quaternion._onChangeCallback; 
        this.target_threejs.quaternion._onChangeCallback = ()=>{this.target_threejs.quaternion.__originalOnchange(); this.targetNode.mimic()}; 
        this._swingHeading.setOnChange((x, y, z)=>{
            this._scaled_swing_heading.setComponents(x, y, z);
            this._scaled_swing_heading.normalize().mult(this.swingPriority*this.forBone.height*0.5); //divide by 2 to account for the fact that the solver doubles these up
            this._swingMagnitude = this._scaled_swing_heading.mag(); //used to quickly determine if the solver should even bother
        });
        this._twistHeading.setOnChange((x, y, z)=>{
            this._scaled_twist_heading.setComponents(x, y, z);
            this._scaled_twist_heading.normalize().mult(this.twistPriority*this.forBone.height*0.5); //divide by 2 to account for the fact that the solver doubles these up
            this._twistMagnitude = this._scaled_twist_heading.mag(); //used to quickly determine if the solver should even bother
        });

        if(this.forBone.height == 0) 
            this.setPSTPriorities(1,0,0);
        else 
            this.setPSTPriorities(1, 1, 1);

        return new Proxy(this, {
            get: (target, prop, receiver) => {
                // Check if property exists on IKPin; if not, forward to target_threejs
                if (prop in target || typeof target[prop] === 'function') {
                    return Reflect.get(target, prop, receiver);
                }
                // If the property is a function on target_threejs, return a function that handles it (particularly we care about add / attach / remove, but who knows what else)
                if (typeof target.target_threejs[prop] === 'function') {
                    return (...args) => {
                        let result = target.target_threejs[prop](...args);
                        target.targetNode.ensure();  // ensure any hierarchy changes propogate
                        return result;
                    };
                }
                return Reflect.get(target.target_threejs, prop);
            },
            set: (target, prop, value, receiver) => {
                if (prop in target) {
                    return Reflect.set(target, prop, value, receiver);
                }
                let result = Reflect.set(target.target_threejs, prop, value);
                target.targetNode.mimic(); 
                return result;
            }
        });

        
    }

    isEnabled() {
        return this.enabled;
    }

    /**makes sure the three.js object this pin purports to track is the same one tracked by the internal EWBIK scene node object
     * @param {Boolean} agreeWithNode default true, which makes this conform to the EWBIK scene node. set to false to force the node to point to what this pin purports.
     */
    ensure(agreeWithNode = true) {
        this.targetNode.ensure();
        if(agreeWithNode || this.target_threejs == null) {
            this.target_threejs = this.targetNode.toTrack;            
            this.targetNode.project();
        } else {
            this.targetNode.setTracked(this.target_threejs);
        }
        this.targetNode.mimic();
        this.targetNode.markDirty();
    }

    toggle() {
        this.enabled = !this.isEnabled();
        this.forBone?.parentArmature?.regenerateShadowSkeleton();
    }

    enable() {
        this.enabled = true;
        this.ensure();
        this.forBone?.parentArmature?.regenerateShadowSkeleton();
    }

    disable() {
        this.enabled = false;
        this.forBone?.parentArmature?.regenerateShadowSkeleton();
    }

    /**
     * register a listener to be notified whenever the parameters of this pin are modified.
     * 
     * @param {Function} callback will be provided with a reference to this pin as the only argument.
     * @return {IKPin} this pin for chaining.
     **/
    registerModListener(callback) {
        if(this.pinModListeners.indexOf(callback) == -1) {
            this.pinModListeners.push(callback);
        }
        return this;
     }

    /**
     * removes the provided callback if it's registered with this pin
     * @param {Function} callback 
     * @returns {IKPin} this pin for chaining
     */
    removeModListener(callback) {
        let cbidx = this.pinModListeners.indexOf(callback);
        if(cbidx > -1) {
            this.pinModListeners.splice(cbidx, 1);
        }
        return this;
    }

    pinUpdateNotification() {
        for(let p of this.pinModListeners) {
            p(this);
        }
    }


    /**
	 * Pins can be ultimate targets, or intermediary targets. 
	 * By default, each pin is treated as an ultimate target, meaning 
	 * any bones which are ancestors to that pin's end-effector 
	 * are not aware of any pins wich are target of bones descending from that end effector. 
	 * 
	 * Changing this value makes ancestor bones aware descendant pins, and also determines how much less
	 * they care with each level down.  
	 * 
	 * Presuming all descendants of this pin have a falloff of 1, then:
	 * A pin falloff of 0 on this pin means ONLY this pin and its effector are reported to ancestor bones. 
	 * A pin falloff of 1 on this pin means ancestor bones care about this pin / effector and all of its descendant effectors descendant from thi's pins effector as if this pin/effector were a sibling of theirs 
	 * A pin falloff of 0.5 means ancestor bones care about this pin/effector twice as much as they care about direct descendants pins/effectors of this pin's effctor. 
	 * 
	 * With each level, the pin falloff of a descendant is taken account for each level.
	 *  Meaning, if this pin has a falloff of 1, and its descendent has a falloff of 0.5
	 *  then this pin will be reported with full weight, 
	 *  it descendant will be reported with full weight, 
	 *  the descendant of that pin will be reported with half weight. 
	 *  the descendant of that one's descendant will be reported with half weight.   
	 * 
	 * @param depth
	 */

    setInfluenceOpacity(depth) {
        let prevDepth = this.influenceOpacity;        
		this.influenceOpacity = parseFloat(depth);
		if((this.influenceOpacity == 1 && prevDepth != 1) 
		|| (this.influenceOpacity != 1 && prevDepth == 1)) {
			this.forBone?.parentArmature?.regenerateShadowSkeleton();
		} else {
			this.forBone?.parentArmature?.updateShadowSkelRateInfo();
		}
    }


    get swingHeading() {
        return this._swingHeading;
    }

    get twistHeading() {
        return this._twistHeading;
    }

    /**
     * specifies a vector in the space of the bone which the solver attempts to align in the space of the target. 
     * By default, this is the vector (0,1,0), corresponding to the default axis Bone.getIKBoneOrientation() points along.
     * @param {Vector3|Vec3} vec the vector direction to use instead of the default of (0,1,0)
     */
    set swingHeading(val) {
        this._swingHeading.copy(val);
    }


    /**
     * specifies a vector in the space of the bone which the solver attempts to align in the space of the target. 
     * By default, this is the vector (0,0,1), corresponding to the default axis Bone.getIKBoneOrientation() treats as its twist axis.
     * @param {Vector3|Vec3} vec the vector direction to use instead of the default of (0,0,1)
     */
    set twistHeading(val) {
        this._twistHeading.copy(val);
    }

    getInfluenceOpacity() {
        return this.influenceOpacity;
    }

    getPinWeight() {
        return this.pinWeight;
    }

    setPinWeight(weight) {
        //const prevWeight = this.pinWeight;
        this.pinWeight = Math.max(weight, 0);
        this.targetNode.ensure();
        this.setPSTPriorities(this.positionPriority, this.swingPriority, this.twistPriority);
        this.forBone?.parentArmature.updateShadowSkelRateInfo();
        return this;
    }
    
    /**returns the normalized priority for the requested basis direction */
    getNormedPriority(basisDirection) {
        switch(basisDirection) {
            case IKPin.XDir: return this.normed_priorities[0];
            case IKPin.YDir: return this.normed_priorities[1];
            case IKPin.ZDir: return this.normed_priorities[2]; 
        }
    }



    /**
     * Sets the relative priorities of the position, swing, and twist components of this target.
     * 
     * @param {Number} position a value from 0-1, indicating how much the bone (or its affectorOffset) should try to match this pin's position. A value of 0 keeps the bone where it is. A value of 0 means the bone doesn't care about matching position.
     * @param {Number} swing a value from 0 to 1, indicating how strongly the solver should attempt to align the bone's swing axis with the target swing axis (by default, the solver considers (0,1,0) to be the swing axis, but this can be changed by specifying a different swingHeading on the IKPin instance)
     * @param {Number} twist a value from 0 to 1, indicating how strongly the solver should attempt to align the bone's twist axis with the target's twist axis. (by default, the solver considers (0,0,1) to be the twist axis, but this can be changed by specifying a different twistHeading on the IKPin instance)
     */
    setPSTPriorities(position=this._positionPriority, swing=this._swingPriority, twist=this._twistPriority) {
        this._positionPriority = position;
        this._twistPriority = twist;
        this._swingPriority = swing;
        this._swingHeading.onChange(); //triggers the notification that multiplies by the priority and boneheight
        this._twistHeading.onChange();
        this.pinUpdateNotification();
        this.forBone?.parentArmature?.updateShadowSkelRateInfo();
        return this;
    }

    get positionPriority() {return this._positionPriority;}
    set positionPriority(val) {
        this._positionPriority = val;
        this.setPSTPriorities(this._positionPriority, this._swingPriority, this._twistPriority);
    }

    get swingPriority() {return this._swingPriority;}
    set swingPriority(val) {
        this._swingPriority = val;
        this.setPSTPriorities(this._positionPriority, this._swingPriority, this._twistPriority);
    }

    get twistPriority() {return this._twistPriority;}
    set twistPriority(val) {
        this._twistPriority = val;
        this.setPSTPriorities(this._positionPriority, this._swingPriority, this._twistPriority);
    }


    getAxes() {
        return this.targetNode;
    }

    forBone() {
        return this.forBone;
    }

    /**
     * performs a solve only for the bones which can rotate to satisfy this target, and which must rotate as
     * a result of moving ancestors of this target
     */
    solveFromHere() {
        try {
            //this.childPins.forEach(childPin => childPin.solveIKForThisAndChildren());
            this.forBone.parentArmature.solve(this.forBone);
        } catch (error) {
            console.warn(error);
        }
    }

    isAncestorOf(potentialDescendent) {
        let cursor = potentialDescendent.getParentPin();
        while (cursor) {
            if (cursor === this) {
                return true;
            }
            cursor = cursor.parentPin;
        }

        return false;
    }

    printInitializationString(doPrint=true) {
        let string = ``;
        let p = this;
        let boneName = p.forBone.name;
        let pinName = `${boneName}_pin`;
        string += `\nlet ${pinName} = new IKPin(armature.bonetags["${boneName}"]);\n`;
        string += `${pinName}.setPinWeight(${p.getPinWeight().toFixed(4)});\n`;
        string += `${pinName}.setPSTPriorities(${p.positionPriority.toFixed(4)}, ${p.swingPriority.toFixed(4)}, ${p.twistPriority.toFixed(4)});\n`;
        string += `${pinName}.setInfluenceOpacity(${p.getInfluenceOpacity().toFixed(4)});\n`;
        if(!p.enabled) string+=`\n${pinName}.disable();`; 
        let pt = p.target_threejs;
        if(pt.position.x !=0 || pt.position.y !=0 || pt.position.z != 0)
            string += `${pinName}.position.set(${pt.position.x}, ${pt.position.y}, ${pt.position.z});\n`;
        if(pt.quaternion.w != 1)
            string += `${pinName}.quaternion.set(${pt.quaternion.x}, ${pt.quaternion.y}, ${pt.quaternion.z}, ${pt.quaternion.w});\n`;
        if(pt.scale.x !=0 || pt.scale.y !=0 || pt.scale.z != 0)
            string += `${pinName}.scale.set(${pt.scale.x}, ${pt.scale.y}, ${pt.scale.z});\n`;
        
        let sw = this._swingHeading;
        let tw = this._twistHeading;
        if(sw.x != 0 || sw.y!= 1 || sw.z != 0)
            string += `${pinName}.swingHeading.set(${sw.x}, ${sw.y}, ${sw.z});\n`;
        if(tw.x != 0 || tw.y!= 0 || tw.z != 1)
            string += `${pinName}.twistHeading.set(${tw.x}, ${tw.y}, ${tw.z});\n`;

		if(this.target_threejs?.parent instanceof THREE.Bone
		  && this.target_threejs.parent.parentArmature == this.forBone.parentArmature) {
			string += `armature.bonetags['${this.target_threejs.parent.name}'].add(${pinName}.target_threejs);\n ${pinName}.ensure()`;
		}
        if(doPrint) console.log(string);
        else return string;
    }

    /**
     * positions this pin to precisely where its bone can reach it.
    */
    alignToBone() {
        this.targetNode.ensure();
        this.target_threejs.updateWorldMatrix(true, true);
        //this.targetNode.alignGlobalsTo(this.forBone.getIKBoneOrientation().trackedBy.getGlobalMBasis());
        this.targetNode.adoptGlobalValuesFromObject3D(this.forBone.getAffectoredOffset());
        this.targetNode.project();
        return this;
    }


    /**
     * if you call this function, it will fire whatever callback has been specified as this IKPin instances 
     * onChange function. By default, the onChange function calls solveFromHere()
     */
    notifyOfChange() {
        this.onChange();
    }

    onChange() {
        this.solveFromHere();
    }



    /**
     * @returns {boolean} true if this ikpin has a non-zero translation component, false otherwise
     */
    hasTranslation() {
        return this._positionPriority > 0;
    }

    /**
     * @returns {boolean} true if this ikpin has a non-zero orientation component, false otherwise
     */
    hasOrientation() {
        return (this._scaled_swing_heading.mag() > 0) || (this._scaled_twist_heading.mag() > 0)
    }

    onTargetNodeTrackChange(node, previousTracked, newTracked) {
        if(node == this.targetNode) {
            if(this.target_threejs?.forPin == this) {
                this.target_threejs.forPin = null;
                for(let c of this.target_threejs.children) {
                    if(c.forPin == this) {
                        c.forPin = null;
                    }
                }
            }
            this.target_threejs = newTracked;
            if(this.target_threejs != null) {            
                this.target_threejs.forPin = this;
            }
        }
    }

}