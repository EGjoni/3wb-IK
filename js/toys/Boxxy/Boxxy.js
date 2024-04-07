import { IKPin } from "../../EWBIK/betterbones/IKpin.js";
import { StateMachine, State } from "./StateNode.js";
import { Vec3 } from "../../EWBIK/util/vecs.js";
import { IKTransform } from "../../EWBIK/util/nodes/IKTransform.js";
import { IKNode } from "../../EWBIK/util/nodes/IKNodes.js";
import { ShadowNode } from "../../EWBIK/util/nodes/ShadowNode.js";
const THREE = await import("three");
import {Rot} from "../../EWBIK/util/Rot.js";

export class Boxxy {

    hipsgeometry = new THREE.BoxGeometry();
    hipsmaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    hips = new THREE.Mesh(this.hipsgeometry, this.hipsmaterial);
        
    coeffr = 0.75;
    coerel = 0.2;
    coefftilt = 0.7;

    // Movement variables
    velocity = new THREE.Vector3(0,0,0);
    acceleration = new THREE.Vector3(0, 0, 0);
    tiltceleration = new THREE.Vector3(0, 0, 0);
    jerk = new THREE.Vector3(0,0,0);
    maxVelocity = 0.2;

    runVel = 2.5;
    walkVel = 1.8;
    terminalVel = this.walkVel; 
    impetus = 0.003;

    impetizer = new THREE.Vector3(0,1,0);
    yhead = new THREE.Vector3(0,1,0);

    constructor(hipHeight) {
        this.hips.position.y = hipHeight;
        this.hipHeight = hipHeight;
    }


    update() {
        if(isKeyPressed('KeyA')) this.jerk.x -= this.impetus;
        if(isKeyPressed('KeyD')) this.jerk.x += this.impetus;
        if(isKeyPressed('KeyW')) this.jerk.z -= this.impetus;
        if(isKeyPressed('KeyS')) this.jerk.z += this.impetus;
        if(!(isKeyPressed('KeyA') ^ isKeyPressed('KeyD'))) this.jerk.x = 0;
        if(!(isKeyPressed('KeyW') ^ isKeyPressed('KeyS'))) this.jerk.z = 0;
        if(isKeyPressed('ShiftLeft')) 
            this.terminalVel= this.runVel;
        else this.terminalVel = this.walkVel;

        this.jerk.clampScalar(-this.impetus*10, this.impetus*10);
        this.acceleration.add(this.jerk);
        this.acceleration.clampLength(0, 0.6);
        this.tiltceleration.add(this.jerk);
        this.tiltceleration.clampLength(0,6);
        this.velocity.multiplyScalar(this.coeffr);
        this.velocity.add(this.acceleration);
        this.velocity.clampLength(0, this.terminalVel);
        this.hips.position.add(this.velocity);
        this.impetizer.copy(this.tiltceleration).multiplyScalar(3).add(this.yhead).normalize();
        this.tiltceleration.multiplyScalar(this.coefftilt);
        this.acceleration.multiplyScalar(this.coerel);
        this.hips.quaternion.setFromUnitVectors(this.impetizer, this.yhead);//, impetizer);
    }


    addTo(scene) {
        scene.add(this.hips);
    }

}