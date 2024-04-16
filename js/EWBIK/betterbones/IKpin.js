import { IKTransform } from "../util/nodes/IKTransform.js";
import { IKNode, TrackingNode} from "../util/nodes/IKNodes.js";
import { generateUUID } from "../util/uuid.js";
const THREE = await import('three');
import { Object3D } from "three";
import { Saveable } from "../util/loader/saveable.js";
import { ShadowNode } from "../util/nodes/ShadowNode.js";


export class IKPin extends Saveable{
    static totalInstances = 0;
    forBone = null;
    target = null;
    enabled = true;
    /**@type {IKNode} */
    targetNode = null;
    pinWeight = 0.5;
    depthFalloff = 0;
    modeCode = 3;
    xPriority = 0.5;
    yPriority = 0.5;
    zPriority = 0;
    
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
        result.depthFalloff = this.depthFalloff;
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
     * @param {Object3D or IKNode} targetNode The IKNode Object3D instance serving as this pin's target. If not provided, one will be created and pre aligned to the bone. 
     * @param {boolean} disabled if true, will register the pin without activating it (meaning the effector bone won't attempt to solve for the pin). You can manually enable the pin by calling pin.enable()
     */
    constructor(forBone, targetNode, disabled = false, ikd = 'IKPin-'+(IKPin.totalInstances++), pool=globalVecPool) {
        super(ikd, 'IKPin', IKPin.totalInstances, pool);
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
                this.targetNode = new ShadowNode(targthree, 'ShadowNode-of-target_'+this.ikd, pool);
                this.targetNode.updateGlobal();
                this.targetNode.project();
            } else if(targetNode instanceof THREE.Object3D) {
                if(targetNode.trackedBy != null) {
                    this.targetNode = targetNode.trackedBy;
                } else {
                    this.targetNode = new ShadowNode(targetNode, undefined, pool);
                }
            } else {
                this.targetNode = targetNode;
            }
            this.target_threejs = this.targetNode.toTrack;
            if(this.target_threejs instanceof THREE.Mesh)
                this.hintMesh = this.target_threejs;

            this.target_threejs.forPin = this;
        }
        this.targetNode.registerTrackChangeListener((node, oldtracked, newtracked)=>this.onTargetNodeTrackChange(node, oldtracked, newtracked));
        this.enabled = !disabled;
        this.forBone.setIKPin(this);
        this.setTargetPriorities(this.xPriority, this.yPriority, this.zPriority);
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

    setDepthFalloff(depth) {
        let prevDepth = this.depthFalloff;        
		this.depthFalloff = parseFloat(depth);
		if((this.depthFalloff == 0 && prevDepth != 0) 
		|| (this.depthFalloff != 0 && prevDepth == 0)) {
			this.forBone?.parentArmature?.regenerateShadowSkeleton();
		} else {
			this.forBone?.parentArmature?.updateShadowSkelRateInfo();
		}
    }

    getDepthFalloff() {
        return this.depthFalloff;
    }

    getPinWeight() {
        return this.pinWeight;
    }

    setPinWeight(weight) {
        const prevWeight = this.pinWeight;
        this.pinWeight = Math.max(weight, 0);
        this.targetNode.ensure();
        this.forBone?.parentArmature.updateShadowSkelRateInfo();
        if(this.isEnabled()) {
            if(prevWeight <= 0 && this.pinWeight > 0) {
                this.forBone?.parentArmature?.regenerateShadowSkeleton();
            } 
            if(this.pinWeight <= 0 && prevWeight >= 0)  {
                this.forBone?.parentArmature?.regenerateShadowSkeleton();
            }
        }
    }
    
    /**returns the normalized priority for the requested basis direction */
    getPriority(basisDirection) {
        switch(basisDirection) {
            case IKPin.XDir: return this.xPriority;
            case IKPin.YDir: return this.yPriority;
            case IKPin.ZDir: return this.zPriority; 
        }
    }


    /**
	 * Sets  the priority of the orientation bases which effectors reaching for this target will and won't align with. 
	 * If all are set to 0, then the target is treated as a simple position target. 
	 * giving a nonzero value to all three is most often redundant and just adds compute time, but you should have at least two non-zero values if you want to fully specify target orientations.
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
        this.priorities = priorities;
        this.priorities = priorities.map(priority => totalPriority == 0 || maxPriority == 0 ? 0 : (priority / totalPriority)*maxPriority);
		
        this.xPriority = priorities[0];
		this.yPriority = priorities[1];
		this.zPriority = priorities[2];	
		this.targetNode.ensure();
        
        if(prevmodecode != this.modeCode) {
            this.forBone?.parentArmature?.regenerateShadowSkeleton();
        }
        this.forBone?.parentArmature?.updateShadowSkelRateInfo();
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
        string += `${pinName}.setPinWeight(${p.getPinWeight().toFixed(3)});\n`;
        string += `${pinName}.setTargetPriorities(${p.priorities[0].toFixed(3), p.priorities[1].toFixed(3), p.priorities[2].toFixed(3)});\n`;
        string += `${pinName}.setDepthFalloff(${p.getDepthFalloff().toFixed(3)});\n`;
        if(!p.enabled) string+=`\n${pinName}.disable();`; 
        let pt = p.target_threejs;
        string += `${pinName}.target_threejs.position.set(${pt.position.x}, ${pt.position.y}, ${pt.position.z});\n`
        string += `${pinName}.target_threejs.quaternion.set(${pt.quaternion.x}, ${pt.quaternion.y}, ${pt.quaternion.z}, ${pt.quaternion.w});\n`
        string += `${pinName}.target_threejs.scale.set(${pt.scale.x}, ${pt.scale.y}, ${pt.scale.z});\n`
        if(doPrint) console.log(string);
        else return string;
    }

    /**
     * positions this pin to precisely where its bone can reach it.
    */
    alignToBone() {
        this.targetNode.ensure();
        this.targetNode.adoptGlobalValuesFromObject3D(this.forBone.getIKBoneOrientation());
        this.targetNode.project();
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