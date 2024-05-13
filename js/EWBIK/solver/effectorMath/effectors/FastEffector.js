import { IKNode, ShadowNode } from "../../../EWBIK.js";
import { Effector } from "./Effector.js";

/**An effector implementation which is much faster for deeper hierarchies. 
 * Likely somewhat slower for shallow ones. Works by storing a copy of the tip bone in global space
 * and applying whatever rotation has been carried out during a bone's optimization optimization step
 * back onto the tip copy instead of traversing the hierarchy.
 * 
 * Needs to be manually notified at two crucial junctures
 * 1. whenever the underlying bone has been rotated (so the tip copy can be rotated acordingly)
 * 2. whenever an iteration has begun (so that the tip can be re-evaluated from scratch)
 * 
 * 
 * */
export class FastEffector extends Effector {

    /**@type {IKNode} simulates the tip */
    _cachedTipAxes = null;
    /**@type {ShadowNode} reference to transform of the current bone*/
    nodeContainer = null;
    forceGlobal = true;

    constructor(armatureEffectors, tip, target) {
        super(armatureEffectors, tip, target);
        this._cachedTipAxes = new IKNode(undefined, undefined, 'cached_tip_of-'+tip.simTipAxes.ikd, this.armatureEffectors.armature.volatilePool);
        this._cachedTipAxes.forceOrthoUniformity(true);
    }

