import { Vec3 } from "../vecs.js";
import { Rot } from "../Rot.js";
import { IKTransform } from "./IKTransform.js";
import { generateUUID } from "../uuid.js";
const THREE = await import('three');
import { Quaternion, Vector3, Object3D, Matrix4 } from "three";
import { TargetState } from "../../solver/SkeletonState.js";
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
 * manpilation.
 * 4. operations are worldspace symmetric between composition and decomposition. The is accomplished by incorporating three skew_delta vectors which track the non-orthogonal transformations to the basis vectors that would be required for the worldspace matrix which three.js reports to match the worldspace matrix claimed by recomposing the TRS decomposition three.js provides.
 **/
export class ShadowNode extends IKNode{
    static totalShadowNodes = 0;
    static NORMAL = 0;
    static IGNORE = 1;
    static FORWARD = 2;
    static RIGHT = 1;
    static LEFT = -1;
    static X = 0;
    static Y = 1;
    static Z = 2;
    /**
     * The Object3d to track.
     * @type {Object3D} */
    toTrack = null;
    /** @type {IKTransform} */
    localMBasis = null;
    /** @type {IKTransform} */
    globalMBasis = null;
    /** @type {IKNode} */
    parent = null;
    id = 'IKNode-' + IKNode.totalNodes;
    forceOrthoNormality = true;
    static originthreevec = new Vector3(0, 0, 0);
    static identitythreequat = new Quaternion(0, 0, 0, 1);
    static unitthreescale = new Vector3(1, 1, 1);
    temp_originthreevec = new Vector3(0, 0, 0);
    temp_identitythreequat = new Quaternion(0, 0, 0, 1);
    temp_unitthreescale = new Vector3(1, 1, 1);

    constructor(toTrack, parent, ikd, pool = noPool) {
        super(undefined, parent, ikd, pool);
        this.toTrack = toTrack;
        ShadowNode.totalShadowNodes++;
        if(ikd == null) {
            if(this.toTrack?.name != '' ) {
                this.ikd = 'ShadowNode-of-'+this.toTrack.name+'_'+ShadowNode.totalShadowNodes;
            } else {
                this.ikd = 'ShadowNode-'+ShadowNode.totalShadowNodes;
            }
        }
        this.toTrack.trackedBy = this;
        if(this.toTrack.parent == null) {
            this.areGlobal = true;
        }
        else if(this.toTrack.parent.trackedBy == null) {
            this.globalMBasis.adoptGlobalValuesFromObject3D(this.toTrack);
            this.setParent(new ShadowNode(this.toTrack.parent, undefined, undefined, ikd));
            this.areGlobal = false;
        } else {
            this.setParent(this.toTrack.parent.trackedBy);
        }
        

        this.tag = ikd;
        this.markDirty();
        this.updateGlobal();
    }

    /**
     * mimics the local values of this ShadowNode to those of the object3D this is tracking 
     * If everything is set up correctly, the global/worldspace values should inherently match
    */
    mimic() {
        this.adoptLocalValuesFromObject3D(this.toTrack);
    }

    /**
     * sets the Object3D transforms to the local transforms of this ShadowNode.
     * 
     * yeah I know "project()" isn't the best name but, the alternative was kageShibariNoJutsu() so...
     */
    project() {
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
    }   

    /**
     * 
     * @param {*} object3d 
     * @param {*} updateLocal 
     * @returns 
     */

    adoptGlobalValuesFromObject3D(object3d, updateLocal = true) {        
        //this.localMBasis.setFromObj3d(object3d);
        this.globalMBasis.setFromGlobalizedObj3d(object3d, this.temp_originthreevec, this.temp_identitythreequat, this.temp_unitthreescale);
        if (this.parent != null && updateLocal) {
            this.parent.setTransformToLocalOf(this.globalMBasis, this.localMBasis);
        }
        return this;
    }

    adoptLocalValuesFromObject3D(object3d) {
        this.localMBasis.setFromObj3d(object3d);
        this.markDirty();
        return this;
    }

    adoptAllValuesFromObject3D(node) {
        this.localMBasis.setFromObj3d(node.getLocalMBasis());
        this.globalMBasis.setFromObj3d(node.getGlobalMBasis());
        return this;
    }

    adoptAllValuesFromIKNode(node) {
        this.localMBasis.adoptValues(node.getLocalMBasis());
        this.globalMBasis.adoptValues(node.getGlobalMBasis());
        this.dirty = node.dirty;
        return this;
    }

    adoptGlobalValuesFromIKNode(node, updateLocal = true) {
        this.globalMBasis.adoptValues(node);
        if (this.parent != null && updateLocal) {
            this.parent.setTransformToLocalOf(this.globalMBasis, this.localMBasis);
        }
        return this;
    }

    adoptLocalValuesFromIKNode(node) {
        this.localMBasis.adoptValues(node.getLocalMBasis());
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
        return this.pool.new_Vec3().set(this.getGlobalMBasis().getOrigin());
    }

