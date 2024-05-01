import { Ray } from "../util/Ray.js";
import { Rot } from "../util/Rot.js";
import { IKPin } from "../betterbones/IKpin.js";
import { ShadowNode } from "../util/nodes/ShadowNode.js";

export class WorkingBone {
    /**@type {IKPin}*/
    ikPin = null;
    simBoneAxes = null;
    simLocalAxes = null;
    simTipAxes = null;
    simTargetAxes = null;
    cosHalfDampen = 0;
    cosHalfReturnDamp = 0;
    kickInStep = 0;
    returnDamp = 0;
    totalDampening = 0;
    currentHardPain = 0; //pain from violating limiting constraints
    currentSoftPain = 0; //pain from distance from returnful constraints
    lastReturnfulResult = null;
    springy = false;
    parentBone = null;
    forBone = null;
    pool = null;
    modeCode = -1; //the modeCode for this bone's pin if it has one.
    maxModeCode = -1; //the largest modeCode that's been registered on this bone. This is used internally to avoid expensive regenerations of the shadowSkeleton, since it's usually cheaper to just ignore the irrelevant headings
    workingRay = null;
    /** @type {(Limiting | Returnful | LimitingReturnful | ConstraintStack)}*/
    constraint = null;
    myWeights = []; //personal copy of the weights array per this bone;
    hasLimitingConstraint = false;
    cyclicTargets = new Set();
    /*used a convenience to allow specifying that a terminal effector should be weighted differently than the rest of the segment.
    * Taken to its logical extreme every bone in the chain should be allowed to specify its own separate orientation weights, but this would be annoying and unintuitive to specify,
    so this seems like a reasonable middle ground to allow the user to quickly indicate that the very last bone should do its best to match target orientation, while the rest of the chain may do less than its best*/
    isTerminal = false;
    _acceptableRotBy = new Rot(1, 0, 0, 0);
    _comfortableRotBy = new Rot(1, 0, 0, 0);

    constructor(forBone, parentBone, chain) {
        /** @type {BoneState} */
        this.forBone = forBone;
        forBone.wb = this;
        this.pool = chain?.stablePool ?? globalVecPool;
        this.volatilePool = chain?.volatilePool ?? globalVecPool;
        if (this.forBone.trackedBy == null) this.forBone.trackedBy = new ShadowNode(this.forBone, undefined, this.pool);
        if (this.forBone.getIKBoneOrientation().trackedBy == null) new ShadowNode(this.forBone.getIKBoneOrientation(), undefined, this.pool);
        this.workingRay = new Ray(this.volatilePool.new_Vec3(0, 0, 0), this.volatilePool.new_Vec3(0, 0, 0), this.volatilePool);
        /**@type {WorkingBone}*/
        this.parentBone = parentBone;
        /** @type {ConstraintState} */
        this.constraint = this.forBone.getConstraint();
        this.hasLimitingConstraint = this.constraint?.isLimiting();
        /** @type {TransformState} */
        this.simLocalAxes = this.forBone.trackedBy;
        this.simBoneAxes = this.forBone.getIKBoneOrientation().trackedBy;
        /**@type {IKNode} */
        /*this.desiredState = this.simLocalAxes.attachedClone();
        this.desiredBoneOrientation = this.simBoneAxes.freeClone().setRelativeToParent(this.desiredState);
        this.previousState= this.simLocalAxes.attachedClone();
        this.previousBoneOrientation = this.simBoneAxes.freeClone().setRelativeToParent(this.desiredState);*/
        this.chain = chain;
        this.hasPinnedAncestor = this.chain.hasPinnedAncestor;

        /** @type {TransformState} */
        if (forBone.getIKPin()?.isEnabled()) {
            this.ikPin = forBone.getIKPin();
            this.modeCode = this.ikPin.getModeCode();
            this.maxModeCode = this.modeCode;
            this.simTipAxes = this.ikPin.getAffectoredOffset();
            this.simTargetAxes = this.ikPin.targetNode;
            let np = this.simTargetAxes;
            while (np.parent != null) {
                if (np == this) {
                    this.cyclicTargets.add(this.simTargetAxes);
                    break;
                }
                if (np.parent == this.simTargetAxes) {
                    throw new Error("You fucked something up and now a target is its own ancestor???");
                }
                np = np.parent;
            }
        }

        this.updateCosDampening();
    }

    /**reports how much pain its in to its parent bone */
    lament() {
        const par = this.parentBone;
        par.totalReports++;
        par.totalChildPain += this.getOwnPain();
        //par.
    }

    /*mimicDesiredAxes() {
        this.desiredState.adoptLocalValuesFromIKNode(this.simLocalAxes);
        this.desiredBoneOrientation.adoptLocalValuesFromIKNode(this.simLocalAxes);
        this.previousState.adoptLocalValuesFromIKNode(this.simLocalAxes);
        this.previousBoneOrientation.adoptLocalValuesFromIKNode(this.simLocalAxes);
    }*/
    updateCosDampening() {
        this.hasLimitingConstraint = this.constraint?.isLimiting();
        const stiffness = this.forBone.getStiffness();
        const defaultDampening = this.chain.getDampening();
        let stiffdampening = this.forBone.parent == null ? Math.PI : (1 - stiffness) * defaultDampening;
        let clampedKickinRate = 1 - Math.max(Math.min(0.99, this.forBone.IKKickIn), 0);
        this.totalDampening = stiffdampening / clampedKickinRate;
        this.cosHalfDampen = Math.cos(Math.min(this.totalDampening / 2, 2 * Math.PI));
    }

