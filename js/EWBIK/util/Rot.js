import { Vec3, VecN } from "./vecs.js";
import { VVec } from "./FlexFreezeArray.js";
import { Ray } from "./Ray.js";


/**intended as a mutable base for Rot. But this was poorly considered. */
export class MRotation {
    static IDENTITY = new MRotation(1.0, 0.0, 0.0, 0.0, false);

    constructor(q0=1.0, q1=0.0, q2=0.0, q3=0.0, needsNormalization = false) {
        if(!(Number.isFinite(q0))) {
            throw new Error("constructor only supports quaternion component inputs");
        }
        this.q0 = q0;
        this.q1 = q1;
        this.q2 = q2;
        this.q3 = q3;

        if (needsNormalization) {
            this.setToNormalized();
        }
    }

    static fromVecs(u, v) {
        let result = new MRotation(); 
        result.setFromVecs(u, v);
        return result;
    }

    setFromComponents(w, x, y, z, normalize = false) {
        this.q0=w, this.q1=x; this.q2 = y; this.q3=z;
        if(normalize) this.setToNormalized();
        return this;
    }

    setFromArray([w,x,y,z], normalize = false) {
        return this.setFromComponents(w,x,y,z,normalize);
    }

    setFromVecs(u, v) {
        let normProduct = u.mag() * v.mag();
        
		if (normProduct == 0) {
			this.q0 = 1;
			this.q1 = 0;
			this.q2 = 0;
			this.q3 = 0;
			return;
		}

		let dot = u.dot(v);

		if (dot < ((2.0e-15 - 1.0) * normProduct)) {
			// special case u = -v: we select a PI angle rotation around
			// an arbitrary vector orthogonal to u
			let w = u.getOrthogonal();
			this.q0 = 0.0;
			this.q1 = -w.x;
			this.q2 = -w.y;
			this.q3 = -w.z;
		} else {
			// general case: (u, v) defines a plane, we select
			// the shortest possible rotation: axis orthogonal to this plane
			this.q0 = Math.sqrt(0.5 * (1.0 + dot / normProduct));
			let coeff = 1.0 / (2.0 * this.q0 * normProduct);
			let q = v.crossCopy(u);
			this.q1 = coeff * q.x;
			this.q2 = coeff * q.y;
			this.q3 = coeff * q.z;
		}
        return this;
    }

    copy() {
        return new MRotation(this.q0, this.q1, this.q2, this.q3);
    }

    setToNormalized() {
        const norm = Math.sqrt(this.q0 * this.q0 + this.q1 * this.q1 + this.q2 * this.q2 + this.q3 * this.q3);
        this.q0 /= norm;
        this.q1 /= norm;
        this.q2 /= norm;
        this.q3 /= norm;
    }

    static _maybeUnflattenMatrix(arr) {
        if(arr.length == 9) {
            return [
                [arr[0], arr[3], arr[6]],
                [arr[1], arr[4], arr[7]],
                [arr[2], arr[5], arr[8]]
            ];
        }
        return arr;
    }

    static fromMatrix(m, threshold) { 
        const mat = this._maybeUnflattenMatrix(m);        
        const ort = this.orthogonalizeMatrix(mat, threshold);
        const det = ort[0][0] * (ort[1][1] * ort[2][2] - ort[2][1] * ort[1][2]) -
                    ort[1][0] * (ort[0][1] * ort[2][2] - ort[2][1] * ort[0][2]) +
                    ort[2][0] * (ort[0][1] * ort[1][2] - ort[1][1] * ort[0][2]);
        if (det < 0.0) {
            throw new Error("The closest orthogonal matrix has a negative determinant.");
        }

        const quat = this.mat2quat(ort);
        return new MRotation(quat[0], quat[1], quat[2], quat[3], false);

    }


    static fromAxisAngle(axis, angle) {
        let result = new MRotation(); 
        result.setFromAxisAngle(axis, angle);
        return result;
    }

