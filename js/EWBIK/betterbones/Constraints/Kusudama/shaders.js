export const kusudamaVertShader = /*glsl*/`
varying vec3 vertNormal;
varying vec3 vertViewNormal;
varying vec4 color;

void main() {
    vertViewNormal = normalize(normalMatrix * normal); // Transform normal to view space and normalize
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vertNormal = normalize(normal);
}
`

export const kusudamaFragShader = /*glsl*/`
#ifdef GL_ES
precision mediump float;
precision mediump int;
#endif

uniform vec2 screensize;
uniform vec4 shellColor;

//Model space normal direction of the current fragment
//since we're on a sphere, this is literally just the fragment's position in 
//modelspace
varying vec3 vertNormal;

//This shader can display up to 30 cones represented by 120 4d vectors, 
//where the 0th vector and every 3rd vector from there represent the limitcones and the two vectors after each limitcone represent the tangent cones which bound it.
// for each conve, the alphachannel represents radius, rgb channels represent xyz coordinates of 
// the cone direction vector in model space
uniform vec4 coneSequence[120];
uniform int coneCount; 
uniform int frame;

//Make this "true" for screendoor transparency (randomly discarding fragments)
//so that you can blur the result in another pass. Otherwise make it  
//false for a solid shell.  
uniform bool multiPass;

//Following three varyings are 
//Only used for fake lighting. 
//Not conceptually relevant
varying vec3 vertViewNormal;
uniform vec3 vertLightDir;


float hash(float n) {
    float x = sin(n) * 43758.5453123;
    return fract(x);
}

float noise(vec2 U) {
    //return hash((U.x+(5000.0+(frame/1000.0)))*U.y);
    return hash(U.x+5000.0*U.y);
}

bool randBit(vec2 U, float thresh) {
    float dist2 = 1.0;
    return thresh < (noise(U) * 4. -(noise(U+vec2(dist2,0.))+noise(U+vec2(0.,dist2))+noise(U-vec2(0.,dist2))+noise(U-vec2(dist2,0.))) + 0.5);
}
///END OF NOISE FUNCTIONS FOR FANCY TRANSPARENCY RENDERING.

bool isInInterConePath(in vec3 normalDir, in vec4 tangent1, in vec4 cone1, in vec4 tangent2, in vec4 cone2) {			
    vec3 c1xc2 = cross(cone1.xyz, cone2.xyz);		
    float c1c2dir = dot(normalDir, c1xc2);
        
    if(c1c2dir < 0.0) { 
        vec3 c1xt1 = cross(cone1.xyz, tangent1.xyz); 
        vec3 t1xc2 = cross(tangent1.xyz, cone2.xyz);	
        float c1t1dir = dot(normalDir, c1xt1);
        float t1c2dir = dot(normalDir, t1xc2);
        
        return (c1t1dir > 0.0 && t1c2dir > 0.0); 
            
    }else {
        vec3 t2xc1 = cross(tangent2.xyz, cone1.xyz);	
        vec3 c2xt2 = cross(cone2.xyz, tangent2.xyz);	
        float t2c1dir = dot(normalDir, t2xc1);
        float c2t2dir = dot(normalDir, c2xt2);
        
        return (c2t2dir > 0.0 && t2c1dir > 0.0);
    }	
    return false;
}

//determines the current draw condition based on the desired draw condition in the setToArgument
// -3 = disallowed entirely; 
// -2 = disallowed and on tangentCone boundary
// -1 = disallowed and on controlCone boundary
// 0 =  allowed and empty; 
// 1 =  allowed and on controlCone boundary
// 2  = allowed and on tangentCone boundary
int getAllowabilityCondition(in int currentCondition, in int setTo) {
    if((currentCondition == -1 || currentCondition == -2)
        && setTo >= 0) {
        return currentCondition *= -1;
    } else if(currentCondition == 0 && (setTo == -1 || setTo == -2)) {
        return setTo *=-2;
    }  	
    return max(currentCondition, setTo);
}



//returns 1 if normalDir is beyond (cone.a) radians from cone.rgb
//returns 0 if normalDir is within (cone.a + boundaryWidth) radians from cone.rgb 
//return -1 if normalDir is less than (cone.a) radians from cone.rgb
int isInCone(in vec3 normalDir, in vec4 cone, in float boundaryWidth) {
    float arcDistToCone = acos(dot(normalDir, cone.rgb));
    if(arcDistToCone > (cone.a+(boundaryWidth/2.))) {
        return 1; 
    }
    if(arcDistToCone < cone.a-(boundaryWidth/2.)) {
        return -1;
    }
    return 0;
} 

//returns a color corresponding to the allowability of this region, or otherwise the boundaries corresponding 
//to various cones and tangentCone 
vec4 colorAllowed(in vec3 normalDir,  in int coneCount, in float boundaryWidth) {
    normalDir = normalize(normalDir);
    int currentCondition = -3;
    bool isInIntercone = false;
    bool isOnTanBoundary = false;
    bool isOnConeBoundary = false;
    bool isInExpCone = false; 
    
    if(coneCount == 1) {
        vec4 cone = coneSequence[0];
        int inCone = isInCone(normalDir, cone, boundaryWidth);
        inCone = inCone == 0 ? -1 : inCone < 0 ? 0 : -3;
        currentCondition = getAllowabilityCondition(currentCondition, inCone);
    } else {
        for(int i=0; i<coneCount-1; i++) {
            
            int idx = i*3; 
            vec4 cone1 = coneSequence[idx];
            vec4 tangent1 = coneSequence[idx+1];			
            vec4 tangent2 = coneSequence[idx+2];			
            vec4 cone2 = coneSequence[idx+3];
                                        
            int inCone1 = isInCone(normalDir, cone1, boundaryWidth);
            isInExpCone = inCone1 == -1 || isInExpCone;
            inCone1 = inCone1 == 0 ? -1 : inCone1 < 0 ? 0 : -3;
            currentCondition = getAllowabilityCondition(currentCondition, inCone1);
                
            int inCone2 = isInCone(normalDir, cone2, boundaryWidth);
            isInExpCone = inCone2 == -1 || isInExpCone;
            inCone2 =  inCone2 == 0 ? -1 : inCone2  < 0 ? 0 : -3;
            currentCondition = getAllowabilityCondition(currentCondition, inCone2);
        
            int inTan1 = isInCone(normalDir, tangent1, boundaryWidth); 
            int inTan2 = isInCone(normalDir, tangent2, boundaryWidth);
            if(inTan1 == 0) isOnTanBoundary = true;
            if(inTan2 == 0 ) isOnTanBoundary = true;
            if( inTan1 < 1 || inTan2  < 1) {			
                inTan1 =  inTan1 == 0 ? -2 : -3;
                currentCondition = getAllowabilityCondition(currentCondition, inTan1);
                isOnConeBoundary = currentCondition == 1 || currentCondition == -1 || isOnConeBoundary;
                inTan2 =  inTan2 == 0 ? -2 : -3;
                currentCondition = getAllowabilityCondition(currentCondition, inTan2);
                isOnConeBoundary = currentCondition == 1 || currentCondition == -1 || isOnConeBoundary;
            } else {				 
                bool inIntercone = isInInterConePath(normalDir, tangent1, cone1, tangent2, cone2);
                isInIntercone = isInIntercone || inIntercone;
                int interconeCondition = inIntercone ? 0 : -3; 
                currentCondition = getAllowabilityCondition(currentCondition, interconeCondition);					
            }
        }
    }	
    
    vec4 result = shellColor;
    
    if(((isOnTanBoundary && (isInIntercone || isInExpCone)) && !isOnConeBoundary)){
        discard;
    }
    if(multiPass && ((currentCondition == -3 || currentCondition > 0 || isOnTanBoundary) && !(isOnTanBoundary && isInIntercone))) {
        
        /////////
        //CODE FOR FANCY BLURRED TRANSPARENCY. 
        //NOT OTHERWISE CONCEPTUALLY RELEVANT TO 
        //TO VISUALIZATION
        ////////
        float thicc = (1.0-abs(dot(vertViewNormal, vec3(0,0,1))));
        float away = dot(vertViewNormal, vec3(0,0,1));
        float approxdir = (away)/2.0;
        int dir = int(round(approxdir));
        //int dith = ((2*int(gl_FragCoord.x)) + (int(3.0*gl_FragCoord.y)) + frame) % 2; 
        int dithX = ((dir+int(gl_FragCoord.x)) + 0) % 8; 
        int dithY = ((dir+int(gl_FragCoord.y)) + frame) % 8; 
        //dith = (dith + ((int(gl_FragCoord.y)) + (frame-1))) % 2; 
        result = vec4(0.0,0.0,0.0,1.0);
        if((dithX + dithY) % 4 == 0) {// > 6) {
        //if(dithX > 3 && dithY < 3) {
            result.a = 0.0;
        }
        if(away < 0.0) {
            result.r = 1.0;
        }
    } else if (currentCondition != 0) {
        discard;
        float onTanBoundary = abs(currentCondition) == 2 ? 0.3 : 0.0; 
        float onConeBoundary = abs(currentCondition) == 1 ? 0.3 : 0.0;
        if(isOnTanBoundary && isInIntercone)
            discard;
        //return distCol;
        //result = vec4(0.5, onConeBoundary, 0.0, 1.0);
    } else {
        discard;
    }
    return result;
            
}

void main() {

    vec3 normalDir = normalize(vertNormal); // the vertex normal in Model Space.
    float basedir =  dot(vertViewNormal, vec3(0,0,1));
    float lightScalar = ((basedir+0.75)*.5)+.5;//abs(basedir*.75)+.25;
    vec4 sc = vec4(shellColor.rgb*lightScalar, 1.0);
    vec4 colorAllowed = colorAllowed(normalDir, coneCount, 0.005);  

    if(colorAllowed.a == 0.0) {
        discard;
    } else {             
        vec4 mixedCol = vec4(sc.rgb+colorAllowed.rgb, colorAllowed.a);   
        gl_FragColor = sc;
    }    
    /*colorAllowed += shellColor*(colorAllowed + fwidth(colorAllowed)); 
    colorAllowed /= 2.0;
    vec3 lightCol = vec3(1.0,0.3,0.0);
    float gain = vertViewNormal.z < 0. ? -0.3 : 0.5;
    colorAllowed.rgb = (colorAllowed.rgb + lightCol*(lightScalar + gain)) / 2.;
    vec4 specCol = vec4(0.8, 0.2, 0.1, colorAllowed.a);  
    colorAllowed = colorAllowed.r > 0.8 ? colorAllowed+specCol : colorAllowed;
    gl_FragColor = colorAllowed;//vec4(shellColor.rgb*colorAllowed.a, colorAllowed.a);*/
}
`


