import { BoneState, SkeletonState } from "./solver/SkeletonState.js"
import { ShadowSkeleton } from "./solver/ShadowSkeleton.js"
import { IKTransform } from "./util/nodes/IKTransform.js";
import { Vec3, any_Vec3, Vec3Pool, NoPool } from "./util/vecs.js";
import { CallbacksSequence } from "./CallbacksSequence.js";
import { Rot } from "./util/Rot.js";
import { IKNode, TrackingNode } from "./util/nodes/IKNodes.js";
import { convexBlob, pcaOrientation } from "./util/mathdump/mathdump.js";
import { IKPin } from "./betterbones/IKpin.js";
import { Kusudama } from "./betterbones/Constraints/Kusudama/Kusudama.js";
const THREE = await import('three');
import { Bone } from "three";
//import * as THREE from 'three';
//import { LineSegments, Bone } from "three";

const ikBoneLayer = 1;
const regularBoneLayer = 4;

/**
 * This library creates a shadow armature mirroring the approximate structure of the original armature.
 * "Approximate" here means there is not a one-to-one mapping between the transform hierarchy of 
 * the armature being solved for and the solver's internal representation. 
 * This is primarily to maximize generality across multiple armature formats and conventions.
 * The transforms to be aware of (and which you may need to provide if the library can't infer them are):
 * 
 * 0. ArmatureNode: A transform corresponding to the entire skeleton. For numerical stability, all internal calculations will be performed as if this transform were the identity transform.
 * 1. BoneFrame : A transform directly corresponding to the three.js Bone's position/quaternion/scale. This is the only transform type you should attempt to read back after calling the .solve() function. All other transforms listed below are used to determine how this transform ought to be modified, but they are not themselves modified by the solver (though the EWBIK class does provide convenience functions for inferring what these transforms ought to be if you leave them unspecified)
 * 2. BoneOrientation : A transform which conceptually indicates (via its y-axis) the direction the bone is poining in and its twist about that direction (canonically represented by the deviation of its z axis from the z axis of where the BoneFrame would be after the shortest path rotation that takes the BoneFrame's y-axis to the BoneOrientations y-axis). This doesn't directly map on to anything three.js explicitly represents, but usually you want the y-axis of this transform to point in the direction of the average positions of all direct children of the bone. 
 * 3. ConstraintFrame : A transform defining the orientation of the kusudama sphere which constrains the y axis of the valid BoneOrientations. Generally, this transform is a transform with the same position and orientation as the BoneFrame transform, but an identity rotation and scale. It is defined with respect to the parent of the Bone being constrained
 * 4. TwistFrame: A transform defining the "twist" plane of the constraint. The solver is most reliable if the y-axis and z-axis of this transform are aligned with the y and z axis of the BoneOrientation's most comfortable rest pose. The IKKusudama class provides a convenience function to automatically infer this optimal orientation from the LimitCones defined on the Kusudama.
 * 
 * To illustrate how this transform hierarchy looks, let's consider a three.js scene in which a potted plant is riding a train passing by a wooden crate. 
 * Let's say the scene has the following structure.
 *  |-Scene
 *  |-Box (Object3D)
 *  |-TrainTrack (Object3D)
 *  |-Train (Object3D)
 *      |-FlowerArmature (Object3D)
 *          |-RootBone (Bone)
 *              |-StemLower (Bone)
 *                  |-StemUpper (Bone)
 *                      |-LeftArm (Bone)
 *                          |-LeftLeaf (Bone)
 *                      |-RightArm (Bone)
 *                          |-RightLeaf (Bone)
 *                      |-StemNeck (Bone)
 *                          |-Head (Bone)
 * 
 * If you want to add IK to the plant, with constraints on each of its bones, and effectors / targets on its RootBone, LeftLeaf, RightLeaf, and Head, then the corresponding TransformState structure in the solver will need to end up looking like:
 * 
 *  |-FlowerArmature (TransformState : read only)
 *  |- RootBone_ConstraintFrame (RW !special case)
 *      |- Root_TwistFrame (RW !special case)
 *  |- RootBone_BoneFrame (RW)
 *      |- RootBone_BoneOrientation
 *      |- StemLower_ConstraintFrame
 *          |- StemLower_TwistFrame
 *      |- StemLower_BoneFrame (RW)
 *          |- StemLower_BoneOrientation
 *          |- StemUpper_ConstraintFrame
 *              |- StemUpper_TwistFrame
 *          |- StemUpper_BoneFrame (RW)
 *              |- StemUpper_BoneOrientation
 *              |- LeftArm_ConstraintFrame
 *                  |- LeftArm_TwistFrame
 *              |- LeftArm_BoneFrame (RW)
 *                  |- LeftArm_BoneOrientation
 *                  |- LeftLeaf_ConstraintFrame
 *                      |- LeftLeaf_TwistFrame
 *                  |- LeftLeaf_BoneFrame (RW)
 *                      |- LeftLeaf_BoneOrientation
 *              |- RightArm_ConstraintFrame
 *                  |- RightArm_TwistFrame
 *              |- RightArm_BoneFrame (RW)
 *                  |- RightArm_BoneOrientation
 *                  |- RightLeaf_ConstraintFrame
 *                      |- RightLeaf_TwistFrame
 *                  |- RightLeaf_BoneFrame (RW)
 *                      |- RightLeaf_BoneOrientation
 *              |- StemNeck_ConstraintFrame
 *                  |- StemNeck_TwistFrame
 *              |- StemNeck_BoneFrame (RW)
 *                  |- StemNeck_BoneOrientation
 *                  |- Head_ConstraintFrame
 *                      |- Head_TwistFrame
 *                  |- Head_BoneFrame (RW)
 *                      |- Head_BoneOrientation
 *              
 *      
 * In the above (RW) indicates transforms which you should read back from after calling the solver in order to get the solved state. None of the other transforms are touched by the solver. Though, there are functions in the library which you can call to automatically generate reasonable or optimized defaults of these transforms for you.
 *     
 */

export class EWBIK {
    static __default_dampening = 0.1;
    static totalEWBIKs = 0;
    static XDIR = new Vec3(1, 0, 0);
    static YDIR = new Vec3(0, 1, 0);
    static ZDIR = new Vec3(0, 0, 1);
    defaultIterations = 15;
    dampening = EWBIK.__default_dampening;
    defaultStabilizingPassCount = 0;

