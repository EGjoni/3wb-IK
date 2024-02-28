import { Vec3, Vec3d, Vec3f } from "./vecs.js";
import { MRotation, Rot } from "./Rot.js";
import { IKTransform } from "./IKTransform.js";
import { generateUUID } from "./uuid.js";
const THREE = await import('three');
import { Quaternion, Vector3, Object3D, Matrix4 } from "three";


function lerp(start, end, t) {
    return (t*(end-start))+start;
}

export class IKNode {
    static totalNodes = 0;
    static NORMAL = 0;
    static IGNORE = 1;
    static FORWARD = 2;
    static RIGHT = 1;
    static LEFT = -1;
    static X = 0;
    static Y = 1;
    static Z = 2;
    /** @type {IKTransform} */
    localMBasis = null;
    /** @type {IKTransform} */
    globalMBasis = null;
    /** @type {IKNode} */
    parent = null;
    id = IKNode.totalNodes;
    static originthreevec = new Vector3(0,0,0);
    static identitythreequat = new Quaternion(0,0,0,1);
    static unitthreescale = new Vector3(1,1,1);
    tempOrigin = new  Vec3([0,0,0]);
    temp_originthreevec = new Vector3(0,0,0);
    temp_identitythreequat = new Quaternion(0,0,0,1);
    temp_unitthreescale = new Vector3(1,1,1);


    constructor(globalMBasis, parent, ikd = 'IKNode-'+(IKNode.totalNodes+1)) {
        this.ikd = ikd;
        IKNode.totalNodes += 1; 
        if(globalMBasis == null) {
            this.localMBasis = new IKTransform();
            this.globalMBasis = new IKTransform();
        } else {
            this.localMBasis = globalMBasis.copy();
            this.globalMBasis = globalMBasis.copy();
        }
        this.parent = parent;
        this.dirty = true;
        this.childNodes = new Set();
        this.workingVector = new Vec3();
        this.areGlobal = true;
        
        this.tag = ikd;
        if(parent != null) {
			this.setParent(parent);
		} 	else {
			this.areGlobal = true;
		}
		this.markDirty();
		this.updateGlobal();
    }


    adoptGlobalValuesFromObject3D(object3d) {
        this.temp_originthreevec.copy(IKNode.originthreevec)
        this.temp_identitythreequat.copy(IKNode.identitythreequat);
        this.temp_unitthreescale.copy(IKNode.unitthreescale);
        
        object3d.updateWorldMatrix();
        const pos = object3d.getWorldPosition(this.temp_originthreevec);
        const quat = object3d.getWorldQuaternion(this.temp_identitythreequat);
        const scale = object3d.getWorldScale(this.temp_unitthreescale); 
        this.globalMBasis.translate.setComponents(pos.x, pos.y, pos.z);
        this.globalMBasis.rotation.set(-quat.w, quat.x, quat.y, quat.z);
        this.globalMBasis.scale.setComponents(scale.x, scale.y, scale.z);
        this.globalMBasis.refreshPrecomputed();
        if(this.parent != null) {
            this.parent.setTransformToLocalOf(this.globalMBasis, this.localMBasis);
        } else {
            this.localMBasis.adoptValues(this.globalMBasis)
        }
    }

    adoptLocalValuesFromObject3D(object3d) {
        this.localMBasis.translate.setComponents(object3d.position.x, object3d.position.y, object3d.position.z);
        this.localMBasis.rotation.set(-object3d.quaternion.w, object3d.quaternion.x, object3d.quaternion.y, object3d.quaternion.z);
        this.localMBasis.scale.setComponents(object3d.scale.x, object3d.scale.y, object3d.scale.z);
        this.localMBasis.refreshPrecomputed();
    }


    getParentAxes() {
        const p = this.parent;
        return p ? p : null;
    }

    updateGlobal(force = false) {
        if (this.dirty || force) {
            if (this.areGlobal) {
                this.globalMBasis.adoptValues(this.localMBasis);
            } else {
                this.getParentAxes().updateGlobal(false);
                this.getParentAxes().getGlobalMBasis().setTransformToGlobalOf(this.localMBasis, this.globalMBasis);
            }
        }
        this.dirty = false;
    }


    origin() {
        this.updateGlobal();
        this.tempOrigin.set(this.getGlobalMBasis().getOrigin());
        return this.tempOrigin;
    }

    getGlobalCopy() {
        return new IKNode(this.getGlobalMBasis(), this.getParentAxes());
    }

    /**
     * 
     * @param {IKNode} par 
     * @param {Object} requestedBy 
     */
    setParent(par, requestedBy = undefined) {
        this.updateGlobal();
        const oldParent = this.getParentAxes();        

        if (par !== null && par !== this) {
            par.updateGlobal();
            par.getGlobalMBasis().setTransformToLocalOf(this.globalMBasis, this.localMBasis);

            if (oldParent !== null) oldParent._disown(this);
            this.parent = par;

            this.getParentAxes().childNodes.add(this)
            this.areGlobal = false;
        } else {
            if (oldParent !== null) oldParent._disown(this);
            this.parent = null;
            this.areGlobal = true;
        }
        this.markDirty();
        this.updateGlobal();

        for(c of this.childNodes) ad.parentChangeCompletionNotice(this, oldParent, par, requestedBy);
        
    }

