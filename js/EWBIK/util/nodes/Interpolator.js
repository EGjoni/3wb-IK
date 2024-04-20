import { Vec3, any_Vec3, any_Vec3fv} from "../vecs.js";
import { Ray } from "../Ray.js";
import { IKTransform } from "./IKTransform.js";
import { IKNode } from "./IKNodes.js";
import { ShadowNode } from "./ShadowNode.js";
const THREE = await import("three");
import {Rot} from "../Rot.js";

export class Interpolator {
    start_globalTransform = null;
    goal_globalTransform = null;
    interpolated_Transform = null;
    current = null;
    startTime = null;
    endTime = null;
    smoothingFunction = null;
    hasCompleted = true;
    constructor(ik_node, pool) {
        this.current = ik_node;
        this.pool = pool; 
        this.start_globalTransform = IKTransform.newPooled(this.pool);
        this.goal_globalTransform = IKTransform.newPooled(this.pool);
        this.interpolated_Transform = IKTransform.newPooled(this.pool);
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
        this.hasCompleted = false;
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
    tick(noError=false) {
        if(this.startTime == null) {
            if(noError) return;
            throw new Error("Start time required. call begin() before calling tick()");
        }
        let currentTime = Date.now();
        let t = (currentTime - this.startTime ) / ( this.endTime - this.startTime);
        t = Math.min(t, 1);
        if(t>=0 && t <=1) {
            this.interpolated_Transform.adoptValues(this.start_globalTransform);
            this.interpolated_Transform.translate.lerp(this.goal_globalTransform.translate, t);
            Rot.fromSlerp(this.interpolated_Transform.rotation, this.goal_globalTransform.rotation, t, this.interpolated_Transform.rotation);
            if(!(this.start_globalTransform.isOrthogonal && this.goal_globalTransform.isOrthogonal)) {
                for(let i = 0; i<this.interpolated_Transform.skewMatrix_e.length; i++) {
                    this.interpolated_Transform.skewMatrix_e[i] = this.lerp(this.start_globalTransform.skewMatrix_e[i], this.goal_globalTransform.skewMatrix_e[i], t);
                };
            }
            this.interpolated_Transform.scale.lerp(this.goal_globalTransform.scale, t);        
            this.interpolated_Transform.lazyRefresh();
            this.interpolated_Transform.recompose();
            if(this.onTick != null) 
                this.onTick(t, this.current, this.start_globalTransform, this.goal_globalTransform);
            this.current.adoptGlobalValuesFromIKTransform(this.interpolated_Transform);
            this.current.project();
        }
        if(t >= 1) {
            if(!this.hasCompleted) {
                this.hasCompleted = true;
                this.onComplete(this.current, this.start_globalTransform, this.goal_globalTransform);
            }
        }
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