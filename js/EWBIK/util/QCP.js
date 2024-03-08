import {Vec3, any_Vec3} from "./vecs.js";
import {Rot} from "./Rot.js";

export class QCP {	
	
	/**
	 * Constructor with option to set the precision values.
	 *
	 * @param centered
	 *            true if the point arrays are centered at the origin (faster),
	 *            false otherwise
	 * @param evec_prec
	 *            required eigenvector precision
	 * @param eval_prec
	 *            required eigenvalue precision
	 */
	constructor(evec_prec, eval_prec, type) {
		this.evec_prec = evec_prec;
		this.eval_prec = eval_prec;
        this.max_iterations = 5;
        this.targetCenter =  new Vec3();
		this.movedCenter =  new Vec3();
		this.wsum = 0;
	}

	/**
	 * Sets the maximum number of iterations QCP should run before giving up. In
	 * most situations QCP converges in 3 or 4 iterations, but in some situations
	 * convergence occurs slowly or not at all, and so an exit condition is used.
	 * The default value is 20. Increase it for more stability.
	 * 
	 * @param max
	 */
	setMaxIterations(max) {
		this.max_iterations = max;
	}

	
	/**
	 * Sets the two input coordinate arrays and weight array, as well as a hint about whether transformation computation is appropriate. 
     * All input arrays must be of equal length. Input coordinates are not modified.
     * 
	 * @param fixed
	 * @param moved 
	 * @param weight array of weigths for each equivalent point position
     * @param {Boolean} translate whether or not to compute the translation component of the rmsd minimizing transform
	 * @return
	 */
	set(moved, target, weight, translate) {
		this.target = target;
		this.moved = moved;
		this.weight = weight;
		this.rmsdCalculated = false;
		this.transformationCalculated = false;
		this.innerProductCalculated = false;
		this.movedCenter.setComponents(0,0,0);
		this.targetCenter.setComponents(0,0,0);
		this.wsum = 0;

		if (translate) {
			this.updateDirToWeightedCenter(this.moved, this.weight, this.movedCenter);
			this.wsum = 0; // set wsum to 0 so we don't double up.
			this.updateDirToWeightedCenter(this.target, this.weight, this.targetCenter);
			this.translate(this.movedCenter.mult(-1), this.moved);
			this.translate(this.targetCenter.mult(-1), this.target);
			this.movedCenter.mult(-1);
			this.targetCenter.mult(-1);
		} else {
			if (weight != null) {
				for (let w of weight) this.wsum += w;
			} else {
				this.wsum = moved.length;
			}
		}
		//calcRmsd(moved, target);

	}

	/**
	 * Return the RMSD of the superposition of input coordinate set y onto x. Note,
	 * this is the fasted way to calculate an RMSD without actually superposing the
	 * two sets. The calculation is performed "lazy", meaning calculations are only
	 * performed if necessary.
	 *
	 * @return root mean square deviation for superposition of y onto x
	 */
	getRmsd() {
		if (!this.rmsdCalculated) {
			this.calcRmsd(this.moved, this.target);
			this.rmsdCalculated = true;
		}
		return this.rmsd;
	}

	/**
	 * Weighted superposition.
	 *
	 * @param fixed
	 * @param moved 
	 * @param weight array of weigths for each equivalent point position
     * @param {Boolean} translate whether or not to compute the translation component of the rmsd minimizing transform
	 * @return
	 */
	weightedSuperpose(moved, target, weight, translate) {

		this.set(moved, target, weight, translate);
		let result = this.getRotation();
		// transformation.set(rotmat);
		return result;// transformation;
	}
	
	
	getRotation() {
		let result = null;
		if (!this.transformationCalculated) {
			if (!this.innerProductCalculated)
				this.innerProduct(this.target, this.moved);	
			
			result = this.calcRotation();
			this.transformationCalculated = true;
		}
		return result;
	}

	/**
	 * Calculates the RMSD value for superposition of y onto x. This requires the
	 * coordinates to be precentered.
	 *
	 * @param x vec3 points of reference coordinate set
	 * @param y vec3 points of coordinate set for superposition
	 */
	calcRmsd(x, y) {
		// QCP doesn't handle alignment of single values, so if we only have one point
		// we just compute regular distance.
		if (x.length == 1) {
			this.rmsd = x[0].dist(y[0]);
			this.rmsdCalculated = true;
		} else {
			if (!this.innerProductCalculated)
				this.innerProduct(y, x);
			calcWeightedRmsd(wsum);
		}
	}

