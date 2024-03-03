const THREE = await import('three')
import { Bone , Object3D} from 'three';
import { Rot } from "../../../util/Rot.js";
import { Vec3, any_Vec3, new_Vec3 } from "../../../util/vecs.js";
import { Ray } from "../../../util/Ray.js";
import { IKNode, TrackingNode } from "../../../util/IKNodes.js";
import { IKTransform } from '../../../util/IKTransform.js';
import { Constraint } from '../Constraint.js';
/** 
 * Very simple constraint defining a rest pose a bone should prefer to be in. 
 * It is safe, fast, and easy to change the specified target rest pose whenever you wish without notifying the solver.
 * This may be helpful for animation retargeting, or for very quick and dirty rigging where you don't expect the IK targets to go anywhere
 * difficult to reach anyway.
*/
export class Rest extends Constraint {
    static totalRestConstraints = 0;
    /**@type {Bone} */
    forBone = null;
    painfulness = 0.5; 
    
    /**@type {IKNode}*/
    boneFrameRest = new IKNode(); //inferred orientation of the boneframe which would be required for IKBoneOrientation to be align with the transform the user specified.

    /**
     * @param {Bone} forBone the bone to apply this constraint to 
     * @param {(Object3D|IKNode)} restPose the ideal pose the bone should try to be in. This input pose is expected to be defined in the space of the bone's parent. This constraint will nudge the bone such that the transform returned by bone.getIKBoneOrientation() aligns with this restPose.
     * the ewbIK solver will always try to reach the target, but this tells it that it should try to also keep near this region if it can.
     * @param {(Object3D|IKNode)} ikd optional unique string identifier
     * 
     * Note that the solver needs to run at least 2 iterations per solve in order for this to accomplish anything. And the more iterations the merrier
     */
    constructor(forBone, restPose, ikd='RestConstrain-'+(Rest.totalRestConstraints++)) {
        super(null, ikd);
        
        this.restPose_three = null;
        if (forBone) {            
            this._attachToBone(forBone, restPose);
        }
    }

    swingOrientationAxes() {
        return this.swingAxes;
    }

    
    _attachToBone(forBone, restPose) {
        this.forBone = forBone;
        if(restPose != null)
            this.setRestPose(restPose);
        else 
            this.setCurrentAsRest();
        this.forBone.setConstraint(this); 
        this.forBone.springy = true;
        this.swingAxes = new IKNode(); //forBone
        this.swingAxes.adoptLocalValuesFromObject3D(this.forBone);
        //this.enable();
    }

    /**sets the rest pose of the bone this constraint is attatched as being whatever pose the bone is currently in*/
    setCurrentAsRest() {
        let newRest = IKNode.fromObj3dGlobal(this.forBone.getIKBoneOrientation()).setRelativeTo(IKNode.fromObj3dGlobal(this.forBone.parent));
        this.setRestPose(newRest);
    }
    
    /**
     * @param {(Object3D|IKNode)} idealOrientIn_ParSpace 
     */
    setRestPose(idealOrientIn_ParSpace) {
        let currentBoneFrame = Rest.tempNode1;
        currentBoneFrame.adoptLocalValuesFromObject3D(this.forBone);
        let localFrameSpace = currentBoneFrame.getLocalMBasis().rotation;

        let idealOrient = this.asNode(idealOrientIn_ParSpace).getLocalMBasis().rotation; 
        
        let currentOrientIn_FrameSpace = Rest.tempNode3.adoptLocalValuesFromObject3D(this.forBone.getIKBoneOrientation()).getLocalMBasis().rotation
        let currentOrientIn_ParSpace = new Rot();
        localFrameSpace.applyToRot(currentOrientIn_FrameSpace, currentOrientIn_ParSpace);


        let currentToIdeal = currentOrientIn_ParSpace.applyInverseTo(idealOrient, new Rot());
        currentToIdeal.applyToRot(localFrameSpace, this.boneFrameRest.getLocalMBasis().rotation);
        this.boneFrameRest.markDirty();
    }

    


    setAxesToReturnfulled(toSet, currentOrientation, swingAxes, twistAxes, cosHalfReturnfullness, angleReturnfullness) {
        let locRotFrame = toSet.getLocalMBasis().rotation; //A
        let rotBy = locRotFrame.applyInverseTo(this.boneFrameRest.getLocalMBasis().rotation);  // C = (-A)*B
        rotBy.rotation.clampToQuadranceAngle(cosHalfReturnfullness);
        toSet.rotateBy(rotBy);
    }

    setAxesToSnapped() {
        return;
    }

    /**
     * returns the input given if it's an IKNode. Otherwise, returns an equivalent IKNode of the input
     * @param {{Object3D | IKNode}} maybeNotNode 
     */
    asNode(maybeNotNode) {
        let result = null;
        if(maybeNotNode instanceof Object3D) {  
            result = Rest.tempNode2;
            result.adoptLocalValuesFromObject3D(maybeNotNode);
            result.markDirty();
        } else if (maybeNotNode instanceof IKNode) {
            result = maybeNotNode
        } else {
            throw new Error("Input must be specifiied as either an Object3D or IKNode in the space of the parent bone");
        }
        return result;
    }


    /**@type {IKNode}*/
    static tempNode1= new IKNode();
    /**@type {IKNode}*/
    static tempNode2= new IKNode();
    /**@type {IKNode}*/
    static tempNode3= new IKNode();
    /**@type {IKNode}*/
    tempNode_orientBase = new IKNode(null, this.identity);
    /**@type {IKNode}*/
    tempNode_frameChild = new IKNode(null, this.tempNode_orientBase);
    /**@type {IKNode}*/
    tempNode_orientChild = new IKNode(null, this.tempNode_frameChild);
}


