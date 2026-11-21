import * as THREE from './node_modules/three/build/three.module.js';
import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from './node_modules/three/examples/jsm/loaders/HDRLoader.js';

const GAME_ID = 'reflex-field';

const LEVEL_DEFINITIONS = {
  1: {
    label: 'Warm up',
    visualTheme: 'steady',
    speedMin: 0.16,
    speedMax: 0.46,
    riskSpeedMin: 0.44,
    riskSpeedMax: 0.68,
    responseWindow: [28, 54],
    penalty: 10,
    riskPenalty: 100,
    distractionLevel: 1,
    uncertainty: 0.12,
    stoneColor: 0x68747a,
    stoneScale: 0.82,
    skyColor: 0xb7d8d5,
    groundColor: 0x7ea76a
  },
  2: {
    label: 'Focus',
    visualTheme: 'focus',
    speedMin: 0.22,
    speedMax: 0.52,
    riskSpeedMin: 0.48,
    riskSpeedMax: 0.68,
    responseWindow: [30, 56],
    penalty: 10,
    riskPenalty: 100,
    distractionLevel: 2,
    uncertainty: 0.18,
    stoneColor: 0x3f7180,
    stoneScale: 1,
    skyColor: 0x9fc9d7,
    groundColor: 0x688f7e
  },
  3: {
    label: 'Alert',
    visualTheme: 'alert',
    speedMin: 0.28,
    speedMax: 0.59,
    riskSpeedMin: 0.5,
    riskSpeedMax: 0.68,
    responseWindow: [32, 58],
    penalty: 15,
    riskPenalty: 100,
    distractionLevel: 3,
    uncertainty: 0.24,
    stoneColor: 0xb2673c,
    stoneScale: 1.16,
    skyColor: 0xd9b58f,
    groundColor: 0x8b795a
  },
  4: {
    label: 'Max risk',
    visualTheme: 'risk',
    speedMin: 0.31,
    speedMax: 0.64,
    riskSpeedMin: 0.54,
    riskSpeedMax: 0.68,
    responseWindow: [35, 60],
    penalty: 20,
    riskPenalty: 100,
    distractionLevel: 4,
    uncertainty: 0.3,
    stoneColor: 0x8f3548,
    stoneScale: 1.34,
    skyColor: 0x8c9bc1,
    groundColor: 0x4e5b6d
  }

};

const state = {
  score: 50,
  bestScore: 50,
  round: 0,
  streak: 0,
  coins: 0,
  safeResponses: 0,
  hits: 0,
  premature: 0,
  riskTrials: 0,
  riskHits: 0,
  responseTimes: [],
  trialRecords: [],
  sessionEvents: [],
  active: false,
  locked: false,
  ducked: false,
  stonePosition: 3,
  stoneSpeed: 0,
  baseStoneSpeed: 0,
  bounceCount: 0,
  nextBouncePosition: 10,
  roundStartedAt: 0,
  animationFrame: 0,
  lastFrame: 0,
  roundTimeout: 0,
  lockTimeout: 0,
  warningTimeout: 0,
  level: 1,
  currentTrial: null,
  previousSpeed: 0,
  isRiskTrial: false,
  lastResult: null,
  stoneScale: 0.82,
  stoneGeometryLevel: 0,
  finished: false
};

const elements = {
  arena: document.querySelector('#arena'),
  stone: document.querySelector('#stone'),
  character: document.querySelector('#character'),
  impactRing: document.querySelector('#impactRing'),
  arenaMessage: document.querySelector('#arenaMessage'),
  levelIntro: document.querySelector('#levelIntro'),
  duckButton: document.querySelector('#duckButton'),
  resetButton: document.querySelector('#resetButton'),
  scoreValue: document.querySelector('#scoreValue'),
  bestScore: document.querySelector('#bestScore'),
  roundValue: document.querySelector('#roundValue'),
  trialValue: document.querySelector('#trialValue'),
  difficultyValue: document.querySelector('#difficultyValue'),
  speedValue: document.querySelector('#speedValue'),
  streakValue: document.querySelector('#streakValue'),
  coinValue: document.querySelector('#coinValue'),
  connectionStatus: document.querySelector('#connectionStatus'),
  inhibitionMetric: document.querySelector('#inhibitionMetric'),
  prematureMetric: document.querySelector('#prematureMetric'),
  consistencyMetric: document.querySelector('#consistencyMetric'),
  speedAccuracyMetric: document.querySelector('#speedAccuracyMetric'),
  riskMetric: document.querySelector('#riskMetric'),
  scoreHealthFill: document.querySelector('#scoreHealthFill'),
  scoreFeedback: document.querySelector('#scoreFeedback')
};

let renderer;
let scene;
let camera;
let stoneMesh;
let playerMesh;
let playerModel;
let characterRig;
let safeZoneMesh;
let impactMesh;
let sparkGroup;
let sparkParticles = [];
let groundMesh;
let bounceRingMesh;
let bounceDustParticles = [];
let lastBounceIndex = -1;
let ringPulse = 0;
const PLAYER_FACING_ROTATION = -Math.PI / 2;
let cameraViewMode = 'wide';
let cameraYaw = 0;
let cameraPitch = 0;
let cameraRotationLocked = false;
let duckPoseHoldUntil = 0;
const cameraOffset = new THREE.Vector3();
const environmentLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

if (typeof window !== 'undefined') {
  window.__reflexField = {};
}

function applyImpactVisuals() {
  if (!stoneMesh || !playerMesh || !impactMesh) return;

  stoneMesh.visible = false;
  impactMesh.position.x = playerMesh.position.x;
  impactMesh.position.y = 1.3;
  impactMesh.position.z = 1.2;
  impactMesh.material.opacity = 1;
  impactMesh.scale.setScalar(1);
  playerMesh.rotation.z = -0.52;
  playerMesh.position.y = 0.1;

  sparkParticles.forEach((particle, index) => {
    const angle = (index / sparkParticles.length) * Math.PI * 2;
    const speed = 0.035 + (index % 3) * 0.012;
    particle.mesh.visible = true;
    particle.mesh.position.set(playerMesh.position.x, 1.35, 1.35);
    particle.velocity.set(Math.cos(angle) * speed, 0.018 + (index % 4) * 0.006, Math.sin(angle) * speed);
    particle.life = 1;
  });
}

function setupThreeScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb5c9d3);
  scene.fog = new THREE.Fog(0xb5c9d3, 30, 92);

  camera = new THREE.PerspectiveCamera(60, elements.arena.clientWidth / elements.arena.clientHeight, 0.1, 100);
  camera.position.set(1.8, 3.45, 13.6);
  camera.lookAt(1.8, 1.05, -2.2);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(elements.arena.clientWidth, elements.arena.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.zIndex = '0';
  elements.arena.appendChild(renderer.domElement);

  const ambient = new THREE.HemisphereLight(0xdce9f1, 0x53463a, 1.35);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffe6c1, 2.8);
  keyLight.position.set(-8, 15, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(3072, 3072);
  keyLight.shadow.radius = 3;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 65;
  keyLight.shadow.camera.left = -22;
  keyLight.shadow.camera.right = 22;
  keyLight.shadow.camera.top = 18;
  keyLight.shadow.camera.bottom = -12;
  keyLight.shadow.bias = -0.0002;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xc9dced, 0.55);
  fillLight.position.set(7, 8, -9);
  scene.add(fillLight);
  loadDaylightEnvironment();

  const groundMaterial = createPbrMaterial('forest_ground_04', 8, 8);
  const trailMaterial = createPbrMaterial('rocky_trail', 8, 1.6);
  const terrainGeometry = new THREE.PlaneGeometry(42, 42, 64, 64);
  const terrainPosition = terrainGeometry.attributes.position;
  for (let index = 0; index < terrainPosition.count; index += 1) {
    const x = terrainPosition.getX(index);
    const z = -terrainPosition.getY(index) - 4;
    const shoulder = THREE.MathUtils.clamp((Math.abs(z) - 2.2) / 5, 0, 1);
    const height = shoulder * (
      Math.sin(x * 0.24) * 0.09
      + Math.cos(z * 0.19) * 0.12
      + Math.sin((x + z) * 0.72) * 0.035
    );
    terrainPosition.setZ(index, height);
  }
  terrainGeometry.computeVertexNormals();
  groundMesh = new THREE.Mesh(terrainGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(0, -0.04, -4);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 4.4, 1, 1),
    trailMaterial
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, -0.015, 0);
  lane.receiveShadow = true;
  scene.add(lane);

  safeZoneMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 1.8),
    new THREE.MeshStandardMaterial({
      color: 0xd6b85d,
      emissive: 0x806324,
      emissiveIntensity: 0.28,
      transparent: true,
      opacity: 0.38,
      roughness: 0.78
    })
  );
  safeZoneMesh.rotation.x = -Math.PI / 2;
  safeZoneMesh.position.set(4.5, 0.006, 0);
  scene.add(safeZoneMesh);

  const distantVegetation = new THREE.Group();
  scene.add(distantVegetation);
  loadEnvironmentModel('fir_sapling', distantVegetation, [
    { x: -18, z: -13, height: 7.2, rotation: 0.2 },
    { x: -14, z: -9, height: 6.1, rotation: -0.4 },
    { x: -10, z: -12, height: 7.6, rotation: 0.8 },
    { x: 10, z: -12, height: 6.8, rotation: -0.2 },
    { x: 15, z: -9, height: 7.4, rotation: 0.55 },
    { x: 19, z: -14, height: 6.5, rotation: -0.7 },
    { x: -9, z: 3.6, height: 9.2, rotation: 0.35 },
    { x: 12, z: 3.8, height: 8.8, rotation: -0.5 }
  ]);
  loadEnvironmentModel('shrub_03', distantVegetation, [
    { x: -9, z: 2.7, height: 2.4, rotation: 0.3 },
    { x: 11, z: 2.5, height: 2.3, rotation: -0.2 },
    { x: -16, z: -3.2, height: 1.8, rotation: 0.3 },
    { x: -12, z: -4.5, height: 1.5, rotation: 1.1 },
    { x: -8, z: -3.4, height: 1.9, rotation: -0.5 },
    { x: 9, z: -3.6, height: 1.7, rotation: 0.8 },
    { x: 13, z: -4.8, height: 1.5, rotation: -0.2 },
    { x: 17, z: -3.3, height: 1.8, rotation: 0.6 },
    { x: -14, z: 3.8, height: 1.6, rotation: -0.7 },
    { x: 16, z: 3.7, height: 1.7, rotation: 0.4 }
  ]);
  loadEnvironmentModel('fern_02', distantVegetation, [
    { x: -15, z: -2.8, height: 1.2, rotation: 0.1 },
    { x: -11, z: -3.8, height: 1.1, rotation: 1.4 },
    { x: -7, z: -3.1, height: 1.3, rotation: -0.8 },
    { x: 8, z: -3.4, height: 1.2, rotation: 0.6 },
    { x: 12, z: -4, height: 1.1, rotation: -0.3 },
    { x: 16, z: -3, height: 1.2, rotation: 1.2 }
  ]);
  loadEnvironmentModel('grass_bermuda_01', distantVegetation, [
    { x: -13, z: -2.7, height: 0.7, rotation: 0.8 },
    { x: 8, z: -2.8, height: 0.75, rotation: 1.4 }
  ]);
  loadEnvironmentModel('rock_moss_set_01', distantVegetation, [
    { x: -18, z: -2.2, height: 2.4, rotation: 0.2 },
    { x: -12, z: -2.5, height: 1.8, rotation: -0.5 },
    { x: -4, z: -2.4, height: 1.3, rotation: 0.7 },
    { x: 9, z: -2.5, height: 1.7, rotation: -0.3 },
    { x: 15, z: -2.3, height: 2.1, rotation: 0.9 },
    { x: 19, z: -2.5, height: 1.5, rotation: -0.7 }
  ]);

  const playerGroup = new THREE.Group();
  const fallbackPlayerGroup = new THREE.Group();
  const shirtMaterial = new THREE.MeshStandardMaterial({ color: 0x59666a, roughness: 0.86 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xb88368, roughness: 0.94 });
  const trouserMaterial = new THREE.MeshStandardMaterial({ color: 0x303b42, roughness: 0.9 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x3b302d, roughness: 1 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.75, 6, 12), shirtMaterial);
  torso.position.y = 1.9;
  fallbackPlayerGroup.add(torso);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.34, 12), skinMaterial);
  neck.position.y = 2.9;
  fallbackPlayerGroup.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 18), skinMaterial);
  head.scale.set(0.92, 1.08, 0.9);
  head.position.y = 3.35;
  fallbackPlayerGroup.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.49, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMaterial);
  hair.scale.set(0.95, 0.72, 0.92);
  hair.position.set(0, 3.58, -0.02);
  fallbackPlayerGroup.add(hair);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), hairMaterial);
  leftEye.position.set(-0.16, 3.34, 0.43);
  fallbackPlayerGroup.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.17;
  fallbackPlayerGroup.add(rightEye);

  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 1.12, 5, 10), shirtMaterial);
  leftArm.position.set(-0.76, 2, 0);
  leftArm.rotation.z = 0.4;
  fallbackPlayerGroup.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.76;
  rightArm.rotation.z = -0.4;
  fallbackPlayerGroup.add(rightArm);

  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), skinMaterial);
  leftHand.position.set(-0.94, 1.42, 0);
  fallbackPlayerGroup.add(leftHand);
  const rightHand = leftHand.clone();
  rightHand.position.x = 0.94;
  fallbackPlayerGroup.add(rightHand);

  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.32, 5, 10), trouserMaterial);
  leftLeg.position.set(-0.26, 0.4, 0);
  fallbackPlayerGroup.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.26;
  fallbackPlayerGroup.add(rightLeg);

  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.68), trouserMaterial);
  leftBoot.position.set(-0.26, -0.18, 0.18);
  fallbackPlayerGroup.add(leftBoot);
  const rightBoot = leftBoot.clone();
  rightBoot.position.x = 0.26;
  fallbackPlayerGroup.add(rightBoot);

  playerGroup.position.set(5.2, 0, 0.5);
  fallbackPlayerGroup.traverse((part) => {
    if (part.isMesh) part.castShadow = true;
  });
  scene.add(playerGroup);
  playerGroup.add(fallbackPlayerGroup);
  playerMesh = playerGroup;
  loadCharacterModel(playerGroup, fallbackPlayerGroup);

  stoneMesh = new THREE.Group();
  stoneMesh.position.set(-8, 0.9, 0.4);
  state.stoneGeometryLevel = 1;
  scene.add(stoneMesh);
  loadEnvironmentModel('boulder_01', stoneMesh, [
    { x: 0, z: 0, height: 1.8, rotation: 0 }
  ]);

  impactMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.12, 12, 60),
    new THREE.MeshBasicMaterial({ color: 0xea6a52, transparent: true, opacity: 0 })
  );
  impactMesh.rotation.x = Math.PI / 2;
  impactMesh.position.set(5.2, 0.5, 0.4);
  scene.add(impactMesh);

  sparkGroup = new THREE.Group();
  const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffa51f });
  for (let index = 0; index < 14; index += 1) {
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), sparkMaterial);
    spark.visible = false;
    spark.rotation.z = (index / 14) * Math.PI;
    sparkGroup.add(spark);
    sparkParticles.push({ mesh: spark, velocity: new THREE.Vector3(), life: 0 });
  }
  scene.add(sparkGroup);

  bounceRingMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.06, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xf3d27a, transparent: true, opacity: 0 })
  );
  bounceRingMesh.rotation.x = Math.PI / 2;
  bounceRingMesh.position.y = 0.018;
  scene.add(bounceRingMesh);

  const dustMaterial = new THREE.MeshBasicMaterial({ color: 0xd3b47d, transparent: true, opacity: 0 });
  for (let index = 0; index < 8; index += 1) {
    const dust = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dustMaterial);
    dust.visible = false;
    scene.add(dust);
    bounceDustParticles.push({ mesh: dust, velocity: new THREE.Vector3(), life: 0 });
  }

  window.addEventListener('resize', onResize);
}

