import { IKPin } from "../../EWBIK/betterbones/IKpin.js";
import { StateMachine, State } from "./StateNode.js";
import { Vec3 } from "../../EWBIK/util/vecs.js";
import { IKTransform } from "../../EWBIK/util/nodes/IKTransform.js";
import { IKNode, ShadowNode } from "../../EWBIK/util/nodes/IKNodes.js";
import { THREE } from "three";
import {Rot} from "../../EWBIK/util/Rot.js";

export class Inferrer {
    baseState = new State("baseState");
    walker = new StateMachine(this.baseState);
    velocity = new Vec3(0,0,0);
    acceleration = new Vec3(0,0,0);
    jerk = new Vec3(0,0,0);
    l_footInterpolator = null; 
    r_footInterpolator = null; 
    hips_interpolator = null;
    head_interpolator = null;
    

    /**
     * @param {IKPin} left_leg 
     * @param {IKPin} right_leg 
     * @param {IKPin} hips
     * @param {IKPin} head 
     */
    constructor(left_leg, right_leg, hips, head) {
        this.left_foot = left_leg;
        this.right_foot = right_leg;
        this.hips = hips;
        this.head = head;
        this.l_footInterpolator = new Interpolator(this.left_foot.targetNode);
        this.r_footInterpolator = new Interpolator(this.right_foot.targetNode);
        this.hips_interpolator = new Interpolator(this.hips.targetNode);
        this.head_interpolator = new Interpolator(this.head_interpolator);

        const left_foot_reorienting = new State("left_foot_reorienting");
        left_foot_reorienting.setOnEnter()
        const right_foot_reorienting = new State("right_foot_reorienting");
        const has_reoriented = function(machine, startstate) {
            return 
        }

        this.baseState.addTransitionFunction((machine, startState)=> {
            return this.needsReorient(this.left_foot, this.right_foot, this.head);
        },
        left_foot_reorienting);

    }

    tempv1 = new Vec3();
    tempv2 = new Vec3();
    tempRot = new Rot();
    tempTransform = new IKTransform();

    /**reorient the provided follower IKPin so the provided localspace axis points in the same direction
     * as the provided leader IKPin localspace axis
     * 
     * @param {IKPin} follower
     * @param {IKPin} leader
     * @return the globalspace transform of the follower after reorienting to match the leader
    */
    reorient(follower, leader, axisfollower = new Vec3(0,1,0), axisleader = new Vec3(0,0,1)) {
        let followerHeading = follower.targetNode.getGlobalOfVec(axisfollower, tempv1).sub(follower.targetNode.origin());
        let leaderHeading = leader.targetNode.getGlobalOfVec(axisleader, tempv2).sub(follower.targetNode.origin());
        let rotBy = this.tempRot.setFromVecs(followerHeading, leaderHeading).shorten();
        this.tempTransform.adoptValues(follower.targetNode.getGlobalMBasis());
        this.tempTransform.rotateBy(rotBy); 
    }

    /**
     * 
     * @param {ShadowNode} thisFoot 
     * @param {ShadowNode} otherFoot 
     * @param {ShadowNode} head 
     */
    needsReorient(thisFoot, otherFoot, head, footPointAxis = new Vec3(0,1,0), headPointAxis = new Vec3(0,0,1)) {
        let fromFootHeading = this.tempv1.set(thisFoot.origin()).sub(otherFoot.origin()).normalize();
        let otherFootHeading = this.tempv2.set(otherFoot.origin()).sub(thisFoot.origin()).normalize();
        let headHeading = head.getGlobalMBasis().getHeading(headPointAxis);
        //only rotate the foot if it's in the direction being looked at
        if(fromFootHeading.dot(headHeading) > otherFootHeading.dot(headHeading)) {
            return thisFoot.getHeading(footPointAxis).dot(headHeading) < 0.75;
        }
        return false;
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
        this.startTime = new Date().getMilliseconds();
        this.endTime = this.startTime + duration; 
    } 

    tempMatrix = new THREE.Matrix4();

    /**does a step of the interpolation */
    tick() {
        if(this.startTime == null) throw new Error("Start time required. call begin() before calling tick()");
        let currentTime = new Date().getMilliseconds();
        let t = (currentTime - this.startTime ) / ( this.endTime - this.startTime);
        t = Math.min(t, 1);
        if(t <1) {
            this.interpolated_Transform.adoptValues(this.start_globalTransform);
            this.interpolated_Transform.translate.lerp(this.goal_globalTransform.translate, t);
            this.interpolated_Transform.rotation.setFromRot(this.interpolated_Transform.rotation, this.goal_globalTransform, t);
            for(let i = 0; i<this.interpolated_Transform.skewMatrix_e.length; i++) {
                this.interpolated_Transform.skewMatrix_e[i] = this.lerp(this.start_globalTransform.skewMatrix_e[i], this.goal_globalTransform.skewMatrix_e[i], t);
            };
            this.interpolated_Transform.scale.lerp(this.goal_globalTransform.scale, t);        
            this.interpolated_Transform.lazyRefresh();
            this.interpolated_Transform.recompose();
            this.current.adoptGlobalValuesFromTransform(this.interpolated_Transform);
            if(this.onTick != null) this.onTick(this.current,this.start_globalTransform, this.goal_globalTransform);
        }
        if(t == 1) this.onComplete(this.current, this.start_globalTransform, this.goal_globalTransform);
    }

    onComplete(...params) {
        this._onComplete(...params);
        this.startTime = null;
        this.endTime = null;
    }


    lerp(v1, v2, t) {
        return ((v2-v1)*t)+v1;
    }
}