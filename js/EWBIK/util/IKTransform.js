import {  Vec3} from "./vecs.js";
import { Ray, Rayd, Rayf } from "./Ray.js";
import { IKNode } from "./IKNodes.js";
const THREE = await import('three');
import { Quaternion, Vector3, Object3D, Matrix4 } from "three";
import { Rot } from "./Rot.js";
import { generateUUID } from "./uuid.js";

export class IKTransform {
    static totalTransforms = 0;
    static LEFT = -1;
    static RIGHT = 1;
    static NONE = -1;
    static X = 0;
    static Y = 1;
    static Z = 2;
    id = IKTransform.totalTransforms;
    forceOrthonormality = true;

    chirality = IKTransform.RIGHT;
    /**@type {Rot} */
    rotation = Rot.IDENTITY.clone();
    /**@type {Rot} */
    _inverseRotation = Rot.IDENTITY.clone().conjugate();
    inverseDirty = true;
    raysDirty = true; 
    

    

    /**
     * 
     * @param {instanceof IKTransform or Vec3 or Ray} origin if IKTransform, other arguments are ignored and a copy is made of the input IKTransform, otherwise the origin Vec3 is treated as the origin of the newly created basis.
     * @param {Ray or Vec3} x x direction heading or ray
     * @param {Ray or Vec3} y y direction heading or ray
     * @param {Ray or Vec3} z z direction heading or ray
     */
    constructor(origin=null, x = null, y = null, z = null, ikd = 'IKNode-'+(IKTransform.totalTransforms+1), pool= noPool) {
        this.ikd = 'IKTransform'-IKTransform.totalTransforms+1;
        IKTransform.totalNodes += 1; 
        this.pool = noPool;
        this.translate = this.pool.new_Vec3(0,0,0);
        this.scale = this.pool.new_Vec3(1,1,1);
        this.xBase = this.pool.new_Vec3(1,0,0);
        this.yBase = this.pool.new_Vec3(0,1,0);
        this.zBase = this.pool.new_Vec3(0,0,1);
        this._xRay = new Ray(this.translate, this.xBase);
        this._yRay = new Ray(this.translate, this.yBase);
        this._zRay = new Ray(this.translate, this.zBase);

        if (origin instanceof IKTransform) {
            this.initializeBasisAtOrigin(origin);
        } else if (origin instanceof Ray && x instanceof Ray && y instanceof Ray) {
            this.initializeBasisWithRays(origin, x, y);
        } else if (origin != null) {
            
            this.initializeBasisWithDirections(origin, x, y, z);
        }
        this.refreshPrecomputed();
    }


    static newPooled(pool) {
        return new IKTransform(null, null, null, null, null, pool);
    }

    initializeBasisAtOrigin(origin) {
        this.translate = origin.clone();
        this.setBaseVectors();
        this.initializeRays();
    }

    initializeBasisWithRays(x, y, z) {
        this.translate = x.p1.clone();
        this._xRay = x.clone();
        this._yRay = y.clone();
        this._zRay = z.clone();
        this.xBase.setComponents(xRay.mag(),0, 0);
        this.yBase.setComponents(0, yRay.mag());
        this.zBase.setComponents(0, 0, zRay.mag());
        this.rotation = this.createPrioritzedRotation(this._xRay.heading(), this._yRay.heading(), this._zRay.heading());
    }

    /*createPrioritzedRotation(xHeading, yHeading, zHeading) {		
        let tempV = zHeading.clone(); 
        tempV.setComponents(0,0,0);
        let toYZ = new Rot(yBase, zBase, yHeading, zHeading); 
        toYZ.applyToRot(yBase, tempV);
        let toY = Rot.fromVecs(tempV, yHeading);
        return toY.applyToRot(toYZ);
    }*/

    initializeBasisWithDirections(origin, x, y, z) {
        this.translate = origin.clone();
        this._xRay = new Ray(origin.clone(), origin.addClone(x));
        this._yRay = new Ray(origin.clone(), origin.addClone(y));
        this._zRay = new Ray(origin.clone(), origin.addClone(z));
        this.xBase.setComponents(xRay.mag(),0, 0);
        this.yBase.setComponents(0, yRay.mag());
        this.zBase.setComponents(0, 0, zRay.mag());
        this.rotation = this.createPrioritzedRotation(this._xRay.heading(), this._yRay.heading(), this._zRay.heading());
    }


