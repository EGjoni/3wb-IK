import { IKPin } from "../../EWBIK/betterbones/IKpin.js";
import { StateMachine, State } from "./StateNode.js";
import { Vec3, any_Vec3 } from "../../EWBIK/util/vecs.js";
import { Ray } from "../../EWBIK/util/Ray.js";
import { IKTransform } from "../../EWBIK/util/nodes/IKTransform.js";
import { IKNode } from "../../EWBIK/util/nodes/IKNodes.js";
import { ShadowNode } from "../../EWBIK/util/nodes/ShadowNode.js";
const THREE = await import("three");
import {Rot} from "../../EWBIK/util/Rot.js";

export class Foot {

    footgeometry = new THREE.BoxGeometry(0.05, 0.05, 0.15);
    predictiongeometry = new THREE.BoxGeometry(0.05, 0.025, 0.15);
    unplantedCol = 0xaaaa00;
    plantedCol = 0xff0000;
    plantedmaterial = new THREE.MeshLambertMaterial({ color: this.plantedCol});
    //unplantedmaterial = new THREE.MeshLambertMaterial({ color: this.unplantedCol}); 
    goalmaterial = new THREE.MeshBasicMaterial({color:0x00ff00});
    foot = new THREE.Mesh(this.footgeometry, this.plantedmaterial);
    goal = new THREE.Object3D();
    goalmesh = new THREE.Mesh(this.predictiongeometry, this.goalmaterial);
    lineGeometry = new THREE.BufferGeometry();
    lineMaterial = new THREE.LineBasicMaterial({ color: 0x008888 });
    
    

    /**@type {Interpolator} */
    interpoler = null; 

    /**@type {IKTransform}*/
    startTransform = new IKTransform();
    
    otherFoot = null;
    hips = null;
    isPlanted = true;

    footNode = null;
    /**@type {ShadowNode} */
    goalNode = null;

    constructor(otherFoot, hips, footPosition, attachpoint, isPlanted=true) {
        this.otherFoot = otherFoot;
        this.hips = hips;
        this.isPlanted = isPlanted;
        this.foot.position.x = footPosition.x;
        this.foot.position.y = footPosition.y;
        this.foot.position.z = footPosition.z;
        this.attachpoint = new Vec3(attachpoint.x, attachpoint.y, attachpoint.z);
        this.foot.updateMatrix();
        this.goal.add(this.goalmesh);
        this.goalmesh.position.y -= 0.07;
        let hipPos = this.hips.hips.position;//.origin();
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
    } 

    /**the position the foot would like to be in when standing idle */
    setattachpoint(pos) {
        this.attachpoint.setComponents(pos.x, pos.y, pos.z);
    }

    getRestDeviation() {
        return this.footNode.origin().dist(this.attachpoint.addClone(this.hips.closestToInterFootRay));
    }

    getHipDistance() {
        return this.footNode.origin().dist(this.hips.hipsNode.origin());
    }