    setAsSegmentRoot() {
        this.isSegmentRoot = true;
    }

    getRootSegment() {
        return this.chain.rootSegment;
    }


    slowUpdateOptimalRotationToPinnedDescendants(stabilizePasses, translate, skipConstraint) {
        //if(window.perfing) performance.mark("slowUpdateOptimalRotationToPinnedDescendants start");
        if (this.cosHalfDampen == 1) {
            if (this.chain.wb_segmentRoot == this)
                this.chain.previousDeviation = Infinity;
        }
        //this.updateDescendantsPain();
        this.updateTargetHeadings(this.chain.boneCenteredTargetHeadings, this.myWeights, this.painWeights);
        //const prevOrientation = Rot.fromRot(this.simLocalAxes.localMBasis.rotation);
        let gotCloser = true;
        for (let i = 0; i <= stabilizePasses; i++) {
            this.updateTipHeadings(this.chain.boneCenteredTipHeadings, !translate);
            this.updateOptimalRotationToPinnedDescendants(translate, skipConstraint, this.chain.boneCenteredTipHeadings, this.chain.boneCenteredTargetHeadings, this.painWeights);
            if (stabilizePasses > 0) {
                this.updateTipHeadings(this.chain.uniform_boneCenteredTipHeadings, !translate);
                const currentmsd = this.chain.getManualMSD(this.chain.uniform_boneCenteredTipHeadings, this.chain.boneCenteredTargetHeadings, this.painWeights);
                if (currentmsd <= this.chain.previousDeviation * 1.000001) {
                    this.chain.previousDeviation = currentmsd;
                    gotCloser = true;
                    break;
                } else gotCloser = false;
            }
        }
        if (!gotCloser) {
            this.simLocalAxes.setLocalOrientationTo(prevOrientation);
        }

        //We've finished with this chain for this iteration, so next time we try to get deviation we start fresh
        if (this.chain.wb_segmentRoot == this)
            this.chain.previousDeviation = Infinity;

        //if(window.perfing) performance.mark("slowUpdateOptimalRotationToPinnedDescendants end");
        //if(window.perfing) performance.measure("slowUpdateOptimalRotationToPinnedDescendants", "slowUpdateOptimalRotationToPinnedDescendants start", "slowUpdateOptimalRotationToPinnedDescendants end");   
    }


    fastUpdateOptimalRotationToPinnedDescendants(translate, skipConstraints, currentIteration) {
        if (currentIteration < this.kickInStep) return;

        //if(window.perfing) performance.mark("fastUpdateOptimalRotationToPinnedDescendants start");
        this.updateDescendantsPain();

        this.updateTargetHeadings(this.chain.boneCenteredTargetHeadings, this.myWeights, this.painWeights, !translate);
        this.updateTipHeadings(this.chain.boneCenteredTipHeadings, !translate);
        this.maybeRecordHeadings(this.chain.boneCenteredTargetHeadings, this.chain.boneCenteredTipHeadings, currentIteration, 0);
        this.updateOptimalRotationToPinnedDescendants(translate, skipConstraints, this.chain.boneCenteredTipHeadings, this.chain.boneCenteredTargetHeadings, this.painWeights);

        if (this.forBone.parentArmature.recordHeadings) {
            this.updateTargetHeadings(this.chain.boneCenteredTargetHeadings, this.myWeights, this.painWeights, !translate);
            this.updateTipHeadings(this.chain.boneCenteredTipHeadings, !translate);
            this.maybeRecordHeadings(this.chain.boneCenteredTargetHeadings, this.chain.boneCenteredTipHeadings, currentIteration, 1);
        }
        //this.simLocalAxes.markDirty();
        //if(window.perfing) performance.mark("fastUpdateOptimalRotationToPinnedDescendants end");
        //if(window.perfing) performance.measure("fastUpdateOptimalRotationToPinnedDescendants", "fastUpdateOptimalRotationToPinnedDescendants start", "fastUpdateOptimalRotationToPinnedDescendants end");   
    }

