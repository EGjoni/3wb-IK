import {  Vec3, new_Vec3 } from "./vecs.js";
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
    id = 'IKNode-'+IKNode.totalNodes;
    forceOrthoNormality = true;
    static originthreevec = new Vector3(0,0,0);
    static identitythreequat = new Quaternion(0,0,0,1);
    static unitthreescale = new Vector3(1,1,1);
    tempOrigin = new_Vec3(0,0,0);
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
        this.workingVector = new_Vec3();
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

    static fromObj3dGlobal(object3d) {
        let result = new IKNode(); 
        result.adoptGlobalValuesFromObject3D(object3d);
        return result;
    }

    static fromObj3dLocal(object3d) {
        let result = new IKNode(); 
        result.adoptLocalValuesFromObject3D(object3d);
        return result;
    }

    adoptGlobalValuesFromObject3D(object3d) {
        this.localMBasis.setFromObj3d(object3d);
        this.globalMBasis.setFromGlobalizedObj3d(object3d, this.temp_originthreevec, this.temp_identitythreequat, this.temp_unitthreescale);
        if(this.parent != null) {
            this.parent.setTransformToLocalOf(this.globalMBasis, this.localMBasis);
        } 
        return this;
    }

    adoptLocalValuesFromObject3D(object3d) {
        this.localMBasis.setFromObj3d(object3d);
        this.markDirty();
        return this;
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
        return this;
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
        return this;
    }

    alignGlobalsTo(inputGlobalMBasis) {
        this.updateGlobal();
		if(this.getParentAxes() != null) {
            this.getGlobalMBasis().adoptValues(inputGlobalMBasis);
			this.getParentAxes().getGlobalMBasis().setTransformToLocalOf(this.globalMBasis, this.localMBasis);
		} else {
			this.getLocalMBasis().adoptValues(inputGlobalMBasis);
		}
		this.markDirty();
        return this;
    }

    setGlobalOrientationTo(rotation) {
		this.updateGlobal();
		if(this.getParentAxes() != null) {
			this.getGlobalMBasis().rotateTo(rotation);
			this.getParentAxes().getGlobalMBasis().setTransformToLocalOf(this.globalMBasis, this.localMBasis);
		} else {
			this.getLocalMBasis().rotateTo(rotation);
		}
		this.markDirty();
        return this;
	}
	
	setLocalOrientationTo(rotation) {
		this.getLocalMBasis().rotateTo(rotation);
		this.markDirty();
        return this;
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
        return this;
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
        return this;
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
        return out;
    }
    

    setVecToLocalOf(input, out) {
        if(out == null) {
            out = input.copy();
        }
        this.updateGlobal();
        this.getGlobalMBasis().setVecToLocalOf(input, out);
        return out;
    }

    setTransformToLocalOf(input, out) {
        if(out == null) {
            out = input.copy();
        }
        this.updateGlobal();
        this.getGlobalMBasis().setTransformToLocalOf(input, out);
        return out;
    }

    /**
     * 
     * @param {Vec3} input 
     * @returns {Vec3}
     */
    getLocalOf(input, storeIn = any_Vec3()) {
        this.updateGlobal();
        this.getGlobalMBasis().setTransformToLocalOf(input, storeIn);
        return storeIn;
    }


    translateByLocal(translate) {
        this.updateGlobal();
        this.getLocalMBasis().translateBy(translate);
        this.markDirty();
        return this;
    }

    translateByGlobal(translate) {
        if (this.getParentAxes() !== null) {
            this.updateGlobal();
            this.translateTo(translate.addCopy(this.origin()));
        } else {
            this.getLocalMBasis().translateBy(translate);
        }

        this.markDirty();
        return this;
    }

    translateTo(translate) {
        if (this.getParentAxes() !== null) {
            this.updateGlobal();
            this.getLocalMBasis().translateTo(this.getParentAxes().getGlobalMBasis().getLocalOfVec(translate));
        } else {
            this.getLocalMBasis().translateTo(translate);
        }

        this.markDirty();
        return this;
    }

    setLocalsToIdentity() {
        this.localMBasis.setToIdentity();
        this.markDirty();
        return this;
    }


    setGlobalsToIdentity() {
        this.getGlobalMBasis().setToIdentity();
        if(this.getParentAxes()!=null) {
            this.setRelativeTo(this.parent.getParentAxes());
        }
        this.markDirty();
        return this;
    }

    /**sets the local values of this node to what they would need to be in order 
     * for the global values to remain unchanged if the input node were made the parent of this node
     */
    setRelativeTo(input) {
        this.updateGlobal();
        input.getGlobalMBasis().setTransformToLocalOf(this.getGlobalMBasis(), this.getLocalMBasis());
		this.markDirty();
        return this;
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

    static obj3dToConsole(object3d) {
        let loc = new IKTransform() 
        loc.setFromObj3d(object3d);
        let glob = new IKTransform(); 
        glob.setFromGlobalizedObj3d(object3d);

        const global = `Global: ${glob.toString()}\n`;
        const local = `Local: ${loc.toString()}`;
        let out = global + local;
        console.log(out);
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
    constructor(toTrack, ikd = 'TrackingNode-'+(TrackingNode.totalNodes+1), forceOrthoNormality = true) {
        super();
        this.ikd = ikd;
        TrackingNode.totalNodes +=1;
        this.toTrack = toTrack;
        if(this.toTrack?.scale.x != 1 || this.toTrack?.scale.y != 1 || this.toTrack?.scale.z !=1) 
            this.forceOrthoNormality = false
        //this.toTrack.matrixWorldAutoUpdate = false;
        if(this.toTrack != null)
            this.adoptLocalValuesFromObject3D(this.toTrack);
        this.markDirty();
        //this.updateGlobal();
    }

    updateGlobal(force = false) {
        const was_dirty = this.dirty;
        super.updateGlobal();
        if(this.toTrack != null) {
            if((this.parent == null) || this.toTrack.parent == this.parent?.toTrack) {
                this.updateUnderlyingFrom_Local();
                if(was_dirty) this.toTrack.updateWorldMatrix();
            } else {
                this.updateUnderlyingFrom_Global(was_dirty, false);
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

    adoptTrackedGlobal() {
        this.adoptGlobalValuesFromObject3D(this.toTrack);
        this.adoptLocalValuesFromObject3D(this.toTrack);
        //this.markDirty();
    }

    /*getLocalMBasis() {
        if(this.parent == null && this.toTrack)
        this.updateUnderlying();
        this.adoptLocalValuesFromObject3D(this.toTrack);
        return this.localMBasis;
    }*/
    updateUnderlyingFrom_Local() {
        TrackingNode.transferLocalToObj3d(this.localMBasis, this.toTrack); 
    }

    updateUnderlyingFrom_Global(update_world, updateSelf = true) {
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