    getGlobalclone() {
        return new IKNode(this.getGlobalMBasis(), this.getParentAxes(), this.pool);
    }

    /**
     * Sets the parent of this node to the input node such that this node's global coordinates remain the same
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

        for (c of this.childNodes) ad.parentChangeCompletionNotice(this, oldParent, par, requestedBy);
        return this;
    }

    alignGlobalsTo(inputGlobalMBasis) {
        this.updateGlobal();
        if (this.getParentAxes() != null) {
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
        if (this.getParentAxes() != null) {
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

    rotateByLocal(apply) {
        this.getLocalMBasis().rotateBy(apply);
        this.markDirty();
        return this;
    }


    rotateByGlobal(apply) {
        this.updateGlobal();
        if (this.getParentAxes() != null) {
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

    /**
     * sets the given node as this node's parent such that this node's global values are likely to change
     * @param {IKNode} par 
     * @returns 
     */
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
        const result = input.clone();
        this.setToGlobalOf(input, result);
        return result;
    }

    setToGlobalOf(input, out) {
        this.updateGlobal();
        this.getGlobalMBasis().setToGlobalOf(input, out);
        return out;
    }


    setVecToLocalOf(input, out) {
        if (out == null) {
            out = input.clone();
        }
        this.updateGlobal();
        this.getGlobalMBasis().setVecToLocalOf(input, out);
        return out;
    }

    setTransformToLocalOf(input, out) {
        if (out == null) {
            out = input.clone();
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
    getLocalOf(input, storeIn = this.pool.any_Vec3()) {
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
            this.translateTo(translate.addClone(this.origin()));
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


    setLocalsToIdentity() {
        this.localMBasis.setToIdentity();
        this.markDirty();
        return this;
    }


    setGlobalsToIdentity() {
        this.getGlobalMBasis().setToIdentity();
        if (this.getParentAxes() != null) {
            this.setAsIfParent(this.getParentAxes());
        }
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
            for (let c of this.childNodes) c.markDirty();
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

    /**
     * @returns {IKNode} a copy of this node with likely the same global values, no parent, and likely different local values
     */
    freeGlobalClone() {
        const freeCopy = new IKNode(this.getGlobalMBasis(), null, undefined, this.pool);
        freeCopy.markDirty();
        freeCopy.updateGlobal();
        return freeCopy;
    }

    /**
     * @returns {IKNode} a copy of this node without a parent, the same local values, and likely different global values
     */
    freeClone() {
        const freeCopy = new IKNode(this.getLocalMBasis(), null, undefined, this.pool);
        freeCopy.getLocalMBasis().adoptValues(this.localMBasis);
        freeCopy.markDirty();
        freeCopy.updateGlobal();
        return freeCopy;
    }

    /**
     * @return {IKNode} a copy of this node which is attached to the same parent and has the same local / global values */
    attachedClone() {
        this.updateGlobal();
        const copy = new IKNode(null, this.getParentAxes(), undefined, this.pool);
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

    toCons(withString = false) {
        console.log("local\t global");
        let colStyles = IKTransform._getCompareStyles(this.getLocalMBasis(), this.getLocalMBasis());
        console.log(`${colStyles.string}`, ...colStyles.styles)
        if(withString)
        console.log(this.toString());
    }

    toHTMLDebug() {

    }

    compareLocal(node) {
        this.getLocalMBasis().compare(node.getLocalMBasis());
    }
    compareGlobal(node) {
        this.getGlobalMBasis().compare(node.getGlobalMBasis());
    }
    compare(node) {
        IKNode.compareWith(this, node);
    }

    /**visual comparison of two IKNode's local and global values*/
    static compareWith(node1, node2) {
        let builtLocal = IKTransform._getCompareStyles(node1.getLocalMBasis(), node2.getLocalMBasis());
        let builtGlobal = IKTransform._getCompareStyles(node1.getGlobalMBasis(), node2.getGlobalMBasis());
        console.log(`%c      Global: \n${builtGlobal.string}\n%c      Local: \n${builtLocal.string}`, '', ...builtGlobal.styles , '',...builtLocal.styles);
    }

    static obj3dToConsole(object3d) {
        let loc = IKTransform.newPooled(this.pool);
        loc.setFromObj3d(object3d);
        let glob = IKTransform.newPooled(this.pool);
        glob.setFromGlobalizedObj3d(object3d);

        const global = `Global: ${glob.toString()}\n`;
        const local = `Local: ${loc.toString()}`;
        let out = global + local;
        console.log(out);
    }

    getDebug = function() {
        const localPosition = this.getLocalMBasis().translate;
        const worldPosition = this.getGlobalMBasis().translate;
        const result = {
            localPos : localPosition,
            worldPos : worldPosition,
            name :  this.ikd
        }
        return result; 
    }

    toVis = function (doubleElem, range = 1, vert=null, horiz=null) {
        let debugObj = this.getDebug();
        window.toDebugColor(debugObj, doubleElem, range, vert, horiz);
        return groupedelem;
    };
}