	/**
	 * Calculates the inner product between two coordinate sets x and y (optionally
	 * weighted, if weights set through
	 * {@link #set(SGVec_3d[], SGVec_3d[], double[])}). It also calculates an upper
	 * bound of the most positive root of the key matrix.
	 * http://theobald.brandeis.edu/qcp/qcprot.c
	 *
	 * @param coords1
	 * @param coords2
	 * @return
	 */
	innerProduct(coords1, coords2) {
		
		let g1 = 0, g2 = 0;

		this.Sxx = 0;
		this.Sxy = 0;
		this.Sxz = 0;
		this.Syx = 0;
		this.Syy = 0;
		this.Syz = 0;
		this.Szx = 0;
		this.Szy = 0;
		this.Szz = 0;

		if (this.weight != null) {
			// wsum = 0;
			for (let i = 0; i < coords1.length; i++) {
				const cix = coords1[i].x, ciy = coords1[i].y, ciz = coords1[i].z;
				let x1, x2, y1, y2, z1, z2;

				// wsum += weight[i];

				x1 = this.weight[i] * cix;
				y1 = this.weight[i] * ciy;
				z1 = this.weight[i] * ciz;

				g1 += x1 * cix+ y1 * ciy + z1 * ciz;

				x2 = coords2[i].x;
				y2 = coords2[i].y;
				z2 = coords2[i].z;

				g2 += this.weight[i] * (x2 * x2 + y2 * y2 + z2 * z2);

				this.Sxx += (x1 * x2);
				this.Sxy += (x1 * y2);
				this.Sxz += (x1 * z2);

				this.Syx += (y1 * x2);
				this.Syy += (y1 * y2);
				this.Syz += (y1 * z2);

				this.Szx += (z1 * x2);
				this.Szy += (z1 * y2);
				this.Szz += (z1 * z2);
			}
		} else {
			for (let i = 0; i < coords1.length; i++) {
				const ci1x = coords1[i].x, ci1y = coords1[i].y, ci1z = coords1[i].z;
				const ci2x = coords2[i].x, ci2y = coords2[i].y, ci2z = coords2[i].z;
				
				g1 += ci1x * ci1x + ci1y * ci1y + ci1z * ci1z;
				g2 += ci2x * ci2x + ci2y * ci2y + ci2z * ci2z;

				this.Sxx += ci1x * ci2x;
				this.Sxy += ci1x * ci2y;
				this.Sxz += ci1x * ci2z;

				this.Syx += ci1y * ci2x;
				this.Syy += ci1y * ci2y;
				this.Syz += ci1y * ci2z;

				this.Szx += ci1z * ci2x;
				this.Szy += ci1z * ci2y;
				this.Szz += ci1z * ci2z;
			}
			// wsum = coords1.length;
		}
		
		this.e0 = (g1 + g2) * 0.5;
		
		this.SxzpSzx = this.Sxz + this.Szx;
		this.SyzpSzy = this.Syz + this.Szy;
		this.SxypSyx = this.Sxy + this.Syx;
		this.SyzmSzy = this.Syz - this.Szy;
		this.SxzmSzx = this.Sxz - this.Szx;
		this.SxymSyx = this.Sxy - this.Syx;
		this.SxxpSyy = this.Sxx + this.Syy;
		this.SxxmSyy = this.Sxx - this.Syy;
		this.mxEigenV = this.e0;

		this.innerProductCalculated = true;
	}

