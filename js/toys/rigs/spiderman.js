import { Rest, Kusudama, Twist } from "../../EWBIK/betterbones/Constraints/ConstraintStack.js";

export function initSpidey(armature) {
    initSpideyShortcuts(armature);
    //fix weird heel orientation that came with the model
    armature.r_heel.rotateX(-Math.PI/2);
    armature.l_heel.rotateX(-Math.PI/2);
    armature.c_hips.parent.position.z = armature.c_hips.position.z - 0.01;
    armature.c_hips.position.z = 0.01;
    armature.c_hips.parent.trackedBy.mimic();
    //armature.c_hips.trackedBy.mimic();
    armature.makeBoneMesh(armature.c_hips.parent, armature.c_hips.parent.boneRadius);
    initSpideyPins(armature);
    initSpideyConstraints(armature);
}

export function initSpideyShortcuts(armature) {
    armature.l_shoulder = armature.bonetags["shoulderL_033"];
    armature.l_arm_upp = armature.bonetags["upper_armL_034"];
    armature.r_shoulder = armature.bonetags["shoulderR_014"];
    armature.r_arm_upp = armature.bonetags["upper_armR_015"];
    armature.l_arm_lower = armature.bonetags["forearmL_035"];
    armature.l_hand = armature.bonetags["handL_036"];
    armature.r_arm_lower = armature.bonetags["forearmR_016"];
    armature.r_hand = armature.bonetags["handR_017"];
    armature.l_leg_upp = armature.bonetags["thighL_057"];
    armature.r_leg_upp = armature.bonetags["thighR_052"];
    armature.l_leg_lower = armature.bonetags["shinL_058"];
    armature.r_leg_lower = armature.bonetags["shinR_053"];
    armature.c_head = armature.bonetags["head_013"];
    armature.c_lower_neck = armature.bonetags["spine004_011"];
    armature.c_neck = armature.bonetags["spine005_012"];
    armature.c_chest = armature.bonetags["spine003_010"];
    armature.r_foot = armature.bonetags["footR_054"];
    armature.r_toes = armature.bonetags["toeR_055"];
    armature.l_foot = armature.bonetags["footL_059"];
    armature.l_toes = armature.bonetags["toeL_061"];
    armature.c_hips = armature.bonetags['spine_07'];
    armature.r_heel = armature.bonetags['heel02R_056']; 
    armature.l_heel = armature.bonetags['heel02L_062'];
}

export function initSpideyPins(armature) {
    armature.head_pin = new IKPin(armature.c_head);
    armature.hip_pin = new IKPin(armature.c_hips).setDepthFalloff(0.8);
    armature.l_hand_pin = new IKPin(armature.l_hand).setTargetPriorities(0.5, 0.035, 0);
    armature.r_hand_pin = new IKPin(armature.r_hand).setTargetPriorities(0.5, 0.035, 0);
    armature.l_foot_pin = new IKPin(armature.l_foot);
    armature.r_foot_pin = new IKPin(armature.r_foot);
}


export function initSpideyConstraints(armature) {


    new Rest(armature.c_hips.parent).setPainfulness(0.9).setStockholmRate(0.9);
    new Rest(armature.c_hips).setPainfulness(0.9).setStockholmRate(0.9);
    new Kusudama(armature.bonetags["spine002_09"], (t, b) => b==contextBone, "Kusudama for spine002_09", armature.stablePool)
            .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9831896981103287, -0.18258701358453502), 1);
new Twist(armature.bonetags["spine002_09"], 0.4743, undefined, 
                armature.stablePool.any_Vec3(0, 0.9831896981103287, -0.18258701358453502), 
                2.9802322387695312e-8, (cnstrt, bone) => bone == contextBone,
                "Twist for spine002_09", armature.stablePool);
            
                new Kusudama(armature.bonetags["spine001_08"], (t, b) => b==contextBone, "Kusudama for spine001_08", armature.stablePool)
                .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9876899856707104, 0.15297546868944029), 1);
    

