import { IKPin } from "../../EWBIK/betterbones/IKpin.js";
import {Rot} from "../../EWBIK/EWBIK.js";
import { Rest, Twist, Kusudama } from "../../EWBIK/betterbones/Constraints/ConstraintStack.js";

export function initSpotMiniRig(armature) {
    armature.armatureObj3d.rotateX(-Math.PI / 2);
    armature.armatureNode.mimic();

    /**this model's feet were for some reason not attached to its legs. Probably because all IK systems except this one are horrifying**/
    armature.lower_fr_leg = armature.bonetags["spot_lowerLeg_FR_010"];
    //armature.lower_fr_leg.setIKBoneOrientation(armature.lower_fr_leg.getIKBoneOrientation());
    armature.fr_foot = armature.bonetags["spot_legTarget_FR_00"];
    armature.lower_fr_leg.attach(armature.fr_foot);

    armature.lower_fl_leg = armature.bonetags["spot_lowerLeg_FL_06"];
    //armature.lower_fl_leg.setIKBoneOrientation(armature.lower_fl_leg.getIKBoneOrientation());
    armature.fl_foot = armature.bonetags["spot_legTarget_FL_01"];
    armature.lower_fl_leg.attach(armature.fl_foot);

    armature.lower_rr_leg = armature.bonetags["spot_lowerLeg_RR_020"];
    //armature.lower_rr_leg.setIKBoneOrientation(armature.lower_rr_leg.getIKBoneOrientation());
    armature.rr_foot = armature.bonetags["spot_legTarget_RR_024"]
    armature.lower_rr_leg.attach(armature.rr_foot);

    armature.lower_rl_leg = armature.bonetags["spot_lowerLeg_RL_015"]
    //armature.lower_rl_leg.setIKBoneOrientation(armature.lower_rl_leg.getIKBoneOrientation());
    armature.rl_foot = armature.bonetags["spot_legTarget_RL_023"]
    armature.lower_rl_leg.attach(armature.rl_foot);

    armature.bonetags["spot_actuatorTarget_RL_017"].removeFromParent();
    armature.bonetags["spot_actuatorTarget_FR_012"].removeFromParent();
    armature.bonetags["spot_actuatorTarget_FL_05"].removeFromParent();
    armature.bonetags["spot_actuatorTarget_RR_022"].removeFromParent();


    armature.fr_actuator = armature.bonetags["spot_actuator_FR_011"];
    armature.setInternalOrientationFor(armature.lower_fr_leg, armature.fr_actuator.position);
    let fr_preactuator = new THREE.Bone();
    fr_preactuator.name = "fr_preactuator";
    fr_preactuator.position.copy(armature.fr_actuator.position);
    armature.fr_actuator.parent.add(fr_preactuator);
    fr_preactuator.setIKBoneOrientation(armature.fr_actuator.parent.getIKBoneOrientation());

    fr_preactuator.attach(armature.fr_actuator);

    armature.fl_actuator = armature.bonetags["spot_actuator_FL_07"];
    armature.setInternalOrientationFor(armature.lower_fl_leg, armature.fl_actuator.position);
    let fl_preactuator = new THREE.Bone();
    fl_preactuator.name = "fl_preactuator";
    fl_preactuator.position.copy(armature.fl_actuator.position);
    armature.fl_actuator.parent.add(fl_preactuator);
    fl_preactuator.setIKBoneOrientation(armature.fl_actuator.parent.getIKBoneOrientation());
    fl_preactuator.attach(armature.fl_actuator);

    armature.rl_actuator = armature.bonetags["spot_actuator_RL_016"];
    armature.setInternalOrientationFor(armature.lower_rl_leg, armature.rl_actuator.position);
    let rl_preactuator = new THREE.Bone();
    rl_preactuator.name = "rl_preactuator";
    rl_preactuator.position.copy(armature.rl_actuator.position);
    armature.rl_actuator.parent.add(rl_preactuator);
    rl_preactuator.setIKBoneOrientation(armature.rl_actuator.parent.getIKBoneOrientation());
    rl_preactuator.attach(armature.rl_actuator);

    armature.rr_actuator = armature.bonetags["spot_actuator_RR_021"];
    armature.setInternalOrientationFor(armature.lower_rr_leg, armature.rr_actuator.position);
    let rr_preactuator = new THREE.Bone();
    rr_preactuator.name = "rr_preactuator";
    rr_preactuator.position.copy(armature.rr_actuator.position);
    armature.rr_actuator.parent.add(rr_preactuator);
    rr_preactuator.setIKBoneOrientation(armature.rr_actuator.parent.getIKBoneOrientation());
    rr_preactuator.attach(armature.rr_actuator);

    armature.inferOrientations();



    new Kusudama(armature.bonetags["spot_shoulder_FL_03"], "Kusudama for spot_shoulder_FL_03", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.8841641200237743, 0, 0.4671764215610469), 1e-12).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.8123889237893184, 0, -0.5831159717452721), 1e-12);

    new Twist(armature.bonetags["spot_shoulder_FL_03"], 0, undefined,
        armature.stablePool.any_Vec3(-0.9866621447148427, -2.79668928647032e-7, -0.1627814860069433),
        0.16350912602229606,
        "Twist for spot_shoulder_FL_03",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["spot_upperLeg_FL_04"], "Kusudama for spot_upperLeg_FL_04", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.456902151688851, 0, 0.8895169609299747), 0.01047).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.7808287573152579, 0, 0.6247451094242434), 0).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0.5868126761097257, 0, -0.8097227199214199), 1e-12);

    new Twist(armature.bonetags["spot_upperLeg_FL_04"], 0, undefined,
        armature.stablePool.any_Vec3(-0.6175472669902734, -0.0449171919804714, -0.7852501632584572),
        0.9048116295128841,
        "Twist for spot_upperLeg_FL_04",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["spot_lowerLeg_FL_06"], "Kusudama for spot_lowerLeg_FL_06", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.9965808073932034, 0.0826238121579427), 1e-12).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.014556511648500598, 0.9069136777510866, 0.42106494638787667), 1e-12);

    new Twist(armature.bonetags["spot_lowerLeg_FL_06"], 0, undefined,
        armature.stablePool.any_Vec3(0, -0.20224161290144133, 0.9793356574796119),
        -6.272831666974913,
        "Twist for spot_lowerLeg_FL_06",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["spot_shoulder_FR_08"], "Kusudama for spot_shoulder_FR_08", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.8841641200237743, 0, 0.4671764215610469), 1e-12).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.8123889237893184, 0, -0.5831159717452721), 1e-12);

    new Twist(armature.bonetags["spot_shoulder_FR_08"], 0, undefined,
        armature.stablePool.any_Vec3(1, 0, 0),
        6.11967618115729,
        "Twist for spot_shoulder_FR_08",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["spot_upperLeg_FR_09"], "Kusudama for spot_upperLeg_FR_09", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.456902151688851, 0, 0.8895169609299747), 1e-12).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.7808287573152579, 0, 0.6247451094242434), 1e-12).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(-0.5868126761097257, 0, -0.8097227199214199), 1e-12);

    new Twist(armature.bonetags["spot_upperLeg_FR_09"], 0, undefined,
        armature.stablePool.any_Vec3(0.6175472669902734, -0.0449171919804714, -0.7852501632584572),
        5.378373677666702,
        "Twist for spot_upperLeg_FR_09",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["spot_lowerLeg_FR_010"], "Kusudama for spot_lowerLeg_FR_010", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, -0.996553281758904, 0.08295514821612114), 1e-12).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, 0.9070097769140707, 0.4211095636319458), 1e-12);

    new Twist(armature.bonetags["spot_lowerLeg_FR_010"], 0, undefined,
        armature.stablePool.any_Vec3(0, -0.20224161290144133, 0.9793356574796119),
        6.272831666974913,
        "Twist for spot_lowerLeg_FR_010",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["spot_shoulder_RL_013"], "Kusudama for spot_shoulder_RL_013", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.9356594796393414, 0, 0.3529041486877664), 0).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.8301654744303982, 0, -0.5575170715446766), 1e-12);

    new Twist(armature.bonetags["spot_shoulder_RL_013"], 0, undefined,
        armature.stablePool.any_Vec3(-0.9446007755875565, 0.0002489239219263265, 0.3282214386603472),
        2.942657991430149,
        "Twist for spot_shoulder_RL_013",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["spot_upperLeg_RL_014"], "Kusudama for spot_upperLeg_RL_014", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.38741582416375747, -0.0571555288664638, -0.9201316344455892), 1e-12).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.20974675160146214, 0.05576424934784627, 0.9761642529243251), 1e-12);

    new Twist(armature.bonetags["spot_upperLeg_RL_014"], 0, undefined,
        armature.stablePool.any_Vec3(0.9942574645228673, -0.017582070926118423, 0.10556024356976644),
        3.301716117051777,
        "Twist for spot_upperLeg_RL_014",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["spot_lowerLeg_RL_015"], "Kusudama for spot_lowerLeg_RL_015", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9255357525111507, 0.37866023137321675), 1e-12).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, -0.8878824247653099, 0.46007042916587665), 1e-12).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, 0.7076049189236652, 0.7066082922772938), 1e-12);

    new Twist(armature.bonetags["spot_lowerLeg_RL_015"], 0, undefined,
        armature.stablePool.any_Vec3(0, -0.4580822007700582, 0.8889098364500532),
        0.0000013140086939960122,
        "Twist for spot_lowerLeg_RL_015",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["spot_shoulder_RR_018"], "Kusudama for spot_shoulder_RR_018", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0.9103979433455949, 0, 0.41373371237078455), 1e-12).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0.8301733080242956, 0, -0.5575054068293852), 1e-12);

    new Twist(armature.bonetags["spot_shoulder_RR_018"], 0, undefined,
        armature.stablePool.any_Vec3(0.9446007755875565, 0.0002489239219263265, 0.3282214386603472),
        3.3405273157494375,
        "Twist for spot_shoulder_RR_018",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["spot_upperLeg_RR_019"], "Kusudama for spot_upperLeg_RR_019", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(-0.4553214582738525, 0, -0.8903271138381513), 1e-12).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(-0.17995575377312534, 0, 0.9836747057253971), 1e-12);

    new Twist(armature.bonetags["spot_upperLeg_RR_019"], 0, undefined,
        armature.stablePool.any_Vec3(-0.9368012983781173, -0.044603415146500826, 0.3470070067222598),
        2.798753921785249,
        "Twist for spot_upperLeg_RR_019",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

    new Kusudama(armature.bonetags["spot_lowerLeg_RR_020"], "Kusudama for spot_lowerLeg_RR_020", armature.stablePool)
        .addLimitConeAtIndex(0, armature.stablePool.any_Vec3(0, 0.9255357525111507, 0.37866023137321675), 1e-12).parentKusudama
        .addLimitConeAtIndex(1, armature.stablePool.any_Vec3(0, -0.8878824247653099, 0.46007042916587665), 1e-12).parentKusudama
        .addLimitConeAtIndex(2, armature.stablePool.any_Vec3(0, 0.7076049189236652, 0.7066082922772938), 1e-12);

    new Twist(armature.bonetags["spot_lowerLeg_RR_020"], 0, undefined,
        armature.stablePool.any_Vec3(0, -0.2022416129014413, 0.9793356574796117),
        6.272831666974913,
        "Twist for spot_lowerLeg_RR_020",
        armature.stablePool).setPainfulness(0).setStockholmRate(0);

   

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
    armature.fl_foot_pin.setPSTPriorities(1.0000, 0, 0);


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
    armature.rl_foot_pin.setPSTPriorities(1, 0, 0);



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
    armature.fr_foot_pin.setPSTPriorities(1, 0, 0);


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
    armature.rr_foot_pin.setPSTPriorities(1, 0, 0);

    return armature;
}