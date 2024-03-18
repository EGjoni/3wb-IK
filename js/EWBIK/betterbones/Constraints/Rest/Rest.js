const THREE = await import('three')
import { Bone , Object3D} from 'three';
import { Rot } from "../../../util/Rot.js";
import { NoPool, Vec3, any_Vec3} from "../../../util/vecs.js";
import { Ray } from "../../../util/Ray.js";
import { IKNode, TrackingNode } from "../../../util/nodes/IKNodes.js";
import { IKTransform } from '../../../util/nodes/IKTransform.js';
import { Constraint, Returnful } from '../Constraint.js';
/** 
 * Very simple constraint defining a rest pose a bone should prefer to be in. 
 * It is safe, fast, and easy to change the specified target rest pose whenever you wish without notifying the solver.
 * This may be helpful for animation retargeting, or for very quick and dirty rigging where you don't expect the IK targets to go anywhere
 * difficult to reach anyway.
*/
export class Rest extends Returnful {
    static totalRestConstraints = 0;
    /**@type {Bone} */
    painfulness = 0.5; 
    
    

    /**
     * @param {Bone} forBone the bone to apply this constraint to 
     * @param {(Object3D|IKNode)} restPose the ideal pose the bone should try to be in. This input pose is expected to be defined in the space of the bone's parent. This constraint will nudge the bone such that the transform returned by bone.getIKBoneOrientation()  aligns with this restPose. (Remember that the IKBoneOrientation of any bone doesn't necessarily have to align with the bone transform, as it is defined in the space of the bone transform. This means it's very easy to use this function when you are looking at the armature and want to just click a button to trigger the current pose as a rest pose, but considerably more annoying to use if you want to programmatically define a restpose in terms of what the current IKBoneOrientation is with respect to limitCones or other more complex directional constraints.)
     * the ewbIK solver will always try to reach the target, but this tells it that it should try to also keep near this region if it can.
     * @param {(Object3D|IKNode)} ikd optional unique string identifier
     * 
     * Note that the solver needs to run at least 2 iterations per solve in order for this to accomplish anything. And the more iterations the merrier
     */
    constructor(forBone, ikd='RestConstrain-'+(Rest.totalRestConstraints++), pool = noPool) {
        super(forBone, undefined, ikd, pool);
        /**@type {IKNode}*/
        this.boneFrameRest =new IKNode(null, null, undefined, this.pool); //inferred orientation of the boneframe which would be required for IKBoneOrientation to be align with the transform the user specified.
        this.restPose_three = null;
        if (this.forBone != null) {            
            //if(restPose != null)
             //   this.setRestPose(restPose);
           // else 
                this.setCurrentAsRest();
            if(this.forBone)
                this.forBone.springy = true;
        }
    }

    /**sets the rest pose of the bone this constraint is attatched as being whatever pose the bone is currently in
     * @return {Rest} this for chainning
    */
    setCurrentAsRest() {
        this.boneFrameRest.adoptLocalValuesFromObject3D(this.forBone);
        //let oldBoneFrameRest = this.boneFrameRest.freeclone();
        //this.boneFrameRest.adoptGlobalValuesFromObject3D(this.forBone.getIKBoneOrientation());//.setAsIfParent(IKNode.fromObj3dGlobal(this.forBone.parent));
        //let globalParent = this.tempNode1.reset().adoptGlobalValuesFromObject3D(this.forBone.parent);
        //this.boneFrameRest.setAsIfParent(globalParent);
        //this.setRestPose(newRest);
        return this;
    }
    

