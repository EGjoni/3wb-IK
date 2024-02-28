import {SkeletonState} from "./solver/SkeletonState.js"
import {ShadowSkeleton} from "./solver/ShadowSkeleton.js"
import { IKTransform } from "./util/IKTransform.js";
import {Vec3} from "./util/vecs.js";
import {Rot} from "./util/Rot.js";
import { IKNode } from "./util/IKNodes.js";
import { Bone } from "three";
import { IKPin } from "./betterbones/IKpin.js";
import { AbstractKusudama } from "./betterbones/Kusudama.js";
import { Object3D } from "../three/three.module.js";
const THREE = await import('three');
//import * as THREE from 'three';
//import { LineSegments, Bone } from "three";


/**
 * This library creates a shadow armature mirroring the approximate structure of the original armature.
 * "Approximate" here means it may not be a one-to-one mapping in terms of the transform hierarchy of 
 * the armature being solved for and the solver's internal representation. 
 * This is primarily to maximize generality across multiple armature formats and conventions.
 * The transforms to be aware of (and which you may need to provide if the library can't infer them are):
 * 
 * 0. ArmatureNode: A transform corresponding to the entire skeleton. Internally, all calculations will be performed as is this transform were the global origin (for numerical stability).
 * 1. BoneFrame : A transform generally directly corresponding to the three.js bone's position/quaternion/scale. This is the only transform type the solver will actually attempt to modify. All other transforms are used to determine how this transform ought to be modified)
 * 2. BoneOrientation : A transform which conceptually indicates (via its y-axis) the direction the bone is poining in and its twist along that direction. This doesn't directly map on to anything three.js explicitly represents, but usually you want the y-axis of this transform to point in the direction of the average positions of all direct children of the bone. 
 * 3. ConstraintFrame : A transform defining the orientation of the kusudama sphere which constrains the valid BoneOrientations. 
 * 4. TwistFrame: A transform defining the "twist" plane of the constraint. The solver is most reliable if the y-axis and z-axis of this transform are aligned with the y and z axis of the BoneOrientation's most comfortable rest pose.
 * 
 * To illustrate how this looks, let's say you have a three.js scene in which a potted plant is riding a train passing by a wooden crate. 
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
 *  |- ConstraintFrame_RootBone (RW !special case)
 *      |- TwistFrame_Root (RW !special case)
 *  |- BoneFrame_RootBone (RW)
 *      |- BoneOrientation_RootBone 
 *      |- ConstraintFrame_StemLower 
 *          |- TwistFrame_StemLower 
 *      |- BoneFrame_StemLower (RW)
 *          |- BoneOrientation_StemLower 
 *          |- ConstraintFrame_StemUpper 
 *              |- TwistFrame_StemUpper 
 *          |- BoneFrame_StemUpper (RW)
 *              |- BoneOrientation_StemUpper 
 *              |- ConstraintFrame_LeftArm 
 *                  |- TwistFrame_LeftArm 
 *              |- BoneFrame_LeftArm (RW)
 *                  |- BoneOrientation_LeftArm 
 *                  |- ConstraintFrame_LeftLeaf 
 *                      |- TwistFrame_LeftLeaf 
 *                  |- BoneFrame_LeftLeaf (RW)
 *                      |- BoneOrientation_LeftLeaf 
 *              |- ConstraintFrame_RightArm 
 *                  |- TwistFrame_RightArm 
 *              |- BoneFrame_RightArm (RW)
 *                  |- BoneOrientation_RightArm 
 *                  |- ConstraintFrame_RightLeaf 
 *                      |- TwistFrame_RightLeaf 
 *                  |- BoneFrame_RightLeaf (RW)
 *                      |- BoneOrientation_RightLeaf 
 *              |- ConstraintFrame_StemNeck 
 *                  |- TwistFrame_StemNeck 
 *              |- BoneFrame_StemNeck (RW)
 *                  |- BoneOrientation_StemNeck 
 *                  |- ConstraintFrame_Head 
 *                      |- TwistFrame_Head 
 *                  |- BoneFrame_Head (RW)
 *                      |- BoneOrientation_Head 
 *              
 *      
 * In the above (RW) indicates transforms which you should read back from after calling the solver in order to get the solved state. None of the other transforms are touched by the solver. Though, there are functions in the library which you can call to automatically generate reasonable or optimized defaults of these transforms for you.
 *     
 */