    /** @type {SkeletonState} */
    skelState;
    armature = null;
    /** @type {Bone[]} */
    bones = [];
    /** @type {Mesh[]} */
    meshList = []; //contains the meshes autogenerated by showBones
    /** @type {BoneState[]} */
    skelStateBoneRefs = [];
    bonetags = {};
    boneToStateMap = new Map();
    lastRequestedSolveFromBone = null;
    dirtySkelState = true;
    dirtyRate = true;
    armatureNodeUpdated = false;
    tempNode = new IKNode(); //temporary IKNode object for getting armature relative transform info on change of basis.
    static known_ids = {};

    /**@type {Promise} prevents calling the solver before it's done*/
    activeSolve = null;
    pendingSolve = null;
    lastFrameNumber = 0;

    /**
     * 
     * @param {Bone} rootBone 
     */
    /**
     * 
     * @param {Bone} rootBone the root of armature you want to enable IK and constraints on.
     * @param {boolean} asNode if true, this armature will add itself as a child of whatever node the rootbone is a child of, and then adopt the rootbone as its own child.
     * if false, this armature will not add itself as an object3d, it will just track the object3d that is the parent of the rootbone. 
     * You should set this to false if you are importing scenes that have strict expectations about hierarchy. The default is true for convenience of building custom scenes.
     * @param {*} defaultIterations 
     * @param {*} ikd 
     */
    constructor(root, asNode = true, defaultIterations = this.defaultIterations, ikd = 'EWBIKArmature-' + EWBIK.totalEWBIKs, pool = new Vec3Pool(10000)) {
        this.ikd = ikd;
        this.armatureObj3d = asNode ? new THREE.Object3D() : root.parent;
        this.armatureObj3d.ikd = 'EWBIK_root-' + EWBIK.totalEWBIKs;
        this.pool = pool;
        EWBIK.totalEWBIKs += 1;
        let rootBone = EWBIK.findRootBoneIn(root);
        if (asNode) {
            this.armatureObj3d.name = 'armature';
            let armpar = rootBone.parent;
            if (armpar != null) armpar.add(this.armatureObj3d);
            this.armatureObj3d.attach(rootBone);
        }
        if (!rootBone.isIKType) {
            Needles.injectInto(rootBone);
        }
        this.armatureNode = new TrackingNode(this.armatureObj3d, this.armatureObj3d.ikd, false, this.pool);
        if (this.armatureObj3d != null) {
            this.armatureNode.adoptTrackedGlobal();
        }
        this.tempNode.setParent(this.armatureNode);
        this.rootBone = rootBone;
        this.rootBone.registerToArmature(this);
        this.defaultIterations = defaultIterations;
        this.recreateBoneList();
    }
    /**
     * Specifies the default number of iterations per solver pass, if you don't want to manually provide it each time you call solver. 
     * @param {Number} iterations 
     */
    setDefaultIterations(iterations) {
        this.defaultIterations = iterations;
        this.updateShadowSkelRateInfo();
    }

    getDefaultIterations() {
        return this.defaultIterations;
    }

    makeBoneGeo(boneRef, height, radius, mat, hullpoints) {
        const cone = new THREE.ConeGeometry(radius * height, height, 5);
        cone.translate(0, height / 2, 0);
        const hull = convexBlob(cone, ...hullpoints);
        const material = new THREE.MeshPhongMaterial(mat);
        const boneplate = new THREE.Mesh(hull, material);
        //boneplate.position.y = height / 2;
        boneplate.isBoneMesh = true;
        boneplate.forBone = boneRef;
        boneplate.bonegeo = boneplate;
        boneplate.name = 'bonegeo';
        boneplate.layers.set(window.boneLayer);
        boneplate.visible = true;
        return boneplate;
    }

    static findRootBoneIn(startNode) {
        if (startNode instanceof THREE.Bone)
            return startNode;
        for (let c of startNode?.children) {
            console.log(c.type);
            let result = EWBIK.findRootBoneIn(c);
            if (result instanceof THREE.Bone) {
                return result;
            }
        }
    }

    /**
     * creates and adds to the scene physical manifestations of each bone on this armature,
     * @param radius width of bones
     * @param solvedOnly if false, will render all bones, not just the solver relevant ones.
     */
    showBones(radius = 0.5, solvedOnly = false) {
        const minSize = 0.001;
        this.meshList.slice(0, 0);
        if (this.dirtySkelState) this.regenerateShadowSkeleton();
        for (const bone of this.bones) {
            let orientation = bone.getIKBoneOrientation();
            if (orientation.children.length == 0) {
                let matObj = null;
                if (this.skelState?.getBoneStateById(bone.ikd) == null || bone.parent == null) {
                    matObj = { color: new THREE.Color(0.2, 0.2, 0.8), transparent: true, opacity: 0.6 };
                } else {
                    matObj = { color: bone.color, transparent: true, opacity: 1.0 };
                }
                let hullPoints = [];
                for (let c of bone.childBones()) {
                    hullPoints.push(orientation.worldToLocal(bone.localToWorld(c.position.clone())));
                }
                let thisRadius = bone.parent instanceof THREE.Bone ? radius : radius / 2; //sick and tired of giant root bones. Friggen whole ass trunks.
                let bonegeo = this.makeBoneGeo(bone, Math.max(bone.height ?? bone.parent?.height ?? minSize, minSize), thisRadius, matObj, hullPoints);
                orientation.bonegeo = bonegeo;
                bone.setBonegeo(bonegeo);
                bone.bonegeo.layers.set(window.boneLayer);
                bone.visible = true;
                this.meshList.push(bonegeo);
            }
        }
    }



