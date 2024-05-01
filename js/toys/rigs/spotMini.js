import { IKPin } from "../../EWBIK/betterbones/IKpin.js";
import { Rest, Twist, Kusudama } from "../../EWBIK/betterbones/Constraints/ConstraintStack.js";

export function initSpotMiniRig(armature) {
    armature.armatureObj3d.rotateX(-Math.PI / 2);
    armature.armatureNode.mimic();

    /**this model's feet were for some reason not attached to its legs. Probably because all IK systems except this one are horrifying**/
    armature.lower_fr_leg = armature.bonetags["spot_lowerLeg_FR_010"];
    armature.fr_foot = armature.bonetags["spot_legTarget_FR_00"];
    armature.lower_fr_leg.attach(armature.fr_foot);

    armature.lower_fl_leg = armature.bonetags["spot_lowerLeg_FL_06"];
    armature.fl_foot = armature.bonetags["spot_legTarget_FL_01"];
    armature.lower_fl_leg.attach(armature.fl_foot);

    armature.lower_rr_leg = armature.bonetags["spot_lowerLeg_RR_020"]
    armature.rr_foot = armature.bonetags["spot_legTarget_RR_024"]
    armature.lower_rr_leg.attach(armature.rr_foot);

    armature.lower_rl_leg = armature.bonetags["spot_lowerLeg_RL_015"]
    armature.rl_foot = armature.bonetags["spot_legTarget_RL_023"]
    armature.lower_rl_leg.attach(armature.rl_foot);

    /**get rid of confusing unecessesary bones that came with the rig*/
    let b = armature.bonetags["spot_actuatorTarget_RL_017"];
    b.parent.remove(b); 
    b = armature.bonetags["spot_actuatorTarget_FR_012"];
    b.parent.remove(b);
    b = armature.bonetags["spot_actuatorTarget_FL_05"];
    b.parent.remove(b);
    b = armature.bonetags["spot_legTarget_RR_end_036"];
    b.parent.remove(b);
    b = armature.bonetags["spot_legTarget_RL_end_035"];
    b.parent.remove(b);
    b = armature.bonetags["spot_legTarget_FR_end_034"];
    b.parent.remove(b);
    b = armature.bonetags["spot_legTarget_FL_end_025"];
    b.parent.remove(b);
    b = armature.bonetags["spot_actuatorTarget_RR_022"];
    b.parent.remove(b);
    



    armature.fr_actuator = armature.bonetags["spot_actuator_FR_011"];
    let fr_preactuator = new THREE.Bone();
    fr_preactuator.name = "fr_preactuator";
    fr_preactuator.position.copy(armature.fr_actuator.position);
    armature.fr_actuator.parent.add(fr_preactuator);
    fr_preactuator.setIKBoneOrientation(armature.fr_actuator.parent.getIKBoneOrientation());
    fr_preactuator.attach(armature.fr_actuator);
    armature.makeBoneMesh(fr_preactuator, 0.02);

    armature.fl_actuator = armature.bonetags["spot_actuator_FL_07"];
    let fl_preactuator = new THREE.Bone();
    fl_preactuator.name = "fl_preactuator";
    fl_preactuator.position.copy(armature.fl_actuator.position);
    armature.fl_actuator.parent.add(fl_preactuator);
    fl_preactuator.setIKBoneOrientation(armature.fl_actuator.parent.getIKBoneOrientation());
    fl_preactuator.attach(armature.fl_actuator);
    armature.makeBoneMesh(fl_preactuator, 0.02);

    armature.rl_actuator = armature.bonetags["spot_actuator_RL_016"];
    let rl_preactuator = new THREE.Bone();
    rl_preactuator.name = "rl_preactuator";
    rl_preactuator.position.copy(armature.rl_actuator.position);
    armature.rl_actuator.parent.add(rl_preactuator);
    rl_preactuator.setIKBoneOrientation(armature.rl_actuator.parent.getIKBoneOrientation());
    rl_preactuator.attach(armature.rl_actuator);
    armature.makeBoneMesh(rl_preactuator, 0.02);

    armature.rr_actuator = armature.bonetags["spot_actuator_RR_021"];
    let rr_preactuator = new THREE.Bone();
    rr_preactuator.name = "rr_preactuator";
    rr_preactuator.position.copy(armature.rr_actuator.position);
    armature.rr_actuator.parent.add(rr_preactuator);
    rr_preactuator.setIKBoneOrientation(armature.rr_actuator.parent.getIKBoneOrientation());
    rr_preactuator.attach(armature.rr_actuator);
    armature.makeBoneMesh(rr_preactuator, 0.02);

    updateGlobalBoneLists();



    new Kusudama(armature.bonetags["spot_shoulder_FR_08"], (t, b) => b == contextBone, "Kusudama for spot_shoulder_FR_08", armature.stablePool)
    .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.7835484056874227, 0.15928969573218602, 0.6005653076712354), 0.19481).parentKusudama
    .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.8119198144875552, 0.03397874381091945, -0.5827792547882308), 0.19481);
    //.addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.9790044689836245, -0.1814820780416558, 0.0928143580475245), 0.27);
    new Twist(armature.bonetags["spot_shoulder_FR_08"], 0.1, undefined,
        armature.stablePool.any_Vec3(0.9866621449859244, -2.5920917152806857e-7, -0.1627814843638773),
        0.13991, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_shoulder_FR_08", armature.stablePool);

    new Kusudama(armature.bonetags["spot_shoulder_FL_03"], (t, b) => b == contextBone, "Kusudama for spot_shoulder_FL_03", armature.stablePool)
    .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.7835484056874227, 0.15928969573218602, 0.6005653076712354), 0.19481).parentKusudama
    .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.8119198144875552, 0.03397874381091945, -0.5827792547882308), 0.19481);
    //.addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.9790044689836245, -0.1814820780416558, 0.0928143580475245), 0.27);
    new Twist(armature.bonetags["spot_shoulder_FL_03"], 0.1, undefined,
        armature.stablePool.any_Vec3(-0.9866621449859244, -2.5920917152806857e-7, -0.1627814843638773),
        -0.13991, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_shoulder_FL_03", armature.stablePool);

    new Kusudama(armature.bonetags["spot_shoulder_RR_018"], (t, b) => b == contextBone, "Kusudama for spot_shoulder_RR_018", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.7884619800726583, 0.01922590255826843, 0.6147829459660726), 0.3).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.8301481051974219, -0.0077920538795230605, -0.5574884817944393), 0.3);
    //.addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.9790044689836245, -0.1814820780416558, 0.0928143580475245), 0.27);
    new Twist(armature.bonetags["spot_shoulder_RR_018"], 0.1, undefined,
        armature.stablePool.any_Vec3(0.9866621449859244, -2.5920917152806857e-7, -0.1627814843638773),
        0.13991, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_shoulder_RR_018", armature.stablePool);

    new Kusudama(armature.bonetags["spot_shoulder_RL_013"], (t, b) => b == contextBone, "Kusudama for spot_shoulder_RL_013", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.7884619800726583, 0.01922590255826843, 0.6147829459660726), 0.3).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.8301481051974219, -0.0077920538795230605, -0.5574884817944393), 0.3);
    new Twist(armature.bonetags["spot_shoulder_RL_013"], 0.1, undefined,
        armature.stablePool.any_Vec3(-0.9866621449859244, -2.5920917152806857e-7, -0.1627814843638773),
        -0.13991, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_shoulder_RL_013", armature.stablePool);




    new Twist(armature.bonetags["spot_actuator_FR_011"], 0.01036, undefined,
        armature.stablePool.any_Vec3(-1.2345451903381109e-7, 0.07602665856314084, -0.997106244566423),
        6.283185037308079, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_actuator_FR_011", armature.stablePool);

    new Kusudama(armature.bonetags["spot_actuator_FR_end_028"], (t, b) => b == contextBone, "Kusudama for spot_actuator_FR_end_028", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-2.0816681711721685e-17, 1, 0), 0.05);



    new Kusudama(armature.bonetags["spot_upperLeg_FR_09"], (t, b) => b == contextBone, "Kusudama for spot_upperLeg_FR_09", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.7957198476456837, 0, 0.6056648520772466), 0.001).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.1305688826594, 0, -0.9905596423251049), 0.001);
    new Twist(armature.bonetags["spot_upperLeg_FR_09"], 0.02271, undefined,
        armature.stablePool.any_Vec3(0.841305664375956, -0.00010505886106038087, -0.5405596266149673),
        0.55, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_upperLeg_FR_09", armature.stablePool);

    new Kusudama(armature.bonetags["spot_upperLeg_FL_04"], (t, b) => b == contextBone, "Kusudama for spot_upperLeg_FL_04", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.7957198476456837, 0, 0.6056648520772466), 0.001).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.1305688826594, 0, -0.9905596423251049), 0.001);
    new Twist(armature.bonetags["spot_upperLeg_FL_04"], 0.02271, undefined,
        armature.stablePool.any_Vec3(-0.841305664375956, -0.00010505886106038087, -0.5405596266149673),
        (2 * Math.PI) - 0.55, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_upperLeg_FL_04", armature.stablePool);


    /*
spot_actuatorTarget_RL_end_031
spot_upperLeg_RL_014

spot_actuator_RR_end_032
spot_upperLeg_RR_019*/
    new Kusudama(armature.bonetags["spot_upperLeg_RR_019"], (t, b) => b == contextBone, "Kusudama for spot_upperLeg_RR_019", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.7957198476456837, 0, 0.6056648520772466), 0.001).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.1305688826594, 0, -0.9905596423251049), 0.001);
    new Twist(armature.bonetags["spot_upperLeg_RR_019"], 0.02271, undefined,
        armature.stablePool.any_Vec3(0.841305664375956, -0.00010505886106038087, -0.5405596266149673),
        0.55, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_upperLeg_RR_019", armature.stablePool);

    new Kusudama(armature.bonetags["spot_upperLeg_RL_014"], (t, b) => b == contextBone, "Kusudama for spot_upperLeg_RL_014", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.7957198476456837, 0, 0.6056648520772466), 0.001).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.1305688826594, 0, -0.9905596423251049), 0.001);
    new Twist(armature.bonetags["spot_upperLeg_RL_014"], 0.02271, undefined,
        armature.stablePool.any_Vec3(-0.841305664375956, -0.00010505886106038087, -0.5405596266149673),
        (2 * Math.PI) - 0.55, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_upperLeg_RL_014", armature.stablePool);



    new Kusudama(armature.bonetags["spot_lowerLeg_FR_010"], (t, b) => b == contextBone, "Kusudama for spot_lowerLeg_FR_010", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.0004892388691590319, -0.9725728894234876, 0.23259779750414164), 0.001).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.0004891947216802564, 0.742820465833907, 0.6694904900197026), 0.001);
    new Twist(armature.bonetags["spot_lowerLeg_FR_010"], 0.06505, undefined,
        armature.stablePool.any_Vec3(0.0004891989298969109, -0.2022415858246236, 0.979335526362713),
        6.272831666974913, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_lowerLeg_FR_010", armature.stablePool);


    new Kusudama(armature.bonetags["spot_lowerLeg_FL_06"], (t, b) => b == contextBone, "Kusudama for spot_lowerLeg_FL_06", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.0004892388691590319, -0.9725728894234876, 0.23259779750414164), 0.001).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.0004891947216802564, 0.742820465833907, 0.6694904900197026), 0.001);
    new Twist(armature.bonetags["spot_lowerLeg_FL_06"], 0.06505, undefined,
        armature.stablePool.any_Vec3(-0.0004891989298969109, -0.2022415858246236, 0.979335526362713),
        -6.272831666974913, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_lowerLeg_FL_06", armature.stablePool);


    new Kusudama(armature.bonetags["spot_lowerLeg_RL_015"], (t, b) => b == contextBone, "Kusudama for spot_lowerLeg_RL_015", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.0004892388691590319, -0.9725728894234876, 0.23259779750414164), 0.001).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.0004891947216802564, 0.742820465833907, 0.6694904900197026), 0.001);
    new Twist(armature.bonetags["spot_lowerLeg_RL_015"], 0.06505, undefined,
        armature.stablePool.any_Vec3(-0.0004891989298969109, -0.2022415858246236, 0.979335526362713),
        -6.272831666974913, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_lowerLeg_RL_015", armature.stablePool);


    new Kusudama(armature.bonetags["spot_lowerLeg_RR_020"], (t, b) => b == contextBone, "Kusudama for spot_lowerLeg_RR_020", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.0004892388691590319, -0.9725728894234876, 0.23259779750414164), 0.001).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.0004891947216802564, 0.742820465833907, 0.6694904900197026), 0.001);
    new Twist(armature.bonetags["spot_lowerLeg_RR_020"], 0.06505, undefined,
        armature.stablePool.any_Vec3(0.0004891989298969109, -0.2022415858246236, 0.979335526362713),
        6.272831666974913, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_lowerLeg_RR_020", armature.stablePool);


    let spot_body_02_pin = new IKPin(armature.bonetags["spot_body_02"]);
    spot_body_02_pin.setPinWeight(0.5);
    spot_body_02_pin.setInfluenceOpacity(1-0.800);


    let fr_preactuator_pin = new IKPin(armature.bonetags["fr_preactuator"]);
    fr_preactuator_pin.setPinWeight(0.000);
    fr_preactuator_pin.setTargetPriorities(1, 0,  0);
    fr_preactuator_pin.forBone.parent.attach(fr_preactuator_pin.target_threejs);
    fr_preactuator_pin.ensure();
    fr_preactuator.nonInteractive = true;

    let spot_actuator_FR_end_028_pin = new IKPin(armature.bonetags["spot_actuator_FR_end_028"]);
    spot_actuator_FR_end_028_pin.nonInteractive = true;
    spot_actuator_FR_end_028_pin.setTargetPriorities(1, 0,  0);
    armature.bonetags["spot_upperLeg_FR_09"].attach(spot_actuator_FR_end_028_pin.target_threejs);
    spot_actuator_FR_end_028_pin.alignToBone();
    makePinMeshHint(spot_actuator_FR_end_028_pin, 0.1, spot_actuator_FR_end_028_pin.target_threejs);
    spot_actuator_FR_end_028_pin.target_threejs.position.set(0, 0, 0);
    spot_actuator_FR_end_028_pin.hintMesh.position.set(0, 0, 0);
    spot_actuator_FR_end_028_pin.hintMesh.quaternion.identity();
    spot_actuator_FR_end_028_pin.targetNode.mimic();
    

    armature.fr_foot_pin = new IKPin(armature.fr_foot);
    armature.fr_foot_pin.setTargetPriorities(1, 0, 0);
    


    //front left
    let fl_preactuator_pin = new IKPin(armature.bonetags["fl_preactuator"]);
    fl_preactuator_pin.setPinWeight(0.000);
    fl_preactuator_pin.setTargetPriorities(1, 0,  0);
    fl_preactuator_pin.forBone.parent.attach(fl_preactuator_pin.target_threejs);
    fl_preactuator_pin.ensure();
    fl_preactuator_pin.nonInteractive = true;

    let spot_upperLeg_FL_04_pin = new IKPin(armature.bonetags["spot_actuator_FL_end_027"]);
    spot_upperLeg_FL_04_pin.setTargetPriorities(1, 0,  0);
    armature.bonetags["spot_upperLeg_FL_04"].attach(spot_upperLeg_FL_04_pin.target_threejs);
    spot_upperLeg_FL_04_pin.alignToBone();
    spot_upperLeg_FL_04_pin.nonInteractive = true;
    makePinMeshHint(spot_upperLeg_FL_04_pin, 0.1, spot_upperLeg_FL_04_pin.target_threejs);
    spot_upperLeg_FL_04_pin.target_threejs.position.set(0, 0, 0);
    spot_upperLeg_FL_04_pin.hintMesh.position.set(0, 0, 0);
    spot_upperLeg_FL_04_pin.hintMesh.quaternion.identity();
    spot_upperLeg_FL_04_pin.targetNode.mimic();
    

    armature.fl_foot_pin = new IKPin(armature.fl_foot);
    armature.fl_foot_pin.setTargetPriorities(1, 0, 0);

    let rl_preactuator_pin = new IKPin(armature.bonetags["rl_preactuator"]);
    rl_preactuator_pin.nonInteractive = true;
    rl_preactuator_pin.setPinWeight(0.000);
    rl_preactuator_pin.setTargetPriorities(1, 0,  0);
    rl_preactuator_pin.forBone.parent.attach(rl_preactuator_pin.target_threejs);
    rl_preactuator_pin.ensure();

    let spot_upperLeg_RL_014_pin = new IKPin(armature.bonetags["spot_actuator_RL_end_030"]);
    spot_upperLeg_RL_014_pin.nonInteractive = true;
    spot_upperLeg_RL_014_pin.setTargetPriorities(1, 0,  0);
    armature.bonetags["spot_upperLeg_RL_014"].attach(spot_upperLeg_RL_014_pin.target_threejs);
    spot_upperLeg_RL_014_pin.alignToBone();
    makePinMeshHint(spot_upperLeg_RL_014_pin, 0.1, spot_upperLeg_RL_014_pin.target_threejs);
    spot_upperLeg_RL_014_pin.target_threejs.position.set(0, 0, 0);
    spot_upperLeg_RL_014_pin.hintMesh.position.set(0, 0, 0);
    spot_upperLeg_RL_014_pin.hintMesh.quaternion.identity();
    spot_upperLeg_RL_014_pin.targetNode.mimic();
    
    armature.rl_foot_pin = new IKPin(armature.rl_foot);
    armature.rl_foot_pin.setTargetPriorities(1, 0, 0);


    let rr_preactuator_pin = new IKPin(armature.bonetags["rr_preactuator"]);
    rr_preactuator_pin.nonInteractive = true;
    rr_preactuator_pin.setPinWeight(0.000);
    rr_preactuator_pin.setTargetPriorities(1, 0,  0);
    rr_preactuator_pin.forBone.parent.attach(rr_preactuator_pin.target_threejs);
    rr_preactuator_pin.ensure();

    let spot_upperLeg_RR_019_pin = new IKPin(armature.bonetags["spot_actuator_RR_end_032"]);
    spot_upperLeg_RR_019_pin.nonInteractive = true;
    spot_upperLeg_RR_019_pin.setTargetPriorities(1, 0,  0);
    armature.bonetags["spot_upperLeg_RR_019"].attach(spot_upperLeg_RR_019_pin.target_threejs);
    spot_upperLeg_RR_019_pin.alignToBone();
    makePinMeshHint(spot_upperLeg_RR_019_pin, 0.1, spot_upperLeg_RR_019_pin.target_threejs);
    spot_upperLeg_RR_019_pin.target_threejs.position.set(0, 0, 0);
    spot_upperLeg_RR_019_pin.hintMesh.position.set(0, 0, 0);
    spot_upperLeg_RR_019_pin.hintMesh.quaternion.identity();
    spot_upperLeg_RR_019_pin.targetNode.mimic();
    
    armature.rr_foot_pin = new IKPin(armature.rr_foot);
    armature.rr_foot_pin.setTargetPriorities(1, 0, 0);

    return armature;
}