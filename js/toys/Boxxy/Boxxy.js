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

    tempRot=new Rot(1,0,0,0);
    hipsgeometry = new THREE.BoxGeometry(0.1,0.1,0.1);
    hipsmaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
    hips = new THREE.Mesh(this.hipsgeometry, this.hipsmaterial);
    balanceThreshold = 0.25;    
    coeffr = 0.75;
    coerel = 0.9;
    coefftilt = 0.9;
    maxStepDuration = 400; //ms
    minStepDuration = 400; //ms
    tempv = null;

    // Movement variables
    velocity = null;
    acceleration = null;
    tiltceleration = null;
    jerk = null;
    maxVelocity = 0.2;

    runVel = 0.05;
    walkVel = 0.025;
    terminalVel = this.walkVel; 
    walk_impetus = 0.0005;
    run_impetus =  0.001;
    impetus = this.walk_impetus;

    impetizer = null;
    yhead = null;

    /**@type {Foot}*/
    left_foot = null;
    /**@type {Foot}*/
    right_foot = null;

    clock = new THREE.Clock();
    frameCount = 0;

    downVec = new THREE.Vector3(0,-1,0);
    temp3V1 = new THREE.Vector3();
    temp3V2 = new THREE.Vector3();
    firstRun  = true;
    rayCaster = null;
    doWalkery = true;


    hipPos = null;
    closestToGravityHipDir = null;
    hipOnInterfootProjPlane = null; 
    leftFootPos = null;
    rightFootPos = null;
    footRay = new Ray(any_Vec3(), any_Vec3(), this.pool); //ray between the two feet positions;

    hipProjArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0,-1,0),
        1);

    

    /**
     * 
     * @param {Number} clearanceRatio 0-1 indicating how much of the total leg length to keep the hips above the ground
     * @param {Object3D} hipObj an object tracking your character's hip location
     * @param {Object3D} leftFootObj an object corresponding to your character's left foot
     * @param {Object3D} leftHipObj an object corresponding to where your character's left leg meets their hip
     * @param {Object3D} rightFootObj an object corresponding to your character's left foot
     * @param {Object3D} rightHipObj an object corresponding to where your character's right leg meets their hip
     */
    constructor(clearanceRatio, hipObj, leftFootObj, leftHipObj, rightFootObj, rightHipObj, pool = globalVecPool) {
        this.pool = pool;
        hipObj.getWorldPosition(this.temp3V1);
        this.hips.position.copy(this.temp3V1);
        this.hips.visible = false;
        this.hipPos = this.pool.new_Vec3(0,0,0); this.hipPos.readFromTHREE(this.hips.position);
        let leftAttach = this.pool.new_Vec3(0,0,0); leftAttach.readFromTHREE(leftHipObj.getWorldPosition(this.temp3V1)).sub(this.hipPos);
        let rightAttach = this.pool.new_Vec3(0,0,0); rightAttach.readFromTHREE(rightHipObj.getWorldPosition(this.temp3V1)).sub(this.hipPos);
        this.leftFootPos = this.pool.new_Vec3().readFromTHREE(leftFootObj.getWorldPosition(this.temp3V1));
        this.rightFootPos= this.pool.new_Vec3().readFromTHREE(rightFootObj.getWorldPosition(this.temp3V1));
        this.initPooledVecs();
        let current = leftFootObj; 
        this.legLength = 0;
        do {
            this.legLength += current.position.length();
            current = current.parent;
        } while(current != leftHipObj) 

        this.hipClearance = this.legLength * clearanceRatio;
        
        //if(legLength == null) this.legLength = this.clearanceRatio*1.25;
        
        this.left_foot = new Foot(undefined, this, this.leftFootPos, leftAttach, true);
        this.left_foot.foot.name = "Left foot mesh";
        this.left_foot.goal.name = "Left Goal";
        this.right_foot = new Foot(this.left_foot, this, this.rightFootPos, rightAttach, true);
        this.right_foot.foot.name = "Right foot mesh";
        this.right_foot.goal.name = "Right Goal";
        this.left_foot.otherFoot = this.right_foot;
        this.right_foot.plantedCol = 0xff8888;
        this.right_foot.foot.material.color.set(this.right_foot.plantedCol);
        
        this.startTime = Date.now();
        
        this.hipProjArrow.visible=false;
    }
    printfps() {
            console.log(`FPS: ${this.frameCount/((Date.now()-this.startTime)/1000)}`);
    }
    initPooledVecs() {
        this.tempv = this.pool.new_Vec3(0,0,0);
        this.velocity = this.pool.new_Vec3(0,0,0);
        this.acceleration = this.pool.new_Vec3(0, 0, 0);
        this.rotjerk = this.pool.new_Vec3(0,0,0);
        this.tiltceleration = this.pool.new_Vec3(0, 0, 0);
        this.jerk = this.pool.new_Vec3(0, 0, 0);
        this.impetizer = this.pool.new_Vec3(0, 0, 0);
        this.yhead = this.pool.new_Vec3(0,1,0);
        this.goalPos = this.pool.new_Vec3(0,1,0);

        this.closestToGravityHipDir = this.pool.new_Vec3(0,0,0); 
        this.gravityDirection = this.pool.new_Vec3(0, -10, 0);
        this.normedGravityDirection = this.gravityDirection.clone().normalize();
        this.normedGravityDirection.writeToTHREE(this.downVec);
        //this.downVec.multiplyScalar(1000);
        this.hipClearanceDir = this.gravityDirection.clone().mult(-1*this.hipClearance);
        this.propA = new Proposal(this.pool);
        this.propB = new Proposal(this.pool);
        this.projectionObj = new ProjectionsObj(this.leftFootPos, this.rightFootPos, this.hipPos,
        this.pool); 
        this.normedGravityRay = new Ray(this.pool.any_Vec3(), this.pool.any_Vec3(), this.pool);
        this.normedGravityRay.setHeading(this.normedGravityDirection);
        this.tempRay = new Ray(this.pool.any_Vec3(), this.pool.any_Vec3(), this.pool);
        this.prevPos = this.pool.new_Vec3();
    }

    get hipClearance() {return this._hipClearance;}
    set hipClearance(val) {
        this._hipClearance = val;
        this.hipClearanceDir.set(this.normedGravityDirection).mult(-1*this.hipClearance);
    }

    setGravityDirection(dir) {
        this.gravityDirection.readFromTHREE(dir);
        this.normedGravityDirection.set(this.gravityDirection).normalize();
        this.normedGravityRay.setHeading(this.normedGravityDirection);
        this.normedGravityDirection.writeToTHREE(this.downVec);
        this.downVec.normalize();
        this.hipClearanceDir.set(this.normedGravityDirection).mult(-1*this.hipClearance);
    }

    inferredUpdate(newPos) {
        this.hipsNode.mimic();
        this.jerk.set(newPos).sub(this.prevPos);
        this.jerk.normalize(false);
        this.jerk.mult(this.impetus);
        this.jerk.y = 0;
        this.jerked();
        //this.velocity.y = 0;
        //if(this.velocity.mag() > 0)
        //    debugger;
        this.update(this.doWalkery);
        this.hipsNode.origin(this.prevPos);
    }

    controlledUpdate(forwardVec, leftVec, doWalkery) {
        
        let starty = this.hipPos.y;
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
        if(isKeyPressed('KeyQ')) {
            this.hips.rotateY(0.01);
            this.hipsNode.mimic();
        }
        if(isKeyPressed('KeyE')) {
            this.hips.rotateY(-0.01);
            this.hipsNode.mimic();
        }
        if(isKeyPressed('KeyA')) 
            this.jerk.sub(leftVec);
        if(isKeyPressed('KeyD')) 
            this.jerk.add(leftVec);
        if(isKeyPressed('KeyS')) 
            this.jerk.sub(forwardVec);
        if(isKeyPressed('KeyW')) 
            this.jerk.add(forwardVec);
        

       
        //this.acceleration.clamp(0, 1.6);
        this.jerked();
        this.update(doWalkery);
    }

    jerked() {
        this.jerk.clamp(-this.impetus, this.impetus);
        this.acceleration.add(this.jerk);
        this.rotjerk.set(this.jerk).mult(50);
        this.tiltceleration.add(this.rotjerk);
        this.tiltceleration.clamp(0,104);
        this.velocity.mult(this.coeffr);
        this.velocity.add(this.acceleration);
        this.velocity.clamp(0, this.terminalVel);
        this.impetizer.set(this.tiltceleration).add(this.yhead).normalize();
        ///this.hipsNode.setGlobalOrientationTo(this.tempRot.setFromVecs(this.yhead, this.impetizer));//, impetizer);
        this.tiltceleration.mult(this.coefftilt);
        this.acceleration.mult(this.coerel);
    } 
     
    update(doWalkery) {
        this.frameCount++;
        this.hipsNode.mimic().updateGlobal();
        this.hipsNode.origin(this.hipPos);
        this.left_foot.footNode.mimic().updateGlobal();
        this.right_foot.footNode.mimic().updateGlobal();
        this.projectionObj.hipPos.set(this.hipPos);
        this.projectionObj.allDirty();
        
        
        //console.log(this.terminalVel);
        //console.log(this.velocity.mag());
        //this.velocity.writeToTHREE(this.temp3V1);
       
        
        
        this.hipsNode.translateByGlobal(this.velocity);
        this.hipsNode.origin(this.goalPos);
        
        this.hipsNode.project();
        

        if(doWalkery) {
            this.updateProjections();
            if(this.firstRun) {
                this.left_foot.plant();
                this.right_foot.plant();
                this.left_foot.update();
                this.right_foot.update();
                this.updateProjections();
                this.ensureHipClearance(1);
                this.firstRun = false;
                return;
            } else {
                this.ensureHipClearance(1);
            }
            let isBalanced = this.isInBalance();
            let isStable = this.isStable(isBalanced);
            let isStanding = this.isStanding();
            if(isStable) {
                if(isStanding == false) {
                    this.left_foot.plant(); this.right_foot.plant();
                    this.left_foot.update();
                    this.right_foot.update();
                }                
            } else if(isBalanced == false) { 
                if(isStanding) {
                    let bestFoot = this.getBestFoot();
                    bestFoot.unPlant(this.determineStepDuration());
                    bestFoot.toBalance();
                }
                 else if(!this.left_foot.isPlanted) {
                            this.left_foot.toBalance();
                } else if(!this.right_foot.isPlanted) {
                            this.right_foot.toBalance();
                }
            } else {
                if(!this.left_foot.isPlanted) {
                    this.left_foot.toBalance();
                } else if(!this.right_foot.isPlanted) {
                    this.right_foot.toBalance();
                }
                
            }
        }
        this.ensureHipClearance(1);
        let currY = this.hipPos.y;
        let dampenedY = 0.8*this.goalPos.y + 0.2*currY;
        this.hipsNode.translateTo(this.pool.any_Vec3(this.goalPos.x, dampenedY, this.goalPos.z))
        //this.hipsNode.origin().writeToTHREE(this.hipProjArrow.position);
        //let arrowDir = this.projectionObj.hipOnGround.clone().sub(this.hipsNode.origin());
        let itxres = this.pool.any_Vec3(); 
        /*let arrowDir = itxres.clone().set(this.projectionObj.hipOnGround).sub(this.hipsNode.origin());
        this.hipProjArrow.setLength(arrowDir.mag());
        this.hipProjArrow.setDirection(arrowDir.normalize());
        this.hipProjArrow.position.copy(this.hipsNode.origin());*/


        this.hipProjArrow.position.copy(this.projectionObj.hipOnGround);
        this.hipProjArrow.setDirection(this.projectionObj.hipGroundNormal.normalize());
        
        this.left_foot.projectionObj.allDirty();
        this.right_foot.projectionObj.allDirty();
        this.hipsNode.project();
    }

    
    

    determineStepDuration() {
        return this.maxStepDuration;
    }


    princess_power = 5 //controls sensitivity to discomfort
    lastchosen = null;
    /**determines which foot to move. 
     * this is defined as first, whichever foot is most outside of the allowable distance from the hips
     * and second "whichever foot would have to move the least to keep the character balanced"
     */
    getBestFoot() {        
        let leftProposal = this.left_foot.generateProposal();
        let rightProposal = this.right_foot.generateProposal();
        let leftDiscomfort = (leftProposal.expected_discomfort+1)*(leftProposal.expected_discomfort+1);
        let rightDiscomfort = (rightProposal.expected_discomfort+1)*(rightProposal.expected_discomfort+1);
        let leftProposalBalanceScore = this.penalizeProposalByBalance(leftProposal, this.projectionObj.otherFootVec_proj);
        let leftTravelDist = 1/leftProposal.launch_transform.origin().dist(leftProposal.proposed_foot_transform.origin());
        let rightProposalBalanceScore = this.penalizeProposalByBalance(rightProposal, this.projectionObj.firstFootVec_proj);
        let rightTravelDist = 1/rightProposal.launch_transform.origin().dist(rightProposal.proposed_foot_transform.origin());
        let leftCrossPenalty = this.penalizeProposalByDirection(leftProposal, this.left_foot);
        let rightCrossPenalty = this.penalizeProposalByDirection(rightProposal, this.right_foot);

        let leftfatiguedelta = Math.max(0, leftProposal.fatigue - rightProposal.fatigue)+1;
        let rightfatiguedelta = Math.max(0, rightProposal.fatigue - leftProposal.fatigue)+1;

        let normedScores = this.normProposalScores(
            ((this.princess_power*leftDiscomfort)+(leftProposalBalanceScore+1))*leftfatiguedelta*leftCrossPenalty,
            ((this.princess_power*rightDiscomfort)+(rightProposalBalanceScore+1))*rightfatiguedelta*rightCrossPenalty);
        /*let normedScores = this.normProposalScores(
            leftTravelDist,
            rightTravelDist);*/

        let chosen = this.right_foot;
        let chosenProposal = rightProposal;
        let chosenBal = rightProposalBalanceScore;
        let notChosen = this.left_foot;
        let notChosenProposal = leftProposal;
        let notChosenBal = leftProposalBalanceScore;
        if(normedScores < 0.5) {
            chosen = this.left_foot;
            chosenProposal = leftProposal; 
            chosenBal = leftProposalBalanceScore;
            notChosen = this.right_foot;
            notChosenProposal = rightProposal;
            notChosenBal = rightProposalBalanceScore;
        }

        /*if(chosen == this.lastchosen) {
            console.group(`Double lift of ${chosen.foot.name} because`); 
                console.log(`Total score is left: ${(1-normedScores).toFixed(4)}, right: ${normedScores.toFixed(4)}`);
                console.group(`discomforts are: `);
                    console.log(`${chosen.foot.name}.expected_discomfort is ${chosenProposal.expected_discomfort}`)
                    console.log(`${notChosen.foot.name}.expected_discomfort is ${notChosenProposal.expected_discomfort}`);
                console.groupEnd('discomforts are: ');
                console.group(`balances are: `);
                    console.log(`${chosen.foot.name}.balance is ${chosenBal}`)
                    console.log(`${notChosen.foot.name}.balance is ${notChosenProposal.expected_discomfort}`);
                console.groupEnd('balances are: ');
            console.groupEnd(`Double lift of ${chosen.foot.name} because`);
        }*/


        this.lastchosen = chosen;
        return chosen;
    }

    /**
     * projects an offplane point onto a plane perpendicular to the direction of gravity and going through the inplane vector
     * @param {Vec3} inPlane 
     * @param {Vec3} offPlane 
     */
    gravPlaneProjectThrough(inPlane, offPlane, storeIn) {
        return this.normedGravityRay.translateTo(inPlane).planeProject(offPlane, storeIn);
    }
    
    /**scores a proposal by how far off balance the result would be. higher score is worse. score of 1 corresponds to the balance threshold*/
    penalizeProposalByBalance(proposal, otherFootPos) {
        let hipPos = proposal.presumed_hip_transform.origin();
        let proposedFootProj = this.gravPlaneProjectThrough(hipPos, proposal.proposed_foot_transform.origin());
        let otherFootProj = this.gravPlaneProjectThrough(hipPos, otherFootPos);
        let balancePoint = this.pool.any_Vec3fv(proposedFootProj).add(otherFootProj).mult(0.5);
        let thresh = Math.abs(this.balanceThreshold == 0 ? 0.000001 : this.balanceThreshold); //if it has that tight a threshold, it has no business on two legs.
        let balanceDist = balancePoint.dist(hipPos); //we've already projected onto the hip position on a plane perpendicular to the direction of gravity so this is fine
        return Math.max(0, (balanceDist/thresh)-1);
    }

    penalizeProposalByDirection(proposal, forfoot) {
        let hipOnGround = this.projectionObj.hipOnGround;
        let footOnGround = proposal.proposed_foot_transform.origin(); 
        let footHeading = this.tempv.set(footOnGround).sub(hipOnGround);
        let dotted = -1*footHeading.dot(forfoot.attachHeading);
        dotted = Math.max(dotted, 0) + 1; 
        return dotted * dotted * dotted;
    }

    /**returns true if the projections of both feet are planted equidistant and colinear to the projected center of mass, and the velocity is low enough that this will likely continue to be the case*/
    isInBalance() {
        if(this.velocity.mag() > this.terminalVel/20) return false;         
        if(this.projectionObj.hipOnInterfootProjPlane.dist(this.projectionObj.hipOnInterfootProjPlane) > this.balanceThreshold) return false;
        let leftDist = this.left_foot.getHipDistance();
        let rightDist = this.right_foot.getHipDistance(); 
        if(leftDist > this.legLength || rightDist > this.legLength) return false;
        
        //center of mass is beyond one of the feet.
        //if(this.leftFootPos.sub(this.closestToGravityHipDir).dot(this.rightFootPos.sub(this.closestToGravityHipDir)) > 0) return false;

        this.propA.reset().unlock();
        this.propA.presumed_hip_transform.adoptValues(this.hipsNode.getGlobalMBasis());
        this.propA.proposed_foot_transform.adoptValues(this.left_foot.footNode.getGlobalMBasis());
        let balanceScore = this.penalizeProposalByBalance(this.propA.lock(), this.rightFootPos);
        this.propA.reset().lock();
        if(balanceScore > 1) return false;
        return true;
    }

    /**returns true if both feet are planted */
    isStanding() {
        return this.left_foot.isPlanted && this.right_foot.isPlanted;
    }

    /**returns true if the center of mass velocity is extremely low and isInBalance is true and the startpositions and end positions of either foot are extremely low */
    isStable(isInBalance = undefined) {
        if(isInBalance == undefined) isInBalance = this.isInBalance();
        if(!isInBalance) return false;
        if(this.velocity.mag() > this.terminalVel/50) return false; 
        if(!this.left_foot.isPlanted) {
            let leftMoveDist = this.left_foot.interpoler.start_globalTransform.translate.dist(this.left_foot.interpoler.goal_globalTransform.translate);
            if(leftMoveDist > this.terminalVel/50) return false;
        } 
        if(!this.right_foot.isPlanted) {
            let rightMoveDist = this.right_foot.interpoler.start_globalTransform.translate.dist(this.right_foot.interpoler.goal_globalTransform.translate);
            if(rightMoveDist > this.terminalVel/50) return false;
        }
        return true; 
    }

    /**sets the walker position values into the provided vec3s. the forecast parameter adds the current velocity to the hips before computing the projection*/
    getProjections(forecast, probj) {
        if(probj.hipsProjDirty) {
            probj.hipGravRay.p1.set(this.velocity).mult(1+parseInt(forecast/window.frtime)).add(probj.hipPos);
            probj.future_hipPos.set(probj.hipGravRay.p1);
            let pinfo = this.projectToGround(probj.hipGravRay.p1, probj.hipGravRay.p2);
            probj.hipOnGround.set(probj.hipGravRay.p2);
            probj.hipGroundNormal.readFromTHREE(pinfo.normal); 
        }
        if(probj.feetProjDirty) {
            probj.footRay.setP1(probj.firstFootPos); 
            probj.footRay.setP2(probj.otherFootPos);
            let projInfo = this.projectToGround(probj.footRay.p1, probj.footRay.p1);
            probj.firstFootVec_proj.set(probj.footRay.p1);
            probj.firstFootVec_norm.readFromTHREE(projInfo.normal);
            projInfo = this.projectToGround(probj.footRay.p2, probj.footRay.p2);
            probj.otherFootVec_proj.set(probj.footRay.p2);
            probj.otherFootVec_norm.readFromTHREE(projInfo.normal);
        }

        if(probj.feetProjDirty || probj.hipsProjDirty) {
            probj.footRay.closestPointToRay3D(probj.hipGravRay, probj.closestToGravityHipDir);
            probj.hipGravRay.closestPointToRay3D(probj.footRay, probj.hipOnInterfootProjPlane);
            probj.hipOnInterfootProjPlane.bound(probj.footRay.p1, probj.footRay.p2);
            probj._internal_ray.setP1(probj.firstFootVec_proj).setHeading(this.normedGravityDirection);
            probj._internal_ray.planeProject(probj.future_hipPos, probj.hipOnFirstFootPlane);
            probj._internal_ray.setP1(probj.otherFootVec_proj).setHeading(this.normedGravityDirection);
            probj._internal_ray.planeProject(probj.future_hipPos, probj.hipOnOtherFootPlane);
        }
        probj.hipsProjDirty = false; 
        probj.feetProjDirty = false;
    }

    groundObjects = [];
    addGroundObjects(objs) {
        this.groundObjects.push(...objs);
    }

    updateProjections() {
        this.left_foot.footNode.origin(this.leftFootPos);
        this.right_foot.footNode.origin(this.rightFootPos);
        this.hipsNode.origin(this.hipPos);
        this.projectionObj.allDirty();
        this.getProjections(0, this.projectionObj);
    }

    defaultNorm= {normal: new THREE.Vector3(0,1,0)};

    /**returns the input vector projection on the scene's ground/terrain */
    projectToGround(invec, outvec) {
        this.hipClearanceDir.writeToTHREE(this.intrxVec).multiplyScalar(1);
        this.intrxVec.add(invec);// just some buffer in case we're starting below the ground.
        
        this.rayCaster.set(this.intrxVec, this.downVec);
        let intrxRes = this.rayCaster.intersectObjects(this.groundObjects);
        for(let r of intrxRes) {
            r.normal.applyQuaternion(r.object.quaternion);
            if(r.normal.dot(this.downVec) < -0.5) {
                outvec.readFromTHREE(r.point);    
                return r;
            } else break;
        }
        return this.defaultNorm;
        //outvec.setComponents(invec.x, 0, invec.z);
    }

    /**ensures the hip is high enough off the ground. set stride scalar to 0 if you want to force the feet to touch the ground*/
    ensureHipClearance(strideScalar = 1) {
        let groundClearance = this.propA.reset().unlock(); 
        let strideClearance = this.propB.reset().unlock();
        
        this.hipsNode.mimic();
        this.tempv.set(this.projectionObj.hipOnGround)
        groundClearance.presumed_clearance_point.set(this.tempv);
        this.tempv.add(this.hipClearanceDir);

        groundClearance.presumed_hip_transform.adoptValues(this.hipsNode.getGlobalMBasis());
        groundClearance.presumed_hip_transform.translateTo(this.tempv);
        let avgDot = 0;
        let tempv2 = this.pool.any_Vec3fv(this.tempv);
        avgDot = tempv2.sub(this.projectionObj.firstFootVec_proj).normalize().dot(this.normedGravityDirection);
        avgDot += tempv2.set(this.tempv).sub(this.projectionObj.otherFootVec_proj).normalize().dot(this.normedGravityDirection);
        avgDot /=2;

        let newOrig = this.hipsNode.origin();
        strideClearance.presumed_clearance_point.set(this.projectionObj.hipOnInterfootProjPlane);
        this.tempv.set(this.projectionObj.hipOnInterfootProjPlane).add(this.hipClearanceDir);
        strideClearance.presumed_hip_transform.adoptValues(this.hipsNode.getGlobalMBasis());
        strideClearance.presumed_hip_transform.translateTo(this.tempv);

        let groundPenalty = this.penalizeProposalByHipAndFoot(groundClearance.lock(), this.projectionObj.firstFootVec_proj, this.projectionObj.otherFootVec_proj);
        if(avgDot > 0) groundPenalty *= 99999; 
        let stridePenalty = this.penalizeProposalByHipAndFoot(strideClearance.lock(), this.projectionObj.firstFootVec_proj, this.projectionObj.otherFootVec_proj);
        let proposalScore = this.normProposalScores(groundPenalty, stridePenalty);
        proposalScore *= strideScalar;
        
        /**interpolate between the two proposals in accordance with their relative scores */
        this.tempv.set(groundClearance.presumed_hip_transform.origin());
        this.tempv.lerp(strideClearance.presumed_hip_transform.origin(), proposalScore);
        this.hipsNode.translateTo(this.tempv);
    
        this.hipsNode.project();
        this.hipsNode.origin(this.hipPos);
    }

    /**
     * returns a combined penalty for a proposal based linearly on how far the hip would be from its clearance projection point on the plane perpendicular to gravity and quadratically on how much the legs would need to hyperexgtend.
     * @param {Proposal} proposal 
     * @param {Vec3} leftFootPos 
     * @param {Vec3} rightFootPos 
     * @returns 
     */
    penalizeProposalByHipAndFoot(proposal, leftFootPos, rightFootPos) {
        let hipScore = this.penalizeProposalByHipDist(proposal) + 1;
        let legScore = this.penalizeProposalByLegDist(proposal, leftFootPos, rightFootPos) + 1;
        return (hipScore*legScore)-1;
    }



    /**returns a penalty for a proposal based on how far the hip would be from its clearance projection point on the plane perpendicular to gravity. Penalty is linear.
     * 
     * @return a value from 0 to infinity, with 0 indicating no penalty, and infinity indicating something has gone tragically wrong
    */
    penalizeProposalByHipDist(proposal) {
        let hipPos = proposal.presumed_hip_transform.origin();
        this.tempRay.setP1(proposal.presumed_clearance_point).setHeading(this.normedGravityDirection);
        let hipProjection = this.gravPlaneProjectThrough(proposal.presumed_clearance_point, hipPos);
        let hipPenalty = (hipPos.dist(hipProjection)/this.hipClearance);
        return hipPenalty-1;
    }

    /**returns a penalty for a proposal based on how far the feet would be from the hips. Penality is applied linearly, distance is measured from projection on plane perpendicular to gravity through the clearance point. Penalizes harshly (quadratically) any proposal that requires hyper extension, penalizes mildly (linearly) proposals failure to maintain hipClearance from a provided clearance point.
     * 
     * @return a value from 0 to infinity, with 0 indicating no penalty, and infinity indicating something has gone tragically wrong
    */
    penalizeProposalByLegDist(proposal, leftFootPos, rightFootPos) {
        let hipPos = proposal.presumed_hip_transform.origin();
        let propLeftFootDist = hipPos.dist(leftFootPos);
        let propRightFootDist = hipPos.dist(rightFootPos); 
        let maxDist = Math.max(propLeftFootDist, propRightFootDist);
        let legPenalty = maxDist <= this.legLength ? 1 : (maxDist/this.legLength);
        return (legPenalty*legPenalty)-1;
    }

    /**
     * note that the input scores are expect to be of
     * @return a value from 0 to 1, with 0 indicating full support for the proposal resulting in penaltyA, and 1 indicating full support for the proposal resulting in penaltyB.
    */
    normProposalScores(penaltyA, penaltyB) {
        if(penaltyA == 0 && penaltyB == 0) return 0.5; 
        return Math.max(0, Math.min((1-penaltyA) / ((1-penaltyA) + (1-penaltyB)), 1));
    }

    
    intrxVec = new THREE.Vector3(0,0,0);
    addTo(scene, groundObjects) {
        scene.add(this.hips);
        scene.add(this.hipProjArrow);
        this.hipsNode = new ShadowNode(this.hips, "hipNode", this.pool);
        this.left_foot.addTo(scene); 
        this.right_foot.addTo(scene);
        this.rayCaster = new THREE.Raycaster(this.hips.position.clone(), this.downVec.clone());
        this.hipsNode.mimic();

        if(groundObjects != null) {
            for(let g of groundObjects) {
                g.updateWorldMatrix(true,true);
            }
            this.addGroundObjects(groundObjects);
            this.updateProjections();
        }
        
        this.ensureHipClearance(0);
        this.left_foot.plant();
        this.right_foot.plant();
        this.hipsNode.origin(this.prevPos);
    }

    /**does a couple of plant and update passes to prealign to the ground */
    preAlign() {
        this.right_foot.unPlant(); this.right_foot.update(); this.right_foot.plant();
        this.left_foot.unPlant(); this.left_foot.update(); this.left_foot.plant();
    }


    hide() {
        this.hips.visible = false;
        this.hideFeet();
    }

    show() {
        this.showHips();
        this.showGoals();
    }


    showHips() {
        this.hips.visible = true;
    }

    showFeet() {
        this.left_foot.foot.visible = true;
        this.right_foot.foot.visible = true;
    }

    showGoals(showFeet=true) {
        if(showFeet)this.showFeet();
        this.left_foot.goal.visible = true;
        this.left_foot.showGoals = true;
        this.right_foot.goal.visible = true;
        this.right_foot.showGoals = true;
    }

    hideFeet() {
        this.left_foot.foot.visible = false;
        this.right_foot.foot.visible = false;
        this.hideGoals();
    }

    hideGoals() {
        this.left_foot.goal.visible = false;
        this.right_foot.goal.visible = false;
        this.right_foot.showGoals = false;
        this.left_foot.showGoals = false;
    }
}


