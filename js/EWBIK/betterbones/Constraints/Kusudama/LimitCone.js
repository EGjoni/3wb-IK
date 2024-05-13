const THREE = await import('three');
import {  Vec3} from "../../../util/vecs.js";
import { Rot } from "../../../util/Rot.js";
import { Ray } from "../../../util/Ray.js";
import { Saveable } from "../../../util/loader/saveable.js";
export class LimitCone extends Saveable {
    static loader = new THREE.TextureLoader();
    static totalInstances = 0;
    controlPoint;

    //radius stored as  cosine to save on the acos call necessary for angleBetween. 
    radiusCosine;
    radiusNegHalfCos;
    radiusNegHalfSin;
    radius;

    /**@type {Kusudama}*/
    parentKusudama;

    tangentCircleCenterNext1;
    tangentCircleCenterNext2;
    // tangentCircleCenterPrevious1;
    // tangentCircleCenterPrevious2;
    tangentCircleRadiusNext;
    tangentCircleRadiusNextCos;

    static fromJSON(json, loader, pool, scene) {
        let result = new LimitCone(Vec3.fromJSON(json.controlPoint, pool), parseFloat(json.radius), json.ikd, pool);
        result.tangentCircleCenterNext1 = Vec3.fromJSON(json.tangentCircleCenterNext1, pool);
        result.tangentCircleCenterNext2 = Vec3.fromJSON(json.tangentCircleCenterNext2, pool);
        result.tangentCircleRadiusNext = parseFloat(json.tangentCircleRadiusNext);
        result.tangentCircleRadiusNextCos = parseFloat(json.tangentCircleRadiusNext);
        return result;
    }

    async postPop(json, loader, pool, scene)  {
        let p = Saveable.prepop(json.requires, loader, pool, scene);
        this.parentKusudama = p.parentKusudama;
        return this;
    }

    toJSON(json, loader, pool, scene) {
        let result = super.toJSON(json, loader, pool, scene);
        result.controlPoint = this.controlPoint.toJSON();
        result.tangentCircleCenterNext1 = this.tangentCircleCenterNext1.toJSON();
        result.tangentCircleCenterNext2 = this.tangentCircleCenterNext2.toJSON();
        result.radius = this.radius;
        result.tangentCircleRadiusNext = this.tangentCircleRadiusNext;
        return result;
    }

    getRequiredRefs () {
        return {parentKusudama : this.parentKusudama};
    }

    /**
     * 
     * @param {Vec3} direction the cone points in
     * @param {Number} rad half angle of the cone opening
     */
    constructor(direction, rad, parentKusudama, ikd=`LimitCone-${LimitCone.totalInstances++}`, pool=globalVecPool) {
        super(ikd,'LimitCone', LimitCone.totalInstances, pool);
        this.tempVec1 = this.pool.new_Vec3(); 
        this.tempVec2 = this.pool.new_Vec3();
        this.tempVec3 = this.pool.new_Vec3();
        this.tempOutVec = this.pool.new_Vec3();
        this.controlPoint = new Vec3(0,1,0);
        this.workingRay = new Ray(this.pool.any_Vec3(), this.pool.any_Vec3(), this.pool);
        this.tempOutVec = this.pool.new_Vec3(0,0,0);
        this.tempOriginVec = this.pool.new_Vec3(); 
        this.tempRot = new Rot(1,0,0,0);
        
        this.radialHandle = null; 
        this.setControlPoint(direction);
        this.tangentCircleCenterNext1 = direction.getOrthogonal_temp(new Vec3(0,0,0));
        this.tangentCircleCenterNext2 = this.tangentCircleCenterNext1.multClone(-1);

        this.setRadius(Math.max(1e-12, rad));
        this.parentKusudama = parentKusudama;
    }

    /**returns the cone after this one as per the parent kusudama */
    getNextCone(){
        if(this.parentKusudama) {
            let thisidx = this.parentKusudama.limitCones.indexOf(this);
            return this.parentKusudama.getLimitCone(thisidx+1); 
        }
        return null;
    }

    /**returns the cone prior to this one as per the parent kusudama */
    getPreviousCone(){
        if(this.parentKusudama) {
            let thisidx = this.parentKusudama.limitCones.indexOf(this);
            return this.parentKusudama.getLimitCone(thisidx-1); 
        }
        return null;
    }

