import { defineStore } from 'pinia';
import type { Object3D } from 'three';
import type { CameraTarget } from './sceneAnimation';

export const useThreeSceneStore = defineStore('threeScene', () => {
  const sceneReady = ref(false);
  const needsRender = ref(true);

  const cameraFar = ref<CameraTarget | null>(null);
  const cameraClose = ref<CameraTarget | null>(null);

  const monitorMeshes = ref<Object3D[]>([]);
  const paperMeshes = ref<Object3D[]>([]);

  const lightBright = ref(false);

  function setSceneReady(value: boolean) {
    sceneReady.value = value;
  }

  function setNeedsRender(value: boolean) {
    needsRender.value = value;
  }

  function setCameraTargets(far: CameraTarget, close: CameraTarget) {
    cameraFar.value = far;
    cameraClose.value = close;
  }

  function addMonitorMesh(mesh: Object3D) {
    monitorMeshes.value.push(mesh);
  }

  function addPaperMesh(mesh: Object3D) {
    paperMeshes.value.push(mesh);
  }

  function setMonitorLightTarget(bright: boolean) {
    lightBright.value = bright;
    needsRender.value = true;
  }

  function $reset() {
    sceneReady.value = false;
    needsRender.value = true;
    cameraFar.value = null;
    cameraClose.value = null;
    monitorMeshes.value = [];
    paperMeshes.value = [];
    lightBright.value = false;
  }

  return {
    sceneReady,
    needsRender,
    cameraFar,
    cameraClose,
    monitorMeshes,
    paperMeshes,
    lightBright,
    setSceneReady,
    setNeedsRender,
    setCameraTargets,
    addMonitorMesh,
    addPaperMesh,
    setMonitorLightTarget,
    $reset,
  };
});