    initializeRays() {
        let zero = this.translate.clone();
        zero.setComponents(0, 0, 0);
        this._xRay = new Ray(zero.clone(), this.xBase.clone());
        this._yRay = new Ray(zero.clone(), this.yBase.clone());
        this._zRay = new Ray(zero.clone(), this.zBase.clone());
    }

    adoptValues(input) {
        this.translate.setComponents(input.translate.x, input.translate.y, input.translate.z);
        this.rotation.w = input.rotation.w;
        this.rotation.x = input.rotation.x;
        this.rotation.y = input.rotation.y;
        this.rotation.z = input.rotation.z;
        this.xBase.set(input.xBase);
        this.yBase.set(input.yBase);
        this.zBase.set(input.zBase);
        this._xRay.setP1(input.xRay.p1); 
        this._xRay.setP2(input.xRay.p2);
        this._yRay.setP1(input.yRay.p1); 
        this._yRay.setP2(input.yRay.p2);
        this._zRay.setP1(input.zRay.p1); 
        this._zRay.setP2(input.zRay.p2);
        this.refreshPrecomputed();
        return this;
    }

    adoptValuesFromTransformState(input) {
        this.translate.setComponents(input.translation);
        this.rotation.x = input.rotation[0];
        this.rotation.y = input.rotation[1];
        this.rotation.z = input.rotation[2];
        this.rotation.w = input.rotation[3];
        this.xBase.setComponents(input.scale[0], 0, 0);
        this.yBase.setComponents(0, input.scale[1], 0,);
        this.zBase.setComponents(0, 0, input.scale[2]);
        this.refreshPrecomputed();
        return this;
    }

    setToIdentity(){
        //return this.setFromArrays([0,0,0], [1,0,0,0], [1,1,1], false); // jpl
        return this.setFromArrays([0,0,0], [1,0,0,0], [1,1,1], false); // hamilton
    }

    setFromArrays(translation, rotation, scale, normalize = true) {
        this.translate.setComponents(...translation);
        this.xBase.setComponents(scale[0], 0, 0);
        this.yBase.setComponents(0, scale[1], 0);
        this.zBase.setComponents(0, 0, scale[2]);
        this.rotation.setComponents(rotation[0], rotation[1], rotation[2], rotation[3], normalize);
        this.refreshPrecomputed();
        return this;
    }

    setFromGlobalizedObj3d(object3d, temp_originvec = new Vector3(0,0,0), temp_identitythreequat = new Quaternion(0,0,0,1), temp_unitscale = new Vector3(1,1,1)) {
        temp_originvec.copy(IKNode.originthreevec)
        temp_identitythreequat.copy(IKNode.identitythreequat);
        temp_unitscale.copy(IKNode.unitthreescale);
        object3d.updateWorldMatrix();
        const pos = object3d.getWorldPosition(temp_originvec);
        const quat = object3d.getWorldQuaternion(temp_identitythreequat);
        const scale = object3d.getWorldScale(temp_unitscale); 
        this.translate.setComponents(pos.x, pos.y, pos.z);
        //this.rotation.setComponents(quat.x, quat.y, quat.z, quat.w); // raw jpl input
        this.rotation.setComponents(quat.w, -quat.x, -quat.y, -quat.z); //convert to hamilton from jpl
        this.scale.setComponents(scale.x, scale.y, scale.z);
        this.refreshPrecomputed();
    }

    setFromObj3d(object3d) {
        this.translate.setComponents(object3d.position.x, object3d.position.y, object3d.position.z);
        //this.rotation.setComponents(object3d.quaternion.x, object3d.quaternion.y, object3d.quaternion.z, object3d.quaternion.w); //jpl
        this.rotation.setComponents(object3d.quaternion.w, -object3d.quaternion.x, -object3d.quaternion.y, -object3d.quaternion.z); //hamilton
        this.scale.setComponents(object3d.scale.x, object3d.scale.y, object3d.scale.z);
        this.refreshPrecomputed();
    }