function loadDaylightEnvironment() {
  new HDRLoader().load(
    './assets/environment/hdris/lago_disola_2k.hdr',
    (environmentMap) => {
      environmentMap.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = environmentMap;
      scene.backgroundRotation.y = -0.55;

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromEquirectangular(environmentMap).texture;
      scene.environmentIntensity = 0.55;
      scene.backgroundIntensity = 0.9;
      pmremGenerator.dispose();
    },
    undefined,
    (error) => console.error('Unable to load the alpine daylight environment.', error)
  );
}

function createPbrMaterial(assetName, repeatX, repeatY) {
  const assetPath = `./assets/environment/textures/${assetName}/${assetName}`;
  const loadMap = (mapName, colorSpace) => {
    const texture = textureLoader.load(
      `${assetPath}_${mapName}_1k.jpg`,
      undefined,
      undefined,
      (error) => console.error(`Unable to load ${assetName} ${mapName} texture.`, error)
    );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.colorSpace = colorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  };

  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: loadMap('diff', THREE.SRGBColorSpace),
    normalMap: loadMap('nor_gl', THREE.NoColorSpace),
    roughnessMap: loadMap('rough', THREE.NoColorSpace),
    roughness: 1
  });
}

function loadEnvironmentModel(assetName, targetGroup, placements) {
  environmentLoader.load(
    `./assets/environment/models/${assetName}/${assetName}_1k.gltf`,
    (gltf) => {
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      if (!Number.isFinite(size.y) || size.y <= 0) {
        console.error(`The ${assetName} model has invalid dimensions and was not added.`);
        return;
      }

      const center = bounds.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -bounds.min.y, -center.z);
      const castsShadow = assetName !== 'grass_bermuda_01' && assetName !== 'fern_02';
      model.traverse((part) => {
        if (!part.isMesh) return;
        part.castShadow = castsShadow;
        part.receiveShadow = true;
        part.frustumCulled = true;
      });

      placements.forEach(({ x, z, height, rotation }) => {
        const instance = new THREE.Group();
        instance.add(model.clone(true));
        instance.scale.setScalar(height / size.y);
        instance.rotation.y = rotation;
        instance.position.set(x, 0, z);
        targetGroup.add(instance);
      });
    },
    undefined,
    (error) => console.error(`Unable to load environment model "${assetName}".`, error)
  );
}

function loadCharacterModel(playerGroup, fallbackPlayerGroup) {
  const loader = new GLTFLoader();
  loader.load(
    './assets/characters/adult_male.glb',
    (gltf) => {
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      if (!Number.isFinite(size.y) || size.y <= 0) {
        console.error('Character model has invalid dimensions; keeping fallback character.');
        return;
      }

      const targetHeight = 3.8;
      model.scale.setScalar(targetHeight / size.y);
      model.updateMatrixWorld(true);

      const scaledBounds = new THREE.Box3().setFromObject(model);
      const modelCenter = scaledBounds.getCenter(new THREE.Vector3());
      model.position.x -= modelCenter.x;
      model.position.y -= scaledBounds.min.y;
      model.position.z -= modelCenter.z;
      model.rotation.y = Math.PI;
      model.traverse((part) => {
        if (!part.isMesh) return;
        part.castShadow = true;
        part.receiveShadow = true;
        if (part.material) {
          const materials = Array.isArray(part.material) ? part.material : [part.material];
          materials.forEach((material) => {
            if ('roughness' in material) material.roughness = Math.max(material.roughness ?? 0, 0.62);
            if ('metalness' in material) material.metalness = Math.min(material.metalness ?? 0, 0.08);
            material.needsUpdate = true;
          });
        }
      });

      playerGroup.add(model);
      fallbackPlayerGroup.visible = false;
      playerModel = model;
      characterRig = createCharacterRig(model, gltf.animations);
      window.__reflexField.characterRig = characterRig;
      console.info(
        `Loaded adult character model (${size.y.toFixed(2)} source units, normalized to ${targetHeight.toFixed(2)} units). `
        + `${characterRig.bones.length} bones, ${gltf.animations.length} animation clip(s).`
      );
    },
    undefined,
    (error) => {
      console.error('Unable to load assets/characters/adult_male.glb; keeping fallback character.', error);
    }
  );
}

function createCharacterRig(model, animations) {
  const bones = [];
  const map = {};
  model.traverse((part) => {
    if (!part.isBone) return;
    bones.push(part);
    map[part.name] = part;
    part.userData.restQuaternion = part.quaternion.clone();
    part.userData.restPosition = part.position.clone();
  });

  const clipSummary = animations.map((clip) => ({
    name: clip.name,
    duration: clip.duration,
    trackCount: clip.tracks.length
  }));
  if (clipSummary.some((clip) => clip.duration < 1)) {
    console.info('Character animation clips are short rest-pose data; procedural posing will be used.');
  }

  return {
    bones,
    map,
    modelScale: model.scale.y,
    animations: clipSummary,
    duckAmount: 0,
    anticipation: 0,
    lastPoseTimestamp: null
  };
}

