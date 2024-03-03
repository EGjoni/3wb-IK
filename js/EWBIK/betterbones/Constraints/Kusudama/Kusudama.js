import { IKTransform } from "../../../util/IKTransform.js";
const THREE = await import('three')
import { Bone } from 'three';
import { Rot } from "../../../util/Rot.js";
import { Vec3, any_Vec3, new_Vec3 } from "../../../util/vecs.js";
import { Ray } from "../../../util/Ray.js";
import { IKNode } from "../../../util/IKNodes.js";
import { generateUUID } from "../../../util/uuid.js";
import { Constraint } from "../Constraint.js";

export class Kusudama extends Constraint {
    
    static TAU = Math.PI * 2;
    static PI = Math.PI;
    static totalKusudamas = 0;
    

    constructor(forBone = null, ikd = 'Kusudama-'+(Kusudama.totalKusudamas+1)) {
        if(!forBone?.parent instanceof THREE.Bone) { 
            throw new Error("Root bones may not specify a constraint. Add this bone to a parent before attempting to register a constrain on it.");
        }
        this.ikd = ikd;
        Kusudama.totalKusudamas +=1;
        this.directionAxes = this.maybeCreateOrientationAxes();
        this.twistAxes = this.maybeCreateTwistAxes();
        this.painfulness = 0.0;
        this.cushionRatio = 0.1;
        this.limitCones = [];
        this.minAxialAngle = Math.PI;
        this.range = Math.PI * 3;
        this.orientationallyConstrained = false;
        this.axiallyConstrained = false;
        this.strength = 1.0;
        this.forBone = forBone;
        this.twistMinRot = new Rot();
        this.twistRangeRot = new Rot();
        this.twistMaxRot = new Rot();
        this.twistHalfRangeRot = new Rot();
        this.twistCentRot = new Rot();
        this.boneRay = new Ray(new_Vec3(), new_Vec3());
        this.constrainedRay = new Ray(new_Vec3(), new_Vec3());
        this.twistMinVec = new_Vec3(0, 0, 1);
        this.twistMaxVec = new_Vec3(0, 0, 1);
        this.twistCenterVec = new_Vec3(0, 0, -1);
        this.twistHalfRangeHalfCos = -0.5;
        this.flippedBounds = false;
        this.forBone.constraint = this;                

        if (forBone) {            
            this.limitingAxes = new IKNode(); 
            this.limitingAxes.getLocalMBasis().translateTo(new Vec3(this.forBone.position));
            this.twistAxes = this.limitingAxes.attachedCopy(false);
            this.forBone.addConstraint(this); 
            this.enable();
        }
    }

    constraintUpdateNotification() {
        this.updateTangentRadii();
        this.updateRotationalFreedom(); 
    }

    optimizeTwistAxes() {
        let directions = [];
        if (this.getLimitCones().length === 1) {
            directions.push(this.limitCones[0].getControlPoint().copy());
        } else {
            let thisC = this.getLimitCones()[0];
            directions.push(thisC.getControlPoint().copy().mult(thisC.getRadius()));
            for (let i = 0; i < this.getLimitCones().length - 1; i++) {
                thisC = this.getLimitCones()[i];
                let nextC = this.getLimitCones()[i + 1];
                let thisCp = thisC.getControlPoint().copy();
                let nextCp = nextC.getControlPoint().copy();
                let thisToNext = new Rot(thisCp, nextCp); 
                let halfThisToNext = new Rot(thisToNext.getAxis(), thisToNext.getAngle() / 2);

                let halfAngle = halfThisToNext.applyToCopy(thisCp);
                halfAngle.normalize();
                halfAngle.mult((thisC.getRadius() + nextC.getRadius()) / 2 + thisToNext.getAngle());
                directions.push(halfAngle);
                directions.add(nextCp.mult(nextC.getRadius()));
            }
        }

        let newY = new_Vec3();
        directions.forEach(dv => {
            newY.add(dv);
        });
        newY.normalize();

        let newYRay = new Ray(new_Vec3(0, 0, 0), newY);

        let oldYtoNewY = new Rot(this.swingOrientationAxes().yRay().heading(), this.swingOrientationAxes().getGlobalOf(newYRay).heading());
        this.twistAxes.alignOrientationTo(this.swingOrientationAxes());
        this.twistAxes.rotateBy(oldYtoNewY);
        this.updateTangentRadii();
    }

    updateTangentRadii() {
        for (let i = 0; i < this.limitCones.length; i++) {
            let next = i < this.limitCones.length - 1 ? this.limitCones[i + 1] : null;
            this.limitCones[i].updateTangentHandles(next); 
        }
    }

    snapToLimits() {
        if (this.orientationallyConstrained) {
            this.setAxesToOrientationSnap(this.attachedTo().localAxes(), this.swingOrientationAxes()); 
        }
        if (this.axiallyConstrained) {
            this.snapToTwistLimits(this.attachedTo().localAxes(), this.twistOrientationAxes()); 
        }
    }

