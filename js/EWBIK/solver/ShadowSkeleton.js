import { IKNode } from "../util/IKNodes.js";
import {ArmatureSegment} from "./ArmatureSegment.js";

export class ShadowSkeleton {
  constructor(skelState, baseDampening = Math.PI, precision = 64) {
      this.precision = precision;
      this.skelState = skelState;
      this.shadowSpace = new IKNode();
      this.baseDampening = baseDampening;
      this.boneWorkingBoneIndexMap = new Map();
      this.buildSimTransformsHierarchy();
      this.buildArmaturSegmentHierarchy();
      this.buildTraversalArray();
  }

  solve(iterations, stabilizationPasses, solveFrom, notifier) {
      this.alignSimAxesToBoneStates();
      this.pullBack(iterations, solveFrom, false, null);
      for (let i = 0; i < iterations; i++) {
          this.solveToTargets(stabilizationPasses, solveFrom, false, null);
      }
      this.conditionalNotify(true, notifier);
  }

  pullBack(iterations, solveFrom, doNotify, notifier) {
      const endOnIndex = this.getEndOnIndex(solveFrom);
      this.updateReturnfulnessDamps(iterations);
      for (let j = 0; j <= endOnIndex; j++) {
          this.traversalArray[j].pullBackTowardAllowableRegion();
      }
      this.conditionalNotify(doNotify, notifier);
  }

  /**
	 * @param stabilizationPasses set to 0 for maximum speed (but less stability given unreachable situations), 
	 * Set to 1 for maximum stability while following constraints. 
	 * Set to higher than 1 for negligible benefit at considerable cost. 
	 * Set to -1 to indicate constraints can be broken on the last iteration of a solver call
	 * @param solveFrom optional, if given, the solver will only solve for the segment the given bone is on (and any of its descendant segments
	 * @param notifier a (potentially threaded) function to call every time the solver has updated the transforms for a given bone. 
	 * Called once per solve, per bone. NOT once per iteration.
	 * This can be used to take advantage of parallelism, so that you can update your Bone transforms while this is still writing into the skelState TransformState list
	 */
  solveToTargets(stabilizationPasses, solveFrom, doNotify, notifier) {
      const endOnIndex = this.getEndOnIndex(solveFrom);
      let translate = endOnIndex === this.traversalArray.length - 1;
      let skipConstraints = stabilizationPasses < 0;
      stabilizationPasses = Math.max(0, stabilizationPasses);
      for (let j = 0; j <= endOnIndex; j++) {
          const wb = this.traversalArray[j];
          wb.fastUpdateOptimalRotationToPinnedDescendants(stabilizationPasses, translate && j === endOnIndex, skipConstraints);
      }
      this.conditionalNotify(doNotify, notifier);
  }

  /**
	 * lazy lookup. Get the traversal array index for the root of the pinned segment the working bone corresponding to this bonestate resides on, 
	 * but only if it's different than the last one that was tracked.
	 * @param solveFrom
	 * @return
	 */
  getEndOnIndex(solveFrom) {
      if (solveFrom !== this.lastRequested) {
          if (!solveFrom) {
              this.lastRequestedEndIndex = this.traversalArray.length - 1;
              this.lastRequested = null;
          } else {
              const idx = this.boneWorkingBoneIndexMap.get(solveFrom);
              const wb = this.traversalArray[idx];
              const root = wb.getRootSegment().wb_segmentRoot;
              this.lastRequestedEndIndex = this.boneWorkingBoneIndexMap.get(root.forBone);
              this.lastRequested = solveFrom;
          }
      }
      return this.lastRequestedEndIndex;
  }
/**
	 * lazy update of returnfullness dampening if the number of iterations for this solver call is different than the previous one
	 * @param iterations
	 */
  updateReturnfulnessDamps(iterations) {
      if (this.previousIterationRequest !== iterations) {
          for (let j = 0; j < this.traversalArray.length; j++) {
              this.traversalArray[j].updateReturnfullnessDamp(iterations);
          }
      }
      this.previousIterationRequest = iterations;
  }

  
  /**wrapper for conditional debugging */
  conditionalNotify(doNotify, notifier) {
      if (doNotify) {
          this.alignBoneStatesToSimAxes(notifier);
      }
  }