function onResize() {
  if (!renderer || !camera) return;
  const width = elements.arena.clientWidth;
  const height = elements.arena.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function mapReactionWindowToWorld(startValue, endValue) {
  const left = THREE.MathUtils.mapLinear(startValue, 3, 78, -8.5, 8.5);
  const right = THREE.MathUtils.mapLinear(endValue, 3, 78, -8.5, 8.5);
  return {
    left,
    right,
    center: (left + right) / 2,
    width: Math.abs(right - left)
  };
}

function getPlayerContactPosition() {
  const playerX = playerMesh ? playerMesh.position.x : 5.2;
  return THREE.MathUtils.clamp(
    THREE.MathUtils.mapLinear(playerX - 0.9, -8.5, 8.5, 3, 78),
    3,
    78
  );
}

function triggerBounceEffect(xPosition) {
  if (!bounceRingMesh) return;

  bounceRingMesh.position.x = xPosition;
  bounceRingMesh.scale.setScalar(0.7);
  bounceRingMesh.material.opacity = 0.8;

  bounceDustParticles.forEach((particle, index) => {
    const angle = (index / bounceDustParticles.length) * Math.PI * 2;
    particle.mesh.visible = true;
    particle.mesh.position.set(xPosition, 0.12, 0.1);
    particle.velocity.set(Math.cos(angle) * 0.018, 0.012 + (index % 3) * 0.004, Math.sin(angle) * 0.018);
    particle.life = 1;
  });
}

function updateThreeScene() {
  if (!stoneMesh || !playerMesh || !safeZoneMesh || !impactMesh) return;

  if (state.lastResult === 'hit' && !state.active) {
    stoneMesh.visible = false;
    playerMesh.rotation.y = PLAYER_FACING_ROTATION;
    playerMesh.rotation.z = -0.52;
    playerMesh.position.y = 0.1;
    impactMesh.position.x = playerMesh.position.x;
    impactMesh.position.y = 1.3;
    impactMesh.position.z = 1.2;
    const impactAlpha = Math.max(0, impactMesh.material.opacity - 0.025);
    impactMesh.material.opacity = impactAlpha;
    impactMesh.scale.setScalar(0.95 + (1 - impactAlpha) * 0.25);
    sparkParticles.forEach((particle) => {
      if (particle.life <= 0) {
        particle.mesh.visible = false;
        return;
      }
      particle.life = Math.max(0, particle.life - 0.01);
      particle.mesh.position.add(particle.velocity);
      particle.velocity.y -= 0.0015;
      particle.mesh.scale.setScalar(particle.life);
    });
    return;
  }

  stoneMesh.visible = true;

  const xPosition = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(state.stonePosition, 3, 78, -8.5, 8.5), -8.5, 8.5);
  stoneMesh.position.x = xPosition;
  const bounceHeight = 0.08 + state.level * 0.02;
  const bouncePhase = state.stonePosition * 0.48;
  const bounceAmount = Math.abs(Math.sin(bouncePhase));
  stoneMesh.position.y = state.stoneScale * 0.98 + bounceAmount * bounceHeight;
  const bounceSquash = 1 - bounceAmount * 0.06;
  stoneMesh.scale.set(
    state.stoneScale * (1 + (1 - bounceSquash) * 0.35),
    state.stoneScale * bounceSquash,
    state.stoneScale * (1 + (1 - bounceSquash) * 0.35)
  );
  stoneMesh.rotation.set(
    0.05 + Math.sin(bouncePhase) * 0.025,
    Math.sin(state.stonePosition * 0.31) * 0.09,
    -state.stonePosition * 0.22
  );

  if (state.currentTrial) {
    const zone = mapReactionWindowToWorld(state.currentTrial.safe_zone_start, state.currentTrial.safe_zone_end);
    safeZoneMesh.position.x = zone.center;
    safeZoneMesh.scale.x = Math.max(0.28, zone.width / 4.2);
  } else {
    safeZoneMesh.position.x = 4.5;
    safeZoneMesh.scale.x = 1;
  }

  const poseTime = performance.now();
  const duckStep = state.ducked && (state.active || poseTime < duckPoseHoldUntil) ? 1 : 0;
  playerMesh.rotation.y = PLAYER_FACING_ROTATION;
  playerMesh.rotation.z = THREE.MathUtils.lerp(playerMesh.rotation.z, 0, 0.12);
  playerMesh.position.y = THREE.MathUtils.lerp(playerMesh.position.y, 0, 0.12);
  const playerContact = getPlayerContactPosition();
  const anticipation = state.active
    ? Math.max(0, 1 - Math.abs(state.stonePosition - playerContact) / 18)
    : 0;
  updateCharacterPose(poseTime, duckStep, anticipation);

  const safeGlow = 0.6 + Math.sin(performance.now() * 0.008) * 0.28;
  safeZoneMesh.material.emissiveIntensity = safeGlow;

  const impactAlpha = Math.max(0, impactMesh.material.opacity - 0.08);
  impactMesh.material.opacity = impactAlpha;
  impactMesh.scale.setScalar(0.95 + (1 - impactAlpha) * 0.25);

  if (bounceRingMesh) {
    bounceRingMesh.material.opacity = Math.max(0, bounceRingMesh.material.opacity - 0.045);
    bounceRingMesh.scale.multiplyScalar(1.035);
  }
  bounceDustParticles.forEach((particle) => {
    particle.life = Math.max(0, particle.life - 0.035);
    if (particle.life <= 0) {
      particle.mesh.visible = false;
      return;
    }
    particle.mesh.position.add(particle.velocity);
    particle.velocity.y -= 0.0008;
    particle.mesh.material.opacity = particle.life * 0.65;
    particle.mesh.scale.setScalar(particle.life);
  });
}