	calcWeightedRmsd(len) {
		const {max_iterations, Sxx, Syy, Szz, Sxy, Syz, Sxz, Syx, Szy, Szx, eval_prec, e0,
			SxzpSzx, SyzmSzy, SxymSyx, SxxmSyy, SxzmSzx, SyzpSzy, SxypSyx, SxxpSyy } = this;
		let {mxEigenV} = this;

		if (max_iterations > 0) {
			let Sxx2 = Sxx * Sxx;
			let Syy2 = Syy * Syy;
			let Szz2 = Szz * Szz;

			let Sxy2 = Sxy * Sxy;
			let Syz2 = Syz * Syz;
			let Sxz2 = Sxz * Sxz;

			let Syx2 = Syx * Syx;
			let Szy2 = Szy * Szy;
			let Szx2 = Szx * Szx;

			let SyzSzymSyySzz2 = 2.0 * (Syz * Szy - Syy * Szz);
			let Sxx2Syy2Szz2Syz2Szy2 = Syy2 + Szz2 - Sxx2 + Syz2 + Szy2;

			let c2 = -2.0 * (Sxx2 + Syy2 + Szz2 + Sxy2 + Syx2 + Sxz2 + Szx2 + Syz2 + Szy2);
			let c1 = 8.0 * (Sxx * Syz * Szy + Syy * Szx * Sxz + Szz * Sxy * Syx - Sxx * Syy * Szz - Syz * Szx * Sxy
					- Szy * Syx * Sxz);

            let Sxy2Sxz2Syx2Szx2 = Sxy2 + Sxz2 - Syx2 - Szx2;

			let c0 = Sxy2Sxz2Syx2Szx2 * Sxy2Sxz2Syx2Szx2
					+ (Sxx2Syy2Szz2Syz2Szy2 + SyzSzymSyySzz2) * (Sxx2Syy2Szz2Syz2Szy2 - SyzSzymSyySzz2)
					+ (-(SxzpSzx) * (SyzmSzy) + (SxymSyx) * (SxxmSyy - Szz))
							* (-(SxzmSzx) * (SyzpSzy) + (SxymSyx) * (SxxmSyy + Szz))
					+ (-(SxzpSzx) * (SyzpSzy) - (SxypSyx) * (SxxpSyy - Szz))
							* (-(SxzmSzx) * (SyzmSzy) - (SxypSyx) * (SxxpSyy + Szz))
					+ (+(SxypSyx) * (SyzpSzy) + (SxzpSzx) * (SxxmSyy + Szz))
							* (-(SxymSyx) * (SyzmSzy) + (SxzpSzx) * (SxxpSyy + Szz))
					+ (+(SxypSyx) * (SyzmSzy) + (SxzmSzx) * (SxxmSyy - Szz))
							* (-(SxymSyx) * (SyzpSzy) + (SxzmSzx) * (SxxpSyy - Szz));

			
			for (let i = 1; i < (max_iterations + 1); ++i) {
				let oldg = mxEigenV;
				let Y = 1 / mxEigenV;
				let Y2 = Y * Y;
				let delta = ((((Y * c0 + c1) * Y + c2) * Y2 + 1) / ((Y * c1 + 2 * c2) * Y2 * Y + 4));
				mxEigenV -= delta;

				if (Math.abs(mxEigenV - oldg) < Math.abs(eval_prec * mxEigenV))
					break;
			}
			this.mxEigenV = mxEigenV;
		}

		this.rmsd = Math.sqrt(Math.abs(2.0 * (e0 - mxEigenV) / len));

	}

