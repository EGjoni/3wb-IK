import { IKPin } from "../../EWBIK/betterbones/IKpin.js";
import { StateMachine, State } from "./StateNode.js";
import { Vec3, any_Vec3 } from "../../EWBIK/util/vecs.js";
import { Ray } from "../../EWBIK/util/Ray.js";
import { IKTransform } from "../../EWBIK/util/nodes/IKTransform.js";
import { IKNode } from "../../EWBIK/util/nodes/IKNodes.js";
import { ShadowNode } from "../../EWBIK/util/nodes/ShadowNode.js";
const THREE = await import("three");
import {Rot} from "../../EWBIK/util/Rot.js";
import { Foot } from "./Foot.js";


/**
 * Basic idea: 
 * 
 * This class is essentially defined as two feet and a center of mass. Each aware of all. 
 * Each foot is tasked with placing itself such that the projection of the center of mass 
 * along the axis of gravity resides halfway between both feet.
 * 
 * As it is technically possible for a single foot to be moved to always meet the criteria above,
 * the Boxxy class coordinates which foot ought to move under which conditions.
 * 
 * The procedure for determining which foot to move is as follows.
 * 
 * 1. If we are off balance and a foot is already lifted, that foot should be the one to keep moving.
 * 2. If we are off balance and neither foot is lifted, we should determine where each foot would try to move if we were to lift it.
 *  2a. We should then evaluate how comfortable the rig would be were we to move there. 
 *  2b. This comfort criteria can be arbitrarily involved, but some options are
 *      2bi: Braindead- choose whichever foot some external walk cycle animatio says you should. (Though this has the advantage of thoughtlessness, it also requires analyzing the walk cycles, and potentially choosing and blending between the appropriate ones by direction.)
 *      2bii: Cheap- check if each foot's desired position would make its position be futher than the leg length, and if so, choose the foot that minimizes this outcome. If neither foot does this, choose the foot whose desired position would minimize the total distance of both feet to their respective rest poses.
 *      2biii: Naive- In conjunction with the above, use any pain reporting constraints defined on the hip attachment points of the rig to determine how much pain both legs would be in should that bone point in the direction of the foot's goal. Prefer whichever foot would result in the most comfortable pose.
 *      
 */

export class Boxxy {

    hipsgeometry = new THREE.BoxGeometry(0.1,0.1,0.1);
    hipsmaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
    hips = new THREE.Mesh(this.hipsgeometry, this.hipsmaterial);
    balanceThreshold = 0.25;    
    coeffr = 0.75;
    coerel = 0.9;
    coefftilt = 0.7;
    maxStepDuration = 2000; //ms
    minStepDuration = 400; //ms
    tempv = new Vec3(0,0,0);

    // Movement variables
    velocity = new Vec3(0,0,0);
    acceleration = new Vec3(0, 0, 0);
    tiltceleration = new Vec3(0, 0, 0);
    jerk = new Vec3(0, 0, 0);
    maxVelocity = 0.2;

    runVel = 0.05;
    walkVel = 0.025;
    terminalVel = this.walkVel; 
    walk_impetus = 0.0005;
    run_impetus =  0.001;

    impetizer = new Vec3(0, 0, 0);
    yhead = new Vec3(0, 1, 0);

    /**@type {Foot}*/
    left_foot = null;
    /**@type {Foot}*/
    right_foot = null;

    clock = new THREE.Clock();
    frameCount = 0;

    temp3V1 = new THREE.Vector3();
    temp3V2 = new THREE.Vector3();
    firstRun  = true;
    rayCaster = null;
    doWalkery = true;

    /**
     * 
     * @param {Number} clearanceRatio 0-1 indicating how much of the total leg length to keep the hips above the ground
     * @param {Object3D} hipObj an object tracking your character's hip location
     * @param {Object3D} leftFootObj an object corresponding to your character's left foot
     * @param {Object3D} leftHipObj an object corresponding to where your character's left leg meets their hip
     * @param {Object3D} rightFootObj an object corresponding to your character's left foot
     * @param {Object3D} rightHipObj an object corresponding to where your character's right leg meets their hip
     */
    constructor(clearanceRatio, hipObj, leftFootObj, leftHipObj, rightFootObj, rightHipObj) {
        hipObj.getWorldPosition(this.temp3V1);
        this.hips.position.copy(this.temp3V1);
        this.hips.visible = false;
        let hipPos = new Vec3(0,0,0); hipPos.readFromTHREE(this.hips.position);
        let leftAttach = new Vec3(0,0,0); leftAttach.readFromTHREE(leftHipObj.getWorldPosition(this.temp3V1)).sub(hipPos);
        let rightAttach = new Vec3(0,0,0); rightAttach.readFromTHREE(rightHipObj.getWorldPosition(this.temp3V1)).sub(hipPos);
        this.leftFootPos.readFromTHREE(leftFootObj.getWorldPosition(this.temp3V1));
        this.rightFootPos.readFromTHREE(rightFootObj.getWorldPosition(this.temp3V1));
        let current = leftFootObj; 
        this.legLength = 0;
        do {
            this.legLength += current.position.length();
            current = current.parent;
        } while(current != leftHipObj) 

        this.hipClearance = this.legLength * clearanceRatio;
        
        //if(legLength == null) this.legLength = this.clearanceRatio*1.25;
        
        this.left_foot = new Foot(undefined, this, this.leftFootPos, leftAttach, true);
        this.right_foot = new Foot(this.left_foot, this, this.rightFootPos, rightAttach, true);
        this.left_foot.otherFoot = this.right_foot;
        this.right_foot.plantedCol = 0xff8888;
        this.right_foot.foot.material.color.set(this.right_foot.plantedCol);
        
        this.startTime = Date.now();
    }
    printfps() {
            console.log(`FPS: ${this.frameCount/((Date.now()-this.startTime)/1000)}`);
    }
     
