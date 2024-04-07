import { IKTransform } from "../../../util/nodes/IKTransform.js";
const THREE = await import('three')
import { Bone } from 'three';
import { Rot } from "../../../util/Rot.js";
import { Vec3, any_Vec3 } from "../../../util/vecs.js";
import { Ray } from "../../../util/Ray.js";
import { IKNode } from "../../../util/nodes/IKNodes.js";
import { generateUUID } from "../../../util/uuid.js";
import { Constraint, Limiting, LimitingReturnful } from "../Constraint.js";
import { kusudamaFragShader, kusudamaVertShader } from "./shaders.js";
import { LimitCone } from "./LimitCone.js";
import { Saveable } from "../../../util/loader/saveable.js";

export class Kusudama extends Limiting {

    static TAU = Math.PI * 2;
    static PI = Math.PI;
    static totalInstances = 0;
    static vertShade = kusudamaVertShader;
    static fragShade = kusudamaFragShader;
    static baseShellColor = new THREE.Vector4(0.4, 0, 0.4, 1.0);
    static violationColor = new THREE.Vector4(1, 0, 0, 1);
    coneSeq = [];
    limitCones = [];
    static desireGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    static desiredMat = new THREE.MeshBasicMaterial({color: new THREE.Color('blue')});
    
    static async fromJSON(json, loader, pool, scene) {
        let result = new Kusudama(undefined, json.ikd, pool);
        return result;
    }
    async postPop(json, loader, pool, scene)  {
        let res = await super.postPop(json, loader, pool, scene);
        let p = await Saveable.prepop(json.requires, loader, pool, scene);
        this.frameCanonical = p.frameCanonical;
        this.boneCanonical = p.boneCanonical;
        this.limitCones = [];
        for(let lc of p.limitCones) {
            this.limitCones.push(lc);
        }
        this.initKusuNodes();
        return this;
    }

    getRequiredRefs () {
        let req = super.getRequiredRefs();
        req.limitCones = [...this.limitCones];
        req.frameCanonical = this.frameCanonical;
        req.boneCanonical = this.boneCanonical;
        return req;
    }

    constructor(forBone = null, ikd = 'Kusudama-' + (Kusudama.totalInstances++), pool = noPool) {
        let basis = new IKNode(undefined, undefined, undefined, pool)
        super(forBone, basis, ikd, pool);
        this.ikd = ikd;
        this.minAxialAngle = Math.PI;
        this.range = Math.PI * 3;
        this.orientationallyConstrained = false;
        this.axiallyConstrained = false;
        this.strength = 1.0;
        this.flippedBounds = false;
        if(!Saveable.loadMode) {
            if(this.forBone) {
                let yHead = this.tempNode1.adoptLocalValuesFromObject3D(this.forBone.getIKBoneOrientation()).getLocalMBasis().getYHeading();
                this.tempNode1.adoptLocalValuesFromObject3D(this.forBone).localMBasis.rotation.applyToVec(yHead, yHead);
                this.limitCones.push(new LimitCone(yHead, 0.2, undefined, this.pool));
            }
            this.initKusuNodes()
        }
    }

    initKusuNodes() {
        this.frameCanonical = this.basisAxes;
        this.boneCanonical = this.basisAxes.freeClone();
        this.boneCanonical.setParent(this.frameCanonical);
        this.desiredTracer = new THREE.Mesh(Kusudama.desireGeo, Kusudama.desiredMat);
        
        this.__frame_calc_internal = new IKNode(undefined, undefined, undefined, this.pool);
        this.__bone_calc_internal = new IKNode(undefined, undefined, undefined, this.pool);
        if (this.forBone?.height) {
            this.boneCanonical.adoptLocalValuesFromObject3D(this.forBone.getIKBoneOrientation());
            this.geometry = new THREE.SphereGeometry(this.forBone.height * .75, 32, 32);
        } else {
            this.geometry = new THREE.SphereGeometry(.75, 32, 32);
        }

        for (let i = 0; i < 120; i++) { this.coneSeq.push(new THREE.Vector4()); }

        this.coneSeqMaterial = new THREE.ShaderMaterial({
            vertexShader: Kusudama.vertShade,
            fragmentShader: Kusudama.fragShade, // Your fragment shader code here
            transparent: false,
            blending: THREE.NormalBlending,
            side: THREE.DoubleSide,
            uniforms: {
                shellColor: { value: Kusudama.baseShellColor },
                vertLightDir: { value: new THREE.Vector3(0, 0, 1) },
                coneSequence: { value: this.coneSeq },
                coneCount: { value: 1 },
                multiPass: { value: true },
                frame: { value: 0 },
                screensize: { value: new THREE.Vector2(1920, 1080) }
            },
        });
        this.coneSeqMaterial.oldOnBFR = this.coneSeqMaterial.onBeforeRender;
        this.coneSeqMaterial.onBeforeRender = function (renderer, scene, camera, geometry, mesh, ...others) {
            this.uniforms.frame.value = renderer.info.render.frame;
            this.uniforms.screensize.value.x = renderer.domElement.width;
            this.uniforms.screensize.value.y = renderer.domElement.height;
            if (this.oldOnBFR != null)
                this.oldOnBFR(renderer, scene, camera, geometry, mesh, ...others);
        }
        this.shell = new THREE.Mesh(this.geometry, this.coneSeqMaterial);

        this.__bone_calc_internal.setRelativeToParent(this.__frame_calc_internal);
        this.updateDisplay();
    }