    setFromAxisAngle(axis, angle) {
        const norm = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
        if (norm === 0) throw new Error("Zero Norm for Rotation defining vector");

        const halfAngle = -0.5 * angle;
        const coeff = Math.sin(halfAngle) / norm;

        this.q0 = Math.cos(halfAngle);
        this.q1 = coeff * axis.x; 
        this.q2 = coeff * axis.y; 
        this.q3 = coeff * axis.z;
        return this;
    }

    applyToVector(inVec, outVec = new Vec3()) {
        const x = inVec.x, y = inVec.y, z = inVec.z;
        const q0 = this.q0, q1 = this.q1, q2= this.q2, q3 = this.q3;
        const s = q1 * x + q2 * y + q3 * z;
        
        outVec.x = 2 * (q0 * (x * q0 - (q2 * z - q3 * y)) + s * q1) - x;
        outVec.y = 2 * (q0 * (y * q0 - (q3 * x - q1 * z)) + s * q2) - y,
        outVec.z = 2 * (q0 * (z * q0 - (q1 * y - q2 * x)) + s * q3) - z
        return outVec;
    }

    applyInverseToVector(u, output = new Vec3()) {
        const x = u.x, y = u.y, z = u.z;
        const m0 = -this.q0, q1 = this.q1, q2= this.q2, q3 = this.q3;
        const s = q1 * x + q2 * y + q3 * z;

        output.setComponents(
            2 * (m0 * (x * m0 - (q2 * z - q3 * y)) + s * q1) - x,
            2 * (m0 * (y * m0 - (q3 * x - q1 * z)) + s * q2) - y,
            2 * (m0 * (z * m0 - (q1 * y - q2 * x)) + s * q3) - z);
        return output;
    }


    getAngle() {
        const q0 = this.q0, q1 = this.q1, q2= this.q2, q3 = this.q3;
        if ((q0 < -0.1) || (q0 > 0.1)) {			
			return 2 * Math.asin(Math.sqrt(q1 * q1 + q2 * q2 + q3 * q3));
		} else if (q0 < 0) {
			return 2 * Math.acos(-q0);
		}		
		return 2 * Math.acos(q0);
    }

    getAxis(into = new Vec3()) {
        const squaredSine = this.q1 * this.q1 + this.q2 * this.q2 + this.q3 * this.q3;
        if (squaredSine === 0) 
            return into.setComponents(1,0,0);
       
        const inverse = 1 / Math.sqrt(squaredSine);
        into.setComponents(this.q1*inverse, this.q2*inverse, this.q3*inverse);
        return into;
    }

    multiply(rotation) {
        return MRotation.multiply(this, rotation);
    }

    clampToAngle(angle) {
		let cosHalfAngle = Math.cos(0.5*angle);
		this.clampToQuadranceAngle(cosHalfAngle);
	}

    clampToQuadranceAngle(cosHalfAngle) {
		let newCoeff = 1-(cosHalfAngle*Math.abs(cosHalfAngle));
		let currentCoeff = this.q1 * this.q1 + this.q2 * this.q2 + this.q3 * this.q3;
		if(newCoeff >= currentCoeff) 
			return;
		else {
			this.q0 = this.q0 < 0 ? -cosHalfAngle : cosHalfAngle;
			let compositeCoeff = Math.sqrt(newCoeff / currentCoeff); 
			this.q1*= compositeCoeff;
			this.q2*= compositeCoeff;
			this.q3*= compositeCoeff;
		}
	}

    static multiply(a, b) {
        return new MRotation(
            a.q0 * b.q0 - a.q1 * b.q1 - a.q2 * b.q2 - a.q3 * b.q3,
            a.q0 * b.q1 + a.q1 * b.q0 + a.q2 * b.q3 - a.q3 * b.q2,
            a.q0 * b.q2 - a.q1 * b.q3 + a.q2 * b.q0 + a.q3 * b.q1,
            a.q0 * b.q3 + a.q1 * b.q2 - a.q2 * b.q1 + a.q3 * b.q0
        );
    }

    normalize() {
        const norm = Math.sqrt(this.q0 * this.q0 + this.q1 * this.q1 + this.q2 * this.q2 + this.q3 * this.q3);
        if (norm < 1e-15) throw new Error("Zero Norm");
        this.q0 /= norm; 
        this.q1 /= norm; 
        this.q2 /= norm;
        this.q3 /= norm;
    }