function updateCharacterPose(timestamp, duckTarget, anticipationTarget) {
  if (!characterRig) return;

  const deltaSeconds = characterRig.lastPoseTimestamp === null
    ? 1 / 60
    : THREE.MathUtils.clamp((timestamp - characterRig.lastPoseTimestamp) / 1000, 0, 0.05);
  characterRig.lastPoseTimestamp = timestamp;
  const duckRate = duckTarget > characterRig.duckAmount ? 13 : 7;
  const duckInterpolation = 1 - Math.exp(-deltaSeconds * duckRate);
  const anticipationInterpolation = 1 - Math.exp(-deltaSeconds * 6);
  characterRig.duckAmount = THREE.MathUtils.lerp(characterRig.duckAmount, duckTarget, duckInterpolation);
  characterRig.anticipation = THREE.MathUtils.lerp(
    characterRig.anticipation,
    anticipationTarget,
    anticipationInterpolation
  );
  const duckAmount = characterRig.duckAmount;
  const anticipation = characterRig.anticipation;
  const standingAmount = 1 - duckAmount;
  const weightShift = Math.sin(timestamp * 0.0009) * 0.024 * standingAmount;
  const idleSway = Math.sin(timestamp * 0.0016) * 0.014 * standingAmount;
  const idleBreath = Math.sin(timestamp * 0.0022) * 0.012 * standingAmount;

  characterRig.bones.forEach((bone) => bone.quaternion.copy(bone.userData.restQuaternion));

  const hips = characterRig.map.Hips;
  if (hips?.userData.restPosition) {
    hips.position.copy(hips.userData.restPosition);
    hips.position.x += weightShift / characterRig.modelScale;
    hips.position.y -= duckAmount * (0.76 / characterRig.modelScale);
  }

  rotateBone(characterRig.map.Hips, 'x', -anticipation * 0.035 - duckAmount * 0.12);
  rotateBone(characterRig.map.Hips, 'z', Math.sin(timestamp * 0.0009) * 0.012 * standingAmount);
  rotateBone(characterRig.map.Spine, 'x', idleSway + anticipation * 0.035 + duckAmount * 0.28);
  rotateBone(characterRig.map.Spine01, 'x', idleBreath + duckAmount * 0.18);
  rotateBone(characterRig.map.Spine02, 'x', duckAmount * 0.1);
  rotateBone(characterRig.map.neck, 'x', duckAmount * -0.1);
  rotateBone(characterRig.map.Head, 'x', duckAmount * -0.13);

  const shoulderFlex = 1.02 - duckAmount * 0.3 + anticipation * 0.08;
  rotateBone(characterRig.map.LeftShoulder, 'x', shoulderFlex);
  rotateBone(characterRig.map.RightShoulder, 'x', shoulderFlex);
  rotateBone(characterRig.map.LeftShoulder, 'z', 0.025 + duckAmount * 0.04);
  rotateBone(characterRig.map.RightShoulder, 'z', -0.025 - duckAmount * 0.04);
  rotateBone(characterRig.map.LeftArm, 'x', duckAmount * 0.2 + anticipation * 0.04);
  rotateBone(characterRig.map.RightArm, 'x', duckAmount * 0.2 + anticipation * 0.04);
  rotateBone(characterRig.map.LeftForeArm, 'x', 0.42 + duckAmount * 0.48);
  rotateBone(characterRig.map.RightForeArm, 'x', 0.42 + duckAmount * 0.48);
  rotateBone(characterRig.map.LeftForeArm, 'z', -0.04 - duckAmount * 0.12);
  rotateBone(characterRig.map.RightForeArm, 'z', 0.04 + duckAmount * 0.12);

  rotateBone(characterRig.map.LeftUpLeg, 'x', duckAmount * 0.68);
  rotateBone(characterRig.map.RightUpLeg, 'x', duckAmount * 0.76);
  rotateBone(characterRig.map.LeftLeg, 'x', duckAmount * -1.32);
  rotateBone(characterRig.map.RightLeg, 'x', duckAmount * -1.38);
  rotateBone(characterRig.map.LeftFoot, 'x', duckAmount * 0.42);
  rotateBone(characterRig.map.RightFoot, 'x', duckAmount * 0.46);
}

function rotateBone(bone, axis, angle) {
  if (!bone) return;
  const rotation = new THREE.Quaternion();
  const axisVector = new THREE.Vector3();
  axisVector[axis] = 1;
  rotation.setFromAxisAngle(axisVector, angle);
  bone.quaternion.copy(bone.userData.restQuaternion).multiply(rotation);
}

function updateCameraMotion(timestamp) {
  if (!camera) return;

  const playerX = playerMesh ? playerMesh.position.x : 5.2;
  const stoneX = stoneMesh ? stoneMesh.position.x : -8;
  const cameraTargets = {
    wide: { position: new THREE.Vector3(1.8, 3.55, 14.4), target: new THREE.Vector3(1.8, 1.15, -3) },
    player: { position: new THREE.Vector3(playerX + 1.6, 2.9, 4.8), target: new THREE.Vector3(stoneX, 1.25, 0.4) },
    stone: { position: new THREE.Vector3(stoneX - 1.6, 2.7, 4.8), target: new THREE.Vector3(playerX, 1.3, 0.5) }
  };
  const view = cameraTargets[cameraViewMode];
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, view.position.x + cameraOffset.x, 0.08);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, view.position.y + cameraOffset.y, 0.08);
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, view.position.z + cameraOffset.z, 0.08);
  camera.lookAt(view.target.x + cameraOffset.x * 0.35 + cameraYaw * 5, view.target.y + cameraOffset.y * 0.3 + cameraPitch * 3, view.target.z + cameraOffset.z * 0.25);
}

function cycleCameraView() {
  const modes = ['wide', 'player', 'stone'];
  cameraViewMode = modes[(modes.indexOf(cameraViewMode) + 1) % modes.length];
  elements.arena.dataset.camera = cameraViewMode;
}

function moveCamera(direction) {
  const step = 0.8;
  if (direction === 'forward') cameraOffset.z = THREE.MathUtils.clamp(cameraOffset.z - step, -4, 3);
  if (direction === 'backward') cameraOffset.z = THREE.MathUtils.clamp(cameraOffset.z + step, -4, 3);
  if (direction === 'left') cameraOffset.x = THREE.MathUtils.clamp(cameraOffset.x - step, -4, 4);
  if (direction === 'right') cameraOffset.x = THREE.MathUtils.clamp(cameraOffset.x + step, -4, 4);
}

async function enterImmersiveView() {
  const immersiveButton = document.querySelector('#immersiveButton');
  try {
    if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) {
      renderer.xr.enabled = true;
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      await renderer.xr.setSession(session);
      immersiveButton.textContent = 'EXIT';
      session.addEventListener('end', () => { immersiveButton.textContent = 'VR'; });
      return;
    }
    if (!document.fullscreenElement) {
      await elements.arena.requestFullscreen();
      immersiveButton.textContent = 'EXIT';
    } else {
      await document.exitFullscreen();
      immersiveButton.textContent = 'VR';
    }
  } catch (error) {
    immersiveButton.textContent = 'VR';
  }
}

function getLevelDefinition(roundNumber) {
  const levelNumber = Math.min(4, Math.max(1, Math.ceil(roundNumber / 10)));
  return { level: levelNumber, ...LEVEL_DEFINITIONS[levelNumber] };
}

function getTrialResponseWindow(levelInfo, roundNumber) {
  const [baseStart, baseEnd] = levelInfo.responseWindow;
  const baseCenter = (baseStart + baseEnd) / 2;
  const baseWidth = baseEnd - baseStart;
  const trialIndex = Math.max(0, (roundNumber - 1) % 10);
  const widthFactor = Math.max(0.3, 1 - trialIndex * 0.1);
  const effectiveWidth = baseWidth * widthFactor;
  return [
    Math.round(baseCenter - effectiveWidth / 2),
    Math.round(baseCenter + effectiveWidth / 2)
  ];
}

function updateArenaVisualState(levelInfo, isRiskTrial) {
  elements.arena.dataset.speed = 'assessment';
  elements.difficultyValue.textContent = isRiskTrial ? 'MAX RISK' : levelInfo.label.toUpperCase();
  document.body.dataset.level = `level-${levelInfo.level}`;
  document.body.dataset.mode = isRiskTrial ? 'risk' : 'standard';
  scene.fog.color.set(0xb5c9d3);
  scene.fog.near = 34;
  scene.fog.far = 100;
  groundMesh.material.color.set(0xffffff);
  state.stoneScale = 0.9;
}

