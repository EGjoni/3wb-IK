
import { Vec3, Vec3Pool, any_Vec3} from "./vecs.js";

export class Ray {
    
    constructor(p1, p2, pool = noPool) {
        this.pool = pool;
        this.workingVector = this.pool.new_Vec3();
        this.p1 = this.pool.new_Vec3();
        this.p2 = this.pool.new_Vec3();
        this.setP1(p1);
        this.setP2(p2);
    }

    static asFloat(p1, p2) {
        return new Rayf(p1, p2); 
    }

    static asDouble(p1, p2) {
        return new Rayd(p1, p2);
    }

    static get X() {
        return 0;
    }
    static get Y() {
        return 1;
    }
    static get Z() {
        return 2;
    }
    
    alignTo(target) {
        this.p1.set(target.p1);
        this.p2.set(target.p2);
    }

    heading() {
        return this.setToHeading(this.workingVector);
    }

    setHeading(setTo) {
        if (!this.p2) {
            if (!this.p1) this.p1 = this.pool.new_Vec3();
            this.p2 = this.p1.clone();
        }
        this.workingVector.set(setTo);
        this.workingVector.add(this.p1);
        this.p2.set(this.workingVector);
        return this;
    }

    /**sets the provided vector to have the same magnitude and direction as this ray 
     * @param {Vec3} storeIn
     * @return {Vec3} the input vector after updating its values
    */
    setToHeading(storeIn = this.workingVector) {
        storeIn.set(this.p2);
        storeIn.sub(this.p1);
        return storeIn;
    }

    /**sets the provided array (starting at the provided index to the components of a vector with the same magnitude and direction 
     * as the heading of this ray
     * @param {Array} storeIn
     * @param {Number} baseX the index to start iterating through the array from
     * @return {Array} the input array after updating its values
    */
    setToHeadingArr(storeIn, baseX) {
        const baseY = baseX+1;
        const baseZ = baseX+2;
        storeIn[baseX] = this.p2.x - this.p1.x;
        storeIn[baseY] = this.p2.y - this.p1.y;
        storeIn[baseZ] = this.p2.z - this.p1.z;
        return storeIn;
    }
    origin() {
        return this.p1.clone();
    }
    mag() {
        return this.heading().mag();
    }
    setMag(newMag) {
        let dir = this.heading();
        dir.setMag(newMag);
        this.setHeading(dir);
    }
    scaledProjection(input) {
        this.workingVector.set(input);
        let heading = this.heading();
        let headingMag = heading.mag();
        let workingVectorMag = this.workingVector.mag();

        if (workingVectorMag === 0 || headingMag === 0) return 0;

        return (this.workingVector.dot(heading) / (headingMag * workingVectorMag)) * (workingVectorMag / headingMag);
    }
    div(divisor) {
        this.p2.sub(this.p1);
        this.p2.div(divisor);
        this.p2.add(this.p1);
    }
    mult(scalar) {
        this.p2.sub(this.p1);
        this.p2.mult(scalar);
        this.p2.add(this.p1);
    }
    getMultipledBy(scalar) {
        let result = this.heading();
        result.mult(scalar);
        result.add(this.p1);
        return result;
    }
    getDivideddBy(divisor) {
        let result = this.heading().clone();
        result.mult(divisor);
        result.add(this.p1);
        return result;
    }
    getScaledTo(scale) {
        let result = this.heading().clone();
        result.normalize();
        result.mult(scale);
        result.add(this.p1);
        return result;
    }
    elongate(amt) {
        this.workingVector.set(this.p2).sub(this.p1).normalize().mult(0.5*amt);
        this.p2.add(this.workingVector);
        this.workingVector.mult(-1);
        this.p1.add(this.workingVector);
    }