    /**returns the rotation that was applied (in local space), but does indeed apply it*/
    updateOptimalRotationToPinnedDescendants(translate, skipConstraints, localizedTipHeadings, localizedTargetHeadings, weights) {
        ////if(window.perfing) performance.mark("updateOptimalRotationToPinnedDescendants start");
        let desiredRotation = this.chain.qcpConverger.weightedSuperpose(localizedTipHeadings, localizedTargetHeadings, weights, translate);
        const translateBy = this.chain.qcpConverger.getTranslation();
        const boneDamp = this.cosHalfDampen;
        if (!translate) {
            desiredRotation.clampToCosHalfAngle(boneDamp);
        }
        let localDesiredRotby = this.simLocalAxes.getParentAxes().getGlobalMBasis().getLocalOfRotation(desiredRotation, this.chain.tempRot);
        //let reglobalizedRot = desiredRotation;
        if (this.hasLimitingConstraint && !skipConstraints) {
            let rotBy = this.constraint.getAcceptableRotation(this.simLocalAxes, this.simBoneAxes, localDesiredRotby, this._acceptableRotBy);
            /*this.currentHardPain = 1;
            if(Rot.distance(rotBy, localDesiredRotby) > 1e-6) {
                this.currentHardPain = 1; //violating a hard constraint should be maximally painful.
            }*/
            //reglobalizedRot = this.simLocalAxes.parent.globalMBasis.rotation.applyAfter(localDesiredRotby, this.chain.tempRot);
            this.simLocalAxes.rotateByLocal(rotBy);
        } else {
            if (translate) {
                this.simLocalAxes.translateByGlobal(translateBy);
            }
            this.simLocalAxes.rotateByLocal(localDesiredRotby);
        }
        /*if(!translate) {
            this.chain.hasFastPass = true;
            this.post_UpdateTargetHeadings(localizedTargetHeadings, weights, reglobalizedRot);
            this.post_UpdateTipHeadings(localizedTipHeadings, true, reglobalizedRot);
        } else {
            this.chain.hasFastPass = false;
        }*/ //if(window.perfing) performance.mark("updateOptimalRotationToPinnedDescendants end");
        //if(window.perfing) performance.measure("updateOptimalRotationToPinnedDescendants", "updateOptimalRotationToPinnedDescendants start", "updateOptimalRotationToPinnedDescendants end");   */
        //this.endYHeading = this.simBoneAxes.getGlobalMBasis().getYHeading().clone();
        //if(this.forBone.ikd == 'b1' && this.currentHardPain > 0) console.log(this.endYHeading.dist(this.startYHeading))
        return localDesiredRotby;
    }

    /**sets an array specifying the number of descendants to reach each pin.
     * this is as an iteration count independent part of the painfulness scheme
     * where each bone weighs targets more heavily based on the amount of pain their descendants report toward that target.
    */
    setPerPinDescendantCounts(pinnedBones) {
        //if(window.perfing) performance.mark("setPerPinDescendantCounts start");
        this.descendantCounts = new Array(pinnedBones.length);
        this.descendantAveragePain = new Array(pinnedBones.length);
        this.childPathToPin = new Array(pinnedBones.length);
        this.indexOnDescendant = new Array(pinnedBones.length);
        for (let i = 0; i < pinnedBones.length; i++) {
            let count = 1;
            let currentBone = pinnedBones[i];
            while (currentBone != this) {
                count++;
                if (currentBone.parentBone == this) {
                    this.childPathToPin[i] = currentBone;
                }
                this.indexOnDescendant[i] = currentBone.chain.pinnedBones.indexOf(pinnedBones[i]);
                currentBone = currentBone.parentBone;
            }
            this.descendantCounts[i] = count;
            this.descendantAveragePain[i] = 0;
            //if(window.perfing) performance.mark("setPerPinDescendantCounts end");
            //if(window.perfing) performance.measure("setPerPinDescendantCounts", "setPerPinDescendantCounts start", "setPerPinDescendantCounts end");   
        }
    }
    updateTargetHeadings(localizedTargetHeadings, baseWeights, outWeights, scale) {
        //if(window.perfing) performance.mark("updateTargetHeadings start");
        let hdx = 0;
        const workingRay = this.workingRay;
        let origin = this.simLocalAxes.origin(); //null
        for (let i = 0; i < this.chain.pinnedBones.length; i++) {
            const sb = this.chain.pinnedBones[i];
            const targetAxes = sb.simTargetAxes;
            /*if(sb != this && sb.chain.hasFastPass && this.simLocalAxes.dirty == false) {
                origin = this.simLocalAxes.globalMBasis.translate;
                hdx += this.fast_updateTargetHeadings(localizedTargetHeadings, baseWeights, weights, hdx, sb, i, origin);
                continue;
            }
            if(origin == null) origin = this.simLocalAxes.origin();
            sb.chain.hasFastPass = false;*/
            const tipOrigin = sb.simTipAxes.origin();
            targetAxes.updateGlobal();
            localizedTargetHeadings[hdx].set(targetAxes.origin()).sub(origin);
            const localizedOrig = localizedTargetHeadings[hdx];
            let painScalar = 1; //(1+this.descendantAveragePain[i]);
            outWeights[hdx] = painScalar * baseWeights[hdx];
            const modeCode = sb.ikPin.modeCode;
            hdx++;
            let scaleBy = scale ? 1 + origin.dist(tipOrigin) : 1;
            if (modeCode & IKPin.XDir) {
                outWeights[hdx] = painScalar * baseWeights[hdx];
                outWeights[hdx + 1] = painScalar * baseWeights[hdx + 1];
                targetAxes.setToOrthon_XHeading(localizedTargetHeadings[hdx]); //.mult(outWeights[hdx]).mult(scaleBy);
                localizedTargetHeadings[hdx + 1].set(localizedTargetHeadings[hdx]).mult(-1).add(localizedOrig);
                localizedTargetHeadings[hdx].add(localizedOrig);
                hdx += 2;
            }
            if (modeCode & IKPin.YDir) {
                outWeights[hdx] = painScalar * baseWeights[hdx];
                outWeights[hdx + 1] = painScalar * baseWeights[hdx + 1];
                targetAxes.setToOrthon_YHeading(localizedTargetHeadings[hdx]); //.mult(outWeights[hdx]).mult(scaleBy);
                localizedTargetHeadings[hdx + 1].set(localizedTargetHeadings[hdx]).mult(-1).add(localizedOrig);
                localizedTargetHeadings[hdx].add(localizedOrig);
                hdx += 2;
            }
            if (modeCode & IKPin.ZDir) {
                outWeights[hdx] = painScalar * baseWeights[hdx];
                outWeights[hdx + 1] = painScalar * baseWeights[hdx + 1];
                targetAxes.setToOrthon_ZHeading(localizedTargetHeadings[hdx]); //.mult(outWeights[hdx]).mult(scaleBy);
                localizedTargetHeadings[hdx + 1].set(localizedTargetHeadings[hdx]).mult(-1).add(localizedOrig);
                localizedTargetHeadings[hdx].add(localizedOrig);
                hdx += 2;
            }
        }
        //if(window.perfing) performance.mark("updateTargetHeadings end");
        //if(window.perfing) performance.measure("updateTargetHeadings", "updateTargetHeadings start", "updateTargetHeadings end");    
    }

