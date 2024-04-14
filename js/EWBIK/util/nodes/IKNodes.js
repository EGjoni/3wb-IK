import { Vec3 } from "./../vecs.js";
import { Rot } from "./../Rot.js";
import { IKTransform } from "./IKTransform.js";
const THREE = await import('three');
import { Quaternion, Vector3, Object3D, Matrix4 } from "three";
import { Saveable, Loader } from "../loader/saveable.js";



function lerp(start, end, t) {
    return (t * (end - start)) + start;
}

export class IKNode extends Saveable {
    static totalNodes = 0;
    static NORMAL = 0;
    static IGNORE = 1;
    static FORWARD = 2;
    static RIGHT = 1;
    static LEFT = -1;
    static X = 0;
    static Y = 1;
    static Z = 2;
    dirty = false;
    /** @type {IKTransform} */
    localMBasis = null;
    /** @type {IKTransform} */
    globalMBasis = null;
    /** @type {IKNode} */
    parent = null;
    areGlobal = true;
    forceOrthoNormality = true;
    static originthreevec = new Vector3(0, 0, 0);
    static identitythreequat = new Quaternion(0, 0, 0, 1);
    static unitthreescale = new Vector3(1, 1, 1);
    temp_originthreevec = new Vector3(0, 0, 0);
    temp_identitythreequat = new Quaternion(0, 0, 0, 1);
    temp_unitthreescale = new Vector3(1, 1, 1);
    childNodes = new Set();
    nodeDepth = 0;

    toJSON() {
        let result = super.toJSON();
        result.forceOrthoNormality = this.forceOrthoNormality;
        return result;
    }

    getRequiredRefs(){
        return {
            localMBasis: this.localMBasis,
            globalMBasis: this.globalMBasis,
            childNodes : [...this.childNodes],
            parent: this.parent,
        };
    }

    static fromJSON(json, loader, pool, scene) {     
        this.isLoading = true;   
        let result = new IKNode(undefined, undefined, json.ikd);
        return result; 
    }
    async postPop(json, loader, pool, scene)  {
        if(json.requires.localMBasis == null) 
            return this;
        let p = await Saveable.prepop(json.requires, loader, pool, scene);
        this.localMBasis = p.localMBasis;
        this.globalMBasis = p.globalMBasis;
        if(this.globalMBasis == null) this.areGlobal = true;
        for(let c of p.childNodes) {
            this.childNodes.add(c);
            c.areGlobal = false;
        }
        this.parent = p.parent;
        this.isLoading = false;
        return this;
    }

    constructor(globalMBasis, parent, ikd = 'IKNode-' + (IKNode.totalNodes++), pool = globalVecPool) {
        super(ikd, new.target.name, new.target.totalNodes, pool);
        if(!Saveable.loadMode) {
            if (globalMBasis == null) {
                this.localMBasis = IKTransform.newPooled(this.pool);
                this.globalMBasis = IKTransform.newPooled(this.pool);
            } else {
                this.localMBasis = globalMBasis.clone();
                this.globalMBasis = globalMBasis.clone();
            }
        
            this.dirty = true;
            this.workingVector = this.pool.new_Vec3();
            this.areGlobal = true;
            
            this.tag = ikd;
            if (parent != null && !Saveable.loadMode) {
                this.setParent(parent);
            } else {
                this.areGlobal = true;
            }
            this.markDirty();
            
            this.updateGlobal();
        }
    }

    /**
     * in place swaps the local and global transforms of the input nodes
     * Kind of dangerous to do for anything other than keeping a rolling history of states.
     * @param {IKNode} node1 
     * @param {IKNode} node2 
     */
    static swap(node1, node2) {
        let temptransform = node1.localMBasis;
        node1.localMBasis = node2.localMBasis;
        node2.localMBasis = temptransform;
        temptransform = node1.globalMBasis;
        node1.globalMBasis = node2.globalMBasis;
        node2.globalMBasis = temptransform;
        let dirtytemp = node1.dirty;
        node1.dirty = node2.dirty;
        node2.dirty = dirtytemp;
    }

    static fromObj3dGlobal(object3d) {
        let result = new IKNode(null, null, undefined, this.pool);
        result.adoptGlobalValuesFromObject3D(object3d);
        return result;
    }

