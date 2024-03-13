import { Vec3, any_Vec3, any_Vec3fv } from './vecs.js';

class QuaternionD {

	constructor( x = 0, y = 0, z = 0, w = 1 ) {

		this.isQuaternion = true;

		this._x = x;
		this._y = y;
		this._z = z;
		this._w = w;

	}

	get x() {

		return this._x;

	}

	set x( value ) {

		this._x = value;
		this._onChangeCallback();

	}

	get y() {

		return this._y;

	}

	set y( value ) {

		this._y = value;
		this._onChangeCallback();

	}

	get z() {

		return this._z;

	}

	set z( value ) {

		this._z = value;
		this._onChangeCallback();

	}

	get w() {

		return this._w;

	}

	set w( value ) {

		this._w = value;
		this._onChangeCallback();

	}

	set( x, y, z, w ) {

		this._x = x;
		this._y = y;
		this._z = z;
		this._w = w;

		this._onChangeCallback();

		return this;

	}

	clone() {

		return new this.constructor( this._x, this._y, this._z, this._w );

	}

	copy( quaternion ) {

		this._x = quaternion.x;
		this._y = quaternion.y;
		this._z = quaternion.z;
		this._w = quaternion.w;

		this._onChangeCallback();

		return this;

	}

	setFromEuler( euler, update = true ) {

		const x = euler._x, y = euler._y, z = euler._z, order = euler._order;

		// http://www.mathworks.com/matlabcentral/fileexchange/
		// 	20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/
		//	content/SpinCalc.m

		const cos = Math.cos;
		const sin = Math.sin;

		const c1 = cos( x / 2 );
		const c2 = cos( y / 2 );
		const c3 = cos( z / 2 );

		const s1 = sin( x / 2 );
		const s2 = sin( y / 2 );
		const s3 = sin( z / 2 );

		switch ( order ) {

			case 'XYZ':
				this._x = s1 * c2 * c3 + c1 * s2 * s3;
				this._y = c1 * s2 * c3 - s1 * c2 * s3;
				this._z = c1 * c2 * s3 + s1 * s2 * c3;
				this._w = c1 * c2 * c3 - s1 * s2 * s3;
				break;

			case 'YXZ':
				this._x = s1 * c2 * c3 + c1 * s2 * s3;
				this._y = c1 * s2 * c3 - s1 * c2 * s3;
				this._z = c1 * c2 * s3 - s1 * s2 * c3;
				this._w = c1 * c2 * c3 + s1 * s2 * s3;
				break;

			case 'ZXY':
				this._x = s1 * c2 * c3 - c1 * s2 * s3;
				this._y = c1 * s2 * c3 + s1 * c2 * s3;
				this._z = c1 * c2 * s3 + s1 * s2 * c3;
				this._w = c1 * c2 * c3 - s1 * s2 * s3;
				break;

			case 'ZYX':
				this._x = s1 * c2 * c3 - c1 * s2 * s3;
				this._y = c1 * s2 * c3 + s1 * c2 * s3;
				this._z = c1 * c2 * s3 - s1 * s2 * c3;
				this._w = c1 * c2 * c3 + s1 * s2 * s3;
				break;

			case 'YZX':
				this._x = s1 * c2 * c3 + c1 * s2 * s3;
				this._y = c1 * s2 * c3 + s1 * c2 * s3;
				this._z = c1 * c2 * s3 - s1 * s2 * c3;
				this._w = c1 * c2 * c3 - s1 * s2 * s3;
				break;

			case 'XZY':
				this._x = s1 * c2 * c3 - c1 * s2 * s3;
				this._y = c1 * s2 * c3 - s1 * c2 * s3;
				this._z = c1 * c2 * s3 + s1 * s2 * c3;
				this._w = c1 * c2 * c3 + s1 * s2 * s3;
				break;

			default:
				console.warn( 'THREE.Quaternion: .setFromEuler() encountered an unknown order: ' + order );

		}

		if ( update === true ) this._onChangeCallback();

		return this;

	}

	setFromAxisAngle( axis, angle ) {

		// http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm

		// assumes axis is normalized

		const halfAngle = angle / 2;
		const s = Math.sin( halfAngle );

		this._x = axis.x * s;
		this._y = axis.y * s;
		this._z = axis.z * s;
		this._w = Math.cos( halfAngle );

		this._onChangeCallback();

		return this;

	}

