import { Vec3 } from "../vecs.js";
import { Rot } from "../Rot.js";
import { IKTransform } from "./IKTransform.js";
import { generateUUID } from "../uuid.js";
const THREE = await import('three');
import { Quaternion, Vector3, Object3D, Matrix4 } from "three";
import { IKPin } from "../../betterbones/IKpin.js";
import { IKNode } from "./IKNodes.js";



function lerp(start, end, t) {
    return (t * (end - start)) + start;
}


/**
 * tracks three.js Object3ds while maintaining internal decompositions of their 
 * transformations in local and global space. 
 * Requires shadow nodes be created for the entire ancestry of objects all of the way up to the scene root.
 * But offers the following advantages:
 * 1. internal manipulations can be carried out in both local and global space multiple times without worrying about three.js matrix state.
 * 2. when manipulations are completed, the state can be written back out directly to three.js
 * 3. uses a nicer gimbal-lock free abstraction over rotations, while still not requiring manual quaternion
 * manipulation.
 * 4. operations are worldspace symmetric between composition and decomposition. The is accomplished by incorporating three skew_delta vectors which track the non-orthogonal transformations to the basis vectors that would be required for the worldspace matrix which three.js reports to match the worldspace matrix claimed by recomposing the TRS decomposition three.js provides.
 **/
export class ShadowNode extends IKNode{
    static totalShadowNodes = 0;
    static ShadowNodeRoot = null;
    id = 'ShadowNode-' + ShadowNode.totalShadowNodes;
    __trackChangeListeners = null;

    constructor(toTrack, ikd, pool = globalVecPool) {
        if(toTrack.trackedBy != null) {
            throw new Error(`Designated Object3d is already tracked by ${toTrack.trackedBy.ikd}`);
        }
        super(undefined, undefined, ikd, pool);
        this._toTrack = toTrack;
        ShadowNode.totalShadowNodes++;
        if(ikd == null) {
            let trackName = this.toTrack?.name != '' ? this.toTrack.name : this.toTrack.ikd;
            if(trackName != null) {
                this.ikd = 'ShadowNode-of-'+trackName+'_'+ShadowNode.totalShadowNodes;
            } else {
                this.ikd = 'ShadowNode-'+ShadowNode.totalShadowNodes;
            }
        }
        this.toTrack.trackedBy = this;
        if(this.toTrack.parent == null) {
            this.areGlobal = true;
            ShadowNode.ShadowNodeRoot = this;
        }
        else if(this.toTrack.parent.trackedBy == null) {
            this.adoptGlobalValuesFromObject3D(this.toTrack);
            this.setParent(new ShadowNode(this.toTrack.parent, undefined, this.pool));
            this.areGlobal = false;
        } else {
            this.setParent(this.toTrack.parent.trackedBy);
        }
        

        this.tag = ikd;
        this.mimic();
        this.updateGlobal();
    }

    /**
     * mimics the local values of this ShadowNode to match those of the object3D this is tracking. Optionally does so recursively up until a provided ancestor 
     * If everything is set up correctly, the global/worldspace values should inherently match
     * 
     * @param {Boolean} markDescendantsDirty whether to notify descendants shadowNodes that they are dirty
     * @param {IKNode} mimicUntil an ancestor node to stop on 
    */
    mimic(markDescendantsDirty = true, mimicUntil=ShadowNode.ShadowNodeRoot) {
        let curr = this;
        let prevCurr = this;
        while(curr != null && curr != mimicUntil) {
            if(isNaN(curr.toTrack.quaternion.w)) 
                curr.toTrack.quaternion.identity();
            curr.localMBasis.setFromObj3d(curr.toTrack);
            if(!markDescendantsDirty)
                curr._exclusiveMarkDirty();
            prevCurr = curr;
            curr=curr.parent;
        }
        if(markDescendantsDirty) {
            prevCurr.markDirty();
        }
        return this;
    }

    /**makes sure the shadowNode expectations are obeyes in case of topology modification */
    ensure() {
        if(this._toTrack.parent != this.parent?._toTrack) {
            this.setTracked(this._toTrack);
        } else if(this.parent != null) {
            this.parent.ensure();
        }
    }

    /**Set the provided object3d as the one this ShadowNode tracks
     * @param {Object3D} obj3d
    */
    setTracked(obj3d) {
        this.fireTrackChangeListeners(obj3d);
        this._toTrack.trackedBy = null;
        this._toTrack = obj3d;
        obj3d.trackedBy = this;
        this.adoptGlobalValuesFromObject3D(this.toTrack);
        if(obj3d.parent.trackedBy == null) {            
            this.setParent(new ShadowNode(this.toTrack.parent, undefined, this.pool));
        } else {
            this.setParent(this.toTrack.parent.trackedBy);
        }
        return this;
    }

    get toTrack() {
        return this._toTrack;
    }

    set toTrack(obj3d) {
        this.setTracked(obj3d);
    }

