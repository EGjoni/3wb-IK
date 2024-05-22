import * as THREE from 'three';

const { Constraint, LimitingReturnful} = await import( "../../betterbones/Constraints/ConstraintStack.js");
import { LayerGroup} from "../LayerGroup.js";

export class ConstraintHelper extends THREE.Group {
    tempTHREEVec = new THREE.Vector3();
    worldScale = 1;
    constructor(constraint, visibilityCondition) {
        super();
        this.layers = new LayerGroup(this, (val, mask) => {
            let me = this;
            this.traverse(o => {
                if(o == me) return;               
                if(o instanceof THREE.Object3D) {
                    o.layers.mask = mask;
                }
            })
        });
        this.forConstraint = constraint;
        this.forConstraint.helper = this;
        this.forBone = this.forConstraint.forBone;
        constraint.forBone.parent.add(this);
        this.setVisibilityCondition(visibilityCondition);
        constraint.registerModListener(
            (constraint)=>{
                this.regenDisplay(constraint);
                this.updateDisplay(constraint);
            }
        );
        this.worldScale = this?.forBone?.getWorldScale(this.tempTHREEVec);
        this.worldScale = this.tempTHREEVec.y;
    }

    /**returns this helper, unless the constraint its for has been removed, in which case returns null */
    regenDisplay(constraint) {
        if(this.forConstraint.forBone == null) {
            this.removeFromParent();
            return null;
        } 
        this.worldScale = this?.forBone?.getWorldScale(this.tempTHREEVec);
        this.worldScale = this.tempTHREEVec.y;
        return this;
    }
    async updateDisplay(constraint) {

    }
     /**a callback function to determine whether to display this constraint */
     setVisibilityCondition(visibleCallback) {
        if (visibleCallback ==null) 
            this._visibilityCondition = (forConstraint, forBone) => false;
        else { 
            this._visibilityCondition = visibleCallback;
        }
    }
    _visibilityCondition(forConstraint, forBone) {
        return false;
    }

    set visible(val) {
        this._visible = val; 
    }
    get visible() {
        return this._visible && this._visibilityCondition(this.forConstraint, this.forConstraint.forBone);
    }
}