    /**
     * 
     * @param {IKTransform} globalinput 
     * @param {IKTransform} localoutput 
     * @returns 
     */
    setTransformToLocalOf(globalinput, localoutput) {
        this.setVecToLocalOf(globalinput.translate, localoutput.translate);
        //globalinput.rotation.applyToRot(this.inverseRotation, localoutput.rotation); //jpl
        this.inverseRotation.applyToRot(globalinput.rotation, localoutput.rotation); //hamilton
        localoutput.refreshPrecomputed();
        return localoutput;
    }

    setVecToLocalOf(globalInput, localOutput) {
        localOutput.set(globalInput);
		localOutput.sub(this.translate); 
        this.inverseRotation.applyToVec(localOutput, localOutput);
        return localOutput;
    }

    setTransformToGlobalOf(localInput, globalOutput) {
		this.rotation.applyToRot(localInput.rotation, globalOutput.rotation);
		this.setVecToGlobalOf(localInput.translate, globalOutput.translate);		
		globalOutput.refreshPrecomputed();
        return globalOutput;
 	}

    setVecToGlobalOf(localInput, globalOutput) {
        this.rotation.applyToVec(localInput, globalOutput);
        globalOutput.add(this.translate);
        return globalOutput;
    }


    rotateTo(newRotation) {				
		this.rotation.setFromRot(newRotation); 
		this.refreshPrecomputed();
	}

	rotateBy(addRotation) {		
		addRotation.applyToRot(this.rotation, this.rotation);
		this.refreshPrecomputed();
	}

    getLocalOfVec(inVec) {
        const result = inVec.clone();
        this.setVecToLocalOf(inVec, result);
        return result;  
    }

    getLocalOfRotation(inRot) {		
        //let resultNew =  this.inverseRotation.applyToRot(inRot).applyToRot(this.rotation); // jpl
        let resultNew =  inRot.applyToRot(this.inverseRotation).applyToRot(this.rotation); //hamilton
        return resultNew;			
    }

    translateBy(vec) {
        this.translate.add(vec);
    }

    translateTo(vec) {
        this.translate.set(vec);
    }

    refreshPrecomputed() {
        this.raysDirty = true;
        this.inverseDirty = true;
        //this.rotation.setToReversion(this._inverseRotation);
        //this.updateRays();
    }

    release() {
        this._xRay.release();
        this._yRay.release();
        this._zRay.release();
        this.translate.release();
        this.rotation.release();
        this._inverseRotation.release();
        this.scale.release();
        this.xBase.release();
        this.yBase.release();
        this.zBase.release();
    }

    get inverseRotation() {
        if(this.inverseDirty) {
            this.rotation.invertInto(this._inverseRotation);
            this.inverseDirty = false;
        }
        return this._inverseRotation;
    }

    get xRay() {
        if(this.raysDirty) this.updateRays();
        return this._xRay;
    }
    get yRay() {
        if(this.raysDirty) this.updateRays();
        return this._yRay;
    }
    get zRay() {
        if(this.raysDirty) this.updateRays();
        return this._zRay;
    }

    isAxisFlipped(axis) {
        return false;
    }


    getXHeading() {
        return this.xRay.heading();
    }
    getYHeading() {
        return this.yRay.heading();
    }
    getZHeading() {
        return this.zRay.heading();
    }

    updateRays() {
        this._xRay.setP1(this.translate);
        this._xRay.setHeading(this.xBase);
        this._yRay.setP1(this.translate);
        this._yRay.setHeading(this.yBase);
        this._zRay.setP1(this.translate);
        this._zRay.setHeading(this.zBase);
        this.rotation.applyToRay(this._xRay, this._xRay);
        this.rotation.applyToRay(this._yRay, this._yRay);
        this.rotation.applyToRay(this._zRay, this._zRay);
        this.scale.setComponents([this.xBase.mag(), this.yBase.mag(), this.zBase.mag()]);
        this.raysDirty = false;
    }

    getOrigin() {
        return this.translate;
    }

