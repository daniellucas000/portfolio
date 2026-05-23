import { defineStore } from 'pinia';
import type { Camera } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type * as ThreeTypes from 'three';
import type { Vector3 } from 'three';
import type { useThreeSceneStore } from './threeScene';

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

type ThreeSceneStore = ReturnType<typeof useThreeSceneStore>;

export const useSceneAnimationStore = defineStore('sceneAnimation', () => {
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

  const camera = ref<Camera | null>(null);
  const controls = ref<OrbitControls | null>(null);

  let _onAnimationEnd: (() => void) | null = null;

  function setRefs(cam: Ref<Camera | null>, ctrl: Ref<OrbitControls | null>) {
    camera.value = cam.value;
    controls.value = ctrl.value;

    watch(cam, (v) => (camera.value = v));
    watch(ctrl, (v) => (controls.value = v));
  }

  function onAnimationEnd(cb: () => void) {
    _onAnimationEnd = cb;
  }

  function initAnimVectors(THREE: typeof ThreeTypes) {
    animState.startCamPos = new THREE.Vector3();
    animState.startTarget = new THREE.Vector3();
    animState.endCamPos = new THREE.Vector3();
    animState.endTarget = new THREE.Vector3();
  }

  function startZoom(
    targetCam: CameraTarget,
    durationSeconds = 1,
    threeStore: ThreeSceneStore
  ) {
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
    threeStore.needsRender = true;
  }

  function tickAnimation(delta: number, threeStore: ThreeSceneStore): void {
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
    threeStore.needsRender = true;
  }

  return {
    screenState,
    animState,
    camera,
    controls,
    setRefs,
    onAnimationEnd,
    initAnimVectors,
    startZoom,
    tickAnimation,
  };
});
