import { IKTransform } from "../../../util/nodes/IKTransform.js";
const THREE = await import('three')
import { Bone } from 'three';
import { Rot } from "../../../util/Rot.js";
import { Vec3, any_Vec3 } from "../../../util/vecs.js";
import { Ray } from "../../../util/Ray.js";
import { IKNode } from "../../../util/nodes/IKNodes.js";
import { generateUUID } from "../../../util/uuid.js";
import { Constraint, LimitingReturnful } from "../Constraint.js";

export class Kusudama extends LimitingReturnful {
    
    static TAU = Math.PI * 2;
    static PI = Math.PI;
    static totalKusudamas = 0;
    

    constructor(forBone = null, ikd = 'Kusudama-'+(Kusudama.totalKusudamas++), vecpool = noPool) {
        this.pool = vecpool;
        if(!forBone?.parent instanceof THREE.Bone) { 
            console.warn("Root bones should not specify a constraint. Add this bone to a parent before attempting to register a constrain on it.");        
        }
        this.ikd = ikd;
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
        this.twistMinRot = Rot.IDENTITY.clone();
        this.twistRangeRot = Rot.IDENTITY.clone();
        this.twistMaxRot = Rot.IDENTITY.clone();
        this.twistHalfRangeRot = Rot.IDENTITY.clone();
        this.twistCentRot = Rot.IDENTITY.clone();
        this.boneRay = new Ray(this.pool.any_Vec3(), this.pool.any_Vec3());
        this.constrainedRay = new Ray(this.pool.any_Vec3(), this.pool.any_Vec3());
        this.twistMinVec = new Vec3(0, 0, 1);
        this.twistMaxVec = new Vec3(0, 0, 1);
        this.twistCenterVec = new Vec3(0, 0, -1);
        this.twistHalfRangeHalfCos = -0.5;
        this.flippedBounds = false;
        this.forBone.constraint = this;                

        if (forBone) {            
            this.limitingAxes =new IKNode(null, null, undefined, this.pool); 
            this.limitingAxes.getLocalMBasis().translateTo(new Vec3(this.forBone.position));
            this.twistAxes = this.limitingAxes.attachedClone(false);
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
            directions.push(this.limitCones[0].getControlPoint().clone());
        } else {
            let thisC = this.getLimitCones()[0];
            directions.push(thisC.getControlPoint().clone().mult(thisC.getRadius()));
            for (let i = 0; i < this.getLimitCones().length - 1; i++) {
                thisC = this.getLimitCones()[i];
                let nextC = this.getLimitCones()[i + 1];
                let thisCp = thisC.getControlPoint().clone();
                let nextCp = nextC.getControlPoint().clone();
                let thisToNext = Rot.fromVecs(thisCp, nextCp); 
                let halfThisToNext = Rot.fromAxisAngle(thisToNext.getAxis(), thisToNext.getAngle() / 2);

                let halfAngle = halfThisToNext.applyToClone(thisCp);
                halfAngle.normalize();
                halfAngle.mult((thisC.getRadius() + nextC.getRadius()) / 2 + thisToNext.getAngle());
                directions.push(halfAngle);
                directions.add(nextCp.mult(nextC.getRadius()));
            }
        }

        let newY = this.pool.any_Vec3();
        directions.forEach(dv => {
            newY.add(dv);
        });
        newY.normalize();

        let newYRay = new Ray(this.pool.any_Vec3(0, 0, 0), newY);

        let oldYtoNewY = Rot.fromVecs(this.swingOrientationAxes().yRay().heading(), this.swingOrientationAxes().getGlobalOf(newYRay).heading());
        this.twistAxes.alignOrientationTo(this.swingOrientationAxes());
        this.twistAxes.rotateByGlobal(oldYtoNewY);
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
        let bonetip = limitingAxes.getLocalOf(toSet.yRay().p2).clone();
        let inLimits = this.pointInLimits(bonetip, inBounds, AbstractLimitCone.BOUNDARY);

        if (inBounds[0] === -1 && inLimits !== null) {
            this.constrainedRay.p1.set(this.boneRay.p1);
            this.constrainedRay.p2.set(limitingAxes.getGlobalOf(inLimits));
            let rectifiedRot = Rot.fromVecs(this.boneRay.heading(), this.constrainedRay.heading());
            toSet.rotateByGlobal(rectifiedRot);
            toSet.updateGlobal();
        }
    }