    normalizedCopy() {
        const norm = Math.sqrt(this.q0 * this.q0 + this.q1 * this.q1 + this.q2 * this.q2 + this.q3 * this.q3);
        if (norm < 1e-15) throw new Error("Zero Norm");
        return new MRotation(this.q0 / norm, this.q1 / norm, this.q2 / norm, this.q3 / norm);
    }
    invert() {
        return new MRotation(-this.q0, this.q1, this.q2, this.q3, false);
    }

    /** 
	 * sets the values of the given rotation equal to the inverse of this rotation
	 * @param storeIN
	 */
    revertInto(storeIn) {
        storeIn.q0 = -this.q0;
        storeIn.q1 = this.q1;
        storeIn.q2 = this.q2;
        storeIn.q3 = this.q3;
    }

    
    applyToRotation(r) {
        const q0 = this.q0, q1 = this.q1, q2=this.q2, q3 = this.q3;
        return new MRotation(
            r.q0 * q0 - (r.q1 * q1 + r.q2 * q2 + r.q3 * q3),
            r.q1 * q0 + r.q0 * q1 + (r.q2 * q3 - r.q3 * q2),
            r.q2 * q0 + r.q0 * q2 + (r.q3 * q1 - r.q1 * q3),
            r.q3 * q0 + r.q0 * q3 + (r.q1 * q2 - r.q2 * q1), 
            false);
    }

    applyInverseToRotation(r) {
        const q0 = this.q0, q1 = this.q1, q2=this.q2, q3 = this.q3;
        return new MRotation(
            -r.q0 * q0 - (r.q1 * q1 + r.q2 * q2 + r.q3 * q3),
            -r.q1 * q0 + r.q0 * q1 + (r.q2 * q3 - r.q3 * q2),
            -r.q2 * q0 + r.q0 * q2 + (r.q3 * q1 - r.q1 * q3),
            -r.q3 * q0 + r.q0 * q3 + (r.q1 * q2 - r.q2 * q1),
            false
        );
    }

    static distance(r1, r2) {
        return r1.applyInverseToRotation(r2).getAngle();
    }

    equals(m) {
        // Using a small epsilon to account for floating-point arithmetic errors
        const epsilon = 1e-10;
        return Math.abs(this.q0 - m.q0) < epsilon &&
               Math.abs(this.q1 - m.q1) < epsilon &&
               Math.abs(this.q2 - m.q2) < epsilon &&
               Math.abs(this.q3 - m.q3) < epsilon;
    }

    toString() {
        const axis = this.getAxis();
        const angleDegrees = Math.toDegrees(this.getAngle());
        return `Axis: (${axis.toString()}), AngleDeg: ${angleDegrees.toFixed(2)}}`;
    }

    setFromMatrix3Val(storeIn) {
        const {q0, q1, q2, q3} = this;

        const q0q0 = q0 * q0;
        const q0q1 = q0 * q1;
        const q0q2 = q0 * q2;
        const q0q3 = q0 * q3;
        const q1q1 = q1 * q1;
        const q1q2 = q1 * q2;
        const q1q3 = q1 * q3;
        const q2q2 = q2 * q2;
        const q2q3 = q2 * q3;
        const q3q3 = q3 * q3;

        storeIn[0] = 2.0 * (q0q0 + q1q1) - 1.0;
        storeIn[1] = 2.0 * (q1q2 - q0q3);
        storeIn[2] = 2.0 * (q1q3 + q0q2);

        storeIn[3] = 2.0 * (q1q2 + q0q3);
        storeIn[4] = 2.0 * (q0q0 + q2q2) - 1.0;
        storeIn[5] = 2.0 * (q2q3 - q0q1);

        storeIn[6] = 2.0 * (q1q3 - q0q2);
        storeIn[7] = 2.0 * (q2q3 + q0q1);
        storeIn[8] = 2.0 * (q0q0 + q3q3) - 1.0;
    }