new Twist(armature.bonetags["spine001_08"], 0.45229, undefined, 
                armature.stablePool.any_Vec3(0, 0.9876899856707104, 0.15297546868944029), 
                0.02940430593430481, (cnstrt, bone) => bone == contextBone,
                "Twist for spine001_08", armature.stablePool);

    new Kusudama(armature.r_shoulder, (t, b) => b == window.contextBone, "Kusudama for r_shoulder", armature.stablePool)
    .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9234034614556849, 0.3796470573239536, -0.05651689337642643), 0.49822);
    new Twist(armature.r_shoulder, 0.29084, undefined,
        armature.stablePool.any_Vec3(0.9342591824772337, 0.20611868726697868, -0.29098946152104604),
        (2*Math.PI)-5.114, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_shoulder", armature.stablePool);

    new Kusudama(armature.bonetags["shoulderL_033"], (t, b) => b == window.contextBone, "Kusudama for l_shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9234034614556849, 0.3796470573239536, -0.05651689337642643), 0.49822);
    new Twist(armature.bonetags["shoulderL_033"], 0.38963, undefined, 
        armature.stablePool.any_Vec3(0.9342591824772337, 0.20611868726697868, -0.29098946152104604), 
        5.114, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_shoulder", armature.stablePool);

    new Kusudama(armature.r_arm_upp, (t, b) => b == window.contextBone, "Kusudama for r_upper_arm", armature.stablePool)
    .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.8186474380747609, 0.5382146563145274, -0.2003530779944895), 0.92).parentKusudama
    .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.38672979272511104, 0.6016821382145863, -0.6988695672100168), 0.79458);
    new Twist(armature.r_arm_upp, 1.43, undefined,
        armature.stablePool.any_Vec3(-0.19765725864385672, 0.6861845514400442, -0.7000590857001268), 
        4.648596915193773, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_upper_arm", armature.stablePool);

    
new Kusudama(armature.bonetags["upper_armL_034"], (t, b) => b == window.contextBone, "Kusudama for l_arm_upp", armature.stablePool)
.addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.8186474380747609, 0.5382146563145274, -0.2003530779944895), 0.92).parentKusudama
.addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.38672979272511104, 0.6016821382145863, -0.6988695672100168), 0.79458);
new Twist(armature.bonetags["upper_armL_034"], 1.43, undefined, 
            armature.stablePool.any_Vec3(0.19765725864385672, 0.6861845514400442, -0.7000590857001268), 
            4.64-Math.PI, (cnstrt, bone) => bone == window.contextBone,
            "Twist for l_arm_upp", armature.stablePool);

   



    new Kusudama(armature.r_arm_lower, (t, b) => b == window.contextBone, "kusudama for r_lower_arm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.16618547478186, 0.98097177500336, 0.10038308930435011), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.20139736184234602, -0.8191561141602648, 0.5370496841790323), 0.05);
    new Twist(armature.r_arm_lower, 3, undefined,
        armature.stablePool.any_Vec3(0.05613653192443465, 0.7076233411995483, 0.704356373097492), 
            6.110937091931663, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_lower_arm", armature.stablePool);


new Kusudama(armature.bonetags["forearmL_035"], (t, b) => b == window.contextBone, "Kusudama for l_lower_arm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.16618547478186, 0.98097177500336, 0.10038308930435011), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.20139736184234602, -0.8191561141602648, 0.5370496841790323), 0.05);
new Twist(armature.bonetags["forearmL_035"], 3, undefined, 
            armature.stablePool.any_Vec3(-0.05613653192443465, 0.7076233411995483, 0.704356373097492), 
            6.110937091931663, (cnstrt, bone) => bone == window.contextBone,
            "Twist for l_lower_arm", armature.stablePool);


            new Kusudama(armature.r_hand, (t, b) => b == window.contextBone, "Kusudama for r_hand", armature.stablePool)
            .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9959155399431063, -0.005407659407767647, -0.09012765679612746), 0.11014).parentKusudama
            .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0, 1, 0), 0.45589).parentKusudama
            .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.8236815497888856, 0.5651134455268308, -0.046856143910624294), 0.13131);
        new Twist(armature.r_hand, 0.40374, undefined,
            armature.stablePool.any_Vec3(-0.24068120263736897, 0.9654306289398743, 0.10008066683377576), 
            6.215, (cnstrt, bone) => bone == window.contextBone,
            "Twist for r_hand", armature.stablePool);

