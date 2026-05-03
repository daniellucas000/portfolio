<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const sceneContainer = ref(null);
const clickHintRef = ref(null);

let renderer, cssRenderer, scene, camera, controls;
let screenObject,
  maskMesh,
  monitorMeshes = [];
let isZoomedIn = false,
  isHovered = false,
  isAnimating = false;
let lastHoverState = false;
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
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.zIndex = '5';
  renderer.domElement.style.pointerEvents = 'none';
  sceneContainer.value.appendChild(renderer.domElement);

  cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.domElement.style.position = 'absolute';
  cssRenderer.domElement.style.top = '0';
  cssRenderer.domElement.style.zIndex = '1';
  cssRenderer.domElement.style.backgroundColor = '#121110';
  sceneContainer.value.appendChild(cssRenderer.domElement);

  scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const monitorLight = new THREE.PointLight(0x88ccff, 3000, 500);
  monitorLight.position.set(-3.8, 105, 60);
  monitorLight.castShadow = true;
  monitorLight.shadow.bias = -0.001;
  scene.add(monitorLight);

  const container = document.createElement('div');
  container.style.width = '1024px';
  container.style.height = '768px';
  container.style.pointerEvents = 'none';

  const iframe = document.createElement('iframe');
  iframe.src = 'https://os.henryheffernan.com/';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  container.appendChild(iframe);

  screenObject = new CSS3DObject(container);
  scene.add(screenObject);

  const maskMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    opacity: 0,
    transparent: true,
    blending: THREE.NoBlending,
    side: THREE.DoubleSide,
  });
  maskMesh = new THREE.Mesh(new THREE.PlaneGeometry(1024, 768), maskMat);
  maskMesh.renderOrder = 0;
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

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function startZoom(targetCam, durationSeconds = 1) {
    isAnimating = true;
    animState.progress = 0;
    animState.duration = durationSeconds;
    animState.startCamPos.copy(camera.position);
    animState.startTarget.copy(controls.target);
    animState.endCamPos.copy(targetCam.position);
    animState.endTarget.copy(targetCam.target);
  }

  function zoomIn() {
    if (isZoomedIn || isAnimating) return;
    isZoomedIn = true;
    controls.enabled = false;
    startZoom(CAMERA_CLOSE, 1);
    clickHintRef.value.style.opacity = '0';
    setTimeout(() => {
      container.style.pointerEvents = 'auto';
    }, 1000);
  }

  function zoomOut() {
    if (!isZoomedIn || isAnimating) return;
    isZoomedIn = false;
    isHovered = false;
    lastHoverState = false;
    container.style.pointerEvents = 'none';
    startZoom(CAMERA_FAR, 1);
    clickHintRef.value.style.opacity = '1';
    setTimeout(() => {
      controls.enabled = true;
    }, 1000);
  }

  function onMonitorEnter() {
    if (!isZoomedIn || isAnimating || isHovered) return;
    isHovered = true;
    startZoom(CAMERA_HOVER, 1.2);
  }

  function onMonitorLeave() {
    if (!isZoomedIn || isAnimating || !isHovered) return;
    isHovered = false;
    startZoom(CAMERA_CLOSE, 1.2);
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  cssRenderer.domElement.addEventListener('mousemove', (event) => {
    if (!isZoomedIn || isAnimating) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(monitorMeshes, false);
    const hitting = intersects.length > 0;
    if (hitting && !lastHoverState) {
      lastHoverState = true;
      onMonitorEnter();
    } else if (!hitting && lastHoverState) {
      lastHoverState = false;
      onMonitorLeave();
    }
  });

  cssRenderer.domElement.addEventListener('click', (event) => {
    if (isZoomedIn || isAnimating) return;
    zoomIn();
  });

  cssRenderer.domElement.addEventListener('click', (event) => {
    if (!isZoomedIn || isAnimating) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(monitorMeshes, false);
    if (intersects.length === 0) zoomOut();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') zoomOut();
  });

  const loader = new GLTFLoader();
  loader.load('/scene.gltf', (gltf) => {
    const model = gltf.scene;
    model.traverse((node) => {
      if (node.isMesh) {
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
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) node.material.roughness = 0.8;
      }
    });
    scene.add(model);
    camera.position.copy(CAMERA_FAR.position);
    controls.target.copy(CAMERA_FAR.target);
    controls.update();
  });

  const screenPos = {
    x: -3.85,
    y: 99.1,
    z: 39.2,
    scale: 0.0215,
    rotationX: -0.08,
  };

  function animate() {
    animFrameId = requestAnimationFrame(animate);

    if (isAnimating) {
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
      if (animState.progress >= 1) isAnimating = false;
    }

    screenObject.position.set(screenPos.x, screenPos.y, screenPos.z);
    screenObject.scale.setScalar(screenPos.scale);
    screenObject.rotation.x = screenPos.rotationX;

    maskMesh.position.copy(screenObject.position);
    maskMesh.position.z += 1.0;
    maskMesh.rotation.copy(screenObject.rotation);
    maskMesh.scale.copy(screenObject.scale);

    controls.update();
    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', onResize);
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
  }
});

onUnmounted(() => {
  cancelAnimationFrame(animFrameId);
  renderer?.dispose();
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div ref="sceneContainer" class="scene-container">
    <div ref="clickHintRef" id="click-hint">Clique para interagir</div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.scene-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

#click-hint {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 13px;
  pointer-events: none;
  backdrop-filter: blur(8px);
  transition: opacity 0.4s ease;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.7;
    transform: translateX(-50%) translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateX(-50%) translateY(-4px);
  }
}
</style>
