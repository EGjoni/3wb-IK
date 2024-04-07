
/**behaves as a general typeless javascript array up until the finalize() method is called,
 * after which, resolves into a fix sized array of the provided type for efficiency.
 * 
 * This entire class might be totally useless depending on the optimizations provided by your js environment. 
 */
class FlexFreezeArray {
    constructor() {
        this.array = [];
        this.finalizedArray = null;
    }

    //add elements to the array
    push(elements) {
        if (this.finalizedArray) {
            throw new Error('Cannot add elements after finalization');
        }
        this.array.push(...elements);
    }

    /** Finalize method converts the array into a typed array of the specified type
     * . type values can be:
     *  -8 : signed int8Array,
     *   8 : unsigned int8Array,
     *   32: Float32Array,
     *   64: Float64Array
     * */
    finalize(type) {
        if (this.finalizedArray) {
            throw new Error('Array has already been finalized');
        }
        switch (type) {
            case -8:
                this.finalizedArray = new Int8Array(this.array);
                break;
            case 8:
                this.finalizedArray = new Uint8Array(this.array);
                break;
            case 32:
                this.finalizedArray = new Float32Array(this.array);
                break;
            case 64:
                this.finalizedArray = new Float64Array(this.array);
                break;
            default:
                throw new Error('Unsupported type');
        }
        this.array = null;
        return this.finalizedArray;
    }

    //get the element at the given index or the finalized or unfinalized array
    get(index) {
        if (!this.finalizedArray) {
            return this.array[index];
        }
        return this.finalizedArray[index];
    }

    /**
     * set the element at the given index or the finalized or unfinalized array
     * @param {Integer} index 
     * @param {Float} value 
     * @returns 
     */
    set(index, value) {
        if (!this.finalizedArray) {
            return this.array[index] = value;
        }
        return this.finalizedArray[index] = value;
    }
}

/**virtual vector. Really just points to entries in a backing VectorNArray from which it was generated*/
export class VVec {
    constructor(idx, length, came_from) {
        this.idx = idx; 
        this.length = length;
        this.came_from = came_from;
        let offs = length == 4 ? 1 : 0;
        this.widx = offs == 0 ? null : 0; 
        this.xidx = 0 + offs;
        this.yidx = 1 + offs;
        this.zidx = length >= 3 ? 2 + offs : null;
    }

    getVectorComponent(index, component) {
        if (component >= 0 && component < this.dims) {
            return this.flexibleArray.get(index * this.dims + component);
        } else {
            throw new Error(`Component out of bounds. Expected between 0 and ${this.dims - 1}`);
        }
    }

    set(components) {
        this.came_from.set(this.idx, components);
    }
    get w() {
        return this.came_from.flexibleArray.get(this.idx + this.widx); 
    }

    get x() {
        return this.came_from.flexibleArray.get(this.idx + this.xidx); 
    }

    get y() {
        return this.came_from.flexibleArray.get(this.idx + this.yidx); 
    }

    get z() {
        return this.came_from.flexibleArray.get(this.idx + this.zidx); 
    }

    set w(val) {
        this.came_from.flexibleArray.set(this.idx + this.widx, val);
    }     
    set x(val) {
        this.came_from.flexibleArray.set(this.idx + this.xidx, val);
    } 
    set y(val) {
        this.came_from.flexibleArray.set(this.idx + this.yidx, val);
    } 
    set z(val) {
        this.came_from.flexibleArray.set(this.idx + this.zidx, val);
    } 

    // get the magnitude of this vector
    mag() {
        return this.came_from.mag(this.idx);
    }

    // get the squared magnitude of this vector
    magSq() {
        return this.came_from.magSq(this.idx);
    }

    // Normalize this vector, returns the normalized vector for chainging
    normalize() {
        this.came_from.normalize(this.idx);
        return this;
    }

    // Add vec to this vector in place. Returns this vector for chaining
    add(vec) {
        this.came_from.add(this.idx, vec);
        return this;
    }

    // Add veec to a copy of this vec and return the copy
    addClone(vec) {
        return this.came_from.getVector(this.idx, true).add(vec);
    }

    // Subtract vec from this vector, returns this vector for chaining
    sub(vec) {
        this.came_from.add(this.idx, vec);
        return this;
    }

    // subtract vec from a copy of this vec and return the copy
    subClone(vec) {
        return this.came_from.getVector(this.idx, true).sub(vec);
    }

    // Multiplies this vector by the given scalar. Returns this vector for chaining
    mult(scalar) {
        this.came_from.mult(this.idx, scalar);
        return this;
    }

    // Multiplies a copy of this vec by the given scalar and return the copy
    multClone(scalar) {
        return this.came_from.getVector(this.idx, true).mult(scalar);
    }

    // Divides this vector by the given scalar. Returns this vector for chaining
    div(scalar) {
        this.came_from.div(this.idx, scalar);
        return this;
    }

