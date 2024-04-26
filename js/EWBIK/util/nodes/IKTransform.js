import {  Vec3, any_Vec3} from "./../vecs.js";
import { Ray, Rayd, Rayf } from "./../Ray.js";
import { IKNode } from "./IKNodes.js";
const THREE = await import('three');
import { Quaternion, Vector3, Object3D, Matrix4 } from "three";
import { Rot } from "./../Rot.js";
import { Saveable } from "../loader/saveable.js";

export class IKTransform extends Saveable {
    static totalTransforms = 0;
    static LEFT = -1;
    static RIGHT = 1;
    static NONE = -1;
    static X = 0;
    static Y = 1;
    static Z = 2;
    static xBase = new Vec3(1,0,0);
    static yBase = new Vec3(0,1,0);
    static zBase = new Vec3(0,0,1);
    static normal_ref = new Vec3(1,1,1);
    static zeroMat = new Matrix4().set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);

    static compositionsDirty =          0b00001;
    static inverseCompositionsDirty =   0b00010;
    static precompInverseDirty =        0b00100;
    static headingsDirty =              0b01000;
    static raysDirty =                  0b10000;
    static allDirty =                   0b11111;
    state = 0b0;

    /**@type {Vec3}*/
    xScaled_only = null;
    /**@type {Vec3}*/
    yScaled_only = null;
    /**@type {Vec3}*/
    zScaled_only = null;
    /**@type {Vec3}*/
    _xSkewed = null;
    /**@type {Vec3}*/
    _ySkewed = null;
    /**@type {Vec3}*/
    _zSkewed = null;

    /**@type {Vec3} full xheading after rotation, scale, and skew (no translation)*/
    _xHeading = null;
    /**@type {Vec3} full yheading after rotation, scale, and skew (no translation)*/
    _yHeading = null;
    /**@type {Vec3} full zheading after rotation, scale, and skew (no translation)*/
    _zHeading = null;

    id = IKTransform.totalTransforms;
    forceOrthonormality = true;
    isUniform = true;
    isOrthogonal = true;
    isOrthoNormal = true;

    chirality = IKTransform.RIGHT;
    /**
     * @type {Rot}
     * @defaultValue `Rot.IDENTITY.clone()`
     */
    rotation = Rot.IDENTITY.clone();
    /**@type {Rot} */
    _inverseRotation = Rot.IDENTITY.conjugated();
    /** the skew matrix, as represented by taking the literal additive difference from each basis of the scale matrix. This just gets added back in upon recomposition.
     * I guess part of me had always just passively assumed that skew interacted with scale, but I guess it doesn't. So there's your anticlimactic fact for the day.
    */
    skewMatrix = new THREE.Matrix4().copy(IKTransform.zeroMat); 
    skewMatrix_e = this.skewMatrix.elements;
    scaleMatrix = new THREE.Matrix4(); //the transformation matrix without any skew, rotation, or translation
    scaleMatrix_e = this.scaleMatrix.elements;
    composedMatrix = new THREE.Matrix4(); //the transformation matrix in all of its cold, austere glory.
    composedMatrix_e = this.composedMatrix.elements;
    inverseComposedMatrix = new THREE.Matrix4(); //It's about balance.
    inverseComposedMatrix_e = this.inverseComposedMatrix.elements;
    secretMatrix = new THREE.Matrix4().copy(IKTransform.zeroMat); //doesn't exist. Don't tell anyone.
    secretMatrix_e = this.secretMatrix.elements;
    tempQuat = new THREE.Quaternion();
    tempTransVector3 = new THREE.Vector3();
    tempScaleVector3 = new THREE.Vector3();
    tempWhateverVector3 = new THREE.Vector3();

    toJSON() {
        let result = super.toJSON();
        let r = result;
        r.translate = this.translate.toJSON();
        r.scale = this.scale.toJSON();
        r.skewMatrix = this.skewMatrix_e;
        r.rotation = this.rotation.toJSON();
        r.forceOrthonormality = this.forceOrthonormality;
        return r;
    }
    getRequiredRefs(){
        return {};
    }

    static fromJSON(json, loader, pool, scene) {
        let result = new IKTransform(null, null, null, null, json.ikd);
        result.rotation = Rot.fromJSON(json.rotation);
        result.scale = Vec3.fromJSON(json.scale, pool, scene);
        result.skewMatrix.elements = json.skewMatrix;
        result.instanceNumber = json.instanceNumber;
        result.state = IKTransform.allDirty;
        return result;
    }

    /**
     * 
     * @param {instanceof IKTransform or Vec3 or Ray} origin if IKTransform, other arguments are ignored and a copy is made of the input IKTransform, otherwise the origin Vec3 is treated as the origin of the newly created basis.
     * @param {Ray or Vec3} x x direction heading or ray
     * @param {Ray or Vec3} y y direction heading or ray
     * @param {Ray or Vec3} z z direction heading or ray
     */
    constructor(origin=null, x = null, y = null, z = null, ikd = 'IKTransform-'+(IKTransform.totalTransforms++), pool= globalVecPool) {
        super(ikd, 'IKTransform', IKTransform.totalTransforms, pool);
        this.translate = this.pool.new_Vec3(0,0,0);
        this.scale = this.pool.new_Vec3(1,1,1);
        this.xScaled_only = this.pool.new_Vec3fv(IKTransform.xBase);
        this.yScaled_only = this.pool.new_Vec3fv(IKTransform.yBase);
        this.zScaled_only = this.pool.new_Vec3fv(IKTransform.zBase);
        this._xHeading = this.pool.new_Vec3();
        this._yHeading = this.pool.new_Vec3();
        this._zHeading = this.pool.new_Vec3();        
        if (origin instanceof IKTransform) {
            this.initializeBasisAtOrigin(origin);
        } else if (origin instanceof Ray && x instanceof Ray && y instanceof Ray) {
            this.initializeBasisFromRays(origin, x, y, z);
        } else if (origin != null) {            
            this.initializeBasisFromDirections(origin, x, y, z);
        } else {
            this.scaleMatrix.makeScale(this.scale.x, this.scale.y, this.scale.z);
            this.initializeRays(this.translate);
        }
        this.lazyRefresh();
    }


    static newPooled(pool) {
        return new IKTransform(null, null, null, null, null, pool);
    }

    initializeBasisAtOrigin(origin) {
        this.translate.set(origin);
        this.setBaseVectors();
        this.initializeRays(translate);
        this.lazyRefresh();
    }

    /**
     * 
     * @param {Ray} x 
     * @param {Ray} y 
     * @param {Ray} z 
     */
    initializeBasisFromRays(x, y, z) {
        this.secretMatrix.identity();
        x.p1.writeInto(this.secretMatrix_e, 12);
        x.setToHeadingArr(this.secretMatrix_e, 0);
        y.setToHeadingArr(this.secretMatrix_e, 4);
        z.setToHeadingArr(this.secretMatrix_e, 8);
        this.setFromMatrix4(this.secretMatrix_e);
    }

    /**
     * updates storeIn to contain the globalspace heading of the provided input vector
      */
    getHeading(invec, storeIn = this.pool.any_Vec3(0,0,0)) {
        this.setVecToGlobalOf(invec, storeIn);
        storeIn.sub(this.translate);
        storeIn.normalize();
        return storeIn;
    }

    /**extracts skew by default */
    setFromMatrix4(mat4, extractSkew = true) {
        const pos = this.tempTransVector3;
        const quat = this.tempQuat;
        const scale = this.tempScaleVector3; 
        mat4.decompose(pos, quat, scale);
        this.translate.setComponents(pos.x, pos.y, pos.z);
        this.rotation.setComponents(quat.w, -quat.x, -quat.y, -quat.z);
        this.scale.setComponents(scale.x, scale.y, scale.z);
        this.rotation.normalize();
        this.scaleMatrix.makeScale(scale.x, scale.y, scale.z);

        this.state |= IKTransform.allDirty;

        if(!extractSkew) {
            this.isUniform = Math.abs(1-(scale.x/scale.y/scale.z)) < 1e-6;
            if(this.isUniform || this.forceOrthonormality) {
                this.scale.x = scale.x >= 0 ? 1 : -1;
                this.scale.y = scale.y >= 0 ? 1 : -1;
                this.scale.z = scale.y >= 0 ? 1 : -1;
            }
            this.isOrthogonal = true;
            this.isOrthoNormal = this.isUniform && this.isOrthogonal;
            this.skewMatrix.copy(zeroMat);
        } else {
            /** 
            * this only touches the rotational components, and writes directly into the skewmatrix values,
            * so we end up with a matrix representing the difference between the orthogonal matrix and the actual matrix,
            * which we just add back up upon recomposition
            */
            this.rotation.setToInversion(this._inverseRotation);
            this.inverseRotation.applyBeforeMatrix4_rot(mat4.elements, this.skewMatrix_e);
            IKTransform.matrixSub(this.scaleMatrix_e, this.skewMatrix_e);
            this._updateOrthoNormalHint();
            if(this.isUniform || this.forceOrthonormality) {
                this.scale.x = scale.x >= 0 ? 1 : -1;
                this.scale.y = scale.y >= 0 ? 1 : -1;
                this.scale.z = scale.y >= 0 ? 1 : -1;
            }
			this.state &= ~IKTransform.precompInverseDirty;
        }        
    }



    /**Warning: presumes the skew has already been calculated */
    _updateOrthoNormalHint() {
        let v = this.pool.any_Vec3();
        this.isUniform = Math.abs(1-(this.scale.x/this.scale.y/this.scale.z)) < 1e-6;
        if(v.readFrom(this.skewMatrix_e, 0).magnhattan() > 1e-6)  this.isOrthogonal = false;
        if(v.readFrom(this.skewMatrix_e, 4).magnhattan() > 1e-6)  this.isOrthogonal = false;
        if(v.readFrom(this.skewMatrix_e, 8).magnhattan() > 1e-6)  this.isOrthogonal = false;
        if(!this.isOrthogonal) this.isUniform = false;
        this.isOrthoNormal = this.isUniform && this.isOrthogonal;
    }    

    /**Note, extracts skew by default*/
    setFromGlobalizedObj3d(object3d, extractSkew = true) {
        this.tempTransVector3.copy(IKNode.originthreevec)
        this.tempQuat.copy(IKNode.identitythreequat);
        this.tempScaleVector3.copy(IKNode.unitthreescale);
        object3d.updateWorldMatrix();
        this.setFromMatrix4(object3d.matrixWorld, extractSkew);
    }


    /*createPrioritzedRotation(xHeading, yHeading, zHeading) {		
        let tempV = zHeading.clone(); 
        tempV.setComponents(0,0,0);
        let toYZ = new Rot(yScaled_only, zScaled_only, yHeading, zHeading); 
        toYZ.applyAfter(yScaled_only, tempV);
        let toY = Rot.fromVecs(tempV, yHeading);
        return toY.applyAfter(toYZ);
    }*/

    initializeBasisFromDirections(origin, x, y, z) {
        this.translate.set(origin);
        this.translate.writeInto(this.secretMatrix_e, 12);
        x.writeInto(this.secretMatrix_e, 0);
        y.writeInto(this.secretMatrix_e, 4);
        z.writeInto(this.secretMatrix_e, 8);
        this.setFromMatrix4(this.secretMatrix);
    }


    initializeRays(origin = this.pool.any_Vec3()) {
        let v = this.pool.any_Vec3();
        this._xRay = new Ray(origin, v.readFrom(this.scaleMatrix_e, 0));
        this._yRay = new Ray(origin, v.readFrom(this.scaleMatrix_e, 4));
        this._zRay = new Ray(origin, v.readFrom(this.scaleMatrix_e, 8));
    }

    /**
     * sets the values of this transform to mimix the values of the input transform
     * @param {IKTransform} input 
     * @returns this transform for chaining
     */
    adoptValues(input) {
        this.translate.set(input.translate);
        this.scale.set(input.scale);
        this.rotation.w = input.rotation.w;
        this.rotation.x = input.rotation.x;
        this.rotation.y = input.rotation.y;
        this.rotation.z = input.rotation.z;
        this.isOrthogonal = input.isOrthogonal;
        this.isNormal = input.isNormal;
        this.isOrthoNormal = input.isOrthoNormal;
        if(!input.isOrthoNormal) {
            input.recompose();
            this.skewMatrix.copy(input.skewMatrix);
            this.scaleMatrix.copy(input.scaleMatrix);
            this.composedMatrix.copy(input.composedMatrix);
            this.state = input.state;
        } else {
            this.skewMatrix.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);
            this.scaleMatrix.makeScale(this.scale.x, this.scale.y, this.scale.z);
            this.lazyRefresh();
        }
        return this;
    }

    adoptValuesFromTransformState(input) {
        this.setFromArrays(input.translation, input.rotation, input.scale);
        this.lazyRefresh();
        return this;
    }

    setToIdentity(){
        //return this.setFromArrays([0,0,0], [0,0,0,1], [1,1,1], false); // jpl
        return this.setFromArrays([0,0,0], [1,0,0,0], [1,1,1], false); // hamilton
    }

    setFromArrays(translation, rotation, scale, normalize = true) {
        this.translate.readFrom(translation, 0);
        this.scale.readFrom(scale, 0);
        this.scaleMatrix.makeScale(this.scale.x, this.scale.y, this.scale.z);
        this.skewMatrix.copy(IKTransform.zeroMat);
        this.rotation.setComponents(rotation[0], rotation[1], rotation[2], rotation[3], normalize);
        this.lazyRefresh();
        return this;
    }

    /**lazily checks if the composed matrix needs updating, and updates it if so*/
    recompose() {
        if(this.state & IKTransform.compositionsDirty) {
            IKTransform.matrixAddOutTo(this.scaleMatrix_e, this.skewMatrix_e, this.secretMatrix_e);
            this.rotation.applyBeforeMatrix4_rot(this.secretMatrix_e, this.composedMatrix_e);
            this.translate.writeInto(this.composedMatrix_e, 12);
            //mark everything but the compositions and inverseRotation dirty, leaving inverseRotation however it was
            this.state = ~(this.state & IKTransform.precompInverseDirty) & (IKTransform.allDirty & ~IKTransform.compositionsDirty);
            //if v8 doesn't inline those bit operations imma be so grumpy.
        }
    }

    /**addition of the first 3 rows (corresponding columnwise to each basis vector, and finally translation)
     *  of the first matrix, storing the results in the first 3 rows of the second matrix 
     * @param {Matrix4} mat1 the matrix to take values from
     * @param {Matrix4} addTo the matrix to add values into (as in, addition, not replacement or concatenation)
     * @return the matrix that was added into
    */
    static matrixAdd(mat1, addTo) {
        addTo[0] += mat1[0]; addTo[4] += mat1[4]; addTo[8] += mat1[8];  addTo[12] += mat1[12];
        addTo[1] += mat1[1]; addTo[5] += mat1[5]; addTo[9] += mat1[9];  addTo[13] += mat1[13];
        addTo[2] += mat1[2]; addTo[6] += mat1[6]; addTo[10] += mat1[10];addTo[14] += mat1[14];
        return addTo;
    }

    /**
     * like matrixAdd, but stores the result into a third matrix instead 
     * @param {Matrix4} mat1 
     * @param {Matrix4} mat2
     * @param {Matrix4} storeIn matrix to store results in
     * @return the matrix that was added into
    */
    static matrixAddOutTo(mat1, mat2, storeIn) {
        storeIn[0] = mat2[0]+mat1[0]; storeIn[4] = mat2[4]+mat1[4]; storeIn[8] = mat2[8]+mat1[8];   storeIn[12] = mat2[12]+mat1[12];
        storeIn[1] = mat2[1]+mat1[1]; storeIn[5] = mat2[5]+mat1[5]; storeIn[9] = mat2[9]+mat1[9];   storeIn[13] = mat2[13]+mat1[13];
        storeIn[2] = mat2[2]+mat1[2]; storeIn[6] = mat2[6]+mat1[6]; storeIn[10] = mat2[10]+mat1[10]; storeIn[14] = mat2[14]+mat1[14];
        return storeIn;
    }


    /**
     * subtraction of the first 3 rows (corresponding columnwise to each basis vector, and finally translation)
     * of the first matrix from first 3 rows of the second matrix, storing the results in the second matrix.     * 
     * @param {Matrix4} mat1 the matrix to take values from
     * @param {Matrix4} subFrom the matrix to subtract values from
     * @return the matrix that was subtractedFrom
    */
    static matrixSub(mat1, subFrom) {
        subFrom[0] -= mat1[0]; subFrom[4] -= mat1[4]; subFrom[8] -= mat1[8];   subFrom[12] -= mat1[12];
        subFrom[1] -= mat1[1]; subFrom[5] -= mat1[5]; subFrom[9] -= mat1[9];   subFrom[13] -= mat1[13];
        subFrom[2] -= mat1[2]; subFrom[6] -= mat1[6]; subFrom[10] -= mat1[10]; subFrom[14] -= mat1[14];
        return subFrom;
    }

     /**
     * subtraction of the first 3 rows (corresponding columnwise to each basis vector, and finally translation)
     * of the first matrix from first 3 rows of the second matrix, storing the results in the second matrix.     * 
     * @param {Matrix4} mat1 the matrix to take values from
     * @param {Matrix4} subFrom the matrix to subtract values from
     * @param {Matrix4} storeIn matrix to store results in
     * @return the matrix that was subtractedFrom
    */
     static matrixSubOutTo(mat1, subFrom, storeIn) {
        storeIn[0] = subFrom[0]-mat1[0]; storeIn[4] = subFrom[4]-mat1[4]; storeIn[8] = subFrom[8]-mat1[8];  storeIn[12] = subFrom[12]-mat1[12];
        storeIn[1] = subFrom[1]-mat1[1]; storeIn[5] = subFrom[5]-mat1[5]; storeIn[9] = subFrom[9]-mat1[9];  storeIn[13] = subFrom[13]-mat1[13];
        storeIn[2] = subFrom[2]-mat1[2]; storeIn[6] = subFrom[6]-mat1[6]; storeIn[10] = subFrom[10]-mat1[10];  storeIn[14] = subFrom[14]-mat1[14];
        return storeIn;
    }

    updateComposedInverse() {
        if(this.state & IKTransform.inverseCompositionsDirty) {
            if(this.state & IKTransform.compositionsDirty) {
                this.recompose();
            }
			this.inverseComposedMatrix.copy(this.composedMatrix);
            this.inverseComposedMatrix.invert();
            this.state &= ~IKTransform.inverseCompositionsDirty;
        }
    }

    updateHeadings() {
        if(this.state & IKTransform.compositionsDirty) this.recompose();
        this._xHeading.readFrom(this.composedMatrix_e, 0);
        this._yHeading.readFrom(this.composedMatrix_e, 4);
        this._zHeading.readFrom(this.composedMatrix_e, 8);
        this.state &= IKTransform.headingsDirty;
    }
   
    get xHeading() {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return this._xHeading;
    }
    get yHeading() {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return this._yHeading;
    }
    get zHeading() {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return this._zHeading;
    }

    setToXHeading(vec) {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return vec.set(this._xHeading);
    }

    setToYHeading(vec) {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return vec.set(this._yHeading);
    }

    setToZHeading(vec) {
        if(this.state & IKTransform.headingsDirty) this.updateHeadings();
        return vec.set(this._zHeading);
    }    

    setFromObj3d(object3d) {
        object3d.updateMatrix();
        this.setFromMatrix4(object3d.matrix);
        this.lazyRefresh();
    }

    /**
     * 
     * @param {IKTransform} globalinput 
     * @param {IKTransform} localoutput 
     * @returns 
     */
    setTransformToLocalOf(globalinput, localoutput) {
        if(!this.isOrthoNormal) {
            this.updateComposedInverse();
            globalinput.recompose();
            localoutput.composedMatrix.copy(globalinput.composedMatrix).premultiply(this.inverseComposedMatrix);
            localoutput.setFromMatrix4(localoutput.composedMatrix);
        }
        else {
            this.setVecToLocalOf(globalinput.translate, localoutput.translate);
            //globalinput.rotation.applyAfter(this.inverseRotation, localoutput.rotation); //jpl
            this.inverseRotation.applyAfter(globalinput.rotation, localoutput.rotation); //hamilton
            localoutput.rotation.normalize();
            const sRecip = 1/this.scale.x;
            //we can only get away with the next 4 lines by the grace of orthonormality
            localoutput.translate.mult(sRecip);
            localoutput.scale.set(globalinput.scale).mult(sRecip);
            localoutput.scaleMatrix.copy(globalinput.scaleMatrix).multiplyScalar(sRecip);
            localoutput.skewMatrix.copy(globalinput.skewMatrix).multiplyScalar(sRecip);
            //and in the end, was it even worth it? Only the profiler knows.
        }
        localoutput.lazyRefresh();
        return localoutput;
    }

    setVecToLocalOf(globalInput, localOutput) {
        if(this.isOrthogonal) {
            localOutput.set(globalInput);
            localOutput.sub(this.translate); 
            this.inverseRotation.applyToVec(localOutput, localOutput);
            localOutput.compDiv(this.scale);
        } else {
            this.updateComposedInverse();
            localOutput.readFromTHREE(
               globalInput.writeToTHREE(this.tempWhateverVector3).applyMatrix4(this.inverseComposedMatrix)
            );
        }       
        return localOutput;
    }

    setTransformToGlobalOf(localInput, globalOutput) {
        if(this.isOrthoNormal) {
            globalOutput.translate.set(localInput.translate).compMult(this.scale);
            globalOutput.scale.set(localInput.scale).compMult(this.scale); //only works if orthonormal, which we are. We checked. It's fine. Relax.
		    this.rotation.applyAfter(localInput.rotation, globalOutput.rotation);
            globalOutput.rotation.normalize();
		    this.setVecToGlobalOf(localInput.translate, globalOutput.translate);
            globalOutput.scaleMatrix.makeScale(globalOutput.scale.x, globalOutput.scale.y, globalOutput.scale.z);		
		    globalOutput.lazyRefresh();
        } else {
            this.recompose();
            localInput.recompose();
            globalOutput.setFromMatrix4(this.secretMatrix.multiplyMatrices(this.composedMatrix, localInput.composedMatrix));

        }
        return globalOutput;
 	}

    setVecToGlobalOf(localInput, globalOutput) {
        if(this.isOrthogonal) {
            globalOutput.set(localInput);
            globalOutput.compMult(this.scale);
            this.rotation.applyToVec(globalOutput, globalOutput);
            globalOutput.add(this.translate);
        } else {
            this.recompose();
            globalOutput.readFromTHREE(
                localInput.writeToTHREE(this.tempWhateverVector3).applyMatrix4(this.composedMatrix)
            );
        }
        return globalOutput;
    }

    writeToTHREE(obj3d) {
        if(isNaN(this.translate.x) || isNaN(this.rotation.x) || isNaN(this.scale.x)) {
            alert("NaN detected, check the debugger")
            throw new Error("Projecting NaNs is bad.");
        }
        obj3d.position.x = this.translate.x;
        obj3d.position.y = this.translate.y;
        obj3d.position.z = this.translate.z;

        obj3d.scale.x = this.scale.x;
        obj3d.scale.y = this.scale.y;
        obj3d.scale.z = this.scale.z;

        obj3d.quaternion.x = -this.rotation.x;
        obj3d.quaternion.y = -this.rotation.y;
        obj3d.quaternion.z = -this.rotation.z;
        obj3d.quaternion.w = this.rotation.w; 
    }


    rotateTo(newRotation) {				
		this.rotation.setFromRot(newRotation); 
        this.rotation.normalize();
		this.lazyRefresh();
	}

	rotateBy(addRotation) {		
		addRotation.applyAfter(this.rotation, this.rotation);
        this.rotation.normalize();
		this.lazyRefresh();
	}

    getLocalOfVec(inVec, outVec = this.pool.any_Vec3()) {
        this.setVecToLocalOf(inVec, outVec);
        return outVec;  
    }

    getLocalOfRotation(inRot, outRot) {		
        let resultNew = this.inverseRotation.applyAfter(inRot, outRot).applyAfter(this.rotation, outRot);
        outRot.normalize();
        //let resultNew =  inRot.applyWithin(this.rotation).applyAfter(this.rotation); //hamilton
        return resultNew;		
    }

    translateBy(vec) {
        this.translate.add(vec);
        this.lazyRefresh();
    }

    translateTo(vec) {
        this.translate.set(vec);
        this.lazyRefresh();
    }

    /**doesn't actually refresh, just indicates a need to.
     * updates are always lazy.
    */
    lazyRefresh() {
        this.state = IKTransform.allDirty;
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
        this.xScaled_only.release();
        this.yScaled_only.release();
        this.zScaled_only.release();
    }

    get inverseRotation() {
        if(this.state & IKTransform.precompInverseDirty) {
            this.rotation.invertInto(this._inverseRotation);
            //this.inverseSkewMatrix.copy(this.skewMatrix);
            this.state &= ~IKTransform.precompInverseDirty;
        }
        return this._inverseRotation;
    }

    get xRay() {
        if(this.state & IKTransform.raysDirty) this.updateRays();
        return this._xRay;
    }
    get yRay() {
        if(this.state & IKTransform.raysDirty) this.updateRays();
        return this._yRay;
    }
    get zRay() {
        if(this.state & IKTransform.raysDirty) this.updateRays();
        return this._zRay;
    }

    isAxisFlipped(axis) {
        return false;
    }


    getXHeading() {
        return this.xHeading;
    }
    getYHeading() {
        return this.yHeading;
    }
    getZHeading() {
        return this.zHeading;
    }

    updateRays() {
        if(this.state & IKTransform.compositionsDirty) this.recompose();
        if(this.state & IKTransform.raysDirty) {                        
            this._xRay.p1.set(this.translate);
            this._yRay.p1.set(this.translate);
            this._zRay.p1.set(this.translate);
            //god I really hope this is how cache locality works
            this._xHeading.readFrom(this.composedMatrix_e, 0);
            this._xRay.p2.readFrom(this.composedMatrix_e, 0).add(this.translate); 
            this._yHeading.readFrom(this.composedMatrix_e, 4);           
            this._xRay.p2.readFrom(this.composedMatrix_e, 4).add(this.translate);
            this._zHeading.readFrom(this.composedMatrix_e, 8);
            this._zRay.p2.readFrom(this.composedMatrix_e, 8).add(this.translate);
        }
        this.state &= ~(IKTransform.raysDirty | IKTransform.headingsDirty);
    }

    /**
     * 
     * @returns a pooled vector with the values of this.translate. Optionally just recycles a vector you provide
     */
    origin(storeIn = this.pool.any_Vec3()) {
        return storeIn.set(this.translate);
    }

    toString(headings = true) {
        let xh = this.getXHeading();
        let yh = this.getYHeading();
        let zh = this.getZHeading();
        let xMag = xh.mag();
        let yMag = yh.mag();
        let zMag = zh.mag();
        let rotax = this.rotation.getAxis();
        let chiralityStr = this.chirality === IKTransform.LEFT ? "LEFT" : "RIGHT";
        let headingstr = headings? `xHead: ${xh.toString()}, mag: ${xMag.toString()}
yHead: ${yh.toString()}, mag: ${yMag.toString()}
zHead: ${zh.toString()}, mag: ${zMag.toString()}` : '';
        return `origin: ${this.translate.toString()}
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

    toConsole() {

    }


    static _getCompareStyles(trans1, trans2 = IKTransform.IDENTITY) {
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

    static IDENTITY = new IKTransform();
}

export class CartesianTransform extends IKTransform {

	clone() {
		return  new CartesianTransform(this); 
	}

}