    /**
     * The solver tends to be quite stable whenever a pose is reachable (or
     * unreachable but without excessive contortion). However, in cases of extreme
     * unreachability (due to excessive contortion on orientation constraints), the
     * solution might fail to stabilize, resulting in an undulating motion.
     * 
     * Setting this parameter to "1" will completely prevent such undulations, with a
     * negligible cost to performance. However, the bones may look like they're grinding against
     * their constraint boundaries. 
     * 
     * Values greater than 1 alleviate grindiness (not undulation, as a value of 1 already completely alleviates undulation), the larger the value, the less the grindiness. However note that if you are experiencing grindiness while stress testing, you should consider if the stress tests are sufficiently representative of realworld use to justify the cost of setting this value greater than 1. 
     * 
     * You're encouraged to experiment with this parameter as per your use case, but
     * you may find the following guiding principles helpful:
     * <ul>
     * <li>If your armature doesn't have any constraints, then leave this parameter
     * set to 0.</li>
     * <li>If your armature doesn't make use of orientation aware pins (x,y,and,z
     * direction pin priorities are set to 0) the leave this parameter set to 0.
     * </li>
     * <li>If your armature makes use of orientation aware pins and orientation
     * constraints, then set this parameter to 1</li>
     * <li>If your armature makes use of orientation aware pins and orientation
     * constraints, but speed is of the highest possible priority, then set this
     * parameter to 0</li>
     * </ul>
     * 
     * @param passCount
     */
    setDefaultStabilizingPassCount(passCount) {
        this.defaultStabilizingPassCount = passCount;
    }

    getDefaultStabilizingPassCount() {
        return this.defaultStabilizingPassCount;
    }

    /**
     * lazy lookup for the BoneState corresponding to the given bone. Result is stored and only looked up when it changes.
     * @param {Bone} bone the bone to get the BoneState for.
     * @returns the BoneState as the solver knows it to be
     */
    getBoneStateFor(bone) {
        if (bone != this.lastRequestedSolveFromBone) {
            if (bone == null)
                return null;
            this.lastRequestedSolveFromBoneState = this.boneToStateMap.get(bone);
            this.lastRequestedSolveFromBone = bone;
        }
        return this.lastRequestedSolveFromBoneState;
    }


    /**
     * automatically solves the IK system of this armature from the given bone using
     * the given parameters.
     * 
     * @param {Bone} bone optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments). Otherwise, the solver will solve for all segments.
     * @param {Number} iterations  number of iterations to run. Set this to null or -1 if you want to use the armature's default.
     * @param stabilizingPasses number of stabilization passes to run. Set this to -2 if you want to use the armature's default. -1 tells it to break constraints if need be, 0 means no stabilization, 1 means a single (very cheap) stabilization pass which may increase grindiness in extreme poses. Greater than 1 reduces grindiness, but at signifcant cost.
     * @param {CallbacksSequence} callbacks to snoop on solver state
     * @param {Number} frameNumber entirely optional and for convenience. If you're counting frames, you can provide the frame number you're on here to make sure the solver doesn't get called more than once per frame.
     * this will cause any solve requests beyond the first one in a frame to be ignored. Please be mindful that -- due to the limits of javascript 64-bit integers,
     * any animation running at 120 frames per second will integer overflow after approximately 4.9 million years, and you should not use this feature if you intend to run your animation for longer than that.
     */
    async solve(bone, iterations = this.getDefaultIterations(), stabilizingPasses = this.getDefaultStabilizingPassCount(), callbacks, frameNumber = this.lastFrameNumber+1) {
        this.pendingSolve = async function (armature, bone, iterations, stabilizingPasses, callbacks) {
            return await armature.__solve(bone, iterations, stabilizingPasses, callbacks);
        };
        if (this.lastFrameNumber >= frameNumber) {
                this.activeSolve = this.pendingSolve;
        }
        //console.log("cleared. . .");
        if (this.pendingSolve != null) {
            const doSolve = this.pendingSolve;
            this.pendingSolve = null;
            //console.log("solving");
            if (bone == null || this.boneToStateMap.get(bone) != null) {
                if(frameNumber > this.lastFrameNumber) {
                    this.activeSolve = doSolve(this, bone, iterations, stabilizingPasses, callbacks);                    
                }
                this.lastFrameNumber = frameNumber;
            }
            this.activeSolve = null;            //console.log("solvied");
        }
        if(this.activeSolve != null) {
            return await this.activeSolve;
        } else {
            return;
        }
    }

    noOp(fromBone = null, iterations = this.getDefaultIterations(), callbacks) {
        if (this.dirtySkelState)
            this._regenerateShadowSkeleton();
        if (this.dirtyRate)
            this._updateShadowSkelRateInfo(iterations);
        this.updateskelStates();
        this.shadowSkel.noOp(fromBone, iterations, (bonestate, workingBone) => this.updateBoneColors(bonestate, workingBone), callbacks);
        this.pool.releaseAll();
    }

    /**
     * 
     * internal async version of solve()
     * automatically solves the IK system of this armature from the given bone using
     * the given parameters.
     * 
     * @param {Bone} bone optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments). Otherwise, the solver will solve for all segments.
     * @param {Number} iterations  number of iterations to run. Set this to null or -1 if you want to use the armature's default.
     * @param stabilizingPasses number of stabilization passes to run. Set this to -2 if you want to use the armature's default. -1 tells it to break constraints if need be, 0 means no stabilization, 1 means a single (very cheap) stabilization pass which may increase grindiness in extreme poses. Greater than 1 reduces grindiness, but at signifcant cost.
     * @param {CallbacksSequence} callbacks to snoop on solver state
     */
    async __solve(bone, iterations = this.getDefaultIterations(), stabilizingPasses = this.getDefaultStabilizingPassCount(), callbacks) {

        if (this.dirtySkelState)
            this._regenerateShadowSkeleton();
        if (this.dirtyRate)
            this._updateShadowSkelRateInfo(iterations);
        //performance.startPerformanceMonitor();
        this.updateskelStates(callbacks);
        //let forBoneState = this.getBoneStateFor(bone);
        callbacks?.__initStep((callme, bs, ts, wb) => this.stepWiseUpdateResult(callme, bs, ts, wb));
        //let ds = this.shadowSkel.debugState;
        this.shadowSkel.solve(
            iterations == -1 ? this.getDefaultIterations() : iterations,
            stabilizingPasses == -2 ? this.getDefaultStabilizingPassCount : stabilizingPasses,
            bone,
            (bs, ts, wb) => this.alignBoneToSolverResult(bs, ts, wb), callbacks);
        this.pool.releaseAll();
        //ds.currentIteration = 0;
        //ds.solveCalls += 1;
        //console.log('solve#: ' +ds.solveCalls +'\t:: itr :: ' +ds.currentIteration);
        return true;
        //performance.solveFinished(iterations == -1 ? this.IKIterations : iterations);
    }