	setFromRotationMatrix( m ) {

		// http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm

		// assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

		const te = m.elements,

			m11 = te[ 0 ], m12 = te[ 4 ], m13 = te[ 8 ],
			m21 = te[ 1 ], m22 = te[ 5 ], m23 = te[ 9 ],
			m31 = te[ 2 ], m32 = te[ 6 ], m33 = te[ 10 ],

			trace = m11 + m22 + m33;

		if ( trace > 0 ) {

			const s = 0.5 / Math.sqrt( trace + 1.0 );

			this._w = 0.25 / s;
			this._x = ( m32 - m23 ) * s;
			this._y = ( m13 - m31 ) * s;
			this._z = ( m21 - m12 ) * s;

		} else if ( m11 > m22 && m11 > m33 ) {

			const s = 2.0 * Math.sqrt( 1.0 + m11 - m22 - m33 );

			this._w = ( m32 - m23 ) / s;
			this._x = 0.25 * s;
			this._y = ( m12 + m21 ) / s;
			this._z = ( m13 + m31 ) / s;

		} else if ( m22 > m33 ) {

			const s = 2.0 * Math.sqrt( 1.0 + m22 - m11 - m33 );

			this._w = ( m13 - m31 ) / s;
			this._x = ( m12 + m21 ) / s;
			this._y = 0.25 * s;
			this._z = ( m23 + m32 ) / s;

		} else {

			const s = 2.0 * Math.sqrt( 1.0 + m33 - m11 - m22 );

			this._w = ( m21 - m12 ) / s;
			this._x = ( m13 + m31 ) / s;
			this._y = ( m23 + m32 ) / s;
			this._z = 0.25 * s;

		}

		this._onChangeCallback();

		return this;

	}

	setFromUnitVectors( vFrom, vTo ) {

		// assumes direction vectors vFrom and vTo are normalized

		let r = vFrom.dot( vTo ) + 1;

		if ( r < Number.EPSILON ) {

			// vFrom and vTo point in opposite directions

			r = 0;

			if ( Math.abs( vFrom.x ) > Math.abs( vFrom.z ) ) {

				this._x = - vFrom.y;
				this._y = vFrom.x;
				this._z = 0;
				this._w = r;

			} else {

				this._x = 0;
				this._y = - vFrom.z;
				this._z = vFrom.y;
				this._w = r;

			}

		} else {

			// crossVectors( vFrom, vTo ); // inlined to avoid cyclic dependency on Vector3

			this._x = vFrom.y * vTo.z - vFrom.z * vTo.y;
			this._y = vFrom.z * vTo.x - vFrom.x * vTo.z;
			this._z = vFrom.x * vTo.y - vFrom.y * vTo.x;
			this._w = r;

		}

		return this.normalize();

	}

	angleTo( q ) {

		return 2 * Math.acos( Math.abs( this.clamp( this.dot( q ), - 1, 1 ) ) );

	}

	rotateTowards( q, step ) {

		const angle = this.angleTo( q );

		if ( angle === 0 ) return this;

		const t = Math.min( 1, step / angle );

		this.slerp( q, t );

		return this;

	}

	identity() {

		return this.set( 0, 0, 0, 1 );

	}

	invert() {

		// quaternion is assumed to have unit length

		return this.conjugate();

	}

	conjugate() {

		this._x *= - 1;
		this._y *= - 1;
		this._z *= - 1;

		this._onChangeCallback();

		return this;

	}

	dot( v ) {

		return this._x * v._x + this._y * v._y + this._z * v._z + this._w * v._w;

	}

	lengthSq() {

		return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;

	}

    clamp( value, min, max ) {

        return Math.max( min, Math.min( max, value ) );
    
    }

	length() {

		return Math.sqrt( this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w );

	}

	normalize() {

		let l = this.length();

		if ( l === 0 ) {

			this._x = 0;
			this._y = 0;
			this._z = 0;
			this._w = 1;

		} else {

			l = 1 / l;

			this._x = this._x * l;
			this._y = this._y * l;
			this._z = this._z * l;
			this._w = this._w * l;

		}

		this._onChangeCallback();

		return this;

	}

	multiply( q ) {

		return this.multiplyQuaternions( this, q );

	}

	premultiply( q ) {

		return this.multiplyQuaternions( q, this );

	}

