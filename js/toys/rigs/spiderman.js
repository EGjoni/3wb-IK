import { Rest, Kusudama, Twist } from "../../EWBIK/betterbones/Constraints/ConstraintStack.js";
import { IKPin, Rot } from "../../EWBIK/EWBIK.js";

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
    armature.l_shoulder.setStiffness(0.65);
    armature.l_arm_upp = armature.bonetags["upper_armL_034"];
    armature.r_shoulder = armature.bonetags["shoulderR_014"];
    armature.r_shoulder.setStiffness(0.65);
    armature.r_arm_upp = armature.bonetags["upper_armR_015"];
    armature.l_arm_lower = armature.bonetags["forearmL_035"];
    armature.l_hand = armature.bonetags["handL_036"];
    armature.l_hand.height = 0.2;
    armature.r_arm_lower = armature.bonetags["forearmR_016"];
    armature.r_hand = armature.bonetags["handR_017"];
    armature.r_hand.height = 0.2;
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
    armature.c_hips.height = 1; //give it some more hip control.
    armature.r_heel = armature.bonetags['heel02R_056'];
    armature.l_heel = armature.bonetags['heel02L_062'];
}

export function initSpideyPins(armature) {
    let spine_07_pin = new IKPin(armature.bonetags["spine_07"]);
    spine_07_pin.setPinWeight(0.5000);
    spine_07_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    spine_07_pin.setInfluenceOpacity(0.2000);
    spine_07_pin.target_threejs.position.set(-0.23642553723725812, 0.9715177445808654, 4.568018425935675);
    spine_07_pin.target_threejs.quaternion.set(0.8660389393193002, -0.03952669992586867, 0.06458095349463745, 0.49420997159243496);
    spine_07_pin.target_threejs.scale.set(1, 1, 1);


    let head_013_pin = new IKPin(armature.bonetags["head_013"]);
    head_013_pin.setPinWeight(1);
    head_013_pin.setPSTPriorities(1.0000, 1, 1);
    head_013_pin.setInfluenceOpacity(1.0000);
    head_013_pin.ensure();
    head_013_pin.target_threejs.position.set(-0.3181648516639215, -0.5189784264850061, 6.803655600016633);
    head_013_pin.target_threejs.quaternion.set(0.7774545889362391, 0.04617997756934433, 0.008681637859259848, 0.6271813142766287);
    head_013_pin.target_threejs.scale.set(1, 1, 1);
    head_013_pin.target_threejs.updateMatrix();
    head_013_pin.targetNode.mimic();


    let handR_017_pin = armature.r_hand_pin = new IKPin(armature.bonetags["handR_017"]);
    handR_017_pin.setPinWeight(1);
    handR_017_pin.setPSTPriorities(1.0000, 0.2905, 0.2611);
    handR_017_pin.setInfluenceOpacity(1.0000);
    handR_017_pin.ensure();
    handR_017_pin.target_threejs.position.set(-0.9370574635080721, -0.568263393771517, 5.276086094086389);
    handR_017_pin.target_threejs.quaternion.set(0.20578732968119354, 0.2892297163384405, 0.8071965481546489, 0.47162641865854893);
    handR_017_pin.target_threejs.scale.set(1, 1, 1);
    handR_017_pin.target_threejs.updateMatrix();
    handR_017_pin.targetNode.mimic();



    let forearmL_035_pin = armature.l_forearm_pin = new IKPin(armature.bonetags["forearmL_035"]);
    forearmL_035_pin.setPinWeight(0.1096);
    forearmL_035_pin.setPSTPriorities(0.4903, 0.0000, 0.0000);
    forearmL_035_pin.setInfluenceOpacity(0.0000)
    forearmL_035_pin.ensure();
    forearmL_035_pin.target_threejs.position.set(1.6763932044653818, 0.9204581873834115, -1.8970280006926625);
    forearmL_035_pin.target_threejs.quaternion.set(0.7853839612843345, 0.613860389314601, 0.042166751711726576, 0.06759749135829779);
    forearmL_035_pin.target_threejs.updateMatrix();
    spine_07_pin.target_threejs.add(forearmL_035_pin.target_threejs);
    forearmL_035_pin.ensure();
    forearmL_035_pin.targetNode.mimic();

    armature.c_head.height = 0.15;

    let handL_036_pin = armature.l_hand_pin = new IKPin(armature.bonetags["handL_036"]);
    handL_036_pin.setPinWeight(1);
    handL_036_pin.setPSTPriorities(1.0000, 1, 1);
    handL_036_pin.setInfluenceOpacity(1.0000);
    handL_036_pin.ensure();
    handL_036_pin.target_threejs.position.set(0.6799175566793809, -1.2843946894493843, 5.566602426650512);
    handL_036_pin.target_threejs.quaternion.set(-0.4427502424109322, 0.5144855255130414, 0.6471776717087317, -0.3470416806729355);
    handL_036_pin.target_threejs.updateMatrix();
    handL_036_pin.targetNode.mimic();



    let footR_054_pin = armature.r_foot_pin = new IKPin(armature.bonetags["footR_054"]);
    footR_054_pin.setPinWeight(0.8000);
    footR_054_pin.setPSTPriorities(1.0000, 0.0000, 0.0000);
    footR_054_pin.setInfluenceOpacity(0.0000);
    footR_054_pin.target_threejs.position.set(0.08623473645226307, -0.08941193077249421, 0.6120269790679627);
    footR_054_pin.target_threejs.quaternion.set(-0.07609965883842217, 0.9233692931843147, -0.3752420128662568, -0.02813222545506651);


    let toeR_055_pin = armature.r_toe_pin = new IKPin(armature.bonetags["toeR_055"]);
    toeR_055_pin.setPinWeight(1);
    toeR_055_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    toeR_055_pin.setInfluenceOpacity(1.0000);
    toeR_055_pin.target_threejs.position.set(-0.5040818141952029, -1.3653333568222943, 2.3191806819921696);
    toeR_055_pin.target_threejs.quaternion.set(-0.00452656195117098, -0.5017217542851824, -0.8649824515815807, -0.007755641161098909);


    let footL_059_pin = armature.l_foot_pin = new IKPin(armature.bonetags["footL_059"]);
    footL_059_pin.setPinWeight(0.8);
    footL_059_pin.setPSTPriorities(1.0000, 0.0000, 0.0000);
    footL_059_pin.setInfluenceOpacity(0.0000);
    footL_059_pin.target_threejs.position.set(0.15609182733195434, -0.24366297762518432, 0.5984076523130948);
    footL_059_pin.target_threejs.quaternion.set(0.07610287077700219, 0.9233691193350525, -0.3752418078420461, 0.028131977629410734);



    let toeL_061_pin = armature.l_toe_pin = new IKPin(armature.bonetags["toeL_061"]);
    toeL_061_pin.setPinWeight(1);
    toeL_061_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    toeL_061_pin.setInfluenceOpacity(1.0000);
    toeL_061_pin.target_threejs.position.set(0.7418013765707814, -1.1318218666144881, 2.4826137973970583);
    toeL_061_pin.target_threejs.quaternion.set(0.004375372926990694, -0.4988860504810216, -0.86662104884787, 0.007843624227064637);


    armature.l_toe_pin.target_threejs.add(armature.l_foot_pin.target_threejs);
    armature.l_foot_pin.ensure();

    armature.r_toe_pin.target_threejs.add(armature.r_foot_pin.target_threejs);
    armature.r_foot_pin.ensure();

    spine_07_pin.target_threejs.attach(head_013_pin.target_threejs);
    head_013_pin.ensure();
}