    /**
     * brings each bone one step toward their most comfortable pose. maybe useful if you want to inspect your pain values and stockholm rates. 
     * @param {Bone} bone optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments). Otherwise, the solver will solve for all segments.
     * @param {Number} iterations  number of iterations to run. Set this to null or -1 if you want to use the armature's default.
     * @param stabilizingPasses number of stabilization passes to run. Set this to -2 if you want to use the armature's default. -1 tells it to break constraints if need be, 0 means no stabilization, 1 means a single (very cheap) stabilization pass which may increase grindiness in extreme poses. Greater than 1 reduces grindiness, but at signifcant cost.
     * @param {CallbacksSequence} callbacks to snoop on solver state
     */
    async doSinglePullbackStep(bone, iterations = this.getDefaultIterations(), stabilizingPasses = this.getDefaultStabilizingPassCount(), callbacks) {
        this.pendingSolve = async () => await this._doSinglePullbackStep(bone, iterations, stabilizingPasses, callbacks);
        if (this.activeSolve != null) {
            //console.log("waiting. . .");
            await this.activeSolve;
        }
        //console.log("cleared. . .");
        if (this.pendingSolve != null) {
            const doSolve = this.pendingSolve;
            this.pendingSolve = null;
            //console.log("solving");
            this.activeSolve = doSolve();
            await this.activeSolve;
            this.activeSolve = null;
            //console.log("solvied");
        }
    }

    /**
     * internal async version of doSinglePullbackStep
     * brings each bone one step toward their most comfortable pose. maybe useful if you want to inspect your pain values and stockholm rates. 
     * @param {Bone} bone optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments). Otherwise, the solver will solve for all segments.
     * @param {Number} iterations  number of iterations to run. Set this to null or -1 if you want to use the armature's default.
     * @param stabilizingPasses number of stabilization passes to run. Set this to -2 if you want to use the armature's default. -1 tells it to break constraints if need be, 0 means no stabilization, 1 means a single (very cheap) stabilization pass which may increase grindiness in extreme poses. Greater than 1 reduces grindiness, but at signifcant cost.
     * @param {CallbacksSequence} callbacks to snoop on solver state
     */
    async _doSinglePullbackStep(bone = null, iterations = this.getDefaultIterations(), stabilizationPasses = this.getDefaultStabilizingPassCount(), callbacks) {
        if (this.dirtySkelState)
            this._regenerateShadowSkeleton();
        if (this.dirtyRate) {
            this._updateShadowSkelRateInfo();
            this.shadowSkel.updateRates(this.getDefaultIterations());
            this.dirtyRate = false;
        }
        this.updateskelStates(callbacks);
        callbacks?.__initStep((callme, bs, ts, wb) => this.stepWiseUpdateResult(callme, bs, ts, wb));
        this.shadowSkel.pullBackAll(this.getDefaultIterations(), null, (bs, ts, wb) => this.alignBoneToSolverResult(bs, ts, wb), callbacks, 0);
    }

    /**
     * read back the solver results from the SkeletonState object. 
     * The solver only ever modifies the transforms of the bones themselves
     * so we don't need to bother with constraint or target transforms.
     */
    /*alignBonesListToSolverResults() {
        const bonestates = skelState.getBonesArray();
        for (let i = 0; i < bonestates.length; i++) {
            this.alignBoneToSolverResult(bonestates[i]);
        }
    }*/

    updateBoneColors(bs, ts, wb) {
        const bsi = bs.getIndex();
        const currBoneAx = this.skelStateBoneRefs[bsi];
        let pain = bs.readBonePain();
        let bonecol = currBoneAx.bonegeo.material.color;
        bonecol.r = pain;
        bonecol.g = 1 - pain;
        bonecol.b = 0.2;
    }

    stepWiseUpdateResult(callMe, bone, ts, wb) {
        this.alignBoneToSolverResult(wb.forBone, ts, wb);
        callMe(bone, ts, wb);
    }

    /**
     * read back the solver results from the given BoneState to the corresponding AbstractBone. 
     * The solver only ever modifies things in local space, so we can just markDirty after
     * manually updating the local transforms and defer global space updates to be triggered by 
     * whatever else in the pipeline happens to need them.
     * @param {BoneState} bonestate
     */

    alignBoneToSolverResult(bs, ts, wb) {
        const bsi = bs.getIndex();
        const currBoneAx = this.skelStateBoneRefs[bsi];
        currBoneAx.position.set(...ts.translation);//, ts.rotation, ts.scale);
        currBoneAx.quaternion.x = -ts.rotation[1];
        currBoneAx.quaternion.y = -ts.rotation[2];
        currBoneAx.quaternion.z = -ts.rotation[3];
        currBoneAx.quaternion.w = ts.rotation[0];
        this.updateBoneColors(bs);
        currBoneAx.IKUpdateNotification();
    }

    printpains() {
        let bonestates = this.skelState.getBoneStatesArray();
        for (let i = 0; i < this.skelStateBoneRefs.length; i++) {
            let b = this.skelStateBoneRefs[i];
            let bs = bonestates[i];
            console.log(bs.readBonePain + ' --   ' + b.ikd);
        }
    }

    async regenerateShadowSkeleton(force) {
        this.dirtySkelState = true;
        this.pendingSolve = null; //invalidate any pending solve
        if (force)
            return this._regenerateShadowSkeleton();
        this.dirtyRate = true;
    }

    /**
     * If this bone has no orientation transform, or does have one but the overwrite argument is true, infers an orientation for this bone. 
     * The orientation is inferred to be the smallest rotation which would cause the y-axis of the bone's transformFrame to point toward the average position of its child bones.
     * @param {THREE.Bone} fromBone
     * @param {string} cane be either 'plate' or 'cone'. The former is appropriate where parents and children aren't in direct contact.
     */
    inferOrientations(fromBone, mode, override = false, depth = Infinity) {
        this._maybeInferOrientation(fromBone, mode, override, depth - 1);
        this.regenerateShadowSkeleton();
    }