  alignSimAxesToBoneStates() {
      const transforms = this.skelState.getTransformsArray();
      for (let i = 0; i < transforms.length; i++) {
          this.simTransforms[i].getLocalMBasis().setFromArrays(transforms[i].translation, transforms[i].rotation, transforms[i].scale);
          this.simTransforms[i]._exclusiveMarkDirty(); //we're marking the entire hierarchy dirty anyway, so avoid the recursion
      }
  }

  alignBoneStatesToSimAxes(notifier = null) {
    if(notifier == null) {
        for (let i = 0; i < this.traversalArray.length; i++) 
            this.alignBone(this.traversalArray[i]);
    } else {
        for (let i = 0; i < this.traversalArray.length; i++) {
            this.alignBone(this.traversalArray[i]);
            notifier(this.traversalArray[i].forBone);
        }
    }
      

  }

  alignBone(wb) {
      const bs = wb.forBone;
      /**@type {TransformState}*/
      const ts = bs.getFrameTransform();
      wb.simLocalAxes.localMBasis.translate.intoArray(ts.translation);
      wb.simLocalAxes.localMBasis.rotation.intoArray(ts.rotation);
  }

  buildSimTransformsHierarchy() {
      const transformCount = this.skelState.getTransformCount();
      if (transformCount === 0) return;

      this.simTransforms = [];
      for (let i = 0; i < transformCount; i++) {
          const ts = this.skelState.getTransformState(i);
          const newTransform = new IKNode(null, this.shadowSpace);
          newTransform.getLocalMBasis().adoptValuesFromTransformState(ts);
          this.simTransforms.push(newTransform);
      }

      for (let i = 0; i < transformCount; i++) {
          const ts = this.skelState.getTransformState(i);
          const parTSidx = ts.getParentIndex();
          const simT = this.simTransforms[i];
          if (parTSidx === -1) simT.setRelativeToParent(this.shadowSpace);
          else simT.setRelativeToParent(this.simTransforms[parTSidx]);
      }
  }

  buildArmaturSegmentHierarchy() {
      const rootBone = this.skelState.getRootBonestate();
      if (!rootBone) return;

      this.rootSegment = new ArmatureSegment(this, rootBone, null, false);
      this.rootSegment.init();
  }

  buildTraversalArray() {
      if (!this.rootSegment) return;

      const segmentTraversalArray = this.rootSegment.getDescendantSegments();
      const reversedTraversalArray = [];
      this.boneWorkingBoneIndexMap.clear();

      for (const segment of segmentTraversalArray) {
          reversedTraversalArray.push(...segment.reversedTraversalArray);
      }

      this.traversalArray = new Array(reversedTraversalArray.length);
      let j = 0;

      for (let i = reversedTraversalArray.length - 1; i >= 0; i--) {
          this.traversalArray[j] = reversedTraversalArray[i];
          this.boneWorkingBoneIndexMap.set(this.traversalArray[j].forBone, j);
          j++;
      }

      this.lastRequested = null;
      this.lastRequestedEndIndex = this.traversalArray.length - 1;
  }

  setDampening(dampening, defaultIterations) {
      this.baseDampening = dampening;
      this.updateRates(defaultIterations);
  }

  updateRates(iterations) {
    if(this.rootSegment == null) {
        throw Error("No rootsegment");
    }
    this.rootSegment.recursivelyCreateHeadingArrays();
    for (let j = 0; j < this.traversalArray.length; j++) {
        this.traversalArray[j].updateCosDampening();
        this.traversalArray[j].updateReturnfullnessDamp(iterations);
    }
  }
}