    setGlobalOrientationTo(rotation) {
		this.updateGlobal();
		if(this.getParentAxes() != null) {
			this.getGlobalMBasis().rotateTo(rotation);
			getParentAxes().getGlobalMBasis().setToLocalOf(this.globalMBasis, this.localMBasis);
		} else {
			this.getLocalMBasis().rotateTo(rotation);
		}
		this.markDirty();
	}
	
	setLocalOrientationTo(rotation) {
		this.getLocalMBasis().rotateTo(rotation);
		this.markDirty();
	}

    rotateBy(apply) {
		this.updateGlobal();		
		if(this.getParentAxes() != null) {
			let newRot = this.getParentAxes().getGlobalMBasis().getLocalOfRotation(apply);
			this.getLocalMBasis().rotateBy(newRot);
		} else {
			this.getLocalMBasis().rotateBy(apply);
		}

		this.markDirty(); 
	}


    getGlobalChirality() {
        this.updateGlobal();
        return this.getGlobalMBasis().chirality;
    }

    getLocalChirality() {
        this.updateGlobal();
        return this.getLocalMBasis().chirality;
    }

    isGlobalAxisFlipped(axis) {
        this.updateGlobal();
        return this.globalMBasis.isAxisFlipped(axis);
    }

    isLocalAxisFlipped(axis) {
        return this.localMBasis.isAxisFlipped(axis);
    }

    setRelativeToParent(par) {
        if (this.getParentAxes() !== null) {
            this.getParentAxes()._disown(this);
        }
        this.parent = par;
        this.areGlobal = false;
        this.getParentAxes().childNodes.add(this)
        this.markDirty();
    }

    needsUpdate() {
        if (this.dirty) return true;
        else return false;
    }

    getGlobalOf(input) {
        const result = input.copy();
        this.setToGlobalOf(input, result);
        return result;
    }

    setToGlobalOf(input, out) {
        this.updateGlobal();
        this.getGlobalMBasis().setToGlobalOf(input, out);
    }
    

    setVecToLocalOf(input, out) {
        if(out == null) {
            out = input.copy();
        }
        this.updateGlobal();
        this.getGlobalMBasis().setVecToLocalOf(input, out);
    }

    setTransformToLocalOf(input, out) {
        if(out == null) {
            out = input.copy();
        }
        this.updateGlobal();
        this.getGlobalMBasis().setTransformToLocalOf(input, out);
    }

    getLocalOf(input) {
        this.updateGlobal();
        const result = input.copy();
        this.getGlobalMBasis().setTransformToLocalOf(input, result);
        return result;
    }


    translateByLocal(translate) {
        this.updateGlobal();
        this.getLocalMBasis().translateBy(translate);
        this.markDirty();
    }

    translateByGlobal(translate) {
        if (this.getParentAxes() !== null) {
            this.updateGlobal();
            this.translateTo(translate.addCopy(this.origin()));
        } else {
            this.getLocalMBasis().translateBy(translate);
        }

        this.markDirty();
    }

    translateTo(translate) {
        if (this.getParentAxes() !== null) {
            this.updateGlobal();
            this.getLocalMBasis().translateTo(this.getParentAxes().getGlobalMBasis().getLocalOfVec(translate));
        } else {
            this.getLocalMBasis().translateTo(translate);
        }

        this.markDirty();
    }

    toIdentity() {
        this.localMBasis.setIdentity();
        this.markDirty();
    }

    /**sets the local values of this node to what they would need to be in order 
     * for the global values to remain unchanged if the input node were made the parent of this node
     */
    setRelativeTo(input) {
        this.updateGlobal();
        input.getGlobalMBasis().setTransformToLocalOf(this.getGlobalMBasis(), this.getLocalMBasis());
		this.markDirty();
    }


    emancipate() {
        if (this.getParentAxes() !== null) {
            this.updateGlobal();
            this.getLocalMBasis().adoptValues(this.globalMBasis);
            this.getParentAxes()._disown(this);
            this.parent = null;
            this.areGlobal = true;
            this.markDirty();
            this.updateGlobal();
        }
        return this;
    }

    _disown(child) {
        this.childNodes.delete(child);
    }

    getGlobalMBasis() {
        this.updateGlobal();
        /** @type {IKTransform} */
        return this.globalMBasis;
    }

    getLocalMBasis() {
        return this.localMBasis;
    }

    getWeakRefToParent() {
        return this.parent;
    }

    setWeakRefToParent(parentRef) {
        this.parent = parentRef;
    }

    markDirty() {
        if (!this.dirty) {
            this.dirty = true;
            for(let c of this.childNodes) c.markDirty();            
        }
    }

