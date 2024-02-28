export class VecN {
    constructor(components, type) {
        this.type = type;
        if(type == null) {         
            this.components = [...components];
        } else if (type === 64) {
            this.components = new Float64Array(components);
        } else if (type === 32) {
            this.components = new Float32Array(components);
        } else {
            throw new Error('Unsupported type. Only 32 and 64 are valid.');
        }
        this.dims = components.length;
    }

    /**
     * @param {Instanceof _VecN or Array} vec 
     * @return this vector for chaining
     */
    set(vec) {
        if(vec.components.length == this.dims) {
            return this.setComponents(...vec.components);
        }
    }

    setComponents(...components) {
        if(components.length == this.dims) {
            for(let i = 0; i<components.length; i++) {
                this.components[i] = components[i];
            }
        }
        return this;
    }

    /** writes thes components of this vector into the given array. If no aray is given, one will be created and returned**/
    intoArray( into = new Array(this.dims)) {
        for(let i =0; i<this.components.length; i++) {
            into[i] = this.components[i];
        }
        return into;
    }

    static extractInputComponents(vec) {
        if (vec instanceof VecN) return vec.components;
        else if (Array.isArray(vec)) return vec;
        else throw Error('Unsupported vector format');        
    }

    mag() {
        return Math.sqrt(this.components.reduce((acc, val) => acc + val * val, 0));
    }

    magSq() {
        return this.components.reduce((acc, val) => acc + val * val, 0);
    }

    mulAdd(vec, scalar) {
        for(let i=0; i<vec.components.length; i++ ) {
            this.components[i] += vec.components[i] * scalar;
        }
    }

    limit(limit) {
        const magnitude = this.mag();
        if (magnitude > limit) {
            this.mult(limit / magnitude);
        }
        return this;
    }

    limitSq(limitSq) {
        const magnitudeSq = this.magSq();
        if (magnitudeSq > limitSq) {
            this.mult(Math.sqrt(limitSq / magnitudeSq));
        }
        return this;
    }

    setMag(length) {
        const magnitude = this.mag();
        if (magnitude !== 0) {
            this.mult(length / magnitude);
        }
        return this;
    }

    setMagSq(lengthSq) {
        const magnitudeSq = this.magSq();
        if (magnitudeSq !== 0) {
            this.mult(Math.sqrt(lengthSq / magnitudeSq));
        }
        return this;
    }

    clamp(min, max) {
        const magnitude = this.mag();
        if (magnitude < min) {
            this.setMag(min);
        } else if (magnitude > max) {
            this.setMag(max);
        }
        return this;
    }

    dot(v) {
        const maxLength = Math.max(this.dims, v.dims);
        let sum = 0;
        for (let i = 0; i < maxLength; i++) {
            const val1 = i < this.dims ? this.components[i] : 0;
            const val2 = i < v.dims ? v.components[i] : 0;
            sum += val1 * val2;
        }
        return sum;
    }    

    div(n) {
        for (let i = 0; i < this.dims; i++) {
            this.components[i] /= n;
        }
        return this;
    }

    divCopy(scalar) {
        let result = this.copy();
        result.div(scalar);
        return result; 
    }

    mult(scalar) {
        for (let i = 0; i < this.dims; i++) {
            this.components[i] *= scalar;
        }
        return this;
    }

    multCopy(scalar) {
        let result = this.copy();
        result.mult(scalar);
        return result;
    }

    dist(v) {
        if (this.dims !== v.dims) throw new Error('Vector dimensions must match');
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            let diff = this.components[i] - v.components[i];
            sumSq += diff * diff;
        }
        return Math.sqrt(sumSq);
    }

    distSq(v) {
        if (this.dims !== v.dims) throw new Error('Vector dimensions must match');
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            let diff = this.components[i] - v.components[i];
            sumSq += diff * diff;
        }
        return sumSq;
    }

    lerp(target, alpha) {
        for (let i = 0; i < this.dims; i++) {
            this.components[i] += (target.components[i] - this.components[i]) * alpha;
        }
        return this;
    }

    copy() {
        return new _VecN(this.components, this.components instanceof Float32Array ? 32 : 64);
    }

    add(v) {
        if (this.dims !== v.dims) throw new Error('Vector dimensions must match');
        for (let i = 0; i < this.dims; i++) {
            this.components[i] += v.components[i];
        }
        return this;
    }

    addCopy(v) {
        let result = this.copy();
        result.add(v);
        return result;
    }

    sub(v) {
        if (this.dims !== v.dims) throw new Error('Vector dimensions must match');
        for (let i = 0; i < this.dims; i++) {
            this.components[i] -= v.components[i];
        }
        return this;
    }

    subCopy(v) {
        let result = this.copy();
        result.sub(v);
        return result;
    }

    normalize() {
        const magnitude = this.mag();
        if (magnitude !== 0) {
            this.div(magnitude);
        }
        return this;
    }
    
    extractInputComponents(vec) {
        if (vec instanceof VecN) return vec.components;
        else if (Array.isArray(vec)) return vec;
        else throw Error('Unsupported vector format');        
    }
}