    /**
     * set
     * @param {Number} xdir x component of the cone direction
     * @param {Number} ydir y component of the cone direction
     * @param {Number} zdir z component of the cone direction
     * @param {Number} radius half angle of the cone apex
     * @param {Boolean} updateTangents optional, default true, whether or not to automatically ask the parent kusudama to 
     * update the tangent cones as a result of this modification
     */
    setComponents(xdir, ydir, zdir, radius, updateTangents = true) {
        this.controlPoint.setComponents(xdir, ydir, zdir);
        this.setRadius(radius, updateTangents);
    }

    /**
     * 
     * @param next
     * @param input
     * @param collisionPoint will be set to the rectified (if necessary) position of the input after accounting for collisions
     * @return
     */
    inBoundsFromThisToNext(next, input, collisionPoint) {
        let isInBounds = false;//determineIfInBounds(next, input);
        //if(!isInBounds) {
        let closestCollision = this.getClosestCollision(next, input);
        if (closestCollision == null || closestCollision == input) {
            /**
             * getClosestCollision returns null if the point is already in bounds,
             * so we set isInBounds to true.  
             */
            isInBounds = true;
            collisionPoint.set(input);
        } else {
            collisionPoint.set(closestCollision);
        }
        return isInBounds;
    }

    tempInBounds = [false];

