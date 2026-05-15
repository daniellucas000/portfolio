import type {
  Object3D,
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
import type { CameraTarget } from './useSceneAnimation';

const LIGHT_DIM = 1200; // intensidade padrão (afastado)
const LIGHT_BRIGHT = 3000; // intensidade ao passar mouse / zoom
const LIGHT_SPEED = 3; // velocidade do fade (por segundo)

export function useThreeScene(
  sceneContainer: Ref<HTMLElement | null>,
  iframeContainer: Ref<HTMLElement | null>
) {
  const sceneReady = ref(false);
  const needsRender = ref(true);

  const cameraFar = ref<CameraTarget | null>(null);
  const cameraClose = ref<CameraTarget | null>(null);

  const monitorMeshes = ref<Object3D[]>([]);
  const paperMeshes = ref<Object3D[]>([]);

  let renderer: WebGLRenderer;
  let cssRenderer: Ref<CSS3DRenderer | null> = ref(null);
  let scene: Scene;
  let camera: Ref<PerspectiveCamera | null> = ref(null);
  let controls: Ref<OrbitControls | null> = ref(null);
  let screenObject: CSS3DObject;
  let stencilMesh: any;
  let maskMesh: any;
  let animFrameId: number | null = null;

  // luz do monitor — acessível fora para fade
  let monitorLight: PointLight | null = null;
  let lightTarget = LIGHT_DIM; // intensidade desejada
  let lightCurrent = LIGHT_DIM; // intensidade atual (interpolada)

  function setMonitorLightTarget(bright: boolean) {
    lightTarget = bright ? LIGHT_BRIGHT : LIGHT_DIM;
    needsRender.value = true;
  }

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

    cameraFar.value = {
      position: new THREE.Vector3(...CAM_FAR.position),
      target: new THREE.Vector3(...CAM_FAR.target),
    };
    cameraClose.value = {
      position: new THREE.Vector3(...CAM_CLOSE.position),
      target: new THREE.Vector3(...CAM_CLOSE.target),
    };

    // CSS3D Renderer
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

    // WebGL Renderer
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

    // Scene
    scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    monitorLight = new THREE.PointLight(0x88ccff, LIGHT_DIM, 500);
    monitorLight.position.set(-3.8, 105, 60);
    monitorLight.castShadow = true;
    monitorLight.shadow.bias = -0.001;
    scene.add(monitorLight);
    lightCurrent = LIGHT_DIM;

    // CSS3D screen object
    screenObject = new CSS3DO(iframeContainer.value!);
    scene.add(screenObject);

    // Stencil mesh
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

    // Mask mesh
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

    // Camera & Controls
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
      needsRender.value = true;
    });
    controls.value = orbitControls;

    const clock = new THREE.Clock();

    const loader = new GLTFLoader();
    loader.load('/scene.gltf', (gltf: any) => {
      gltf.scene.traverse((node: any) => {
        if (!node.isMesh) return;
        const n = node.name.toLowerCase();
        if (n.includes('monitor') || n.includes('computer_monitor'))
          monitorMeshes.value.push(node);
        if (
          n.includes('screen') ||
          n.includes('glass') ||
          n.includes('display') ||
          n.includes('monitor_screen')
        )
          node.visible = false;
        if (PAPER_MESHES.has(node.name)) paperMeshes.value.push(node);
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) node.material.roughness = 0.8;
      });

      scene.add(gltf.scene);

      const centerAzimuth = orbitControls.getAzimuthalAngle();
      orbitControls.minAzimuthAngle = centerAzimuth - Math.PI / 6;
      orbitControls.maxAzimuthAngle = centerAzimuth + Math.PI / 6;

      cam.position.copy(cameraFar.value!.position);
      orbitControls.target.copy(cameraFar.value!.target);
      orbitControls.update();

      sceneReady.value = true;
      needsRender.value = true;
      onReady();
    });

    function animate() {
      animFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      tickAnimation(delta);

      // Fade suave da luz do monitor
      if (monitorLight && Math.abs(lightCurrent - lightTarget) > 0.5) {
        lightCurrent +=
          (lightTarget - lightCurrent) * Math.min(LIGHT_SPEED * delta, 1);
        monitorLight.intensity = lightCurrent;
        needsRender.value = true;
      }

      const controlsMoved = orbitControls.update();
      if (controlsMoved) needsRender.value = true;
      if (!needsRender.value) return;

      needsRender.value = false;

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
    (camera.value as PerspectiveCamera).aspect =
      window.innerWidth / window.innerHeight;
    camera.value.updateProjectionMatrix();
    renderer?.setSize(window.innerWidth, window.innerHeight);
    cssRenderer.value?.setSize(window.innerWidth, window.innerHeight);
    needsRender.value = true;
  }

  function dispose() {
    if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    renderer?.dispose();
  }

  return {
    sceneReady,
    needsRender,
    camera,
    controls,
    cssRenderer,
    cameraFar,
    cameraClose,
    monitorMeshes,
    paperMeshes,
    setMonitorLightTarget,
    init,
    handleResize,
    dispose,
  };
}
