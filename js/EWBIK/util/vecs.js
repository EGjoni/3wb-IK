
/**untyped vec3, use for any frequent instantiatons, as its faster to create than floatbuffer*/


export class Vec3 {
    baseIdx = 0;
    dataBuffer = [0, 0, 0];
    dims = 3;
    constructor(x=0, y=0, z=0) {
        this.x = x, this.y=y, this.z=z;
    }

    get x() { return this.dataBuffer[this.baseIdx]; }
    set x(value) { this.dataBuffer[this.baseIdx] = value; }

    get y() { return this.dataBuffer[this.baseIdx + 1]; }
    set y(value) { this.dataBuffer[this.baseIdx + 1] = value; }

    get z() { return this.dataBuffer[this.baseIdx + 2]; }
    set z(value) { this.dataBuffer[this.baseIdx + 2] = value; }


    /** Sets the components from the given spherical coordinate
     * @param azimuthalAngle The angle between x-axis in radians [0, 2pi]
     * @param polarAngle The angle between z-axis in radians [0, pi]
     * @return This vector for chaining */
    setFromSpherical(azimuthalAngle, polarAngle) {
        let cosPolar = Math.cos(polarAngle);
        let sinPolar = Math.sin(polarAngle);

        let cosAzim = Math.cos(azimuthalAngle);
        let sinAzim = Math.sin(azimuthalAngle);

        return this.setComponents(cosAzim * sinPolar, sinAzim * sinPolar, cosPolar);
    }

    /**takes this this.cross input and returns the result as a new vector*/
    crossClone(input) {
        let newVec = this.clone();
        newVec.setComponents(
            this.y * input.z - this.z * input.y,
            this.z * input.x - this.x * input.z,
            this.x * input.y - this.y * input.x
        );
        return newVec;
    }

    clone() {
        return new Vec3(this.x, this.y, this.z);
    }

   
    getOrthogonal() {
        const { x, y, z } = this;
        let result = this.clone();
        result.setComponents(0, 0, 0);
        let threshold = this.mag() * 0.6;
        if (threshold > 0) {
            if (Math.abs(x) <= threshold) {
                let inverse = 1 / Math.sqrt(y * y + z * z);
                return result.setComponents(0, inverse * z, -inverse * y);
            } else if (Math.abs(y) <= threshold) {
                let inverse = 1 / Math.sqrt(x * x + z * z);
                return result.set(-inverse * z, 0, inverse * x);
            }
            let inverse = 1 / Math.sqrt(x * x + y * y);
            return result.setComponents(inverse * y, -inverse * x, 0);
        }

        return result;
    }

    /**
         * @param {Instanceof _VecN or Array} vec 
         * @return this vector for chaining
         */
    set(vec) {
        return this.setComponents(vec.x, vec.y, vec.z);
    }

    setComponents(...components) {
        if (components.length == this.dims) {
            for (let i = 0; i < components.length; i++) {
                this.dataBuffer[this.baseIdx+i] = components[i];
            }
        }
        return this;
    }

    /** writes thes components of this vector into the given array. If no aray is given, one will be created and returned**/
    toArray(into = new Array(this.dims)) {
        for (let i = 0; i < this.dims; i++) {
            into[i] = this.dataBuffer[this.baseIdx+i];
        }
        return into;
    }

    static extractInputComponents(vec) {
        if (vec instanceof Vec3) return vec.components;
        else if (Array.isArray(vec)) return vec;
        else throw Error('Unsupported vector format');
    }

    /**swap the values of these variables */
    static swap(v1, v2) {        
        v1.components[v1.baseIdx] = v1.components[v1.baseIdx] ^ v2.components[v2.baseIdx];
        v2.components[v2.baseIdx] = v1.components[v1.baseIdx] ^ v2.components[v2.baseIdx];
        v1.components[v1.baseIdx] = v1.components[v1.baseIdx] ^ v2.components[v2.baseIdx];

        v1.components[v1.baseIdx+1] = v1.components[v1.baseIdx+1] ^ v2.components[v2.baseIdx+1];
        v2.components[v2.baseIdx+1] = v1.components[v1.baseIdx+1] ^ v2.components[v2.baseIdx+1];
        v1.components[v1.baseIdx+1] = v1.components[v1.baseIdx+1] ^ v2.components[v2.baseIdx+1];

        v1.components[v1.baseIdx+2] = v1.components[v1.baseIdx+2] ^ v2.components[v2.baseIdx+2];
        v2.components[v2.baseIdx+2] = v1.components[v1.baseIdx+2] ^ v2.components[v2.baseIdx+2];
        v1.components[v1.baseIdx+2] = v1.components[v1.baseIdx+2] ^ v2.components[v2.baseIdx+2];
    }

