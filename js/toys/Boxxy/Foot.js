import { IKPin } from "../../EWBIK/betterbones/IKpin.js";
import { StateMachine, State } from "./StateNode.js";
import { Vec3, any_Vec3, any_Vec3fv} from "../../EWBIK/util/vecs.js";
import { Ray } from "../../EWBIK/util/Ray.js";
import { IKTransform } from "../../EWBIK/util/nodes/IKTransform.js";
import { IKNode } from "../../EWBIK/util/nodes/IKNodes.js";
import { ShadowNode } from "../../EWBIK/util/nodes/ShadowNode.js";
const THREE = await import("three");
import {Rot} from "../../EWBIK/util/Rot.js";
import {Boxxy, ProjectionsObj, Proposal } from "./Boxxy.js";
import { Interpolator } from "../../EWBIK/util/nodes/Interpolator.js";

export class Foot {

    footProjArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0,-1,0),
        1);
    footgeometry = new THREE.BoxGeometry(0.05, 0.05, 0.15);
    predictiongeometry = new THREE.BoxGeometry(0.05, 0.025, 0.15);
    startgeometry = new THREE.BoxGeometry(0.05, 0.025, 0.15);
    unplantedCol = 0xaaaa00;
    plantedCol = 0xff0000;
    plantedmaterial = new THREE.MeshLambertMaterial({ color: this.plantedCol});
    //unplantedmaterial = new THREE.MeshLambertMaterial({ color: this.unplantedCol}); 
    goalmaterial = new THREE.MeshBasicMaterial({color:0x00ff00});
    startmaterial = new THREE.MeshBasicMaterial({color:0x0022ff});
    foot = new THREE.Mesh(this.footgeometry, this.plantedmaterial);
    goal = new THREE.Object3D();
    goalmesh = new THREE.Mesh(this.predictiongeometry, this.goalmaterial);
    start = new THREE.Mesh(this.startgeometry, this.startmaterial);
    lineGeometry = new THREE.BufferGeometry();
    lineMaterial = new THREE.LineBasicMaterial({ color: 0x008888 });
    closestToGravityHipDir = null;
    hipOnInterfootProjPlane = null; 
    otherFootPos = null;
    thisFootPos = null;
    future_hipPos = null;
    moveProposal = null;
    /**@type {IKTransform} internal transform used for computing candidate rebalance results*/
    rebalanceTransform = null;
    

    /**@type {Interpolator} */
    interpoler = null; 

    /**@type {IKTransform}*/
    startTransform = null;
    
    otherFoot = null;
    hips = null;
    isPlanted = true;

    footNode = null;
    /**@type {ShadowNode} */
    goalNode = null;

    projectionObj = null;

    constructor(otherFoot, hips, footPosition, attachpoint, isPlanted=true) {
        this.otherFoot = otherFoot;
        this.hips = hips;
        this.pool = this.hips.pool;
        this.initPooledVecs();
        this.isPlanted = isPlanted;
        this.foot.position.x = footPosition.x;
        this.foot.position.y = footPosition.y;
        this.foot.position.z = footPosition.z;
        this.foot.visible = false;
        
        this.thisFootPos.set(footPosition);
        this.foot.updateMatrix();
        this.goal.add(this.goalmesh);
        this.goal.position.copy(this.foot.position);
        this.goalmesh.position.y -= 0.01;
        let hipPos = this.hips.hips.position;//.origin();
        this.attachpoint = this.pool.new_Vec3(attachpoint.x, attachpoint.y, attachpoint.z)
        this.attachHeading = this.pool.new_Vec3(0,0,0);
        this.attachHeading.set(this.attachpoint).sub(this.tempv.readFromTHREE(hipPos)).normalize();
        this.lineGeometry.setFromPoints([
            new THREE.Vector3(
                hipPos.x+this.attachpoint.x, 
                hipPos.y+this.attachpoint.x, 
                hipPos.y+this.attachpoint.z),
            new THREE.Vector3(this.foot.position.x, this.foot.position.y, this.foot.position.z)
        ]);
        this.legline = new THREE.Mesh(this.lineGeometry, this.lineMaterial);
        this.legline.name = "leg line";
        this.goal.visible = false;
        this.start.visible = false; 
        this.foot.visible = false;
        this.showGoal = false;
        
    } 

    initPooledVecs() {
        this.startTransform =  IKTransform.newPooled(this.pool);
        this.tempv = this.pool.new_Vec3(0,0,0);
        this.tempYVec = this.pool.new_Vec3(0,1,0);
        this.tempZVec = this.pool.new_Vec3(0,0,1);
        this.thisFootPos = this.pool.new_Vec3(0,0,0);
        this.otherFootPos = this.pool.new_Vec3(0,0,0);
        
        this.projectionObj = new ProjectionsObj(
            this.thisFootPos, 
            this.otherFootPos,
            this.hips.hipPos,
            this.pool
        );
        let proj = this.projectionObj; 
        this.future_hipPos = proj.future_hipPos;
        this.future_hipPos_proj = proj.future_hipPos_proj; 
        this.closestToGravityHipDir = proj.closestToGravityHipDir;
        this.hipOnInterfootProjPlane = proj.hipOnInterfootProjPlane;         
        this.thisGroundProjectedFootPos = proj.firstFootVec_proj;
        this.thisGroundProjectedFootNormal = proj.firstFootVec_norm;        
        this.otherProjectedFootPos = proj.otherFootVec_proj;
        this.moveProposal = new Proposal(this.pool);
        this.rebalanceTransform = IKTransform.newPooled(this.pool);
    }
    /**the position the foot would like to be in when standing idle */
    setattachpoint(pos) {
        this.attachpoint.setComponents(pos.x, pos.y, pos.z);
    }

    getRestDeviation() {
        return this.footNode.origin().dist(this.attachpoint.addClone(this.hips.hipOnInterfootProjPlane));
    }

    getHipDistance() {
        return this.footNode.origin().dist(this.hips.hipsNode.origin());
    }

    /**Should only be called when both feet are planted.
     * Asks this foot what it would accompish if it were allowed to leave the ground,
     * foot will respond with a proposal object the hips to evaluate.
     */
    getUnplantProposal() {

    }

    

    /**updates the proposal for this foot.
     * the proposal is an object containing the following properties:
     * {
     * launch_transform: IKTransform, //indicates the starting position/orientation the foot launched from,
     * current_foot_transform: IKTransform, //indicates the current position/orientation of the foot. 
     * //the two variables above should always be identical if one foot is always on the ground
     * mid_stride: bool, //currently always false, but if true is ever supported, current foot position and launch position will differ 
     * proposed_foot_transform: IKTransform; //indicates the proposed position/orientation of the foot
     * expected_discomfort: float, //indicates the expected comfort of the armature should the proposal be adopted
     * fatigue: int, //indicating the number of times this foot has been lifted.
     * presumed_clearance_point: Vec3 //probably not used by feet, but other proposals make use of this to score hip clearance
     * presumed_hip_transform: IKtransform, same situation as above
     * }
    */
    generateProposal(byTime) {
        this.projectionObj.hipsProjDirty = true; this.footProjDirty = true;
        this.moveProposal.reset().unlock();
        this.moveProposal.launch_transform.adoptValues(this.startTransform);
        this.moveProposal.current_foot_transform.adoptValues(this.startTransform);
        this.moveProposal.mid_stride = false;
        this.moveProposal.proposed_foot_transform.adoptValues(this.getRebalanceTransform(byTime));
        this.moveProposal.presumed_hip_transform.adoptValues(this.hips.hipsNode.getGlobalMBasis());
        this.tempv.set(this.hipOnInterfootProjPlane).add(this.hips.hipClearanceDir);
        this.moveProposal.presumed_hip_transform.translateTo(this.tempv);
        this.moveProposal.presumed_clearance_point.set(this.hipOnInterfootProjPlane);
        let expected_discomfort = this.hips.penalizeProposalByHipAndFoot(
                                    this.moveProposal.lock(), 
                                    this.moveProposal.proposed_foot_transform.origin(), this.otherFootPos);
        this.moveProposal.unlock().expected_discomfort = expected_discomfort;
        return this.moveProposal.lock();
    }

    unPlant(stepDuration) {
        this.isPlanted = false;
        this.currentStepDuration = stepDuration;
        let projInfo = this.hips.projectToGround(this.hipToFoot.p2, this.hipToFoot.p2);
        let normal = projInfo.normal;

        this.moveProposal.unlock().mid_stride = true;
        this.moveProposal.fatigue = Math.max(this.moveProposal.fatigue, this.otherFoot.moveProposal.fatigue);
        this.moveProposal.fatigue++;
        this.moveProposal.lock();
        this.tweakGoalForBalance();
        this.interpoler.setGoal(this.goalNode.getGlobalMBasis(),(...p)=> this.update(...p), (...p)=> this.plant(...p));
        this.interpoler.begin(stepDuration);
        this.unplantTime = this.interpoler.startTime;
        this.foot.material.color.set(this.unplantedCol);
    }

    toBalance() {        
        if(this.isPlanted) 
            return;
        else {
            this.tweakGoalForBalance();
            this.interpoler.tick();
            this.update();
        }
    }

    toComfort() {
        if(this.isPlanted) 
            return;
        else {
            this.tweakGoalForComfort();
            this.interpoler.tick();
            this.update();
        }
    }


    otherToCenter = new Ray(any_Vec3(), any_Vec3());
    hipToFoot = new Ray(any_Vec3(), any_Vec3());
    tweakGoalForBalance() {
        //debugger;
        let framesRemaining = this.interpoler.getRemainingFrames(window.frtime);
        let remainingTime = this.interpoler.getRemainingTime();
        let rebalanceTransform = this.getRebalanceTransform(remainingTime); 
        this.interpoler.goal_globalTransform.adoptValues(rebalanceTransform);
        this.goalNode.alignGlobalsTo(rebalanceTransform);
        this.goalNode.project();
        this.rebalanceTransform.origin(this.hipToFoot.p2);//.add(this.footPos);
        this.hipToFoot.p1.set(this.projectionObj.future_hipPos).add(this.attachpoint);
        let tries = 0;     
        let legLengthSq = this.hips.legLength * this.hips.legLength;
        let projNorm = this.projectionObj.firstFootVec_norm;
        
        while(legLengthSq < this.hipToFoot.magSq() && tries < 5) {
            this.hipToFoot.setMag(this.hips.legLength);
            let projInfo = this.hips.projectToGround(this.hipToFoot.p2, this.hipToFoot.p2);
            projNorm = projInfo.normal;
            tries++;
        }
        if(tries > 0) {
            let hipPointingDirection = this.hips.hipsNode.getGlobalMBasis().getZHeading();
            let proposedRotation = this.getNormalAlignedRotation(projNorm, hipPointingDirection);
            this.interpoler.goal_globalTransform.rotateTo(proposedRotation);
        }
        //console.log(this.hipToFoot.mag());
        this.goalNode.translateTo(this.hipToFoot.p2); 
        this.interpoler.goal_globalTransform.adoptValues(this.goalNode.getGlobalMBasis());
        this.goalNode.project();
    }


    

    /**
     * @param {Number} byTime how many milliseconds into the future to anticipate (by accounting for velocity);
     * @param {Number} attempts how many attempts to make at finding a naively reachablesolution
     * @return {IKTransform} a transform indicating where on the ground this foot would need to be in order to balance the hips between this foot and the other foot.
    */
    getRebalanceTransform(byTime=0, startPos) {
        this.otherFoot.footNode.origin(this.otherFootPos);
        this.hips.getProjections(byTime, this.projectionObj);
        this.otherToCenter.setP1(this.projectionObj.otherFootVec_proj); 
        this.otherToCenter.setP2(this.projectionObj.hipOnOtherFootPlane);
        this.hips.gravPlaneProjectThrough(this.otherToCenter.p1, this.projectionObj.hipOnOtherFootPlane, this.otherToCenter.p2);
        this.otherToCenter.scaleBy(2);
        this.hipToFoot.p1.set(this.projectionObj.future_hipPos).add(this.attachpoint);
        this.hipToFoot.p2.set(this.otherToCenter.p2);
        let legLengthSq = this.hips.legLength * this.hips.legLength;
        if(legLengthSq < this.hipToFoot.magSq()) {
            this.hipToFoot.setMag(this.hips.legLength);
        }
        this.hips.gravPlaneProjectThrough(this.otherToCenter.p1, this.projectionObj.hipOnOtherFootPlane, this.otherToCenter.p2);
        let projInfo = this.hips.projectToGround(this.hipToFoot.p2, this.hipToFoot.p2);
        this.projectionObj.firstFootVec_proj.set(this.hipToFoot.p2);
        this.projectionObj.firstFootVec_norm.readFromTHREE(projInfo.normal);
        let hipPointingDirection = this.hips.hipsNode.getGlobalMBasis().getZHeading();
        let proposedRotation = this.getNormalAlignedRotation(projInfo.normal, hipPointingDirection);
        this.rebalanceTransform.setToIdentity();
        this.rebalanceTransform.translateTo(this.hipToFoot.p2); 
        this.rebalanceTransform.rotateTo(proposedRotation);
        return this.rebalanceTransform; 
    }

    /**panic and try to hurry up the foot planting within the provided number of milliseconds */
    hurry(newDuration) {
        if(newDuration + Date.now() < this.interpoler.endTime)
            this.interpoler.endTime = Date.now() + newDuration;
    }
    plant() {
        this.isPlanted = true;
        this.moveProposal.unlock().mid_stride = false;
        this.moveProposal.lock();
        this.interpoler.endTime = Date.now();
        this.foot.material.color.set(this.plantedCol);
        //let rebalanceTransform = this.getRebalanceTransform(0); 
        //this.interpoler.goal_globalTransform.adoptValues(rebalanceTransform);
        this.interpoler.start_globalTransform.adoptValues(this.interpoler.goal_globalTransform);
        this.startNode.adoptGlobalValuesFromIKTransform(this.interpoler.start_globalTransform);
        this.startNode.project(); 
        this.footNode.alignGlobalsTo(this.interpoler.goal_globalTransform);
        this.footNode.project();
    }

    addTo(scene) {
        scene.add(this.foot);
        scene.add(this.goal);
        scene.add(this.start);
        scene.add(this.legline);
        this.footNode = new ShadowNode(this.foot, undefined, this.pool);
        this.goalNode = new ShadowNode(this.goal, undefined, this.pool);
        this.startNode = new ShadowNode(this.start, undefined, this.pool);
        this.footNode.mimic();
        this.goalNode.mimic();
        this.startNode.mimic();
        
        this.interpoler = new Interpolator(this.footNode);
        this.interpoler.setGoal(this.footNode.getGlobalMBasis());
    }

    tempRot1 = new Rot(1,0,0,0);
    tempRot2 = new Rot(1,0,0,0);
    tempRot3 = new Rot(1,0,0,0);
    tempRot4 = new Rot(1,0,0,0);

    /**returns a global rotation aligned with its y-heading in the provided normal direction and its z-heading the provided pointing direction.
     * don't worry about normalization, it's taken care of.
    */
    getNormalAlignedRotation(normalDirection, pointingDirection) {
        let pointingRot = this.tempRot1.setComponents(1,0,0,0);
        let normalRot = this.tempRot2.setComponents(1,0,0,0);
        let pd = pointingDirection;
        let nd = normalDirection;
        this.tempYVec.setComponents(0,1,0);
        this.tempZVec.setComponents(0,0,1);
        if(pointingDirection != null)
            pointingRot.setFromVecs(this.tempZVec, this.pool.any_Vec3(pd.x, pd.y, pd.z).normalize());
        pointingRot.applyToVec(this.tempYVec);
        if(normalDirection != null)
            normalRot.setFromVecs(this.tempYVec, this.pool.any_Vec3(nd.x, nd.y, nd.z).normalize());
        
        return normalRot.applyAfter(pointingRot, this.tempRot3);
    }

    update(t=-1) {        
        //add some lift to the foot if it's midstride
        if(t>= 0 && t<=1) {
            let currentInterp = this.interpoler.interpolated_Transform.origin();
            let travelVec = this.interpoler.start_globalTransform.origin().sub(this.interpoler.goal_globalTransform.origin());
            let traveLen = travelVec.mag();
            let midY = travelVec.y/2; 
            let subT = (0.25-((0.5-t)*(0.5-t)))
            let tquad = (subT*traveLen) + midY;            
            this.interpoler.interpolated_Transform.translateTo(this.pool.any_Vec3(currentInterp.x,currentInterp.y + (tquad/1.5),currentInterp.z));
        }
        if(this.isPlanted) {
            this.goal.visible = false;
        }
        else { 
            this.goal.visible = true && this.showGoal;
        }

        //this.footProjArrow.setLength(arrowDir.mag());
        //this.footProjArrow.setDirection(arrowDir.normalize());
        //this.footNode.alignGlobalsTo(this.interpoler.interpolated_Transform);
        this.footNode.project();
        this.goalNode.project();
        this.startNode.project();
        /*let hipPos = this.hips.hipsNode.origin();
        let hipLocalized = this.hips.hipsNode.getGlobalOfVec(this.attachpoint);
        let footPos = this.footNode.origin();*/
        /*this.lineGeometry.setFromPoints([
            new THREE.Vector3(hipLocalized.x, hipLocalized.y, hipLocalized.z),
            new THREE.Vector3(this.thisFootPos.x, this.thisFootPos.y, this.thisFootPos.z)
        ]);*/
    }
}