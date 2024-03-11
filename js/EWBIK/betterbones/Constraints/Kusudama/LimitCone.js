
import { Vec3} from "../../../util/vecs.js";
import { Rot } from "../../../util/Rot.js";
import { Ray } from "../../../util/Ray.js";

export class LimitCone {

    controlPoint;

    //radius stored as  cosine to save on the acos call necessary for angleBetween. 
    radiusCosine;
    radius;

    parentKusudama;

    tangentCircleCenterNext1;
    tangentCircleCenterNext2;
    // tangentCircleCenterPrevious1;
    // tangentCircleCenterPrevious2;
    tangentCircleRadiusNext;
    tangentCircleRadiusNextCos;

    cushionTangentCircleCenterNext1;
    cushionTangentCircleCenterNext2;
    cushionTangentCircleCenterPrevious1;
    cushionTangentCircleCenterPrevious2;
    cushionTangentCircleRadiusNext;
    cushionTangentCircleRadiusNextCos;

    static BOUNDARY = 0;
    static CUSHION = 1;

    /**
     * a triangle where the [1] is th tangentCircleNext_n, and [0] and [2] 
     * are the points at which the tangent circle intersects this limitCone and the
     * next limitCone
     */
    firstTriangleNext = new SGVec_3d[3];
    secondTriangleNext = new SGVec_3d[3];

    /**
     * 
     * @param direction 
     * @param rad 
     * @param cushion range 0-1, how far toward the boundary to begin slowing down the rotation if soft constraints are enabled.
     * Value of 1 creates a hard boundary. Value of 0 means it will always be the case that the closer a joint in the allowable region 
     * is to the boundary, the more any further rotation in the direction of that boundary will be avoided.   
     * @param attachedTo
     */
    constructor(direction, rad, attachedTo) {
        setControlPoint(direction);
        tangentCircleCenterNext1 = direction.getOrthogonal();
        tangentCircleCenterNext2 = SGVec_3d.mult(tangentCircleCenterNext1, -1);

        this.radius = Math.max(Double.MIN_VALUE, rad);
        this.radiusCosine = Math.cos(radius);
        parentKusudama = attachedTo;
    }

    LimitCone(direction, rad, cushion, attachedTo) {
        setControlPoint(direction);
        tangentCircleCenterNext1 = direction.getOrthogonal();
        tangentCircleCenterNext2 = SGVec_3d.mult(tangentCircleCenterNext1, -1);
        this.radius = Math.max(Double.MIN_VALUE, rad);
        this.radiusCosine = Math.cos(radius);
        parentKusudama = attachedTo;
    }

    /**
     * 
     * @param next
     * @param input
     * @param collisionPoint will be set to the rectified (if necessary) position of the input after accounting for collisions
     * @return
     */
    inBoundsFromThisToNext(next, input, collisionPoint) {
        isInBounds = false;//determineIfInBounds(next, input);
        //if(!isInBounds) {
        closestCollision = getClosestCollision(next, input);
        if (closestCollision == null) {
            /**
             * getClosestCollision returns null if the point is already in bounds,
             * so we set isInBounds to true.  
             */
            isInBounds = true;
            collisionPoint.x = input.x;
            collisionPoint.y = input.y;
            collisionPoint.z = input.z;
        } else {
            collisionPoint.x = closestCollision.x;
            collisionPoint.y = closestCollision.y;
            collisionPoint.z = closestCollision.z;
        }
        return isInBounds;
    }

    /**
         * 
         * @param {LimitCone} next 
         * @param {Vec3} input 
         * @returns {null|Vec3} null if the input point is already in bounds, or the point's rectified position if the point was out of bounds.
         */
    getClosestCollision(next, input) {
        let result = this.getOnGreatTangentTriangle(next, input);
        if (result == null) {
            let inBounds = [false];
            result = this.closestPointOnClosestCone(next, input, inBounds);
        }
        return result;
    }

    /**
     * 
     * @param {LimitCone} next 
     * @param {Vec3} input 
     * @returns {Vec3|null}
     */
    getClosestPathPoint(next, input) {
        let result = this.getOnPathSequence(next, input);
        if (result == null) {
            result = this.closestCone(next, input);
        }
        return result;
    }

    /**
     * Determines if a ray emanating from the origin to given point in local space lies within the path from this cone to the next cone.
     * It is ABSOLUTELY VITAL that @param input have unit length in order for this function to work correctly.  
     * @param {LimitCone} next 
     * @param {Vec3} input 
     * @returns {boolean}
     */
    determineIfInBounds(next, input) {
        if (this.controlPoint.dot(input) >= this.radiusCosine)
            return true;
        else if (next != null && next.controlPoint.dot(input) >= next.radiusCosine)
            return true;
        else {
            if (next == null)
                return false;
            let inTan1Rad = this.tangentCircleCenterNext1.dot(input) > this.tangentCircleRadiusNextCos;
            if (inTan1Rad)
                return false;
            let inTan2Rad = this.tangentCircleCenterNext2.dot(input) > this.tangentCircleRadiusNextCos;
            if (inTan2Rad)
                return false;

            let c1xc2 = this.controlPoint.cross(next.controlPoint);
            let c1c2dir = input.dot(c1xc2);

            if (c1c2dir < 0.0) {
                let c1xt1 = this.controlPoint.cross(this.tangentCircleCenterNext1);
                let t1xc2 = this.tangentCircleCenterNext1.cross(next.controlPoint);
                return input.dot(c1xt1) > 0 && input.dot(t1xc2) > 0;
            } else {
                let t2xc1 = this.tangentCircleCenterNext2.cross(this.controlPoint);
                let c2xt2 = next.controlPoint.cross(this.tangentCircleCenterNext2);
                return input.dot(t2xc1) > 0 && input.dot(c2xt2) > 0;
            }
        }
    }

