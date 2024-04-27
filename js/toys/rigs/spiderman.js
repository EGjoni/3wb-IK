import { Rest, Kusudama, Twist } from "../../EWBIK/betterbones/Constraints/ConstraintStack.js";

export function initSpidey(armature) {
    initSpideyShortcuts(armature);
    //fix weird heel orientation that came with the model
    armature.r_heel.rotateX(-Math.PI / 2);
    armature.l_heel.rotateX(-Math.PI / 2);
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



    new Kusudama(armature.bonetags["spine001_08"], (t, b) => b == contextBone, "Kusudama for spine001_08", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9882173394334307, 0.15305714633140047), 1);
    new Twist(armature.bonetags["spine001_08"], 0.45229, undefined,
        armature.stablePool.any_Vec3(0.03266493816063039, 0.9876899856707104, 0.15297546868944029),
        0.02940430593430481, (cnstrt, bone) => bone == contextBone,
        "Twist for spine001_08", armature.stablePool);
    new Kusudama(armature.bonetags["spine002_09"], (t, b) => b == contextBone, "Kusudama for spine002_09", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9831896981103294, -0.18258701358453516), 1);
    new Twist(armature.bonetags["spine002_09"], 0.4743, undefined,
        armature.stablePool.any_Vec3(3.895379812138896e-8, 0.9831896981103287, -0.18258701358453502),
        2.9802322387695312e-8, (cnstrt, bone) => bone == contextBone,
        "Twist for spine002_09", armature.stablePool);
    new Kusudama(armature.bonetags["spine003_010"], (t, b) => b == window.contextBone, "Kusudama for c_chest", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9821077424398447, -0.18831989337218755), 0.54056);
    new Twist(armature.bonetags["spine003_010"], 0.88355, undefined,
        armature.stablePool.any_Vec3(2.2172618973788817e-8, 0.9974388759579418, -0.071524043004835),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_chest", armature.stablePool);
    new Kusudama(armature.bonetags["spine004_011"], (t, b) => b == window.contextBone, "Kusudama for c_lower_neck", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.7798242609044546, 0.6259985000819261), 0.47);
    new Twist(armature.bonetags["spine004_011"], 1.25046, undefined,
        armature.stablePool.any_Vec3(-1.4924975765388679e-7, 0.7798242609044459, 0.6259985000819192),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_lower_neck", armature.stablePool);
    new Kusudama(armature.bonetags["spine005_012"], (t, b) => b == window.contextBone, "Kusudama for c_neck", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-3.661705994390258e-9, 0.9917943192012539, -0.12784376558957108), 0.49117);
    new Twist(armature.bonetags["spine005_012"], 1.21177, undefined,
        armature.stablePool.any_Vec3(-0.0027775330586178935, 0.99638484557969, -0.08490892066942272),
        6.17032572709255, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_C_Neck", armature.stablePool);
    new Kusudama(armature.bonetags["head_013"], (t, b) => b == window.contextBone, "Kusudama for c_head", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.09668910198505581, 0.5325939284982502, -0.840829902467868), 0.11014).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.0473592594414691, 0.9171828218882794, -0.39564222699076107), 0.11014).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.06936772106910766, 0.997374928133243, 0.02076949698204317), 0.11014);
    new Twist(armature.bonetags["head_013"], 1.3, undefined,
        armature.stablePool.any_Vec3(0.047359259441469105, 0.9171828218882796, -0.3956422269907611),
        0.11216436418255674, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_head", armature.stablePool);

    new Kusudama(armature.bonetags["shoulderR_014"], (t, b) => b == window.contextBone, "Kusudama for r_shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9234034614556849, 0.3796470573239536, -0.05651689337642643), 0.49822);
    new Twist(armature.bonetags["shoulderR_014"], 0.29084, undefined,
        armature.stablePool.any_Vec3(-0.9370660588579662, 0.20872939670328772, -0.2798914794849611),
        5.173925690745474, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_shoulder", armature.stablePool);
    new Kusudama(armature.bonetags["upper_armR_015"], (t, b) => b == window.contextBone, "Kusudama for r_upper_arm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.8186474380747609, 0.5382146563145274, -0.2003530779944895), 0.92).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.38672979272511104, 0.6016821382145863, -0.6988695672100168), 0.79458);
    new Twist(armature.bonetags["upper_armR_015"], 1.43, undefined,
        armature.stablePool.any_Vec3(-0.19316724042125555, 0.6649372752097964, -0.7214879328613946),
        1.6389929939502001, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_upper_arm", armature.stablePool);
    new Kusudama(armature.bonetags["forearmR_016"], (t, b) => b == window.contextBone, "kusudama for r_lower_arm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.16618547478186, 0.98097177500336, 0.10038308930435011), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.20139736184234602, -0.8191561141602648, 0.5370496841790323), 0.05);
    new Twist(armature.bonetags["forearmR_016"], 3, undefined,
        armature.stablePool.any_Vec3(0.14084953614985116, 0.9465392690011472, 0.2902151278020251),
        0.12536180249386888, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_lower_arm", armature.stablePool);
    new Kusudama(armature.bonetags["handR_017"], (t, b) => b == window.contextBone, "Kusudama for r_hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9959155399431063, -0.005407659407767647, -0.09012765679612746), 0.11014).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 1, 0), 0.45589).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.8236815497888856, 0.5651134455268308, -0.046856143910624294), 0.13131);
    new Twist(armature.bonetags["handR_017"], 0.40374, undefined,
        armature.stablePool.any_Vec3(-0.22883990530620538, 0.9725239003646375, 0.04277336740310204),
        6.1926262035523365, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_hand", armature.stablePool);




















    new Kusudama(armature.bonetags["shoulderL_033"], (t, b) => b == window.contextBone, "Kusudama for l_shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9234034614556849, 0.3796470573239536, -0.05651689337642643), 0.49822);
    new Twist(armature.bonetags["shoulderL_033"], 0.38963, undefined,
        armature.stablePool.any_Vec3(0.9370661889569263, 0.20872929502012916, -0.2798911197486312),
        1.1092598334783703, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_shoulder", armature.stablePool);
    new Kusudama(armature.bonetags["upper_armL_034"], (t, b) => b == window.contextBone, "Kusudama for l_arm_upp", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.8186474380747609, 0.5382146563145274, -0.2003530779944895), 0.92).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.38672979272511104, 0.6016821382145863, -0.6988695672100168), 0.79458);
    new Twist(armature.bonetags["upper_armL_034"], 1.43, undefined,
        armature.stablePool.any_Vec3(0.19316721280701366, 0.6649370926058564, -0.72148810854597),
        4.644192267206221, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_arm_upp", armature.stablePool);
    new Kusudama(armature.bonetags["forearmL_035"], (t, b) => b == window.contextBone, "Kusudama for l_lower_arm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.16618547478186, 0.98097177500336, 0.10038308930435011), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.20139736184234602, -0.8191561141602648, 0.5370496841790323), 0.05);
    new Twist(armature.bonetags["forearmL_035"], 3, undefined,
        armature.stablePool.any_Vec3(-0.14084948568621358, 0.9465393040346166, 0.29021503803144566),
        6.157823438805987, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_lower_arm", armature.stablePool);
    new Kusudama(armature.bonetags["handL_036"], (t, b) => b == window.contextBone, "Kusudama for l_hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9959155399431063, -0.005407659407767647, -0.09012765679612746), 0.11014).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 1, 0), 0.45589).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0.8236815497888856, 0.5651134455268308, -0.046856143910624294), 0.13131);
    new Twist(armature.bonetags["handL_036"], 0.20617, undefined,
        armature.stablePool.any_Vec3(0.22883895568513785, 0.9725241221849448, 0.042773404462795504),
        0.09055904598202616, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_hand", armature.stablePool);




















    new Kusudama(armature.bonetags["thighR_052"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for r_leg_upp", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.2505336783387944, -0.2645716928861982, 0.9312543666159987), 0.73411).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.3143631992559614, -0.7667395103803937, 0.5597198425776874), 0.80869).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, -0.9578262852211515, -0.28734788556634544), 0.45589);
    new Twist(armature.bonetags["thighR_052"], 1.85728, undefined,
        armature.stablePool.any_Vec3(-0.15629108844971473, -0.9847655067658432, -0.0762315409570148),
        4.010733675646572, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_leg_upp", armature.stablePool);
    new Kusudama(armature.bonetags["shinR_053"], (t, b) => b == window.contextBone, "Kusudama for r_leg_lower", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.0769067586253415, -0.9469168519976967, 0.312143918538414), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.07185886843191087, 0.9971602774691865, 0.022531845580433706), 0.12425);
    new Twist(armature.bonetags["shinR_053"], 0.34729, undefined,
        armature.stablePool.any_Vec3(0.07185788339133507, 0.9971603863605571, 0.022530167948370733),
        0.02673262973658783, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_leg_lower", armature.stablePool);
    new Kusudama(armature.bonetags["footR_054"], (t, b) => b == window.contextBone, "Kusudama for r_foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.5256465905493974, -0.8507030397522946), 0.75224);
    new Twist(armature.bonetags["footR_054"], 1.78672, undefined,
        armature.stablePool.any_Vec3(0.17178700068731637, 0.6114610515027255, -0.7724018441782995),
        0.030739452093447663, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_foot", armature.stablePool);




    new Kusudama(armature.bonetags["thighL_057"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for l_leg_upp", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.2505336783387944, -0.2645716928861982, 0.9312543666159987), 0.73411).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.3143631992559614, -0.7667395103803937, 0.5597198425776874), 0.80869).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, -0.9578262852211515, -0.28734788556634544), 0.45589);
    new Twist(armature.bonetags["thighL_057"], 1.80083, undefined,
        armature.stablePool.any_Vec3(0.08630285555419352, -0.9938214452812402, -0.06978792639209032),
        1.7642561154997543, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_leg_upp", armature.stablePool);
    new Kusudama(armature.bonetags["shinL_058"], (t, b) => b == window.contextBone, "Kusudama for l_leg_lower", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.0769067586253415, -0.9469168519976967, 0.312143918538414), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.07185886843191087, 0.9971602774691865, 0.022531845580433706), 0.12425);
    new Twist(armature.bonetags["shinL_058"], 0.34729, undefined,
        armature.stablePool.any_Vec3(-0.07185886843191092, 0.997160277469187, 0.02253184558043372),
        6.256452508876571, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_leg_lower", armature.stablePool);
    new Kusudama(armature.bonetags["footL_059"], (t, b) => b == window.contextBone, "Kusudama for l_foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.5256465905493974, -0.8507030397522946), 0.75224);
    new Twist(armature.bonetags["footL_059"], 1.78672, undefined,
        armature.stablePool.any_Vec3(-0.1717897046096782, 0.6114593225819804, -0.7724026114777874),
        6.252441065186171, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_foot", armature.stablePool);

    for (let b of armature.bones) {
        if (b.getConstraint() == null) {
            let restconst = new Rest(b);
        }
    }
}