    optimStep_Start(wboneRef, boneIdx) {
        if(boneIdx == 0 || this.forceGlobal) {
            /** if we're back to the starting bone it means all sorts of pullback logic probably happened and
            * somewhere in the code has already or is about to update the gobalspace hierarchy to the tip node, so updating the fake tip here is both necessary and free.
            * */
           this._cachedTipAxes.globalMBasis.approxAdoptValues(this._actualTipAxes.getGlobalMBasis());
           wboneRef.simLocalAxes.setTransformToLocalOf(this._cachedTipAxes.globalMBasis, this._cachedTipAxes.localMBasis);
           this._cachedTipAxes.dirty = false; //adoptAllValues sets markDirty, which is fine for notifying potential descendants but we undo it on this particular node because we want to just read straight the global values we just set.
           this.nodeContainer = wboneRef.simLocalAxes;
        } else if(wboneRef.simLocalAxes !== this.nodeContainer) {
            
            const nodeGlob = this.nodeContainer.getGlobalMBasis();//.setTransformToGlobalOf(this._cachedTipAxes.localMBasis, this._cachedTipAxes.globalMBasis);
            const cachedLoc = this._cachedTipAxes.localMBasis; 
            const wboneGlob = wboneRef.simLocalAxes.getGlobalMBasis();
            let cachedGlob_result = this._cachedTipAxes.globalMBasis;

            /**inlined orthonormal case of setTransformToGlobalOf */
            const l_db_scale = cachedLoc.scale.dataBuffer; 
            const l_scalebx = cachedLoc.scale.baseIdx;
            const l_db_trans = cachedLoc.translate.dataBuffer;
            const l_transbx = cachedLoc.translate.baseIdx;

            const w_db_trans = wboneGlob.translate.dataBuffer;
            const w_transbx = wboneGlob.translate.baseIdx;

            const o_db_scale = cachedGlob_result.scale.dataBuffer;
            const o_scalebx = cachedGlob_result.scale.baseIdx;
            const o_db_trans = cachedGlob_result.translate.dataBuffer;
            const o_transbx = cachedGlob_result.translate.baseIdx;


            nodeGlob.scale.compMultInto(cachedLoc.translate, cachedGlob_result.translate);
            nodeGlob.scale.compMultInto(cachedLoc.scale, cachedGlob_result.scale);//only works if orthoUniform, which WorkingBones should always be upon mimic()
            nodeGlob.rotation.applyAfter(cachedLoc.rotation, cachedGlob_result.rotation);
            nodeGlob.rotation.applyToVecArr(o_db_trans, o_transbx, o_db_trans, o_transbx);
            cachedGlob_result.translate.add(nodeGlob.translate);
            cachedGlob_result.mag.set(cachedGlob_result.scale).absComponents();
            const avgMag = cachedGlob_result.avgMag = cachedGlob_result.mag.sum()/3;
            cachedGlob_result.xNormDir = o_db_scale[o_scalebx] < 0 ? -1 : 1;
            cachedGlob_result.yNormDir = o_db_scale[o_scalebx+1] < 0 ? -1 : 1;
            cachedGlob_result.zNormDir = o_db_scale[o_scalebx+2] < 0 ? -1 : 1;
            o_db_scale[o_scalebx]  = avgMag * cachedGlob_result.xNormDir;
            o_db_scale[o_scalebx+1] = avgMag * cachedGlob_result.yNormDir;
            o_db_scale[o_scalebx+2] = avgMag * cachedGlob_result.zNormDir;
		    cachedGlob_result.lazyRefresh();

            /**inlined version of setTransformToLocalOf*/
            
            const wbInvRot = wboneGlob.inverseRotation;

            const sRecip = 1/wboneGlob.avgMag; //valid only if orthouniform
            cachedLoc.translate.set(cachedGlob_result.translate);
            cachedLoc.translate.sub(wboneGlob.translate); 

            l_db_trans[l_transbx] = o_db_trans[o_transbx] - w_db_trans[w_transbx];
            l_db_trans[l_transbx+1] = o_db_trans[o_transbx+1] - w_db_trans[w_transbx+1];
            l_db_trans[l_transbx+2] = o_db_trans[o_transbx+2] - w_db_trans[w_transbx+2];
            wbInvRot.applyToVecArr(l_db_trans, l_transbx, l_db_trans, l_transbx);
            l_db_trans[l_transbx] *= sRecip;
            l_db_trans[l_transbx+1] *= sRecip;
            l_db_trans[l_transbx+2] *= sRecip;
            wbInvRot.applyAfter(cachedGlob_result.rotation, cachedLoc.rotation);
                    
            l_db_scale[l_scalebx] = sRecip * o_db_scale[o_scalebx]; 
            l_db_scale[l_scalebx+1] = sRecip * o_db_scale[o_scalebx+1]; 
            l_db_scale[l_scalebx+2] = sRecip * o_db_scale[o_scalebx+2]; 

            cachedLoc.mag.setComponents(
                Math.abs(l_db_scale[l_scalebx]), Math.abs(l_db_scale[l_scalebx+1]), Math.abs(l_db_scale[l_scalebx+2])
            ).absComponents();
            cachedLoc.avgMag = cachedLoc.mag.sum()/3;
            const locavgMag = cachedLoc.avgMag;
            cachedLoc.xNormDir = l_db_scale[l_scalebx] < 0 ? -1 : 1;
            cachedLoc.yNormDir = l_db_scale[l_scalebx+1] < 0 ? -1 : 1;
            cachedLoc.zNormDir = l_db_scale[l_scalebx+2] < 0 ? -1 : 1;
            l_db_scale[l_scalebx]  = locavgMag * cachedLoc.xNormDir;
            l_db_scale[l_scalebx+1] = locavgMag * cachedLoc.yNormDir;
            l_db_scale[l_scalebx+2] = locavgMag * cachedLoc.zNormDir;
            cachedLoc.lazyRefresh();

            this._cachedTipAxes.markDirty();
            this._cachedTipAxes.dirty = false; //the markDirty line above this is for the sake of notifying any potential descendants, we undo it here because we want to just read straight from getGlobalMBasis
            this.nodeContainer = wboneRef.simLocalAxes;
        }
        this.forceGlobal = false;
    }

    iteration_Start() {
        this.forceGlobal = true;
    }

    get tipAxes() {
      return this._cachedTipAxes;
    }

    set tipAxes(val) {
        this._actualTipAxes = val;
    }
}