	multiplyQuaternions( a, b ) {

		// from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm

		const qax = a._x, qay = a._y, qaz = a._z, qaw = a._w;
		const qbx = b._x, qby = b._y, qbz = b._z, qbw = b._w;

		this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
		this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
		this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
		this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

		this._onChangeCallback();

		return this;

	}

	slerp( qb, t ) {

		if ( t === 0 ) return this;
		if ( t === 1 ) return this.copy( qb );

		const x = this._x, y = this._y, z = this._z, w = this._w;

		// http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/

		let cosHalfTheta = w * qb._w + x * qb._x + y * qb._y + z * qb._z;

		if ( cosHalfTheta < 0 ) {

			this._w = - qb._w;
			this._x = - qb._x;
			this._y = - qb._y;
			this._z = - qb._z;

			cosHalfTheta = - cosHalfTheta;

		} else {

			this.copy( qb );

		}

		if ( cosHalfTheta >= 1.0 ) {

			this._w = w;
			this._x = x;
			this._y = y;
			this._z = z;

			return this;

		}

		const sqrSinHalfTheta = 1.0 - cosHalfTheta * cosHalfTheta;

		if ( sqrSinHalfTheta <= Number.EPSILON ) {

			const s = 1 - t;
			this._w = s * w + t * this._w;
			this._x = s * x + t * this._x;
			this._y = s * y + t * this._y;
			this._z = s * z + t * this._z;

			this.normalize(); // normalize calls _onChangeCallback()

			return this;

		}

		const sinHalfTheta = Math.sqrt( sqrSinHalfTheta );
		const halfTheta = Math.atan2( sinHalfTheta, cosHalfTheta );
		const ratioA = Math.sin( ( 1 - t ) * halfTheta ) / sinHalfTheta,
			ratioB = Math.sin( t * halfTheta ) / sinHalfTheta;

		this._w = ( w * ratioA + this._w * ratioB );
		this._x = ( x * ratioA + this._x * ratioB );
		this._y = ( y * ratioA + this._y * ratioB );
		this._z = ( z * ratioA + this._z * ratioB );

		this._onChangeCallback();

		return this;

	}

	slerpQuaternions( qa, qb, t ) {

		return this.copy( qa ).slerp( qb, t );

	}

	random() {

		// sets this quaternion to a uniform random unit quaternnion

		// Ken Shoemake
		// Uniform random rotations
		// D. Kirk, editor, Graphics Gems III, pages 124-132. Academic Press, New York, 1992.

		const theta1 = 2 * Math.PI * Math.random();
		const theta2 = 2 * Math.PI * Math.random();

		const x0 = Math.random();
		const r1 = Math.sqrt( 1 - x0 );
		const r2 = Math.sqrt( x0 );

		return this.set(
			r1 * Math.sin( theta1 ),
			r1 * Math.cos( theta1 ),
			r2 * Math.sin( theta2 ),
			r2 * Math.cos( theta2 ),
		);

	}

	equals( quaternion ) {

		return ( quaternion._x === this._x ) && ( quaternion._y === this._y ) && ( quaternion._z === this._z ) && ( quaternion._w === this._w );

	}

	fromArray( array, offset = 0 ) {

		this._x = array[ offset ];
		this._y = array[ offset + 1 ];
		this._z = array[ offset + 2 ];
		this._w = array[ offset + 3 ];

		this._onChangeCallback();

		return this;

	}

	toArray( array = [], offset = 0 ) {

		array[ offset ] = this._x;
		array[ offset + 1 ] = this._y;
		array[ offset + 2 ] = this._z;
		array[ offset + 3 ] = this._w;

		return array;

	}

	fromBufferAttribute( attribute, index ) {

		this._x = attribute.getX( index );
		this._y = attribute.getY( index );
		this._z = attribute.getZ( index );
		this._w = attribute.getW( index );

		this._onChangeCallback();

		return this;

	}

	toJSON() {

		return this.toArray();

	}

	_onChange( callback ) {

		this._onChangeCallback = callback;

		return this;

	}

	_onChangeCallback() {}

	*[ Symbol.iterator ]() {

		yield this._x;
		yield this._y;
		yield this._z;
		yield this._w;

	}

}