/**contains results of Boxxy.getProjections */
export class ProjectionsObj {
    /**stuff that DOES NOT get written to by the projection call: */
    /**physical foot locations. Does not get written to*/
    firstFootPos = null; otherFootPos = null;
    hipsPos = null;

    /**stuff that does get written to by the projections*/
    future_hipPos = null; 
    future_hipPos_proj = null;
    firstFootVec_proj = null;
    firstFootVec_norm = null;
    otherFootVec_proj = null;
    otherFootVec_norm = null;
    closestToGravityHipDir = null; 
    hipOnInterfootProjPlane = null;
    hipOnFirstFootProjPlane = null;
    hipOnOtherFootProjPlane = null;
    hipOnGround = null;
    footRay = null;
    tempFootRay = null;
    hipGravRay = null
    feetProjDirty = true;
    _feetProjDirty = true;
    hipsProjDirty = true;


    _internal_ray = null;
    constructor(firstFootPos_ref, otherFootPos_ref, hipPos_ref, pool) {
        this.pool = pool;
        this.firstFootPos = firstFootPos_ref;
        this.otherFootPos = otherFootPos_ref;
        this.hipPos = hipPos_ref;
        this.future_hipPos = this.pool.new_Vec3();
        this.future_hipPos_proj = this.pool.new_Vec3();
        this.firstFootVec_proj = this.pool.new_Vec3();
        this.firstFootVec_norm = this.pool.new_Vec3();
        this.otherFootVec_proj = this.pool.new_Vec3();
        this.otherFootVec_norm = this.pool.new_Vec3();
        this.closestToGravityHipDir = this.pool.new_Vec3();
        this.hipOnInterfootProjPlane = this.pool.new_Vec3();
        this.hipOnFirstFootPlane = this.pool.new_Vec3();
        this.hipOnOtherFootPlane = this.pool.new_Vec3();
        this.hipOnGround = this.pool.new_Vec3();
        this.hipGroundNormal = this.pool.new_Vec3();
        this.footRay = new Ray(this.pool.any_Vec3(), this.pool.any_Vec3(), this.pool);
        this.tempfootRay = new Ray(this.pool.any_Vec3(), this.pool.any_Vec3(), this.pool);
        this.hipGravRay = new Ray(this.pool.any_Vec3(), this.pool.any_Vec3(), this.pool);         
        this._internal_ray = new Ray(this.pool.any_Vec3(), this.pool.any_Vec3(), this.pool);
    }