    setAxesToOrientationSnap(toSet, limitingAxes) {
        let inBounds = [1.0];
        limitingAxes.updateGlobal();
        this.boneRay.p1.set(limitingAxes.origin());
        this.boneRay.p2.set(toSet.y().p2);
        let bonetip = limitingAxes.getLocalOf(toSet.yRay().p2).copy();
        let inLimits = this.pointInLimits(bonetip, inBounds, AbstractLimitCone.BOUNDARY);

        if (inBounds[0] === -1 && inLimits !== null) {
            this.constrainedRay.p1.set(this.boneRay.p1);
            this.constrainedRay.p2.set(limitingAxes.getGlobalOf(inLimits));
            let rectifiedRot = new Rot(this.boneRay.heading(), this.constrainedRay.heading());
            toSet.rotateBy(rectifiedRot);
            toSet.updateGlobal();
        }
    }

    snapToTwistLimits(toSet, twistAxes) {
        if (!this.axiallyConstrained) return 0.0;
        let globTwistCent = twistAxes.getGlobalMBasis().rotation.applyTo(this.twistCentRot);
        let alignRot = globTwistCent.applyInverseTo(toSet.getGlobalMBasis().rotation);
        let decomposition = alignRot.getSwingTwist(new_Vec3(0, 1, 0));
        decomposition[1].rotation.clampToQuadranceAngle(this.twistHalfRangeHalfCos);
        let recomposition = decomposition[0].applyTo(decomposition[1]);
        toSet.getParentAxes().getGlobalMBasis().inverseRotation.applyTo(globTwistCent.applyTo(recomposition), toSet.localMBasis.rotation);
        toSet.localMBasis.refreshPrecomputed();
        toSet.markDirty();
        return 0;
    }

    setAxesToReturnfulled(toSet, currentOrientation, swingAxes, twistAxes, cosHalfReturnfullness, angleReturnfullness) {
        if (swingAxes !== null && this.painfulness > 0.0) {
            if (this.orientationallyConstrained) {
                let origin = toSet.origin();
                let inPoint = toSet.yRay().p2.copy();
                let pathPoint = this.pointOnPathSequence(inPoint, swingAxes);
                inPoint.sub(origin);
                pathPoint.sub(origin);
                let toClamp = new Rot(inPoint, pathPoint);
                toClamp.rotation.clampToQuadranceAngle(cosHalfReturnfullness);
                toSet.rotateBy(toClamp);
            }
            if (this.axiallyConstrained) {
                let angleToTwistMid = this.angleToTwistCenter(toSet, twistAxes);
                let clampedAngle = MathUtils.clamp(angleToTwistMid, -angleReturnfullness, angleReturnfullness);
                toSet.rotateAboutY(clampedAngle, false);
            }
        }
    }

    setAxialLimits(minAngle, inRange) {
        this.minAxialAngle = minAngle;
        this.range = inRange;
        let y_axis = new_Vec3(0, 1, 0);
        this.twistMinRot = new Rot(y_axis, this.minAxialAngle);
        this.twistMinVec = this.twistMinRot.applyToCopy(new_Vec3(0, 0, 1));

        this.twistHalfRangeHalfCos = Math.cos(inRange / 4);
        this.twistRangeRot = new Rot(y_axis, this.range);

        this.twistMaxVec = this.twistRangeRot.applyToCopy(this.twistMinVec);

        this.twistHalfRangeRot = new Rot(y_axis, this.range / 2);
        this.twistCenterVec = this.twistHalfRangeRot.applyToCopy(this.twistMinVec);
        this.twistCentRot = new Rot(new_Vec3(0, 0, 1), this.twistCenterVec);

        this.constraintUpdateNotification();
    }

    setTwist(ratio, toSet) {
        let globTwistCent = new Rot();
        this.twistAxes.getGlobalMBasis().applyTo(this.twistMinRot, globTwistCent);
        let alignRot = globTwistCent.applyInverseTo(toSet.getGlobalMBasis().rotation);
        let decomposition = alignRot.getSwingTwist(new_Vec3(0, 1, 0));
        let goal = new Rot(this.twistHalfRangeRot.getAxis(), 2 * this.twistHalfRangeRot.getAngle() * ratio);
        let toGoal = goal.applyTo(alignRot.getInverse());
        let achieved = toGoal.applyTo(alignRot);
        decomposition[1] = achieved;
        let recomposition = decomposition[0].applyTo(decomposition[1]);
        toSet.getParentAxes().getGlobalMBasis().inverseRotation.applyTo(globTwistCent.applyTo(recomposition), toSet.localMBasis.rotation);
        toSet.localMBasis.refreshPrecomputed();
        toSet.markDirty();
    }