    update(forwardVec, leftVec) {
        this.frameCount++;
        let starty = this.hips.position.y;
        if(isKeyPressed('ShiftLeft')) {
            //console.log("shift");
            this.terminalVel= this.runVel;
            this.impetus = this.run_impetus;
        } else {
            this.impetus = this.walk_impetus;
            this.terminalVel = this.walkVel;
        }
        
        this.jerk.setComponents(0,0,0);

        forwardVec.normalize().mult(this.impetus); leftVec.normalize().mult(this.impetus);
        if(isKeyPressed('KeyA')) 
            this.jerk.sub(leftVec);
        if(isKeyPressed('KeyD')) 
            this.jerk.add(leftVec);
        if(isKeyPressed('KeyS')) 
            this.jerk.sub(forwardVec);
        if(isKeyPressed('KeyW')) 
            this.jerk.add(forwardVec);
        

        this.jerk.clamp(-this.impetus, this.impetus);
        this.acceleration.add(this.jerk);
        //this.acceleration.clamp(0, 1.6);
        this.tiltceleration.add(this.jerk);
        this.tiltceleration.clamp(0,6);
        this.velocity.mult(this.coeffr);
        this.velocity.add(this.acceleration);
        this.velocity.clamp(0, this.terminalVel);
        //console.log(this.terminalVel);
        //console.log(this.velocity.mag());
        this.velocity.writeToTHREE(this.temp3V1);
        this.hips.position.add(this.temp3V1);
        this.impetizer.set(this.tiltceleration).mult(103).add(this.yhead).normalize();
        this.tiltceleration.mult(this.coefftilt);
        this.acceleration.mult(this.coerel);
        this.impetizer.writeToTHREE(this.temp3V1); this.yhead.writeToTHREE(this.temp3V2)
        this.hips.quaternion.setFromUnitVectors(this.temp3V2, this.temp3V1);//, impetizer);
        this.ensureHipClearance();

        if(this.doWalkery) {
            if(this.firstRun) {
                this.left_foot.plant();
                this.right_foot.plant();
                this.left_foot.update();
                this.right_foot.update();
                this.firstRun = false;
                return;
            }
            let isBalanced = this.isInBalance();
            if(this.left_foot.isPlanted && this.right_foot.isPlanted && !isBalanced) {
                let bestFoot = this.getBestFoot();
                bestFoot.unPlant(this.determineStepDuration());
                bestFoot.toBalance();
            } else if(!this.left_foot.isPlanted) {
                    //if(this.right_foot.getHipDistance() >= this.legLength)
                    //    this.left_foot.hurry(this.minStepDuration);
                    //if(!isBalanced)
                        this.left_foot.toBalance();
                    //else
                    //  this.left_foot.toComfort();
            } else if(!this.right_foot.isPlanted) {
                    //if(this.left_foot.getHipDistance() >= this.legLength)
                    //    this.right_foot.hurry(this.minStepDuration);
                    //if(!isBalanced)
                        this.right_foot.toBalance();
                    //else
                    //    this.right_foot.toComfort();
            } else if(isBalanced) {
                this.left_foot.plant(); this.right_foot.plant();
                this.left_foot.update();
                this.right_foot.update();
            }
        }
        this.hipsNode.project();
        this.hips.position.y = 0.8*starty + 0.2*this.hips.position.y;
        this.hipsNode.mimic();
    }

    gravityRay = new Ray(any_Vec3(), any_Vec3()); //ray from the center of mass down to the earth
    footRay = new Ray(any_Vec3(), any_Vec3()); //ray between the two feet positions;
    closestToGroundRay = new Vec3(0,0,0);
    closestToInterFootRay = new Vec3(0,0,0); 
    leftFootPos = new Vec3(0,0,0);
    rightFootPos = new Vec3(0,0,0);

    determineStepDuration() {
        return this.maxStepDuration;
    }