export class Rot extends QuaternionD {
    static IDENTITY = null; //defined at bottom
    constructor(x, y, z, w, needsNormalization = false) {
        super(x, y, z, w);
        if (needsNormalization) this.normalize();
        this.workingInput = new Vec3();
        this.workingOutput = new Vec3();
    };

    static fromRot(r) {
        return new Rot(
			r._x, 
			r._y, 
			r._z, 
			r._w);
    }

    static fromAxisAngle(axis, angle) {
        const resultmrot = new Rot(0, 0, 0, 1).setFromAxisAngle(axis.normalize(), angle);
        return resultmrot; //.rotation.fromAxisAngle(axis, angle);
    }

    static fromVecs(u, v) {
        return new Rot(0, 0, 0, 1).setFromVecs(u, v);
    }

    setFromVecs(u, v) {
        if (u.magSq() < Number.EPSILON || v.magSq() < Number.EPSILON) {
            return this.set(0, 0, 0, 1);
        }
        this.setFromUnitVectors(any_Vec3fv(u).normalize(), any_Vec3fv(v).normalize())
        return this;
    }


    clone() {
        return new Rot(this._x, this._y, this._z, this._w, false);
    }

    setComponents(x, y, z, w, normalize) {
        this._w = w;
        this._x = x;
        this._y = y;
        this._z = z;
		if(normalize) this.normalize();

        return;
    }

    set(x, y, z, w) {
        this._w = w;
        this._x = x;
        this._y = y;
        this._z = z;
        return this;
    }

    setFromRot(inR) {
        this._w = inR._w;
        this._x = inR._x;
        this._y = inR._y;
        this._z = inR._z;
        return this;
    }


    /**
     * stores the result of applying the rotation to the input vector in the provided output vector.
     * if none is given, one will be created or taken from the environment's ephemeral vector pool.
     * @param v
     * @return the rotated vector.
     */

    applyToVec(v, output = any_Vec3()) {
        this.applyToVector(v, output);
        return output;
    }

    /**
     * applies the rotation to an explicit clone of the input vector
     * @param v
     * @return
     */

    applyToVecClone(v) {
        this.applyToVector(any_Vec3(v.x, v.y, v.z), this.workingOutput);
        return this.workingOutput.clone();
    }

    applyToVector(v, vout) {
        const vx = v.x, vy = v.y, vz = v.z;
        const qx = this.x, qy = this.y, qz = this.z, qw = this.w;

        const tx = (2 * (qy * vz - qz * vy));
        const ty = (2 * (qz * vx - qx * vz));
        const tz = (2 * (qx * vy - qy * vx));

        vout.x = vx + qw * tx + qy * tz - qz * ty;
        vout.y = vy + qw * ty + qz * tx - qx * tz;
        vout.z = vz + qw * tz + qx * ty - qy * tx;
        return v;
    }

    applyInverseToVecClone(v) {
        this.applyInverseToVec(any_Vec3(v.x, v.y, v.z), this.workingOutput);
        return this.workingOutput.clone();
    }


    applyToRay(rIn, rOut = rIn.clone()) {
        this.workingInput.x = rIn.p2.x - rIn.p1.x;
        this.workingInput.y = rIn.p2.y - rIn.p1.y;
        this.workingInput.z = rIn.p2.z - rIn.p1.z;

        this.applyToVector(this.workingInput, this.workingOutput);
        rOut.setP1(rIn.p1);
        rOut.setHeading(this.workingOutput);
        return rOut;
    }

    applyInverseToRay(rIn, rOut = rIn.clone()) {
        this.workingInput.x = rIn.p2.x - rIn.p1.x;
        this.workingInput.y = rIn.p2.y - rIn.p1.y;
        this.workingInput.z = rIn.p2.z - rIn.p1.z;

        this.applyInverseToVector(this.workingInput, this.workingOutput);
        rOut.setP1(rIn.p1);
        rOut.setHeading(this.workingOutput);
        return rOut;
    }

    set q0(w) {
        this.w = w;
    }

    set q1(x) {
        this.x = x;
    }

    set q2(y) {
        this.y = y;
    }

    set q3(z) {
        this.z = z;
    }

    get q0() {
        return this.w;
    }
    get q1() {
        return this.x;
    }
    get q2() {
        return this.y;
    }
    get q3() {
        return this.z;
    }