    unPlant(stepDuration) {
        this.isPlanted = false;
        this.currentStepDuration = stepDuration;
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


    otherToCenter = new Ray(new Vec3(), new Vec3());
    hipToFoot = new Ray(new Vec3(), new Vec3());
    tweakGoalForBalance() {
        let framesRemaining = this.interpoler.getRemainingFrames(window.frtime);
        let remainingTime = this.interpoler.getRemainingTime();        
        this.hipToFoot.p2.set(this.getRebalanceOffset(remainingTime).add(this.footNode.origin()));
        this.hipToFoot.p1.set(this.futureHipsPos).add(this.attachpoint);
        let tries = 0;     
        
        while(this.hips.legLength < this.hipToFoot.mag() && tries < 50) {
            this.hipToFoot.setMag(this.hips.legLength);
            this.hips.projectToGround(this.hipToFoot.p2, this.hipToFoot.p2);
            tries++;
        }
        //console.log(this.hipToFoot.mag());
        this.goalNode.translateTo(this.hipToFoot.p2); 
        this.interpoler.goal_globalTransform.adoptValues(this.goalNode.getGlobalMBasis());
        this.goalNode.project();
    }

    tweakGoalForComfort() {
        
        this.hipToFoot.p2.set(this.getRebalanceOffset(remainingTime).add(this.footNode.origin()));
        this.hipToFoot.p1.set(this.futureHipsPos).add(this.attachpoint);
        let projectedAttach = new Vec3();
        this.hips.projectToGround(this.hipToFoot.p1, projectedAttach);
        this.hipToFoot.p2.lerp(projectedAttach, 0.1);   
        this.goalNode.translateTo(this.hipToFoot.p2); 
        this.interpoler.goal_globalTransform.adoptValues(this.goalNode.getGlobalMBasis());
        this.goalNode.project();
    }


    closestToGroundRay = new Vec3(0,0,0);
    closestToInterFootRay = new Vec3(0,0,0); 
    otherFootPos = new Vec3(0,0,0);
    thisFootPos = new Vec3(0,0,0);
    futureHipsPos = new Vec3(0,0,0);

    /**returns a vector indicating the direction and amount this foot would need to be offset 
     * in order to balance the hips between this foot and the other foot. 
     * 
     * @param {Number} byTime how many milliseconds into the future to anticipate (by accounting for velocity);
    */
    getRebalanceOffset(byTime=0) {
        this.otherFootPos.set(this.otherFoot.footNode.getGlobalMBasis().translate);
        this.thisFootPos.set(this.footNode.getGlobalMBasis().translate);
        this.hips.getProjections(byTime, this.thisFootPos, this.otherFootPos, this.futureHipsPos, this.closestToGroundRay, this.closestToInterFootRay);
        this.otherToCenter.setP1(this.otherFootPos); 
        this.otherToCenter.setP2(this.closestToInterFootRay);
        this.otherToCenter.scaleBy(2);
        return this.otherToCenter.p2.subClone(this.thisFootPos);
    }

    /**panic and try to hurry up the foot planting within the provided number of milliseconds */
    hurry(newDuration) {
        if(newDuration + Date.now() < this.interpoler.endTime)
            this.interpoler.endTime = Date.now() + newDuration;
    }
    plant() {
        this.isPlanted = true;
        this.foot.material.color.set(this.plantedCol);
    }

    addTo(scene) {
        scene.add(this.foot);
        scene.add(this.goal);
        scene.add(this.legline);
        this.footNode = new ShadowNode(this.foot);
        this.goalNode = new ShadowNode(this.goal);
        this.footNode.mimic();
        this.goalNode.mimic();
        this.interpoler = new Interpolator(this.footNode);
    }

    update(t=-1) {
        if(t>= 0 && t<=1) {
            let travelVec = this.interpoler.goal_globalTransform.translate.subClone(this.interpoler.start_globalTransform.translate);
            let traveLen = travelVec.mag();
            let midY = travelVec.y/2; 
            let tquad = ((0.25-((0.5-t)*(0.5-t)))*traveLen) + midY;
            this.footNode.translateByGlobal(new Vec3(0,tquad/2,0));
        }
        if(this.isPlanted) {
            this.goal.visible = false;
        }
        else { 
            this.goal.visible = true;
        }
        this.goalNode.project();
        this.footNode.project();
        let hipPos = this.hips.hipsNode.origin();
        let hipLocalized = this.hips.hipsNode.getGlobalOfVec(this.attachpoint);
        let footPos = this.footNode.origin();
        this.lineGeometry.setFromPoints([
            new THREE.Vector3(hipLocalized.x, hipLocalized.y, hipLocalized.z),
            new THREE.Vector3(this.thisFootPos.x, this.thisFootPos.y, this.thisFootPos.z)
        ]);
    }
}

export class Interpolator {
    start_globalTransform = new IKTransform();
    goal_globalTransform = new IKTransform();
    interpolated_Transform = new IKTransform();
    current = null;
    startTime = null;
    endTime = null;
    smoothingFunction = null;
    constructor(ik_node) {
        this.current = ik_node;
    }


    /**@param {IKTransform} goal_globalTransform */
    setGoal(goal_globalTransform, onTick, onComplete) {
        this.goal_globalTransform.adoptValues(goal_globalTransform);
        this._onComplete = onComplete;
        this.onTick = onTick;
        return this;
    }

    /**
     * begin interpolating to the goal
     * @param {Number} duration span of time in milliseconds over which the interpolation should occur */
    begin(duration) {
        this.start_globalTransform.adoptValues(this.current.getGlobalMBasis());
        this.startTime = Date.now();
        this.endTime = this.startTime + duration; 
    } 

    /**returns the remaining time for the interpolation in ms */
    getRemainingTime() {return Math.max(0, (this.endTime - Date.now()));}


    /**returns the remaining frames for the interpolation in frames given a number of milliseconds per frame*/
    getRemainingFrames(msPerFrame) {return ((this.getRemainingTime())/msPerFrame);}

    changeDuration(newDuration) {
        this.endTime = this.startTime + newDuration;
    }

    tempMatrix = new THREE.Matrix4();

    /**does a step of the interpolation */
    tick() {
        if(this.startTime == null) throw new Error("Start time required. call begin() before calling tick()");
        let currentTime = Date.now();
        let t = (currentTime - this.startTime ) / ( this.endTime - this.startTime);
        t = Math.min(t, 1);
        if(t>=0 && t <=1) {
            this.interpolated_Transform.adoptValues(this.start_globalTransform);
            this.interpolated_Transform.translate.lerp(this.goal_globalTransform.translate, t);
            Rot.fromSlerp(this.interpolated_Transform.rotation, this.goal_globalTransform.rotation, t, this.interpolated_Transform.rotation);
            for(let i = 0; i<this.interpolated_Transform.skewMatrix_e.length; i++) {
                this.interpolated_Transform.skewMatrix_e[i] = this.lerp(this.start_globalTransform.skewMatrix_e[i], this.goal_globalTransform.skewMatrix_e[i], t);
            };
            this.interpolated_Transform.scale.lerp(this.goal_globalTransform.scale, t);        
            this.interpolated_Transform.lazyRefresh();
            this.interpolated_Transform.recompose();
            this.current.adoptGlobalValuesFromIKTransform(this.interpolated_Transform);
            if(this.onTick != null) this.onTick(t, this.current, this.start_globalTransform, this.goal_globalTransform);
        }
        if(t >= 1) 
            this.onComplete(this.current, this.start_globalTransform, this.goal_globalTransform);
    }

    onComplete(...params) {
        if(this._onComplete)
            this._onComplete(...params);
        this.startTime = null;
        this.endTime = null;
    }


    lerp(v1, v2, t) {
        return ((v2-v1)*t)+v1;
    }
}