    /**
     * tries to guess the what the armature format is presuming.
     * The possibilities it looks at are: 
     * 1. all bones are defined in global space. (creates new boneOrientations from parents to general direction of children)
     * 2. all bones are pointing in the general direction of their children on either the x, y, or z axis (sets a bone orientation pointing along that axis)
     * @param {Bone3d} this function works recursively.
     * @return object of form {
     *  globalAlignment: Number, 
     * negX: Number, portion of direct chldren that reside to -X local space of this bone
     * posX: Number, portion of direct chldren that reside to +X local space of this bone
     * negY: Number, portion of direct chldren that reside to -Y local space of this bone
     * posY: Number, portion of direct chldren that reside to +Y local space of this bone
     * negZ: Number, portion of direct chldren that reside to -Z local space of this bone
     * posZ: Number, portion of direct chldren that reside to +Z local space of this bone
     * }
     * 
    */
    getLikeliestForm(fromBone) {


    }
    _maybeInferOrientation(fromBone, mode = 'plate', override = false, depth = Infinity) {
        let orientation = fromBone.getIKBoneOrientation();
        if (orientation.placeholder == true || override) {
            let sumVec = this.pool.any_Vec3(0, 0, 0);
            let sumheight = fromBone.height ?? 0;
            let count = 0;
            let minChild = 999;
            let maxChild = -1;
            let sum_sqheight = sumheight;
            let childPoints = [];
            for (let cb of fromBone.childBones()) {
                count++;
                let childvec = this.pool.any_Vec3(cb.position.x, cb.position.y, cb.position.z);
                let childMagSq = childvec.magSq();
                let childMag = Math.sqrt(childMagSq);
                sum_sqheight += childMagSq; //helps weigh in favor of further bones, because a lot of rigs do weird annoying things with twist bones.
                sumheight += childMag;
                minChild = Math.max(Math.min(minChild, childMag), 0.01);
                maxChild = Math.max(maxChild, sumheight);
                sumVec.add(childvec);
                childPoints.push(childvec);
            }
            let normeddir = sumVec;
            fromBone.height = fromBone.parent.height;
            if (count > 0) {
                normeddir = sumVec.div(count).normalize();
                if (mode == 'cone')
                    fromBone.height = Math.sqrt(sum_sqheight) / Math.sqrt(count);
                if (mode == 'plate')
                    fromBone.height = minChild;
            }

            //let rotTo = pcaOrientation(childPoints, fromBone, 
            //  (vecs, refBasis) => {                    
            let rotTo = Rot.fromVecs(EWBIK.YDIR, normeddir);
            //    return rotTo; 
            // }
            //);

            orientation.quaternion.set(-rotTo.x, -rotTo.y, -rotTo.z, rotTo.w);

            fromBone.setIKBoneOrientation(orientation);
            for (let cb of fromBone.childBones()) {
                this._maybeInferOrientation(cb, mode, override, depth - 1);
            }
        }
        //this.regenerateShadowSkeleton();
    }


    _regenerateShadowSkeleton() {
        this.armatureNodeUpdated = false;
        this.pool.reclaim();
        this.skelState = new SkeletonState(false);


        let armatureTransform = this.armatureNode.getGlobalMBasis();
        this.skelState.addTransform(
            this.armatureNode.ikd,
            armatureTransform.translate.components,
            [armatureTransform.rotation.w, armatureTransform.rotation.x, armatureTransform.rotation.y, armatureTransform.rotation.z],
            [this.armatureNode.getLocalMBasis().x, this.armatureNode.getLocalMBasis().scale.y, this.armatureNode.getLocalMBasis().scale.z],
            null, this.armatureNode);

        for (let bone of this.bones) {
            this.registerBoneWithShadowSkeleton(bone);
        }

        this.skelState.validate();

        this.shadowSkel = new ShadowSkeleton(this.pool, this.skelState, this.getDampening());
        this.skelStateBoneRefs = new Array(this.skelState.getBoneCount());
        this.boneToStateMap.clear();
        for (let i = 0; i < this.bones.length; i++) {
            let bonestate = this.skelState.getBoneStateById(this.bones[i].ikd);
            if (bonestate != null) {
                this.skelStateBoneRefs[bonestate.getIndex()] = this.bones[i];
                this.boneToStateMap.set(this.bones[i], bonestate);
            }
        }
        this.lastRequestedSolveFromBone = null;
        this.dirtySkelState = false;
        this._updateShadowSkelRateInfo();
        this.ikReady = true;
        this.pool.finalize();
    }

    setDampening(val) {
        this.dampening = val;
        this.shadowSkel?.setDampening(this.dampening, this.getDefaultIterations());
        this.updateShadowSkelRateInfo();
    }

    getDampening() {
        return this.dampening;
    }

    recreateBoneList() {
        this.bones = [];
        this.bonetags = {};
        this.addSingleBone(this.rootBone);
        this._recursivelyRegisterDescendantBonesOf(this.rootBone);
    }

    _recursivelyRegisterDescendantBonesOf(ofBone) {
        for (let child of ofBone.childBones()) {
            this.addSingleBone(child);
            this._recursivelyRegisterDescendantBonesOf(child);
        }
    }

    addSingleBone(bone) {
        if (this.bones.indexOf(bone) == -1)
            this.bones.push(bone);
        this.uniqueInsert(EWBIK.known_ids, bone);
        this.uniqueInsert(this.bonetags, bone, 'name');
    }

    /**
     * only inserts the element into the collection if it isn't already there. 
     * If it is there, changes the ewbik_id internal id of the element to be unique if necessary before inserting
     * @param {*} collection 
     * @param {*} elem 
     */
    uniqueInsert(collection, elem, property = 'ikd') {
        if (elem.ikd == null) {
            if (elem.name != null && elem.name.length > 0) {
                elem[property] = elem.name + '';
            } else if (elem.tag != null) {
                elem[property] = elem.tag + '';
            } else {
                elem[property] = elem.id + '';
            }
        }
        let i = 0;
        while (i < 10000) {
            let collectionResult = collection[elem[property]];
            if (collectionResult == null) {
                collection[elem[property]] = elem;
                break;
            }
            if (collectionResult == elem) break;

            let dashsplit = elem.ikd.split("-")
            let num = '1';
            if (dashsplit.length > 1)
                num = dashsplit.pop();
            dashsplit.push((parseInt(num) + 1) + '');
            elem[property] = dashsplit.join('-');
            i++;
        }

    }

    updateShadowSkelRateInfo(force = false, iterations = this.previousIterations) {
        this.dirtyRate = true;
        this.previousIterations = iterations;
        this.pendingSolve = null; //invalidate any pending solve
        if (force) this._updateShadowSkelRateInfo(iterations);
    }

