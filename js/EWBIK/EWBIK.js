const THREE = await import('three');
import { ShadowSkeleton } from "./solver/ShadowSkeleton.js"
import { IKTransform } from "./util/nodes/IKTransform.js";
import { Vec3, any_Vec3, any_Vec3fv, Vec3Pool } from "./util/vecs.js";
import { CallbacksSequence } from "./CallbacksSequence.js";
import { Interpolator } from "./util/nodes/Interpolator.js";
import { Rot } from "./util/Rot.js";
import { IKNode, TrackingNode } from "./util/nodes/IKNodes.js";
import { convexBlob, pcaOrientation } from "./util/mathdump/mathdump.js";
import { IKPin } from "./betterbones/IKpin.js";
import { Rest, Twist, Kusudama, LimitCone, ConstraintStack} from "./betterbones/Constraints/ConstraintStack.js";
import { Bone } from "three";
import { Saveable, Loader } from "./util/loader/saveable.js";
import { Object3D } from "../three/three.module.js";
import { ShadowNode } from "./util/nodes/ShadowNode.js";

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

export class EWBIK extends Saveable {
    static __default_dampening = 0.1;
    static __dfitr = 15;
    static totalInstances = 0;
    static XDIR = new Vec3(1, 0, 0);
    static YDIR = new Vec3(0, 1, 0);
    static ZDIR = new Vec3(0, 0, 1);
    defaultIterations = 15;
    dampening = EWBIK.__default_dampening;
    defaultStabilizingPassCount = 0;

    armature = null;
    /** @type {Bone[]} */
    bones = [];
    /** @type {Mesh[]} */
    meshList = []; //contains the meshes autogenerated by showBones
    bonetags = {};
    boneToStateMap = new Map();
    lastRequestedSolveFromBone = null;
    dirtyShadowSkel = true;
    dirtyRate = true;
    armatureNodeUpdated = false;
    tempNode = null; //temporary IKNode object for getting armature relative transform info on change of basis.
    static known_ids = {};

    /**@type {Promise} prevents calling the solver before it's done*/
    activeSolve = null;
    pendingSolve = null;
    lastFrameNumber = 0;
    /**
     * Whether to treat the last end effector as if it has max orientation priorities.
     * This is essentially a convenience to let the user specify that the last bone should make a best effort to orientation match while still allowing other bones in the chain to make less than a best effort.
     **/
    independentTerminal = true;

    static async fromJSON(json, loader, pool, scene) {
        let foundBone = Loader.findSceneObject(json.requires.rootBone, scene);
        let result = new EWBIK(
            foundBone,
            json.defaultIterations, 
            json.ikd, 
            pool);
        result.armatureObj3d.ikd = 'EWBIK_root-' + json.instanceNumber;
        return result;
    }

    toJSON() {
        let result = super.toJSON();
        result.defaultIterations = this.defaultIterations;
        result.dampening = this.dampening;
        result.insertedAsNode = this.insertedAsNode;
        result.bonetags = [];
        for(let [ikd, b] of Object.entries(this.bonetags)) {
            result.bonetags.push(b.toIKSaveJSON());
        }
        return result;
    }

    getRequiredRefs () {
        let req = {}
        req.rootBone = this.rootBone;
        req.armatureNode = this.armatureNode;
        req.armatureObj3d = this.armatureObj3d;
        req.bones = [];        
        for(let [ikd, b] of Object.entries(this.bonetags)) {
            b['toIKSaveJSON'] = b['toIKSaveJSON'].bind(b);
            req.bones.push(b);
            //req.boneinfo.push(b.toIKSaveJSON());
        }
        return req;
    }