    _exclusiveMarkDirty() {
        this.dirty = true;
    }

    xRay() {
        return this.getGlobalMBasis().xRay;
    }

    yRay() {
        return this.getGlobalMBasis().yRay;
    }

    zRay() {
        return this.getGlobalMBasis().zRay;
    }

    equals(ax) {
        this.updateGlobal();
        ax.updateGlobal();

        return (
            this.getGlobalMBasis().rotation.equals(ax.globalMBasis.rotation) &&
            this.getGlobalMBasis().getOrigin().equals(ax.origin_)
        );
    }

    freeCopy() {
        const freeCopy = new IKNode(this.getLocalMBasis(), null);
        freeCopy.getLocalMBasis().adoptValues(this.localMBasis);
        freeCopy.markDirty();
        freeCopy.updateGlobal();
        return freeCopy;
    }

    attachedCopy() {
        this.updateGlobal();
        const copy = new IKNode(this.getGlobalMBasis(), this.getParentAxes());
        copy.getLocalMBasis().adoptValues(this.localMBasis);
        copy.markDirty();
        return copy;
    }

    toString() {
        this.updateGlobal();
        const global = `Global: ${this.getGlobalMBasis().toString()}\n`;
        const local = `Local: ${this.getLocalMBasis().toString()}`;
        return global + local;
    }

    toConsole() {
        console.log(this.toString());
    }
}

/**
 * like IKNode, but always returns values corresponding to the provided three.js Object3d
 */
export class TrackingNode extends IKNode {
    static totalTrackingNodes = 0;
    /**
     * 
     * @param {Object3D} toTrack 
     */
    constructor(toTrack, ikd = 'TrackingNode-'+(TrackingNode.totalNodes+1)) {
        super();
        this.ikd = ikd;
        TrackingNode.totalNodes +=1;
        this.toTrack = toTrack;
        //this.toTrack.matrixWorldAutoUpdate = false;
        //this.adoptLocalValuesFromObject3D(this.toTrack);
        this.markDirty();
        this.updateGlobal();
    }

    updateGlobal(force = false) {
        const was_dirty = this.dirty;
        super.updateGlobal();
        if(this.toTrack != null) {
            if((this.parent == null) || this.toTrack.parent == this.parent?.toTrack) {
                this.updateUnderlyingFromLocal();
                if(was_dirty) this.toTrack.updateWorldMatrix();
            } else {
                this.updateUnderlyingFromGlobal(was_dirty, false);
            }
            //this.adoptLocalValuesFromObject3D(this.toTrack);
            //this.adoptGlobalValuesFromObject3D(this.toTrack);
            //this.dirty = false;
        }
    }

    adoptTrackedLocal() {
        this.adoptLocalValuesFromObject3D(this.toTrack);
        this.markDirty();
    }

    /*getLocalMBasis() {
        if(this.parent == null && this.toTrack)
        this.updateUnderlying();
        this.adoptLocalValuesFromObject3D(this.toTrack);
        return this.localMBasis;
    }*/
    updateUnderlyingFromLocal() {
        TrackingNode.transferLocalToObj3d(this.localMBasis, this.toTrack); 
    }

    updateUnderlyingFromGlobal(update_world, updateSelf = true) {
        if(updateSelf)
            this.updateGlobal();
        else {
            transferGlobalToObj3d(this.globalMBasis, this.toTrack, update_world);
        }
    }


    static transferLocalToObj3d(localMBasis, obj3d) {
        obj3d.position.x = localMBasis.translate.x;
        obj3d.position.y = localMBasis.translate.y;
        obj3d.position.z = localMBasis.translate.z;

        obj3d.scale.x = localMBasis.scale.x;
        obj3d.scale.y = localMBasis.scale.y;
        obj3d.scale.z = localMBasis.scale.z;

        obj3d.quaternion.w = -localMBasis.rotation.q0;
        obj3d.quaternion.x = localMBasis.rotation.q1;
        obj3d.quaternion.y = localMBasis.rotation.q2;
        obj3d.quaternion.z = localMBasis.rotation.q3;

    }


    static transferGlobalToObj3d(globalMBasis, obj3d, update_world = true) {
        const newWorld = this.toTrack.matrixWorld.compose(
            globalMBasis.translate, 
            new Quaternion(
                globalMBasis.rotation.q1,
                globalMBasis.rotation.q2,
                globalMBasis.rotation.q3,
                -globalMBasis.rotation.q0
                ),
            globalMBasis.scale);
        const inverseParentWorldMatrix = new Matrix4().copy(obj3d.matrixWorld).invert();
        const localMatrix = inverseParentWorldMatrix.multiply(newWorld);
        obj3d.matrix = localMatrix;
        obj3d.matrix.decompose(obj3d.position, obj3d.quaternion, obj3d.scale);
        obj3d.matrixWorldAutoUpdate = false;        
        if(update_world)
            obj3d.updateWorldMatrix(false, true);
    }

}