    clampToAngle(angle) {
        let cosHalfAngle = Math.cos(0.5 * angle);
        this.clampToCosHalfAngle(cosHalfAngle);
    }

    clampToCosHalfAngle(cosHalfAngle) {
        let newCoeff = 1 - (cosHalfAngle * Math.abs(cosHalfAngle));
        let currentCoeff = this.q1 * this.q1 + this.q2 * this.q2 + this.q3 * this.q3;
        if (newCoeff >= currentCoeff)
            return;
        else {
            this.q0 = this.q0 < 0 ? -cosHalfAngle : cosHalfAngle;
            let compositeCoeff = Math.sqrt(newCoeff / currentCoeff);
            this.q1 *= compositeCoeff;
            this.q2 *= compositeCoeff;
            this.q3 *= compositeCoeff;
        }
    }
    applyToRot(rot, storeIn = Rot.IDENTITY.clone()) {
        return storeIn.multiplyQuaternions(this, rot);
    }

    applyInverseToRot(rot, storeIn = Rot.IDENTITY.clone()) {
        this._x *= -1, this._y *= -1, this._z *= -1;
        storeIn.multiplyQuaternions(this, rot);
        this._x *= -1, this._y *= -1, this._z *= -1;
        return storeIn;
    }

    /**
     * returns the rotation which, if applied to this orientation, would bring this orientation to the target
     * orientation by the shortest path.
     * 
     * in other words this.rotationTo(target).applyToRot(this) == target
    */
    getRotationTo(target, storeIn = Rot.IDENTITY.clone()) {
        const qax = target._x, qay = target._y, qaz = target._z, qaw = target._w;
		const qbx = -this._x, qby = -this._y, qbz = -this._z, qbw = this._w; // conjugate of this quaternion

		storeIn._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
		storeIn._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
		storeIn._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
		storeIn._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

        //inlined the math to avoid the object instantiation required by target.multiply(this.conjugate())
        return storeIn;
    }

    /**return the other rotation, from the other way.*/
    getFlipped() {
        return new Rot(-this._x, -this._y, -this._z, -this._w);
    }

    getAngle() {
        return Rot.IDENTITY.angleTo(this);
    }

    /**@return {Vec3} */
    getAxis() {
        let x, y, z;
        const s = Math.sqrt(1 - this.w * this.w); // assuming quaternion normalised then w is less than 1, so term always positive.
        if (s < 0.001) { // test to avoid divide by zero, s is always positive due to sqrt
            // if s close to zero then direction of axis not important
            x = this.x; // if it is important that axis is normalised then replace with x=1; y=z=0;
            y = this.y;
            z = this.z;
        } else {
            x = this.x / s; // normalise axis
            y = this.y / s;
            z = this.z / s;
        }
        return any_Vec3(x, y, z);
    }

    /**
     * sets the values of the given Rot to the inverse of this rot
     * @param {Rot} storeIn the Rot to store the inverse in
     * @return the provides Rot, with the values set to the inverse of this Rot.
     */
    invertInto(storeIn = Rot.IDENTITY.clone()) {
        storeIn.w = this._w;
        storeIn.x = -this._x;
        storeIn.y = -this._y;
        storeIn.z = -this._z;
        return storeIn;
    }
    /**
     * Returns the inverse of this Rot.
     * @return returns a new Rot which is the inverse of this Rot. 
     */
    inverted() {
        new Rot(-this._x, -this._y, -this._z, this._w);
    }

