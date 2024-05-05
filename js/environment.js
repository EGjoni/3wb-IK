

import * as THREE from 'three';

const dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
dirLight.position.set( 1, 1.75, -1 );
dirLight.position.multiplyScalar( 5 );

const shadAmbient = new THREE.DirectionalLight( 0x3333ff, 1 );
shadAmbient.color.setRGB( 0.8, 0.8, 0.95 );
shadAmbient.position.set( 0,5,0);
shadAmbient.position.multiplyScalar(2);

const bounce = new THREE.DirectionalLight( 0xffffff, 0.5);
bounce.position.set(0,-1,0);
shadAmbient.position.multiplyScalar(2);
window.bounce = bounce;

window.hemiTopColor = new THREE.Color().setRGB(1,1,1);
window.groundColor = new THREE.Color().setRGB(0.9, 0.9, 0.9);
window.hemiBottomColor = groundColor;
const hemiLight = new THREE.HemisphereLight( hemiTopColor, window.hemiBottomColor, 1);
hemiLight.position.set( 0, 0, 0 );

const groundGeo = new THREE.PlaneGeometry( 1000, 1000 );
const groundMat = new THREE.MeshLambertMaterial( { color: groundColor } );

const ground = new THREE.Mesh( groundGeo, groundMat );

export {dirLight, hemiLight};
window.dirLight = dirLight; window.hemiLight = hemiLight;
window.shadAmbient = shadAmbient;

const env_fragmentShader = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float offset;
uniform float exponent;

varying vec3 vWorldPosition;

void main() {

    float h = normalize( vWorldPosition + offset ).y;
    gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );

}

`;
const env_vertexShader = `

varying vec3 vWorldPosition;

void main() {

    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    vWorldPosition = worldPosition.xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}

`;
const env_uniforms = {
    'topColor': { value: new THREE.Color(window.hemiTopColor)},
    'bottomColor': { value: new THREE.Color( window.hemiBottomColor ) },
    'offset': { value: 0 },
    'exponent': { value: 0.6 }
};

const skyGeo = new THREE.SphereGeometry( 100, 32, 15 );
const skyMat = new THREE.ShaderMaterial( {
    uniforms: env_uniforms,
    vertexShader: env_vertexShader,
    fragmentShader: env_fragmentShader,
    side: THREE.BackSide
} );
const sky = new THREE.Mesh( skyGeo, skyMat );


export function initEnvironment(scene, renderer, meshesList, layers) {
    renderer.autoClear = false;
    scene.background = new THREE.Color().setRGB( 1,1,1);
    let horizCol = new THREE.Color(hemiTopColor).lerp(groundColor, 0.5);
    scene.fog =  new THREE.Fog(horizCol, 20, 100);
    dirLight.intensity = 2;
    

    // LIGHTS

    //scene.add( hemiLight );
    scene.add( dirLight );
    scene.add(shadAmbient); 
    scene.add(bounce);

    shadAmbient.castShadow = true;
    dirLight.castShadow = true;

    dirLight.shadow.mapSize.width = 512;
    dirLight.shadow.mapSize.height = 512;
    shadAmbient.shadow.mapSize.height = 1028;
    shadAmbient.shadow.mapSize.width = 1028;

    setShadowD(2.5);
    
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.bias = - 0.0001;
    dirLight.shadow.blurSamples= 8; 
    dirLight.shadow.radius = 10;
    shadAmbient.shadow.camera.far = 50;
    shadAmbient.shadow.bias = - 0.0001;
    shadAmbient.intensity = dirLight.intensity * 0.7;
    shadAmbient.shadow.blurSamples = 16;
    shadAmbient.shadow.radius = 48;

    bounce.intensity = 0.4*dirLight.intensity;

    window.hemiLuminosity_base =  0.5; 
    window.ambLuminosity_base = ()=>0.7*dirLight.intensity;
    window.bounceLuminosity_base = ()=>0.4*dirLight.intensity;

    //const dirLightHelper = new THREE.DirectionalLightHelper( dirLight, 10 );
    //scene.add( dirLightHelper );

    // GROUND

    
    //ground.position.y = - 33;
    ground.rotation.x = - Math.PI / 2;
    ground.receiveShadow = true;
    scene.add( ground );


    shadAmbient.layers.set(0);
    dirLight.layers.set(0);
    
    for(let l in layers) {    
        bounce.layers.enable(l);    
        dirLight.layers.enable(l);
        //hemiLight.layers.enable(l);
    }

    // SKYDOME
 
    setSkyCols(hemiTopColor, hemiBottomColor, 1, scene);
    scene.add( sky );

    for(let mesh of meshesList) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap
}


export function setLuminosity(luminosity) {
    dirLight.intensity = luminosity;
    shadAmbient.intensity = window.ambLuminosity_base();
    bounceLuminosity_base = window.bounceLuminosity_base();
}
window.setLumens = setLuminosity;


window.fogProps = new THREE.Fog(new THREE.Color().setRGB(0.9, 0.9, 0.9), 20, 100); // new THREE.FogExp2(hemiLight.topColor, 0.06);
export function setSkyCols(c1, c2, intensity, scene) {
    hemiLight.color.set(c1);
    hemiLight.groundColor.set(c2);

    env_uniforms[ 'topColor' ].value.copy(hemiLight.color);
    env_uniforms['bottomColor'].value.copy( hemiLight.groundColor);
    let horizCol = new THREE.Color(hemiLight.color).lerp(hemiLight.groundColor, 0.5);
    fogProps.color.set(horizCol);
    window.scene.fog = fogProps;
}

function mixColors(color1, color2, factor) {
    const result = new THREE.Color(
        color1.r * (1 - factor) + color2.r * factor,
        color1.g * (1 - factor) + color2.g * factor,
        color1.b * (1 - factor) + color2.b * factor
    );
    return result;
}

window.fogoffset = 0;
const exponent = 0.6;

const cameraPos = new THREE.Vector3();
const cameraDir = new THREE.Vector3();
const upvec = new THREE.Vector3(0, 1, 0)

export function updateFogCols() {
    window.camera.getWorldPosition(cameraPos);
    cameraPos.y += fogoffset;
    window.camera.getWorldDirection(cameraDir);
    let topColor = hemiLight.color;
    let bottomColor = hemiLight.groundColor;
    const angle = cameraDir.angleTo(upvec); 
    const heightFactor = Math.max(Math.pow(Math.max(Math.cos(angle), 0.0), exponent), 0.0);
    const mixedColor = mixColors(bottomColor, topColor, heightFactor).multiplyScalar(0.8);

    if(window.scene.fog == null)
        window.scene.fog = fogProps;
    window.scene.fog.color.set(mixedColor);
        
}


window.updateFogColors = updateFogCols; 

export function setShadowD(d = 20, light = dirLight) {
    shadAmbient.shadow.camera.left = - d*2;
    shadAmbient.shadow.camera.right = d*2;
    shadAmbient.shadow.camera.top = d*1.5*2;
    shadAmbient.shadow.camera.bottom = - d*.5*2;
    shadAmbient.shadow.radius = 160/(3/d);

    dirLight.shadow.camera.left = - d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d*1.5;
    dirLight.shadow.camera.bottom = - d*.5;
    dirLight.shadow.radius = 10/(3/d);
    
    dirLight.shadow.camera.updateProjectionMatrix();
    shadAmbient.shadow.camera.updateProjectionMatrix();
}

window.setShadowDist = setShadowD;
window.setSkyC = setSkyCols;

export function getMeshDescendants(object) {
    const meshes = [];
    object.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
      }
    });
    return meshes;
  }