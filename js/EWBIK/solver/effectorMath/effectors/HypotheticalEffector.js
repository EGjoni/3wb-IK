import { Effector } from './Effector.js';



export class HypotheticalEffector extends Effector {
    xPriority = 1;
    yPriority = 1;
    zPriority = 1;
    weight = 1;

    xScale = 1;
    yScale = 1;
    zScale = 1;

    tipAxes = null;
    targetAxes = null;
    pool = null;

    /**
     * similar to effector but takes raw axes as input. This allows you to make untrue claims about which things are reaching for what.
     * this is useful primarily for resolving dependency conflicts (cycles in the mixed graph of influences)
     * By default fakeeffectors have max weights on all components
     *
    */
    /**
     *
     * @param {Vec3Pool} effectorPool backing effectorpool instance
     * @param {IKNode} tipAxes
     * @param {IKNode} targetAxes
     */
    constructor(effectorPool, tipAxes, targetAxes) {
        super(effectorPool, null, null);

    }


    updateAffectedBoneList() {
        //override because fake pins have whatever bones we tell them to
    }
}
