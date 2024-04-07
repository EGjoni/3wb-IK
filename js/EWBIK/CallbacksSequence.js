/**
 *  @typedef {Object} CallbacksSequence
* Represents a sequence of callbacks to call at various points in the solver loop. These are called once per object that the solver reads or writes from. The scene Object being read or written to is provided as the first argument, which you can use to determine if its one you care about. The second argument will be either one of TransformState or WorkingBone, these are used for intermediary and internal representations of your armature. WorkingBone in particular has a lot of properties that spider out into the rest of the solver, which you can use to inspect any number of things you may care about.

* @property {function(Bone, TransformState)} beforeShadow - calledbefore transferring the scene object's current state to theShadowSkeleton. 
* @property {function(Bone, TransformState)} afterShadow - calledafter transferring the scene object's current state to theShadowSkeleton.
* @property {function(Bone, TransformState, WorkingBone)}beforeIteration - called once per bone, per solver iteration beforeattempting to optimize a bone's transform. WorkingBone refers to theinternal bone representation that is about to be optimized.
* @property {function(Bone, TransformState, WorkingBone)}beforePullback - called once per bone, per solver iteration beforeattempting to pull a bone back to a comfortable region. WorkingBonerefers to the internal bone representation that is about to beoptimized.
* @property {function(Bone, TransformState, WorkingBone)}afterPullback - called once per bone, per solver after attempting topull a bone back to a comfortable region. WorkingBone refers to theinternal bone representation that is about to be optimized.
* @property {function(Bone, TransformState, WorkingBone)}afterIteration - called once per bone, per solver iteration afterattempting to optimize a bone's transform. WorkingBone refers to theinternal bone representation that is was just optimized.
* @property {function(Bone, TransformState)} afterSolve - called once per bone after solving has completed and the results aretransferred to the transformState. 
* @property {function(Bone, TransformState)} afterScene - calledonce per bone after solving has completed and the results are transferred to the Object3Ds transforms. 
*/


export class CallbacksSequence {

    /** @property {function(WorkingBone)} beforeShadow - called before transferring the scene object's current state to the ShadowSkeleton. */
    beforeShadow = undefined;
    /** @property {function(WorkingBone)} afterShadow - called after transferring the scene object's current state to the ShadowSkeleton.*/
    afterShadow = undefined
    /** @property {function(WorkingBone)} beforeIteration - called once per bone, per solver iteration before attempting to optimize a bone's transform. WorkingBone refers to the internal bone representation that is about to be optimized.*/
    beforeIteration = undefined;
    /** @property {function(WorkingBone)} beforePullback - called once per bone, per solver iteration before attempting to pull a bone back to a comfortable region. WorkingBone refers to the internal bone representation that is about to be optimized.*/
    beforePullback = undefined;

    /** @property {function(WorkingBone)} afterPullback - called once per bone, per solver after attempting to pull a bone back to a comfortable region. WorkingBone refers to the internal bone representation that is about to be optimized.*/
    afterPullback = undefined;
    /** @property {function(WorkingBone)} afterIteration - called once per bone, per solver iteration after attempting to optimize a bone's transform. WorkingBone refers to the internal bone representation that is was just optimized.*/
    afterIteration = undefined;
    /**@property {function(WorkingBone)} afterSolve - called once per bone after solving has completed and the results are transferred to the transformState.*/
    afterSolve = undefined;
    /** 
     * @property {function(WorkingBone)} afterScene - called once per bone after solving has completed and the results are transferred to the Object3d's. 
     */
    afterScene = undefined;

    constructor(callbacks = {}) {
        this.__callbacksIn = callbacks;
    }
    __initStep(augmentWith) {
        if (this.__callbacksIn.beforeShadow != null) {
            this.beforeShadow = function (wb) { augmentWith(this.__callbacksIn.beforeShadow, wb); }
        } else this.beforeShadow = () => { return };

        if (this.__callbacksIn.afterShadow != null) {
            this.afterShadow = function (wb) { augmentWith(this.__callbacksIn.afterShadow, wb); }
        } else this.afterShadow = () => { return };

        if (this.__callbacksIn.beforeIteration != null) {
            this.beforeIteration = function (wb) { augmentWith(this.__callbacksIn.beforeIteration, wb); }
        } else this.beforeIteration = () => { return };
        if (this.__callbacksIn.beforePullback != null) {
            this.beforePullback = function (wb) { augmentWith(this.__callbacksIn.beforePullback, wb); }
        } else this.beforePullback = () => { return };
        if (this.__callbacksIn.afterPullback != null) {
            this.afterPullback = function (wb) { augmentWith(this.__callbacksIn.afterPullback, wb); }
        } else this.afterPullback = () => { return };
        if (this.__callbacksIn.afterIteration != null) {
            this.afterIteration = function (wb) { augmentWith(this.__callbacksIn.afterIteration, wb); }
        } else this.afterIteration = () => { return };
        if (this.__callbacksIn.afterSolve != null) {
            this.afterSolve = function (wb) { augmentWith(this.__callbacksIn.afterSolve, wb); }
        } else this.afterSolve = () => { return };
        if (this.__callbacksIn.afterScene != null) {
            this.afterScene = function (wb) { augmentWith(this.__callbacksIn.afterScene, wb); }
        } else this.afterScene = () => { return };
    }
}