const THREE = await import('three')
import { Bone , Object3D} from 'three';
import { Rot } from "../../../util/Rot.js";
import { NoPool, Vec3, any_Vec3} from "../../../util/vecs.js";
import { Ray } from "../../../util/Ray.js";
import { IKNode, TrackingNode } from "../../../util/IKNodes.js";
import { IKTransform } from '../../../util/IKTransform.js';
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
    painfulness = 0.8; 
    
    

    /**
     * @param {Bone} forBone the bone to apply this constraint to 
     * @param {(Object3D|IKNode)} restPose the ideal pose the bone should try to be in. This input pose is expected to be defined in the space of the bone's parent. This constraint will nudge the bone such that the transform returned by bone.getIKBoneOrientation() aligns with this restPose.
     * the ewbIK solver will always try to reach the target, but this tells it that it should try to also keep near this region if it can.
     * @param {(Object3D|IKNode)} ikd optional unique string identifier
     * 
     * Note that the solver needs to run at least 2 iterations per solve in order for this to accomplish anything. And the more iterations the merrier
     */
    constructor(forBone, restPose, ikd='RestConstrain-'+(Rest.totalRestConstraints++), pool = noPool) {
        super(forBone, restPose, ikd, pool);
        /**@type {IKNode}*/
        this.boneFrameRest =new IKNode(null, null, undefined, this.pool); //inferred orientation of the boneframe which would be required for IKBoneOrientation to be align with the transform the user specified.
        this.restPose_three = null;
        if (this.forBone != null) {            
            if(restPose != null)
            this.setRestPose(restPose);
            else 
                this.setCurrentAsRest();
            if(this.forBone)
                this.forBone.springy = true;
        }
    }

    /**sets the rest pose of the bone this constraint is attatched as being whatever pose the bone is currently in
     * @return {Rest} this for chainning
    */
    setCurrentAsRest() {
        let wScale = this.forBone.parentArmature.wScale;
        let newRest = IKNode.fromObj3dGlobal(this.forBone.getIKBoneOrientation(), wScale).setRelativeTo(IKNode.fromObj3dGlobal(this.forBone.parent, wScale));
        this.setRestPose(newRest);
        return this;
    }
    
    /**
     * @param {(Object3D|IKNode)} idealOrientIn_ParSpace 
     * @return {Rest} this for chainning
     */
    setRestPose(idealOrientIn_ParSpace) {
        let wScale = this.forBone.parentArmature.wScale;
        let currentBoneFrame = Rest.tempNode1.reset();
        currentBoneFrame.adoptLocalValuesFromObject3D(this.forBone, wScale);
        let localFrameSpace = currentBoneFrame.getLocalMBasis().rotation;

        let idealOrient = this.asTempNode(idealOrientIn_ParSpace).getLocalMBasis().rotation; 
        
        let currentOrientIn_FrameSpace = Rest.tempNode3.reset().adoptLocalValuesFromObject3D(this.forBone.getIKBoneOrientation(), wScale).getLocalMBasis().rotation
        let currentOrientIn_ParSpace = new Rot();
        localFrameSpace.applyToRot(currentOrientIn_FrameSpace, currentOrientIn_ParSpace);

        let currentToIdeal = currentOrientIn_ParSpace.applyInverseTo(idealOrient, new Rot());
        currentToIdeal.applyToRot(localFrameSpace, this.boneFrameRest.getLocalMBasis().rotation);
        this.boneFrameRest.markDirty();
        return this;
    }

    getPreferenceRotation(currentState, currentBoneOrientation, previousState, previousBoneOrientation, iteration, calledBy, storeDiscomfort = false) {
        if(this.forBone.name == 'CC_Base_R_Upperarm') {
            console.log("----Sim : " + currentState.ikd+',  ---Rest: ' + this.boneFrameRest.ikd);
            currentState.getLocalMBasis().rotation.toConsole();
            this.boneFrameRest.getLocalMBasis().rotation.toConsole();
        }
        /**@type {Rot} */
        let locRotFrame = currentState.getLocalMBasis().inverseRotation; //A
        /*if(this.qdot(locRotFrame, this.boneFrameRest.getLocalMBasis().rotation) < 0) {
            locRotFrame = locRotFrame.getFlipped();//.rotation.multiply(-1);
        }*/
        let rotBy = locRotFrame.applyToRot(this.boneFrameRest.getLocalMBasis().rotation);  // C = (-A)*B
        this.constraintResult.reset(iteration);
        this.constraintResult.fullRotation = rotBy;
        if(iteration < this.leewayCache.length) {
            rotBy.rotation.clampToQuadranceAngle(this.leewayCache[iteration]);
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

    qdot(a, b) {
        return a.q0 * b.q0 + a.q1 * b.q1 + a.q2 * b.q2 + a.q3 * b.q3;
    }
    
    angToIdentity(q) {
        const dot = this.qdot(q, Rot.IDENTITY);
        const clampedDot = Math.min(Math.max(dot, -1), 1);
        const angleRadians = 2 * Math.acos(clampedDot);
        return angleRadians;
    }
    
    remainingPain(A, B) {
        const painA = this.angToIdentity(A);
        const painB = this.angToIdentity(B);
        const remainingPain = Math.abs(painA - painB)/Math.PI;
        return remainingPain;
    }



    /**@type {IKNode}*/
    static tempNode1= new IKNode();
    /**@type {IKNode}*/
    static tempNode2= new IKNode();
    /**@type {IKNode}*/
    static tempNode3= new IKNode();
}