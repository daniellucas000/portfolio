<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';

const sceneContainer = ref(null);
const iframeContainer = ref(null);

const screenState = reactive({
  isZoomedIn: false,
  isHovered: false,
  isAnimating: false,
  lastHoverState: false,
});

const PDF_URL = '/CV_DANIEL_DEV.pdf';

const SCREEN_POS = {
  x: -3.9,
  y: 98.0,
  z: 39.2,
  scale: 0.0257,
  rotationX: -0.187,
};

const PAPER_MESHES = new Set(['Paper2_ComputerDesk_0', 'Paper_ComputerDesk_0']);

const cursorStyle = ref('default');

let renderer, cssRenderer, scene, camera, controls;
let screenObject, stencilMesh, maskMesh;
let monitorMeshes = [];
let paperMeshes = [];
let animFrameId = null;

const animState = {
  progress: 0,
  duration: 1,
  startCamPos: null,
  startTarget: null,
  endCamPos: null,
  endTarget: null,
};

const CAMERA_FAR = { position: null, target: null };
const CAMERA_CLOSE = { position: null, target: null };
const CAMERA_HOVER = { position: null, target: null };

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function startZoom(targetCam, durationSeconds = 1) {
  screenState.isAnimating = true;
  animState.progress = 0;
  animState.duration = durationSeconds;
  animState.startCamPos.copy(camera.position);
  animState.startTarget.copy(controls.target);
  animState.endCamPos.copy(targetCam.position);
  animState.endTarget.copy(targetCam.target);
}

const iframePointerEvents = ref('none');
function enableIframeInteraction() {
  iframePointerEvents.value = 'auto';
}
function disableIframeInteraction() {
  iframePointerEvents.value = 'none';
}

function zoomIn() {
  if (screenState.isZoomedIn || screenState.isAnimating) return;
  screenState.isZoomedIn = true;
  controls.enabled = false;
  startZoom(CAMERA_CLOSE, 1);
  setTimeout(enableIframeInteraction, 1000);
}

function zoomOut() {
  if (!screenState.isZoomedIn || screenState.isAnimating) return;
  screenState.isZoomedIn = false;
  screenState.isHovered = false;
  screenState.lastHoverState = false;
  disableIframeInteraction();
  startZoom(CAMERA_FAR, 1);
  setTimeout(() => {
    controls.enabled = true;
  }, 1000);
}

function onMonitorEnter() {
  if (screenState.isAnimating || screenState.isHovered) return;
  screenState.isHovered = true;
  startZoom(CAMERA_HOVER, 1.2);
}

function onMonitorLeave() {
  if (screenState.isAnimating || !screenState.isHovered) return;
  screenState.isHovered = false;
  startZoom(screenState.isZoomedIn ? CAMERA_CLOSE : CAMERA_FAR, 1.2);
}

function downloadPDF() {
  window.open(PDF_URL, '_blank');
}

function buildMouseHandlers(THREE) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function toNDC(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  function hitMonitor() {
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(monitorMeshes, false).length > 0;
  }

  function hitPaper() {
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(paperMeshes, false).length > 0;
  }

  function handleMouseMove(event) {
    if (screenState.isAnimating) return;
    toNDC(event);

    // Cursor pointer ao hover no papel
    const onPaper = hitPaper();
    cursorStyle.value = onPaper ? 'pointer' : 'default';

    const hitting = hitMonitor();
    if (hitting && !screenState.lastHoverState) {
      screenState.lastHoverState = true;
      onMonitorEnter();
    } else if (!hitting && screenState.lastHoverState) {
      screenState.lastHoverState = false;
      onMonitorLeave();
    }
  }

  function handleClick(event) {
    if (screenState.isAnimating) return;
    toNDC(event);

    if (hitPaper()) {
      downloadPDF();
      return;
    }

    if (!screenState.isZoomedIn) {
      zoomIn();
      return;
    }
    if (!hitMonitor()) zoomOut();
  }

  cssRenderer.domElement.addEventListener('mousemove', handleMouseMove);
  cssRenderer.domElement.addEventListener('click', handleClick);

  return () => {
    cssRenderer.domElement.removeEventListener('mousemove', handleMouseMove);
    cssRenderer.domElement.removeEventListener('click', handleClick);
  };
}

function handleKeydown(e) {
  if (e.key === 'Escape') zoomOut();
}

function buildAnimateLoop() {
  function animate() {
    animFrameId = requestAnimationFrame(animate);

    if (screenState.isAnimating) {
      animState.progress += 0.016 / animState.duration;
      const t = easeInOutCubic(Math.min(animState.progress, 1));
      camera.position.lerpVectors(
        animState.startCamPos,
        animState.endCamPos,
        t
      );
      controls.target.lerpVectors(
        animState.startTarget,
        animState.endTarget,
        t
      );
      if (animState.progress >= 1) screenState.isAnimating = false;
    }

    screenObject.position.set(SCREEN_POS.x, SCREEN_POS.y, SCREEN_POS.z);
    screenObject.scale.setScalar(SCREEN_POS.scale);
    screenObject.rotation.x = SCREEN_POS.rotationX;

    stencilMesh.position.copy(screenObject.position);
    stencilMesh.rotation.copy(screenObject.rotation);
    stencilMesh.scale.copy(screenObject.scale);

    maskMesh.position.copy(screenObject.position);
    maskMesh.position.z += 0.5;
    maskMesh.rotation.copy(screenObject.rotation);
    maskMesh.scale.copy(screenObject.scale);

    controls.update();
    renderer.clear();
    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
  }
  animate();
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
}