	calcRotation() {
        
		// QCP doesn't handle single targets, so if we only have one point and one
		// target, we just rotate by the angular distance between them
		if (this.moved.length == 1) {
			return new Rot(this.moved[0], this.target[0]);
		} else {
			const {
				SxxpSyy, Syy, Sxx, Szz, mxEigenV, SyzmSzy, SxzmSzx, SxymSyx, 
				SxxmSyy, SxypSyx, SxzpSzx, SyzpSzy, evec_prec
			} = this;

			let a11 = SxxpSyy + Szz - mxEigenV;
			let a12 = SyzmSzy;
			let a13 = -SxzmSzx;
			let a14 = SxymSyx;
			let a21 = SyzmSzy;
			let a22 = SxxmSyy - Szz - mxEigenV;
			let a23 = SxypSyx;
			let a24 = SxzpSzx;
			let a31 = a13;
			let a32 = a23;
			let a33 = Syy - Sxx - Szz - mxEigenV;
			let a34 = SyzpSzy;
			let a41 = a14;
			let a42 = a24;
			let a43 = a34;
			let a44 = Szz - SxxpSyy - mxEigenV;
			let a3344_4334 = a33 * a44 - a43 * a34;
			let a3244_4234 = a32 * a44 - a42 * a34;
			let a3243_4233 = a32 * a43 - a42 * a33;
			let a3143_4133 = a31 * a43 - a41 * a33;
			let a3144_4134 = a31 * a44 - a41 * a34;
			let a3142_4132 = a31 * a42 - a41 * a32;
			let q1 = a22 * a3344_4334 - a23 * a3244_4234 + a24 * a3243_4233;
			let q2 = -a21 * a3344_4334 + a23 * a3144_4134 - a24 * a3143_4133;
			let q3 = a21 * a3244_4234 - a22 * a3144_4134 + a24 * a3142_4132;
			let q4 = -a21 * a3243_4233 + a22 * a3143_4133 - a23 * a3142_4132;

			let qsqr = q1 * q1 + q2 * q2 + q3 * q3 + q4 * q4;
			
			if (qsqr < this.evec_prec) {
				q1 = a12 * a3344_4334 - a13 * a3244_4234 + a14 * a3243_4233;
				q2 = -a11 * a3344_4334 + a13 * a3144_4134 - a14 * a3143_4133;
				q3 = a11 * a3244_4234 - a12 * a3144_4134 + a14 * a3142_4132;
				q4 = -a11 * a3243_4233 + a12 * a3143_4133 - a13 * a3142_4132;
				qsqr = q1 * q1 + q2 * q2 + q3 * q3 + q4 * q4;

				if (qsqr < this.evec_prec) {
					let a1324_1423 = a13 * a24 - a14 * a23, a1224_1422 = a12 * a24 - a14 * a22;
					let a1223_1322 = a12 * a23 - a13 * a22, a1124_1421 = a11 * a24 - a14 * a21;
					let a1123_1321 = a11 * a23 - a13 * a21, a1122_1221 = a11 * a22 - a12 * a21;

					q1 = a42 * a1324_1423 - a43 * a1224_1422 + a44 * a1223_1322;
					q2 = -a41 * a1324_1423 + a43 * a1124_1421 - a44 * a1123_1321;
					q3 = a41 * a1224_1422 - a42 * a1124_1421 + a44 * a1122_1221;
					q4 = -a41 * a1223_1322 + a42 * a1123_1321 - a43 * a1122_1221;
					qsqr = q1 * q1 + q2 * q2 + q3 * q3 + q4 * q4;

					if (qsqr < this.evec_prec) {
						q1 = a32 * a1324_1423 - a33 * a1224_1422 + a34 * a1223_1322;
						q2 = -a31 * a1324_1423 + a33 * a1124_1421 - a34 * a1123_1321;
						q3 = a31 * a1224_1422 - a32 * a1124_1421 + a34 * a1122_1221;
						q4 = -a31 * a1223_1322 + a32 * a1123_1321 - a33 * a1122_1221;
						qsqr = q1 * q1 + q2 * q2 + q3 * q3 + q4 * q4;

						if (qsqr < this.evec_prec) {
							/*
							 * if qsqr is still too small, return the identity rotation
							 */
							return new Rot();
						}
					}
				}
			}
			return new Rot(q1, q2, q3, q4, true);
		}
	}
    /**
     * translate entries in x by trans
     * @param {Vec3} trans
     * @param {Vector3Array} x
     */
	translate(trans, x) {
		for (let p of x) {
			p.add(trans);
		}
	}

    /**
     * @param {Vector3Array} toCenter target origins
     * @param {Float32/64Array} x target weight
     * @param {Vec3} vector to move
     */
	updateDirToWeightedCenter(toCenter, weight, center) {

		if (weight != null) {
			for(let i = 0; i < toCenter.length; i++) {
				this.wsum += weight[i];
			}
		}
		if(weight != null && this.wsum != 0) {
			for (let i = 0; i < toCenter.length; i++) {
				center.mulAdd(toCenter[i], weight[i]);
				this.wsum += weight[i];
			}
			center.div(this.wsum);
		} else {
			for (let i = 0; i < toCenter.length; i++) {
				center.add(toCenter[i]);
				this.wsum++;
			}
			center.div(this.wsum);
		}

		return center;
	}	

	getTranslation() {
		let temp = any_Vec3().set(this.targetCenter);
		return temp.sub(this.movedCenter);
	}
}