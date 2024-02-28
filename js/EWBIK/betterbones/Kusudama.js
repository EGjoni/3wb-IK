import { IKTransform } from "../util/IKTransform.js";
import { Rot } from "../util/Rot.js";
import { Vec3 } from "../util/vecs.js";
import { Ray } from "../util/Ray.js";
import { generateUUID } from "../util/uuid.js";

export class AbstractKusudama {
    // Assuming the existence of similar base classes or interfaces for `Constraint` and `Saveable` in your JavaScript setup
    static TAU = Math.PI * 2;
    static PI = Math.PI;
    static totalKusudamas = 0;
    

    constructor(forBone = null, ikd = 'Kusudama-'+(AbstractKusudama.totalKusudamas+1)) {
        if(!forBone?.parent instanceof THREE.Bone) { 
            throw new Error("Root bones may not specify a constraint. Add this bone to a parent before attempting to register a constrain on it.");
        }
        this.ikd = ikd;
        AbstractKusudama.totalKusudamas +=1;
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
        this.attachedTo = forBone;
        this.twistMinRot = new Rot(); // Assuming Rot is already ported to JS
        this.twistRangeRot = new Rot();
        this.twistMaxRot = new Rot();
        this.twistHalfRangeRot = new Rot();
        this.twistCentRot = new Rot();
        this.boneRay = new Ray(new Vec3(), new Vec3()); // Assuming Ray, Vec3 are already ported to JS
        this.constrainedRay = new Ray(new Vec3(), new Vec3());
        this.twistMinVec = new Vec3(0, 0, 1);
        this.twistMaxVec = new Vec3(0, 0, 1);
        this.twistCenterVec = new Vec3(0, 0, -1);
        this.twistHalfRangeHalfCos = -0.5;
        this.flippedBounds = false;        

        if (forBone) {
            
            this.limitingAxes = forBone.getMajorRotationAxes(); // Assuming `getMajorRotationAxes` method exists
            this.twistAxes = this.limitingAxes.attachedCopy(false); // Assuming `attachedCopy` method exists
            this.attachedTo.addConstraint(this); // Assuming `addConstraint` method exists
            this.enable(); // Assuming `enable` method exists
        }
    }

    constraintUpdateNotification() {
        this.updateTangentRadii();
        this.updateRotationalFreedom(); // Assuming this method is defined elsewhere
    }

