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
    armature.bonetags["spot_actuatorTarget_RL_017"].removeFromParent();
    armature.bonetags["spot_actuatorTarget_FR_012"].removeFromParent();
    armature.bonetags["spot_actuatorTarget_FL_05"].removeFromParent();
    armature.bonetags["spot_actuatorTarget_RR_022"].removeFromParent();

    /*b = armature.bonetags["spot_legTarget_RR_end_036"];
    b.parent.remove(b);
    b = armature.bonetags["spot_legTarget_RL_end_035"];
    b.parent.remove(b);
    b = armature.bonetags["spot_legTarget_FR_end_034"];
    b.parent.remove(b);
    b = armature.bonetags["spot_legTarget_FL_end_025"];
    b.parent.remove(b);*/



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
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.8841641200237743, 0, 0.4671764215610469), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.8119198144875552, 0, -0.5827792547882308), 0);
    new Twist(armature.bonetags["spot_shoulder_FR_08"], 0, undefined,
        armature.stablePool.any_Vec3(1, 0, 0),
        6.11967618115729, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_shoulder_FR_08", armature.stablePool);

    new Kusudama(armature.bonetags["spot_shoulder_FL_03"], (t, b) => b == contextBone, "Kusudama for spot_shoulder_FL_03", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.8841641200237743, 0, 0.4671764215610469), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.8119198144875552, 0, -0.5827792547882308), 0);
    //.addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.9790044689836245, -0.1814820780416558, 0.0928143580475245),0);
    new Twist(armature.bonetags["spot_shoulder_FL_03"], 0, undefined,
        armature.stablePool.any_Vec3(-0.9866621346549569, -2.79668925795562e-7, -0.16278148434724332),
        (2 * Math.PI) - 6.11967618115729, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_shoulder_FL_03", armature.stablePool);

    new Kusudama(armature.bonetags["spot_shoulder_RR_018"], (t, b) => b == contextBone, "Kusudama for spot_shoulder_RR_018", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.7886077421847981, 0, 0.6148966002233182), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.8301733080242956, 0, -0.5575054068293852), 0);
    new Twist(armature.bonetags["spot_shoulder_RR_018"], 0, undefined,
        armature.stablePool.any_Vec3(0.944600719284963, 0.00024892390708930456, 0.328221419096825),
        3.3405273157494375, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_shoulder_RR_018", armature.stablePool);

    new Kusudama(armature.bonetags["spot_shoulder_RL_013"], (t, b) => b == contextBone, "Kusudama for spot_shoulder_RL_013", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.7884619800726583, 0, 0.6147829459660726), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.8301481051974219, 0, -0.5575054068293852), 0);
    new Twist(armature.bonetags["spot_shoulder_RL_013"], 0, undefined,
        armature.stablePool.any_Vec3(-0.944600719284963, 0.00024892390708930456, 0.328221419096825),
        (2 * Math.PI) - 3.340527315749437, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_shoulder_RL_013", armature.stablePool);




    new Kusudama(armature.bonetags["spot_upperLeg_FR_09"], (t, b) => b == contextBone, "Kusudama for spot_upperLeg_FR_09", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.4569021491661587, 0, 0.8895169560186876), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.7808287530121909, 0, 0.6247451059813373), 0).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.5868126728346285, 0, -0.8097227154022253), 0);
    new Twist(armature.bonetags["spot_upperLeg_FR_09"], 0, undefined,
        armature.stablePool.any_Vec3(0.6175472669902733, -0.044917191980471394, -0.785250163258457),
        5.378373677666702, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_upperLeg_FR_09", armature.stablePool);

    new Kusudama(armature.bonetags["spot_upperLeg_FL_04"], (t, b) => b == contextBone, "Kusudama for spot_upperLeg_FL_04", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.4569021491661587, 0, 0.8895169560186876), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.7808287530121909, 0, 0.6247451059813373), 0).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0.5868126728346285, 0, -0.8097227154022253), 0);
    new Twist(armature.bonetags["spot_upperLeg_FL_04"], 0, undefined,
        armature.stablePool.any_Vec3(-0.6175472669902733, -0.044917191980471394, -0.785250163258457),
        (2 * Math.PI) - 5.378373677666702, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_upperLeg_FL_04", armature.stablePool);


    /*
spot_actuatorTarget_RL_end_031
spot_upperLeg_RL_014

spot_actuator_RR_end_032
spot_upperLeg_RR_019*/
    new Kusudama(armature.bonetags["spot_upperLeg_RR_019"], (t, b) => b == contextBone, "Kusudama for spot_upperLeg_RR_019", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.4553214582738525, 0, -0.8903271138381513), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.18, 0, 0.9839165645895224), 0);
    new Twist(armature.bonetags["spot_upperLeg_RR_019"], 0, undefined,
        armature.stablePool.any_Vec3(-0.9368015217289518, -0.04460342578078369, 0.3470070894551773),
        2.798753921785249, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_upperLeg_RR_019", armature.stablePool);

    new Kusudama(armature.bonetags["spot_upperLeg_RL_014"], (t, b) => b == contextBone, "Kusudama for spot_upperLeg_RL_014", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.38741582416375747, -0.0571555288664638, -0.9201316344455892), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.20974675160146214, 0.05576424934784627, 0.9761642529243251), 0);
    new Twist(armature.bonetags["spot_upperLeg_RL_014"], 0, undefined,
        armature.stablePool.any_Vec3(0.9942577015723197, -0.017582075118010798, 0.10556026873728977),
        3.301716117051777, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_upperLeg_RL_014", armature.stablePool);



    new Kusudama(armature.bonetags["spot_lowerLeg_FR_010"], (t, b) => b == contextBone, "Kusudama for spot_lowerLeg_FR_010", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.9925728894234876, 0.0826238121579427), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.9069136777510866, 0.42106494638787667), 0);
    new Twist(armature.bonetags["spot_lowerLeg_FR_010"], 0, undefined,
        armature.stablePool.any_Vec3(0, -0.2022415858246236, 0.979335526362713),
        6.272831666974913, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_lowerLeg_FR_010", armature.stablePool);



    new Kusudama(armature.bonetags["spot_lowerLeg_FL_06"], (t, b) => b == contextBone, "Kusudama for spot_lowerLeg_FL_06", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.9965808073932034, 0.0826238121579427), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.014556511648500598, 0.9069136777510866, 0.42106494638787667), 0);

    new Twist(armature.bonetags["spot_lowerLeg_FL_06"], 0, undefined,
        armature.stablePool.any_Vec3(0, -0.20224161290144133, 0.9793356574796119),
        -6.272831666974913, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_lowerLeg_FL_06", armature.stablePool);



    new Kusudama(armature.bonetags["spot_lowerLeg_RL_015"], (t, b) => b == contextBone, "Kusudama for spot_lowerLeg_RL_015", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9255284336064756, 0.37865723702304693), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, -0.8878798905112036, 0.4600691160017214), 0).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, 0.7076049189236652, 0.7066082922772938), 0);
    new Twist(armature.bonetags["spot_lowerLeg_RL_015"], 0, undefined,
        armature.stablePool.any_Vec3(0, -0.45808213706112333, 0.8889097128226806),
        0.0000013140086939960122, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_lowerLeg_RL_015", armature.stablePool);


    new Kusudama(armature.bonetags["spot_lowerLeg_RR_020"], (t, b) => b == contextBone, "Kusudama for spot_lowerLeg_RR_020", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9255284336064756, 0.37865723702304693), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, -0.8878798905112036, 0.4600691160017214), 0).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, 0.7076049189236652, 0.7066082922772938), 0);
    new Twist(armature.bonetags["spot_lowerLeg_RR_020"], 0, undefined,
        armature.stablePool.any_Vec3(0, -0.20224158870165343, 0.9793355402944547),
        6.272831666974913, (cnstrt, bone) => bone == contextBone,
        "Twist for spot_lowerLeg_RR_020", armature.stablePool);

        armature.bonetags["spot_body_02"].setStiffness(1);
    let spot_body_02_pin = new IKPin(armature.bonetags["spot_body_02"]);
    spot_body_02_pin.setPinWeight(0.5);
    spot_body_02_pin.setInfluenceOpacity(1 - 0.800);

    let spot_actuator_FR_011_pin = new IKPin(armature.bonetags["spot_actuator_FR_011"]);
    spot_actuator_FR_011_pin.setPinWeight(0.5000);
    spot_actuator_FR_011_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    spot_actuator_FR_011_pin.setInfluenceOpacity(1.0000);
    spot_actuator_FR_011_pin.target_threejs.position.set(0.00024568767092836286, 0.75, 0.1035272382823943);
    spot_actuator_FR_011_pin.target_threejs.quaternion.set(0.9998334695382135, 0.00022681181211431633, -0.0007551528492563438, 0.01823215543358536);
    spot_actuator_FR_011_pin.target_threejs.scale.set(1.0000001199043134, 1.0000002807270305, 1.0000004578321566);
    armature.bonetags['spot_upperLeg_FR_09'].add(spot_actuator_FR_011_pin.target_threejs);
    spot_actuator_FR_011_pin.nonInteractive = true;
    spot_actuator_FR_011_pin.ensure();



    let fr_preactuator_pin = new IKPin(armature.bonetags["fr_preactuator"]);
    fr_preactuator_pin.setPinWeight(0.0000);
    fr_preactuator_pin.setPSTPriorities(0.0000, 0.0000, 0.0000);
    fr_preactuator_pin.setInfluenceOpacity(1.0000);
    fr_preactuator_pin.forBone.parent.parent.add(fr_preactuator_pin.target_threejs);
    fr_preactuator_pin.ensure();
    fr_preactuator_pin.nonInteractive = true;

    let fl_preactuator_pin = new IKPin(armature.bonetags["fl_preactuator"]);
    fl_preactuator_pin.setPinWeight(0.0000);
    fl_preactuator_pin.setPSTPriorities(0.0000, 0.0000, 0.0000);
    fl_preactuator_pin.setInfluenceOpacity(1.0000);
    fl_preactuator_pin.target_threejs.position.set(0.49732421068108845, -0.17094243230365325, 0.8179775409982655);
    fl_preactuator_pin.target_threejs.quaternion.set(0.4323086761142209, -0.04139512298818537, 0.038482344067515, 0.8999526440564704);
    fl_preactuator_pin.forBone.parent.parent.add(fl_preactuator_pin.target_threejs);
    fl_preactuator_pin.ensure();
    fl_preactuator_pin.nonInteractive = true;


    armature.fl_foot_pin = new IKPin(armature.fl_foot);
    armature.fl_foot_pin.setPSTPriorities(1.0000, 1, 0);


    let spot_actuator_FL_07_pin = new IKPin(armature.bonetags["spot_actuator_FL_07"]);
    spot_actuator_FL_07_pin.setPinWeight(0.5000);
    spot_actuator_FL_07_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    spot_actuator_FL_07_pin.setInfluenceOpacity(1.0000);
    spot_actuator_FL_07_pin.target_threejs.position.set(0.000005355827679687231, 0.75, 0.12102216592185311);
    spot_actuator_FL_07_pin.target_threejs.quaternion.set(0.9997472644390364, 0.0115270061378337486, -0.015344988672017954, 0.01635869253865471);
    armature.bonetags['spot_upperLeg_FL_04'].add(spot_actuator_FL_07_pin.target_threejs);
    spot_actuator_FL_07_pin.ensure();
    spot_actuator_FL_07_pin.nonInteractive = true;




    let rl_preactuator_pin = new IKPin(armature.bonetags["rl_preactuator"]);
    rl_preactuator_pin.setPinWeight(0.0000);
    rl_preactuator_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    rl_preactuator_pin.setInfluenceOpacity(1.0000);
    rl_preactuator_pin.target_threejs.position.set(-0.0005702737972344551, -0.1232448677829514, -0.01299958844004856);
    rl_preactuator_pin.target_threejs.quaternion.set(0.9998941927913569, -0.0009611630688004415, -0.0002008876151846446, 0.01451340869135777);
    rl_preactuator_pin.target_threejs.scale.set(1.0000000003226293, 1.000000001628278, 1.000000000656904);
    armature.bonetags['spot_upperLeg_RL_014'].add(rl_preactuator_pin.target_threejs);
    rl_preactuator_pin.ensure()
    rl_preactuator_pin.nonInteractive = true;

    armature.rl_foot_pin = new IKPin(armature.rl_foot);
    armature.rl_foot_pin.setPSTPriorities(1, 1, 0);



    let spot_actuator_RL_016_pin = new IKPin(armature.bonetags["spot_actuator_RL_016"]);
    spot_actuator_RL_016_pin.setPinWeight(0.5000);
    spot_actuator_RL_016_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    spot_actuator_RL_016_pin.setInfluenceOpacity(1.0000);
    spot_actuator_RL_016_pin.target_threejs.position.set(-0.00023542075598614876, 0.75, 0.11865105512180785);
    spot_actuator_RL_016_pin.target_threejs.quaternion.set(0.9988475849817854, 0.004280339753213094, -0.041453313710840975, -0.023807634280681816);
    spot_actuator_RL_016_pin.target_threejs.scale.set(1.0000000418412152, 1.0000002285544156, 0.9999996796780932);
    armature.bonetags['spot_upperLeg_RL_014'].add(spot_actuator_RL_016_pin.target_threejs);
    spot_actuator_RL_016_pin.ensure();
    spot_actuator_RL_016_pin.nonInteractive = true;


    armature.fr_foot_pin = new IKPin(armature.fr_foot);
    armature.fr_foot_pin.setPSTPriorities(1, 1, 0);


    let rr_preactuator_pin = new IKPin(armature.bonetags["rr_preactuator"]);
    rr_preactuator_pin.setPinWeight(0.0000);
    rr_preactuator_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    rr_preactuator_pin.setInfluenceOpacity(1.0000);
    rr_preactuator_pin.target_threejs.position.set(0.00006019623556380305, 1.025277268393648, 0.1148414157013744);
    rr_preactuator_pin.target_threejs.quaternion.set(0.5661655678253688, 0.004180032788449944, 0.002574600646703248, 0.8242769246839167);
    rr_preactuator_pin.target_threejs.scale.set(0.9999999403735571, 0.9999997659827685, 0.9999997660038717);
    armature.bonetags['spot_upperLeg_RR_019'].add(rr_preactuator_pin.target_threejs);
    rr_preactuator_pin.ensure();
    rr_preactuator.nonInteractive = true;

    let spot_actuator_RR_021_pin = new IKPin(armature.rr_actuator);
    spot_actuator_RR_021_pin.setPinWeight(0.5000);
    spot_actuator_RR_021_pin.setPSTPriorities(1.0000, 1.0000, 1.0000);
    spot_actuator_RR_021_pin.setInfluenceOpacity(1.0000);
    spot_actuator_RR_021_pin.target_threejs.position.set(0.00006019623556391407, 1.0252772683936477, 0.11484141570137485);
    spot_actuator_RR_021_pin.target_threejs.quaternion.set(0.99874499344309, -3.786362696983489e-8, 7.657129115936241e-8, -0.050084309642391196);
    spot_actuator_RR_021_pin.target_threejs.scale.set(0.9999999403936463, 0.9999997677211377, 0.9999992908839748);
    armature.bonetags['spot_upperLeg_RR_019'].add(spot_actuator_RR_021_pin.target_threejs);
    spot_actuator_RR_021_pin.ensure();
    spot_actuator_RR_021_pin.nonInteractive = true;

    armature.rr_foot_pin = new IKPin(armature.rr_foot);
    armature.rr_foot_pin.setPSTPriorities(1, 1, 0);

    /*
    
    


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
    armature.rr_foot_pin.setTargetPriorities(1, 0, 0);*/

    return armature;
}