export class EWBIK {
    
    /** @type {SkeletonState} */
    defaultIterations = 15;
    dampening = 0.02;
    defaultStabilizingPassCount = 0;
    skelState;
    armature = null;
    bones = [];
    skelStateBoneRefs = [];
    bonetags = {};
    boneToStateMap = new Map();
    lastRequestedSolveFromBone = null;
    dirtySkelState = true;
    dirtyRates = true;
    armatureNodeUpdated = false;
    tempNode = new IKNode(); //temporary IKNode object for getting armature relative transform info on change of basis.
    static known_ids = {};


    /**@type {Promise} prevents calling the solver before it's done*/
    activeSolve = null;
    pendingSolve = null;

    /**
     * 
     * @param {Bone} rootBone 
     */
    constructor(rootBone, defaultIterations = this.defaultIterations) {
        this.armatureObj3d = rootBone.parent; 
        this.armatureNode = new IKNode();
        if(this.armatureObj3d != null) {
            this.armatureNode.adoptGlobalValuesFromObject3D(this.armatureObj3d);
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
    }

    getDefaultIterations() {
        return this.defaultIterations;
    }

    makeBoneGeo(height, color = 0x00ff00) {
        const geometry = new THREE.ConeGeometry(0.5, height, 4);
        const material = new THREE.MeshPhongMaterial({color: color});
        const prism = new THREE.Mesh(geometry, material);
        prism.position.y = height/2;
        return prism;
    }

    /**
     * creates and adds to the scene physical manifestations of each bone on this armature
     */
    showBones() {
        for(const bone of this.bones) {
            let orientation = bone.getIKBoneOrientation();
            if(orientation.children.length ==0) {
                let bonegeo = this.makeBoneGeo(bone.height ?? 1, bone.color);
                orientation.add(bonegeo);
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
			if(bone == null) 
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
	 */
    async solve(bone, iterations=this.getDefaultIterations(), stabilizingPasses=this.getDefaultStabilizingPassCount()) {
        this.pendingSolve = async () => await this.__solve(bone, iterations, stabilizingPasses);
        if(this.activeSolve != null ) {
            //console.log("waiting. . .");
            await this.activeSolve;
        }
        //console.log("cleared. . .");
        if(this.pendingSolve != null) {
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
	 * automatically solves the IK system of this armature from the given bone using
	 * the given parameters.
	 * 
	 * @param {Bone} bone optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments). Otherwise, the solver will solve for all segments.
	 * @param {Number} iterations  number of iterations to run. Set this to null or -1 if you want to use the armature's default.
	 * @param stabilizingPasses number of stabilization passes to run. Set this to -2 if you want to use the armature's default. -1 tells it to break constraints if need be, 0 means no stabilization, 1 means a single (very cheap) stabilization pass which may increase grindiness in extreme poses. Greater than 1 reduces grindiness, but at signifcant cost.
	 */
	async __solve(bone, iterations=this.getDefaultIterations(), stabilizingPasses=this.getDefaultStabilizingPassCount()) {
              
		if(this.dirtySkelState) 
			this._regenerateShadowSkeleton();
		if(this.dirtyRate)
			this._updateShadowSkelRateInfo(iterations);			
		//performance.startPerformanceMonitor();
		this.updateskelStateTransforms();
		let forBoneState =  this.getBoneStateFor(bone);
		this.shadowSkel.solve(
				iterations == -1 ? this.getDefaultIterations() : iterations, 
				stabilizingPasses == -2? this.getDefaultStabilizingPassCount : stabilizingPasses, 
				forBoneState,
				(bonestate) => this.alignBoneToSolverResult(bonestate));
        return true;
		//performance.solveFinished(iterations == -1 ? this.IKIterations : iterations);
	}

    /**
	 * read back the solver results from the SkeletonState object. 
	 * The solver only ever modifies the transforms of the bones themselves
	 * so we don't need to bother with constraint or target transforms.
	 */
	alignBonesListToSolverResults() {
		const bonestates = skelState.getBonesArray();
		for(let i=0; i<bonestates.length; i++) {
			this.alignBoneToSolverResult(bonestates[i]);
		}
	}
	
	/**
	 * read back the solver results from the given BoneState to the corresponding AbstractBone. 
	 * The solver only ever modifies things in local space, so we can just markDirty after
	 * manually updating the local transforms and defer global space updates to be triggered by 
	 * whatever else in the pipeline happens to need them.
     * @param {BoneState} bonestate
	 */

	alignBoneToSolverResult(bs) {
		const bsi = bs.getIndex();
		const currBoneAx = this.skelStateBoneRefs[bsi];
		const ts = bs.getFrameTransform();
		currBoneAx.position.set(...ts.translation);//, ts.rotation, ts.scale);
        currBoneAx.quaternion.w = -ts.rotation[0];
        currBoneAx.quaternion.x = ts.rotation[1];
        currBoneAx.quaternion.y = ts.rotation[2];
        currBoneAx.quaternion.z = ts.rotation[3];
		currBoneAx.IKUpdateNotification();
	}

    regenerateShadowSkeleton(force) {
		this.dirtySkelState = true;
		if(force) 
			this._regenerateShadowSkeleton();
		this.dirtyRate = true;
	}

    /**
     * If this bone has no orientation transform, or does have one but the overwrite argument is true, infers an orientation for this bone. 
     * The orientation is inferred to be the smallest rotation which would cause the y-axis of the bone's transformFrame to point toward the average position of its child bones.
     * @param {THREE.Bone} fromBone
     */
    maybeInferOrientation(fromBone, override = false) {
        let orientation = fromBone.getIKBoneOrientation();
        if(orientation.placeholder == true || override) {
            let sumVec = new Vec3([0,0,0]);
            let sumheight = fromBone.height ?? 0;
            let count = 0;            
            for(let cb of fromBone.childBones()) {
                count++;
                let childvec = new Vec3([cb.position.x, cb.position.y, cb.position.z]);
                sumheight += childvec.mag();
                sumVec.add(childvec);
                this.maybeInferOrientation(cb);
            }            
            if(count > 0) {
                let normeddir = sumVec.div(count).normalize();
                
                fromBone.height = sumheight/count;

                
                let rotTo = new Rot(new Vec3([0, 1, 0]), normeddir);
                orientation.quaternion.w = -rotTo.q0;
                orientation.quaternion.x = rotTo.q1;
                orientation.quaternion.y = rotTo.q2;
                orientation.quaternion.z = rotTo.q3;
            }
            fromBone.setIKBoneOrientation(orientation);
        }
        this.regenerateShadowSkeleton();
    }
    

    _regenerateShadowSkeleton() {
        this.armatureNodeUpdated = false;
        this.skelState = new SkeletonState(false);     

        for(let [tag, bone] of Object.entries(this.bonetags)) {
            this.registerBoneWithShadowSkeleton(bone);
        }
        let armatureTransform = this.armatureNode.getGlobalMBasis();
        this.skelState.addTransform(
            this.armatureNode.ikd, 
            armatureTransform.translate.components, 
            [armatureTransform.rotation.q0,armatureTransform.rotation.q1,armatureTransform.rotation.q2,armatureTransform.rotation.q3], 
            [1.0,1.0,1.0], 
            null, this.armatureNode);

        this.skelState.validate();
        
        this.shadowSkel = new ShadowSkeleton(this.skelState, this.dampening);
        this.skelStateBoneRefs = new Array(this.skelState.getBoneCount());
        this.boneToStateMap.clear();
        for(let i=0; i<this.bones.length; i++) {
            let bonestate = this.skelState.getBoneStateById(this.bones[i].ikd);
            if(bonestate != null) {
                this.skelStateBoneRefs[bonestate.getIndex()] = this.bones[i];
                this.boneToStateMap.set(this.bones[i], bonestate);
            }
        }
        this.lastRequestedSolveFromBone = null;
        this.dirtySkelState = false;
        this._updateShadowSkelRateInfo();
        
    }

    recreateBoneList() {
        this.bones = [];
        this.bonetags = {};
        this.addSingleBone(this.rootBone);
        this._recursivelyRegisterDescendantBonesOf(this.rootBone);
    }

    _recursivelyRegisterDescendantBonesOf(ofBone) {        
        for(let child of ofBone.children) {
            this.addSingleBone(child);
            this._recursivelyRegisterDescendantBonesOf(child);
        }
    }

    addSingleBone(bone) {
        if(this.bones.indexOf(bone) == -1)
            this.bones.push(bone);
        this.uniqueInsert(this.bonetags, bone);
    }

    /**
     * only inserts the element into the collection if it isn't already there. 
     * If it is there, changes the ewbik_id internal id of the element to be unique if necessary before inserting
     * @param {*} collection 
     * @param {*} elem 
     */
    uniqueInsert(collection, elem) {
        if(elem.ikd == null) {
            elem.ikd = elem.id+'';
        }
        let i = 0;
        while (i < 10000) { 
            let collectionResult = collection[elem.ikd];
            if(collectionResult == null) {
                collection[elem.ikd] = elem;
                break;
            }
            if(collectionResult == elem) break;
            
            let dashsplit = collectionResult.split("-")
            let num = '1';
            if(dashsplit.length > 1)
                num = dashsplit.pop();
            dashsplit.push((parseInt(num)+1)+'');
            elem.ikd = dashsplit.join('-');
            i++;
        }

    }

    updateShadowSkelRateInfo(force=false, iterations = this.previousIterations) {
		this.dirtyRate = true;
        this.previousIterations = iterations;
        if(force) this._updateShadowSkelRateInfo(iterations);
	}
	
	_updateShadowSkelRateInfo(iterations = this.previousIterations) {      			
		let bonestates = this.skelState.getBoneStatesArray();
		for(let i=0; i<this.skelStateBoneRefs.length; i++) {
			let b = this.skelStateBoneRefs[i];
			let bs = bonestates[i];
			bs.setStiffness(b.getStiffness());
            let targetState = bs.getTarget();
			if(targetState != null) {
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
		let parBoneId = (bone.getParentBone() == null) ? null : bone.getParentBone().ikd; 
		let constraint = bone.getConstraint();
		let constraintId = (constraint == null) ? null : constraint.ikd; 
		let pin = bone.getIKPin();
		let pinId = (pin == null ||pin.isEnabled() == false) ? null : pin.ikd;
		this.skelState.addBone(
				bone.ikd, 
				bone.ikd, 
				parBoneId,
                bone, 
				bone.getStiffness(),
                constraintId,
				pinId, 
				bone.getIKBoneOrientation().ikd);
		this.registerAxesWithShadowSkeleton(bone, bone.getParentBone() == null);
        this.registerAxesWithShadowSkeleton(bone.getIKBoneOrientation(), false);
		if(pinId != null) this.registerTargetWithShadowSkeleton(pin);
		if(constraintId != null) this.registerConstraintWithShadowSkeleton(constraint);
    }

    
    registerTargetWithShadowSkeleton(ikPin) {
        const globalNodeCopy = ikPin.getAxes().attachedCopy().emancipate();
        globalNodeCopy.setRelativeTo(this.armatureNode);

        
		this.skelState.addTarget(ikPin.ikd, 
                globalNodeCopy.ikd, 
				ikPin.forBone.ikd,
				[ikPin.getXPriority(), ikPin.getYPriority(), ikPin.getZPriority()], 
				ikPin.getDepthFalloff(),
				ikPin.getPinWeight());
		this.registerAxesWithShadowSkeleton(globalNodeCopy, false);
	}

    /**
     * 
     * @param {AbstractKusudama} constraint 
     */
    registerConstraintWithShadowSkeleton(constraint) {
		let twistAxes = constraint.twistOrientationAxes() == null ? null : constraint.twistOrientationAxes();
		this.skelState.addConstraint(
				constraint.ikd,
				constraint.attachedTo().ikd,
				constraint.getPainfulness(),
				constraint.swingOrientationAxes().ikd,
				twistAxes == null ? null : twistAxes.ikd,
				constraint);
		registerAxesWithShadowSkeleton(constraint.swingOrientationAxes(), false);
		if(twistAxes != null)
			registerAxesWithShadowSkeleton(twistAxes, false);
		
	}
    
    /**
	 * @param {Object3d} axes
	 * @param {boolean} rebase if true, this function will not provide a parent_id for these axes.
	 * This is mostly useful for ensuring that targetAxes are always implicitly defined in skeleton space when calling the solver.
	 * You should always set this to true when giving the axes of an IKPin, as well as when giving the axes of the root bone. 
	 * see the skelState.addTransform documentation for more info. 
	 */
	registerAxesWithShadowSkeleton(axes, unparent=false) {
		let parent_id  = unparent || (axes.parent == null) ? null : axes.parent.ikd;
		let basis = this.getSkelStateRelativeBasis(axes, unparent);
		let translate = basis.translate;
		let rotation = basis.rotation;
        //if(parent_id == null) parent_id = this.armatureNode.id;
		this.skelState.addTransform(
				axes.ikd, 
				[translate.x, translate.y, translate.z], 
				[rotation.q0, rotation.q1, rotation.q2, rotation.q3], 
				[1.0,1.0,1.0],
				parent_id, axes);
	}

    /**
     * returns an IKTransform of the given IKnode in the space of the armature.
	 * @param {IKNode or Object3D} axes the IKNode to do a change of basis on
	 * @param {boolean} unparent if true, will return a COPY of the basis in Armature space, otherwise, will return a reference to axes.localMBasis
	 * @return
	 */
	getSkelStateRelativeBasis(axes, unparent) {
        if(this.armatureNodeUpdated == false) {
            if(this.armatureObj3d != null) {
                this.armatureNode.adoptGlobalValuesFromObject3D(this.armatureObj3d);
            } else {
                this.armatureNode.toIdentity();
            }
            this.armatureNodeUpdated = true;
        }

        let basis = null;
        let node = axes;
        if(axes instanceof THREE.Object3D) {
            this.tempNode.adoptGlobalValuesFromObject3D(axes);
            this.tempNode.adoptLocalValuesFromObject3D(axes);
		    basis = this.tempNode.getLocalMBasis(); 
            node = this.tempNode;
        } else {
            basis = axes.getLocalMBasis(); 
        }
		if(unparent) {
			let resultBasis = basis.copy();
			this.armatureNode.getGlobalMBasis().setTransformToLocalOf(node.getGlobalMBasis(), resultBasis);
			return resultBasis;
		}
		return basis;
	}

    updateskelStateTransforms() {
		const bonestates = this.skelState.getBoneStatesArray();
		for(let i=0; i<this.skelStateBoneRefs.length; i++) {
			let b = this.skelStateBoneRefs[i];
			let bs = bonestates[i];
			this.updateSkelStateBone(b, bs);
		}
	}

    updateSkelStateBone(b, bs) {
		this.updateSkelStateAxes(b, bs.getFrameTransform(), b.getParentBone() == null);
		if(b.getConstraint() != null) {
			this.updateSkelStateConstraint(b.getConstraint(), bs.getConstraint());
		}
		let ts = bs.getTarget(); 
		if(ts != null) {
			this.updateSkelStateTarget(b.getIKPin(), ts);
		}
	}

    updateSkelStateAxes(a, ts, unparent) {
		let basis = this.getSkelStateRelativeBasis(a, unparent);
		ts.rotation[0]=basis.rotation.q0; 
        ts.rotation[1]=basis.rotation.q1;
        ts.rotation[2]=basis.rotation.q2;
        ts.rotation[3]=basis.rotation.q3;
		ts.translation[0] = basis.translate.x;
        ts.translation[1] = basis.translate.y;
        ts.translation[2] = basis.translate.z;
		if(!a.forceOrthoNormality) {
			ts.scale[0] = basis.getXHeading().mag() * ( basis.isAxisFlipped(IKNode.X) ? -1 : 1);
			ts.scale[1] = basis.getYHeading().mag() * ( basis.isAxisFlipped(IKNode.Y) ? -1 : 1); 
			ts.scale[2] = basis.getZHeading().mag() * ( basis.isAxisFlipped(IKNode.Z) ? -1 : 1);
		} else {
			ts.scale[0] = basis.isAxisFlipped(IKNode.X) ? -1 : 1;
			ts.scale[1] = basis.isAxisFlipped(IKNode.Y) ? -1 : 1; 
			ts.scale[2] = basis.isAxisFlipped(IKNode.Z) ? -1 : 1;
		}
	}
	
    updateSkelStateConstraint(c, cs) {
		let swing = c.swingOrientationAxes();
		this.updateSkelStateAxes(swing, cs.getSwingTransform(), false);
		let twist = c.twistOrientationAxes();
		if(twist != null)
			this.updateSkelStateAxes(twist, cs.getTwistTransform(), false);
	}
    
    updateSkelStateTarget(pin, ts) {
		this.updateSkelStateAxes(pin.getAxes(), ts.getTransform(), true);
	}


    /**convenience for if the user wants to manually update the rate info without trying to determine
     * the appropriate number of iterations to keep all other solver behavior the same
     */
    set previousIterations(itr) {
        this._previousIterations = itr;
    }
    get previousIterations() {
        if(this._previousIterations == null) 
            this._previousIterations = this.defaultIterations;
        return this._previousIterations;
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


//async function betterBones(BoneElem) {

/*if(BoneElem?.isIKType) {
    return;
}*/

// Extend the THREE.Bone prototype with IK methods 
THREE.Bone.prototype.isIKType = true;
THREE.Bone.prototype.stiffness = 0;

/**
 * if set to true, the IK system will not rotate this bone.
 * @param {boolean} lock
 */
THREE.Bone.prototype.setIKOrientationLock = function (lock) {
    this.orientationLock = lock;
    this.parentArmature?.updateShadowSkelRateInfo();
}

THREE.Bone.prototype.getIKOrientationLock = function () {
    return this.orientationLock;
}

THREE.Bone.prototype.setStiffness = function(stiffness) {
    this.stiffness = stiffness;
    this.parentArmature?.updateShadowSkelRateInfo();
};   

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
THREE.Bone.prototype.getStiffness = function() {
    if(this.getIKOrientationLock()) return 1;
    return this.stiffness ?? 0;
}; 

THREE.Bone.prototype.getConstraint = function() {
    /** @type {Constraint} */        
    return this.constraint; 
}

THREE.Bone.prototype.registerToArmature = function(armature) {
    this.parentArmature = armature;
    for(const b of this.childBones()) 
        b.registerToArmature(this.parentArmature);
    this.parentArmature.regenerateShadowSkeleton();
}

/**
 * 
 * @param {AbstractKusudama} constraint
 */
THREE.Bone.prototype.setConstraint = function(constraint) {
    /** @type {Constraint} */
    this.constraint = constraint;
    this.parentArmature?.updateShadowSkelRateInfo();
}

/**
 * define the physical orientation of this bone relative to its object3d reference frame
 * @param {Object3d} orientation 
 */
THREE.Bone.prototype.setIKBoneOrientation = function(orientation) {
    /** @type {IKTransform} */
    if(this.orientation == null)
        this.orientation = orientation
    else {
        orientation.copy(orientation);
    }
    this.orientation.placeholder = false;
}

THREE.Bone.prototype.getIKBoneOrientation = function() {        
    if(this.orientation == null) {
        this.orientation = new THREE.Object3D()
        this.orientation.ikd = this.id+'-orientation';
        this.orientation.placeholder = true;
        this.add(this.orientation);
    }

    /** @type {IKTransform} */
    return this.orientation;
}

/** */
THREE.Bone.prototype.setIKPin = function(pin, disabled = false) {
    let prevPinState =  this.isPinned();
    /** @type {setIKPin} */
    this.pin = pin;
    let newPinState = this.isPinned(); 
    if(prevPinState != newPinState && this.parentArmature != null)
        this.parentArmature.regenerateShadowSkeleton(); 
}

THREE.Bone.prototype.getIKPin = function() {
    return this.pin;
}

THREE.Bone.prototype.isPinned = function() {
    if(this.pin == null || !this.pin.isEnabled()) {
        return false;
    } else {
        return true;
    }
}

THREE.Bone.prototype.original_add = THREE.Bone.prototype.add;

THREE.Bone.prototype.add = function(elem) {
    console.log("added");
    
    if(this.orientation != null && elem instanceof THREE.LineSegments) {
        this.orientation.add(elem);
    } else {
        this.original_add(elem);
        if(elem instanceof THREE.Bone) {
            if(this.parentArmature != null) {
                elem.registerToArmature(this.parentArmature);
                this.parentArmature.addSingleBone(this);
            }
        }
    }
}

THREE.Bone.prototype.childBones = function*() {
    for(let i=0; i<this.children.length; i++) {
        if(this.children[i] instanceof THREE.Bone) 
            yield this.children[i];
    }
}

THREE.Bone.prototype.getParentBone = function() {
    if(this.parent == null || !(this.parent instanceof THREE.Bone)) {
        return null;
    } else {
        return this.parent;
    }
}

THREE.Bone.prototype.IKUpdateNotification = function() {
    //console.log("ik updated");
}


//}

//betterBones();