    /**
     * A negative inverse is the one which will yield the negative identity upon composition with this Rot
     * @return returns a new Rot which is the negative-inverse of this Rot. 
     */
    reverted() {
        let result = Rot.IDENTITY.clone();
        return this.revertInto(result);
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
    getSwingTwist(axis) {
        let twistRot = this.clone();
        let resultRots = new Array(2);
        this.workingInput.setComponents(twistRot.q1, twistRot.q2, twistRot.q3);
        let d = this.workingInput.dot(axis);
        twistRot.set(twistRot.q0, axis.x * d, axis.y * d, axis.z * d, true);
        if (d < 0) twistRot.getFlipped();

        let swing = twistRot.inverted();
        swing = swing.multiply(this);

        resultRots[0] = new Rot(swing);
        resultRots[1] = new Rot(twistRot);
        return resultRots;
    }


    static nlerp(r1, r2, t) {
        return new Rot(
            ((r1.q0 - r2.q0) * t) + r2.q0,
            ((r1.q1 - r2.q1) * t) + r2.q1,
            ((r1.q2 - r2.q2) * t) + r2.q2,
            ((r1.q3 - r2.q3) * t) + r2.q3,
            true
        )
    }

    toString(asQ = Rot.showQ, showAxAng = Rot.showAxAng) {
        const axis = this.getAxis();
        const angleDegrees = Math.toDegrees(this.getAngle());
        let strAA = `Axis: (${axis.toString()}), AngleDeg: ${angleDegrees.toFixed(2)}`;
        let stQQ = `xyz # w : { ${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)} # ${this.w.toFixed(3)}`;
        let combined = showAxAng ? (strAA + (asQ ? `
        ${stQQ}` : '')) : stQQ;
        return combined;
    }

    toStr(asQ = Rot.showQ, showAxAng = Rot.showAxAng) {
        return this.toString(asQ, showAxAng);//"\n axis: "+ this.getAxis().toVec3f() +", \n angle: "+((float)Math.toDegrees(this.getAngle()));
    }

    getAngleGlyph() {
        let angle = Math.toDegrees(this.getAngle());
        if (angle < 0) angle += 360;

        const glyphs = [
            { threshold: 22.5, symbol: '↑' }, // 0 degrees
            { threshold: 67.5, symbol: '↗' }, // 45 degrees
            { threshold: 112.5, symbol: '→' }, // 90 degrees
            { threshold: 157.5, symbol: '↘' }, // 135 degrees
            { threshold: 202.5, symbol: '↓' }, // 180 degrees
            { threshold: 247.5, symbol: '↙' }, // 225 degrees
            { threshold: 292.5, symbol: '←' }, // 270 degrees
            { threshold: 337.5, symbol: '↖' }, // 315 degrees
            { threshold: 360, symbol: '↑' }  // Back to 0 degrees
        ];
        let gf = glyphs.find(g => angle <= g.threshold);
        return gf.symbol;
    }

    toConsole(asQ = Rot.showQ, showAxAng = Rot.showAxAng) {
        if (asQ)
            console.log(this.toString(true, false));
        if (showAxAng) {
            const glyph = this.getAngleGlyph();
            let angle = this.getAngle();

            console.log(`%c● %c ${glyph} %c${this.toString(false, true)}`, `${this.getAxis().asConsoleString(1).style}; font-size: 2em`, `font-size: 2em; margin-left: -14px;`, `font-size: 1em;`);
        }
    }

    toCons(asQ = Rot.showQ, showAxAng = Rot.showAxAng) {
        console.log(this.toString(asQ, showAxAng));
    }

    equalTo(m) {
        return this.getRotationTo(m).getAngle() < Number.EPSILON;
    }
    static showColors = true;
    static showQ = false;
    static showAxAng = true;
}

class RotIdentity extends Rot {
    final = false;
    constructor() {super(0,0,0,1); this.final=true;}
    
    clone() {return new Rot(0,0,0,1);}
    get x() {return 0;}
    get y() {return 0;}
    get z() {return 0;}
    get w() { return 1;}
    get _x() {return 0;}
    get _y() {return 0;}
    get _z() {return 0;}
    get _w() { return 1;}
    /**
     * @param {number} val
     */
    set x(val) {throw new Error("Don't touch me.");};
    /**
     * @param {number} val
     */
    set y(val) {throw new Error("Don't touch me.");};
    /**
     * @param {number} val
     */
    set z(val) {throw new Error("Don't touch me.");};
    /**
     * @param {number} val
     */
    set w(val) {throw new Error("Don't touch me.");};
    /**
     * @param {number} val
     */
    set _x(val) {if(this.final)throw new Error("I said don't fn touch me!");};
    /**
     * @param {number} val
     */
    set _y(val) {if(this.final)throw new Error("I said don't fn touch me!");};
    /**
     * @param {number} val
     */
    set _z(val) {if(this.final)throw new Error("I said don't fn touch me!");};
    /**
     * @param {number} val
     */
    set _w(val) {if(this.final)throw new Error("I said don't fn touch me!");};
}
Rot.IDENTITY = new RotIdentity(0, 0, 0, 1);
Rot.IDENTITY.final = true;

Math.toDegrees = function (radians) {
    return radians * (180 / Math.PI);
};
