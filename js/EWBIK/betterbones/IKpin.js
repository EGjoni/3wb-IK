import { IKTransform } from "../util/IKTransform.js";
import { IKNode, TrackingNode} from "../util/IKNodes.js";
import { Object3D } from "../../three/three.module.js";
import { generateUUID } from "../util/uuid.js";
const THREE = await import('three');


export class IKPin {
    static totalPins = 0;
    forBone = null;
    effectorTransform = new IKTransform();
    target = null;
    enabled = true;
    targetNode = new IKNode();
    pinWeight = 1;
    modeCode = 6;
    xPriority = 10;
    yPriority = 10;
    zPriority = 10;

    /**
     * 
     * @param {*} forBone 
     * @param {IKTransform} effectorNodeLocal optional, by default will be the identity transform, which corresponds to the bone orientation so that the bone always attempts to align to the target. 
     * If instead you want the alignment to occur with respect to some imaginary transformation on top of the bone, you can provid it here.
     * @param {Object3D or IKNode} targetNode required. The IKNode Object3D instance serving as this pin's target.  
     * @param {boolean} disabled if true, will register the pin without activating it (meaning the effector bone won't attempt to solve for the pin). You can manually enable the pin by calling pin.enable()
     */
    constructor(forBone, targetNode, effectorTransformLocal = null, disabled = false, ikd = 'IKPin-'+(IKPin.totalPins+1)) {
        this.ikd = ikd;
        IKPin.totalPins +=1;
        if(forBone.getIKPin() != null) {
            throw Error("The provided Bone already has an IKPin set.");
        }
        this.forBone = forBone;
        this.ikd = ikd;
        
        if (targetNode == null) {
            this.targetNode = new TrackingNode();
            this.targetNode.adoptGlobalValuesFromObject3D(this.forBone);
        } else if(targetNode instanceof THREE.Object3D) {
            let trackNode = new TrackingNode(targetNode);
            this.targetNode = trackNode;
        } else {
            this.targetNode = targetNode;
        }
        if(effectorTransformLocal != null) {
            this.effectorTransformLocal = effectorTransformLocal;
        }
        this.enabled = !disabled;
        this.xPriority = 1;
        this.yPriority = 1;
        this.zPriority = 0;
        this.forBone.setIKPin(this);
    }

    isEnabled() {
        return this.enabled;
    }

    toggle() {
        this.enabled = !this.isEnabled();
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }


    /**
	 * Pins can be ultimate targets, or intermediary targets. 
	 * By default, each pin is treated as an ultimate target, meaning 
	 * any bones which are ancestors to that pin's end-effector 
	 * are not aware of any pins wich are target of bones descending from that end effector. 
	 * 
	 * Changing this value makes ancestor bones aware, and also determines how much less
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
        this.depthFalloff = depth;
        let prevDepth = this.depthFalloff;
		this.depthFalloff = depth;
		if((this.depthFalloff == 0 && prevDepth != 0) 
		|| (this.depthFalloff != 0 && prevDepth == 0)) {
			this.forBone.parentArmature.regenerateShadowSkeleton();
		} else {
			this.forBone.parentArmature.updateShadowSkelRateInfo();
		}
    }

    getDepthFalloff() {
        return this.depthFalloff;
    }

    setTargetPriorities(position, xPriority, yPriority, zPriority) {
        const modeCodes = {
            'none': 0,
            'x': 1,
            'y': 2,
            'z': 4,
            'xy': 3,
            'xz': 5,
            'yz': 6,
            'xyz': 7,
        };

        let combinedModeCode = 0;
        if (xPriority !== undefined && xPriority >= 0) combinedModeCode |= modeCodes['x'];
        if (yPriority !== undefined && yPriority >= 0) combinedModeCode |= modeCodes['y'];
        if (zPriority !== undefined && zPriority >= 0) combinedModeCode |= modeCodes['z'];

        this.modeCode = combinedModeCode;
        this.subTargetCount = Object.keys(position).filter(key => position[key]).length;

        this.xPriority = xPriority === undefined ? 1 : Math.max(0, Math.min(1, xPriority));
        this.yPriority = yPriority === undefined ? 1 : Math.max(0, Math.min(1, yPriority));
        this.zPriority = zPriority === undefined ? 1 : Math.max(0, Math.min(1, zPriority));
        
        this.forBone.parentArmature.updateShadowSkelRateInfo();
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

    translateBy_(location) {
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

   

    solveIKForThisAndChildren() {
        try {
            this.childPins.forEach(childPin => childPin.solveIKForThisAndChildren());
            this.forBone.solveIKFromHere();
        } catch (error) {
            console.warn(error);
        }
    }

    removeChildPin(child) {
        const index = this.childPins.indexOf(child);
        if (index > -1) {
            this.childPins.splice(index, 1);
        }
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
    }

    addChildPin(newChild) {
        if (newChild.isAncestorOf(this)) {
            this.setParentPin(newChild.getParentPin());
        }

        if (!this.childPins.includes(newChild)) {
            this.childPins.push(newChild);
        }
    }

    getParentPin() {
        return this.parentPin;
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

    getPinWeight() {
        return this.pinWeight;
    }

    setPinWeight(weight) {
        this.pinWeight = weight;
        // Update shadow skeleton rate info using THREE.js methods
    }

    /**
     * positions this pin to precisely where its bone can reach it.
    */
    alignToBone(){
        this.forBone.updateWorldMatrix();
        this.forBone.getWorldPosition(this.targetNode.toTrack.position);
        this.forBone.getWorldQuaternion(this.targetNode.toTrack.quaternion);
        this.targetNode.adoptTrackedLocal();
    }

}