    /**
     * @param {LimitCone} next 
     * @param {Vec3} input 
     * @returns {Vec3|null}
     */
    getOnPathSequence(next, input) {
        let c1xc2 = this.controlPoint.cross(next.controlPoint);
        let c1c2dir = input.dot(c1xc2);
        if (c1c2dir < 0.0) {
            let c1xt1 = this.controlPoint.cross(this.tangentCircleCenterNext1);
            let t1xc2 = this.tangentCircleCenterNext1.cross(next.controlPoint);
            if (input.dot(c1xt1) > 0 && input.dot(t1xc2) > 0) {
                let tan1ToInput = new Ray(this.tangentCircleCenterNext1, input);
                let result = new Vec3();
                tan1ToInput.intersectsPlane(new Vec3(0, 0, 0), this.controlPoint, next.controlPoint, result);
                return result.normalize();
            } else {
                return null;
            }
        } else {
            let t2xc1 = this.tangentCircleCenterNext2.cross(this.controlPoint);
            let c2xt2 = next.controlPoint.cross(this.tangentCircleCenterNext2);
            if (input.dot(t2xc1) > 0 && input.dot(c2xt2) > 0) {
                let tan2ToInput = new Ray(this.tangentCircleCenterNext2, input);
                let result = new Vec3();
                tan2ToInput.intersectsPlane(new Vec3(0, 0, 0), this.controlPoint, next.controlPoint, result);
                return result.normalize();
            } else {
                return null;
            }
        }
    }

    /**
     * @param {LimitCone} next 
     * @param {Vec3} input 
     * @returns {Vec3|null} null if inapplicable for rectification. the original point if in bounds, or the point rectified to the closest boundary on the path sequence between two cones if the point is out of bounds and applicable for rectification.
     */
    getOnGreatTangentTriangle(next, input) {
        let c1xc2 = this.controlPoint.cross(next.controlPoint);
        let c1c2dir = input.dot(c1xc2);
        if (c1c2dir < 0.0) {
            let c1xt1 = this.controlPoint.cross(this.tangentCircleCenterNext1);
            let t1xc2 = this.tangentCircleCenterNext1.cross(next.controlPoint);
            if (input.dot(c1xt1) > 0 && input.dot(t1xc2) > 0) {
                let toNextCos = input.dot(this.tangentCircleCenterNext1);
                if (toNextCos > this.tangentCircleRadiusNextCos) {
                    let planeNormal = this.tangentCircleCenterNext1.cross(input);
                    let rotateAboutBy = new Rot(planeNormal, this.tangentCircleRadiusNext);
                    return rotateAboutBy.applyTo(this.tangentCircleCenterNext1);
                } else {
                    return input;
                }
            } else {
                return null;
            }
        } else {
            let t2xc1 = this.tangentCircleCenterNext2.cross(this.controlPoint);
            let c2xt2 = next.controlPoint.cross(this.tangentCircleCenterNext2);
            if (input.dot(t2xc1) > 0 && input.dot(c2xt2) > 0) {
                if (input.dot(this.tangentCircleCenterNext2) > this.tangentCircleRadiusNextCos) {
                    let planeNormal = this.tangentCircleCenterNext2.cross(input);
                    let rotateAboutBy = new Rot(planeNormal, this.tangentCircleRadiusNext);
                    return rotateAboutBy.applyTo(this.tangentCircleCenterNext2);
                } else {
                    return input;
                }
            }
            else {
                return null;
            }
        }
    }

    /**
     * @param next @type { LimitCone}
     * @param input @type {Vec3}
     */

    closestCone(next, input) {
        if (input.dot(controlPoint) > input.dot(next.controlPoint))
            return this.controlPoint.clone();
        else
            return next.controlPoint.clone();
    }