    // divides a copy of this vec and return the copy
    divClone(vec) {
        return this.came_from.getVector(this.idx, true).div(vec);
    }


    // Limit the magnitude of this vector to the given length. returns this vector for chaining
    limit(limit) {
        this.came_from.limit(this.idx, limit);
        return this;
    }

    // Limit the squared magnitude of this vector to the given length. returns this vector for chaining
    limitSq(limitSq) {
        this.came_from.limitSq(this.idx, limitSq);
        return this;
    }

    // Sets the magnitude of this vector to the given length. returns this vector for chaining
    setMag(len) {
        this.came_from.setMag(this.idx, len);
        return this;
    }

    // Sets the squared magnitude of this vector to the given length. returns this vector for chaining
    setMagSq(lenSq) {
        this.came_from.setMag(this.idx, lenSq);
        return this;
    }

    // Clamp the magnitude of this vector between min and max, returns this vector for chaining
    clamp(min, max) {
        this.came_from.clamp(this.idx, min, max);
        return this;
    }
    
    // returns Dot product of this vector and the given vec
    dot(vec) {        
        return this.came_from.dot(this.idx,vec);
    }

    // Returns distance between this vector and the given vec
    dist(vec) {
        return this.came_from.dot(this.idx, vec);
    }

    // Returns distance squared between this vector and the given vec
    distSq(vec) {
        return this.came_from.distSq(this.idx, vec);
    }

    // sets this vector to the Linear interpolation between this vector and the given target by the current alpha. returns this vector for chainging. 
    lerp(target, alpha) {
        this.came_from.lerp(this.idx, target, alpha);
        return this; 
    }
}
  

export class VectorNArray {
    constructor(dims = 3, type=64) {
        this.flexibleArray = new FlexFreezeArray();
        this.dims = dims;
        this.type = type;
        this.elems = 0;
        this.usedComponents = 0;
    }

    /**accepts only one input vector or array of components at a time, will return VVec object correspending 
     * to the inputs. The VVec object can be used as a regular vector and it will write into and read from the float32Array containing it.
    */
    push1(vec) {
        if (this.flexibleArray.finalizedArray) {
            throw new Error('Cannot add elements after finalization');
        }
        if (vec instanceof VecN && vec.dims === this.dims) {
            this.flexibleArray.push(vec.components);
            this.elems++;
            let result = new VVec(this.usedComponents, vec.components.length)
            this.usedComponents += vec.dims;
            return result;
        } else if (Array.isArray(vec) && vec.length === this.dims) {
            this.flexibleArray.push(vec);
            this.elems++; 
            this.usedComponents += vec.length;
            let result = new VVec(this.usedComponents, vec.components.length);
            return result;
        } else {
            throw new Error(`Unsupported vector format or incorrect dimensions. Expected dimension: ${this.dims}`);
        }
    }

    finalize(type = this.type) {
        this.flexibleArray.finalize(type);
    }

    /**returns the virtual vector  corresponding to the provided index int this vector array. If clone is true, creates a copy
     * of the vector and returns it as a real non-virtual vector
    */
    getVector(index, clone = false) {
        let baseIndex = this.dims*index;
        if(!clone) return new VVec(baseIndex, this.dims, this);        
        switch (this.dims) {
            case 2: return new Vec2([this.flexibleArray.get(baseIndex), 
                                    this.flexibleArray.get(baseIndex + 1)]); break;
            case 3: return new Vec3([this.flexibleArray.get(baseIndex), 
                                    this.flexibleArray.get(baseIndex + 1), 
                                    this.flexibleArray.get(baseIndex + 2)]); break;
            case 4: return new Vec4([this.flexibleArray.get(baseIndex), 
                                    this.flexibleArray.get(baseIndex + 1), 
                                    this.flexibleArray.get(baseIndex + 2), 
                                    this.flexibleArray.get(baseIndex + 3)]); break;
            default: return new VecN([...Array(this.dims).keys()].map(i => this.flexibleArray.get(baseIndex + i)));
        }
    }

    getVectorComponent(index, component) {
        if (component >= 0 && component < this.dims) {
            return this.flexibleArray.get(index * this.dims + component);
        } else {
            throw new Error(`Component out of bounds. Expected between 0 and ${this.dims - 1}`);
        }
    }

    setVector(index, vec) {
        if (vec instanceof VecN && vec.dims == this.dims) {
            for(let i=0; i<this.dims; i++) {
                this.flexibleArray.set(index+i, vec.components[i]);
            }
        } else if (Array.isArray(vec) && vec.length === this.dims) {
            for(let i=0; i<this.dims; i++) {
                this.flexibleArray.set(index+i, vec[i]);
            }
        } else {
            throw new Error(`Unsupported vector format or incorrect dimensions. Expected dimension: ${this.dims}`);
        }
    }