new Kusudama(armature.bonetags["handL_036"], (t, b) => b == window.contextBone, "Kusudama for l_hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9959155399431063, -0.005407659407767647, -0.09012765679612746), 0.11014).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 1, 0), 0.45589).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0.8236815497888856, 0.5651134455268308, -0.046856143910624294), 0.13131);
new Twist(armature.bonetags["handL_036"], 0.20617, undefined, 
            armature.stablePool.any_Vec3(0.24068120263736897, 0.9654306289398743, 0.10008066683377576), 
            6.215, (cnstrt, bone) => bone == window.contextBone,
            "Twist for l_hand", armature.stablePool);

    /*new Kusudama(armature.bonetags["J_Bip_C_Spine"], (t, b) => b == window.contextBone, "Kusudama for J_Bip_C_Spine", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.99, -0.16), 0.41355);
    new Twist(armature.bonetags["J_Bip_C_Spine"], 0.62953, undefined,
        armature.stablePool.any_Vec3(-1.8374118504407587e-16, 0.9996360572455434, -0.02697689853531279),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_C_Spine", armature.stablePool);*/

    new Kusudama(armature.c_chest, (t, b) => b == window.contextBone, "Kusudama for c_chest", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.990869672460897, -0.19), 0.54056);
    new Twist(armature.c_chest, 0.88355, undefined,
        armature.stablePool.any_Vec3(0, 0.9908696724608967, 0.13482318864807638),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_chest", armature.stablePool);

    new Kusudama(armature.c_lower_neck, (t, b) => b == window.contextBone, "Kusudama for c_lower_neck", armature.stablePool)
    .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.7798242609044459, 0.6259985000819192), 0.47);
    new Twist(armature.c_lower_neck, 1.25046, undefined,
        armature.stablePool.any_Vec3(0, 0.9983219856621794, -0.057906933466761526),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_lower_neck", armature.stablePool);

    new Kusudama(armature.c_neck, (t, b) => b == window.contextBone, "Kusudama for c_neck", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-3.661705994390258e-9, 0.9917943192012539, -0.12784376558957108), 0.49117);
    new Twist(armature.c_neck, 1.21177, undefined,
        armature.stablePool.any_Vec3(0, 0.9917943192012544, -0.12784376558957114),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_C_Neck", armature.stablePool);


    new Kusudama(armature.c_head, (t, b) => b == window.contextBone, "Kusudama for c_head", armature.stablePool)
    .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.09668910198505581, 0.5325939284982502, -0.840829902467868), 0.11014).parentKusudama
    .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.047359259441469084, 0.9171828218882792, -0.39564222699076096), 0.11014).parentKusudama
    .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.058507122050778224, 0.8412203219497876, 0.0175177081808852), 0.11014);
    new Twist(armature.c_head, 1.3, undefined,
        armature.stablePool.any_Vec3(0, 0.9768661054817855, -0.21371514449269446),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_head", armature.stablePool);


    new Kusudama(armature.bonetags["thighL_057"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for l_leg_upp", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.2505336783387944, -0.2645716928861982, 0.9312543666159987), 0.48411).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.3143631992559614, -0.7667395103803937, 0.5597198425776874), 0.80869).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, -0.9578262852211515, -0.28734788556634544), 0.45589);
    new Twist(armature.bonetags["thighL_057"], 0.70009, undefined, 
            armature.stablePool.any_Vec3(0.08630285555419352, -0.9938214452812402, -0.06978792639209032), 
            4.397, (cnstrt, bone) => bone == window.contextBone,
            "Twist for l_leg_upp", armature.stablePool);


     new Kusudama(armature.bonetags["shinL_058"], (t, b) => b == window.contextBone, "Kusudama for l_leg_lower", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.07690675862534149, -0.9469168519976965, 0.31214391853841394), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.07185886843191087, 0.9971602774691865, 0.022531845580433706), 0.12425);
    new Twist(armature.bonetags["shinL_058"], 0.34729, undefined, 
            armature.stablePool.any_Vec3(0, -0.998718206435709, 0.05061565107593398), 
            0, (cnstrt, bone) => bone == window.contextBone,
            "Twist for l_leg_lower", armature.stablePool);

    new Kusudama(armature.l_foot, (t, b) => b == window.contextBone, "Kusudama for l_foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.5256465905493974, -0.8507030397522946), 0.75224);
    new Twist(armature.l_foot, 1.78672, undefined,
        armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946),
        6.19399, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_foot", armature.stablePool);

    new Kusudama(armature.r_leg_upp, (cnstrt, bone) => bone == window.contextBone, "Kusudama for r_leg_upp", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.2505336783387944, -0.2645716928861982, 0.9312543666159987), 0.48411).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.3143631992559614, -0.7667395103803937, 0.5597198425776874), 0.80869).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0, -0.9578262852211515, -0.28734788556634544), 0.45589);
    new Twist(armature.r_leg_upp, 0.70009, undefined,
        armature.stablePool.any_Vec3(-1.9041464198590058e-8, -0.9996624984362763, 0.025978630066681115),
        2.385, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_leg_upp", armature.stablePool);

    new Kusudama(armature.r_leg_lower, (t, b) => b == window.contextBone, "Kusudama for r_leg_lower", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.07690675862534149, -0.9469168519976965, 0.31214391853841394), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.07185886843191087, 0.9971602774691865, 0.022531845580433706), 0.12425);
    new Twist(armature.r_leg_lower, 0.34729, undefined,
        armature.stablePool.any_Vec3(0, -0.9987182064357158, 0.050615651075934326),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_leg_lower", armature.stablePool);

    new Kusudama(armature.r_foot, (t, b) => b == window.contextBone, "Kusudama for r_foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.5256465905493974, -0.8507030397522946), 0.75224);
    new Twist(armature.r_foot, 1.78672, undefined,
        armature.stablePool.any_Vec3(0, -0.5256465905493974, -0.8507030397522946),
        6.19399, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_foot", armature.stablePool);


    for (let b of armature.bones) {
        if(b.getConstraint() == null) {
            let restconst = new Rest(b);
        }
    }
}