    allDirty() {
        this.feetProjDirty = true; this.hipsProjDirty = true;
    }

    get feetProjDirty() {return this._feetProjDirty;}

    set feetProjDirty(val) {
        this._feetProjDirty = val;
        if(val == false) {
            this.tempfootRay.set(this.footRay);
        }
    }

}

export class Proposal {
    /**@type {IKTransform} indicates the starting position/orientation the foot launched from**/
    _launch_transform;
    /**@type {IKTransform} indicates the current position/orientation of the foot.**/
    _current_foot_transform;
     //the two variables above should always be identical if one foot is always on the ground

    /**@type {Boolean} currently always false, but if true is ever supported, current foot position and launch position will differ */
     _mid_stride;
     /**@type {IKTransform} indicates the proposed position/orientation of the foot**/
     _proposed_foot_transform;
     /**@type {Number} indicates the expected comfort of the armature should the proposal be adopted*/
     _expected_discomfort;
     /**@type {Number} indicates the number of times the foot has been lifted*/
     _fatigue;
     /** @type {Vec3} probably not used by feet, but other proposals make use of this to score hip clearance*/
     _presumed_clearance_point 
     _presumed_hip_transform; // IKtransform, same situation as above

    constructor(pool) {
        this.pool = pool;
        this._launch_transform= IKTransform.newPooled(this.pool);
        this._current_foot_transform= IKTransform.newPooled(this.pool);
        this._mid_stride= false;
        this._proposed_foot_transform= IKTransform.newPooled(this.pool);
        this._expected_discomfort= 999;
        this._fatigue = -1;
        this._presumed_clearance_point = this.pool.any_Vec3();
        this._presumed_hip_transform = IKTransform.newPooled(this.pool);
    }