    updateTipHeadings(localizedTipHeadings, scale) {
        //if(window.perfing) performance.mark("updateTipHeadings start");
        let hdx = 0;
        const myOrigin = this.simLocalAxes.origin();
        const workingRay = this.workingRay;
        for (let i = 0; i < this.chain.pinnedBones.length; i++) {
            const sb = this.chain.pinnedBones[i];
            /*if(sb != this && sb.chain.hasFastPass && this.simLocalAxes.dirty == false) {
                hdx += this.fast_updateTipHeadings(localizedTipHeadings, scale, hdx, sb, myOrigin);
                continue;
            }
            sb.chain.hasFastPass = false;*/
            const tipAxes = sb.simTipAxes;
            tipAxes.updateGlobal();
            const tipOrigin = tipAxes.origin();
            const target = sb.ikPin;
            const modeCode = target.modeCode;

            const targetAxes = sb.simTargetAxes;
            targetAxes.updateGlobal();

            localizedTipHeadings[hdx].set(tipOrigin).sub(myOrigin);
            const localizedOrig = localizedTipHeadings[hdx];
            let scaleBy = scale ? 1 + myOrigin.dist(tipOrigin) : 1;
            hdx++;

            if ((modeCode & IKPin.XDir) != 0) {
                tipAxes.setToOrthon_XHeading(localizedTipHeadings[hdx]); //.mult(scaleBy);
                localizedTipHeadings[hdx + 1].set(localizedTipHeadings[hdx]).mult(-1).add(localizedOrig);
                localizedTipHeadings[hdx].add(localizedOrig);
                hdx += 2;
            }
            if ((modeCode & IKPin.YDir) != 0) {
                tipAxes.setToOrthon_YHeading(localizedTipHeadings[hdx]); //.mult(scaleBy);
                localizedTipHeadings[hdx + 1].set(localizedTipHeadings[hdx]).mult(-1).add(localizedOrig);
                localizedTipHeadings[hdx].add(localizedOrig);
                hdx += 2;
            }
            if ((modeCode & IKPin.ZDir) != 0) {
                tipAxes.setToOrthon_ZHeading(localizedTipHeadings[hdx]); //.mult(scaleBy);
                localizedTipHeadings[hdx + 1].set(localizedTipHeadings[hdx]).mult(-1).add(localizedOrig);
                localizedTipHeadings[hdx].add(localizedOrig);
                hdx += 2;
            }
        }
        //if(window.perfing) performance.mark("updateTipHeadings end");
        //if(window.perfing) performance.measure("updateTipHeadings", "updateTipHeadings start", "updateTipHeadings end");   
    }

    
    /**@return the amount of pain this bone itself is experiencing */
    getOwnPain() {
        this.currentSoftPain = this.lastReturnfulResult?.preCallDiscomfort;
        this.currentSoftPain = isNaN(this.currentSoftPain) ? 0 : this.currentSoftPain;
        return Math.max(this.currentHardPain, this.currentSoftPain);
    }

    /**@return the average amount of pain this bone and all descendants attempting to reach this pin are experiencing**/
    getDescendantPain(pinIndex) {
        return this.descendantAveragePain[pinIndex];
    }

    updatePain(iteration) {
        if (this.springy) {
            this.constraint.markDirty();
            const res = this.constraint.getClampedPreferenceRotation(this.simLocalAxes, this.simBoneAxes, iteration, this);
            this.chain.previousDeviation = Infinity;
            this.lastReturnfulResult = res;
        }
    }