function describeSpeed(speed) {
  if (speed < 0.25) return ['SLOW APPROACH', 'STEADY'];
  if (speed < 0.38) return ['QUICK APPROACH', 'FOCUS'];
  if (speed < 0.52) return ['FAST APPROACH', 'ALERT'];
  if (speed < 0.62) return ['VERY FAST', 'UNPREDICTABLE'];
  return ['FASTEST APPROACH', 'MAX RISK'];
}

function updateHud() {
  elements.scoreValue.textContent = state.score;
  elements.bestScore.textContent = state.bestScore;
  elements.roundValue.textContent = state.round;
  elements.trialValue.textContent = String(((Math.max(state.round, 1) - 1) % 10) + 1).padStart(2, '0');
  elements.streakValue.textContent = state.streak;
  elements.coinValue.textContent = state.coins;
  const healthPercent = Math.min(100, Math.max(0, (state.score / 200) * 100));
  elements.scoreHealthFill.style.width = `${healthPercent}%`;
  elements.scoreHealthFill.parentElement.setAttribute('aria-valuenow', state.score);
  const attempts = state.safeResponses + state.hits + state.premature;
  elements.inhibitionMetric.textContent = `${attempts ? Math.round((state.safeResponses / attempts) * 100) : 0}%`;
  elements.prematureMetric.textContent = `${attempts ? Math.round((state.premature / attempts) * 100) : 0}%`;
  elements.riskMetric.textContent = `${state.riskHits} · ${state.riskTrials ? Math.round((state.riskHits / state.riskTrials) * 100) : 0}%`;
  if (state.responseTimes.length) {
    const mean = state.responseTimes.reduce((total, time) => total + time, 0) / state.responseTimes.length;
    const variance = state.responseTimes.reduce((total, time) => total + (time - mean) ** 2, 0) / state.responseTimes.length;
    const coefficientOfVariation = mean ? Math.sqrt(variance) / mean : 0;
    const consistency = Math.max(0, Math.min(100, 100 - coefficientOfVariation * 100));
    elements.consistencyMetric.textContent = `${consistency.toFixed(1)}%`;
  }
}

function showScoreFeedback(delta) {
  if (!delta) return;
  elements.scoreFeedback.textContent = `${delta > 0 ? '+' : ''}${delta}`;
  elements.scoreFeedback.className = `score-feedback ${delta > 0 ? 'gain' : 'loss'}`;
  window.setTimeout(() => {
    elements.scoreFeedback.textContent = '';
    elements.scoreFeedback.className = 'score-feedback';
  }, 650);
}

function setMessage(kicker, title, detail, hidden = false) {
  elements.arenaMessage.querySelector('.message-kicker').textContent = kicker;
  elements.arenaMessage.querySelector('strong').textContent = title;
  elements.arenaMessage.querySelector('small').textContent = detail;
  elements.arenaMessage.classList.toggle('hidden', hidden);
}

function showLevelIntro(levelInfo = getLevelDefinition(1), resetRound = true) {
  clearTimeout(state.roundTimeout);
  state.active = false;
  if (resetRound) {
    state.round = 0;
    state.currentTrial = null;
    state.stonePosition = 3;
  }
  elements.levelIntro.querySelector('span').textContent = 'RESPONSE INHIBITION';
  elements.levelIntro.querySelector('strong').textContent = `LEVEL ${String(levelInfo.level).padStart(2, '0')}`;
  elements.levelIntro.querySelector('em').textContent = '10 TRIALS';
  elements.levelIntro.querySelector('small').textContent = `${levelInfo.label.toUpperCase()} CHALLENGE`;
  lastBounceIndex = -1;
  elements.levelIntro.classList.remove('hidden');
  state.roundTimeout = window.setTimeout(() => {
    elements.levelIntro.classList.add('hidden');
    startRound();
  }, 1800);
}

function showRiskIntro(levelInfo) {
  clearTimeout(state.roundTimeout);
  state.active = false;
  elements.levelIntro.querySelector('span').textContent = 'WARNING';
  elements.levelIntro.querySelector('strong').textContent = 'MAXIMUM RISK';
  elements.levelIntro.querySelector('em').textContent = 'UNPREDICTABLE SPEED';
  elements.levelIntro.querySelector('small').textContent = 'IMPACT COSTS 100 POINTS';
  elements.levelIntro.classList.remove('hidden');
  logEvent('RISK_WARNING', { level: levelInfo.level, trial: state.round + 1 });
  state.roundTimeout = window.setTimeout(() => {
    elements.levelIntro.classList.add('hidden');
    startRound();
  }, 1800);
}

function showEndScreen() {
  clearTimeout(state.roundTimeout);
  clearTimeout(state.lockTimeout);
  state.active = false;
  state.locked = false;
  state.finished = true;
  document.body.classList.remove('locked');
  elements.duckButton.disabled = true;
  elements.connectionStatus.textContent = 'Session complete';
  elements.levelIntro.querySelector('span').textContent = 'RESPONSE INHIBITION';
  elements.levelIntro.querySelector('strong').textContent = 'THE END';
  elements.levelIntro.querySelector('em').textContent = `${state.round} TRIALS COMPLETE`;
  elements.levelIntro.querySelector('small').textContent = `FINAL SCORE · ${state.score}`;
  elements.levelIntro.classList.remove('hidden');
  setMessage('SESSION COMPLETE', 'THE END', `Final score ${state.score}`, true);
}

function showPlayAgainScreen() {
  clearTimeout(state.roundTimeout);
  clearTimeout(state.lockTimeout);
  clearTimeout(state.warningTimeout);
  state.active = false;
  state.locked = false;
  state.finished = true;
  document.body.classList.remove('locked');
  elements.duckButton.disabled = true;
  elements.connectionStatus.textContent = 'Score depleted';
  elements.levelIntro.querySelector('span').textContent = 'WARNING';
  elements.levelIntro.querySelector('strong').textContent = 'PLAY AGAIN';
  elements.levelIntro.querySelector('em').textContent = 'SCORE REACHED ZERO';
  elements.levelIntro.querySelector('small').textContent = 'RESET TO RESTART';
  elements.levelIntro.classList.remove('hidden');
  setMessage('SESSION PAUSED', 'PLAY AGAIN', 'Reset the session to try again', true);
}

function beginNextRound() {
  if (state.finished) return;
  const nextRound = state.round + 1;
  if (nextRound > 40) {
    showEndScreen();
    return;
  }
  const nextLevel = getLevelDefinition(nextRound);
  if (nextRound > 1 && nextRound % 10 === 1) {
    showLevelIntro(nextLevel, false);
  } else if (nextRound % 10 === 0) {
    showRiskIntro(getLevelDefinition(nextRound));
  } else {
    startRound();
  }
}

function logEvent(eventType, details = {}) {
  const eventRecord = {
    gameId: GAME_ID,
    level: state.level,
    trial: state.currentTrial ? state.currentTrial.trial_id : state.round,
    eventType,
    timestamp: performance.now(),
    ...details
  };

  state.sessionEvents.push(eventRecord);
}