    static fromObj3dLocal(object3d) {
        let result = new IKNode(null, null, undefined, this.pool);
        result.adoptLocalValuesFromObject3D(object3d);
        return result;
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

    /**updates the local values of this transform such that its worldspace values match
     * the worldspace values of the provided object 3d
     */
    adoptGlobalValuesFromObject3D(object3d, updateLocal = true) {
        
        this.localMBasis.setFromObj3d(object3d);
        this.globalMBasis.setFromGlobalizedObj3d(object3d, this.temp_originthreevec, this.temp_identitythreequat, this.temp_unitthreescale);
        if (this.parent != null && updateLocal) {
            this.parent.setTransformToLocalOf(this.globalMBasis, this.localMBasis);
        }
        this.markDirty();
        return this;
    }

    /**
     * 
     * @param {Object3D} object3d 
     * @returns 
     */
    adoptLocalValuesFromObject3D(object3d) {
        //TODO: figure out some way to determine if the Matrix actually needs updating before calling updateMatrix()
        object3d.updateMatrix();
        this.localMBasis.setFromObj3d(object3d);
        this.markDirty();
        return this;
    }


    adoptAllValuesFromIKNode(node) {
        this.getLocalMBasis().adoptValues(node.getLocalMBasis());
        this.getGlobalMBasis().adoptValues(node.getGlobalMBasis());
        this.markDirty();
        return this;
    }

    adoptGlobalValuesFromIKNode(node, updateLocal = true) {
        return this.adoptGlobalValuesFromIKTransform(node.getGlobalMBasis(), update);
    }

    adoptGlobalValuesFromIKTransform(transform, updateLocal = true) {
        this.globalMBasis.adoptValues(transform);
        if (this.parent != null && updateLocal) {
            this.parent.setTransformToLocalOf(transform, this.localMBasis);
        }
        this.markDirty();
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


    origin(storeIn) {
        this.updateGlobal();
        return this.getGlobalMBasis().origin(storeIn);
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

            if (oldParent != null) oldParent._disown(this);
            par.addChild(this);
        } else {
            if (oldParent != null) oldParent._disown(this);
        }
        //this.markDirty(); handled by addChild
        
        return this;
    }

    /**
     * registers the given node as a child of this one.
     * @param {IKNode} node 
     * @param {Number} safetyCheck 4 by default. traverses rootwards the given number of nodes to try to make sure the resulting graph has no loops.
     */
    addChild(node, safetyCheck = 4) {
        let current = this;
        while(safetyCheck > 0) {
            if(current == node) {
                throw new Error("A node cannot be its own ancestor");
            }
            if(current.parent == null) 
                break;
            safetyCheck--;
        }
        this.childNodes.add(node);
        node.nodeDepth = this.nodeDepth+1;
        node.parent = this;
        node.areGlobal = false;
        node.markDirty();
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


    /**
     * Updates the local orientation of this IKNode to what it would need to be in order to match the effect
     * of applying the provided rotation in world space.
     * 
     * NOT SAFE FOR CHAINING!, this method does not return this IKNode, it returns a rotation.
     * 
     * @param {Rot} apply the rotation to apply
     * @returns the local space version of the rotation that was applied. (such that the inverse of the returned rotation would set the transform back to its original global space orientation)
     */
    rotateByGlobal(apply, storeIn=new Rot(1,0,0,0)) {
        this.updateGlobal();
        let result = apply;
        if (this.getParentAxes() != null) {
            result = this.getParentAxes().getGlobalMBasis().getLocalOfRotation(apply, storeIn); 
            this.getLocalMBasis().rotateBy(result);
        } else {
            this.getLocalMBasis().rotateBy(apply);   
        }

        this.markDirty();
        return result;
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
        if (par != null && par != this.parent && this.getParentAxes() != null) {
            this.getParentAxes()._disown(this);
            par.addChild(this);
        } else if(par != null) par.addChild(this);
        return this;
    }

    needsUpdate() {
        if (this.dirty) return true;
        else return false;
    }

    getGlobalOfVec(input) {
        const result = input.clone();
        this.setVecToGlobalOf(input, result);
        return result;
    }

    setVecToGlobalOf(input, out) {
        this.updateGlobal();
        this.getGlobalMBasis().setVecToGlobalOf(input, out);
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
            this.translateTo(this.origin().add(translate));
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
        }
        return this;
    }

    _disown(child) {
        this.childNodes.delete(child);
        child.parent = null;
        child.areGlobal = true;
        child.markDirty();
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
            this.globalMBasis.lazyRefresh();
            for (let c of this.childNodes) c.markDirty();
        }
        return this;
    }

    _exclusiveMarkDirty() {
        this.dirty = true;
        this.globalMBasis.lazyRefresh();
    }