    async postPop(json, loader, pool, scene)  {
        let p = await Saveable.prepop(json.requires, loader, pool, scene);
        this.insertedAsNode = json.insertedAsNode;
        this.armatureNode = p.armatureNode;
        this.defaultIterations = json.defaultIterations;
        this.defaultStabilizingPassCount = json.defaultStabilizingPassCount; 
        this.initNodes(this.rootBone, this.insertedAsNode, this.armatureNode, pool);
        for(let b of json.bonetags) {
            this.bonetags[b.ikd].loadIKInfoFromJSON(b, loader, pool, scene);
        }
        return this;
    }


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
    constructor(root, defaultIterations = EWBIK.__dfitr, ikd = `EWBIK-${EWBIK.totalInstances++}`, pool = new Vec3Pool(10000)) {
        super(ikd, 'EWBIK', EWBIK.totalInstances, pool);
        this.rootBone = EWBIK.findRootBoneIn(root);
        this.stablePool = this.pool;
        this.volatilePool = new Vec3Pool(this.pool.tempSize);
        if(this.rootBone.trackedBy == null) this.rootBone.trackedBy = new ShadowNode(this.rootBone, undefined, this.stablePool);
        this.armatureObj3d = root.trackedBy.nodeDepth < this.rootBone.parent.nodeDepth ? root : this.rootBone.parent;
        this.armatureObj3d.ikd = 'EWBIK_armature_root-' + this.instanceNumber;
        this.armatureObj3d.name = 'EWBIK_armature_root-' + this.instanceNumber;
        if(!Saveable.loadMode) {
            this.initNodes(this.armatureObj3d.trackedBy, pool);
        }        
        this.rootBone.registerToArmature(this);
        this.defaultIterations = defaultIterations;
        this.recreateBoneList();
    }

    initNodes(armatureNode, pool) {
        
        if(this.armatureNode == null) {
            this.armatureNode = this.armatureObj3d.trackedBy;
            this.armatureNode = armatureNode
        }
        if (this.armatureObj3d != null) {
            this.armatureNode.mimic(true);
        }
        this.tempNode = new IKNode();
        this.tempNode.setParent(this.armatureNode);        
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
        const hull = hullpoints.length > 0 ? convexBlob(cone, ...hullpoints) : cone;
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
        this.meshList.slice(0, 0);
        if (this.dirtyShadowSkel) this.regenerateShadowSkeleton();
        for (const bone of this.bones) {
            this.makeBoneMesh(bone, radius, 'plate');
        }
    }