    /**
     * @param {Integer} index 
     * @param {Float} value 
     * @param {Integer} component 
     */
    setVectorComponent(index, value, component) {
        if(component < this.dims && component > 0) {
            this.flexibleArray.set((index * this.dims) + component, value);
        } else {
            throw new Error(`Unsupported vector format or incorrect dimensions. Expected component value between 0 and ${this.dims}`);
        }
    }

    // Calculate the magnitude of a vector at a given index
    mag(index) {
        return Math.sqrt(this.magSq(index));
    }

    // Calculate the squared magnitude of a vector at a given index
    magSq(index) {
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            const val = this.getVectorComponent(index, i);
            sumSq += val * val;
        }
        return sumSq;
    }

    // Add vector v to the vector at the given index
    add(index, v) {
        if (!(v instanceof VectorNArray) || v.dims !== this.dims) {
            throw new Error('Vector dimensions must match');
        }
        for (let i = 0; i < this.dims; i++) {
            const val = this.getVectorComponent(index, i) + v.getVectorComponent(0, i); 
            this.setVectorComponent(index, val, i);
        }
    }

    // Subtract vector v from the vector at the given index
    sub(index, v) {
        if (!(v instanceof VectorNArray) || v.dims !== this.dims) {
            throw new Error('Vector dimensions must match');
        }
        for (let i = 0; i < this.dims; i++) {
            const val = this.getVectorComponent(index, i) - v.getVectorComponent(0, i); // Assuming v is another VectorNArray with at least one vector
            this.setVectorComponent(index, val, i);
        }
    }

    // Multiply the vector at the given index by scalar
    mult(index, scalar) {
        for (let i = 0; i < this.dims; i++) {
            this.setVectorComponent(index, this.getVectorComponent(index, i) * scalar, i);
        }
    }

    // Divide the vector at the given index by scalar
    div(index, scalar) {
        if (scalar === 0) throw new Error('Division by zero');
        for (let i = 0; i < this.dims; i++) {
            this.setVectorComponent(index, this.getVectorComponent(index, i) / scalar, i);
        }
    }

    limit(index, limit) {
        const magSq = this.magSq(index);
        if (magSq > limit * limit) {
            this.normalize(index);
            this.mult(index, limit);
        }
    }

    // Limit the squared magnitude of the vector at the given index
    limitSq(index, limitSq) {
        const magSq = this.magSq(index);
        if (magSq > limitSq) {
            this.normalize(index);
            this.mult(index, Math.sqrt(limitSq / magSq));
        }
    }

    // Set the magnitude of the vector at the given index
    setMag(index, len) {
        this.normalize(index);
        this.mult(index, len);
    }

    // Set the squared magnitude of the vector at the given index
    setMagSq(index, lenSq) {
        const magSq = this.magSq(index);
        if (magSq > 0) {
            this.mult(index, Math.sqrt(lenSq / magSq));
        }
    }

    // Clamp the magnitude of the vector between min and max
    clamp(index, min, max) {
        const mag = this.mag(index);
        if (mag < min) {
            this.setMag(index, min);
        } else if (mag > max) {
            this.setMag(index, max);
        }
    }
    
    // Dot product of the vector at the given index with another vector
    dot(index, v) {        
        let dot = 0;
        let incomps = this.extractInputComponents(v);
        for (let i = 0; i < Math.min(this.dims); i++) {
            dot += this.getVectorComponent(index, i) * incomps[i];
        }
        return dot;
    }

    // Distance between the vector at the given index and another vector
    dist(index, v) {
        return Math.sqrt(this.distSq(index, v));
    }

    // Squared distance between the vector at the given index and another vector
    distSq(index, v) {
        let incomps = this.extractInputComponents(v);
        if ( incomps.length !== this.dims) {
            throw new Error('Vector dimensions must match');
        }
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            const diff = this.getVectorComponent(index, i) -  incomps[i];
            sumSq += diff * diff;
        }
        return sumSq;
    }

    // Linear interpolation between the vector at the given index and another vector
    lerp(index, target, alpha) {
        let incomps = this.extractInputComponents(target);
        if ( incomps.length !== this.dims) {
            throw new Error('Vector dimensions must match');
        }
        for (let i = 0; i < this.dims; i++) {
            const start = this.getVectorComponent(index, i);
            const end = incomps[i];
            this.setVectorComponent(index, start + (end - start) * alpha, i);
        }
    }

    // Normalize the vector at the given index
    normalize(index) {
        const mag = this.mag(index);
        if (mag !== 0) {
            this.div(index, mag);
        }
    }

    extractInputComponents(vec) {
        if (vec instanceof VecN) return vec.components;
        else if (Array.isArray(vec)) return vec;
        else throw Error('Unsupported vector format');        
    }
}
