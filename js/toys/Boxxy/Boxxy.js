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

export class Boxxy {

    hipsgeometry = new THREE.BoxGeometry(0.1,0.1,0.1);
    hipsmaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
    hips = new THREE.Mesh(this.hipsgeometry, this.hipsmaterial);
    balanceThreshold = 0.25;    
    coeffr = 0.75;
    coerel = 0.2;
    coefftilt = 0.7;
    maxStepDuration = 600; //ms
    minStepDuration = 600; //ms
    tempv = new Vec3(0,0,0);

    // Movement variables
    velocity = new Vec3(0,0,0);
    acceleration = new Vec3(0, 0, 0);
    tiltceleration = new Vec3(0, 0, 0);
    jerk = new Vec3(0, 0, 0);
    maxVelocity = 0.2;

    runVel = 1.1;
    walkVel = 0.15;
    terminalVel = this.walkVel; 
    impetus = 0.0003;

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

    constructor(hipObj, leftFootObj, leftHipObj, rightFootObj, rightHipObj) {
        hipObj.getWorldPosition(this.temp3V1);
        this.hips.position.copy(this.temp3V1);
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
        
        this.hipHeight = leftAttach.y - this.leftFootPos.y;
        //if(legLength == null) this.legLength = this.hipHeight*1.25;
        
        this.left_foot = new Foot(undefined, this, this.leftFootPos, leftAttach, true);
        this.right_foot = new Foot(this.left_foot, this, this.rightFootPos, rightAttach, true);
        this.left_foot.otherFoot = this.right_foot;
        this.right_foot.plantedCol = 0xff8888;
        this.right_foot.foot.material.color.set(this.right_foot.plantedCol);
        
        this.startTime = Date.now();
    }
    /*constructor(hipHeight, legLength = null, hipWidth = 1.5) {
        this.hips.position.y = hipHeight;
        this.hipHeight = hipHeight;
        this.legLength = legLength;
        if(legLength == null) this.legLength = this.hipHeight*1.25;
        
        this.left_foot = new Foot(undefined, this, new Vec3(-hipWidth/2, 0, 0), true);
        this.right_foot = new Foot(this.left_foot, this, new Vec3(hipWidth/2, 0, 0), true);
        this.right_foot.plantedCol = 0xff8888;
        this.right_foot.foot.material.color.set(this.right_foot.plantedCol);
        this.left_foot.otherFoot = this.right_foot;
        this.startTime = Date.now();
    }*/

    printfps() {
            console.log(`FPS: ${this.frameCount/((Date.now()-this.startTime)/1000)}`);
    }
    

    
    update() {
        this.frameCount++;
        
        if(isKeyPressed('KeyA')) this.jerk.x -= this.impetus;
        if(isKeyPressed('KeyD')) this.jerk.x += this.impetus;
        if(isKeyPressed('KeyW')) this.jerk.z -= this.impetus;
        if(isKeyPressed('KeyS')) this.jerk.z += this.impetus;
        if(!(isKeyPressed('KeyA') ^ isKeyPressed('KeyD'))) this.jerk.x = 0;
        if(!(isKeyPressed('KeyW') ^ isKeyPressed('KeyS'))) this.jerk.z = 0;
        if(isKeyPressed('ShiftLeft')) 
            this.terminalVel= this.runVel;
        else this.terminalVel = this.walkVel;

        this.jerk.clampComponents(-this.impetus*10, this.impetus*10);
        this.acceleration.add(this.jerk);
        this.acceleration.clamp(0, 0.6);
        this.tiltceleration.add(this.jerk);
        this.tiltceleration.clamp(0,6);
        this.velocity.mult(this.coeffr);
        this.velocity.add(this.acceleration);
        this.velocity.clamp(0, this.terminalVel);
        this.velocity.writeToTHREE(this.temp3V1);
        this.hips.position.add(this.temp3V1);
        this.impetizer.set(this.tiltceleration).mult(3).add(this.yhead).normalize();
        this.tiltceleration.mult(this.coefftilt);
        this.acceleration.mult(this.coerel);
        this.impetizer.writeToTHREE(this.temp3V1); this.yhead.writeToTHREE(this.temp3V2)
        this.hips.quaternion.setFromUnitVectors(this.temp3V1, this.temp3V2);//, impetizer);
        let isBalanced = this.isInBalance();
        if(this.left_foot.isPlanted && this.right_foot.isPlanted && !isBalanced) {
            let bestFoot = this.getBestFoot();
            bestFoot.unPlant(this.determineStepDuration());
            bestFoot.toBalance();
        } else if(!this.left_foot.isPlanted) {
                if(this.right_foot.getHipDistance() >= this.legLength)
                    this.left_foot.hurry(this.minStepDuration);
                //if(!isBalanced)
                    this.left_foot.toBalance();
                //else
                  //  this.left_foot.toComfort();
        } else if(!this.right_foot.isPlanted) {
                if(this.left_foot.getHipDistance() >= this.legLength)
                    this.right_foot.hurry(this.minStepDuration);
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
        this.gravityRay.setP1(this.hipsNode.origin().add(this.tempv.set(this.velocity).mult(1+parseInt(forecast/window.frtime)))); 
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

    updateProjections() {
        this.leftFootPos.set(this.left_foot.footNode.origin());
        this.rightFootPos.set(this.right_foot.footNode.origin());
        this.getProjections(0, this.leftFootPos, this.rightFootPos, null, this.closestToGroundRay, this.closestToInterFootRay);
    }

    /**returns the input vector projection on the scene's ground/terrain */
    projectToGround(invec, outvec) {
        outvec.setComponents(invec.x, 0, invec.z);
    }

    addTo(scene) {
        scene.add(this.hips);
        this.hipsNode = new ShadowNode(this.hips);
        this.left_foot.addTo(scene); 
        this.right_foot.addTo(scene);
    }

}