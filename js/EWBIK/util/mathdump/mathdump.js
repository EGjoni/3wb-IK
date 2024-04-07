import {BufferGeometry, Vector3} from "three";
import {ConvexGeometry} from "convexGeo";
import { getEigenVectors } from "./pca.js";
import * as THREE from "three";
import { any_Vec3 } from "../vecs.js";

/**This is some math that is here now.*/

/**
 * @param {[(Vec3|THREE.Vector3)]} vecs distribution of points you want to align to
 * @param {[Objec3D]} startBasis a reference basis to keep things sane
 * @param {function} onFail a fallback callback of your devising.
 */
export function pcaOrientation(vecs, startBasis, onFail) {
    const points = [];
    let inferredAxes = null;
    for(let v of vecs) {
        points.push([v.x, v.y, v.z]);
    }
    try{
        inferredAxes = getEigenVectors(points);
    } catch(e) {
        return onFail(vecs, startBasis);
    }
    if(inferredAxes[0].eigenvalue == 0 || inferredAxes[1].eigenvalue == 0) return onFail(vecs, startBasis);
    else { //we have the Y and X axes, now we just need to make sure the determinant matches
        //one way to do that is to check, but a much better way to do is to not check at all. 
        //in other words, just align the y-axes, and then rotate about the y-axis until the x-axes are aligned.
        //then z can just be whatever the start basis said it was.
        let infr = inferredAxes;
        let y = any_Vec3(infr[0].vector[0], infr[0].vector[1], infr[0].vector[2]); //ephemeral
        let x = any_Vec3(infr[1].vector[0], infr[1].vector[1], infr[1].vector[2]); //ephemeral
        let z = any_Vec3(infr[2].vector[0], infr[2].vector[1], infr[2].vector[2]); //ephemeral
        x.normalize();
        y.normalize();
        z.normalize();
        x.mult(startBasis.scale.x);
        y.mult(startBasis.scale.y);
        z.mult(startBasis.scale.z);

        const matrix = new THREE.Matrix4();
        matrix.set(
        x.x, y.x, z.x, 0,
        x.y, y.y, z.y, 0,
        x.z, y.z, z.z, 0,
        0,   0,   0, 1);
            
        if(matrix.determinant() * startBasis.matrix.determinant() < 0) {
            z.mult(-1);            
        }
        
        matrix.set(
        x.x, y.x, z.x, 0,
        x.y, y.y, z.y, 0,
        x.z, y.z, z.z, 0,
        0,   0,   0,   1);
        
        let q = new THREE.Quaternion().setFromRotationMatrix(matrix.extractRotation(matrix));
        return q;
    }
}

function normalize(vector) {
    const norm = Math.sqrt(vector.reduce((acc, val) => acc + val * val, 0));
    return vector.map(val => val / norm);
}

function multiplyMatrixVector(matrix, vector) {
    let result = Array(vector.length).fill(0);
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < vector.length; j++) {
            result[i] += matrix[i][j] * vector[j];
        }
    }
    return result;
}

export function findEigenVector(matrix, tolerance = 1e-9, maxIterations = 1000) {
    let vector = Array(matrix.length).fill(1);
    let lambdaOld = 1.0;
    let iterations = 0;

    while (true) {
        vector = multiplyMatrixVector(matrix, vector);
        vector = normalize(vector);
        const lambdaNew = vector.map((val, i) => matrix[i][i] * val).reduce((acc, val) => acc + val, 0);

        if (Math.abs(lambdaNew - lambdaOld) < tolerance || iterations >= maxIterations) {
            break;
        }

        lambdaOld = lambdaNew;
        iterations++;
    }

    return vector;
}

/**
 * just used for convex hull alignment, but if qcp keeps being annoying under JPL conventions it might find further use.
 * @param {(Vec3|THREE.Vector3)} points 
 */
export function getCovarianceMatrix(points) {
    let meanX = 0, meanY = 0, meanZ = 0;
    points.forEach(point => {
        meanX += point.x;
        meanY += point.y;
        meanZ += point.z;
    });
    meanX /= points.length;
    meanY /= points.length;
    meanZ /= points.length;

    const covarianceMatrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    points.forEach(point => {
        const x = point.x - meanX;
        const y = point.y - meanY;
        const z = point.z - meanZ;
        covarianceMatrix[0][0] += x * x;
        covarianceMatrix[0][1] += x * y;
        covarianceMatrix[0][2] += x * z;
        covarianceMatrix[1][0] += y * x;
        covarianceMatrix[1][1] += y * y;
        covarianceMatrix[1][2] += y * z;
        covarianceMatrix[2][0] += z * x;
        covarianceMatrix[2][1] += z * y;
        covarianceMatrix[2][2] += z * z;
    });
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            covarianceMatrix[i][j] /= points.length - 1;
        }
    }
    return covarianceMatrix;
}

/**
 * @param {BufferGeometry} defaultGeo default shape to return in case things go wrong
 * @param  {...(BufferGeometry|Vec3|Vector3)} things list of 3d object like things to extract points from. The extracted points will be used to form the convex hull. 
 * @return ConvexGeometry
 */
export function convexBlob(defaultGeo, ...things) {
    let allPoints = [];
    allPoints.push(...extractPoints(defaultGeo));
    for(let t of things) {
      	if(t instanceof THREE.BufferGeometry) {
        	allPoints.push(...extractPoints(t));
        } else if(t.x != null && t.y != null && t.z != null) {
            allPoints.push(new THREE.Vector3(t.x, t.y, t.z));
        }
    }
    try {
        return new ConvexGeometry(allPoints);
    } catch(e) {
        return defaultGeo;
    }
}


function extractPoints(geobuff) {
    let extracted = [];
    let c = geobuff.attributes.position.array; //vector components, I hope
    for(let i=0; i<c.length; i+=3) {
        extracted.push(new THREE.Vector3(c[i], c[i+1], c[i+2]));
    }
    return extracted;
}