    getTwistRatio(toGet, twistAxes) {
        let globTwistCent = new Rot();
        twistAxes.getGlobalMBasis().applyTo(this.twistCentRot, globTwistCent);
        let centAlignRot = globTwistCent.applyInverseTo(toGet.getGlobalMBasis().rotation);
        let centDecompRot = centAlignRot.getSwingTwist(new_Vec3(0, 1, 0));
        let locZ = centDecompRot[1].applyToCopy(new_Vec3(0, 0, 1));
        let loctwistMaxVec = twistCentRot.getInverse().applyToCopy(this.twistMaxVec);
        let loctwistMinVec = twistCentRot.getInverse().applyToCopy(this.twistMinVec);
        let toMax = new Rot(locZ, loctwistMaxVec);
        let fromMin = new Rot(locZ, loctwistMinVec);
        let toMaxAngle = toMax.getAngle();
        let minToAngle = fromMin.getAngle();
        let absRange = Math.abs(this.range);
        if (minToAngle > toMaxAngle) {
            return ((absRange / 2) + centDecompRot[1].getAngle()) / Math.abs(absRange);
        } else {
            return ((absRange / 2) - centDecompRot[1].getAngle()) / Math.abs(absRange);
        }
    }

    pointInLimits(inPoint, inBounds, boundaryMode) {
        let point = inPoint.copy(); 
        point.normalize(); 

        inBounds[0] = -1;

        let closestCollisionPoint = null;
        let closestCos = -2;
        if (this.limitCones.length > 1 && this.orientationallyConstrained) {
            for (let i = 0; i < this.limitCones.length - 1; i++) {
                let collisionPoint = inPoint.copy();
                collisionPoint.setComponents(0, 0, 0); 
                let nextCone = this.limitCones[i + 1];
                let inSegBounds = this.limitCones[i].inBoundsFromThisToNext(nextCone, point, collisionPoint);
                if (inSegBounds) {
                    inBounds[0] = 1;
                } else {
                    let thisCos = collisionPoint.dot(point); 
                    if (closestCollisionPoint === null || thisCos > closestCos) {
                        closestCollisionPoint = collisionPoint.copy();
                        closestCos = thisCos;
                    }
                }
            }
            return inBounds[0] === -1 ? closestCollisionPoint : inPoint;
        } else if (this.orientationallyConstrained) {
            if (point.dot(this.limitCones[0].getControlPoint()) > this.limitCones[0].getRadiusCosine()) {
                inBounds[0] = 1;
                return inPoint;
            } else {
                let axis = this.limitCones[0].getControlPoint().crossCopy(point); 
                let toLimit = new Rot(axis, this.limitCones[0].getRadius()); 
                return toLimit.applyToCopy(this.limitCones[0].getControlPoint()); 
            }
        } else {
            inBounds[0] = 1;
            return inPoint;
        }
    }

    /**
     * 
     * @param {Vec3} inPoint 
     * @param {IKNode} limitingAxes 
     * @returns {Vec3}
     */
    pointOnPathSequence(inPoint, limitingAxes) {
        let closestPointDot = 0;
        let result = limitingAxes.getLocalOf(inPoint, any_Vec3()); 
        result.normalize();

        if (this.limitCones.length === 1) {
            result.set(this.limitCones[0].controlPoint); 
        } else {
            for (let i = 0; i < this.limitCones.length - 1; i++) {
                let nextCone = this.limitCones[i + 1];
                let closestPathPoint = this.limitCones[i].getClosestPathPoint(nextCone, point); 
                let closeDot = closestPathPoint.dot(point);
                if (closeDot > closestPointDot) {
                    result.set(closestPathPoint);
                    closestPointDot = closeDot;
                }
            }
        }

        return limitingAxes.getGlobalOf(result); 
    }

    getTwistLocVecs(toGet) {
        let twistY = twistAxes.yRay().heading(); 
        let globY = toGet.yRay().heading();
        let globZ = toGet.zRay().heading();
        let globX = toGet.xRay().heading();
        let algnY = new Rot(globY, twistY); 
        let alignedZ = algnY.applyToVecCopy(globZ); 
        let alignedX = algnY.applyToVecCopy(globX);
        let twistLocZ = twistAxes.getLocalOf(alignedZ.add(twistAxes.origin()));
        let twistLocX = twistAxes.getLocalOf(alignedX.add(twistAxes.origin()));
        return [twistLocX, twistLocZ]; 
    }

    setPainfulness(amt) {
        this.painfulness = amt;
        if (this.forBone && this.forBone.parentArmature) {
            this.forBone.parentArmature.updateShadowSkelRateInfo(); 
        }
    }

    getPainulness() {
        return this.painfulness;
    }

    addLimitCone(newPoint, radius, previous, next) {
        let insertAt = 0;

        if (next === null || this.limitCones.length === 0) {
            this.addLimitConeAtIndex(-1, newPoint, radius);
        } else if (previous !== null) {
            insertAt = this.limitCones.indexOf(previous) + 1;
        } else {
            insertAt = Math.max(0, this.limitCones.indexOf(next));
        }
        this.addLimitConeAtIndex(insertAt, newPoint, radius);
    }

    removeLimitCone(limitCone) {
        const index = this.limitCones.indexOf(limitCone);
        if (index !== -1) {
            this.limitCones.splice(index, 1);
            this.updateTangentRadii(); 
            this.updateRotationalFreedom(); 
        }
    }

     /**
	 * @return the limitingAxes of this Kusudama (these are just its parentBone's majorRotationAxes)
	 */
	swingOrientationAxes() {
		//if(inverted) return inverseLimitingAxes; 
		return limitingAxes;
	}
	
	twistOrientationAxes() {
		return twistAxes;
	}
}