    _updateShadowSkelRateInfo(iterations = this.previousIterations) {
        this.armatureNodeUpdated = false;
        let bonestates = this.skelState.getBoneStatesArray();
        for (let i = 0; i < this.skelStateBoneRefs.length; i++) {
            let b = this.skelStateBoneRefs[i];
            let bs = bonestates[i];
            bs.setStiffness(b.getStiffness());
            let targetState = bs.getTarget();
            if (targetState != null) {
                let pin = b.getIKPin();
                let ts = targetState;
                ts.setWeight(pin.getPinWeight());
                ts.setPriorities([pin.getXPriority(), pin.getYPriority(), pin.getZPriority()]);
            }
        }
        this.shadowSkel.updateRates(iterations);
        this.previousIterations = iterations;
        this.dirtyRate = false;
    }


    registerBoneWithShadowSkeleton(bone) {
        if (!bone.isIKType) {
            Needles.injectInto(bone);
        }
        let parBoneId = (bone.getParentBone() == null) ? null : bone.getParentBone().ikd;
        let constraint = bone.getConstraint();
        let constraintId = (constraint == null) ? null : constraint.ikd;
        let pin = bone.getIKPin();
        let pinId = (pin == null || pin.isEnabled() == false) ? null : pin.ikd;
        this.skelState.addBone(
            bone.ikd,
            bone.ikd,
            parBoneId,
            bone,
            bone.getStiffness(),
            constraintId,
            pinId,
            bone.getIKBoneOrientation().ikd);
        this.registerAxesWithShadowSkeleton(bone);
        this.registerAxesWithShadowSkeleton(bone.getIKBoneOrientation());
        if (pinId != null) this.registerTargetWithShadowSkeleton(pin);
        if (constraintId != null) this.registerConstraintWithShadowSkeleton(constraint);
    }


    registerTargetWithShadowSkeleton(ikPin) {
        const trackingNode = ikPin.getAxes();

        this.skelState.addTarget(ikPin.ikd,
            trackingNode.ikd,
            ikPin.forBone.ikd,
            [ikPin.getXPriority(), ikPin.getYPriority(), ikPin.getZPriority()],
            ikPin.getDepthFalloff(),
            ikPin.getPinWeight());
        if (trackingNode) {
            let existingPar = this.isInArmature(trackingNode);
            if (existingPar != trackingNode && existingPar != null)
                this.registerAxesWithShadowSkeleton(trackingNode, true, existingPar);
            else
                this.registerAxesWithShadowSkeleton(trackingNode, true, this.armatureNode);
        }
    }

    /**
     * @param {TrackingNode or IKNode or Object3D} fromNode
     * @returns fromnode or the ancestor of fromNode if it is within the armature, null otherwise 
     */
    isInArmature(fromNode) {
        if (fromNode == null)
            return fromNode;
        if (fromNode == this.armatureNode)
            return this.armatureNode;
        if (fromNode == this.armatureObj3d)
            return this.armatureNode;

        if (fromNode instanceof IKNode) {
            if (this.isInArmature(fromNode.getParentAxes()))
                return fromNode.getParentAxes();
            if (fromNode instanceof TrackingNode) {
                return this.isInArmature(fromNode.toTrack.parent);
            }
        }
        return this.isInArmature(fromNode.parent);
    }

    /**
     * 
     * @param {(Constraint|Rest|Kusudama)} constraint 
     */
    registerConstraintWithShadowSkeleton(constraint) {
        let twistAxes = constraint?.twistOrientationAxes == null ? null : constraint.twistOrientationAxes();
        /**type */
        this.skelState.addConstraint(
            constraint.ikd,
            constraint.attachedTo().ikd,
            constraint);
    }

    /**
     * @param {Object3d or IKNode} axes
     * @param {boolean} rebase if true, and reparentTo is provided, then the reparenting is done such that the world space values of the axes remain the same. Meaning if you claim that your shoulder target is a descendant of your hip bone, the shoulder target will be in the same place relative to the other bones as it appears in your scene. 
     * @param {Object3d or IKNode} reparentTo if provided, the transformState for this axes will lie to the skeleton state and claim that the parent of the input axes is the one you provide as this parameter 
     */
    registerAxesWithShadowSkeleton(axes, rebase = false, reparentTo = null) {
        let basis = null;
        let parent_id = axes.parent?.ikd;
        if (rebase == false) {
            /**
            * you may not escape the armature. Not only will Everything Be IK, but IK Will Be Everything.
            * */
            if (parent_id == null && reparentTo == null) {
                basis = this.getReparentedBasis(axes, this.armatureNode);
                parent_id = this.armatureNode.ikd;
            } else {
                basis = this.getReparentedBasis(axes, axes.parent); // jsut to convert bone to IKTRansform
            }
        } else {
            reparentTo = this.isInArmature(reparentTo);
            if (axes.parent != null && reparentTo == null) {
                basis = axes.getLocalMBasis();
            } else if (reparentTo != null) {
                basis = this.getReparentedBasis(axes, reparentTo);
                parent_id = reparentTo.ikd;
            } else {
                basis = this.getReparentedBasis(axes, this.armatureNode);
                parent_id = this.armatureNode.ikd;
            }
        }
        let translate = basis.translate;
        let rotation = basis.rotation;
        //if(parent_id == null) parent_id = this.armatureNode.id;
        this.skelState.addTransform(
            axes.ikd,
            [translate.x, translate.y, translate.z],
            [rotation.w, rotation.x, rotation.y, rotation.z], //
            [basis.scale.x, basis.scale.y, basis.scale.z],
            parent_id, axes);
    }

    tempBasis = new IKTransform();