/**untyped vec2, use for any frequent instantiatons, as its faster to create than floatbuffer*/
export class Vec2 extends VecN {
    constructor(maybevec = [0,0], type=null) {
        super(maybevec.components ?? maybevec, type);
    }

    get x() { return this.components[0]; }
    set x(value) { this.components[0] = value; }

    get y() { return this.components[1]; }
    set y(value) { this.components[1] = value; }

    copy() {
        return new this.constructor(this.components, this.type);
    }

}

/**untyped vec3, use for any frequent instantiatons, as its faster to create than floatbuffer*/
export class Vec3 extends VecN {
    constructor(maybevec = [0,0,0], type=null) {
        super(maybevec.components ?? maybevec, type);
    }

    get x() { return this.components[0]; }
    set x(value) { this.components[0] = value; }

    get y() { return this.components[1]; }
    set y(value) { this.components[1] = value; }

    get z() { return this.components[2]; }
    set z(value) { this.components[2] = value; }
    
    /** Sets the components from the given spherical coordinate
	 * @param azimuthalAngle The angle between x-axis in radians [0, 2pi]
	 * @param polarAngle The angle between z-axis in radians [0, pi]
	 * @return This vector for chaining */
	setFromSpherical (azimuthalAngle, polarAngle) {
		let cosPolar = Math.cos(polarAngle);
		let sinPolar = Math.sin(polarAngle);

		let cosAzim = Math.cos(azimuthalAngle);
		let sinAzim = Math.sin(azimuthalAngle);

		return this.setComponents(cosAzim * sinPolar, sinAzim * sinPolar, cosPolar);
	}

    /**takes this this.cross input and returns the result as a new vector*/
    crossCopy(input) {
        let newVec = this.copy();
        newVec.setComponents(
            this.y * input.z - this.z * input.y, 
            this.z * input.x - this.x * input.z, 
            this.x * input.y - this.y * input.x
        );
        return newVec;
    }

    copy() {
        return new this.constructor(this.components, this.type);
    }

    toString() {
        let s = '('
        let comps = []
        for(let c of this.components) {
            comps.push(c.toFixed(4));
        }
        return '('+comps.join(", ")+')';
    }
    toConsole() {
        console.log(this.toString());
    }

    getOrthogonal() {
        const {x, y, z} = this;
		let result = this.copy();				
		result.setComponents(0,0,0);
		let threshold = this.mag() * 0.6;
		if(threshold > 0) {
			if (Math.abs(x) <= threshold) {
				let inverse  = 1 / Math.sqrt(y * y + z * z);
				return result.setComponents(0, inverse * z, -inverse * y);
			} else if (Math.abs(y) <= threshold) {
				let inverse  = 1 / Math.sqrt(x * x + z * z);
				return result.set(-inverse * z, 0, inverse * x);
			}
			let inverse  = 1 / Math.sqrt(x * x + y * y);
			return result.setComponents(inverse * y, -inverse * x, 0);
		}

		return result; 
	}
}


/**untyped vec4, use for any frequent instantiatons, as its faster to create than floatbuffer*/
export class Vec4 extends VecN {
    constructor(maybevec = [1, 0,0,0], type=null) {
        super(maybevec.components ?? maybevec, type);
    }

    get w() { return this.components[0]; }
    set w(value) { this.components[0] = value; }

    get x() { return this.components[1]; }
    set x(value) { this.components[1] = value; }

    get y() { return this.components[2]; }
    set y(value) { this.components[2] = value; }

    get z() { return this.components[3]; }
    set z(value) { this.components[3] = value; }

    copy() {
        return new this.constructor(this.components, this.type);
    }
    
}

export class Vec4d extends Vec4 {
    constructor(w=1, x=0, y=0, z=0) {
        super([w, x, y, z], 64);
    }

    copy() {
        return new this.constructor(...this.components, this.type);
    }
}

export class Vec4f extends Vec4 {
    constructor(w=1, x=0, y=0, z=0) {
        super([w, x, y, z], 32);
    }

    copy() {
        return new this.constructor(...this.components);
    }
}

export class Vec3d extends Vec3 {
    constructor(x=0, y=0, z=0) {
        super([x, y, z], 64);
    }

    copy() {
        return new this.constructor(...this.components);
    }
}

export class Vec3f extends Vec3 {
    constructor(x=0, y=0, z=0) {
        super([x, y, z], 32);
    }

    copy() {
        return new this.constructor(...this.components);
    }
}

export class Vec2d extends Vec2 {
    constructor(x=0, y=0) {
        super([x=0, y=0], 64);
    }

    copy() {
        return new this.constructor(...this.components);
    }
}

export class Vec2f extends Vec2 {
    constructor(x=0, y=0) {
        super([x=0, y=0], 32);
    }

    copy() {
        return new this.constructor(...this.components);
    }
}