    toString(headings = false) {
        let xh = this.xRay.heading();
        let yh = this.yRay.heading();
        let zh = this.zRay.heading();
        let xMag = xh.mag();
        let yMag = yh.mag();
        let zMag = zh.mag();
        let rotax = this.rotation.getAxis();
        let chiralityStr = this.chirality === IKTransform.LEFT ? "LEFT" : "RIGHT";
        let headingstr = headings? `xHead: ${xh.toString()}, mag: ${xMag.toString()}
        yHead: ${yh.toString()}, mag: ${yMag.toString()}
        zHead: ${zh.toString()}, mag: ${zMag.toString()}` : '';
        return `-----------
${chiralityStr} handed
origin: ${this.translate.toString()}
${this.rotation.toString(true, true)}
${headingstr}`
    }

    toHTMLString() {
        
    }

    /**prints color and glyph representations of two transforms */
    static compareWith(trans1, trans2) {
        let built = IKTransform._getCompareStyles(trans1, trans2);
        console.log(built.string, ...built.styles);
    }

    /**
     * compares this transform with the one provided.
     * @param {IKTransform} transform 
     */
    compare(transform) {
        IKTransform.compareWith(this, transform);
    }


    static _getCompareStyles(trans1, trans2) {
        let xh_1 = trans1.xRay.heading();
        let yh_1 = trans1.yRay.heading();
        let zh_1 = trans1.zRay.heading();
        let xMag_1 = xh_1.mag();
        let yMag_1 = yh_1.mag();
        let zMag_1 = zh_1.mag();
        let rotax_1 = trans1.rotation.getAxis();
        let pos1 = trans1.translate;
        let chiralityStr_1 = trans1.chirality === IKTransform.LEFT ? "LEFT" : "RIGHT";

        let xh_2 = trans2.xRay.heading();
        let yh_2 = trans2.yRay.heading();
        let zh_2 = trans2.zRay.heading();
        let xMag_2 = xh_2.mag();
        let yMag_2 = yh_2.mag();
        let zMag_2 = zh_2.mag();
        let pos2 = trans2.translate; 
        let rotax_2 = trans2.rotation.getAxis();
        let chiralityStr_2 = trans2.chirality === IKTransform.LEFT ? "LEFT" : "RIGHT";

        let posMax = Math.max(pos1.mag(), pos2.mag());
        let pos1Cons = pos1.asConsoleString(posMax);
        let pos2Cons = pos2.asConsoleString(posMax);
        let posStyles = [pos1Cons.style, pos2Cons.style];
        let posString = `Position: %c▇%c▇`;

        let rotAngleDelta = trans1.rotation.getAngle() - trans2.rotation.getAngle();
        let rotStyles = ['', rotax_1.asConsoleString(1).style, rotax_2.asConsoleString(1).style, ''];
        let rotString = `%cRotation: %c${trans1.rotation.getAngleGlyph()} %c${trans2.rotation.getAngleGlyph()} %c (${rotAngleDelta.toFixed(5)}) delta`;

        let built = {string: posString+'\n'+rotString, styles: [...posStyles, ...rotStyles]};

        let magMax = Math.max(xMag_1, xMag_2, yMag_1, yMag_2, zMag_1, zMag_2);
        let xMax = Math.max(xMag_1, xMag_2); 
        let xHeadStyles = [`${xh_1.asConsoleString(xMax).style}; font-size: ${xMag_1/magMax}em`, `${xh_2.asConsoleString(xMax).style}; font-size: ${xMag_2/magMax}em`];
        built.string += '\n'+'%cScale   :%cX%cX';
        built.styles.push('',...xHeadStyles);

        let yMax = Math.max(yMag_1, yMag_2); 
        let yHeadStyles = [`${yh_1.asConsoleString(yMax).style}; font-size: ${yMag_1/magMax}em`, `${yh_2.asConsoleString(yMax).style}; font-size: ${yMag_2/magMax}em`];
        built.string += ' %cY%cY';
        built.styles.push(...yHeadStyles);

        
        let zMax = Math.max(zMag_1, zMag_2); 
        let zHeadStyles = [`${zh_1.asConsoleString(zMax).style}; font-size: ${zMag_1/magMax}em`, `${zh_2.asConsoleString(zMax).style}; font-size: ${zMag_2/magMax}em`];
        built.string += ' %cZ%cZ';
        built.styles.push(...zHeadStyles);
        return built;
    }

    clone() {
		return  new IKTransform().adoptValues(this); 
	}

}

export class CartesianTransform extends IKTransform {

	clone() {
		return  new CartesianTransform(this); 
	}

}
