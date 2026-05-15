<script setup lang="ts">
import { useThreeScene } from '~/composables/useThreeScene';
import { useSceneAnimation } from '~/composables/useSceneAnimation';
import { useMouseInteraction } from '~/composables/useMouseInteraction';
import { IFRAME_SRC } from '~/constants/scene';

const sceneContainer = ref<HTMLElement | null>(null);
const iframeContainer = ref<HTMLElement | null>(null);

const iframePointerEvents = ref<'none' | 'auto'>('none');
const iframeSrc = ref<string | undefined>(undefined);
const cursorStyle = ref('default');

const {
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
} = useThreeScene(sceneContainer, iframeContainer);

const {
  screenState,
  initAnimVectors,
  startZoom,
  tickAnimation,
  onAnimationEnd,
} = useSceneAnimation(camera, controls, needsRender);

const { buildHandlers, handleKeydown } = useMouseInteraction({
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
  setMonitorLightTarget,
  controls,
});

let cleanupMouseHandlers: (() => void) | null = null;

onMounted(async () => {
  await init(() => {
    iframeSrc.value = IFRAME_SRC;
  }, tickAnimation);

  const THREE = await import('three');
  initAnimVectors(THREE);

  cleanupMouseHandlers = buildHandlers(THREE);

  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  dispose();
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
    <Transition name="splash-fade">
      <div v-if="!sceneReady" class="splash" aria-label="Carregando cena 3D">
        <div class="splash-ring" />
        <span class="splash-label">carregando cena...</span>
      </div>
    </Transition>

    <div
      ref="iframeContainer"
      class="iframe-container"
      :style="{ pointerEvents: iframePointerEvents }"
    >
      <iframe
        v-if="iframeSrc"
        :src="iframeSrc"
        class="iframe-screen"
        title="Monitor Screen"
        loading="lazy"
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

.splash {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background-color: #121110;
}

.splash-ring {
  width: 36px;
  height: 36px;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-top-color: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

.splash-label {
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.3);
  text-transform: lowercase;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.splash-fade-leave-active {
  transition:
    opacity 0.7s ease,
    transform 0.7s ease;
}

.splash-fade-leave-to {
  opacity: 0;
  transform: scale(1.03);
}
</style>
