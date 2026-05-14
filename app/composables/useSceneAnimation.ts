import type { Camera, Vector3 } from 'three';
import type * as ThreeTypes from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface CameraTarget {
  position: Vector3;
  target: Vector3;
}

export interface ScreenState {
  isZoomedIn: boolean;
  isHovered: boolean;
  isAnimating: boolean;
  lastHoverState: boolean;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function useSceneAnimation(
  camera: Ref<Camera | null>,
  controls: Ref<OrbitControls | null>,
  needsRender: Ref<boolean>
) {
  const screenState = reactive<ScreenState>({
    isZoomedIn: false,
    isHovered: false,
    isAnimating: false,
    lastHoverState: false,
  });

  const animState = reactive({
    progress: 0,
    duration: 1,
    startCamPos: null as Vector3 | null,
    startTarget: null as Vector3 | null,
    endCamPos: null as Vector3 | null,
    endTarget: null as Vector3 | null,
  });

  let _onAnimationEnd: (() => void) | null = null;

  function onAnimationEnd(cb: () => void) {
    _onAnimationEnd = cb;
  }

  function initAnimVectors(THREE: typeof ThreeTypes) {
    animState.startCamPos = new THREE.Vector3();
    animState.startTarget = new THREE.Vector3();
    animState.endCamPos = new THREE.Vector3();
    animState.endTarget = new THREE.Vector3();
  }

  function startZoom(targetCam: CameraTarget, durationSeconds = 1) {
    if (!camera.value || !controls.value) return;
    if (
      !animState.startCamPos ||
      !animState.startTarget ||
      !animState.endCamPos ||
      !animState.endTarget
    )
      return;
    screenState.isAnimating = true;
    animState.progress = 0;
    animState.duration = durationSeconds;
    animState.startCamPos.copy(camera.value.position);
    animState.startTarget.copy(controls.value.target);
    animState.endCamPos.copy(targetCam.position);
    animState.endTarget.copy(targetCam.target);
    needsRender.value = true;
  }

  function tickAnimation(delta: number): void {
    if (!screenState.isAnimating) return;
    if (!camera.value || !controls.value) return;
    if (
      !animState.startCamPos ||
      !animState.startTarget ||
      !animState.endCamPos ||
      !animState.endTarget
    )
      return;

    animState.progress += delta / animState.duration;
    const t = easeInOutCubic(Math.min(animState.progress, 1));

    camera.value.position.lerpVectors(
      animState.startCamPos,
      animState.endCamPos,
      t
    );
    controls.value.target.lerpVectors(
      animState.startTarget,
      animState.endTarget,
      t
    );

    if (animState.progress >= 1) {
      screenState.isAnimating = false;
      _onAnimationEnd?.();
    }
    needsRender.value = true;
  }

  return {
    screenState,
    animState,
    initAnimVectors,
    startZoom,
    tickAnimation,
    onAnimationEnd,
  };
}
