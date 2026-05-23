import type {
  PerspectiveCamera,
  PointLight,
  Scene,
  WebGLRenderer,
} from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  CSS3DObject,
  CSS3DRenderer,
} from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import {
  PAPER_MESHES,
  SCREEN_POS,
  CAM_FAR,
  CAM_CLOSE,
} from '~/constants/scene';
import { useThreeSceneStore } from '~/stores/threeScene';

const LIGHT_DIM = 1200;
const LIGHT_BRIGHT = 3000;
const LIGHT_SPEED = 3;

export function useThreeScene(
  sceneContainer: Ref<HTMLElement | null>,
  iframeContainer: Ref<HTMLElement | null>
) {
  const store = useThreeSceneStore();

  const camera = ref<PerspectiveCamera | null>(null);
  const controls = ref<OrbitControls | null>(null);
  const cssRenderer = ref<CSS3DRenderer | null>(null);

  let renderer: WebGLRenderer;
  let scene: Scene;
  let screenObject: CSS3DObject;
  let stencilMesh: any;
  let maskMesh: any;
  let animFrameId: number | null = null;
  let monitorLight: PointLight | null = null;
  let lightCurrent = LIGHT_DIM;

  watch(
    () => store.lightBright,
    () => {
      store.needsRender = true;
    }
  );

  async function init(
    onReady: () => void,
    tickAnimation: (delta: number) => void
  ) {
    const [
      THREE,
      { GLTFLoader },
      { OrbitControls: OC },
      { CSS3DRenderer: CSS3DR, CSS3DObject: CSS3DO },
    ] = await Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/renderers/CSS3DRenderer.js'),
    ]);

    store.setCameraTargets(
      {
        position: new THREE.Vector3(...CAM_FAR.position),
        target: new THREE.Vector3(...CAM_FAR.target),
      },
      {
        position: new THREE.Vector3(...CAM_CLOSE.position),
        target: new THREE.Vector3(...CAM_CLOSE.target),
      }
    );

    const css3dRenderer = new CSS3DR();
    css3dRenderer.setSize(window.innerWidth, window.innerHeight);
    Object.assign(css3dRenderer.domElement.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      zIndex: '1',
    });
    sceneContainer.value!.appendChild(css3dRenderer.domElement);
    cssRenderer.value = css3dRenderer;

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      stencil: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    sceneContainer.value!.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    monitorLight = new THREE.PointLight(0x88ccff, LIGHT_DIM, 500);
    monitorLight.position.set(-3.8, 105, 60);
    monitorLight.castShadow = true;
    monitorLight.shadow.bias = -0.001;
    scene.add(monitorLight);
    lightCurrent = LIGHT_DIM;

    screenObject = new CSS3DO(iframeContainer.value!);
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
    stencilMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1024, 768),
      stencilMat
    );
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

    const cam = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      5000
    );
    camera.value = cam;

    const orbitControls = new OC(cam, css3dRenderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.minAzimuthAngle = -Math.PI / 6;
    orbitControls.maxAzimuthAngle = Math.PI / 6;
    orbitControls.minPolarAngle = Math.PI / 4;
    orbitControls.maxPolarAngle = Math.PI / 2.2;
    orbitControls.addEventListener('change', () => {
      store.needsRender = true;
    });
    controls.value = orbitControls;

    const clock = new THREE.Clock();

    const loader = new GLTFLoader();
    loader.load('/scene.gltf', (gltf: any) => {
      gltf.scene.traverse((node: any) => {
        if (!node.isMesh) return;
        const n = node.name.toLowerCase();
        if (n.includes('monitor') || n.includes('computer_monitor'))
          store.addMonitorMesh(node);
        if (
          n.includes('screen') ||
          n.includes('glass') ||
          n.includes('display') ||
          n.includes('monitor_screen')
        )
          node.visible = false;
        if (PAPER_MESHES.has(node.name)) store.addPaperMesh(node);
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) node.material.roughness = 0.8;
      });

      scene.add(gltf.scene);

      const centerAzimuth = orbitControls.getAzimuthalAngle();
      orbitControls.minAzimuthAngle = centerAzimuth - Math.PI / 6;
      orbitControls.maxAzimuthAngle = centerAzimuth + Math.PI / 6;

      cam.position.copy(store.cameraFar!.position);
      orbitControls.target.copy(store.cameraFar!.target);
      orbitControls.update();

      store.setSceneReady(true);
      store.needsRender = true;
      onReady();
    });

    function animate() {
      animFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      tickAnimation(delta);

      if (monitorLight) {
        const target = store.lightBright ? LIGHT_BRIGHT : LIGHT_DIM;
        if (Math.abs(lightCurrent - target) > 0.5) {
          lightCurrent +=
            (target - lightCurrent) * Math.min(LIGHT_SPEED * delta, 1);
          monitorLight.intensity = lightCurrent;
          store.needsRender = true;
        }
      }

      const controlsMoved = orbitControls.update();
      if (controlsMoved) store.needsRender = true;
      if (!store.needsRender) return;

      store.needsRender = false;

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

      renderer.clear();
      renderer.render(scene, cam);
      css3dRenderer.render(scene, cam);
    }

    animate();
  }

  function handleResize() {
    if (!camera.value) return;
    camera.value.aspect = window.innerWidth / window.innerHeight;
    camera.value.updateProjectionMatrix();
    renderer?.setSize(window.innerWidth, window.innerHeight);
    cssRenderer.value?.setSize(window.innerWidth, window.innerHeight);
    store.needsRender = true;
  }

  function dispose() {
    if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    renderer?.dispose();
    store.$reset();
  }

  return {
    camera,
    controls,
    cssRenderer,
    init,
    handleResize,
    dispose,
  };
}