    updateDisplay() {
        this.shell.quaternion.set(0, 0, 0, 1);
        this.shell.position.set(this.forBone.position.x, this.forBone.position.y, this.forBone.position.z);
        this.forBone.parent.add(this.shell);
        this.shell.add(this.desiredTracer);
        let i = 0;
        for (let lc of this.limitCones) {
            let cp = lc.controlPoint.normalize();
            let tc1 = lc.tangentCircleCenterNext1.normalize();
            let tc2 = lc.tangentCircleCenterNext2.normalize();
            this.shell.material.uniforms.coneSequence.value[i].set(cp.x, cp.y, cp.z, lc.radius);
            this.shell.material.uniforms.coneSequence.value[i + 1].set(tc1.x, tc1.y, tc1.z, lc.tangentCircleRadiusNext);
            this.shell.material.uniforms.coneSequence.value[i + 2].set(tc2.x, tc2.y, tc2.z, lc.tangentCircleRadiusNext);
            i += 3;
        }
        this.shell.material.uniforms.coneCount.value = this.limitCones.length;
        this.updateViolationHint();
    }

    inBoundsDisplay = [1.0];
    inBoundsConstrain = [1.0];
    updateViolationHint() {
        this.__frame_calc_internal.adoptLocalValuesFromObject3D(this.forBone);
        this.__bone_calc_internal.adoptLocalValuesFromObject3D(this.forBone.getIKBoneOrientation());
        this.tempHeading.set(this.__bone_calc_internal.getGlobalMBasis().getYHeading());
        this.frameCanonical.setVecToLocalOf(this.tempHeading, this.tempHeading);
        
        let result = this.pointInLimits(this.tempHeading, this.inBoundsDisplay);
        
        this.desiredTracer.position.x = result.x; //this.tempHeading.x;
        this.desiredTracer.position.y = result.y; //this.tempHeading.y;
        this.desiredTracer.position.z = result.z; //this.tempHeading.z;
        this.desiredTracer.layers.set(1);
        this.desiredTracer.updateMatrix();
       
        //console.log(this.tempHeading.toConsole(1))
        if (this.inBoundsDisplay[0] == -1 && result.sub(this.tempHeading).magSq() > 1e-12)
            this.shell.material.uniforms.shellColor.value = Kusudama.violationColor;
        else
            this.shell.material.uniforms.shellColor.value = Kusudama.baseShellColor;
    }

    addLimitCone(previous, next, newPoint, radius) {
        let insertAt = 0;

        if (this.limitCones.length == 0) {
            this.addLimitConeAtIndex(-1, newPoint, radius);
        }
        else if (previous != null && next == null) {
            insertAt = this.limitCones.indexOf(previous) + 1;
            if (newPoint == null) {
                newPoint = previous.getControlPoint().clone();
                Rot.fromAxisAngle(newPoint.getOrthogonal(), previous.getRadius() * 1.5).applyToVec(newPoint, newPoint);
                radius = previous.getRadius();
            }
        } else if (next != null && previous == null) {
            insertAt = this.limitCones.indexOf(next);
            if (newPoint == null) {
                newPoint = next.getControlPoint().clone();
                Rot.fromAxisAngle(newPoint.getOrthogonal(), next.getRadius() * 1.5).applyToVec(newPoint, newPoint);
                radius = next.getRadius();
            }
        } else {
            insertAt = Math.max(0, this.limitCones.indexOf(next));
            if (newPoint == null) {
                newPoint = previous.getControlPoint().clone();
                newPoint.add(previous.getControlPoint());
                newPoint.div(2);
                radius = (next.getRadius() + previous.getRadius()) / 2;
            }
        }
        return this.addLimitConeAtIndex(insertAt, newPoint, radius);
    }