    /**
     * returns an IKTransform of the given IKnode in the space of the reparentTo Node.
     * @param {IKNode or Object3D} axes the IKNode to do a change of basis on
     * @param {IKNode or Object3D} reparentTo A node or Object3D which you wish to treat as the new parent. 
     *  @param {boolean} IjustWantABasis honestly named.
     * @return an IKTransform which, if multiplied by the reparentTo worldspace transform, will be equivalent to the axes worldspace transform.
     */
    getReparentedBasis(axes, reparentTo, IjustWantABasis = false) {
        if (reparentTo == null && !IjustWantABasis) {
            throw new Error("must provide reparentTo");
        }
        if (this.armatureNodeUpdated == false) {
            if (this.armatureObj3d != null) {
                this.armatureNode.adoptGlobalValuesFromObject3D(this.armatureObj3d);
            } else {
                this.armatureNode.toIdentity();
            }
            this.armatureNodeUpdated = true;
        }

        let basis = null;
        let node = axes;
        if (axes instanceof THREE.Object3D) {
            if (reparentTo != axes.parent)
                this.tempNode.adoptGlobalValuesFromObject3D(axes);
            this.tempNode.adoptLocalValuesFromObject3D(axes);
            basis = this.tempNode.getLocalMBasis();
            if (IjustWantABasis && reparentTo == null)
                return basis;
            node = this.tempNode;
        } else {
            basis = axes.getLocalMBasis();
        }
        if (reparentTo != axes.parent) {
            reparentTo.getGlobalMBasis().setTransformToLocalOf(node.getGlobalMBasis(), this.tempBasis);
            return this.tempBasis;
        }
        return basis;
    }

    updateskelStates() {
        this.armatureNodeUpdated = false;
        this.armatureNode.adoptTrackedGlobal();
        this.armatureNodeUpdated = true;
        const bonestates = this.skelState.getBoneStatesArray();
        for (let i = 0; i < this.skelStateBoneRefs.length; i++) {
            let b = this.skelStateBoneRefs[i];
            let bs = bonestates[i];
            this.updateSkelStateBone(b, bs);
        }
    }

    updateSkelStateBone(b, bs) {
        this.updateSkelStateAxes(b, bs.getFrameTransform(), b.parent, true);
        /*if (b.getConstraint() != null) {
            this.updateSkelStateConstraint(b.getConstraint(), bs.getConstraint());
        }*/
        let ts = bs.getTarget();
        if (ts != null) {
            this.updateSkelStateTarget(b.getIKPin(), ts);
        }
    }

    updateSkelStateAxes(a, ts, setRelativeTo = null, quiet = false) {
        let basis = this.getReparentedBasis(a, setRelativeTo, quiet);
        ts.rotation[0] = basis.rotation.w;
        ts.rotation[1] = basis.rotation.x;
        ts.rotation[2] = basis.rotation.y;
        ts.rotation[3] = basis.rotation.z;
        ts.translation[0] = basis.translate.x;
        ts.translation[1] = basis.translate.y;
        ts.translation[2] = basis.translate.z;
        /*ts.scale[0] = basis.scale.x;
        ts.scale[1] = basis.scale.y;
        ts.scale[2] = basis.scale.z;*/
        /*if (!a.forceOrthoNormality) {
            ts.scale[0] = basis.getXHeading().mag() * (basis.isAxisFlipped(IKNode.X) ? -1 : 1);
            ts.scale[1] = basis.getYHeading().mag() * (basis.isAxisFlipped(IKNode.Y) ? -1 : 1);
            ts.scale[2] = basis.getZHeading().mag() * (basis.isAxisFlipped(IKNode.Z) ? -1 : 1);
        } else {
            ts.scale[0] = basis.isAxisFlipped(IKNode.X) ? -1 : 1;
            ts.scale[1] = basis.isAxisFlipped(IKNode.Y) ? -1 : 1;
            ts.scale[2] = basis.isAxisFlipped(IKNode.Z) ? -1 : 1;
        }*/
    }

    updateSkelStateTarget(pin, ts) {
        this.updateSkelStateAxes(pin.getAxes(), ts.getTransform(), ts.getTransform().getParentTransform().directReference);
    }


    /**convenience for if the user wants to manually update the rate info without trying to determine
     * the appropriate number of iterations to keep all other solver behavior the same
     */
    set previousIterations(itr) {
        this._previousIterations = itr;
    }
    get previousIterations() {
        if (this._previousIterations == null)
            this._previousIterations = this.defaultIterations;
        return this._previousIterations;
    }



    _debug_iteration(solveFrom, iterations = this.defaultIterations, callbacks = null) {
        if (this.dirtySkelState)
            this._regenerateShadowSkeleton();
        if (this.dirtyRate)
            this._updateShadowSkelRateInfo(iterations);


        let ds = this.shadowSkel.debugState;
        if (ds.currentIteration == 0) {
            this.updateskelStates();
            this.shadowSkel.updateReturnfulnessDamps(iterations);
            this.shadowSkel.alignSimAxesToBoneStates();
        }
        let i = 0;
        //let doNothing = ()=>{};

        let endOnIndex = this.shadowSkel.getEndOnIndex(solveFrom);
        this.shadowSkel.updateReturnfulnessDamps(iterations);
        callbacks?.__initStep((callme, bs, ts, wb) => this.stepWiseUpdateResult(callme, bs, ts, wb));
        let doalign = (bs, ts, wb) => this.alignBoneToSolverResult(bs, ts, wb);

        this.shadowSkel.solveToTargets(this.getDefaultStabilizingPassCount(), endOnIndex, doalign, callbacks, ds.currentIteration);
        ds.currentIteration = ds.currentIteration + 1;
        if (ds.currentIteration >= iterations) {
            ds.solveCalls++;
            ds.currentIteration = 0;
        }
        console.log('solve#: ' + ds.solveCalls + '\t:: itr :: ' + ds.currentIteration);
    }

    /**
     * calls the solver step by step, bone by bone, iteration by iteration so you can debug the hell out of whatever you want.
     * @param {Bone} bone optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments). Otherwise, the solver will solve for all segments.
     * @param {Number} iterations  number of iterations to run. Set this to null or -1 if you want to use the armature's default.
     * @param {CallbacksSequence} callbacks to snoop on solver state
     */
    _debug_bone(solveFrom, iterations = this.defaultIterations, callbacks = null) {
        if (this.dirtySkelState)
            this._regenerateShadowSkeleton();
        if (this.dirtyRate)
            this._updateShadowSkelRateInfo(iterations);
        let ds = this.shadowSkel.debugState;
        if (ds.currentIteration == 0) {
            this.updateskelStates();
            this.shadowSkel.updateReturnfulnessDamps(iterations);
            this.shadowSkel.alignSimAxesToBoneStates();
        }
        this.shadowSkel.incrStep();
        callbacks?.__initStep((callme, bs, ts, wb) => this.stepWiseUpdateResult(callme, bs, ts, wb));
        this.shadowSkel.debug_solve(iterations, this.getDefaultStabilizingPassCount(), solveFrom, (bs, ts, wb) => this.alignBoneToSolverResult(bs, ts, wb), callbacks);
        if (ds.completedIteration) {
            if (ds.currentIteration >= iterations) {
                ds.solveCalls++;
                ds.currentIteration = 0;
                console.log('solve#: ' + ds.solveCalls + '\t:: itr :: ' + ds.currentIteration);
            }
        }
    }