    /**mimics the local values of this ShadowNode's tracked object 3d and exclusively marks this node dirty, with no further checks */
    quickMimic() {
        this.localMBasis.setFromObj3d(this.toTrack);
        this._exclusiveMarkDirty();
        return this;
    }

    fireTrackChangeListeners(willTrack) {
        if(this.__trackChangeListeners == null || willTrack == this.toTrack) return;
        for(let l of this.__trackChangeListeners) {
            l(this, this.toTrack, willTrack);
        }
    }


    /**register a callback to be notified if this ShadowNode changes the THREE.Object3D it purports to track
     * the callback will be provided with a reference to this node, the tracked object prior to untracking, and the new object to be tracked.
     * In that order. THe change will not actually occur until after all callbacks have fired, so don't try to use it to intervene.
    */
    registerTrackChangeListener(newListener) {
        if(this.__trackChangeListeners == null) {
            this.__trackChangeListeners = new Set();
        }
        this.__trackChangeListeners.add(newListener);
        return this;
    }

    removeTrackChangeListener(newListener) {
        if(this.__trackChangeListeners != null) {
            this.__trackChangeListeners.remove(newListener);
        }
        return this;
    }

    /**
     * temporarily adopts the global values of whatever this ShadowNode is tracking without bothering to 
     * mimic the ancestors. This node will be marked as non-dirty after the update
     */
    tempAdoptTrackedGlobal() {
        this.localMBasis.setFromObj3d(this.toTrack);
        this.globalMBasis.setFromGlobalizedObj3d(this.toTrack, this.temp_originthreevec, this.temp_identitythreequat, this.temp_unitthreescale);
        this.dirty = false;
        return this;
    }
    /**
     * sets the Object3D transforms to the local transforms of this ShadowNode.
     * 
     * @param {Boolean} linear if set to true, will also update the object3d's local matrix to match this shadownode's local matrix
     */
    project(linear = false) {
        //yeah I know "project" isn't the best name but, the next best option was kageShibariNoJutsu() so...
        /*if(isNaN(this.localMBasis.translate.x) || isNaN(this.localMBasis.rotation.x) || isNaN(this.localMBasis.scale.x)) {
            alert("NaN detected, check the debugger")
            throw new Error("Projecting NaNs is bad.");
        }*/
        this.toTrack.position.x = this.localMBasis.translate.x;
        this.toTrack.position.y = this.localMBasis.translate.y;
        this.toTrack.position.z = this.localMBasis.translate.z;

        this.toTrack.scale.x = this.localMBasis.scale.x;
        this.toTrack.scale.y = this.localMBasis.scale.y;
        this.toTrack.scale.z = this.localMBasis.scale.z;

        this.toTrack.quaternion.x = -this.localMBasis.rotation.x;
        this.toTrack.quaternion.y = -this.localMBasis.rotation.y;
        this.toTrack.quaternion.z = -this.localMBasis.rotation.z;
        this.toTrack.quaternion.w = this.localMBasis.rotation.w;
        if(linear) {
            this.localMBasis.recompose();
            this.toTrack.matrix.copy(this.localMBasis.composedMatrix);
        }
        return this;
    }
    
    setParent(par, requestedBy = undefined) {
        if(par instanceof ShadowNode) {
            if(this.toTrack.parent.trackedBy != par) {
                throw new Error("The Object3D of the intended parent ShadowNode must be a parent of the Object3D being tracked by this ShadowNode.");
            }
            super.setParent(par, requestedBy);
        } else {
            throw new Error("ShadowNdes can only be parented to other ShadowNodes");
        }
        return this;
    }

    
    /**
     * sets the given node as this node's parent such that this node's global values are likely to change
     * @param {IKNode} par 
     * @returns 
     */
    setRelativeToParent(par) {
        if(par instanceof ShadowNode) {
            if(this.toTrack.parent.trackedBy != par) {
                throw new Error("The Object3D of the intended parent ShadowNode must be a parent of the Object3D being tracked by this ShadowNode.");
            }
            if (this.getParentAxes() !== null) {
                this.getParentAxes()._disown(this);
            }
            this.parent = par;
            this.areGlobal = false;
            this.getParentAxes().childNodes.add(this)
            this.markDirty();
            return this;
        } else {
            throw new Error("ShadowNdes can only be parented to other ShadowNodes");
        }
        return this;
    }

    dispose() {
        this.emancipate();
        for (let c in this.children) {
            c.emancipate();
        }
        delete this.toTrack.trackedBy;
    }

    reset() {
        this.emancipate();
        for (let c in this.children) {
            c.emancipate();
        }
        this.localMBasis.setToIdentity();
        this.globalMBasis.setToIdentity();
        this.markDirty();
        return this;
    }

    /**sets the local values of this node to what they would need to be in order 
     * for the global values to remain unchanged if the input node were made the parent of this node
     */
    setAsIfParent(input) {
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
            this.setParent(ShadowNode.ShadowNodeRoot);
            this.parent = null;
            this.areGlobal = true;
            this.markDirty();
            this.updateGlobal();
        }
        return this;
    }
}