    intersectsPlane(ta, tb, tc, pool) {
		let I = this.workingVector;
        let u = pool.any_Vec3().set(tb).sub(ta); 
        let v = pool.any_Vec3().set(tc).sub(ta);
        let n = pool.any_Vec3();
        let dir = pool.any_Vec3().set(this.p2).sub(this.p1);
        let w0 = pool.any_Vec3().set(this.p1).sub(ta); 

		n =  u.cross(v, n);
		let r = -(n.dot(w0)) / n.dot(dir);
		I.set(dir); 
		I.mult(r).add(this.p1);	
		return I;		
	}


    /**
	 * returns the point on this ray which is closest to the input ray
	 * @param {Ray} r the ray to check against
	 * @return {Vec3} the closest point on the input ray
	 */

	closestPointToRay3D(r, result=any_Vec3(0,0,0)) {
		this.workingVector.set(this.p2);
		let u =  this.workingVector.subClone(this.p1);
		this.workingVector.set(r.p2);
		let v =  this.workingVector.subClone(r.p1);
		this.workingVector.set(this.p1);
	    let w =  this.workingVector.subClone(r.p1);
		let a = u.dot(u);         // always >= 0
	    let b = u.dot(v);
		let c = v.dot(v);         // always >= 0
		let d = u.dot(w);
		let e = v.dot(w);
		let D = a*c - b*b;        // always >= 0
		let sc; //tc

		// compute the line parameters of the two closest points
		if (D < 0.00000001) {          // the lines are almost parallel
			sc = 0.0;
		}
		else {
			sc = (b*e - c*d) / D;
		}
		result.set(this.p2).sub(this.p1).mult(sc).add(this.p1);
		return result;
	}



	/**
     * Note: in js this function is slow due to unecessary object instantiation overhead
     * Find where this ray intersects a sphere
	 * @param {Number} radius radius of the sphere
	 * @param {Vec3} S1 reference to variable in which the first intersection will be placed
	 * @param {Vec3} S2 reference to variable in which the second intersection will be placed
	 * @return number of intersections found;
	 */
	intersectsSphere(radius, S1, S2) {
		let e = this.workingVector;
        e.set(this.p2).sub(this.p1);
		e.normalize();
	    let h = this.p1.clone();
		h.setComponents(0,0,0);
		h =  h.sub(this.p1);  // h=r.o-c.M
	    let lf = e.dot(h);                      // lf=e.h
		let radpow = radius*radius;
		let hdh = h.magSq(); 
		let lfpow = lf*lf;		
		let s = radpow-hdh+lfpow;   // s=r^2-h^2+lf^2
		
        if (s < 0.0) return 0;    // no intersection points ?
		
        s = Math.sqrt(s);   // s=sqrt(r^2-h^2+lf^2)

		let result = 0;
		if (lf < s) {      // S1 behind A ?
			if (lf+s >= 0) {  // S2 before A ?
				s = -s;   // swap S1 <-> S2}
				result = 1; // one intersection point
			} 
		}else result = 2; // 2 intersection points

		e.multClone(lf-s, S1);  
		S1.add(this.p1); // S1=A+e*(lf-s)
		e.multClone(lf+s, S2);  
		S2.add(this.p1); // S2=A+e*(lf+s)

		return result;
	}
    
    reverse() {
        let temp = this.p1;
        this.p1 = this.p2;
        this.p2 = temp;
    }
    
    pointWith(r) {
        if (this.heading().dot(r.heading()) < 0) this.reverse();
    }
    pointWith(heading) {
        if (this.heading().dot(heading) < 0) this.reverse();
    }
    getRayScaledBy(scalar) {
        return new Ray(this.p1, this.getMultipledBy(scalar));
    }
    /**sets the provided value to what p2 of this ray would be if the ray's heading were scaled by the given amount
     * @param {Number} scaleBy 
     * @param {Array} storeIn
     */
    setToScaledP2(scaleBy, storeIn) {
        let {x, y, z} = this.p2;
        const x1 = this.p1.x, y1 = this.p1.y, z1 = this.p1.z; 
        x-=x1; y-=y1; z-=z1;
        x*=scaleBy; y*=scaleBy; z*=scaleBy;
        x+=x1; y+=y1; z+=z1;
        storeIn.x = x; storeIn.y=y; storeIn.z=z;
        return storeIn;
    }