    /*canonical_id(obj) {
        let candidate_ewbik_id = null;
        if(obj.ewbk_id == null) candidate_ewbik_id = obj.id;
        if(known_keys[candidate_ewbik_id] != null && known_keys[candidate_ewbik_id] != obj) {
            if(candidate_ewbik_id.split("__").length == 1) {
                obj.ewbk_id = candidate_ewbik_id +"__"+1;
                known_keys[obj.ewbk_id] = obj;
                return obj.ewbk_id;
            }
            let known_keys = Object.keys(this.known_ids);
            for(let k of known_keys) {

            }
        }
        
    }*/
}






let betterbones = {
    isIKType: true,
    stiffness: 0,
    /**
     * temporary version of setIKOrientationLock for convenience in locking things
     * without worrying about if they're already locked.
     *
     * @param {function} callback to call when checking ock state. Should return true if locked, false otherwise
     */
    setTempIKOrientationLock(lock) {
        let prevLock = this.getIKOrientationLock();
        this.tempLock = lock;
        if (lock != prevLock)
            this.parentArmature?.updateShadowSkelRateInfo();
    },
    
    /*setTempIKOrientationLock(callback = (forBone)=>false) {
        let prevLock = this.getIKOrientationLock();
        this.tempLock = callback(this);
        this._tempLockFunc = callback;
        if (lock != prevLock)
            this.parentArmature?.updateShadowSkelRateInfo();
    },*/

    /**
     * if set to true, the IK system will not rotate this bone.
     * @param {boolean} lock
     */
    setIKOrientationLock(lock) {
        let prevLock = this.orientationLock;
        this.orientationLock = lock;
        if (lock != prevLock)
            this.parentArmature?.updateShadowSkelRateInfo();
    },
    getIKOrientationLock() {
        return this.orientationLock || this.tempLock;//_tempLockCallback();
    },

    setStiffness(stiffness) {
        this.stiffness = stiffness;
        this.parentArmature?.updateShadowSkelRateInfo();
    },

    /**
     * The stiffness of a bone determines how much the IK solver should 
     * prefer to avoid rotating it if it can. A value of 0  means the solver will 
     * rotate this bone as much as the overall dampening parameter will 
     * allow it to per iteration. A value of 0.5 means the solver will 
     * rotate it half as much as the dampening parameter will allow,
     * and a value of 1 effectively means the solver is not allowed 
     * to rotate this bone at all. 
     * @return a value between 1 and 0. 
     */
    getStiffness() {
        if (this.getIKOrientationLock()) return 1;
        return this.stiffness ?? 0;
    },

    getConstraint() {
        /** @type {Constraint} */
        return this.constraint;
    },

    registerToArmature(armature) {
        this.parentArmature = armature;
        for (const b of this.childBones())
            b.registerToArmature(this.parentArmature);
        this.parentArmature.regenerateShadowSkeleton();
    },

    /**
     * 
     * @param {AbstractKusudama} constraint
     */
    setConstraint(constraint) {
        /** @type {Constraint} */
        this.constraint = constraint;
        this.parentArmature?.regenerateShadowSkeleton();
    },

    /**
     * define the physical orientation of this bone relative to its object3d reference frame
     * @param {Object3d} newOrientation 
     */
    setIKBoneOrientation(newOrientation) {
        /** @type {IKTransform} */
        if (this.orientation == null)
            this.orientation = newOrientation
        else if (newOrientation != this.orientations) {
            this.orientation.copy(newOrientation);
        }
        this.orientation.placeholder = false;
    },

    getIKBoneOrientation() {
        if (this.orientation == null) {
            this.orientation = new THREE.Object3D()
            this.orientation.ikd = this.id + '-orientation';
            this.orientation.placeholder = true;
            this.add(this.orientation);
        }

        /** @type {IKTransform} */
        return this.orientation;
    },

    getBonegeo() {
        this._bonegeo;
    },

    setBonegeo(newgeo) {
        if (newgeo != null) {
            if (this.bonegeo != newgeo) {
                this.orientation.remove(this.bonegeo);
                this.bonegeo?.material.dispose();
                this.bonegeo?.geometry.dispose();
            }
            if (this.orientation.children.indexOf(newgeo) == -1)
                this.orientation.add(newgeo);
        }
        this.orientation.bonegeo = newgeo;
        this.bonegeo = newgeo;
    },

    /** */
    setIKPin(pin, disabled = false) {
        let prevPinState = this.isPinned();
        /** @type {setIKPin} */
        this.pin = pin;
        let newPinState = this.isPinned();
        if (prevPinState != newPinState && this.parentArmature != null)
            this.parentArmature.regenerateShadowSkeleton();
    },

    getIKPin() {
        return this.pin;
    },

    isPinned() {
        if (this.pin == null || !this.pin.isEnabled()) {
            return false;
        } else {
            return true;
        }
    },

    original_add: THREE.Bone.prototype.add,

    add(elem) {
        //console.log("added");

        if (this.orientation != null && elem instanceof THREE.LineSegments) {
            this.orientation.add(elem);
        } else {
            this.original_add(elem);
            if (elem instanceof THREE.Bone) {
                if (this.parentArmature != null) {
                    elem.registerToArmature(this.parentArmature);
                    this.parentArmature.addSingleBone(this);
                }
            }
        }
    },

    *childBones() {
        for (let i = 0; i < this.children.length; i++) {
            if (this.children[i] instanceof THREE.Bone)
                yield this.children[i];
        }
    },

    getParentBone() {
        if (this.parent == null || !(this.parent instanceof THREE.Bone)) {
            return null;
        } else {
            return this.parent;
        }
    },

    IKUpdateNotification() {
        //console.log("ik updated");
    }
}

Object.assign(THREE.Bone.prototype, betterbones);