function createTrialRecord(levelInfo, isRiskTrial) {
  const trialNumber = state.round;
  const responseWindow = getTrialResponseWindow(levelInfo, trialNumber);
  return {
    trial_id: `${GAME_ID}-${trialNumber}`,
    game_id: GAME_ID,
    level: levelInfo.level,
    condition: isRiskTrial ? 'risk_trial' : 'standard_trial',
    stimulus_type: 'approach_stone',
    stimulus_onset: performance.now(),
    response_type: null,
    response_timestamp: null,
    reaction_time: null,
    correctness: null,
    error_type: null,
    reward: 0,
    penalty: 0,
    safe_zone_start: responseWindow[0],
    safe_zone_end: responseWindow[1],
    response_window: responseWindow,
    base_response_window: levelInfo.responseWindow,
    stimulus_speed: state.stoneSpeed,
    trial_number: trialNumber,
    score_before: state.score,
    score_after: state.score
  };
}

function saveTrialRecord(result, responseTime) {
  if (!state.currentTrial) return;

  const trialRecord = { ...state.currentTrial };
  trialRecord.response_type = result;
  trialRecord.response_timestamp = performance.now();
  trialRecord.reaction_time = responseTime;
  trialRecord.correctness = result === 'safe';
  trialRecord.error_type = result === 'premature' ? 'premature_response' : result === 'hit' ? 'impact_hit' : null;
  trialRecord.penalty = result === 'premature' ? 5 : result === 'hit' ? (state.isRiskTrial ? 100 : 10) : 0;
  trialRecord.reward = result === 'safe' ? 10 : 0;
  trialRecord.score_after = state.score;

  state.trialRecords.push(trialRecord);
  state.currentTrial = null;

  logEvent('TRIAL_END', {
    result,
    reactionTime: responseTime,
    correctness: trialRecord.correctness,
    errorType: trialRecord.error_type
  });
}

function startRound() {
  if (state.locked || state.finished) return;

  state.round += 1;
  const isNewTrialSet = state.round > 1 && (state.round - 1) % 10 === 0;
  const isRiskTrial = state.round % 10 === 0;
  const levelInfo = getLevelDefinition(state.round);

  state.active = true;
  state.isRiskTrial = isRiskTrial;
  state.level = levelInfo.level;
  state.ducked = false;
  duckPoseHoldUntil = 0;
  state.lastResult = null;
  state.finished = false;
  state.stonePosition = 3;
  state.bounceCount = 0;
  state.nextBouncePosition = 10;
  stoneMesh.visible = true;
  playerMesh.rotation.set(0, PLAYER_FACING_ROTATION, 0);
  playerMesh.position.y = 0;
  sparkParticles.forEach((particle) => {
    particle.life = 0;
    particle.mesh.visible = false;
  });

  const progression = Math.min(1, (state.round - 1) / 14);
  const minimumSpeed = isRiskTrial ? levelInfo.riskSpeedMin + progression * 0.06 : levelInfo.speedMin + progression * 0.07;
  const maximumSpeed = isRiskTrial ? levelInfo.riskSpeedMax : levelInfo.speedMax + progression * 0.12;

  let nextSpeed = minimumSpeed + Math.random() * (maximumSpeed - minimumSpeed);
  if (state.previousSpeed && Math.abs(nextSpeed - state.previousSpeed) < 0.08) {
    nextSpeed = nextSpeed < (minimumSpeed + maximumSpeed) / 2 ? maximumSpeed : minimumSpeed;
  }

  state.stoneSpeed = Math.min(0.68, nextSpeed);
  state.baseStoneSpeed = state.stoneSpeed;
  state.previousSpeed = state.stoneSpeed;
  state.roundStartedAt = performance.now();

  state.currentTrial = createTrialRecord(levelInfo, isRiskTrial);
  state.currentTrial.stimulus_onset = state.roundStartedAt;

  const [speedText] = describeSpeed(state.stoneSpeed);
  elements.speedValue.textContent = `${isRiskTrial ? 'RISK · ' : ''}${speedText} · ${state.stoneSpeed.toFixed(2)}x`;
  updateArenaVisualState(levelInfo, isRiskTrial);
  if (safeZoneMesh && state.currentTrial) {
    const zone = mapReactionWindowToWorld(state.currentTrial.safe_zone_start, state.currentTrial.safe_zone_end);
    safeZoneMesh.position.x = zone.center;
    safeZoneMesh.scale.x = Math.max(0.28, zone.width / 4.2);
  }
  elements.character.classList.remove('ducking');
  elements.arena.focus();

  if (isRiskTrial) {
    state.riskTrials += 1;
    logEvent('RISK_TRIAL_START', { round: state.round, speed: state.stoneSpeed });
    setMessage('RISK TRIAL', 'Unpredictable speed', 'Impact costs the full 100 points', false);
  } else if (isNewTrialSet) {
    logEvent('LEVEL_RESET', { round: state.round, level: levelInfo.level });
    setMessage('NEW TRIAL SET', 'Fresh 10-round challenge', 'The score and research session continue', false);
  } else {
    setMessage(`TRIAL ${String(((state.round - 1) % 10) + 1).padStart(2, '0')}`, 'Hold your nerve', 'Duck only inside the yellow zone', true);
  }

  logEvent('STIMULUS_ONSET', {
    condition: isRiskTrial ? 'risk_trial' : 'standard_trial',
    speed: state.stoneSpeed,
    trialId: state.currentTrial.trial_id,
    level: levelInfo.level
  });

  updateHud();
}

function finishRound(result, responseTime = null) {
  state.active = false;
  const scoreBefore = state.score;

  if (result === 'hit') {
    state.stonePosition = getPlayerContactPosition();
  }

  if (responseTime !== null) {
    state.responseTimes.push(responseTime);
  }

  if (result === 'safe') {
    state.safeResponses += 1;
    state.streak += 1;
    state.score += 10;
    state.lastResult = 'safe';

    if (state.streak % 10 === 0) {
      state.coins += 25;
      setMessage('BONUS UNLOCKED', '+25 field coins', 'Ten safe responses in a row', false);
    } else {
      setMessage('SAFE RESPONSE', '+10 points', `${Math.round(responseTime)} ms after the stone entered the zone`, false);
    }

    elements.speedAccuracyMetric.textContent = `100% · ${Math.round(responseTime)} ms`;
    logEvent('CORRECT_RESPONSE', {
      result,
      reactionTime: responseTime,
      scoreDelta: 10
    });
  } else if (result === 'premature') {
    state.premature += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 5);
    state.lastResult = 'premature';
    setMessage('TOO SOON', '-5 points', 'Wait for the stone to enter the duck zone', false);
    elements.speedAccuracyMetric.textContent = `0% · ${Math.round(responseTime)} ms`;
    logEvent('PREMATURE_RESPONSE', {
      result,
      reactionTime: responseTime,
      scoreDelta: -5
    });
  } else {
    state.hits += 1;
    state.streak = 0;
    state.lastResult = 'hit';

    if (state.currentTrial) {
      state.currentTrial.response_type = 'hit';
    }

    const penalty = state.isRiskTrial ? 100 : 10;
    if (state.isRiskTrial) state.riskHits += 1;
    state.score = Math.max(0, state.score - penalty);

    applyImpactVisuals();

    setMessage('IMPACT', `-${penalty} points`, state.isRiskTrial ? 'Risk trial failed: full score penalty' : 'The trial lockout starts now', false);
    elements.speedAccuracyMetric.textContent = `0% · ${responseTime ? Math.round(responseTime) : 'MISSED'}${responseTime ? ' ms' : ''}`;
    logEvent('IMPACT_HIT', {
      result,
      reactionTime: responseTime,
      penalty,
      riskTrial: state.isRiskTrial
    });
    lockGame();
  }

  saveTrialRecord(result, responseTime);
  showScoreFeedback(state.score - scoreBefore);
  state.bestScore = Math.max(state.bestScore, state.score);
  updateHud();

  if (state.score <= 0) {
    state.warningTimeout = window.setTimeout(showPlayAgainScreen, 1200);
  }

  if (result !== 'hit') {
    clearTimeout(state.roundTimeout);
    state.roundTimeout = window.setTimeout(beginNextRound, 1800);
  }
}