    reset() {
        this.islaunch_transform_set = false;
        this.iscurrent_foot_transform_set = false;
        this.isnew_foot_transform_set = false;
        this.isproposed_foot_transform_set = false;
        this.ismidstride_set = false;
        this.isexpected_discomfort_set = false; 
        this.ispresumed_clearance_point_set = false; 
        this.ispresumed_hip_transform_set = false;
        return this;
    }
    lock() {
        this.unlocked = false;
        return this;
    }
    unlock() {
        this.unlocked = true;
        return this;
    }

    get mid_stride() {
        if(this.unlocked) {
            this.ismidstride_set = true;
            return this._mid_stride;
        }
        else if(this.ismidstride_set) return this._mid_stride;
        return null;
    }
    set mid_stride(val) {
        if (this.unlocked) {
            this._mid_stride = val;
            this.islaunch_transform_set = true;
        }
    }

    get launch_transform() {
        if (this.unlocked) {
            this.islaunch_transform_set = true;
            return this._launch_transform;
        } else if (this.islaunch_transform_set) {
            return this._launch_transform;
        }
        return null;
    }

    set launch_transform(value) {
        if (this.unlocked) {
            this._launch_transform.adoptValues(value);
            this.islaunch_transform_set = true;
        }
    }

    get current_foot_transform() {
        if (this.unlocked) {
            this.iscurrent_foot_transform_set = true;
            return this._current_foot_transform;
        } else if (this.iscurrent_foot_transform_set) {
            return this._current_foot_transform;
        }
        return null;
    }