    snapToTwistLimits(toSet, twistAxes) {
        if (!this.axiallyConstrained) return 0.0;
        let globTwistCent = twistAxes.getGlobalMBasis().rotation.applyTo(this.twistCentRot);
        let alignRot = globTwistCent.applyInverseTo(toSet.getGlobalMBasis().rotation);
        let decomposition = alignRot.getSwingTwist(this.pool.any_Vec3(0, 1, 0));
        decomposition[1].clampToCosHalfAngle(this.twistHalfRangeHalfCos);
        let recomposition = decomposition[0].applyTo(decomposition[1]);
        toSet.getParentAxes().getGlobalMBasis().inverseRotation.applyTo(globTwistCent.applyTo(recomposition), toSet.localMBasis.rotation);
        toSet.localMBasis.lazyRefresh();
        toSet.markDirty();
        return 0;
    }

    setAxesToReturnfulled(toSet, currentOrientation, swingAxes, twistAxes, cosHalfReturnfullness, angleReturnfullness) {
        if (swingAxes !== null && this.painfulness > 0.0) {
            if (this.orientationallyConstrained) {
                let origin = toSet.origin();
                let inPoint = toSet.yRay().p2.clone();
                let pathPoint = this.pointOnPathSequence(inPoint, swingAxes);
                inPoint.sub(origin);
                pathPoint.sub(origin);
                let toClamp = Rot.fromVecs(inPoint, pathPoint);
                toClamp.clampToCosHalfAngle(cosHalfReturnfullness);
                toSet.rotateByGlobal(toClamp);
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
        let y_axis = this.pool.new_Vec3(0, 1, 0);
        this.twistMinRot = Rot.fromAxisAngle(y_axis, this.minAxialAngle);
        this.twistMinVec = this.twistMinRot.applyToVecClone(this.pool.new_Vec3(0, 0, 1));

        this.twistHalfRangeHalfCos = Math.cos(inRange / 4);
        this.twistRangeRot = Rot.fromAxisAngle(y_axis, this.range);

        this.twistMaxVec = this.twistRangeRot.applyToVecClone(this.twistMinVec);

        this.twistHalfRangeRot = Rot.fromAxisAngle(y_axis, this.range / 2);
        this.twistCenterVec = this.twistHalfRangeRot.applyToVecClone(this.twistMinVec);
        this.twistCentRot = Rot.fromVecs(this.pool.new_Vec3(0, 0, 1), this.twistCenterVec);

        this.constraintUpdateNotification();
    }

    setTwist(ratio, toSet) {
        let globTwistCent = Rot.IDENTITY.clone();
        this.twistAxes.getGlobalMBasis().applyTo(this.twistMinRot, globTwistCent);
        let alignRot = globTwistCent.applyInverseToRot(toSet.getGlobalMBasis().rotation);
        let decomposition = alignRot.getSwingTwist(this.pool.new_Vec3(0, 1, 0));
        let goal = Rot.fromAxisAngle(this.twistHalfRangeRot.getAxis(), 2 * this.twistHalfRangeRot.getAngle() * ratio);
        let toGoal = goal.applyAfter(alignRot.getInverse());
        let achieved = toGoal.applyAfter(alignRot);
        decomposition[1] = achieved;
        let recomposition = decomposition[0].applyAfter(decomposition[1]);
        toSet.getParentAxes().getGlobalMBasis().inverseRotation.applyAfter(globTwistCent.applyAfter(recomposition), toSet.localMBasis.rotation);
        toSet.localMBasis.lazyRefresh();
        toSet.markDirty();
    }

    getTwistRatio(toGet, twistAxes) {
        let globTwistCent = Rot.IDENTITY.clone();
        twistAxes.getGlobalMBasis().applyTo(this.twistCentRot, globTwistCent);
        let centAlignRot = globTwistCent.applyInverseTo(toGet.getGlobalMBasis().rotation);
        let centDecompRot = centAlignRot.getSwingTwist(this.pool.new_Vec3(0, 1, 0));
        let locZ = centDecompRot[1].applyToClone(this.pool.new_Vec3(0, 0, 1));
        let loctwistMaxVec = twistCentRot.getInverse().applyToClone(this.twistMaxVec);
        let loctwistMinVec = twistCentRot.getInverse().applyToClone(this.twistMinVec);
        let toMax = Rot.fromAxisAngle(locZ, loctwistMaxVec);
        let fromMin = Rot.fromAxisAngle(locZ, loctwistMinVec);
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
        let point = inPoint.clone(); 
        point.normalize(); 

        inBounds[0] = -1;

        let closestCollisionPoint = null;
        let closestCos = -2;
        if (this.limitCones.length > 1 && this.orientationallyConstrained) {
            for (let i = 0; i < this.limitCones.length - 1; i++) {
                let collisionPoint = inPoint.clone();
                collisionPoint.setComponents(0, 0, 0); 
                let nextCone = this.limitCones[i + 1];
                let inSegBounds = this.limitCones[i].inBoundsFromThisToNext(nextCone, point, collisionPoint);
                if (inSegBounds) {
                    inBounds[0] = 1;
                } else {
                    let thisCos = collisionPoint.dot(point); 
                    if (closestCollisionPoint === null || thisCos > closestCos) {
                        closestCollisionPoint = collisionPoint.clone();
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
                let axis = this.limitCones[0].getControlPoint().cross(point, this.pool.any_Vec3()); 
                let toLimit = Rot.fromAxisAngle(axis, this.limitCones[0].getRadius()); 
                return toLimit.applyToVecClone(this.limitCones[0].getControlPoint()); 
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
        let result = limitingAxes.getLocalOf(inPoint, this.pool.any_Vec3()); 
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
        let algnY = Rot.fromVecs(globY, twistY); 
        let alignedZ = algnY.applyToVecClone(globZ); 
        let alignedX = algnY.applyToVecClone(globX);
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

const kusudamaFragShader = `
varying vec3 vertNormal;
varying vec3 vertViewNormal;
varying vec4 color;

void main() {
    vertViewNormal = normalize(normalMatrix * normal); // Transform normal to view space and normalize
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vertNormal = normalize(normal);
}`



const kusudamaVertShader = `
#ifdef GL_ES
precision mediump float;
precision mediump int;
#endif

uniform vec4 shellColor;

//Model space normal direction of the current fragment
//since we're on a sphere, this is literally just the fragment's position in 
//modelspace
varying vec3 vertNormal;

//This shader can display up to 30 cones (represented by 30 4d vectors) 
// alphachannel represents radius, rgb channels represent xyz coordinates of 
// the cone direction vector in model space
uniform vec4 coneSequence[30];
uniform int coneCount; 

//Make this "true" for sceendoor transparency (randomly discarding fragments)
//so that you can blur the result in another pass. Otherwise make it  
//false for a solid shell.  
uniform bool multiPass;

//Following three varyings are 
//Only used for fake lighting. 
//Not conceptually relevant
varying vec3 vertViewNormal;
uniform vec3 vertLightDir;


float hash(float n) {
    float x = sin(n) * 43758.5453123;
    return fract(x);
}

float noise(vec2 U) {
    return hash(U.x+5000.0*U.y);
}

bool randBit(vec2 U) {
    float dist2 = 1.0;
    return 0.5 < (noise(U) * 4. -(noise(U+vec2(dist2,0.))+noise(U+vec2(0.,dist2))+noise(U-vec2(0.,dist2))+noise(U-vec2(dist2,0.))) + 0.5);
}
///END OF NOISE FUNCTIONS FOR FANCY TRANSPARENCY RENDERING.

bool isInInterConePath(in vec3 normalDir, in vec4 tangent1, in vec4 cone1, in vec4 tangent2, in vec4 cone2) {			
    vec3 c1xc2 = cross(cone1.xyz, cone2.xyz);		
    float c1c2dir = dot(normalDir, c1xc2);
        
    if(c1c2dir < 0.0) { 
        vec3 c1xt1 = cross(cone1.xyz, tangent1.xyz); 
        vec3 t1xc2 = cross(tangent1.xyz, cone2.xyz);	
        float c1t1dir = dot(normalDir, c1xt1);
        float t1c2dir = dot(normalDir, t1xc2);
        
        return (c1t1dir > 0.0 && t1c2dir > 0.0); 
            
    }else {
        vec3 t2xc1 = cross(tangent2.xyz, cone1.xyz);	
        vec3 c2xt2 = cross(cone2.xyz, tangent2.xyz);	
        float t2c1dir = dot(normalDir, t2xc1);
        float c2t2dir = dot(normalDir, c2xt2);
        
        return (c2t2dir > 0.0 && t2c1dir > 0.0);
    }	
    return false;
}

//determines the current draw condition based on the desired draw condition in the setToArgument
// -3 = disallowed entirely; 
// -2 = disallowed and on tangentCone boundary
// -1 = disallowed and on controlCone boundary
// 0 =  allowed and empty; 
// 1 =  allowed and on controlCone boundary
// 2  = allowed and on tangentCone boundary
int getAllowabilityCondition(in int currentCondition, in int setTo) {
    if((currentCondition == -1 || currentCondition == -2)
        && setTo >= 0) {
        return currentCondition *= -1;
    } else if(currentCondition == 0 && (setTo == -1 || setTo == -2)) {
        return setTo *=-2;
    }  	
    return max(currentCondition, setTo);
}



//returns 1 if normalDir is beyond (cone.a) radians from cone.rgb
//returns 0 if normalDir is within (cone.a + boundaryWidth) radians from cone.rgb 
//return -1 if normalDir is less than (cone.a) radians from cone.rgb
int isInCone(in vec3 normalDir, in vec4 cone, in float boundaryWidth) {
    float arcDistToCone = acos(dot(normalDir, cone.rgb));
    if(arcDistToCone > (cone.a+(boundaryWidth/2.))) {
        return 1; 
    }
    if(arcDistToCone < cone.a-(boundaryWidth/2.)) {
        return -1;
    }
    return 0;
} 

//returns a color corresponding to the allowability of this region, or otherwise the boundaries corresponding 
//to various cones and tangentCone 
vec4 colorAllowed(in vec3 normalDir,  in int coneCount, in float boundaryWidth) {
    normalDir = normalize(normalDir);
    int currentCondition = -3;
    
    if(coneCount == 1) {
        vec4 cone = coneSequence[0];
        int inCone = isInCone(normalDir, cone, boundaryWidth);
        inCone = inCone == 0 ? -1 : inCone < 0 ? 0 : -3;
        currentCondition = getAllowabilityCondition(currentCondition, inCone);
    } else {
        for(int i=0; i<coneCount-1; i+=3) {
            
            int idx = i*3; 
            vec4 cone1 = coneSequence[idx];
            vec4 tangent1 = coneSequence[idx+1];			
            vec4 tangent2 = coneSequence[idx+2];			
            vec4 cone2 = coneSequence[idx+3];
                                        
            int inCone1 = isInCone(normalDir, cone1, boundaryWidth);
            
            inCone1 = inCone1 == 0 ? -1 : inCone1 < 0 ? 0 : -3;
            currentCondition = getAllowabilityCondition(currentCondition, inCone1);
                
            int inCone2 = isInCone(normalDir, cone2, boundaryWidth);
            inCone2 =  inCone2 == 0 ? -1 : inCone2  < 0 ? 0 : -3;
            currentCondition = getAllowabilityCondition(currentCondition, inCone2);
        
            int inTan1 = isInCone(normalDir, tangent1, boundaryWidth); 
            int inTan2 = isInCone(normalDir, tangent2, boundaryWidth);
            
            if( inTan1 < 1 || inTan2  < 1) {			
                inTan1 =  inTan1 == 0 ? -2 : -3;
                currentCondition = getAllowabilityCondition(currentCondition, inTan1);
                inTan2 =  inTan2 == 0 ? -2 : -3;
                currentCondition = getAllowabilityCondition(currentCondition, inTan2);
            } else {				 
                bool inIntercone = isInInterConePath(normalDir, tangent1, cone1, tangent2, cone2);
                int interconeCondition = inIntercone ? 0 : -3; 
                currentCondition = getAllowabilityCondition(currentCondition, interconeCondition);					
            }
        }
    }	
    
    vec4 result = shellColor;
    
    if(multiPass && (currentCondition == -3 || currentCondition > 0)) {
        
        /////////
        //CODE FOR FANCY BLURRED TRANSPARENCY. 
        //NOT OTHERWISE CONCEPTUALLY RELEVANT TO 
        //TO VISUALIZATION
        ////////
        
        vec3 randDir = vec3(normalDir.x  * noise(normalDir.xy)/50.0,  normalDir.y  * noise(normalDir.yz)/50.0, normalDir.z  * noise(normalDir.zx)/50.0);
        randDir = normalDir;
        float lon = atan(randDir.x/randDir.z) + 3.14159265/2.0;
        float lat = atan(randDir.y/randDir.x) + 3.14159265/2.0;
                
        bool latDraw = randBit(vec2(lat, lon));//mod(lat, 0.005) < 0.00499;
        bool lonDraw = randBit(vec2(lon, lat));//mod(lon, 0.005) < 0.00499;
            
        if(randBit(vec2(lon, lat))) {		
            result = vec4(0.0,0.0,0.0,0.0);	
        }
        ////////
        //END CODE FOR FANCY BLURRED TRANSPARENCY
        ///////
    } else if (currentCondition != 0) {
    
        float onTanBoundary = abs(currentCondition) == 2 ? 0.3 : 0.0; 
        float onConeBoundary = abs(currentCondition) == 1 ? 0.3 : 0.0;	
    
        //return distCol;
        result += vec4(0.0, onConeBoundary, onTanBoundary, 1.0);
    } else {
        discard;
    }
    return result;
            
}

void main() {

    vec3 normalDir = normalize(vertNormal); // the vertex normal in Model Space.
    float lightScalar = abs( (dot(vertViewNormal, vec3(0,0,1)*.75)+.25));
    vec4 sc = vec4(shellColor.rgb*lightScalar, 1.0);
    vec4 colorAllowed = colorAllowed(normalDir, coneCount, 0.02);  

    if(colorAllowed.a == 0.0) {
        discard;
    } else {
        gl_FragColor = sc;
    }    
    //colorAllowed += shellColor*(colorAllowed + fwidth(colorAllowed)); 
    //colorAllowed /= 2.0;
    /*vec3 lightCol = vec3(1.0,0.8,0.0);
    float gain = vertViewNormal.z < 0. ? -0.3 : 0.5;
    colorAllowed.rgb = (colorAllowed.rgb + lightCol*(lightScalar + gain)) / 2.;
    vec4 specCol = vec4(1.0, 1.0, 0.1, colorAllowed.a);  
    colorAllowed = colorAllowed.g > 0.8 ? colorAllowed+specCol : colorAllowed; */
    //gl_FragColor = shellColor*colorAllowed.a;
}
`