function attemptDuck() {
  if (state.locked || !state.active) return;

  state.ducked = true;
  duckPoseHoldUntil = performance.now() + 700;
  elements.character.classList.add('ducking');

  const responseTime = performance.now() - state.roundStartedAt;
  const startZone = state.currentTrial ? state.currentTrial.safe_zone_start : 28;
  const endZone = state.currentTrial ? state.currentTrial.safe_zone_end : 54;

  if (state.stonePosition < startZone) {
    finishRound('premature', responseTime);
  } else if (state.stonePosition <= endZone) {
    finishRound('safe', responseTime);
  } else {
    finishRound('hit', responseTime);
  }
}

function lockGame() {
  state.locked = true;
  document.body.classList.add('locked');
  elements.connectionStatus.textContent = 'Locked for 10 seconds';
  elements.duckButton.disabled = true;
  clearTimeout(state.lockTimeout);

  state.lockTimeout = window.setTimeout(() => {
    state.locked = false;
    document.body.classList.remove('locked');
    elements.duckButton.disabled = false;
    elements.connectionStatus.textContent = 'Ready to test';
    setMessage('LOCKOUT COMPLETE', 'Back in the field', 'The next stone is already on its way', true);
    beginNextRound();
  }, 10000);
}

function tick(timestamp) {
  const elapsed = Math.min(timestamp - state.lastFrame, 50);
  state.lastFrame = timestamp;

  if (state.active && !state.locked) {
    state.stonePosition += state.stoneSpeed * elapsed / 10;
    while (state.stonePosition >= state.nextBouncePosition && state.nextBouncePosition < getPlayerContactPosition()) {
      state.bounceCount += 1;
      state.nextBouncePosition += 10;
      const bounceX = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(state.nextBouncePosition - 10, 3, 78, -8.5, 8.5), -8.5, 8.5);
      triggerBounceEffect(bounceX);
      state.stoneSpeed = Math.min(3, state.baseStoneSpeed * (1 + state.bounceCount * 0.35));
      const [speedText] = describeSpeed(state.stoneSpeed);
      elements.speedValue.textContent = `${state.isRiskTrial ? 'RISK · ' : ''}${speedText} · ${state.stoneSpeed.toFixed(2)}x · BOUNCE ${state.bounceCount}`;
      logEvent('STONE_BOUNCE_ACCELERATION', {
        bounce: state.bounceCount,
        speed: state.stoneSpeed,
        accelerationFactor: 1.35
      });
    }
    if (state.stonePosition >= getPlayerContactPosition()) {
      finishRound('hit', performance.now() - state.roundStartedAt);
    }
  }

  if (state.lastResult === 'hit' && !state.active && impactMesh) {
    impactMesh.position.x = playerMesh.position.x;
    impactMesh.position.y = 0.5;
  }

  updateThreeScene();
  updateCameraMotion(timestamp);
  renderer.render(scene, camera);
  state.animationFrame = requestAnimationFrame(tick);
}

if (typeof window !== 'undefined') {
  window.__reflexField = {
    state,
    startRound,
    finishRound,
    attemptDuck,
    lockGame,
    tick,
    updateThreeScene,
    applyImpactVisuals
  };
}

function resetSession() {
  clearTimeout(state.roundTimeout);
  clearTimeout(state.lockTimeout);
  clearTimeout(state.warningTimeout);

  state.score = 50;
  state.bestScore = 50;
  state.round = 0;
  state.streak = 0;
  state.coins = 0;
  state.safeResponses = 0;
  state.hits = 0;
  state.premature = 0;
  state.riskTrials = 0;
  state.riskHits = 0;
  state.responseTimes = [];
  state.trialRecords = [];
  state.sessionEvents = [];
  state.previousSpeed = 0;
  state.level = 1;
  state.locked = false;
  state.currentTrial = null;
  state.lastResult = null;
  state.finished = false;
  state.stonePosition = 3;
  state.bounceCount = 0;
  state.nextBouncePosition = 10;
  cameraYaw = 0;
  cameraPitch = 0;
  cameraRotationLocked = false;
  cameraOffset.set(0, 0, 0);

  document.body.classList.remove('locked');
  elements.duckButton.disabled = false;
  elements.connectionStatus.textContent = 'Ready to test';
  elements.character.classList.remove('ducking');
  elements.inhibitionMetric.textContent = '—';
  elements.consistencyMetric.textContent = '—';
  elements.speedAccuracyMetric.textContent = '—';
  elements.riskMetric.textContent = '0 · 0%';
  elements.levelIntro.classList.remove('hidden');
  updateHud();
  logEvent('GAME_RESET');
  showLevelIntro();
}

elements.duckButton.addEventListener('click', attemptDuck);
elements.resetButton.addEventListener('click', resetSession);
elements.arena.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    attemptDuck();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'KeyR' && !event.repeat) {
    event.preventDefault();
    resetSession();
    return;
  }
  if (event.code === 'Space' && document.activeElement !== elements.resetButton) {
    event.preventDefault();
    attemptDuck();
  }
  if (event.code === 'KeyV') {
    event.preventDefault();
    cycleCameraView();
  }
  const cameraMovement = {
    KeyW: 'forward',
    KeyS: 'backward',
    KeyA: 'left',
    KeyD: 'right'
  }[event.code];
  if (cameraMovement && document.activeElement !== elements.resetButton) {
    event.preventDefault();
    moveCamera(cameraMovement);
  }
});

document.querySelectorAll('[data-camera-move]').forEach((button) => {
  button.addEventListener('click', () => moveCamera(button.dataset.cameraMove));
});
document.querySelector('#immersiveButton').addEventListener('click', enterImmersiveView);

elements.arena.addEventListener('click', (event) => {
  if (event.target.closest('button')) return;
  cameraRotationLocked = !cameraRotationLocked;
  elements.arena.dataset.rotationLocked = String(cameraRotationLocked);
});

elements.arena.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse' || cameraRotationLocked) return;
  cameraYaw = THREE.MathUtils.clamp(cameraYaw + event.movementX * 0.004, -0.8, 0.8);
  cameraPitch = THREE.MathUtils.clamp(cameraPitch - event.movementY * 0.003, -0.35, 0.35);
});

setupThreeScene();
updateHud();
logEvent('GAME_START');
requestAnimationFrame(tick);
showLevelIntro();