    setToXHeading(vec) {
        if(this.dirty) this.updateGlobal();
        return this.globalMBasis.setToXHeading(vec);
    }
    setToYHeading(vec) {
        if(this.dirty) this.updateGlobal();
        return this.globalMBasis.setToYHeading(vec);
    }
    setToZHeading(vec) {
        if(this.dirty) this.updateGlobal();
        return this.globalMBasis.setToZHeading(vec);
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
            this.getGlobalMBasis().origin().equals(ax.origin_)
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

    toString(withlocal = true, withglobal = true, withLabel = true) {
        this.updateGlobal();
        const global = `${withLabel?'Global: ': ''} ${this.getGlobalMBasis().toString()}\n`;
        const local = `${withLabel?'Lcal: ': ''} ${this.getLocalMBasis().toString()}`;
        return withglobal? global :'' + withlocal?local:'';
    }

    toConsole(withString = true) {
        console.group(this.ikd +' Node: ');
            console.group('global: ');
                console.log(this.toString(false, true, false)),
            console.groupEnd('global: ');
            console.group('local: ');
                console.log(this.toString(true, false, false))
            console.groupEnd('local: ');
        console.groupEnd(this.ikd +' Node: ');
        //return this.toCons(withString);
    }

    toPretty(withString = true) {
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

    /**
     * @param {[IKNode]} nodelist
     * @return returns the node which is the most recent common ancestor of the provided input nodes
     */
    static getCommonAncestor(nodelist, shallowest = 99999) {
        for(let n of nodelist) {
            shallowest = Math.min(shallowest, n.nodeDepth);
        }
        for(let i =0; i<nodelist.length; i++) {
            while(nodelist[i].nodeDepth > shallowest) 
                nodelist[i] = nodelist[i].parent
        }
        let common = nodelist[0];
        let isCommon = true;
        for(let n of nodelist) {
            if(n != common) {
                isCommon = false;
                break;
            }
        }
        if(!isCommon) {
            for(let i =0; i<nodelist.length; i++) {
                    nodelist[i] = nodelist[i].parent
            }
            return IKNode.getCommonAncestor(nodelist, shallowest-1);
        }
        else return common;
    }

    /**visual comparison of two IKNode's local and global values*/
    static compareWith(node1, node2) {
        let builtLocal = IKTransform._getCompareStyles(node1.getLocalMBasis(), node2.getLocalMBasis());
        let builtGlobal = IKTransform._getCompareStyles(node1.getGlobalMBasis(), node2.getGlobalMBasis());
        console.log(`%c      Global: \n${builtGlobal.string}\n%c      Local: \n${builtLocal.string}`, '', ...builtGlobal.styles , '',...builtLocal.styles);
    }

    static obj3dToConsole(object3d) {        
        console.group(object3d.name +' transform');
            console.group('global: ');
                console.log(IKNode.obj3dToString(object3d, false, true)),
            console.groupEnd('global: ');
            console.group('local: ');
                console.log(IKNode.obj3dToString(object3d, true, false))
            console.groupEnd('local: ');
        console.groupEnd(object3d.name +' transform');
    }

    static obj3dToString(object3d, withlocal=true, withglobal=true) {
        let loc = IKTransform.newPooled(this.pool);
        loc.setFromObj3d(object3d);
        let glob = IKTransform.newPooled(this.pool);
        glob.setFromGlobalizedObj3d(object3d);

        const global = `${glob.toString()}`;
        const local = `${loc.toString()}`;
        let out = withglobal ? global : '' + withlocal ? local : '';
        return out;
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

/**
 * like IKNode, but always returns values corresponding to the provided three.js Object3d
 */
export class TrackingNode extends IKNode {
    static totalTrackingNodes = 0;
    /**@type {Object3D} */
    _toTrack = null;

    static async fromJSON(json, loader, pool, scene) {
        let result = new TrackingNode(loader.findSceneObject(json.requires.toTrack, scene), json.ikd);
        result.globalMBasis = new IKTransform();
        result.localMBasis = new IKTransform();
        return result;
    }

    toJSON() {
        let result = super.toJSON();
        return result; 
    }
    getRequiredRefs() {
        let result = super.getRequiredRefs(); 
        result._toTrack = this._toTrack; 
        return result;
    }
    async postPop(json, loader, pool, scene)  {
        let p = await Saveable.prepop(json.requires, loader, pool, scene);
        await super.postPop(json, loader, pool, scene);
        if (this.toTrack != null)
            this.adoptLocalValuesFromObject3D(this.toTrack);
        return this;
    }

    /**
     * 
     * @param {Object3D} toTrack 
     */
    constructor(toTrack, ikd = 'TrackingNode-' + (TrackingNode.totalNodes++), forceOrthoNormality = true, pool = globalVecPool) {
        super(undefined, undefined, ikd, pool);
        this.toTrack = toTrack;
        
        if (this.toTrack?.scale.x != 1 || this.toTrack?.scale.y != 1 || this.toTrack?.scale.z != 1)
            this.forceOrthoNormality = false
            //this.toTrack.matrixWorldAutoUpdate = false;
        if(!Saveable.loadMode) {
            if (this.toTrack != null)
                this.adoptLocalValuesFromObject3D(this.toTrack);
            this.markDirty();
        }
        //this.updateGlobal();
    }

    /**
     * 
     * @param {IKNode} par 
     * @param {Object} requestedBy 
     */
    setParent(par, requestedBy = undefined) {
        this.updateGlobal();
        const oldParent = this.getParentAxes();

        if (par != null && par != this.parent) {
            par.updateGlobal();
            if (par instanceof TrackingNode && par.toTrack != null && this.toTrack != null) {
                par.toTrack.attach(this.toTrack);
                this.adoptGlobalValuesFromObject3D(this.toTrack, false);
            }
            par.getGlobalMBasis().setTransformToLocalOf(this.globalMBasis, this.localMBasis);

            if (oldParent != null) oldParent._disown(this);
            par.addChild(this);
            this.areGlobal = false;
        } else if (par != this.parent || par == this) { //let's treat any attempt to set something as its own parent as an attempt to out and see the worldspace
            if (oldParent != null) oldParent._disown(this);
            this.areGlobal = true;
        }

        return this;
    }

    /*updateGlobal(force = false) {
        const was_dirty = this.dirty;
        super.updateGlobal();
        if (this.toTrack != null) {
            if ((this.parent == null) || this.toTrack.parent == this.parent?.toTrack) {
                this.updateTrackedFrom_Local();
                if (was_dirty) this.toTrack.updateWorldMatrix();
            } else {
                this.updateTrackedFrom_Global(was_dirty, false);
            }
            //this.adoptLocalValuesFromObject3D(this.toTrack);
            //this.adoptGlobalValuesFromObject3D(this.toTrack);
            //this.dirty = false;
        }
    }*/

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
    updateTrackedFrom_Local() {
        TrackingNode.transferLocalToObj3d(this.localMBasis, this.toTrack);
    }

    updateTrackedFrom_Global(update_world, updateSelf = true) {
        if (updateSelf)
            this.updateGlobal();
        else {
            this.sendTrackedToGlobal(this.globalMBasis);
        }
    }

    /**modifies the local coordinates of the tracked object so that they result in the provided @param {(Object3D | IKNode | IKTransform)} globalCoordinates*/
    sendTrackedToGlobal(newGlobal) {
        let A = newGlobal;
        let worldMatrixA = null;
        if (A instanceof IKNode || A instanceof IKTransform) {
            let globalMBasis = newGlobal;
            if (A instanceof IKNode) {
                globalMBasis = newGlobal.globalMBasis;
            }
            worldMatrixA = new THREE.Matrix4();
            const gmbrot = globalMBasis.rotation;
            
            worldMatrixA.compose(globalMBasis.translate,
                //new Quaternion(gmbrot.x, gmbrot.y, gmbrot.z, gmbrot.w); //jpl
                new Quaternion(
                    -gmbrot.x,
                    -gmbrot.y,
                    -gmbrot.z,
                    gmbrot.w
                ), // hamilton to jpl
                globalMBasis.scale);
        }
        else if (A instanceof THREE.Object3D) {
            worldMatrixA = A.matrixWorld;
        }
        let localMatrixB = new THREE.Matrix4();

        if (this.toTrack.parent) {
            const parentInverseWorldMatrix = new THREE.Matrix4().copy(this.toTrack.parent.matrixWorld).invert();
            localMatrixB.multiplyMatrices(parentInverseWorldMatrix, worldMatrixA);
        } else {
            localMatrixB.copy(worldMatrixA);
        }
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        localMatrixB.decompose(position, quaternion, scale);

        this.toTrack.position.copy(position);
        this.toTrack.quaternion.copy(quaternion);
        this.toTrack.scale.copy(scale);
        this.toTrack.updateMatrix();
        //}
    }

    static transferLocalToObj3d(localMBasis, obj3d) {
        obj3d.position.x = localMBasis.translate.x;
        obj3d.position.y = localMBasis.translate.y;
        obj3d.position.z = localMBasis.translate.z;

        obj3d.scale.x = localMBasis.scale.x;
        obj3d.scale.y = localMBasis.scale.y;
        obj3d.scale.z = localMBasis.scale.z;

        obj3d.quaternion.x = -localMBasis.rotation.x;
        obj3d.quaternion.y = -localMBasis.rotation.y;
        obj3d.quaternion.z = -localMBasis.rotation.z;
        obj3d.quaternion.w = localMBasis.rotation.w; //hamilton to jpl
    }
}