    /**
	 *  Get an array representing the 4X4 matrix corresponding to this rotation instance. 
	 * Indices are in column major order. In other words 
	 *<br/> 
	 * 0,  4,  8,  12 <br/>  
	 * 1,  5,  9,  13 <br/> 
	 * 2,  6, 10, 14 <br/>
 	 * 3,  7, 11, 15 <br/>
	 * */
	toMatrix4Val() {
		result = new Array(16); 
		return toMatrix4Val(result, false); 
	}

    toMatrix4Val(storeIn, zeroOut = true) {
        let q0q0 = this.q0 * this.q0;
        let q0q1 = this.q0 * this.q1;
        let q0q2 = this.q0 * this.q2;
        let q0q3 = this.q0 * this.q3;
        let q1q1 = this.q1 * this.q1;
        let q1q2 = this.q1 * this.q2;
        let q1q3 = this.q1 * this.q3;
        let q2q2 = this.q2 * this.q2;
        let q2q3 = this.q2 * this.q3;
        let q3q3 = this.q3 * this.q3;
    
        storeIn[0] = 2.0 * (q0q0 + q1q1) - 1.0;
        storeIn[1] = 2.0 * (q1q2 - q0q3);
        storeIn[2] = 2.0 * (q1q3 + q0q2);
        storeIn[4] = 2.0 * (q1q2 + q0q3);
        storeIn[5] = 2.0 * (q0q0 + q2q2) - 1.0;
        storeIn[6] = 2.0 * (q2q3 - q0q1);
        storeIn[8] = 2.0 * (q1q3 - q0q2);
        storeIn[9] = 2.0 * (q2q3 + q0q1);
        storeIn[10] = 2.0 * (q0q0 + q3q3) - 1.0;
        storeIn[15] = 1.0;
    
        if (zeroOut) {
            storeIn[3] = 0.0;
            storeIn[7] = 0.0;
            storeIn[11] = 0.0;
            storeIn[12] = 0.0;
            storeIn[13] = 0.0;
            storeIn[14] = 0.0;
        }
    
        return storeIn;
    }


    mat2quat(ort) {
        let quat = [0, 0, 0, 0];
        let s = ort[0][0] + ort[1][1] + ort[2][2];
        if (s > -0.19) {
            quat[0] = 0.5 * Math.sqrt(s + 1.0);
            let inv = 0.25 / quat[0];
            quat[1] = inv * (ort[1][2] - ort[2][1]);
            quat[2] = inv * (ort[2][0] - ort[0][2]);
            quat[3] = inv * (ort[0][1] - ort[1][0]);
        } else {
            s = ort[0][0] - ort[1][1] - ort[2][2];
            if (s > -0.19) {
                quat[1] = 0.5 * Math.sqrt(s + 1.0);
                let inv = 0.25 / quat[1];
                quat[0] = inv * (ort[1][2] - ort[2][1]);
                quat[2] = inv * (ort[0][1] + ort[1][0]);
                quat[3] = inv * (ort[0][2] + ort[2][0]);
            } else {
                s = ort[1][1] - ort[0][0] - ort[2][2];
                if (s > -0.19) {
                    quat[2] = 0.5 * Math.sqrt(s + 1.0);
                    let inv = 0.25 / quat[2];
                    quat[0] = inv * (ort[2][0] - ort[0][2]);
                    quat[1] = inv * (ort[0][1] + ort[1][0]);
                    quat[3] = inv * (ort[2][1] + ort[1][2]);
                } else {
                    s = ort[2][2] - ort[0][0] - ort[1][1];
                    quat[3] = 0.5 * Math.sqrt(s + 1.0);
                    let inv = 0.25 / quat[3];
                    quat[0] = inv * (ort[0][1] - ort[1][0]);
                    quat[1] = inv * (ort[0][2] + ort[2][0]);
                    quat[2] = inv * (ort[2][1] + ort[1][2]);
                }
            }
        }
        return quat;
    }