    /**creates or recreates mesh and geometry to display the given bone*/
    makeBoneMesh(bone, radius, mode = 'cone') {
        const minSize = 0.001;
        let oldGeo = bone.bonegeo;
        let idx = this.meshList.indexOf(oldGeo);
        let orientation = bone.getIKBoneOrientation();
        //if (orientation.children.length == 0) {
            let matObj = null;
            if (this.shadowSkel?.isSolvable(bone) == null || bone.parent == null) {
                matObj = { color: new THREE.Color(0.2, 0.2, 0.8), transparent: true, opacity: 0.6 };
            } else {
                matObj = { color: bone.color, transparent: true, opacity: 0.6 };
            }
            let hullPoints = [];
            if(mode =='plate') {                
                for (let c of bone.childBones()) {
                    c.updateWorldMatrix();
                    hullPoints.push(orientation.worldToLocal(bone.localToWorld(c.position.clone())));
                }
            }
            
            let thisRadius = bone.parent instanceof THREE.Bone ? radius : radius / 2; //sick and tired of giant root bones. Friggen whole ass trunks.
            let bonegeo = this.makeBoneGeo(bone, Math.max(bone.height ?? bone.parent?.height ?? minSize, minSize), thisRadius, matObj, hullPoints);
            orientation.bonegeo = bonegeo;
            bone.setBonegeo(bonegeo);
            bone.bonegeo.layers.set(window.boneLayer);
            bone.bonegeo.displayradius = radius; 
            bone.visible = true;
        //}
        if(idx != -1) {
            this.meshList[idx] = bone.bonegeo;
        } else {
            this.meshList.push(bone.bonegeo);
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
     * automatically solves the IK system of this armature from the given bone using
     * the given parameters.
     * 
     * @param {Bone} bone optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments). Otherwise, the solver will solve for all segments.
     * @param {Number} iterations  number of iterations to run. Set this to null or -1 if you want to use the armature's default.
     * @param stabilizingPasses number of stabilization passes to run. Set this to -2 if you want to use the armature's default. -1 tells it to break constraints if need be, 0 means no stabilization, 1 means a single (very cheap) stabilization pass which may increase grindiness in extreme poses. Greater than 1 reduces grindiness, but at signifcant cost.
     * @param {Bone} stopOn defaults to null, an optional ancestor bone to stop solving by. Note that any children of this ancestore bone will still be solved for.
     * @param {Function} onComplete callback to fire when the solve has completed. Defaults to an internal callback that updates the Three.js transformations to match the solver, but your are free to specify your own. The callback is called once per bone per solve request, not once per iteration.
     * @param {CallbacksSequence} debug_callbacks to snoop on solver state
     * @param {Number} frameNumber entirely optional and for convenience. If you're counting frames, you can provide the frame number you're on here to make sure the solver doesn't get called more than once per frame.
     * this will cause any solve requests beyond the first one in a frame to be ignored. Please be mindful that -- due to the limits of javascript 64-bit integers,
     * any animation running at 120 frames per second will integer overflow after approximately 4.9 million years, and so this feature is not appropriate for animations intended to run longer than that.
     */
    async solve(bone, iterations = this.getDefaultIterations(), stabilizingPasses = this.getDefaultStabilizingPassCount(), stopOn = null, onComplete = (wb) => this.alignBoneToSolverResult(wb), debug_callbacks, frameNumber = this.lastFrameNumber+1) {
        let literal = stopOn != null;
        debug_callbacks?.__initStep((callme, wb) => this.stepWiseUpdateResult(callme, wb));
        if(stopOn != null) bone = stopOn;
        this.pendingSolve = async function (armature, bone, literal, iterations, stabilizingPasses, onComplete, debug_callbacks) {
            return await armature.__solve(bone, literal, iterations, stabilizingPasses, onComplete, debug_callbacks);
        };
        if (this.lastFrameNumber >= frameNumber) {
                this.activeSolve = this.pendingSolve;
        }
        if (this.pendingSolve != null) {
            const doSolve = this.pendingSolve;
            this.pendingSolve = null;
            if(this.shadowSkel == null) this.regenerateShadowSkeleton(true);
            if (bone == null || this.shadowSkel.isSolvable(bone)) {
                if(frameNumber > this.lastFrameNumber) {
                    this.activeSolve = doSolve(this, bone, literal, iterations, stabilizingPasses, onComplete, debug_callbacks);                    
                }
                this.lastFrameNumber = frameNumber;
            }
            this.activeSolve = null;            
        }
        if(this.activeSolve != null) {
            return await this.activeSolve;
        } else {
            return;
        }
    }

    noOp(fromBone = null, iterations = this.getDefaultIterations(), callbacks) {
        if (this.dirtyShadowSkel)
            this._regenerateShadowSkeleton();
        if (this.dirtyRate)
            this._updateShadowSkelRateInfo(iterations);
        //this.updateShadowNodes();
        this.shadowSkel.noOp(fromBone, iterations, (wb) => this.alignBoneToSolverResult(wb), callbacks);
        this.pool.releaseTemp();
    }

    /**
     * 
     * internal async version of solve()
     * automatically solves the IK system of this armature from the given bone using
     * the given parameters.
     * 
     * @param {Bone} bone optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments). Otherwise, the solver will solve for all segments.
     * @param {Boolean} literal optional, default faule, if true, the bone above will be treated as a literal stopping point, meaning no ancestors prior to it will be solved for, even if this results in an incomplete segment
     * @param {Number} iterations  number of iterations to run. Set this to null or -1 if you want to use the armature's default.
     * @param stabilizingPasses number of stabilization passes to run. Set this to -2 if you want to use the armature's default. -1 tells it to break constraints if need be, 0 means no stabilization, 1 means a single (very cheap) stabilization pass which may increase grindiness in extreme poses. Greater than 1 reduces grindiness, but at signifcant cost.
     * @param {Function} onComplete callback to fire when the solve has completed. Defaults to an internal callback that updates the Three.js transformations to match the solver, but your are free to specify your own. The callback is called once per bone per solve request, not once per iteration.
     * @param {CallbacksSequence} debug_callbacks to snoop on solver state
     **/
    async __solve(bone, literal, iterations = this.getDefaultIterations(), stabilizingPasses = this.getDefaultStabilizingPassCount(), onComplete=(wb) => this.alignBoneToSolverResult(wb), debug_callbacks) {
        if (this.dirtyShadowSkel)
            this._regenerateShadowSkeleton();
        if (this.dirtyRate)
            this._updateShadowSkelRateInfo(iterations);
        
        this.shadowSkel.solve(
            iterations == -1 ? this.getDefaultIterations() : iterations,
            stabilizingPasses == -2 ? this.getDefaultStabilizingPassCount : stabilizingPasses,
            bone,
            literal,
            onComplete, 
            debug_callbacks);
        this.stablePool.releaseTemp();
        this.volatilePool.releaseTemp();
        return true;
    }

    /**
     * brings each bone one step toward their most comfortable pose. maybe useful if you want to inspect your pain values and stockholm rates. 
     * @param {Bone} bone optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments). Otherwise, the solver will solve for all segments.
     * @param {Number} iterations  number of iterations to run. Set this to null or -1 if you want to use the armature's default.
     * @param stabilizingPasses number of stabilization passes to run. Set this to -2 if you want to use the armature's default. -1 tells it to break constraints if need be, 0 means no stabilization, 1 means a single (very cheap) stabilization pass which may increase grindiness in extreme poses. Greater than 1 reduces grindiness, but at signifcant cost.
     * @param {CallbacksSequence} callbacks to snoop on solver state
     */
    async doSinglePullbackStep(bone, stopOn, iterations = this.getDefaultIterations(), stabilizingPasses = this.getDefaultStabilizingPassCount(), onComplete =(wb) => this.alignBoneToSolverResult(wb), callbacks) {
        let literal = stopOn != null;
        this.pendingSolve = async () => await this._doSinglePullbackStep(bone, literal, iterations, stabilizingPasses, onComplete, callbacks);
        if (this.activeSolve != null) {
            await this.activeSolve;
        }
        if (this.pendingSolve != null) {
            const doSolve = this.pendingSolve;
            this.pendingSolve = null;
            this.activeSolve = doSolve();
            await this.activeSolve;
            this.activeSolve = null;
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
    async _doSinglePullbackStep(bone = null, literal, iterations = this.getDefaultIterations(), stabilizationPasses = this.getDefaultStabilizingPassCount(), onComplete =(wb) => this.alignBoneToSolverResult(wb), callbacks) {
        
        if (this.dirtyShadowSkel)
            this._regenerateShadowSkeleton();
        if (this.dirtyRate) {
            this._updateShadowSkelRateInfo();
            this.shadowSkel.updateRates(this.getDefaultIterations());
            this.dirtyRate = false;
        }
        callbacks?.__initStep((callme, wb) => { this.stepWiseUpdateResult(callme, wb); this.alignBoneToSolverResult(wb)});
        this.shadowSkel.alignSimAxesToBoneStates();
        let endOnIndex = this.shadowSkel.getEndOnIndex(bone, literal)
        this.shadowSkel.pullBackAll(this.getDefaultIterations(), endOnIndex, callbacks, 0);
        this.shadowSkel.updateBoneStates(onComplete, callbacks);
    }

 

    updateBoneColors(wb) {
        if(wb.forBone.bonegeo == null) return;
        let pain = wb.getOwnPain();
        let bonecol = wb.forBone.bonegeo.material.color;
        bonecol.r = pain;
        bonecol.g = 1 - pain;
        bonecol.b = 0.2;
    }

    recolorPreviewSkel() {
        for(let b of this.bones) {
            if(b.bonegeo != null) {
                if(!this.shadowSkel?.isSolvable(b)) {
                
                    b.bonegeo.material.color = new THREE.Color(0.2, 0.2, 0.8);
                }
            }
        }
    }

    stepWiseUpdateResult(callMe, wb) {
        this.alignBoneToSolverResult(wb);
        callMe(wb);
    }

    /**
     * read back the solver results from the given WorkingBone to the corresponding AbstractBone. 
     * The solver only ever modifies things in local space, so we can just markDirty after
     * manually updating the local transforms and defer global space updates to be triggered by 
     * whatever else in the pipeline happens to need them.
     * @param {WorkingBone} wb
     */

    alignBoneToSolverResult(wb) {
        let forBone = wb.forBone;
        wb.simLocalAxes.project();
        if(forBone.getConstraint() != null && forBone.getConstraint().visible) {
            this.updateBoneColors(wb);
            forBone.getConstraint().updateDisplay();
        }
        forBone.IKUpdateNotification();
    }

    regenerateShadowSkeleton(force) {
        this.dirtyShadowSkel = true;
        this.pendingSolve = null; //invalidate any pending solve
        if (force)
            this._regenerateShadowSkeleton();
        this.dirtyRate = true;
    }

    /**
     * If this bone has no orientation transform, or does have one but the overwrite argument is true, infers an orientation for this bone. 
     * The orientation is inferred to be the smallest rotation which would cause the y-axis of the bone's transformFrame to point toward the average position of its child bones.
     * @param {THREE.Bone} fromBone
     * @param {string} mode be either 'statistical' or 'naive'. The former is appropriate where parents and children aren't in direct contact and a heuristic determination must be made
     */
    inferOrientations(fromBone, mode, override = false, depth = Infinity) {
        this._maybeInferOrientation(fromBone, mode, override, depth - 1);
        this.regenerateShadowSkeleton();
    }

    /**convenience function for overriding undesirable result of inferOrientations. 
     * let's you manualy specify the direction the physical bone should point in relative to the bone frame
     * the easiest way to use this is to just give "pointTo" as one of the bone children's position
     * @param {Bone} forBone the bone you want to override the physical orientation of
     * @param {Vector3|Vec3} pointTo a direction in bone space you want the physical bone to point toward.
     */
    setInternalOrientationFor(forBone, pointTo) {
        if(forBone.getConstraint() != null) {
            throw new Error("This function cannot be used on bones that have already had constraints defined. It's dangerous and complicated.")
        }
        let orientation = forBone.getIKBoneOrientation();
        let normeddir = this.pool.any_Vec3(0,0,0).readFromTHREE(pointTo);
        forBone.height = normeddir.mag();
        normeddir.normalize(false);
        let rotTo = Rot.fromVecs(EWBIK.YDIR, normeddir);        
        orientation.quaternion.set(-rotTo.x, -rotTo.y, -rotTo.z, rotTo.w);
        
        if(forBone.bonegeo != null) {
            this.makeBoneMesh(forBone, forBone?.bonegeo?.displayradius, 'cone');
        }
        forBone.setIKBoneOrientation(orientation);
        orientation?.trackedBy?.mimic();        
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
    _maybeInferOrientation(fromBone, mode = 'statistical', override = false, depth = Infinity) {
        if(depth == 0) return;
        let orientation = fromBone.getIKBoneOrientation();
        if (orientation.placeholder == true || override) {
            let sumVec = this.pool.any_Vec3(0, 0, 0);
            let sumheight = fromBone.height ?? 0;
            let count = 0;
            let minChild = 999;
            let maxChild = -1;
            let sum_sqheight = sumheight;
            let childPoints = [this.volatilePool.any_Vec3(0,0,0)]; //always include this bone's base position
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
                normeddir = sumVec.div(count).normalize(false);
                if (mode == 'naive')
                    fromBone.height = Math.sqrt(sum_sqheight) / Math.sqrt(count);
                if (mode == 'statistical')
                    fromBone.height = minChild;
            }

            let rotTo = /*pcaOrientation(childPoints, fromBone, 
              (vecs, refBasis) => {
                if(normeddir.magSq() == 0 || vecs.length == 0) {
                    return new Rot(1,0,0,0);
                }                    
                let result = */Rot.fromVecs(EWBIK.YDIR, normeddir);
                /*if(isNaN(result.w)) return new Rot(1,0,0,0);
                return result;
              }
            );*/

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
        this.volatilePool.reclaim();
        this.stablePool.unfinalize();

        this.shadowSkel = new ShadowSkeleton(this, this.rootBone, this.armatureNode, this.getDampening());
        
        
        this.lastRequestedSolveFromBone = null;
        this.dirtyShadowSkel = false;
        this._updateShadowSkelRateInfo();
        this.ikReady = true;
        this.volatilePool.finalize();
        this.stablePool.finalize();
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
     * If it is there, changes the ewbik_id internal id (ikd) of the element to be unique if necessary before inserting
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

    /**
     * For basic use you shouldn't need to call this function, as most of the external things you are 
     * likely to call will take care of setting it for you.
     * But if you are doing anything more advanced or messing with the system internals, then this is here
     * because the dampening and comfort calculations get a performance boost by caching some values that 
     * change under the following criteria:
     * 1. the dampening used per iteration
     * 2. the stiffness of a bone
     * 3. the painfulness of a constraint
     * 4. the structure of the skeleton
     * 
     * For this reason, this function gets called once after changing any of those things.     * 
     * 
     * @param {Boolean} force if true, will forcibly update the cache
     * @param {Number} iterations the number of iterations intended. The rates for all previously cached iterations will be updated
     */
    updateShadowSkelRateInfo(force = false, iterations = this.previousIterations) {
        this.dirtyRate = true;
        this.pendingSolve = null; //invalidate any pending solve
        if (force) this._updateShadowSkelRateInfo(iterations);
    }

    _updateShadowSkelRateInfo(iterations = this.previousIterations) {
        this.armatureNodeUpdated = false;
        this.previousIterations = parseInt(iterations);
        this.shadowSkel.updateRates(iterations);
        this.previousIterations = iterations;
        this.dirtyRate = false;
    }

    tempBasis = new IKTransform();


    /**slow. only use for infrequent tasks. Returns a flat array of all contraints and any of their subconstraints on this armature
     * @param {Function} callback an optional function to run once per constraint. function will be provided with a reference to the constraint as an argument
    */
    forAllConstraints(callback = null) {
        let result = [];
        for(let b of this.bones) {
            if(b.getConstraint()) {
                let c = b.getConstraint();
                if(callback != null) {
                    callback(c);
                }
                result.push(c);
                if(c instanceof ConstraintStack) {
                    let subcs = c.getAllConstraints();
                    if(callback != null) {
                        for(let sc of subcs) {
                            callback(sc);
                        }
                    }
                    result.push(...subcs);
                }
            }
        }
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
        if (this.dirtyShadowSkel)
            this._regenerateShadowSkeleton();
        if (this.dirtyRate)
            this._updateShadowSkelRateInfo(iterations);


        let ds = this.shadowSkel.debugState;
        this.shadowSkel.alignSimAxesToBoneStates();
        //if (ds.currentIteration == 0) {
        this.shadowSkel.updateReturnfulnessDamps(iterations);
        
        //}
        let i = 0;
        //let doNothing = ()=>{};

        let endOnIndex = this.shadowSkel.getEndOnIndex(solveFrom);
        this.shadowSkel.updateReturnfulnessDamps(iterations);
        callbacks?.__initStep((callme, wb) => this.stepWiseUpdateResult(callme, wb));
        let doalign = (wb) => this.alignBoneToSolverResult(wb);

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
        if (this.dirtyShadowSkel)
            this._regenerateShadowSkeleton();
        if (this.dirtyRate)
            this._updateShadowSkelRateInfo(iterations);
        let ds = this.shadowSkel.debugState;
        this.shadowSkel.alignSimAxesToBoneStates();
        if (ds.currentIteration == 0) {
            this.shadowSkel.updateReturnfulnessDamps(iterations);
            
        }
        this.shadowSkel.incrStep();
        callbacks?.__initStep((callme, wb) => this.stepWiseUpdateResult(callme, wb));
        this.shadowSkel.debug_solve(iterations, this.getDefaultStabilizingPassCount(), solveFrom, (wb) => this.alignBoneToSolverResult(wb), callbacks);
        if (ds.completedIteration) {
            if (ds.currentIteration >= iterations) {
                ds.solveCalls++;
                ds.currentIteration = 0;
                console.log('solve#: ' + ds.solveCalls + '\t:: itr :: ' + ds.currentIteration);
            }
        }
    }


    _visible = true;
    get visible() {
        return this._visible;
    }

    /**
     * determines whether or not to display any bone mesh or constraint hints from this EWBIK manager
     * @param {Boolean} val
     */
    set visible(val) {
        this._visible = val; 
        for(let b of this.bones) {
            if(b.bonegeo != null) {
                b.bonegeo.visible = this._visible;
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
    tempLock: false,
    orientation: null,
    IKKickIn: 0,
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
    
    /**
     * allows you specify that someBones on the armature should solve for fewer iterations
     * than others. This can be useful for secondary things on an armature which don't require much accuracy.
     * a value of 0 means the bone will solve for the full number of iterations. A value of 0.75 means it won't kick in 
     * until 3/4ths through the solve.
     * 
     * Be mindful that the effective dampening on the bone will increase by a corresponding amount to compensate for the decrease in iterations.
     * If you don't want this to happen, you will need to manually account for it using the stiffness parameter.
     * @param {Number} kickIn 0-1 defailt 0 (kick in right away).
     */
    setIKKickIn(kickIn) {
        this.IKKickIn = kickIn;
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
     * 
     * Note that negative numbers are also supported, and interpreted naturally to mean
     * multiplication over the dampening parameter. by the formula 1-(stiffness)*dampening. 
     * So, -0.1 = 1.1*dampening, -1 = 2*dampening, -2=3*dampening etc
     * @param {Number} stiffness a value between -infinity and 1
     */

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
     * @return a value between -infinity and 1
     */
    getStiffness() {
        if (this.getIKOrientationLock()) return 1;
        return this.stiffness;
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
        if (this.orientation == null)
            this.orientation = newOrientation
        else if (newOrientation != this.orientation) {
            this.orientation.copy(newOrientation);
        }
        this.orientation.placeholder = false;
        if(this.orientation.trackedBy != null) this.orientation.trackedBy.mimic();
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
    ikSaveNotification(saveList) {
        if(this.getIKBoneOrientation()) 
            saveList.add(this.toIKSaveJSON);
        //TODO: make saving targets less painful. Currently difficult because of UI code.
        //if(this.getIKPin())
        //  this.getIKPin().ikSaveNotification(saveList);
        if(this.getConstraint()) 
            this.getConstraint().ikSaveNotification(saveList);
    },
    toIKSaveJSON() {
        let result = {ikd: this.ikd, type: 'Bone', height: this.height };
        let o = this.orientation;
        result.orientation = {
            position : [o.position.x, o.position.y, o.position.z],
            quaternion: [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w],
            scale : [o.scale.x, o.scale.y, o.scale.z],
            ikd: o.ikd
        }
        result.requires = {};
        let req = result.requires;
        //if(this.getIKPin()) req.pin = this.getIKPin().ikd;
        if(this.getConstraint()) req.constraint = this.getConstraint().ikd;
        return result; 
    },
    async loadIKInfoFromJSON(json, loader, pool, scene) {
        if(this.orientation == null) {
            this.orientation = new Object3D();
            this.add(this.orientation);
        }
        this.orientation.ikd = json.orientation.ikd;
        let jo = json.orientation;
        let q = jo.quaternion; 
        let t = jo.position;
        let s = jo.scale;
        this.orientation.placeholder = false;
        this.orientation.quaternion.set(...q);
        this.orientation.position.set(...t);
        this.scale.set(...s);
        this.height = json.height;
        let p = await Saveable.prepop(json.requires, loader, pool, scene);
        //if(p.pin != null) this.pin = p.pin;
        if(p.constraint != null) {
            this.constraint = p.constraint;
            this.constraint.updateDisplay();
        }
        return this;
    },
    original_add: THREE.Bone.prototype.add,

    add(elem) {
        this.original_add(elem);
        if (elem instanceof THREE.Bone) {
            if (this.parentArmature != null) {
                elem.registerToArmature(this.parentArmature);
                this.parentArmature.recreateBoneList();
                this.parentArmature.regenerateShadowSkeleton(true);
            }
        }
    },

    *childBones() {
        for (let i = 0; i < this.children.length; i++) {
            if (this.children[i] instanceof THREE.Bone)
                yield this.children[i];
        }
    },
    /**like childBones, but returns a list instead of an iterator */
    getChildBoneList() {
        let childbones = []; 
        for(let b of this.childBones()) {
            childbones.push(b);
        }
        return childbones;
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
export {IKPin, Kusudama, LimitCone, Twist, Rest, ShadowNode, Vec3, Vec3Pool, any_Vec3, any_Vec3fv, Rot, IKTransform, IKNode, ShadowSkeleton, Interpolator}