    pullBackTowardAllowableRegion(iteration, callbacks) {
        //if(window.perfing) performance.mark("pullBackTowardAllowableRegion start");
        if (this.springy && iteration >= this.kickInStep) {
            this.constraint.markDirty();
            //callbacks?.beforePullback(this.forBone.directRef, this.forBone.getFrameTransform(), this);
            const res = this.constraint.getClampedPreferenceRotation(this.simLocalAxes, this.simBoneAxes, iteration - this.kickInStep, this);
            this.chain.previousDeviation = Infinity;
            this.lastReturnfulResult = res;
            this.simLocalAxes.rotateByLocal(res.clampedRotation);
            //callbacks?.afterPullback(this.forBone.directRef, this.forBone.getFrameTransform(), this);
        }
        //if(window.perfing) performance.mark("pullBackTowardAllowableRegion end");
        //if(window.perfing) performance.measure("pullBackTowardAllowableRegion", "pullBackTowardAllowableRegion start", "pullBackTowardAllowableRegion end"); 
    }


    updateReturnfullnessDamp(iterations) {
        //if(window.perfing) performance.mark("updateReturnfullnessDamp start");
        this.kickInStep = parseInt(iterations * (this.forBone.IKKickIn));
        this.kickInStep = Math.max(0, Math.min(iterations - 1, this.kickInStep));
        if (this.maybeSpringy()) {
            this.constraint.setPreferenceLeeway(this.totalDampening);
            this.constraint.setPerIterationLeewayCache((iterations - 1) - this.kickInStep);
            /**
             * determine maximum pullback that would still allow the solver to converge if applied once per pass
             */
            if (this.constraint.giveup >= 1) {
                this.springy = true;
            }
        }
        //if(window.perfing) performance.mark("updateReturnfullnessDamp end");
        //if(window.perfing) performance.measure("updateReturnfullnessDamp", "updateReturnfullnessDamp start", "updateReturnfullnessDamp end"); 
    }


    maybeSpringy() {
        this.hasLimitingConstraint = this.constraint?.isLimiting();
        return (this.constraint?.isReturnful());
    }

    applyRotToVecArray(rot, vecArr, storeIn = []) {
        for (let i = 0; i < vecArr.length; i++) {
            storeIn[i] = rot.applyToVec(vecArr[i], vecArr[i]);
        }
        return storeIn;
    }

    toConsole(showCurrentHeadings) {
        console.groupCollapsed('current state');


        console.groupCollapsed('targets');
        for (let p of this.chain.pinnedBones) {
            p.simTargetAxes.toConsole();
        }
        console.groupEnd('targets');
        console.groupCollapsed('tips');
        for (let p of this.chain.pinnedBones) {
            p.simTipAxes.toConsole();
        }
        console.groupEnd('tips');

        console.groupCollapsed('simLocal');
        this.simLocalAxes.toConsole();
        console.groupEnd('simLocal');

        console.groupCollapsed('simBone');
        this.simBoneAxes.toConsole();
        console.groupEnd('simBone');

        console.groupCollapsed('my weights');
        console.log(this.myWeights);
        console.groupEnd('my weights');
        console.groupEnd('current state');
        if (this.forBone.parentArmature.recordHeadings) {
            console.groupCollapsed('historical');
            let solvesRecorded = this.forBone.parentArmature.recordSteps;
            let solveIdx = (this.chain.shadowSkel.debugState.solveCalls - solvesRecorded) % solvesRecorded;
            for (let s = 0; s < solvesRecorded; s++) {
                let frameidx = (s + solveIdx) % solvesRecorded;
                console.groupCollapsed('frame ' + s + ' (idx: ' + frameidx + '), (' + (this.chain.shadowSkel.debugState.solveCalls - (solvesRecorded + s)) + ')');
                let strg = this.rec_TargetHeadings[frameidx];
                for (let i = 0; i < strg.length; i++) {
                    console.groupCollapsed(i + 'iteration');
                    let steps = strg[i];
                    for (let subidx = 0; subidx < steps.length; subidx++) {
                        console.groupCollapsed(subidx + ' substep');
                        let targHeads = this.rec_TargetHeadings[s][i][subidx];
                        let tipHeads = this.rec_TargetHeadings[s][i][subidx];
                        console.groupCollapsed(`target headings`);
                        for (let v of targHeads) v.toConsole();
                        console.groupEnd('target headings');
                        console.groupCollapsed('tip headings');
                        for (let v of tipHeads) v.toConsole();
                        console.groupEnd('tip headings');

                        console.groupEnd(subidx + ' substep');
                    }
                    console.groupEnd(i + 'iteration');
                }
                console.groupEnd('frame ' + s + ' (idx: ' + frameidx + '), (' + (this.chain.shadowSkel.debugState.solveCalls - (solvesRecorded + s)) + ')');
            }

            console.groupEnd('historical');
        }
    }