    static orthogonalizeMatrix(m, threshold) {
		let m0 = m[0];
		let m1 = m[1];
		let m2 = m[2];
		let x00 = m0[0];
		let x01 = m0[1];
		let x02 = m0[2];
		let x10 = m1[0];
		let x11 = m1[1];
		let x12 = m1[2];
		let x20 = m2[0];
		let x21 = m2[1];
		let x22 = m2[2];
		let fn = 0;
		let fn1;

		let o = [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
		let o0 = o[0];
		let o1 = o[1];
		let o2 = o[2];

		// iterative correction: Xn+1 = Xn - 0.5 * (Xn.Mt.Xn - M)
		let i = 0;
        let mx00;
        let mx10;
        let mx20;
        let mx01;
        let mx11;
        let mx21;
        let mx02;
        let mx12;
        let mx22;
        let corr00;
        let corr01;
        let corr02;
        let corr10;
        let corr11;
        let corr12;
        let corr20;
        let corr21;
        let corr22;
		while (++i < 11) {

			// Mt.Xn
			mx00 = m0[0] * x00 + m1[0] * x10 + m2[0] * x20;
			mx10 = m0[1] * x00 + m1[1] * x10 + m2[1] * x20;
			mx20 = m0[2] * x00 + m1[2] * x10 + m2[2] * x20;
			mx01 = m0[0] * x01 + m1[0] * x11 + m2[0] * x21;
			mx11 = m0[1] * x01 + m1[1] * x11 + m2[1] * x21;
			mx21 = m0[2] * x01 + m1[2] * x11 + m2[2] * x21;
			mx02 = m0[0] * x02 + m1[0] * x12 + m2[0] * x22;
			mx12 = m0[1] * x02 + m1[1] * x12 + m2[1] * x22;
			mx22 = m0[2] * x02 + m1[2] * x12 + m2[2] * x22;

			// Xn+1
			o0[0] = x00 - 0.5 * (x00 * mx00 + x01 * mx10 + x02 * mx20 - m0[0]);
			o0[1] = x01 - 0.5 * (x00 * mx01 + x01 * mx11 + x02 * mx21 - m0[1]);
			o0[2] = x02 - 0.5 * (x00 * mx02 + x01 * mx12 + x02 * mx22 - m0[2]);
			o1[0] = x10 - 0.5 * (x10 * mx00 + x11 * mx10 + x12 * mx20 - m1[0]);
			o1[1] = x11 - 0.5 * (x10 * mx01 + x11 * mx11 + x12 * mx21 - m1[1]);
			o1[2] = x12 - 0.5 * (x10 * mx02 + x11 * mx12 + x12 * mx22 - m1[2]);
			o2[0] = x20 - 0.5 * (x20 * mx00 + x21 * mx10 + x22 * mx20 - m2[0]);
			o2[1] = x21 - 0.5 * (x20 * mx01 + x21 * mx11 + x22 * mx21 - m2[1]);
			o2[2] = x22 - 0.5 * (x20 * mx02 + x21 * mx12 + x22 * mx22 - m2[2]);

			// correction on each elements
			corr00 = o0[0] - m0[0];
			corr01 = o0[1] - m0[1];
			corr02 = o0[2] - m0[2];
			corr10 = o1[0] - m1[0];
			corr11 = o1[1] - m1[1];
			corr12 = o1[2] - m1[2];
			corr20 = o2[0] - m2[0];
			corr21 = o2[1] - m2[1];
			corr22 = o2[2] - m2[2];

			// Frobenius norm of the correction
			fn1 = corr00 * corr00 + corr01 * corr01 + corr02 * corr02 +
					corr10 * corr10 + corr11 * corr11 + corr12 * corr12 +
					corr20 * corr20 + corr21 * corr21 + corr22 * corr22;

			// convergence test
			if (Math.abs(fn1 - fn) <= threshold) {
				return o;
			}

			// prepare next iteration
			x00 = o0[0];
			x01 = o0[1];
			x02 = o0[2];
			x10 = o1[0];
			x11 = o1[1];
			x12 = o1[2];
			x20 = o2[0];
			x21 = o2[1];
			x22 = o2[2];
			fn  = fn1;
		}
		
		throw new Exception("Failed to converge on orthogonal matrix after 10 iterations");
	}

    static slerp(amount, value1, value2)
	{
		
		if(isNaN(amount)) {
			return new MRotation(value1.q0, value1.q1, value1.q2, value1.q3);
		}
		if (amount < 0.0)
			return value1;
		else if (amount > 1.0)
			return value2;

		let dot = value1.dotProduct(value2);
		
		let x2 = value2.q1;
		let y2 = value2.q2;
		let z2 = value2.q3;
		let w2 = value2.q0;

		let t1, t2;

		let EPSILON = 0.0001;
		if ((1.0 - dot) > EPSILON) // standard case (slerp)
		{
			let angle = Math.acos(dot);
			let sinAngle = Math.sin(angle);
			t1 = Math.sin((1.0 - amount) * angle) / sinAngle;
			t2 = Math.sin(amount * angle) / sinAngle;
		}
		else // just lerp
		{
			t1 = 1.0 - amount;
			t2 = amount;
		}

		return new MRotation(
				(value1.q0 * t1) + (w2 * t2),
				(value1.q1 * t1) + (x2 * t2),
				(value1.q2 * t1) + (y2 * t2),
				(value1.q3 * t1) + (z2 * t2));
	}

    toArray() {
        return [this.q0,this.q1,this.q2,this.q3];
    }

    intoArray(into = [1,0,0,0]) {
        into[0] = this.q0;
        into[1] = this.q1;
        into[2] = this.q2;
        into[3] = this.q3;
        return into;
    }
    
}

// Helper function to convert radians to degrees, as JavaScript's Math object works in radians
Math.toDegrees = function(radians) {
    return radians * (180 / Math.PI);
};


export class Rot {	
    rotation = new MRotation(1,0,0,0);
	constructor(w, x, y, z, needsNormalization = false){
        if(x instanceof Rot) {
            throw Error("Use the static slerp method instead");
        }
        if (w == null) { 
		    this.rotation = new MRotation(
				MRotation.IDENTITY.q0, 
				MRotation.IDENTITY.q1, 
				MRotation.IDENTITY.q2, 
				MRotation.IDENTITY.q3, false);
        } else if(Number.isFinite(w)) {
            this.rotation = new MRotation(w, x, y, z, needsNormalization);
        } else if(w instanceof MRotation) {
            this.rotation.setFromComponents(w.q0, w.q1, w.q2, w.q3);
        } else if(w instanceof VVec || w instanceof Vec3) {
            if(Number.isFinite(x)) {
                this.rotation = MRotation.fromAxisAngle(w, x);
            } else {
                this.rotation = MRotation.fromVecs(w, x);
            }
        } else if(w instanceof Rot) {
            this.rotation = new MRotation(w.q0, w.q1, w.q2, w.q3, false);
        } else{
            throw new Error("Unrecognized cunstructor args");
        }
        this.workingInput = new Vec3();
	    this.workingOutput = new Vec3();
	};