    /**
         * 
         * @param {LimitCone} next 
         * @param {Vec3} input 
         * @returns {null|Vec3} null if the input point is already in bounds, or the point's rectified position if the point was out of bounds.
         */
    getClosestCollision(next, input) {
        let result = this.getOnGreatTangentTriangle(next, input);
        if (result == null) {
            this.tempInBounds = [false];
            result = this.closestPointOnClosestCone(next, input, this.tempInBounds);
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

            let c1xc2 = this.controlPoint.cross(next.controlPoint, this.tempVec1);
            let c1c2dir = input.dot(c1xc2);

            if (c1c2dir < 0.0) {
                let c1xt1 = this.controlPoint.cross(this.tangentCircleCenterNext1, this.tempVec2);
                let t1xc2 = this.tangentCircleCenterNext1.cross(next.controlPoint, this.tempVec3);
                return input.dot(c1xt1) > 0 && input.dot(t1xc2) > 0;
            } else {
                let t2xc1 = this.tangentCircleCenterNext2.cross(this.controlPoint, this.tempVec2);
                let c2xt2 = next.controlPoint.cross(this.tangentCircleCenterNext2, this.tempVec3);
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
        /**TODO: Maybe come up with some way to make this less conditional */
        let c1c2dir = input.dot(this.controlPoint.cross(next.controlPoint, this.tempVec1));
        if (c1c2dir < 0.0) {
            let c1xt1 = this.controlPoint.cross(this.tangentCircleCenterNext1, this.tempVec1);
            let t1xc2 = this.tangentCircleCenterNext1.cross(next.controlPoint, this.tempVec2);
            if (input.dot(c1xt1) > 0 && input.dot(t1xc2) > 0) {
                let tan1ToInput = this.workingRay; 
                tan1ToInput.p1.set(this.tangentCircleCenterNext1);
                tan1ToInput.p2.set(input);
                let result = this.tempOutVec;
                tan1ToInput.intersectsPlane(tempOriginVec, this.controlPoint, next.controlPoint, result);
                return result.normalize();
            } else {
                return null;
            }
        } else {
            let t2xc1 = this.tangentCircleCenterNext2.cross(this.controlPoint, this.tempVec1);
            let c2xt2 = next.controlPoint.cross(this.tangentCircleCenterNext2, this.tempVec2);
            if (input.dot(t2xc1) > 0 && input.dot(c2xt2) > 0) {
                let tan2ToInput = this.workingRay; 
                tan2ToInput.p1.set(this.tangentCircleCenterNext2); 
                tan2ToInput.p2.set(input);
                let result = this.tempOutVec;
                tan2ToInput.intersectsPlane(tempOriginVec, this.controlPoint, next.controlPoint, result);
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
        /**TODO: Maybe come up with some way to make this less conditional */
        let c1c2dir = input.dot(this.controlPoint.cross(next.controlPoint, this.tempVec1));
        if (c1c2dir < 0.0) {
            let c1xt1 = this.controlPoint.cross(this.tangentCircleCenterNext1, this.tempVec1);
            let t1xc2 = this.tangentCircleCenterNext1.cross(next.controlPoint, this.tempVec2);
            if (input.dot(c1xt1) > 0 && input.dot(t1xc2) > 0) {
                let toNextCos = input.dot(this.tangentCircleCenterNext1);
                if (toNextCos > this.tangentCircleRadiusNextCos) {
                    let planeNormal = this.tangentCircleCenterNext1.cross(input, this.tempVec3);
                    let rotateAboutBy = this.tempRot.setFromAxisTrigHalfAngles(planeNormal, this.tangentCircleRadiusNextNegHalfCos, this.tangentCircleRadiusNextNegHalfSin);
                    return rotateAboutBy.applyToVecClone(this.tangentCircleCenterNext1, this.tempOutVec);
                } else {
                    return input;
                }
            } else {
                return null;
            }
        } else {
            let t2xc1 = this.tangentCircleCenterNext2.cross(this.controlPoint, this.tempVec1);
            let c2xt2 = next.controlPoint.cross(this.tangentCircleCenterNext2, this.tempVec2);
            if (input.dot(t2xc1) > 0 && input.dot(c2xt2) > 0) {
                if (input.dot(this.tangentCircleCenterNext2) > this.tangentCircleRadiusNextCos) {
                    let planeNormal = this.tangentCircleCenterNext2.cross(input, this.tempVec3);
                    let rotateAboutBy = this.tempRot.setFromAxisTrigHalfAngles(planeNormal, this.tangentCircleRadiusNextNegHalfCos, this.tangentCircleRadiusNextNegHalfSin);
                    return rotateAboutBy.applyToVecClone(this.tangentCircleCenterNext2, this.tempOutVec);
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
            return this.pool.any_Vec3fv(this.controlPoint);
        else
            return this.pool.any_Vec3fv(next.controlPoint);
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
 * Returns the point on this cone which is closest to the input, but only if the input lies outside of the cone. 
 * Returns null if the input is already inside of the cone.
 * @param {Vec3} input 
 * @param {boolean[]} inBounds 
 * @returns {Vec3|null}
 */
closestToCone(input, inBounds) {
    if (input.dot(this.getControlPoint()) > this.getRadiusCosine()) {
        inBounds[0] = true;
        return null; // input.clone();
    } else {
        let axis = this.getControlPoint().cross(input, this.tempVec1);
        let rotTo = this.tempRot.setFromAxisTrigHalfAngles(axis, this.radiusNegHalfCos, this.radiusNegHalfSin);
        let result = rotTo.applyToVec(this.getControlPoint(), this.tempOutVec);
        inBounds[0] = false;
        return result;
    }
}

/**
 * @param {LimitCone} next 
 */
updateTangentHandles(next) {
    this.controlPoint.normalize();
    this.updateTangentHandles(next);
}

/**
 * @param {LimitCone} next 
 */
updateTangentHandles(next) {
    this.radius = parseFloat(this.radius);
    if (next != null) {
        next.radius = parseFloat(next.radius);
        let radA = this.radius;
        let radB = next.radius;

        let A = this.getControlPoint().tempClone();
        let B = next.getControlPoint().tempClone();
        if(A.dist(B) == 0) { //to avoid issues with identical limitcone controlpoints
            B.add(this.pool.any_Vec3(Math.random(), Math.random(), Math.random()).mult(0.00001)).normalize();
        }

        let arcNormal = A.cross(B);

        /**
         * There are an infinite number of circles co-tangent with A and B, every other
         * one of which has a unique radius.  
         * 
         * However, we want the radius of our tangent circles to obey the following properties: 
         *   1) When the radius of A + B == 0 radians, our tangent circle's radius should = pi/2 radians.
         *   	In other words, the tangent circle should span a hemisphere, because A+B define two points, which on a sphere is a great arc. 
         *   2) When the radius of A + B == pi radians, our tangent circle's radius should = 0 radians. 
         *   	In other words, when A + B combined are capable of spanning the entire sphere, 
         *   	our tangentCircle should be nothing.   
         *   
         * Another way to think of this is -- if we pick some radii for A and B, and hold them constant, then sample arbitrary directions of A and B to find the
         * values which minimize the maximum distance, we want our tangentCircle's diameter to be precisely that minimum max-distance.
         * 
         * The term "want" here is used loosely. And probably there is merit to allowing user control over this. But without user control, this is the solution of least bulge.
         *
         */
        let tRadius = ((Math.PI) - (radA + radB)) / 2;

        /**
         * Okay listen. I'm gonna be honest.
         * I know this code makes no fucking sense and you're not gonna be able to make heads or tails of it.
         * But in my head it's a beautiful waltz of rays and intersections on a sphere.
         * Just like, put on some Schubert, and imagine circles of Appolonius dancing on a sphere while you read it and it'll be fine.
         */

        let boundaryPlusTangentRadiusA = radA + tRadius;
        let boundaryPlusTangentRadiusB = radB + tRadius;

        let scaledAxisA = A.multClone(Math.cos(boundaryPlusTangentRadiusA)); //projection of the tangent (before we actually find it) on coneA direction
        //take coneA's controlpoint and rotate it along the path toward coneB's controlpoint by the sum of the radius of coneA and the tangentCone.
        let planeDir1A = this.tempRot.setFromAxisAngle(arcNormal, boundaryPlusTangentRadiusA).applyToVecClone(A);
        let planeDir2A = this.tempRot.setFromAxisAngle(A, Math.PI / 2).applyToVecClone(planeDir1A); //twirly bit.

        let scaledAxisB = B.multClone(Math.cos(boundaryPlusTangentRadiusB)); //projection of the tangent (before we actually find it) on coneB direciton
        //take coneB's controlpoint and rotate it along the path toward coneA's controlpoint by the sum of the radius of coneB and the tangentCone.
        let planeDir1B = this.tempRot.setFromAxisAngle(arcNormal, boundaryPlusTangentRadiusB).applyToVecClone(B);
        let planeDir2B = this.tempRot.setFromAxisAngle(B, Math.PI / 2).applyToVecClone(planeDir1B); //twirly bit

        let r1B = new Ray(planeDir1B, scaledAxisB, this.pool);
        let r2B = new Ray(planeDir1B, planeDir2B, this.pool);

        r1B.elongate(99);
        r2B.elongate(99);

        let intersection1 = r1B.intersectsPlane(scaledAxisA, planeDir1A, planeDir2A, this.pool).clone();
        let intersection2 = r2B.intersectsPlane(scaledAxisA, planeDir1A, planeDir2A, this.pool).clone();

        let intersectionRay = new Ray(intersection1, intersection2, this.pool);
        intersectionRay.elongate(99);

        let sphereIntersect1 = this.pool.any_Vec3(0,0,0); //for result storage
        let sphereIntersect2 = this.pool.any_Vec3(0,0,0); //for result storage
        
        let intersections = intersectionRay.intersectsSphere(1, sphereIntersect1, sphereIntersect2);

        this.tangentCircleCenterNext1.set(sphereIntersect1);//.clone();
        this.tangentCircleCenterNext2.set(sphereIntersect2);//.clone();
        this.setTangentCircleRadiusNext(tRadius);

        if (intersections < 2) { //should only trigger when we only have one cone.
            this.tangentCircleCenterNext1 = this.controlPoint.getOrthogonal_temp(this.tangentCircleCenterNext1).normalize();
            this.tangentCircleCenterNext2 = this.controlPoint.getOrthogonal_temp(this.tangentCircleCenterNext2).normalize().mult(-1);
        }
    }
    
}


    setTangentCircleCenterNext1(point) {
        this.cushionTangentCircleCenterNext1 = point;


    }
    setTangentCircleCenterNext2(point) {
        this.cushionTangentCircleCenterNext2 = point;
    }


    setTangentCircleRadiusNext(rad) {
        this.tangentCircleRadiusNext = rad;
        this.tangentCircleRadiusNextCos = Math.cos(this.tangentCircleRadiusNext);
        this.tangentCircleRadiusNextNegHalfCos = Math.cos(-0.5*this.tangentCircleRadiusNext);
        this.tangentCircleRadiusNextNegHalfSin = Math.sin(-0.5*this.tangentCircleRadiusNext);
    }

    getControlPoint() {
        return this.controlPoint;
    }

    setControlPoint(controlPoint) {
        this.controlPoint.set(controlPoint);
        this.controlPoint.normalize();
    }

    getRadius() {
        return this.radius;
    }

    getRadiusCosine() {
        return this.radiusCosine;
    }

    setRadius(radius, updateTangents = true) {
        this.radius = parseFloat(radius);
        this.radiusCosine = Math.cos(radius);
        this.radiusNegHalfCos = Math.cos(-radius*0.5);
        this.radiusNegHalfSin = Math.sin(-radius*0.5);
        if(updateTangents) {
            this.requestTangentUpdate();
        }
    }

    requestTangentUpdate() {
        if(this.parentKusudama != null)
            this.parentKusudama.updateTangentRadii();
    }

    getParentKusudama() {
        return this.parentKusudama;
    }
}