function oldinitSpideyPins(armature) {
    armature.head_pin = new IKPin(armature.c_head);
    armature.hip_pin = new IKPin(armature.c_hips).setInfluenceOpacity(1 - 0.8);
    armature.l_hand_pin = new IKPin(armature.l_hand).setPSTPriorities(1, 0.2, 0.2);
    armature.r_hand_pin = new IKPin(armature.r_hand).setPSTPriorities(1, 0.2, 0.2);
    armature.l_foot_pin = new IKPin(armature.l_foot);
    armature.l_foot_pin.setPSTPriorities(1, 0, 0).setInfluenceOpacity(0);
    armature.r_foot_pin = new IKPin(armature.r_foot);
    armature.r_foot_pin.setPSTPriorities(1, 0, 0).setInfluenceOpacity(0);

    armature.l_toe_pin = new IKPin(armature.l_toes);
    armature.l_toe_pin.target_threejs.attach(armature.l_foot_pin.target_threejs);
    armature.l_foot_pin.ensure();

    armature.r_toe_pin = new IKPin(armature.r_toes);
    armature.r_toe_pin.target_threejs.attach(armature.r_foot_pin.target_threejs);
    armature.r_foot_pin.ensure();
}





export function initSpideyConstraints(armature) {

    new Kusudama(armature.bonetags["spine001_08"], (t, b) => b == contextBone, "Kusudama for spine001_08", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 1, 0), 0.70285);

    new Twist(armature.bonetags["spine001_08"], 0.84121, undefined,
        armature.stablePool.any_Vec3(0.03266493816063039, 0.9876899856707104, 0.15297546868944029),
        0, (cnstrt, bone) => bone == contextBone,
        "Twist for spine001_08", armature.stablePool);

    new Rest(armature.bonetags["spine001_08"], undefined,
        "Rest for spine001_08_on_bone_spine001_08_on_bone_spine001_08_on_bone_spine001_08", armature.stablePool).setPainfulness(0.36971)
        .setStockholmRate(0.50897)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9984716567172718, -0.04682551355669378, 0.005688487418513466, -0.028798665304282343));

    new Kusudama(armature.bonetags["spine002_09"], (t, b) => b == contextBone, "Kusudama for spine002_09", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 1, 0), 1);

    new Twist(armature.bonetags["spine002_09"], 1.95607, undefined,
        armature.stablePool.any_Vec3(3.895379812138896e-8, 0.9831896981103287, -0.18258701358453502),
        0, (cnstrt, bone) => bone == contextBone,
        "Twist for spine002_09", armature.stablePool);

    new Rest(armature.bonetags["spine002_09"], undefined,
        "Rest for spine002_09_on_bone_spine002_09_on_bone_spine002_09_on_bone_spine002_09", armature.stablePool).setPainfulness(0.39667)
        .setStockholmRate(0.59431)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9904212423665456, -0.11159212931151584, -0.08111519196898995, 0.0057693133616082085));

    new Kusudama(armature.bonetags["spine003_010"], (t, b) => b == window.contextBone, "Kusudama for c_chest", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 1, 0), 0.70285);

    new Twist(armature.bonetags["spine003_010"], 2.42176, undefined,
        armature.stablePool.any_Vec3(2.2172618973788814e-8, 0.9974388759579416, -0.07152404300483499),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_chest", armature.stablePool);

    new Rest(armature.bonetags["spine003_010"], undefined,
        "Rest for spine003_010_on_bone_spine003_010_on_bone_spine003_010_on_bone_spine003_010", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.49549)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9999963997396956, 0.0006486532066778814, -0.0026037947358919147, 0.0000031045145093635297));

    new Kusudama(armature.bonetags["spine004_011"], (t, b) => b == window.contextBone, "Kusudama for c_lower_neck", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9052689523516538, -0.42483893878520484), 0.02547).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.48165869849727655, 0.8763588866223185), 0.02547);

    new Twist(armature.bonetags["spine004_011"], 0.262, undefined,
        armature.stablePool.any_Vec3(-1.4924975765388679e-7, 0.7798242609044459, 0.6259985000819192),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_lower_neck", armature.stablePool);

    new Rest(armature.bonetags["spine004_011"], undefined,
        "Rest for spine004_011_on_bone_spine004_011_on_bone_spine004_011_on_bone_spine004_011_on_bone_spine004_011", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.82116)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9866762338722724, -0.16243775845379102, 0.005505668948073598, -0.007326100570635181));

    new Kusudama(armature.bonetags["spine005_012"], (t, b) => b == window.contextBone, "Kusudama for c_neck", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 1, 0), 0.2936);

    new Twist(armature.bonetags["spine005_012"], 1.21177, undefined,
        armature.stablePool.any_Vec3(-0.002777533058617893, 0.9963848455796898, -0.08490892066942271),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_C_Neck", armature.stablePool);

    new Rest(armature.bonetags["spine005_012"], undefined,
        "Rest for spine005_012_on_bone_spine005_012_on_bone_spine005_012_on_bone_spine005_012_on_bone_spine005_012_on_bone_spine005_012", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.49998)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9999331144116137, 0.001936309034164334, -0.011402515682644757, 0.000006820702104287273));


    new Kusudama(armature.bonetags["head_013"], (t, b) => b == window.contextBone, "Kusudama for c_head", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9150314007508981, -0.40338261692820787), 0.11014).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 1, 0), 0.11014).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, 0.9922037621385162, 0.12462621874298734), 0.11014);

    new Twist(armature.bonetags["head_013"], 0.84121, undefined,
        armature.stablePool.any_Vec3(-0.024010528784923227, 0.9985679350988987, -0.047807671976267056),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_head", armature.stablePool);

    new Rest(armature.bonetags["head_013"], undefined,
        "Rest for head_013_on_bone_head_013_on_bone_head_013_on_bone_head_013_on_bone_head_013_on_bone_head_013", armature.stablePool).setPainfulness(0.49998)
        .setStockholmRate(0.47977)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9857944461732232, 0.16559481843885981, -0.02796548789950936, -0.002365900837221805));


    new Kusudama(armature.bonetags["shoulderR_014"], (t, b) => b == window.contextBone, "Kusudama for r_shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9234034614556849, 0.3796470573239536, -0.05651689337642643), 0.49822);

    new Twist(armature.bonetags["shoulderR_014"], 0.29084, undefined,
        armature.stablePool.any_Vec3(-0.9370660588579662, 0.20872939670328772, -0.2798914794849611),
        5.173925690745474, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_shoulder", armature.stablePool);

    new Rest(armature.bonetags["shoulderR_014"], undefined,
        "Rest for shoulderR_014_on_bone_shoulderR_014_on_bone_shoulderR_014_on_bone_shoulderR_014_on_bone_shoulderR_014", armature.stablePool).setPainfulness(0.69314)
        .setStockholmRate(0.85485)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.5606789915577123, 0.524590446036241, -0.4133412901599029, -0.4894822879351933));

    new Kusudama(armature.bonetags["upper_armR_015"], (t, b) => b == window.contextBone, "Kusudama for r_upper_arm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.8186474380747609, 0.5382146563145274, -0.2003530779944895), 0.92).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.38672979272511104, 0.6016821382145863, -0.6988695672100168), 1.02743);

    new Twist(armature.bonetags["upper_armR_015"], 1.43, undefined,
        armature.stablePool.any_Vec3(-0.1931672404212556, 0.6649372752097965, -0.7214879328613947),
        1.6389929939502001, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_upper_arm", armature.stablePool);

    new Rest(armature.bonetags["upper_armR_015"], undefined,
        "Rest for upper_armR_015_on_bone_upper_armR_015_on_bone_upper_armR_015_on_bone_upper_armR_015", armature.stablePool).setPainfulness(0.5449)
        .setStockholmRate(0.89303)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.5638651833497202, 0.4064607799340044, 0.6517313592928767, -0.3034665133020226));

    new Kusudama(armature.bonetags["forearmR_016"], (t, b) => b == window.contextBone, "kusudama for r_lower_arm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.16618547478186, 0.98097177500336, 0.10038308930435011), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.20139736184234602, -0.8191561141602648, 0.5370496841790323), 0.05);

    new Twist(armature.bonetags["forearmR_016"], 3, undefined,
        armature.stablePool.any_Vec3(0.14084953614985116, 0.9465392690011472, 0.2902151278020251),
        0.12536180249386888, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_lower_arm", armature.stablePool);

    new Rest(armature.bonetags["forearmR_016"], undefined,
        "Rest for forearmR_016_on_bone_forearmR_016_on_bone_forearmR_016", armature.stablePool).setPainfulness(0.49774)
        .setStockholmRate(0.50447)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.8200181130268782, -0.5668719761481581, -0.0763331938899079, 0.01999251050483447));

    new Kusudama(armature.bonetags["handR_017"], (t, b) => b == window.contextBone, "Kusudama for r_hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9959155399431063, -0.005407659407767647, -0.09012765679612746), 0.11014).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 1, 0), 0.45589).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.8236815497888856, 0.5651134455268308, -0.046856143910624294), 0.13131);

    new Twist(armature.bonetags["handR_017"], 0.40374, undefined,
        armature.stablePool.any_Vec3(-0.2288399053062053, 0.9725239003646371, 0.04277336740310202),
        6.1926262035523365, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_hand", armature.stablePool);

    new Rest(armature.bonetags["handR_017"], undefined,
        "Rest for handR_017_on_bone_handR_017_on_bone_handR_017", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.49549)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9881927822592214, 0.12822902294374391, 0.07466886864153756, -0.03816939639900814));

    new Kusudama(armature.bonetags["shoulderL_033"], (t, b) => b == window.contextBone, "Kusudama for l_shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9234034614556849, 0.3796470573239536, -0.05651689337642643), 0.49822);

    new Twist(armature.bonetags["shoulderL_033"], 0.38963, undefined,
        armature.stablePool.any_Vec3(0.9370661889569261, 0.2087292950201291, -0.2798911197486311),
        1.1092598334783703, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_shoulder", armature.stablePool);

    new Rest(armature.bonetags["shoulderL_033"], undefined,
        "Rest for shoulderL_033_on_bone_shoulderL_033_on_bone_shoulderL_033_on_bone_shoulderL_033_on_bone_shoulderL_033", armature.stablePool).setPainfulness(0.69314)
        .setStockholmRate(0.85485)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.5606789915577123, 0.524590446036241, 0.4133412901599029, 0.4894822879351933));

    new Kusudama(armature.bonetags["upper_armL_034"], (t, b) => b == window.contextBone, "Kusudama for l_arm_upp", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.8186474380747609, 0.5382146563145274, -0.2003530779944895), 0.92).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.38672979272511104, 0.6016821382145863, -0.6988695672100168), 1.02743);

    new Twist(armature.bonetags["upper_armL_034"], 1.43, undefined,
        armature.stablePool.any_Vec3(0.19316721280701363, 0.6649370926058562, -0.7214881085459698),
        4.644192267206221, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_arm_upp", armature.stablePool);

    new Rest(armature.bonetags["upper_armL_034"], undefined,
        "Rest for upper_armL_034_on_bone_upper_armL_034_on_bone_upper_armL_034_on_bone_upper_armL_034", armature.stablePool).setPainfulness(0.39891)
        .setStockholmRate(0.43934)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.5638651833497202, 0.4064607799340044, -0.6517313592928767, 0.3034665133020226));

    new Kusudama(armature.bonetags["forearmL_035"], (t, b) => b == window.contextBone, "Kusudama for l_lower_arm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.16618547478186, 0.98097177500336, 0.10038308930435011), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.20139736184234602, -0.8191561141602648, 0.5370496841790323), 0.05);

    new Twist(armature.bonetags["forearmL_035"], 3, undefined,
        armature.stablePool.any_Vec3(-0.14084948568621355, 0.9465393040346164, 0.2902150380314456),
        6.157823438805987, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_lower_arm", armature.stablePool);

    new Rest(armature.bonetags["forearmL_035"], undefined,
        "Rest for forearmL_035_on_bone_forearmL_035_on_bone_forearmL_035", armature.stablePool).setPainfulness(0.49774)
        .setStockholmRate(0.50447)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.8200181130268782, -0.5668719761481581, -0.0763331938899079, -0.01999251050483447));

    new Kusudama(armature.bonetags["handL_036"], (t, b) => b == window.contextBone, "Kusudama for l_hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9959155399431063, -0.005407659407767647, -0.09012765679612746), 0.11014).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 1, 0), 0.45589).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0.8236815497888856, 0.5651134455268308, -0.046856143910624294), 0.13131);

    new Twist(armature.bonetags["handL_036"], 0.20617, undefined,
        armature.stablePool.any_Vec3(0.2288389556851379, 0.972524122184945, 0.04277340446279551),
        0.09055904598202616, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_hand", armature.stablePool);

    new Rest(armature.bonetags["handL_036"], undefined,
        "Rest for handL_036_on_bone_handL_036_on_bone_handL_036", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.49549)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9881927822592214, 0.12822902294374391, 0.07466886864153756, 0.03816939639900814));

    new Kusudama(armature.bonetags["thighR_052"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for r_leg_upp", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.014892771401686659, -0.06417385102644547, 0.9978276014444644), 1.09799).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.2328569539800166, -0.38590919588129524, 0.8926655205156077), 1.18266).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.28105419447131186, -0.9405433403409607, -0.1907531512461847), 0.74518);

    new Twist(armature.bonetags["thighR_052"], 1.85728, undefined,
        armature.stablePool.any_Vec3(-0.16431468592523216, -0.7820391941069262, 0.6011783286761772),
        0.5713840621698555, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_leg_upp", armature.stablePool);

    new Rest(armature.bonetags["thighR_052"], undefined,
        "Rest for thighR_052_on_bone_thighR_052_on_bone_thighR_052_on_bone_thighR_052", armature.stablePool).setPainfulness(0.18)
        .setStockholmRate(0.49549)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.4162025843253697, -0.8283367222054085, 0.0780558284280931, -0.36679827030029377));

    new Kusudama(armature.bonetags["shinR_053"], (t, b) => b == window.contextBone, "Kusudama for r_leg_lower", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.0769067586253415, -0.9469168519976967, 0.312143918538414), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.07185886843191087, 0.9971602774691865, 0.022531845580433706), 0.12425);

    new Twist(armature.bonetags["shinR_053"], 0.34729, undefined,
        armature.stablePool.any_Vec3(-0.022972587367652612, -0.08066099212852779, 0.9964768259114094),
        0.14704423846165482, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_leg_lower", armature.stablePool);

    new Rest(armature.bonetags["shinR_053"], undefined,
        "Rest for shinR_053_on_bone_shinR_053_on_bone_shinR_053", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.491)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.6761577047209142, -0.7341356715561713, 0.04980232630781775, 0.03708506963245671));

    new Kusudama(armature.bonetags["footR_054"], (t, b) => b == window.contextBone, "Kusudama for r_foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.5256465905493974, -0.8507030397522946), 0.75224).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.047340884224711915, -0.29343155472142435, -0.9548071864908592), 0.47);

    new Twist(armature.bonetags["footR_054"], 0.78672, undefined,
        armature.stablePool.any_Vec3(0.4549196789984788, 0.46351401984243357, -0.7603965012211912),
        0.5276532006468533, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_foot", armature.stablePool);

    new Rest(armature.bonetags["footR_054"], undefined,
        "Rest for footR_054_on_bone_footR_054_on_bone_footR_054", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.4079)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.7304635443844361, 0.6663802840906733, 0.14952340271849687, 0.0017548048446571574));

    new Kusudama(armature.bonetags["toeR_055"], (t, b) => b == contextBone, "Kusudama for toeR_055", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.02349273366215407, -0.09127689545495776, -0.995548401546195), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.1659521606610461, 0.9270718400120874, 0.3361512811644971), 0.1);

    new Twist(armature.bonetags["toeR_055"], 1.06701, undefined,
        armature.stablePool.any_Vec3(0.1527067176216259, 0.8846859847327725, -0.44046721422897545),
        3.093676205955352, (cnstrt, bone) => bone == contextBone,
        "Twist for toeR_055", armature.stablePool);

    new Rest(armature.bonetags["toeR_055"], undefined,
        "Rest for toeR_055_on_bone_toeR_055_on_bone_toeR_055", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.491)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(-0.003650933762032213, -0.08047435459875212, -0.9790419997730844, 0.18704895512913045));

    new Kusudama(armature.bonetags["thighL_057"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for l_leg_upp", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.014892771401686659, -0.06417385102644547, 0.9978276014444644), 1.09799).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.2328569539800166, -0.38590919588129524, 0.8926655205156077), 1.18266).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0.28105419447131186, -0.9405433403409607, -0.1907531512461847), 0.74518);

    new Twist(armature.bonetags["thighL_057"], 1.80083, undefined,
        armature.stablePool.any_Vec3(0.07994702412592922, -0.8259102555475127, 0.5581045808043955),
        5.9358332056669125, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_leg_upp", armature.stablePool);

    new Rest(armature.bonetags["thighL_057"], undefined,
        "Rest for thighL_057_on_bone_thighL_057_on_bone_thighL_057_on_bone_thighL_057", armature.stablePool).setPainfulness(0.18)
        .setStockholmRate(0.49549)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.4373218612077899, -0.8779742397689779, -0.015025054984347048, 0.19412643234386484));

    new Kusudama(armature.bonetags["shinL_058"], (t, b) => b == window.contextBone, "Kusudama for l_leg_lower", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.0769067586253415, -0.9469168519976967, 0.312143918538414), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.07185886843191087, 0.9971602774691865, 0.022531845580433706), 0.12425);

    new Twist(armature.bonetags["shinL_058"], 0.34729, undefined,
        armature.stablePool.any_Vec3(-0.014621313263945862, 0.186054353391157, 0.9824306564753749),
        6.161227381495821, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_leg_lower", armature.stablePool);

    new Rest(armature.bonetags["shinL_058"], undefined,
        "Rest for shinL_058_on_bone_shinL_058_on_bone_shinL_058", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.50447)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.7201725815710638, -0.6905153712241814, -0.050333426071133516, -0.04479420806691718));

    new Kusudama(armature.bonetags["footL_059"], (t, b) => b == window.contextBone, "Kusudama for l_foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.5256465905493974, -0.8507030397522946), 0.75224).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.047340884224711915, -0.29343155472142435, -0.9548071864908592), 0.47);

    new Twist(armature.bonetags["footL_059"], 0.78672, undefined,
        armature.stablePool.any_Vec3(-0.17178970460967813, 0.6114593225819802, -0.7724026114777871),
        6.252441065186171, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_foot", armature.stablePool);

    new Kusudama(armature.bonetags["toeL_061"], (t, b) => b == contextBone, "Kusudama for toeL_061", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.02349273366215407, -0.09127689545495776, -0.995548401546195), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.1659521606610461, 0.9270718400120874, 0.3361512811644971), 0.1);

    new Twist(armature.bonetags["toeL_061"], 1.06, undefined,
        armature.stablePool.any_Vec3(0.1527067176216259, 0.8846859847327725, -0.44046721422897545),
        3.093676205955352, (cnstrt, bone) => bone == contextBone,
        "Twist for toeL_061", armature.stablePool);

    new Rest(armature.bonetags["toeL_061"], undefined,
        "Rest for toeL_061_on_bone_toeL_061_on_bone_toeL_061", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.491)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.0565727766870359, -0.08209347921764229, -0.9745988959571698, 0.20054219906774481));


}