    static fromAxisAngle(axis, angle) {
        const resultmrot = MRotation.fromAxisAngle(axis, angle);
        return new Rot(resultmrot); //.rotation.fromAxisAngle(axis, angle);
    }
	
	/**
	 * @return this rotation as an array of 4 numbers corresponding to the W (aka scalar), X, Y, and Z values in that order.
	 */
	 toArray() {
		return this.rotation.toArray();
	}

    intoArray(into) {
        return this.rotation.intoArray(into);
    }
	
	/**
	 * @param updates container to have values representing this rotation as an array of 4 numbers corresponding to the W (aka scalar), X, Y, and Z values in that order.
	 */
	setFromArray(container) {
		this.rotation.setFromArray(container);
	}

	copy() {
		return new Rot(new MRotation(rotation.q0, rotation.q1, rotation.q2, rotation.q3, false));
	}
	
	set(w, x, y, z) {
		if(Number.isFinite(w)) {
            this.rotation.q0 = w;
            this.rotation.q1 = x;
            this.rotation.q2 = y;
            this.rotation.q3 = z;
        } else if(w instanceof MRotation) {
            this.rotation.q0 = w.q0;
            this.rotation.q1 = x.q1;
            this.rotation.q2 = y.q2;
            this.rotation.q3 = z.q3;
        } else if(w instanceof VVec || w instanceof Vec3) {
            if(Number.isFinite(x)) {
                this.rotation.setFromAxisAngle(w, x);
            } else {
                this.rotation.setFromVecs(w, x);
            }
        } else if(w instanceof Rot) {
            this.rotation = new MRotation(w.q0, w.q1, w.q2, w.q3);
        } else{
            throw new Error("Unrecognized cunstructor args");
        }
	}