    mag() {
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            let diff = this.dataBuffer[this.baseIdx+i];
            sumSq += diff * diff;
        }
        return Math.sqrt(sumSq);
    }

    magSq() {
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            let diff = this.dataBuffer[this.baseIdx+i];
            sumSq += diff * diff;
        }
        return sumSq;
    }


    mulAdd(vec, scalar) {
        for (let i = 0; i < vec.dims; i++) {
            this.dataBuffer[this.baseIdx+i] += vec.dataBuffer[vec.baseIdx+i] * scalar;
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
            sum += this.dataBuffer[this.baseIdx+i] * v.dataBuffer[v.baseIdx+i];
        }
        return sum;
    }

    div(n) {
        for (let i = 0; i < this.dims; i++) {
            this.dataBuffer[this.baseIdx+i] /= n;
        }
        return this;
    }

    divClone(scalar) {
        let result = this.clone();
        result.div(scalar);
        return result;
    }

    mult(scalar) {
        for (let i = 0; i < this.dims; i++) {
            this.dataBuffer[this.baseIdx+i] *= scalar;
        }
        return this;
    }

    multClone(scalar) {
        let result = this.clone();
        result.mult(scalar);
        return result;
    }

    dist(v) {
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            let diff = this.dataBuffer[this.baseIdx+i] - v.dataBuffer[v.baseIdx+i];
            sumSq += diff * diff;
        }
        return Math.sqrt(sumSq);
    }

    distSq(v) {
        let sumSq = 0;
        for (let i = 0; i < this.dims; i++) {
            let diff = this.dataBuffer[this.baseIdx+i] - v.dataBuffer[v.baseIdx+i];
            sumSq += diff * diff;
        }
        return sumSq;
    }

    lerp(target, alpha) {
        for (let i = 0; i < this.dims; i++) {
            this.dataBuffer[this.baseIdx+i] += (target.dataBuffer[target.baseIdx+i] - this.dataBuffer[this.baseIdx+i]) * alpha;
        }
        return this;
    }

    square() {
        const {x, y, z} = this;
        this.x *= x; 
        this.y *= y;
        this.z *= z;
        return this;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    addClone(v) {
        let result = this.clone();
        result.add(v);
        return result;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    subClone(v) {
        let result = this.clone();
        result.sub(v);
        return result;
    }

    normalize() {
        const {x, y, z} = this;
        const sum = x*x + y*y + z*z;
        if(Math.abs(sum - 1) < Number.EPSILON) {
            return this;
        }
        const sumsqrt = Math.sqrt(sum);
        this.x /= sumsqrt;
        this.y /= sumsqrt;
        this.z /= sumsqrt;
        return this;
    }

    extractInputComponents(vec) {
        if (vec instanceof Vec3) return vec.components;
        else if (Array.isArray(vec)) return vec;
        else throw Error('Unsupported vector format');
    }

    /**returns this vector as color components in the specified magnitude range
     * x = red, y= green, z= blue. 
     * The range defines the half the width of a cube. origin maps to gray. 
     * black maps to (-range, -range, -range) 
    */
    asColor(range) {
        return Vec3.vecAsColor(this.x, this.y, this.z, range);
    }

    /**
     * returns a css color string for this vector.
     *  x = red, y= green, z= blue. 
     * The range defines the half the width of a cube. origin maps to gray. 
     * black maps to (-range, -range, -range) 
     * **/
    asConsoleString(range) {
        return Vec3.vecAsConsoleString(this.x, this.y, this.z, range);
    }

    static vecAsColor(x, y, z, range) {
        const inverseLerp = (min, max, value) => {
            return Math.min(Math.max((value - min) / (max - min), 0), 1);
        };
        const toColorValue = (normalized) => {
            return Math.round(normalized * 255);
        }
        const togamma = (normalized) => {
            return Math.pow(normalized, 2.2); //because dark-mode. always.
        }
        const r = inverseLerp(-range, range, x);
        const g = inverseLerp(-range, range, y);
        const b = inverseLerp(-range, range, z);
        const rgamma = togamma(r);
        const ggamma = togamma(g);
        const bgamma = togamma(b);
        return {r: toColorValue(rgamma), g: toColorValue(ggamma), b:toColorValue(bgamma), 
            gamma_norm:{r: rgamma, g:ggamma, b:bgamma},
            raw_norm: {r: r, g:g, b:b},
        }; 
    }

    static vecAsConsoleString(x, y, z, range) {
        const baseString = Vec3.vecAsString(x, y, z);
        const colString = Vec3.vecAsColor(x, y, z, range);
        
        return {stringContent: baseString, consoleContent: `%c ${baseString}`, style:`color: rgb(${colString.r}, ${colString.g}, ${colString.b})`}
    }

    static vecAsString(x, y, z) {
        return '('+x.toFixed(3)+', '+y.toFixed(3)+', '+z.toFixed(3)+')';
    }

    toString() {
        return Vec3.vecAsString(this.x, this.y, this.z);
    }
    toConsole(range = 1) {
        let consoleString = this.asConsoleString(range);
        console.log(`${consoleString.stringContent} %c▇`, `${consoleString.style}`);
    }

    get components() {
        return [this.x, this.y, this.z];
    }


    release() {
        this.amFree = true;
        return this;
    }

    /** 
     * *components() {
        for(let i = 0; i<this.dims; i++) {
            yield this.dataBuffer[this.baseIdx+i];
        }
    }*/
}


/**a pool for 3vectors backed by an array.
 * 
 * repetetive as hell because I don't trust JIT compilers
 */
export class Vec3Pool {
    persistentPool = [];
    reclaimedPool = []; //stores vecs that were previously
    inProgressPool = [];
    persistentBuffer;
    tempSize = 30000;
    tempPool = null;// new Array(this.tempSize);
    tempBuffer; //= new Float64Array(tempSize * 3);
    isFinalized = false;
    lru = -1;

    constructor(tempSize = 10000) {
        this.setTempPoolSize(tempSize);
    }

    reclaim() {
        this.isFinalized = false;  
        this.lru = -1;
        if(this.persistentPool?.length > 0) {
            this.reclaimedPool.push(...this.persistentPool);
            this.inProgressPool = [];
            this.persistentPool = [];
        }
        this.releaseAll();
        console.log("RECLAIMED: " + this.reclaimedPool.length);
    }

    
    acquire(x=0, y=0, z=0) {
        if(this.tempPool == null) 
            this.setTempPoolSize(this.tempSize);
        if (this.isFinalized) {
            //let vec;
            //let attempts =0;
            //while(!isFree && attempts < this.tempPool.length) {
                /*if(this.lru >= this.length) { 
                    if(this.assumeFree) {
                        this.assumeFree = false;
                        //attempts = 0;
                    } else if(attempts >= this.tempPool.length) {
                        console.warn(`
                        ran out of vectors after ${attempts} attempts! Make sure you release any you're not using! You should either
                        1. call releaseAll when you're at a point in your logic where you're sure any vectors you didn't call .finalize() for are free, or o
                        2. increase the tempPool size or
                        3. manually call .release() on more vectors after you finish using them
                        `)
                    }
                }*/
                this.lru = (this.lru + 1) % this.tempPool.length;
                const vec = this.tempPool[this.lru];        
                const odb = this.tempBuffer; 
                const obase = vec.baseIdx;
                odb[obase] = x;
                odb[obase+1] = y; 
                odb[obase+2] = y;
                //isFree = vec.amFree || this.assumeFree
                //vec.amFree = false;
                //attempts++;
            /*}
            if(attempts > 10) {
                console.log("attempted : "+attempts+" before finding " +this.lru);
            }*/
            //vec.x = x; vec.y =y; vec.z = z;
            //console.log("temp: "+this.lru);
            return vec;
        } else {
            let newV;
            if(this.reclaimedPool.length > 0) {
                newV = this.reclaimedPool.pop();
                newV.x = x; newV.y =y; newV.z = z;
                this.inProgressPool.push(newV);
            } else {
                newV = new Vec3(x, y, z);
                this.inProgressPool.push(newV);
            }
            return newV;
        }
    }

    acquirefv(iv) {
        if(this.tempPool == null) 
            this.setTempPoolSize(this.tempSize);
        if (this.isFinalized) {
            this.lru = (this.lru + 1) % this.tempPool.length;
            const vec = this.tempPool[this.lru];        
            const ibase = iv.baseIdx;
            const idb = iv.dataBuffer;         
            const odb = this.tempBuffer; 
            const obase = vec.baseIdx;
            odb[obase] = idb[ibase]; 
            odb[obase+1] = idb[ibase+1]; 
            odb[obase+2] = idb[ibase+2]; 
            return vec;
        } else {
            let newV;
            if(this.reclaimedPool.length > 0) {
                newV = this.reclaimedPool.pop();
                newV.x = x; newV.y =y; newV.z = z;
                this.inProgressPool.push(newV);
            } else {
                newV = new Vec3(x, y, z);
                this.inProgressPool.push(newV);
            }
            return newV;
        }
    }



    temp_acquire(x=0, y=0, z=0) {
        if(this.tempPool == null) 
            this.setTempPoolSize(this.tempSize);
            //let isFree = false;
            //let vec = null;
            //let attempts = 0;
            /*while(!isFree && attempts < 10) {//this.tempPool.length) {
                if(this.lru >= this.tempPool.length) { 
                    if(assumeFree) {
                        assumeFree = false;
                    } else {
                        console.warn(`
                        ran out of vectors! Make sure you release any you're not using! You should either
                        1. call releaseAll when you're at a point in your logic where you're sure any vectors you didn't call .finalize() for are free, or o
                        2. increase the tempPool size or
                        3. manually call .release() on more vectors after you finish using them
                        `)
                    }
                }*/
        this.lru = (this.lru + 1) % this.tempPool.length;
        const vec = this.tempPool[this.lru];
                //isFree = vec.amFree;
                //attempts++
            //}
            /*if(attempts > 10) {
                console.log("attempted : "+attempts+"TEMP before finding " +this.lru);
            }
            vec.amFree = true; // since the user indicated that they will be discarding this anyway*/
        const odb = this.tempBuffer; 
        const obase = vec.baseIdx;
        odb[obase] = x; 
        odb[obase+1] = y; 
        odb[obase+2] = z; 
        return vec;
    }

    temp_acquirefv(iv) {
        if(this.tempPool == null) 
            this.setTempPoolSize(this.tempSize);
        this.lru = (this.lru + 1) % this.tempPool.length;

        const vec = this.tempPool[this.lru];
        const ibase = iv.baseIdx;
        const idb = iv.dataBuffer;         
        const odb = this.tempBuffer; 
        const obase = vec.baseIdx;
        odb[obase] = idb[ibase]; 
        odb[obase+1] = idb[ibase+1]; 
        odb[obase+2] = idb[ibase+2]; 
        return vec;
    }

    setTempPoolSize(newSize) {
        this.tempSize = newSize
        this.tempBuffer = new Float64Array(newSize*3);
        this.tempPool = [];
        for(let i=0; i<this.tempSize; i++) {
            const vec = new Vec3();
            vec.amFree = true;
            vec.dataBuffer = this.tempBuffer;
            vec.baseIdx = i*3;
            this.tempPool.push(vec.release());
        }
    }

    finalize() {
        if(this.reclaimedPool.length > 0) {
            this.persistentPool = this.inProgressPool;
            this.inProgressPool = [];   
            this.isFinalized = true;         
            return;
        }
        const prevBuffer = this.persistentBuffer;
        this.persistentBuffer = new Float64Array(this.inProgressPool.length * 3);
        const persistentBuffer = this.persistentBuffer;
        for (let i = 0; i < this.inProgressPool.length; i++) {
            const baseIdx = i*3;
            const vec = this.inProgressPool[i];
            const vx = vec.x, vy = vec.y, vz = vec.z;
            persistentBuffer[baseIdx] = vx;
            persistentBuffer[baseIdx+1] = vy;
            persistentBuffer[baseIdx+2] = vz;
            vec.dataBuffer = persistentBuffer;
            vec.baseIdx = baseIdx;
        }

        this.persistentPool = this.inProgressPool;
        this.inProgressPool = [];
        console.log("REMAINING: " +this.reclaimedPool);
        this.isFinalized = true;
        this.lru = -1;
    }

    /**
     * Let the VectorPool know that you're done with all of the temporary vectors you've been using so it doesn't need to yell at you.
     */
    releaseAll() {
        this.lru = -1;
        this.assumeFree = true;
    }

    new_Vec3(x=0, y=0, z=0) {
        return this.acquire(x, y, z);
    }

    any_Vec3(x=0, y=0, z=0) {
        return this.temp_acquire(x, y, z);
    }

    /**
     * new pooled vec3 from vec
     * @param {*} x 
     * @param {*} y 
     * @param {*} z 
     * @returns 
     */
    new_Vec3fv(v) {
        return this.acquirefv(v);
    }

    any_Vec3fv(v) {
        return this.temp_acquirefv(v);
    }
}

window.globalVecPool = new Vec3Pool(1000);

export function any_Vec3(x=0, y=0, z=0) {
    return globalVecPool.temp_acquire(x, y, z);
}

export function any_Vec3fv(v) {
    return globalVecPool.temp_acquirefv(v);
}

export class NoPool {
    new_Vec3(x=0, y=0, z=0) {
        return new Vec3(x, y, z);
    }
    any_Vec3(x=0, y=0, z=0) {
        return new Vec3(x, y, z); 
    }

    new_Vec3fv(v) {
        return new Vec3(v.x, v.y, v.z); 
    }

    any_Vec3fv(v) {
        return new Vec3(v.x, v.y, v.z); 
    }
    releaseAll() {
        
    }
}


window.noPool = new NoPool();