    set current_foot_transform(value) {
        if (this.unlocked) {
            this._current_foot_transform.adoptValues(value);
            this.iscurrent_foot_transform_set = true;
        }
    }

    get proposed_foot_transform() {
        if (this.unlocked) {
            this.isproposed_foot_transform_set = true;
            return this._proposed_foot_transform;
        } else if (this.isproposed_foot_transform_set) {
            return this._proposed_foot_transform;
        }
        return null;
    }

    set proposed_foot_transform(value) {
        if (this.unlocked) {
            this._proposed_foot_transform.adoptValues(value);
            this.isproposed_foot_transform_set = true;
        }
    }

    get expected_discomfort() {
        if (this.unlocked) {
            this.isexpected_discomfort_set = true;
            return this._expected_discomfort;
        } else if (this.isexpected_discomfort_set) {
            return this._expected_discomfort;
        }
        return null;
    }

    set expected_discomfort(value) {
        if (this.unlocked) {
            this._expected_discomfort = value;
            this.isexpected_discomfort_set = true;
        }
    }

    get fatigue() {
        if (this.unlocked) {
            this.isfatigue_set = true;
            return this._fatigue;
        } else if (this.isfatigue_set) {
            return this._fatigue;
        }
        return null;
    }

    set fatigue(value) {
        if (this.unlocked) {
            this._fatigue = value;
            this.isfatigue_set = true;
        }
    }

    get presumed_clearance_point() {
        if (this.unlocked) {
            this.ispresumed_clearance_point_set = true;
            return this._presumed_clearance_point;
        } else if (this.ispresumed_clearance_point_set) {
            return this._presumed_clearance_point;
        }
        return null;
    }

    set presumed_clearance_point(value) {
        if (this.unlocked) {
            this._presumed_clearance_point.readFromTHREE(value);
            this.ispresumed_clearance_point_set = true;
        }
    }

    get presumed_hip_transform() {
        if (this.unlocked) {
            this.ispresumed_hip_transform_set = true;
            return this._presumed_hip_transform;
        } else if (this.ispresumed_hip_transform_set) {
            return this._presumed_hip_transform;
        }
        return null;
    }

    set presumed_hip_transform(value) {
        if (this.unlocked) {
            this._presumed_hip_transform.adoptValues(value);
            this.ispresumed_hip_transform_set = true;
        }
    }
}