    /**
 * Returns null if no rectification is required.
 * @param {LimitCone} next 
 * @param {Vec3} input 
 * @param {boolean[]} inBounds 
 * @returns {Vec3|null}
 */
closestPointOnClosestCone(next, input, inBounds) {
    let closestToFirst = this.closestToCone(input, inBounds);
    if (inBounds[0]) {
        return closestToFirst;
    }
    let closestToSecond = next.closestToCone(input, inBounds);
    if (inBounds[0]) {
        return closestToSecond;
    }

    let cosToFirst = input.dot(closestToFirst);
    let cosToSecond = input.dot(closestToSecond);

    if (cosToFirst > cosToSecond) {
        return closestToFirst;
    } else {
        return closestToSecond;
    }
}

/**
 * Returns null if no rectification is required.
 * @param {Vec3} input 
 * @param {boolean[]} inBounds 
 * @returns {Vec3|null}
 */
closestToCone(input, inBounds) {
    if (input.dot(this.getControlPoint()) > this.getRadiusCosine()) {
        inBounds[0] = true;
        return null; // input.clone();
    } else {
        let axis = this.getControlPoint().cross(input);
        let rotTo = new Rot(axis, this.getRadius());
        let result = rotTo.applyTo(this.getControlPoint());
        inBounds[0] = false;
        return result;
    }
}

/**
 * @param {LimitCone} next 
 */
updateTangentHandles(next) {
    this.controlPoint.normalize();
    this.updateTangentAndCushionHandles(next);
}

/**
 * @param {LimitCone} next 
 */
updateTangentAndCushionHandles(next) {
    if (next != null) {
        let radA = this.radius;
        let radB = next.radius;

        let A = this.getControlPoint().clone();
        let B = next.getControlPoint().clone();

        let arcNormal = A.cross(B);

        // Documentation on determining the tangent circle radius
        let tRadius = ((Math.PI) - (radA + radB)) / 2;

        let boundaryPlusTangentRadiusA = radA + tRadius;
        let boundaryPlusTangentRadiusB = radB + tRadius;

        let scaledAxisA = A.mult(Math.cos(boundaryPlusTangentRadiusA));
        let planeDir1A = new Rot(arcNormal, boundaryPlusTangentRadiusA).applyTo(A);
        let planeDir2A = new Rot(A, Math.PI / 2).applyTo(planeDir1A);

        let scaledAxisB = B.mult(Math.cos(boundaryPlusTangentRadiusB));
        let planeDir1B = new Rot(arcNormal, boundaryPlusTangentRadiusB).applyTo(B);
        let planeDir2B = new Rot(B, Math.PI / 2).applyTo(planeDir1B);

        let r1B = new Ray(planeDir1B, scaledAxisB); 
        let r2B = new Ray(planeDir1B, planeDir2B);

        r1B.elongate(99);
        r2B.elongate(99);

        let intersection1 = r1B.intersectsPlane(scaledAxisA, planeDir1A, planeDir2A);
        let intersection2 = r2B.intersectsPlane(scaledAxisA, planeDir1A, planeDir2A);

        let intersectionRay = new Ray(intersection1, intersection2);
        intersectionRay.elongate(99);

        let sphereIntersect1 = new Vec3();
        let sphereIntersect2 = new Vec3();
        let sphereCenter = new Vec3();
        intersectionRay.intersectsSphere(sphereCenter, 1, sphereIntersect1, sphereIntersect2);

        this.tangentCircleCenterNext1 = sphereIntersect1;
        this.tangentCircleCenterNext2 = sphereIntersect2;
        this.setTangentCircleRadiusNext(tRadius);
    }

    if (this.tangentCircleCenterNext1 == null) {
        this.tangentCircleCenterNext1 = this.controlPoint.getOrthogonal().normalize();
    }
    if (this.tangentCircleCenterNext2 == null) {
        this.tangentCircleCenterNext2 = this.tangentCircleCenterNext1.mult(-1).normalize();
    }
    if (next != null) {
        this.computeTriangles(next);
    }
}


    setTangentCircleCenterNext1(point) {
        this.cushionTangentCircleCenterNext1 = point;


    }
    setTangentCircleCenterNext2(point, mode) {
        if (mode == CUSHION) {
            this.cushionTangentCircleCenterNext2 = point;
        } else {
            this.tangentCircleCenterNext2 = point;
        }
    }


    setTangentCircleRadiusNext(rad) {
        this.tangentCircleRadiusNext = rad;
        this.tangentCircleRadiusNextCos = Math.cos(tangentCircleRadiusNext);
    }


    /**
     * @param next @type { LimitCone}
     */
    computeTriangles(next) {
        this.firstTriangleNext[1] = this.tangentCircleCenterNext1.normalize();
        this.firstTriangleNext[0] = this.getControlPoint().normalize();
        this.firstTriangleNext[2] = next.getControlPoint().normalize();

        this.secondTriangleNext[1] = this.tangentCircleCenterNext2.normalize();
        this.secondTriangleNext[0] = this.getControlPoint().normalize();
        this.secondTriangleNext[2] = next.getControlPoint().normalize();
    }


    getControlPoint() {
        return this.controlPoint;
    }

    setControlPoint(controlPoint) {
        this.controlPoint.set(controlPoint);
        this.controlPoint.normalize();
        if (this.parentKusudama != null)
            this.parentKusudama.constraintUpdateNotification();
    }

    getRadius() {
        return this.radius;
    }

    getRadiusCosine() {
        return this.radiusCosine;
    }

    setRadius(radius) {
        this.radius = radius;
        this.radiusCosine = Math.cos(radius);
        this.parentKusudama.constraintUpdateNotification();
    }

    getParentKusudama() {
        return this.parentKusudama;
    }
}