function oldConstraints(armature) {
    /*new Rest(armature.bonetags["spine_07"], undefined,
        "RestConstraint-1_on_bone_spine_07_on_bone_spine_07", armature.stablePool).setPainfulness(0.9)
        .setStockholmRate(0.9)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.7073961477643346, -0.7064483761804796, 0.0037360273181766793, -0.022526074225687403));*/


    new Kusudama(armature.bonetags["spine001_08"], (t, b) => b == contextBone, "Kusudama for spine001_08", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 1, 0), 1);

    new Twist(armature.bonetags["spine001_08"], 0.45229, undefined,
        armature.stablePool.any_Vec3(0.03266493816063039, 0.9876899856707104, 0.15297546868944029),
        0, (cnstrt, bone) => bone == contextBone,
        "Twist for spine001_08", armature.stablePool);

    new Rest(armature.bonetags["spine001_08"], undefined,
        "Rest for spine001_08_on_bone_spine001_08_on_bone_spine001_08", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.50897)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.999931966635513, -0.00012751724808815406, 0.008538550429454624, 0.007946005056043544));



    new Kusudama(armature.bonetags["spine002_09"], (t, b) => b == contextBone, "Kusudama for spine002_09", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 1, 0), 1);

    new Twist(armature.bonetags["spine002_09"], 1.1, undefined,
        armature.stablePool.any_Vec3(3.895379812138896e-8, 0.9831896981103287, -0.18258701358453502),
        0, (cnstrt, bone) => bone == contextBone,
        "Twist for spine002_09", armature.stablePool);

    new Rest(armature.bonetags["spine002_09"], undefined,
        "Rest for spine002_09_on_bone_spine002_09_on_bone_spine002_09", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.50223)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9999898371927177, -0.00002705496577678531, -0.004508258162561545, 0.000019688844393232048));


    new Kusudama(armature.bonetags["spine003_010"], (t, b) => b == window.contextBone, "Kusudama for c_chest", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 1, 0), 0.54056);

    new Twist(armature.bonetags["spine003_010"], 0.88355, undefined,
        armature.stablePool.any_Vec3(2.2172618973788817e-8, 0.9974388759579418, -0.071524043004835),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_chest", armature.stablePool);

    new Rest(armature.bonetags["spine003_010"], undefined,
        "Rest for spine003_010_on_bone_spine003_010_on_bone_spine003_010", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.49549)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9999963997396956, 0.0006486532066778814, -0.0026037947358919147, 0.0000031045145093635297));


    new Kusudama(armature.bonetags["spine004_011"], (t, b) => b == window.contextBone, "Kusudama for c_lower_neck", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9052689523516538, -0.42483893878520484), 0.02547).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.48165869849727655, 0.8763588866223185), 0.02547);

    new Twist(armature.bonetags["spine004_011"], 0.262, undefined,
        armature.stablePool.any_Vec3(-1.4924975765388679e-7, 0.7798242609044459, 0.6259985000819192),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_lower_neck", armature.stablePool);

    new Rest(armature.bonetags["spine004_011"], undefined,
        "Rest for spine004_011_on_bone_spine004_011_on_bone_spine004_011_on_bone_spine004_011", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.82116)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9999486350280289, -0.0005561010618927677, -0.010120119099600358, 0.0000353072385449321));


    new Kusudama(armature.bonetags["spine005_012"], (t, b) => b == window.contextBone, "Kusudama for c_neck", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 1, 0), 0.2936);

    new Twist(armature.bonetags["spine005_012"], 1.21177, undefined,
        armature.stablePool.any_Vec3(-0.002777533058617893, 0.9963848455796898, -0.08490892066942271),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for J_Bip_C_Neck", armature.stablePool);

    new Rest(armature.bonetags["spine005_012"], undefined,
        "Rest for spine005_012_on_bone_spine005_012_on_bone_spine005_012_on_bone_spine005_012", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.49998)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9999331144116137, 0.001936309034164334, -0.011402515682644757, 0.000006820702104287273));

    new Kusudama(armature.bonetags["head_013"], (t, b) => b == window.contextBone, "Kusudama for c_head", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9150314007508981, -0.40338261692820787), 0.11014).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 1, 0), 0.11014).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, 0.9922037621385162, 0.12462621874298734), 0.11014);

    new Twist(armature.bonetags["head_013"], 0.84121, undefined,
        armature.stablePool.any_Vec3(-0.024010527353784176, 0.9985678755796112, -0.047807669126707725),
        0, (cnstrt, bone) => bone == window.contextBone,
        "Twist for c_head", armature.stablePool);

    new Rest(armature.bonetags["head_013"], undefined,
        "Rest for head_013_on_bone_head_013_on_bone_head_013_on_bone_head_013", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.49998)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9984906119500968, -0.02254206528464302, 0.04883276407764737, 0.011122692693825329));



    new Kusudama(armature.bonetags["shoulderR_014"], (t, b) => b == window.contextBone, "Kusudama for r_shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9234034614556849, 0.3796470573239536, -0.05651689337642643), 0.49822);

    new Twist(armature.bonetags["shoulderR_014"], 0.29084, undefined,
        armature.stablePool.any_Vec3(-0.9370660588579662, 0.20872939670328772, -0.2798914794849611),
        5.173925690745474, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_shoulder", armature.stablePool);

    new Rest(armature.bonetags["shoulderR_014"], undefined,
        "Rest for shoulderR_014_on_bone_shoulderR_014_on_bone_shoulderR_014_on_bone_shoulderR_014", armature.stablePool).setPainfulness(0.69314)
        .setStockholmRate(0.85485)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.5606789915577123, 0.524590446036241, -0.4133412901599029, -0.4894822879351933));



    new Kusudama(armature.bonetags["upper_armR_015"], (t, b) => b == window.contextBone, "Kusudama for r_upper_arm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.8186474380747609, 0.5382146563145274, -0.2003530779944895), 0.92).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.38672979272511104, 0.6016821382145863, -0.6988695672100168), 1.02743);
    new Twist(armature.bonetags["upper_armR_015"], 1.43, undefined,
        armature.stablePool.any_Vec3(-0.1931672404212556, 0.6649372752097965, -0.7214879328613947),
        1.6389929939502001, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_upper_arm", armature.stablePool);

    new Rest(armature.bonetags["upper_armR_015"], undefined,
        "Rest for upper_armR_015_on_bone_upper_armR_015_on_bone_upper_armR_015", armature.stablePool).setPainfulness(0.5449)
        .setStockholmRate(0.89303)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.5638651833497202, 0.4064607799340044, 0.6517313592928767, -0.3034665133020226));


    new Kusudama(armature.bonetags["forearmR_016"], (t, b) => b == window.contextBone, "kusudama for r_lower_arm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.16618547478186, 0.98097177500336, 0.10038308930435011), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.20139736184234602, -0.8191561141602648, 0.5370496841790323), 0.05);

    new Twist(armature.bonetags["forearmR_016"], 3, undefined,
        armature.stablePool.any_Vec3(0.14084953614985116, 0.9465392690011472, 0.2902151278020251),
        0.12536180249386888, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_lower_arm", armature.stablePool);

    new Rest(armature.bonetags["forearmR_016"], undefined,
        "Rest for forearmR_016_on_bone_forearmR_016", armature.stablePool).setPainfulness(0.49774)
        .setStockholmRate(0.50447)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.8200181130268782, -0.5668719761481581, -0.0763331938899079, 0.01999251050483447));



    new Kusudama(armature.bonetags["handR_017"], (t, b) => b == window.contextBone, "Kusudama for r_hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9959155399431063, -0.005407659407767647, -0.09012765679612746), 0.11014).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 1, 0), 0.45589).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.8236815497888856, 0.5651134455268308, -0.046856143910624294), 0.13131);

    new Twist(armature.bonetags["handR_017"], 0.40374, undefined,
        armature.stablePool.any_Vec3(-0.2288399053062053, 0.9725239003646371, 0.04277336740310202),
        6.1926262035523365, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_hand", armature.stablePool);

    new Rest(armature.bonetags["handR_017"], undefined,
        "Rest for handR_017_on_bone_handR_017", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.49549)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9881927822592216, 0.12822902294374394, 0.07466886864153757, -0.03816939639900815));


    new Kusudama(armature.bonetags["shoulderL_033"], (t, b) => b == window.contextBone, "Kusudama for l_shoulder", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9234034614556849, 0.3796470573239536, -0.05651689337642643), 0.49822);
    new Twist(armature.bonetags["shoulderL_033"], 0.38963, undefined,
        armature.stablePool.any_Vec3(0.9370661889569261, 0.2087292950201291, -0.2798911197486311),
        1.1092598334783703, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_shoulder", armature.stablePool);
    new Rest(armature.bonetags["shoulderL_033"], undefined,
        "Rest for shoulderL_033_on_bone_shoulderL_033_on_bone_shoulderL_033_on_bone_shoulderL_033", armature.stablePool).setPainfulness(0.69314)
        .setStockholmRate(0.85485)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.5606789915577123, 0.524590446036241, 0.4133412901599029, 0.4894822879351933));


    new Kusudama(armature.bonetags["upper_armL_034"], (t, b) => b == window.contextBone, "Kusudama for l_arm_upp", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.8186474380747609, 0.5382146563145274, -0.2003530779944895), 0.92).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.38672979272511104, 0.6016821382145863, -0.6988695672100168), 1.02743);
    new Twist(armature.bonetags["upper_armL_034"], 1.43, undefined,
        armature.stablePool.any_Vec3(0.19316721280701363, 0.6649370926058562, -0.7214881085459698),
        4.644192267206221, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_arm_upp", armature.stablePool);
    new Rest(armature.bonetags["upper_armL_034"], undefined,
        "Rest for upper_armL_034_on_bone_upper_armL_034_on_bone_upper_armL_034", armature.stablePool).setPainfulness(0.39891)
        .setStockholmRate(0.43934)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.5638651833497202, 0.4064607799340044, -0.6517313592928767, 0.3034665133020226));


    new Kusudama(armature.bonetags["forearmL_035"], (t, b) => b == window.contextBone, "Kusudama for l_lower_arm", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.16618547478186, 0.98097177500336, 0.10038308930435011), 0.05).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.20139736184234602, -0.8191561141602648, 0.5370496841790323), 0.05);

    new Twist(armature.bonetags["forearmL_035"], 3, undefined,
        armature.stablePool.any_Vec3(-0.14084948568621355, 0.9465393040346164, 0.2902150380314456),
        6.157823438805987, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_lower_arm", armature.stablePool);

    new Rest(armature.bonetags["forearmL_035"], undefined,
        "Rest for forearmL_035_on_bone_forearmL_035", armature.stablePool).setPainfulness(0.49774)
        .setStockholmRate(0.50447)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.8200181130268782, -0.5668719761481581, -0.0763331938899079, -0.01999251050483447));


    new Kusudama(armature.bonetags["handL_036"], (t, b) => b == window.contextBone, "Kusudama for l_hand", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9959155399431063, -0.005407659407767647, -0.09012765679612746), 0.11014).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 1, 0), 0.45589).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0.8236815497888856, 0.5651134455268308, -0.046856143910624294), 0.13131);

    new Twist(armature.bonetags["handL_036"], 0.20617, undefined,
        armature.stablePool.any_Vec3(0.2288389556851379, 0.972524122184945, 0.04277340446279551),
        0.09055904598202616, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_hand", armature.stablePool);

    new Rest(armature.bonetags["handL_036"], undefined,
        "Rest for handL_036_on_bone_handL_036", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.49549)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.9881927822592216, 0.12822902294374394, 0.07466886864153757, 0.03816939639900815));

    new Kusudama(armature.bonetags["thighR_052"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for r_leg_upp", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.014892771401686659, -0.06417385102644547, 0.9978276014444644), 1.09799).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.2328569539800166, -0.38590919588129524, 0.8926655205156077), 1.18266).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.28105419447131186, -0.9405433403409607, -0.1907531512461847), 0.74518);

    new Twist(armature.bonetags["thighR_052"], 1.85728, undefined,
        armature.stablePool.any_Vec3(-0.16431497321350774, -0.7820405614265316, 0.6011793797781184),
        0.5713840621698555, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_leg_upp", armature.stablePool);

    new Rest(armature.bonetags["thighR_052"], undefined,
        "Rest for thighR_052_on_bone_thighR_052_on_bone_thighR_052", armature.stablePool).setPainfulness(0.18)
        .setStockholmRate(0.49549)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.4162025843253697, -0.8283367222054085, 0.0780558284280931, -0.36679827030029377));

    new Kusudama(armature.bonetags["shinR_053"], (t, b) => b == window.contextBone, "Kusudama for r_leg_lower", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.07690675862534149, -0.9469168519976965, 0.31214391853841394), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.07185886843191087, 0.9971602774691865, 0.022531845580433706), 0.12425);

    new Twist(armature.bonetags["shinR_053"], 0.34729, undefined,
        armature.stablePool.any_Vec3(-0.02297258645480401, -0.08066098892334794, 0.996476786314978),
        0.14704423846165482, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_leg_lower", armature.stablePool);

    new Rest(armature.bonetags["shinR_053"], undefined,
        "Rest for shinR_053_on_bone_shinR_053", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.491)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.6761577047209142, -0.7341356715561713, 0.04980232630781775, 0.03708506963245671));

    new Kusudama(armature.bonetags["footR_054"], (t, b) => b == window.contextBone, "Kusudama for r_foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.5256465905493974, -0.8507030397522946), 0.75224).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.047340884224711915, -0.29343155472142435, -0.9548071864908592), 0.47);

    new Twist(armature.bonetags["footR_054"], 0.78672, undefined,
        armature.stablePool.any_Vec3(0.4549196970753627, 0.4635140382608258, -0.7603965314366333),
        0.5276532006468533, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_foot", armature.stablePool);

    new Rest(armature.bonetags["footR_054"], undefined,
        "Rest for footR_054_on_bone_footR_054", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.4079)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.7304635443844361, 0.6663802840906733, 0.14952340271849687, 0.0017548048446571574));



    new Kusudama(armature.bonetags["toeR_055"], (t, b) => b == contextBone, "Kusudama for toeR_055", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.02349273366215407, -0.09127689545495776, -0.995548401546195), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.1659521606610461, 0.9270718400120874, 0.3361512811644971), 0.1);
    new Twist(armature.bonetags["toeR_055"], 1.06701, undefined,
        armature.stablePool.any_Vec3(0.15270669941756657, 0.8846858792699845, -0.44046716172119166),
        3.093676205955352, (cnstrt, bone) => bone == contextBone,
        "Twist for toeR_055", armature.stablePool);
    new Rest(armature.bonetags["toeR_055"], undefined,
        "Rest for toeR_055_on_bone_toeR_055", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.491)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(-0.003650933762032213, -0.08047435459875212, -0.9790419997730844, 0.18704895512913045));


    new Kusudama(armature.bonetags["thighL_057"], (cnstrt, bone) => bone == window.contextBone, "Kusudama for l_leg_upp", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.014892771401686659, -0.06417385102644547, 0.9978276014444644), 1.09799).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.2328569539800166, -0.38590919588129524, 0.8926655205156077), 1.18266).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0.28105419447131186, -0.9405433403409607, -0.1907531512461847), 0.74518);

    new Twist(armature.bonetags["thighL_057"], 1.80083, undefined,
        armature.stablePool.any_Vec3(0.07994655236974582, -0.8259053819668605, 0.5581012875074923),
        5.9358332056669125, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_leg_upp", armature.stablePool);

    new Rest(armature.bonetags["thighL_057"], undefined,
        "Rest for thighL_057_on_bone_thighL_057_on_bone_thighL_057", armature.stablePool).setPainfulness(0.18)
        .setStockholmRate(0.49549)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.4373218612077899, -0.8779742397689779, -0.015025054984347048, 0.19412643234386484));


    new Kusudama(armature.bonetags["shinL_058"], (t, b) => b == window.contextBone, "Kusudama for l_leg_lower", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.07690675862534149, -0.9469168519976965, 0.31214391853841394), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.07185886843191087, 0.9971602774691865, 0.022531845580433706), 0.12425);

    new Twist(armature.bonetags["shinL_058"], 0.34729, undefined,
        armature.stablePool.any_Vec3(-0.014621312101948288, 0.18605433860488552, 0.9824305783988013),
        6.161227381495821, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_leg_lower", armature.stablePool);

    new Rest(armature.bonetags["shinL_058"], undefined,
        "Rest for shinL_058_on_bone_shinL_058", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.50447)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.7201725815710638, -0.6905153712241814, -0.050333426071133516, -0.04479420806691718));



    new Kusudama(armature.bonetags["footL_059"], (t, b) => b == window.contextBone, "Kusudama for l_foot", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0, 0.5256465905493974, -0.8507030397522946), 0.75224).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.047340884224711915, -0.29343155472142435, -0.9548071864908592), 0.47);

    new Twist(armature.bonetags["footL_059"], 0.78672, undefined,
        armature.stablePool.any_Vec3(-0.17178970460967816, 0.6114593225819803, -0.7724026114777873),
        6.252441065186171, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_foot", armature.stablePool);




    new Kusudama(armature.bonetags["toeL_061"], (t, b) => b == contextBone, "Kusudama for toeL_061", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.02349273366215407, -0.09127689545495776, -0.995548401546195), 0.1).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.1659521606610461, 0.9270718400120874, 0.3361512811644971), 0.1);
    ;

    new Twist(armature.bonetags["toeL_061"], 1.06, undefined,
        armature.stablePool.any_Vec3(0.15270669941756657, 0.8846858792699845, -0.44046716172119166),
        3.093676205955352, (cnstrt, bone) => bone == contextBone,
        "Twist for toeL_061", armature.stablePool);

    new Rest(armature.bonetags["toeL_061"], undefined,
        "Rest for toeL_061_on_bone_toeL_061", armature.stablePool).setPainfulness(0.5)
        .setStockholmRate(0.491)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.0565727766870359, -0.08209347921764229, -0.9745988959571698, 0.20054219906774481));


    /*new Rest(armature.c_hips.parent).setPainfulness(0.9).setStockholmRate(0.9);
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

    new Rest(armature.bonetags["shoulderR_014"], undefined,
        "Rest for shoulderR_014_on_bone_shoulderR_014", armature.stablePool)
        .setPainfulness(0.5)
        .setStockholmRate(0.5).boneFrameRest.localMBasis.rotateTo(
            new Rot(0.6465927297194879, 0.41873565013780456, -0.4361973007303565, -0.46509161679514566));

    new Kusudama(armature.bonetags["upper_armR_015"], (t, b) => b == window.contextBone, "Kusudama for r_upper_arm", armature.stablePool)
    .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.8186474380747609, 0.5382146563145274, -0.2003530779944895), 0.92).parentKusudama
    .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.38672979272511104, 0.6016821382145863, -0.6988695672100168), 1.02743);
    new Twist(armature.bonetags["upper_armR_015"], 1.43, undefined,
        armature.stablePool.any_Vec3(-0.19316724042125555, 0.6649372752097964, -0.7214879328613946),
        1.6389929939502001, (cnstrt, bone) => bone == window.contextBone,
        "Twist for r_upper_arm", armature.stablePool).setPainfulness(0).setStockholmRate(0);
    new Rest(armature.bonetags["upper_armR_015"], undefined,
        "Rest for upper_armR_015", armature.stablePool).setPainfulness(0.5449)
        .setStockholmRate(0.89303)
        .boneFrameRest.localMBasis.rotateTo(
            new Rot(0.6103842584359256, 0.5002880815124601, 0.5703955712248628, -0.22757808523069614));;
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
        armature.stablePool.any_Vec3(0.9370661889569261, 0.2087292950201291, -0.2798911197486311),
        1.1092598334783703, (cnstrt, bone) => bone == window.contextBone,
        "Twist for l_shoulder", armature.stablePool);
    new Rest(armature.bonetags["shoulderL_033"], undefined,
        "Rest for shoulderL_033_on_bone_shoulderL_033", armature.stablePool)
            .setPainfulness(0.5)
            .setStockholmRate(0.5).boneFrameRest.localMBasis.rotateTo(
                new Rot(0.6376726558401842, 0.40621966951089844, 0.4677241698529293, 0.4578135701697479));

    new Kusudama(armature.bonetags["upper_armL_034"], (t, b) => b == window.contextBone, "Kusudama for l_arm_upp", armature.stablePool)
            .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.8186474380747609, 0.5382146563145274, -0.2003530779944895), 0.92).parentKusudama
            .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.38672979272511104, 0.6016821382145863, -0.6988695672100168), 1.02743);

new Twist(armature.bonetags["upper_armL_034"], 1.43, undefined, 
                armature.stablePool.any_Vec3(0.19316721280701357, 0.6649370926058561, -0.7214881085459697), 
                4.644192267206221, (cnstrt, bone) => bone == window.contextBone,
                "Twist for l_arm_upp", armature.stablePool).setPainfulness(0)
                .setStockholmRate(0);
new Rest(armature.bonetags["upper_armL_034"], undefined,
                "Rest for upper_armL_034", armature.stablePool).setPainfulness(0.5449)
                .setStockholmRate(0.89303)
                .boneFrameRest.localMBasis.rotateTo(
                    new Rot(0.6103842584359256, 0.5002880815124601, -0.5703955712248628, 0.22757808523069614));

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
    .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.014892771401686659, -0.06417385102644547, 0.9978276014444644), 1.09799).parentKusudama
    .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.2328569539800166, -0.38590919588129524, 0.8926655205156077), 1.18266).parentKusudama
    .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.28105419447131186, -0.9405433403409607, -0.1907531512461847), 0.74518);
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
     .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.014892771401686659, -0.06417385102644547, 0.9978276014444644), 1.09799).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.2328569539800166, -0.38590919588129524, 0.8926655205156077), 1.18266).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0.28105419447131186, -0.9405433403409607, -0.1907531512461847), 0.74518);

    new Twist(armature.bonetags["thighL_057"], 1.80083, undefined,
        armature.stablePool.any_Vec3(0.08630287270051301, -0.9938216427298635, -0.06978794025728718),
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
    }*/
}