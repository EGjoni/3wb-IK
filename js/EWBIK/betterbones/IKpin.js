import { IKTransform } from "../util/nodes/IKTransform.js";
import { IKNode, TrackingNode} from "../util/nodes/IKNodes.js";
import { generateUUID } from "../util/uuid.js";
const THREE = await import('three');
import { Object3D } from "three";
import { Saveable } from "../util/loader/saveable.js";
import { ShadowNode } from "../util/nodes/ShadowNode.js";
import { NoPool } from "../util/vecs.js";


export class IKPin extends Saveable{
    static totalInstances = 0;
    forBone = null;
    target = null;
    enabled = true;
    /**@type {IKNode} */
    targetNode = null;
    pinWeight = 0.5;
    influenceOpacity = 1;
    modeCode = 3;
    _swingPriority = 1;
    _twistPriority = 1;
    _positionPriority = 1;
    xPriority = 0.5;
    yPriority = 0.5;
    zPriority = 0;
    xScale = 1;
    yScale = 1; 
    zScale = 1;
    
    static XDir = 0b001;
    static YDir = 0b010;
    static ZDir = 0b100;

    toJSON() {
        let result = super.toJSON();
        result.pinWeight = this.pinWeight;
        result.xPriority = this.xPriority;
        result.yPriority = this.yPriority;
        result.zPriority = this.zPriority;
        result.modeCode = this.modeCode;
        result.isEnabled = this.enabled;
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
        result.xPriority = json.xPriority;
        result.yPriority = json.yPriority;
        result.zPriority = json.zPriority;
        result.modeCode = json.modeCode;
         
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
     * @param {Object3D | IKNode | IKTransform} affectorOffset the transfrom to attempt to align to the target. If the provided input is null, bone.getIKBoneOrientation will be used. This input is expected in the space of the IKBoneOrientation(), and will be treated as such regardless of any hierarchy information it may otherwise specify. If the input is a ShadowNode already in the space of the bone, it will be used by reference. If it is an Object3D child of bone.getIKBoneOrientation(), the shadowNode already tracking it will be used, or one to track it will be created. 
     * For all other cases, a new Object3D and backing ShadowNode will be created in the ShadowNode hierarchy and set as a child of bone.getIKBoneOrienation().
     * @param {boolean} disabled if true, will register the pin without activating it (meaning the effector bone won't attempt to solve for the pin). You can manually enable the pin by calling pin.enable()
     */
    constructor(forBone, targetNode, affectoredOffset, disabled = false, ikd = 'IKPin-'+(IKPin.totalInstances++), pool=globalVecPool) {

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
        this.affectoredOffset_threejs = new Object3D();
        this.forBone.getIKBoneOrientation().add(this.affectoredOffset_threejs);
        this.affectoredOffset_threejs.name = `affectoredOffset for ${this.ikd}`;
        this.affectoredOffset = new ShadowNode(this.affectoredOffset_threejs, undefined, this.pool);
        
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
            if(this.target_threejs instanceof THREE.Mesh)
                this.hintMesh = this.target_threejs;

            this.target_threejs.forPin = this;
        }
        
        this.setAffectoredOffset(affectoredOffset);
        this.targetNode.registerTrackChangeListener((node, oldtracked, newtracked)=>this.onTargetNodeTrackChange(node, oldtracked, newtracked));
        this.enabled = !disabled;
        this.forBone.setIKPin(this);
        this.setPSTPriorities(1, 1, 1);
    }

    /**
     * an optional attribute to allow aligning the provided transform to the target, atop the one returned by bone.getIKBoneOrientation()
     * @param {Object3D | IKNode | IKTransform} affectorOffset the transfrom to attempt to align to the target. If the provided input is null, the identity tansform will be used, effectively aligning to bone.getIKBoneOrientation(). This input is expected in the space of the IKBoneOrientation(), and will be treated as such regardless of any hierarchy information it may otherwise specify. The ShadowNode and Object3d pair used by this pin are persistent, so the values of any input you provide will just be adopted by the values the pin already stores. This is so that it is always safe to modify the ShadowNode instance returned by getAffectoredOffset()
     */

    setAffectoredOffset(affectoredOffset) {
        if(affectoredOffset == null) {
            this.affectoredOffset.localMBasis.setToIdentity();
        } else if(affectoredOffset instanceof ShadowNode) {
                this.affectoredOffset.adoptLocalValuesFromObject3D(affectoredOffset.toTrack);
        } else if(affectoredOffset instanceof IKTransform) {
            this.affectoredOffset.localMBasis.adoptValues(affectoredOffset);
            
        } else if(affectoredOffset instanceof Object3D) {
            this.affectoredOffset.adoptLocalValuesFromObject3D(affectoredOffset);
        }
        this.affectoredOffset.ensure();
        this.affectoredOffset.markDirty().project();
        return this;
    }

    getAffectoredOffset() {
        return this.affectoredOffset;
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
        if(this.affectoredOffset_threejs?.parent != this.forBone.getIKBoneOrientation()) {
            this.forBone.getIKBoneOrientation().add(this.affectoredOffset_threejs);
        }
        this.affectoredOffset.ensure();	
		this.affectoredOffset.markDirty();
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
	 * Sets  the priority of the orientation bases which effectors reaching for this target will and won't align with. 
	 * If all are set to 0, then the target is treated as a simple position target. 
	 * giving a nonzero value to all three is most often redundant and just adds compute time, but you should have at least two non-zero values if you want to fully specify target orientations.
     * 
     * Efficiency note: by default, calling this function avoids regenerating the shadow skeleton, even if a priority drops to 0. It only triggers a regeneration if a priority which used to be 0 is now non-zero, necessesitating the allocation of a new heading target. This is to maximize performance if frequently enabling and disabling headings. If you are infrequently enabling and disabling, it is very slightly faster to regenerate the shadowSkeleton once after setting a non-zero priority to 0.   
	 *
	 * @param xPriority Determines how much this pin's bone tries to align its x-axis with the target x-axis.
	 * @param yPriority Determines how much this pin's bone tries to align its y-axis with the target y-axis.	
	 * @param zPriority Determines how much this pin's bone tries to align its z-axis with the target z-axis.
	 */

    setTargetPriorities(xPriority=0, yPriority=0, zPriority=0) {

        let xDir = xPriority > 0 ? IKPin.XDir : 0;
		let yDir = yPriority > 0 ? IKPin.YDir : 0;
		let zDir = zPriority > 0 ? IKPin.ZDir : 0;
        let prevmodecode = this.modeCode;
        if(this.forBone?.wb?.maxModeCode) 
            prevmodecode = this.forBone?.wb?.maxModeCode;
        let maxPriority = 0;
        let totalPriority = 0;
        let priorityCount = 0;
		this.modeCode = 0; 

		this.modeCode += xDir; 
		this.modeCode += yDir; 
		this.modeCode += zDir;
		
        let priorities = [xPriority, yPriority, zPriority];

		if (xDir >0) {
            totalPriority += priorities[0];
            maxPriority = Math.max(priorities[0], maxPriority);
            priorityCount++;
        }
        if (yDir >0) {
            totalPriority += priorities[1];
            maxPriority = Math.max(priorities[1], maxPriority);
            priorityCount++;
        }
        if (zDir >0) {
            totalPriority += priorities[2];
            maxPriority = Math.max(priorities[2], maxPriority);
            priorityCount++;
        }
        this.normed_priorities = priorities;
        this.normed_priorities = priorities.map(priority => totalPriority == 0 || maxPriority == 0 ? 0 : (priority / totalPriority)*maxPriority);
		
        this.xPriority = priorities[0];
		this.yPriority = priorities[1];
		this.zPriority = priorities[2];
        this.affectoredOffset.ensure();	
		this.targetNode.ensure();
        
        if(prevmodecode < this.modeCode) {
            this.forBone?.parentArmature?.regenerateShadowSkeleton();
        }
        this.forBone?.parentArmature?.updateShadowSkelRateInfo();
        return this;
    }



    /**
     * Experimental, more concise and expressive method for specifying target priorities.
     * Instead of a redundantly specifying three orientation heading weights, this distributes the weight across three bases consistently such that 
     * swing_weight + (2*twist_weight) = (swing_priority + twist_priority)/2. 
     * The swing priority maps onto the weight of the y heading, and the twist priority maps on to the x and z headings.
     * Which means if swing_priority and twist_priority are both 1, the weights on the corresponding axes are
     * x= 0.5, y = 1, z=0.5.  The x and z axes get half the weight of the y axis because they will get doubled up by the minimizer.
     * 
     * These combined values then get normalized with respect to the position priority, such that position + x + y + z = 1. This is so that we have a natural baseline magnitude for each heading when using distance scaling. Specifically, the minimum magnitude of a heading will be 1-position of this normed position priorty. Which only goes to 0 when we have 0 heading priority
     * 
     * 
     * @param {Number} position a value from 0-1, indicating how much the affected bone should try to match its affectored position to the pin's position. A value of 0 keeps the bone where it is. A value of 1 tries to get it to where the target is, and any value inbetween tries to get it somewhere inbetween (this is per solve iteration, so the only situations in whhere this doesn't ultimately end up reaching the target position are ones where this value is 0, or being drowned out by other considerations) 
     * @param {Number} swing a value from 0 to 1, indicating how strongly the solver should attempt to align the bone's y-axis with the target y axis
     * @param {Number} twist a value from 0 to 1, indicating how strongly the solver should attempt to align the bone's xz axes with the target's xz axes. 
     */
    setPSTPriorities(position, swing, twist) {
        let norm = (swing+twist+position);
        if(norm>0) norm = 1/norm;
        this.position_normed_priority = position*norm; 
        this.swing_normed_priority = swing*norm; 
        this.twist_normed_priority = twist*norm;
        this.x_normed_priority = (twist/2)*norm;
        this.y_normed_priority = swing*norm;
        this.z_normed_priority = (twist/2)*norm;

        this.normed_weights = [
            this.position_normed_priority*this.pinWeight, 
            this.x_normed_priority*this.pinWeight, 
            this.y_normed_priority*this.pinWeight, 
            this.z_normed_priority*this.pinWeight
        ];
        this.forBone?.parentArmature?.updateShadowSkelRateInfo();
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


    /**Sets the magnitude of the basis vectors of this target. This has a different effect it than changing the priorites of those same directions. 
     * It's a bit difficult to convey the difference in words but, to a reasonable approximation, you can think of this as controlling how much ancestor of the effect care about the orientation of the effector. 
     * With low scales, ancestor bones won't care very much about descendant orientation, attempting to mostly match on position. whereas with large scales ancestor bones will care a lot. 
     * the pinned bone itself shouldn't be too affected by these values.
     * 
    */
    setTargetScales(xScale, yScale, zScale) {
        this.xScale = xScale;
        this.yScale = yScale;
        this.zScale = zScale;
    }


    /**
	 * @param xPriority Determines how much this pin's bone tries to align its x-axis with the target x-axis.	
	 */
    setXPriority(val) {
        this.xPriority = parseFloat(val);
        this.setTargetPriorities(this.xPriority, this.yPriority, this.zPriority);
    }

    /**
	 * @param yPriority Determines how much this pin's bone tries to align its y-axis with the target y-axis.	
	 */
    setYPriority(val) {
        this.yPriority = parseFloat(val);
        this.setTargetPriorities(this.xPriority, this.yPriority, this.zPriority);
    }

    /**
	 * @param zPriority Determines how much this pin's bone tries to align its z-axis with the target z-axis.	
	 */
    setZPriority(val) {
        this.zPriority = parseFloat(val);
        this.setTargetPriorities(this.xPriority, this.yPriority, this.zPriority);
    }

    getSubtargetCount() {
        return this.subTargetCount;
    }

    getModeCode() {
        return this.modeCode;
    }

    getXPriority() {
        return this.xPriority;
    }
    
    getYPriority() {
        return this.yPriority;
    }

    getZPriority() {
        return this.zPriority;
    }

    getAxes() {
        return this.targetNode;
    }

    /**
	 * translates and rotates the target to match the position 
	 * and orientation of the input Node. The orientation 
	 * is only relevant for orientation aware solvers.
	 * @param inAxes
	 */
    /*alignToAxes(inAxes) {
        this.targetNode.alignGlobalsTo(inAxes);
    }

    translateTo_(location) {
        this.targetNode.translateTo(location);
    }

    translateToArmatureLocal_(location) {
        const armAxes = this.forBone.parentArmature.localAxes.parentAxes;
        if (!armAxes) {
            this.targetNode.translateTo(location);
        } else {
            this.targetNode.translateTo(armAxes.getLocalOf(location));
        }
    }

    translateByRay(location) {
        this.targetNode.translateByLocal(location);
    }
    
     
    */

    getLocation_() {
        return this.targetNode.origin();
    }

    forBone() {
        return this.forBone;
    }

    removalNotification() {
        while (this.childPins.length) {
            const childPin = this.childPins.pop();
            childPin.setParentPin(this.parentPin);
        }
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

    removeChildPin(child) {
        const index = this.childPins.indexOf(child);
        if (index > -1) {
            this.childPins.splice(index, 1);
        }
        this.forBone?.parentArmature?.regenerateShadowSkeleton();
    }

    setParentPin(parent) {
        if (this.parentPin) {
            this.parentPin.removeChildPin(this);
        }

        if (parent === this || parent === null) {
            this.targetNode.setParent(null);
        } else if (parent) {
            this.targetNode.setParent(parent.axes);
            parent.addChildPin(this);
            this.parentPin = parent;
        }
        this.forBone?.parentArmature?.regenerateShadowSkeleton();
    }

    addChildPin(newChild) {
        if (newChild.isAncestorOf(this)) {
            this.setParentPin(newChild.getParentPin());
        }

        if (!this.childPins.includes(newChild)) {
            this.childPins.push(newChild);
        }
        this.forBone?.parentArmature?.regenerateShadowSkeleton();
    }

    getParentPin() {
        let currBone = this.forBone.parent; 
        while(currBone != null && currBone instanceof Bone) {
            let currpin = currBone.getIKPin();
            if(currpin != null && currpin.isEnabled())
                return currpin;
            currBone = currBone.parent;
        }
        return null;
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
        string += `${pinName}.target_threejs.position.set(${pt.position.x}, ${pt.position.y}, ${pt.position.z});\n`
        string += `${pinName}.target_threejs.quaternion.set(${pt.quaternion.x}, ${pt.quaternion.y}, ${pt.quaternion.z}, ${pt.quaternion.w});\n`
        string += `${pinName}.target_threejs.scale.set(${pt.scale.x}, ${pt.scale.y}, ${pt.scale.z});\n`
		if(this.target_threejs?.parent instanceof THREE.Bone
		  && this.target_threejs.parent.parentArmature == this.forBone.parentArmature){
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
        this.targetNode.adoptGlobalValuesFromObject3D(this.forBone.getIKBoneOrientation());
        this.targetNode.project();
        this.affectoredOffset.ensure();
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