    /**
     * Add a limitcone after the provided limitcone. Its values will be interpolated
     * between the limitcones it is adjacent to. If it is only adjacent to one cone, it will
     * have the same radius as that cone, rotated in a random direction away from it. 
     * 
     * Hope you like surprises.
     *  @param {LimitCone} next LimitCone to insert this one before
     */
    addLimitConeBefore(next) {
        let atIndex = this.limitCones.indexOf(next);
        let result = this.addLimitCone(null, next, null, null);
        return result;
    }

    /**
     * Add a limitcone before the provided limitcone. Its values will be interpolated
     * between the limitcones it is adjacent to. If it is only adjacent to one cone, it will
     * have the same radius as that cone, rotated in a random direction away from it. 
     * 
     * Hope you like surprises.
     * @param {LimitCone} previous LimitCone to insert this one after
     */
    addLimitConeAfter(previous) {
        let atIndex = this.limitCones.indexOf(previous) + 1;
        let result = this.addLimitConeAtIndex(previous, null, null, null);
        return result;
    }

    removeLimitCone(limitCone) {
        const index = this.limitCones.indexOf(limitCone);
        if (index !== -1) {
            this.limitCones.splice(index, 1);
            this.updateTangentRadii();
            this.updateRotationalFreedom();
        }
    }

    addLimitConeAtIndex(index, coneDir, coneRadius) {
        let newCone = null;
        if (coneDir instanceof LimitCone) {
            this.limitCones.splice(index, 0, coneDir)
            newCone = coneDir;
        } else {
            newCone = new LimitCone(coneDir, coneRadius, undefined, this.pool);
            this.limitCones.splice(index, 0, newCone);
        }
        this.updateTangentRadii();
        this.updateDisplay();
        return newCone;
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

    getAcceptableRotation(currentState, currentBoneOrientation, desiredRotation, calledBy = null) {
        let inBounds = [1.0];
        let currentOrientation = currentState.localMBasis.rotation.applyAfter(currentBoneOrientation.localMBasis.rotation, this.tempOutRot);
        let desiredOrientation = desiredRotation.applyAfter(currentOrientation, this.tempRot2);
        this.tempVec1.setComponents(0, 1, 0);
        let currentHeading = currentOrientation.applyToVec(this.tempVec1, this.tempVec1);
        this.tempVec2.setComponents(0, 1, 0);
        let desiredHeading = desiredOrientation.applyToVec(this.tempVec2, this.tempVec2);
        let frameLocalDesiredHeading = this.frameCanonical.setVecToLocalOf(desiredHeading, this.tempHeading);
        let inLimits = this.pointInLimits(frameLocalDesiredHeading, inBounds);

        if (inBounds[0] == -1 && inLimits != null) {
            let constrainedHeading = this.frameCanonical.getGlobalMBasis().setVecToGlobalOf(inLimits, this.tempVec3);
            let rectifiedRot = this.tempOutRot.setFromVecs(currentHeading, constrainedHeading);
            return rectifiedRot;
        }
        return desiredRotation;
    }

    setAxesToReturnfulled(toSet, currentOrientation, swingAxes, twistAxes, cosHalfReturnfullness, angleReturnfullness) {
        if (this.painfulness > 0.0) {
            let origin = toSet.origin();
            let inPoint = toSet.yRay().p2.clone();
            let pathPoint = this.pointOnPathSequence(inPoint, swingAxes);
            inPoint.sub(origin);
            pathPoint.sub(origin);
            let toClamp = Rot.fromVecs(inPoint, pathPoint);
            toClamp.clampToCosHalfAngle(cosHalfReturnfullness);
            toSet.rotateByGlobal(toClamp);
        }
    }

    pointInLimits(inPoint, inBounds) {
        let point = inPoint.clone();
        point.normalize();

        inBounds[0] = -1;

        let closestCollisionPoint = null;
        let closestCos = -2;
        if (this.limitCones.length > 1) {
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
        } else {
            if (point.dot(this.limitCones[0].getControlPoint()) > this.limitCones[0].getRadiusCosine()) {
                inBounds[0] = 1;
                return inPoint;
            } else {
                let axis = this.limitCones[0].getControlPoint().cross(point, this.pool.any_Vec3());
                let toLimit = Rot.fromAxisAngle(axis, this.limitCones[0].getRadius());
                return toLimit.applyToVecClone(this.limitCones[0].getControlPoint());
            }
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


    setPainfulness(amt) {
        this.painfulness = amt;
        if (this.forBone && this.forBone.parentArmature) {
            this.forBone.parentArmature.updateShadowSkelRateInfo();
        }
    }

    getPainulness() {
        return this.painfulness;
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