    getPreferenceRotation(currentState, currentBoneOrientation, previousState, previousBoneOrientation, iteration, calledBy, storeDiscomfort = false) {
        if(this.forBone.name == 'CC_Base_R_Upperarm') {
            console.log("----Sim : " + currentState.ikd+',  ---Rest: ' + this.boneFrameRest.ikd);
            currentState.getLocalMBasis().rotation.toConsole();
            this.boneFrameRest.getLocalMBasis().rotation.toConsole();
        }
        /**@type {Rot} */
        let targframe = this.boneFrameRest.getLocalMBasis().rotation;
        let inv_targFrame = this.boneFrameRest.getLocalMBasis().inverseRotation;

        /**@type {Rot} */
        let currRotFrame = currentState.getLocalMBasis().rotation;
        /**@type {Rot} */
        let inv_currRotFrame = currentState.getLocalMBasis().inverseRotation; //A
        /*if(this.qdot(locRotFrame, this.boneFrameRest.getLocalMBasis().rotation) < 0) {
            locRotFrame = locRotFrame.getFlipped();//.rotation.multiply(-1);
        }*/
        //currRotFrame.toConsole();
        //targframe.toConsole();
        let nA_B = inv_currRotFrame.applyAfter(targframe);  // C = (-A)*B
        let nB_A = inv_targFrame.applyAfter(currRotFrame);
        let B_nA = targframe.applyAfter(inv_currRotFrame);
        let A_nB = currRotFrame.applyAfter(inv_targFrame)
        let truepath = currRotFrame.getRotationTo(targframe);
        let rotBy = truepath;


        this.constraintResult.reset(iteration);
        this.constraintResult.fullRotation = rotBy;
        if(iteration < this.leewayCache.length) {
            rotBy.clampToCosHalfAngle(this.leewayCache[iteration]);
            this.constraintResult.clampedRotation = rotBy;
        } else {
            this.constraintResult.clampedRotation = Rot.IDENTITY;
        } 
        /*if(this.forBone.name == 'CC_Base_R_Upperarm') {
            console.log('setPainfulness: ' +this.getPainfulness());
            console.log('clamp: '+ this.leewayCache[iteration]);
            console.log("full   : "+this.constraintResult.fullRotation.toString());
            console.log("clamped: "+this.constraintResult.clampedRotation.toString())
        }*/


        
        //toSet.rotateBy(rotBy);
        return this.constraintResult;
    }

     /**
     * computes the raw unscaled discomfort associated with this historical value presuming pre-alleviation
     * @param {ConstraintResult} previousResult
     * @returns a number from 0 - 1, implying amount of pain
     * */
     _computePast_Pre_RawDiscomfortFor(previousResult) {
        return this.remainingPain(previousResult.fullRotation, Rot.IDENTITY);
     }
 
     /**
      * computes the raw unscaled discomfort associated with this historical value presuming post alleviation
      * @param {ConstraintResult} previousResult
      * @returns a number from 0 - 1, implying amount of pain
      * */
     _computePast_Post_RawDiscomfortFor(previousResult) {
        return this.remainingPain(previousResult.fullRotation, previousResult.clampedRotation);
     }
    
    remainingPain(A, B) {
        const painA = A.getAngle();
        const painB = B.getAngle();
        const remainingPain = Math.abs(painA - painB)/Math.PI;
        return remainingPain;
    }



    
    /**
     * @param {(Object3D|IKNode)} idealOrientIn_ParSpace 
     * @return {Rest} this for chainning
     */
    /**setRestPose(idealOrientIn_ParSpace) {
        let currentBoneFrame = Rest.tempNode1.reset();
        currentBoneFrame.adoptLocalValuesFromObject3D(this.forBone);
        let localFrameSpace = currentBoneFrame.getLocalMBasis().rotation;

        let idealOrient = this.asTempNode(idealOrientIn_ParSpace).getLocalMBasis().rotation; 
        
        let currentOrientIn_FrameSpace = Rest.tempNode3.reset().adoptLocalValuesFromObject3D(this.forBone.getIKBoneOrientation()).getLocalMBasis().rotation
        let currentOrientIn_ParSpace = Rot.IDENTITY.clone();
        localFrameSpace.applyAfter(currentOrientIn_FrameSpace, currentOrientIn_ParSpace);

        let currentToIdeal = currentOrientIn_ParSpace.getRotationTo(idealOrient);
        currentToIdeal.applyAfter(localFrameSpace, this.boneFrameRest.getLocalMBasis().rotation);
        this.boneFrameRest.markDirty();
        return this;
    }*/

    /**@type {IKNode}*/
    static tempNode1= new IKNode();
    /**@type {IKNode}*/
    static tempNode2= new IKNode();
    /**@type {IKNode}*/
    static tempNode3= new IKNode();
}