    applyTo(v, output) {
        console.warn("Deprecated overloadable function. Use applyToVec, applyToRay, applyToRot instead")
        if(output == null) {
            output = copy;
        }
        if(v instanceof VVec || v instanceof Vec3) {
            return this.applyToVec(v, output);
        } else if(v instanceof Ray) {
            return this.applytoRay()
        }
        return output;
    }
	
	applyToVec(v, output = new Vec3()) {        
		this.workingInput.x = v.x; this.workingInput.y = v.y; this.workingInput.z=v.z; 
		this.rotation.applyToVector(this.workingInput, output);
		return output;
	}

    

	applyInverseToVec(v, output = new Vec3()) {
		this.workingInput.x = v.x; this.workingInput.y = v.y; this.workingInput.z=v.z; 
		this.rotation.applyInverseToVector(this.workingInput, output);
        return output;
	}


	/**
	 * applies the rotation to a copy of the input vector
	 * @param v
	 * @return
	 */
	
	applyToVecCopy(v) {
		this.workingInput.x = v.x; this.workingInput.y = v.y; this.workingInput.z=v.z; 
		this.rotation.applyToVector(this.workingInput, this.workingOutput);		
		return this.workingOutput.copy();
	}


	applyInverseToVecCopy(v) {
		this.workingInput.x = v.x; this.workingInput.y = v.y; this.workingInput.z=v.z;  
		this.rotation.applyInverseToVector(this.workingInput, this.workingOutput);	
		return this.workingOutput.copy();
	}



	static getNormalized(r) {
		return new Rot(new MRotation(r.q0, r.q1, r.q2, r.q3, true));
	}

	applyToRay(rIn, rOut = rIn.copy()) {
		this.workingInput.x = rIn.p2.x - rIn.p1.x;
		this.workingInput.y = rIn.p2.y - rIn.p1.y; 
		this.workingInput.z = rIn.p2.z - rIn.p1.z;
		
		this.rotation.applyToVector(this.workingInput, this.workingOutput);
        rOut.setP1(rIn.p1);
		rOut.setHeading(this.workingOutput);
		return rOut;
	}

	applyInverseToRay(rIn, rOut = rIn.copy()) {
		this.workingInput.x = rIn.p2.x - rIn.p1.x;
		this.workingInput.y = rIn.p2.y - rIn.p1.y; 
		this.workingInput.z = rIn.p2.z - rIn.p1.z;		

		this.rotation.applyInverseToVector(this.workingInput, this.workingOutput);
		rOut.setP1(rIn.p1);
		rOut.setHeading(this.workingOutput);
		return rOut;
	}

    get q0() {
        return this.rotation.q0;
    }
    get q1() {
        return this.rotation.q1;
    }
    get q2() {
        return this.rotation.q2;
    }
    get q3() {
        return this.rotation.q3;
    }
	applyToRot(rot, storeIn) {                                                                            
		let rq0 = rot.q0, rq1 = rot.q1, rq2=rot.q2, rq3 = rot.q3;
        let trq0 = this.q0, trq1 = this.q1, trq2=this.q2, trq3 = this.q3; 
        if(storeIn == null) storeIn = new Rot();                                                                                              
		storeIn.rotation.q0 =  rq0 * trq0 -(rq1 * trq1 +  rq2 * trq2 + rq3 * trq3);   
		storeIn.rotation.q1 =  rq1 * trq0 + rq0 * trq1 + (rq2 * trq3 - rq3 * trq2);   
		storeIn.rotation.q2 =  rq2 * trq0 + rq0 * trq2 + (rq3 * trq1 - rq1 * trq3);   
		storeIn.rotation.q3 =  rq3 * trq0 + rq0 * trq3 + (rq1 * trq2 - rq2 * trq1);
        storeIn.rotation.normalize();
        return storeIn;                                                                                                                                                                                       
	}                                                             