    //debug function
    applyCompare(rot, arr1, arr2) {
        console.log("pre-rotation");
        this.compareAngDist(arr1, arr2);
        let clr = this.applyRotToVecArray(rot, arr1);
        this.compareAngDist(clr, arr2);
        console.log("post-rotation");
    }

    compareAngDist(vecArr1, vecArr2) {
        for (let i = 0; i < vecArr1.length; i++) {
            Rot.fromVecs(vecArr1[i], vecArr2[i]).toConsole();
        }
    }

    /**for debugging */
    maybeRecordHeadings(targetHeadings, tipHeadings, iteration, subStep) {
        if (this.forBone.parentArmature.recordHeadings) {
            let recorderPool = this.forBone.parentArmature.recorderPool;
            let revolvingIdx = this.chain.shadowSkel.debugState.solveCalls % this.forBone.parentArmature.recordSteps;

            if (this.rec_TargetHeadings == null) this.rec_TargetHeadings = [];
            while (this.rec_TargetHeadings.length <= revolvingIdx) this.rec_TargetHeadings.push([]);
            let solvecall_targetHeadings = this.rec_TargetHeadings[revolvingIdx];
            while (solvecall_targetHeadings.length <= iteration) solvecall_targetHeadings.push([]);
            let itrTargs = solvecall_targetHeadings[iteration];
            while (itrTargs.length <= subStep) itrTargs.push([]);
            let rec_targs = itrTargs[subStep];
            for (let i = 0; i < targetHeadings.length; i++) {
                if (rec_targs[i] == null) rec_targs[i] = recorderPool.new_Vec3();
                rec_targs[i].set(targetHeadings[i]);
            }

            if (this.rec_TipHeadings == null) this.rec_TipHeadings = [];
            while (this.rec_TipHeadings.length <= revolvingIdx) this.rec_TipHeadings.push([]);
            let solvecall_tipHeadings = this.rec_TipHeadings[revolvingIdx];
            while (solvecall_tipHeadings.length <= iteration) solvecall_tipHeadings.push([]);
            let itrTips = solvecall_tipHeadings[iteration];
            while (itrTips.length <= subStep) itrTips.push([]);
            let rec_tips = itrTips[subStep];
            for (let i = 0; i < tipHeadings.length; i++) {
                if (rec_tips[i] == null) rec_tips[i] = recorderPool.new_Vec3();
                rec_tips[i].set(tipHeadings[i]);
            }
        }
    }

    updateDescendantsPain() {
        //if(window.perfing) performance.mark("updateDescendantsPain start");
        //let ownPain = this.getOwnPain();
        /*let distrOwnPain = ownPain / this.descendantCounts.length;
        this.justDescendantPainTotal = 0;
        this.totalDescendants = 0;
        this.justDescendantsAverage = 0;
        this.justDescendantsDeviation = 0;
        
        if(this.childPathToPin.length == 1) {
            let childToPin = this.childPathToPin[0];
            if(childToPin == undefined) { //leaf node
                this.descendantAveragePain[0] = ownPain;
            }else {
                for(let i =0; i < this.descendantCounts.length; i++) {
                    let descToPin = this.descendantCounts[i];
                    let avgDescendantPain = childToPin.descendantAveragePain[i];
                    let segdescendantTotal = ((descToPin-1)*avgDescendantPain);
                    avgDescendantPain = (segdescendantTotal + distrOwnPain)/descToPin;
                    this.totalDescendants += descToPin;
                    this.justDescendantPainTotal += segdescendantTotal;
                    this.descendantAveragePain[i] = avgDescendantPain;
                }
            }
        }
        else if (this.childPathToPin.length > 1) {
            for(let i =0; i < this.descendantCounts.length; i++) {
                let descToPin = this.descendantCounts[i];
                let indexOfPinInDescendant = this.indexOnDescendant[i]
                let avgDescendantPain = this.childPathToPin[i].getDescendantPain(indexOfPinInDescendant);
                let segdescendantTotal = ((descToPin-1)*avgDescendantPain);
                avgDescendantPain = (segdescendantTotal + distrOwnPain)/descToPin;
                this.totalDescendants += descToPin;
                this.justDescendantPainTotal += segdescendantTotal;
                this.descendantAveragePain[i] = avgDescendantPain;
            }
        } else if(this.descendantCounts.length >= 1) {
            console.log("what")
        }
        this.descendantPainTotal = this.avgDescendantPain*this.descToPin*/
        //if(window.perfing) performance.mark("updateDescendantsPain end");
        //if(window.perfing) performance.measure("updateDescendantsPain", "updateDescendantsPain start", "updateDescendantsPain end");   
    }
}









