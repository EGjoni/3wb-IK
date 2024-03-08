import { IKTransform } from "../util/IKTransform.js";
import { IKNode, TrackingNode} from "../util/IKNodes.js";
import { generateUUID } from "../util/uuid.js";
const THREE = await import('three');
import { Object3D } from "three";


export class IKPin {
    static totalPins = 0;
    forBone = null;
    effectorTransform = new IKTransform();
    target = null;
    enabled = true;
    targetNode = null;
    pinWeight = 1;
    modeCode = 3;
    xPriority = 1;
    yPriority = 1;
    zPriority = 1;
    
    static _XDIR = 0b001;
    static _YDIR = 0b010;
    static _ZDIR = 0b100;

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
            this.targetNode = new TrackingNode(null, undefined, this.forBone.parentArmature.wScale);           
            this.targetNode.adoptGlobalValuesFromObject3D(this.forBone.getIKBoneOrientation());
            this.targetNode.setParent(forBone.parentArmature.armatureNode);
            this.targetNode.updateUnderlyingFrom_Global(true)
        } else if(targetNode instanceof THREE.Object3D) {
            let trackNode = new TrackingNode(targetNode, undefined, this.forBone.parentArmature.wScale);
            this.targetNode = trackNode;
            this.targetNode.setParent(forBone.parentArmature.armatureNode);
            this.target_threejs = targetNode;
        } else {
            this.targetNode = targetNode;
            if(targetNode instanceof TrackingNode) {
                this.target_threejs = targetNode.toTrack
            }
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
        this.forBone?.parentArmature?.regenerateShadowSkeleton();
    }

    enable() {
        this.enabled = true;
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
			this.forBone?.parentArmature?.regenerateShadowSkeleton();
		} else {
			this.forBone?.parentArmature?.updateShadowSkelRateInfo();
		}
    }

    getDepthFalloff() {
        return this.depthFalloff;
    }

    setPositionPriority(val) {

    }

    /**
	 * Sets  the priority of the orientation bases which effectors reaching for this target will and won't align with. 
	 * If all are set to 0, then the target is treated as a simple position target. 
	 * It's usually better to set at least on of these three values to 0, as giving a nonzero value to all three is most often redundant and just adds comput time. 
	 *
	 * @param xPriority Determines how much this pin's bone tries to align its x-axis with the target x-axis.
	 * @param yPriority Determines how much this pin's bone tries to align its y-axis with the target y-axis.	
	 * @param zPriority Determines how much this pin's bone tries to align its z-axis with the target z-axis.
	 */

    setTargetPriorities(xPriority, yPriority, zPriority) {

        let xDir = xPriority > 0 ? IKPin._XDIR : 0;
		let yDir = yPriority > 0 ? IKPin._YDIR : 0;
		let zDir = zPriority > 0 ? IKPin._ZDIR : 0;
        let prevmodecode = this.modeCode;
		this.modeCode = 0; 

		this.modeCode += xDir; 
		this.modeCode += yDir; 
		this.modeCode += zDir;
		
		let subTargetCount = 1;
		if((this.modeCode &1) != 0) subTargetCount++;   
		if((this.modeCode &2) != 0) subTargetCount++;   
		if((this.modeCode &4) != 0) subTargetCount++; 
		
		this.xPriority = xPriority;
		this.yPriority = yPriority;
		this.zPriority = zPriority;		
        
        if(prevmodecode != this.modeCode) {
            this.forBone?.parentArmature?.regenerateShadowSkeleton();
        }
        this.forBone?.parentArmature?.updateShadowSkelRateInfo();
    }

    /**
	 * @param xPriority Determines how much this pin's bone tries to align its x-axis with the target x-axis.	
	 */
    setXPriority(val) {
        this.setTargetPriorities(parseFloat(val), this.yPriority, this.zPriority);
    }

    /**
	 * @param yPriority Determines how much this pin's bone tries to align its y-axis with the target y-axis.	
	 */
    setYPriority(val) {
        this.setTargetPriorities(this.xPriority, parseFloat(val), this.zPriority);
    }

    /**
	 * @param zPriority Determines how much this pin's bone tries to align its z-axis with the target z-axis.	
	 */
    setZPriority(val) {
        this.setTargetPriorities(this.xPriority, this.yPriority, parseFloat(val));
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
        const prevWeight = this.pinWeight;
        this.pinWeight = Math.min(Math.max(weight, 0), 1);
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

    /**
     * positions this pin to precisely where its bone can reach it.
    */
    alignToBone() {
        const object = this.targetNode.toTrack;
        let prevPar = object.parent;
        object.position.set(0, 0, 0);
        object.quaternion.set(0, 0, 0, 1);
        object.scale.set(1, 1, 1);
        object.updateMatrix();
        (this.forBone.getIKBoneOrientation()?.children[0] ?? this.forBone.getIKBoneOrientation()).add(object); 
        object.updateWorldMatrix();
        this.forBone.getIKBoneOrientation()?.children[0] ?? this.forBone.getIKBoneOrientation().attach();
        this.targetNode.adoptGlobalValuesFromObject3D(object, this.forBone.parentArmature.wScale, true);
        prevPar.attach(object);

        //this.targetNode.sendTrackedToGlobal(this.forBone.getIKBoneOrientation()?.children[0] ?? this.forBone.getIKBoneOrientation());
        //this.targetNode.adoptGlobalValuesFromObject3D(this.forBone.getIKBoneOrientation()?.children[0] ?? this.forBone.getIKBoneOrientation());
        //this.forBone.getIKBoneOrientation().updateWorldMatrix();
        //this.forBone.getIKBoneOrientation().getWorldPosition(this.targetNode.toTrack.position);
        //this.forBone.getIKBoneOrientation().getWorldQuaternion(this.targetNode.toTrack.quaternion);
        //this.targetNode.adoptTrackedLocal();
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

}