    scaleBy(scaleBy) {
        let {x, y, z} = this.p2;
        const x1 = this.p1.x, y1 = this.p1.y, z1 = this.p1.z; 
        x-=x1; y-=y1; z-=z1;
        x*=scaleBy; y*=scaleBy; z*=scaleBy;
        x+=x1; y+=y1; z+=z1;
        this.p2.setComponents(x,y,z);
    }

    setToInvertedTip(vec) {
        const p1x = this.p1.x, p1y = this.p1.y, p1z = this.p1.z;
        const p2x = this.p2.x, p2y = this.p2.y, p2z = this.p2.z;
        vec.x = (p1x - p2x) + p1x;
        vec.y = (p1y - p2y) + p1y;
        vec.z = (p1z - p2z) + p1z;
        return vec;
    }
    contractTo(percent) {
        let halfPercent = 1 - ((1 - percent) / 2);
        this.p1.lerp(this.p2, halfPercent);
        this.p2.lerp(this.p1, halfPercent);
    }
    translateTo(newLocation) {
        this.workingVector.set(this.p2);
        this.workingVector.sub(this.p1);
        this.workingVector.add(newLocation);
        this.p2.set(this.workingVector);
        this.p1.set(newLocation);
    }
    translateTipTo(newLocation) {
        this.workingVector.set(newLocation);
        let transBy = this.workingVector.sub(this.p2);
        this.translateBy(transBy);
    }
    translateBy(toAdd) {
        this.p1.add(toAdd);
        this.p2.add(toAdd);
    }
    normalize() {
        this.mag(1);
    }
    set(r) {
        this.p1.set(r.p1);
        this.p2.set(r.p2);
    }

    setP2(p2) {
        this.p2.x = p2.x;
        this.p2.y = p2.y;
        this.p2.z = p2.z;
        this.p2.type = p2.type;
    }
    
    setP1(p1) {
        this.p1.x = p1.x;
        this.p1.y = p1.y;
        this.p1.z = p1.z;
        this.p1.type = p1.type;
    }

    /**stores the backing vectors of this ray into the provided VectorNArray */
    virtualize(vectorNArray) {
        this.p1 = vectorNArray.push1(this.p1);
        this.p2 = vectorNArray.push1(this.p2);
    }

    clone() {
        return new Ray(this.p1, this.p2);
    }

    release() {
        this.p1.release();
        this.p2.release();
        this.workingVector.release();
    }
}

export class Rayd extends Ray { 
   
    constructor(p1, p2) {
        this.workingVector = new Vec3d(p1 != null ? [p1.x, p1.y, p1.z] : [0,0,0]);
        this.p1 = new Vec3d(p1 != null ? [p1.x, p1.y, p1.z] : [0,0,0]);
        this.p2 = new Vec3d(p2 != null ?[p2.x, p2.y, p2.z] : [this.p1.x, this.p1.y, this.p1.z]);
    }
    
    getReversed() {
        return new Rayd(this.p2, this.p1);
    }
    getRayScaledTo(scale) {
        return new Rayd(this.p1, this.getScaledTo(scale));
    }
    clone() {
        return new Rayd(this.p1, this.p2);
    }
}

export class Rayf extends Ray { 
    constructor(p1, p2) {
        this.workingVector = new Vec3f(p1 != null ? [p1.x, p1.y, p1.z] : [0,0,0]);
        this.p1 = new Vec3f(p1 != null ? [p1.x, p1.y, p1.z] : [0,0,0]);
        this.p2 = new Vec3f(p2 != null ?[p2.x, p2.y, p2.z] : [this.p1.x, this.p1.y, this.p1.z]);
    }
    getReversed() {
        return new Rayf(this.p2, this.p1);
    }
    getRayScaledTo(scale) {
        return new Rayf(this.p1, this.getScaledTo(scale));
    }
    clone() {
        return new Rayf(this.p1, this.p2);
    }
}