/**
 * 
 * 
 * fast_updateTargetHeadings(localizedTargetHeadings, baseWeights, weights, hdxStart, sb, i, myOrigin) {
        //if(window.perfing) performance.mark("fast_updateTargetHeadings start");
        const modeCode = sb.ikPin.getModeCode();
        const targetOrigin = localizedTargetHeadings[hdxStart];
        let updated = 0;
        let hdx = hdxStart;
        const tipOrigin = myOrigin;
        let painScalar = (1+this.descendantAveragePain[i]);
        let combinedOffset = this.pool.any_Vec3(targetOrigin.x - myOrigin.x, targetOrigin.y -myOrigin.y, targetOrigin.z - myOrigin.z);
        weights[hdx] = painScalar * baseWeights[hdx];
            
        hdx++; updated++;

        if ((modeCode & IKPin.XDir) != 0) {
            //weights[hdx] = painScalar*baseWeights[hdx];
            //weights[hdx+1] = painScalar*baseWeights[hdx+1];
            localizedTargetHeadings[hdx].sub(targetOrigin).mult(1/weights[hdx]).add(combinedOffset);
            localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(1/weights[hdx+1]).add(combinedOffset);   //set(xTip.p2).sub(myOrigin);
            hdx += 2;
            updated+=2;
        }
        if ((modeCode & IKPin.YDir) != 0) {
            //weights[hdx] = painScalar*baseWeights[hdx];
            //weights[hdx+1] = painScalar*baseWeights[hdx+1];
            localizedTargetHeadings[hdx].sub(targetOrigin).mult(1/weights[hdx]).add(combinedOffset); ;
            localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(1/weights[hdx+1]).add(combinedOffset); ;
            hdx += 2;
            updated+=2;
        }
        if ((modeCode & IKPin.ZDir) != 0) {
            //weights[hdx] = painScalar*baseWeights[hdx];
            //weights[hdx+1] = painScalar*baseWeights[hdx+1];
            localizedTargetHeadings[hdx].sub(targetOrigin).mult(1/weights[hdx]).add(combinedOffset); ;
            localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(1/weights[hdx+1]).add(combinedOffset); ;
            hdx += 2;
            updated+=2;
        }

        localizedTargetHeadings[hdxStart].set(combinedOffset);
        //if(window.perfing) performance.mark("fast_updateTargetHeadings end");
        //if(window.perfing) performance.measure("fast_updateTargetHeadings", "fast_updateTargetHeadings start", "fast_updateTargetHeadings end");
            
        return updated;
    }

    fast_updateTipHeadings(localizedTipHeadings, scale, hdxStart, sb, myOrigin) {
        //if(window.perfing) performance.mark("fast_updateTipHeadings start");
        const modeCode = sb.ikPin.getModeCode();
        let updated = 0;
        let hdx = hdxStart;
        const tipOrigin = localizedTipHeadings[hdx];
        let scaleBy = scale ? 1+myOrigin.dist(tipOrigin) : 1;
        let combinedOffset = this.pool.any_Vec3(tipOrigin.x - myOrigin.x, tipOrigin.y -myOrigin.y, tipOrigin.z - myOrigin.z);
        hdx++; updated++;

        if ((modeCode & IKPin.XDir) != 0) {
            localizedTipHeadings[hdx].sub(tipOrigin).mult(scaleBy).add(combinedOffset);
            localizedTipHeadings[hdx+1].sub(tipOrigin).mult(scaleBy).add(combinedOffset);  
            hdx += 2;
            updated+=2;
        }
        if ((modeCode & IKPin.YDir) != 0) {
            localizedTipHeadings[hdx].sub(tipOrigin).mult(scaleBy).add(combinedOffset); ;
            localizedTipHeadings[hdx+1].sub(tipOrigin).mult(scaleBy).add(combinedOffset); ;
            hdx += 2;
            updated+=2;
        }
        if ((modeCode & IKPin.ZDir) != 0) {
            localizedTipHeadings[hdx].sub(tipOrigin).mult(scaleBy).add(combinedOffset); ;
            localizedTipHeadings[hdx+1].sub(tipOrigin).mult(scaleBy).add(combinedOffset); ;
            hdx += 2;
            updated+=2;
        }
        localizedTipHeadings[hdxStart].set(combinedOffset);

        //if(window.perfing) performance.mark("fast_updateTipHeadings end");
        //if(window.perfing) performance.measure("fast_updateTipHeadings", "fast_updateTipHeadings start", "fast_updateTipHeadings end");   
        return updated;
    }

 * 
    /**Updates the tip headings to match the rotation all of the multiplications to prepare them for any ancestor of this bone,
     * also undoes any scaling or translation it applied to the headings prior to solving. 
     * This concept only works if bases are orthornormal, and it shouldn't be used by tips themselves. but the speedups are significant when you can
     * get away with it.*/

    /**
    post_UpdateTipHeadings(localizedTipHeadings, scale, applyRot) {
        //if(window.perfing) performance.mark("post_updateTipHeadings start");
        let hdx = 0;
        if(this.ikPin != null) this.simBoneAxes.updateGlobal();
        const myOrigin = this.simLocalAxes.globalMBasis.translate;
        this.applyRotToVecArray(applyRot, localizedTipHeadings, localizedTipHeadings);
        for (let i = 0; i < this.chain.pinnedBones.length; i++) {
            const sb = this.chain.pinnedBones[i];
            const tipOrigin = localizedTipHeadings[hdx];        
            const target = sb.ikPin;
            const modeCode = target.getModeCode();
            const combinedOffset = this.pool.any_Vec3(tipOrigin.x +myOrigin.x, tipOrigin.y +myOrigin.y, tipOrigin.z + myOrigin.z);
            
            let origidx = hdx;
            let unscaleBy = scale ? 1/(1+combinedOffset.mag()) : 1;                       
            hdx++;

            if ((modeCode & IKPin.XDir) != 0) {
                localizedTipHeadings[hdx].sub(tipOrigin).mult(unscaleBy).add(combinedOffset);
                localizedTipHeadings[hdx+1].sub(tipOrigin).mult(unscaleBy).add(combinedOffset);   //set(xTip.p2).sub(myOrigin);
                hdx += 2;
            }
            if ((modeCode & IKPin.YDir) != 0) {
                localizedTipHeadings[hdx].sub(tipOrigin).mult(unscaleBy).add(combinedOffset); ;
                localizedTipHeadings[hdx+1].sub(tipOrigin).mult(unscaleBy).add(combinedOffset); ;
                hdx += 2;
            }
            if ((modeCode & IKPin.ZDir) != 0) {
                localizedTipHeadings[hdx].sub(tipOrigin).mult(unscaleBy).add(combinedOffset); ;
                localizedTipHeadings[hdx+1].sub(tipOrigin).mult(unscaleBy).add(combinedOffset); ;
                hdx += 2;
            }
            localizedTipHeadings[origidx].add(myOrigin);
            sb.chain.hasFastPass = true; 
        }
        this.chain.hasFastPass = true;
        //if(window.perfing) performance.mark("post_updateTipHeadings end");
        //if(window.perfing) performance.measure("post_updateTipHeadings", "post_updateTipHeadings start", "post_updateTipHeadings end");   
    }

    post_UpdateTargetHeadings(localizedTargetHeadings, weights, applyRot) {
        //if(window.perfing) performance.mark("post_UpdateTargetHeadings start");
        let hdx = 0;
        if(this.ikPin != null) this.simBoneAxes.updateGlobal();
        const workingRay = this.workingRay;
        const myOrigin = this.simLocalAxes.globalMBasis.translate;
        const {XDir, YDir, ZDir} = IKPin;
        for (let i = 0; i < this.chain.pinnedBones.length; i++) {
            const sb = this.chain.pinnedBones[i];            
            let doApplyRot = false;
            let orighdx = hdx;
            if(this.cyclicTargets.has(sb.targetAxes)) { 
                // if the target is a child of the axes we're rotating, we'll need to account for the fact that we're chasing our own tail
                doApplyRot = true;
                applyRot.applyToVec(localizedTargetHeadings[hdx], localizedTargetHeadings[hdx]);
            }
            const targetOrigin =  localizedTargetHeadings[hdx];
            const combinedOffset = this.pool.any_Vec3(targetOrigin.x +myOrigin.x, targetOrigin.y +myOrigin.y, targetOrigin.z + myOrigin.z);
            let painScalar = (1+this.descendantAveragePain[i]);
            const modeCode = sb.ikPin.getModeCode();
            hdx++;
            if (modeCode & XDir) {
                let invPain = 1/(painScalar*weights[hdx]);
                if(doApplyRot) {
                    applyRot.applyToVec(localizedTargetHeadings[hdx], localizedTargetHeadings[hdx]);
                    applyRot.applyToVec(localizedTargetHeadings[hdx+1], localizedTargetHeadings[hdx+1]);
                }
                localizedTargetHeadings[hdx].sub(targetOrigin).mult(invPain).add(combinedOffset);
                localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(invPain).add(combinedOffset);  
                hdx += 2;
            }
            if (modeCode & YDir) {
                let invPain = 1/(painScalar*weights[hdx]);
                if(doApplyRot) {
                    applyRot.applyToVec(localizedTargetHeadings[hdx], localizedTargetHeadings[hdx]);
                    applyRot.applyToVec(localizedTargetHeadings[hdx+1], localizedTargetHeadings[hdx+1]);
                }                
                localizedTargetHeadings[hdx].sub(targetOrigin).mult(invPain).add(combinedOffset);
                localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(invPain).add(combinedOffset);                
                hdx += 2;
            }
            if (modeCode & ZDir) {
                let invPain = 1/(painScalar*weights[hdx]);
                if(doApplyRot) {
                    applyRot.applyToVec(localizedTargetHeadings[hdx], localizedTargetHeadings[hdx]);
                    applyRot.applyToVec(localizedTargetHeadings[hdx+1], localizedTargetHeadings[hdx+1]);
                }
                localizedTargetHeadings[hdx].sub(targetOrigin).mult(invPain).add(combinedOffset);
                localizedTargetHeadings[hdx+1].sub(targetOrigin).mult(invPain).add(combinedOffset);     
                hdx += 2;
            }
            localizedTargetHeadings[orighdx].add(myOrigin);
            sb.chain.hasFastPass = true;
        }
        //if(window.perfing) performance.mark("post_UpdateTargetHeadings end");
        //if(window.perfing) performance.measure("post_UpdateTargetHeadings", "post_UpdateTargetHeadings start", "post_UpdateTargetHeadings end");   
    }

 */