    optimizeLimitingAxes() {
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
                let thisToNext = new Rot(thisCp, nextCp); // Assuming `Rot` constructor takes two vectors
                let halfThisToNext = new Rot(thisToNext.getAxis(), thisToNext.getAngle() / 2);

                let halfAngle = halfThisToNext.applyToCopy(thisCp);
                halfAngle.normalize();
                halfAngle.mult((thisC.getRadius() + nextC.getRadius()) / 2 + thisToNext.getAngle());
                directions.push(halfAngle);
                directions.add(nextCp.mult(nextC.getRadius()));
            }
        }

        let newY = new Vec3();
        directions.forEach(dv => {
            newY.add(dv);
        });
        newY.normalize();

        let newYRay = new Ray(new Vec3(0, 0, 0), newY);

        let oldYtoNewY = new Rot(this.swingOrientationAxes().y_().heading(), this.swingOrientationAxes().getGlobalOf(newYRay).heading());
        this.twistAxes.alignOrientationTo(this.swingOrientationAxes());
        this.twistAxes.rotateBy(oldYtoNewY);
        this.updateTangentRadii();
    }

    updateTangentRadii() {
        for (let i = 0; i < this.limitCones.length; i++) {
            let next = i < this.limitCones.length - 1 ? this.limitCones[i + 1] : null;
            this.limitCones[i].updateTangentHandles(next); // Assuming `updateTangentHandles` method exists
        }
    }

    snapToLimits() {
        if (this.orientationallyConstrained) {
            this.setAxesToOrientationSnap(this.attachedTo().localAxes(), this.swingOrientationAxes()); // Assuming these methods exist
        }
        if (this.axiallyConstrained) {
            this.snapToTwistLimits(this.attachedTo().localAxes(), this.twistOrientationAxes()); // Assuming these methods exist
        }
    }

    setAxesToOrientationSnap(toSet, limitingAxes) {
        let inBounds = [1.0];
        limitingAxes.updateGlobal();
        this.boneRay.p1.set(limitingAxes.origin_());
        this.boneRay.p2.set(toSet.y_().p2());
        let bonetip = limitingAxes.getLocalOf(toSet.y_().p2());
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
        let decomposition = alignRot.getSwingTwist(new Vec3(0, 1, 0));
        decomposition[1].rotation.clampToQuadranceAngle(this.twistHalfRangeHalfCos);
        let recomposition = decomposition[0].applyTo(decomposition[1]);
        toSet.getParentAxes().getGlobalMBasis().inverseRotation.applyTo(globTwistCent.applyTo(recomposition), toSet.localMBasis.rotation);
        toSet.localMBasis.refreshPrecomputed();
        toSet.markDirty();
        return 0;
    }

    setAxesToReturnfulled(toSet, swingAxes, twistAxes, cosHalfReturnfullness, angleReturnfullness) {
        if (swingAxes !== null && this.painfulness > 0.0) {
            if (this.orientationallyConstrained) {
                let origin = toSet.origin_();
                let inPoint = toSet.y_().p2().copy();
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
        let y_axis = new Vec3(0, 1, 0);
        this.twistMinRot = new Rot(y_axis, this.minAxialAngle);
        this.twistMinVec = this.twistMinRot.applyToCopy(new Vec3(0, 0, 1));

        this.twistHalfRangeHalfCos = Math.cos(inRange / 4);
        this.twistRangeRot = new Rot(y_axis, this.range);

        this.twistMaxVec = this.twistRangeRot.applyToCopy(this.twistMinVec);

        this.twistHalfRangeRot = new Rot(y_axis, this.range / 2);
        this.twistCenterVec = this.twistHalfRangeRot.applyToCopy(this.twistMinVec);
        this.twistCentRot = new Rot(new Vec3(0, 0, 1), this.twistCenterVec);

        this.constraintUpdateNotification();
    }

    setTwist(ratio, toSet) {
        let globTwistCent = new Rot();
        this.twistAxes.getGlobalMBasis().applyTo(this.twistMinRot, globTwistCent);
        let alignRot = globTwistCent.applyInverseTo(toSet.getGlobalMBasis().rotation);
        let decomposition = alignRot.getSwingTwist(new Vec3(0, 1, 0));
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
        let centDecompRot = centAlignRot.getSwingTwist(new Vec3(0, 1, 0));
        let locZ = centDecompRot[1].applyToCopy(new Vec3(0, 0, 1));
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
        let point = inPoint.copy(); // Assuming copy method exists
        point.normalize(); // Assuming normalize method exists

        inBounds[0] = -1;

        let closestCollisionPoint = null;
        let closestCos = -2;
        if (this.limitCones.length > 1 && this.orientationallyConstrained) {
            for (let i = 0; i < this.limitCones.length - 1; i++) {
                let collisionPoint = inPoint.copy();
                collisionPoint.setComponents(0, 0, 0); // Assuming set method exists
                let nextCone = this.limitCones[i + 1];
                let inSegBounds = this.limitCones[i].inBoundsFromThisToNext(nextCone, point, collisionPoint);
                if (inSegBounds) {
                    inBounds[0] = 1;
                } else {
                    let thisCos = collisionPoint.dot(point); // Assuming dot method exists
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
                let axis = this.limitCones[0].getControlPoint().crossCopy(point); // Assuming crossCopy method exists
                let toLimit = new Rot(axis, this.limitCones[0].getRadius()); // Assuming Rot constructor exists
                return toLimit.applyToCopy(this.limitCones[0].getControlPoint()); // Assuming applyToCopy method exists
            }
        } else {
            inBounds[0] = 1;
            return inPoint;
        }
    }

    pointOnPathSequence(inPoint, limitingAxes) {
        let closestPointDot = 0;
        let point = limitingAxes.getLocalOf(inPoint); // Assuming getLocalOf method exists
        point.normalize();
        let result = point.copy();

        if (this.limitCones.length === 1) {
            result.set(this.limitCones[0].controlPoint); // Assuming set method exists
        } else {
            for (let i = 0; i < this.limitCones.length - 1; i++) {
                let nextCone = this.limitCones[i + 1];
                let closestPathPoint = this.limitCones[i].getClosestPathPoint(nextCone, point); // Assuming getClosestPathPoint method exists
                let closeDot = closestPathPoint.dot(point);
                if (closeDot > closestPointDot) {
                    result.set(closestPathPoint);
                    closestPointDot = closeDot;
                }
            }
        }

        return limitingAxes.getGlobalOf(result); // Assuming getGlobalOf method exists
    }

    getTwistLocVecs(toGet) {
        let twistY = twistAxes.y_().heading(); 
        let globY = toGet.y_().heading();
        let globZ = toGet.z_().heading();
        let globX = toGet.x_().heading();
        let algnY = new Rot(globY, twistY); 
        let alignedZ = algnY.applyToCopy(globZ); 
        let alignedX = algnY.applyToCopy(globX);
        let alignedY = algnY.applyToCopy(globY);
        let twistLocZ = twistAxes.getLocalOf(alignedZ.add(twistAxes.origin_()));
        let twistLocX = twistAxes.getLocalOf(alignedX.add(twistAxes.origin_()));
        let twistLocY = twistAxes.getLocalOf(alignedY.add(twistAxes.origin_()));
        return [twistLocX, twistLocZ]; 
    }

    setPainfulness(amt) {
        this.painfulness = amt;
        if (this.attachedTo && this.attachedTo.parentArmature) {
            this.attachedTo.parentArmature.updateShadowSkelRateInfo(); // Assuming updateShadowSkelRateInfo method exists
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
            this.updateTangentRadii(); // Assuming updateTangentRadii method exists
            this.updateRotationalFreedom(); // Assuming updateRotationalFreedom method exists
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



