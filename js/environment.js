

import * as THREE from 'three';

const dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
dirLight.color.setHSL( 0.1, 1, 0.95 );
dirLight.position.set( 1, 1.75, -1 );
dirLight.position.multiplyScalar( 5 );

export function initEnvironment(scene, renderer, meshesList, layers) {
    renderer.autoClear = false;
    scene.background = new THREE.Color().setHSL( 0.6, 0, 1 );
    scene.fog = new THREE.Fog( scene.background, 1, 15 );

    // LIGHTS

    const hemiLight = new THREE.HemisphereLight( 0x9999ff, 0x333300, 1 );
    hemiLight.color.setHSL( 0.6, 1, 0.6 );
    hemiLight.groundColor.setHSL( 0.095, 1, 0.75 );
    hemiLight.position.set( 0, 0, 0 );
    scene.add( hemiLight );

    scene.add( dirLight );

    dirLight.castShadow = true;

    dirLight.shadow.mapSize.width = 1028;
    dirLight.shadow.mapSize.height = 1028;

    setShadowD(20);
    

    dirLight.shadow.camera.far = 500;
    dirLight.shadow.bias = - 0.0001;

    //const dirLightHelper = new THREE.DirectionalLightHelper( dirLight, 10 );
    //scene.add( dirLightHelper );

    // GROUND

    const groundGeo = new THREE.PlaneGeometry( 1000, 1000 );
    const groundMat = new THREE.MeshLambertMaterial( { color: 0xffffff } );
    groundMat.color.setHSL( 0.095, 1, 0.75 );

    const ground = new THREE.Mesh( groundGeo, groundMat );
    //ground.position.y = - 33;
    ground.rotation.x = - Math.PI / 2;
    ground.receiveShadow = true;
    scene.add( ground );

    for(let l in layers) {
        dirLight.layers.enable(l);
        hemiLight.layers.enable(l);
    }

    // SKYDOME

    const fragmentShader = `
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
    const vertexShader = `

    varying vec3 vWorldPosition;

    void main() {

        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
        vWorldPosition = worldPosition.xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    }

`;
    const uniforms = {
        'topColor': { value: new THREE.Color( 0x0077ff ) },
        'bottomColor': { value: new THREE.Color( 0xffffff ) },
        'offset': { value: 33 },
        'exponent': { value: 0.6 }
    };
    uniforms[ 'topColor' ].value.copy( hemiLight.color );

    scene.fog.color.copy( uniforms[ 'bottomColor' ].value );

    const skyGeo = new THREE.SphereGeometry( 100, 32, 15 );
    const skyMat = new THREE.ShaderMaterial( {
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.BackSide
    } );

    const sky = new THREE.Mesh( skyGeo, skyMat );
    scene.add( sky );

    for(let mesh of meshesList) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
    }

    renderer.shadowMap.enabled = true;
}

export function setShadowD(d = 20) {
    dirLight.shadow.camera.left = - d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d*1.5;
    dirLight.shadow.camera.bottom = - d*.5;
}


export function getMeshDescendants(object) {
    const meshes = [];
    object.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
      }
    });
    return meshes;
  }