let cleanupMouseHandlers = null;

onMounted(async () => {
  const THREE = await import('three');
  const { GLTFLoader } =
    await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { OrbitControls } =
    await import('three/examples/jsm/controls/OrbitControls.js');
  const { CSS3DRenderer, CSS3DObject } =
    await import('three/examples/jsm/renderers/CSS3DRenderer.js');

  CAMERA_FAR.position = new THREE.Vector3(0, 130, 400);
  CAMERA_FAR.target = new THREE.Vector3(-3.8, 100, 0);
  CAMERA_CLOSE.position = new THREE.Vector3(-3.9, 99.0, 200.0);
  CAMERA_CLOSE.target = new THREE.Vector3(-3.9, 95.0, 28.0);
  CAMERA_HOVER.position = new THREE.Vector3(-3.9, 104.0, 66.0);
  CAMERA_HOVER.target = new THREE.Vector3(-3.9, 95.5, 28.0);

  animState.startCamPos = new THREE.Vector3();
  animState.startTarget = new THREE.Vector3();
  animState.endCamPos = new THREE.Vector3();
  animState.endTarget = new THREE.Vector3();

  cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  Object.assign(cssRenderer.domElement.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    zIndex: '1',
  });
  sceneContainer.value.appendChild(cssRenderer.domElement);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    stencil: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = false;
  Object.assign(renderer.domElement.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    zIndex: '5',
    pointerEvents: 'none',
  });
  sceneContainer.value.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const monitorLight = new THREE.PointLight(0x88ccff, 3000, 500);
  monitorLight.position.set(-3.8, 105, 60);
  monitorLight.castShadow = true;
  monitorLight.shadow.bias = -0.001;
  scene.add(monitorLight);

  screenObject = new CSS3DObject(iframeContainer.value);
  scene.add(screenObject);

  const stencilMat = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    stencilWrite: true,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilRef: 1,
    stencilZPass: THREE.ReplaceStencilOp,
    side: THREE.DoubleSide,
  });
  stencilMesh = new THREE.Mesh(new THREE.PlaneGeometry(1024, 768), stencilMat);
  stencilMesh.renderOrder = 0;
  scene.add(stencilMesh);

  const maskMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    opacity: 0,
    transparent: true,
    blending: THREE.NoBlending,
    stencilWrite: false,
    stencilFunc: THREE.EqualStencilFunc,
    stencilRef: 1,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  maskMesh = new THREE.Mesh(new THREE.PlaneGeometry(1024, 768), maskMat);
  maskMesh.renderOrder = 1;
  scene.add(maskMesh);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
  );
  controls = new OrbitControls(camera, cssRenderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minAzimuthAngle = -Math.PI / 6;
  controls.maxAzimuthAngle = Math.PI / 6;
  controls.minPolarAngle = Math.PI / 4;
  controls.maxPolarAngle = Math.PI / 2.2;

  const loader = new GLTFLoader();
  loader.load('/scene.gltf', (gltf) => {
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      const n = node.name.toLowerCase();
      if (n.includes('monitor') || n.includes('computer_monitor'))
        monitorMeshes.push(node);
      if (
        n.includes('screen') ||
        n.includes('glass') ||
        n.includes('display') ||
        n.includes('monitor_screen')
      )
        node.visible = false;
      if (PAPER_MESHES.has(node.name)) paperMeshes.push(node);
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) node.material.roughness = 0.8;
    });

    scene.add(gltf.scene);

    const centerAzimuth = controls.getAzimuthalAngle();
    controls.minAzimuthAngle = centerAzimuth - Math.PI / 6;
    controls.maxAzimuthAngle = centerAzimuth + Math.PI / 6;

    camera.position.copy(CAMERA_FAR.position);
    controls.target.copy(CAMERA_FAR.target);
    controls.update();
  });

  cleanupMouseHandlers = buildMouseHandlers(THREE);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleResize);

  buildAnimateLoop();
});

onUnmounted(() => {
  cancelAnimationFrame(animFrameId);
  renderer?.dispose();
  cleanupMouseHandlers?.();
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div
    ref="sceneContainer"
    class="scene-container"
    :style="{ cursor: cursorStyle }"
  >
    <div
      ref="iframeContainer"
      class="iframe-container"
      :style="{ pointerEvents: iframePointerEvents }"
    >
      <iframe
        src="https://win-xp-7ht.pages.dev/"
        class="iframe-screen"
        title="Monitor Screen"
      />
    </div>
  </div>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.scene-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #121110;
}

.iframe-container {
  width: 1043px;
  height: 791px;
}

.iframe-screen {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