    /**determines which foot to move. 
     * this is defined as first, whichever foot is most outside of the allowable distance from the hips
     * and second "whichever foot would have to move the least to keep the character balanced"
     */
    getBestFoot() {
        this.updateProjections();
        let leftDist = this.left_foot.getHipDistance();
        let rightDist = this.right_foot.getHipDistance(); 
        if(leftDist > this.legLength || rightDist > this.legLength) {
            if(leftDist > rightDist) return this.left_foot;
            if(rightDist > leftDist) return this.right_foot;
        } else {
            let leftRebalance = this.left_foot.getRebalanceOffset();
            let rightRebalance = this.right_foot.getRebalanceOffset();
            if(leftRebalance.mag() < rightRebalance.mag()) return this.left_foot;
            else return this.right_foot;
        }
        if(this.leftFootPos.dist(this.closestToInterFootRay) < this.rightFootPos.dist(this.closestToInterFootRay)) 
            return this.right_foot;
        else
            return this.left_foot;
    }
    isInBalance() {
        this.updateProjections();
        if(!this.left_foot.isPlanted || !this.right_foot.isPlanted) return false; 
        if(this.closestToInterFootRay.dist(this.closestToGroundRay) > this.balanceThreshold) return false;
        let leftDist = this.left_foot.getHipDistance();
        let rightDist = this.right_foot.getHipDistance(); 
        if(leftDist > this.legLength || rightDist > this.legLength) return false;
        //center of mass is beyond one of the feet.
        if(this.leftFootPos.sub(this.closestToGroundRay).dot(this.rightFootPos.sub(this.closestToGroundRay)) > 0) return false;
        return true;
    }

    /**sets the wlaker position values into the provided vec3s. the forecast parameter projects time instead of space*/
    getProjections(forecast, 
        firstFootPos_in = this.left_foot.footNode.origin(), 
        secondFootPos_in = this.left_foot.footNode.origin(), hipPos_out, closestToGround_out, closestToInterfoot_out) {
        this.hipsNode.mimic();
        this.left_foot.footNode.mimic().updateGlobal();
        this.right_foot.footNode.mimic().updateGlobal();
        this.gravityRay.p1.set(this.velocity).mult(1+parseInt(forecast/window.frtime)).add(this.hipsNode.origin());//this.hipsNode.origin()).add(this.tempv.set(this.velocity).mult(1+parseInt(forecast/window.frtime))); 
        this.projectToGround(this.gravityRay.p1, this.gravityRay.p2);
        this.footRay.setP1(firstFootPos_in); 
        this.footRay.setP2(secondFootPos_in);
        if(hipPos_out != null) {
            hipPos_out.set(this.gravityRay.p1);
        }
        this.projectToGround(this.footRay.p1, this.footRay.p1);
        this.projectToGround(this.footRay.p2, this.footRay.p2);

        if(closestToGround_out != null)
            this.footRay.closestPointToRay3D(this.gravityRay, closestToGround_out);
        if(closestToInterfoot_out != null)
            this.gravityRay.closestPointToRay3D(this.footRay, closestToInterfoot_out);
    }

    groundObjects = [];
    addGroundObjects(objs) {
        this.groundObjects.push(...objs);
    }

    updateProjections() {
        this.leftFootPos.set(this.left_foot.footNode.origin());
        this.rightFootPos.set(this.right_foot.footNode.origin());
        this.getProjections(0, this.leftFootPos, this.rightFootPos, null, this.closestToGroundRay, this.closestToInterFootRay);
    }

    /**returns the input vector projection on the scene's ground/terrain */
    projectToGround(invec, outvec) {
        invec.writeToTHREE(this.intrxVec);
        this.intrxVec.y += 1; // just some buffer
        this.rayCaster.set(this.intrxVec, this.downVec);
        let intrxRes = this.rayCaster.intersectObjects(this.groundObjects);
        for(let r of intrxRes) {
            if(r.normal.dot(this.downVec) < -0.2) {
                outvec.readFromTHREE(r.point);
            //outvec.toConsole();
                return r;
            }
        }
        r = null;
        //outvec.setComponents(invec.x, 0, invec.z);
    }
    ensureHipClearance() {
        if(this.closestToInterFootRay.y == null) {
            this.hipsNode.mimic();
            this.projectToGround(this.hipsNode.origin(), this.tempv);
            this.hipsNode.origin().writeToTHREE(this.temp3V1);
            this.hips.position.y = this.hipClearance + this.temp3V1;             
        } else {
            this.hips.position.y = this.hipClearance + this.closestToInterFootRay.y;
        }
        
        //this.hips.position.copy(this.hips.worldToLocal(this.temp3V1));
        this.hipsNode.mimic();
    }

    downVec = new THREE.Vector3(0,-1,0);
    intrxVec = new THREE.Vector3(0,0,0);
    addTo(scene, groundObjects) {
        scene.add(this.hips);
        this.hipsNode = new ShadowNode(this.hips);
        this.left_foot.addTo(scene); 
        this.right_foot.addTo(scene);
        if(groundObjects != null) this.addGroundObjects(groundObjects);
        this.rayCaster = new THREE.Raycaster(this.hips.position.clone(), this.downVec.clone());
        this.hipsNode.mimic();
        this.ensureHipClearance();
        this.left_foot.plant();
        this.right_foot.plant();
    }

    

}