	applyInverseTo(rot, storeIn) {                                                                                           
		let rq0 = rot.q0, rq1 = rot.q1, rq2=rot.q2, rq3 = rot.q3;
        let trq0 = this.q0, trq1 = this.q1, trq2=this.q2, trq3 = this.q3; 
        if(storeIn == null) storeIn = new Rot();                                                                       
		                                                                                       
		storeIn.rotation.q0 = -rq0 * trq0 -(rq1 * trq1 +  rq2 * trq2 + rq3 * trq3);    
		storeIn.rotation.q1 = -rq1 * trq0 + rq0 * trq1 + (rq2 * trq3 - rq3 * trq2);    
		storeIn.rotation.q2 = -rq2 * trq0 + rq0 * trq2 + (rq3 * trq1 - rq1 * trq3);    
		storeIn.rotation.q3 = -rq3 * trq0 + rq0 * trq3 + (rq1 * trq2 - rq2 * trq1);    
		storeIn.rotation.normalize(); 
        return storeIn;                                                                                                          
	}      

	
	getAngle() {
		return this.rotation.getAngle();  
	}

	getAxis() {
        let result = this.workingOutput.copy();
		this.getAxis(result);
		return result;
	}
	
	getAxis(output) {
		return this.rotation.getAxis(output);
	}


	revert() {
		let result = new Rot();
        return this.setToReversion(result);
	}
	/** 
	 * sets the values of the given rotation equal to the inverse of this rotation
	 * @param r the rotation object the reversion will be stored into
     * @return r
	 */
	setToReversion(r) {
		this.rotation.revertInto(r.rotation);
        return r;
	}

	/*
	 * interpolate between two rotations (SLERP)
	 * 
	 */
	static slerp(amount, r1, r2) {
		let rotation = MRotation.slerp(amount, v1.rotation, v2.rotation);
        return new Rot(rotation)
	}

	/** Get the swing rotation and twist rotation for the specified axis. The twist rotation represents the rotation around the
	 * specified axis. The swing rotation represents the rotation of the specified axis itself, which is the rotation around an
	 * axis perpendicular to the specified axis. The swing and twist rotation can be used to reconstruct the original
	 * quaternion: this = swing * twist
	 * 
	 * @param axisX the X component of the normalized axis for which to get the swing and twist rotation
	 * @param axisY the Y component of the normalized axis for which to get the swing and twist rotation
	 * @param axisZ the Z component of the normalized axis for which to get the swing and twist rotation
	 * @return an Array of Rot objects. With the first element representing the swing, and the second representing the twist
	 * @see <a href="http://www.euclideanspace.com/maths/geometry/rotations/for/decomposition">calculation</a> */
	getSwingTwist (axis) {
        let twistRot = this.rotation.copy();
		let resultRots = new Array(2);
        this.workingInput.setComponents(twistRot.q1, twistRot.q2, twistRot.q3);
		let d = this.workingInput.dot(axis);
		twistRot.set(twistRot.q0, axis.x * d, axis.y * d, axis.z * d, true);
		if (d < 0) twistRot.rotation.multiply(-1.0);
		
		let swing = new MRotation(twistRot);
		swing.setToConjugate();
		swing = MRotation.multiply(swing.rotation, this.rotation);
		
		resultRots[0] = new Rot(swing);
		resultRots[1] = new Rot(twistRot);
		return resultRots;
	}
	
	
	

	toString() {
		return this.rotation.toString();//"\n axis: "+ this.getAxis().toVec3f() +", \n angle: "+((float)Math.toDegrees(this.getAngle()));
	}
	
    toConsole() {
        console.log(this.toString());
    }

	equalTo(m) {
		return MRotation.distance(this.rotation, m.rotation) < Number.EPSILON;
	}
	
}