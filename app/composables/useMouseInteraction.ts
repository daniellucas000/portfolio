import type { Camera, Object3D } from 'three';
import type { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { PDF_URL } from '~/constants/scene';
import type { CameraTarget, ScreenState } from './useSceneAnimation';

interface UseMouseInteractionOptions {
  camera: Ref<Camera | null>;
  cssRenderer: Ref<CSS3DRenderer | null>;
  monitorMeshes: Ref<Object3D[]>;
  paperMeshes: Ref<Object3D[]>;
  screenState: ScreenState;
  cursorStyle: Ref<string>;
  iframePointerEvents: Ref<string>;
  cameraFar: Ref<CameraTarget | null>;
  cameraClose: Ref<CameraTarget | null>;
  startZoom: (target: CameraTarget, duration?: number) => void;
  onAnimationEnd: (cb: () => void) => void;
  controls: Ref<{ enabled: boolean } | null>;
}

export function useMouseInteraction(options: UseMouseInteractionOptions) {
  const {
    camera,
    cssRenderer,
    monitorMeshes,
    paperMeshes,
    screenState,
    cursorStyle,
    iframePointerEvents,
    cameraFar,
    cameraClose,
    startZoom,
    onAnimationEnd,
    controls,
  } = options;

  function setCssRendererPointerEvents(value: 'auto' | 'none') {
    if (cssRenderer.value) {
      cssRenderer.value.domElement.style.pointerEvents = value;
    }
  }

  onAnimationEnd(() => {
    if (screenState.isZoomedIn) {
      iframePointerEvents.value = 'auto';
      setCssRendererPointerEvents('none');
    } else {
      if (controls.value) controls.value.enabled = true;
      setCssRendererPointerEvents('auto');
    }
  });

  function zoomIn() {
    if (screenState.isZoomedIn || !cameraClose.value) return;
    screenState.isZoomedIn = true;
    screenState.isAnimating = false;
    if (controls.value) controls.value.enabled = false;
    startZoom(cameraClose.value, 0.8);
  }

  function zoomOut() {
    if (!screenState.isZoomedIn || screenState.isAnimating || !cameraFar.value)
      return;
    screenState.isZoomedIn = false;
    iframePointerEvents.value = 'none';
    setCssRendererPointerEvents('auto');
    startZoom(cameraFar.value, 0.8);
  }

  function downloadPDF() {
    window.open(PDF_URL, '_blank');
  }

  function buildHandlers(THREE: typeof import('three')) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function toNDC(event: MouseEvent) {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function hitMonitor(): boolean {
      if (!camera.value) return false;
      raycaster.setFromCamera(mouse, camera.value as any);
      return raycaster.intersectObjects(monitorMeshes.value, false).length > 0;
    }

    function hitPaper(): boolean {
      if (!camera.value) return false;
      raycaster.setFromCamera(mouse, camera.value as any);
      return raycaster.intersectObjects(paperMeshes.value, false).length > 0;
    }

    function handleMouseMove(event: MouseEvent) {
      if (screenState.isZoomedIn || screenState.isAnimating) return;
      toNDC(event);
      cursorStyle.value = hitPaper() || hitMonitor() ? 'pointer' : 'default';
    }

    function handleClick(event: MouseEvent) {
      if (screenState.isZoomedIn || screenState.isAnimating) return;
      toNDC(event);
      if (hitPaper()) {
        downloadPDF();
        return;
      }
      if (hitMonitor()) zoomIn();
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!screenState.isZoomedIn || screenState.isAnimating) return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'IFRAME' || target.closest?.('iframe')) return;
      toNDC(event);
      if (!hitMonitor()) zoomOut();
    }

    const el = cssRenderer.value!.domElement;
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('click', handleClick);
    document.addEventListener('click', handleDocumentClick);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('click', handleClick);
      document.removeEventListener('click', handleDocumentClick);
    };
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') zoomOut();
  }

  return { buildHandlers, handleKeydown, zoomOut };
}
