<script setup lang="ts">
import { useEventListener, useNow } from '@vueuse/core';
import { useThreeScene } from '~/composables/useThreeScene';
import { useMouseInteraction } from '~/composables/useMouseInteraction';
import {
  useSceneAnimationStore,
  type CameraTarget,
} from '~/stores/sceneAnimation';
import { useThreeSceneStore } from '~/stores/threeScene';
import { IFRAME_SRC } from '~/constants/scene';
import BiosScreen from './BiosScreen.vue';

const sceneContainer = ref<HTMLElement | null>(null);
const iframeContainer = ref<HTMLElement | null>(null);
const iframePointerEvents = ref<'none' | 'auto'>('none');
const iframeSrc = ref<string | undefined>(undefined);
const cursorStyle = ref('default');
const showBios = ref(true);
const monitorClicked = ref(false);

const threeStore = useThreeSceneStore();
const animStore = useSceneAnimationStore();

const now = useNow({ interval: 1000 });
const currentTime = computed(() =>
  now.value.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
);

const { camera, controls, cssRenderer, init, handleResize, dispose } =
  useThreeScene(sceneContainer, iframeContainer);

const startZoom = (target: CameraTarget, duration?: number) => {
  monitorClicked.value = true;
  animStore.startZoom(target, duration, threeStore);
};

const tickAnimation = (delta: number) =>
  animStore.tickAnimation(delta, threeStore);

const { buildHandlers, handleKeydown } = useMouseInteraction({
  camera,
  cssRenderer,
  monitorMeshes: computed(() => threeStore.monitorMeshes),
  paperMeshes: computed(() => threeStore.paperMeshes),
  screenState: animStore.screenState,
  cursorStyle,
  iframePointerEvents,
  cameraFar: computed(() => threeStore.cameraFar),
  cameraClose: computed(() => threeStore.cameraClose),
  startZoom,
  onAnimationEnd: animStore.onAnimationEnd,
  setMonitorLightTarget: threeStore.setMonitorLightTarget,
  controls,
});

useEventListener(window, 'resize', handleResize);
useEventListener(window, 'keydown', handleKeydown);

onMounted(async () => {
  animStore.setRefs(camera, controls);

  await init(() => {
    iframeSrc.value = IFRAME_SRC;
  }, tickAnimation);

  const THREE = await import('three');
  animStore.initAnimVectors(THREE);

  buildHandlers(THREE);
});

onUnmounted(() => {
  dispose();
});
</script>

<template>
  <div
    ref="sceneContainer"
    class="scene-container"
    :style="{ cursor: cursorStyle }"
  >
    <BiosScreen v-if="showBios" @done="showBios = false" />

    <Transition name="hint-fade">
      <p
        v-if="threeStore.sceneReady && !showBios && !monitorClicked"
        class="hint-text"
      >
        Clique no monitor para iniciar
      </p>
    </Transition>

    <Transition name="hint-fade">
      <div
        v-if="monitorClicked && !animStore.screenState.isZoomedIn"
        class="info-overlay"
      >
        <span>Portfolio Daniel</span>
        <span>Desenvolvedor Fullstack</span>
        <span>{{ currentTime }}</span>
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
* {
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.hint-text {
  position: absolute;
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
  font-size: 1rem;
  letter-spacing: 0.15em;
  color: #000;
  pointer-events: none;
  white-space: nowrap;
  background: #fff;
  padding: 5px;
}

.info-overlay {
  position: absolute;
  top: 32px;
  left: 36px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
  font-size: 1rem;
  letter-spacing: 0.12em;
  pointer-events: none;

  span {
    background: #fff;
    padding: 5px;
    color: #000;
    width: fit-content;
  }
}

.hint-fade-enter-active,
.hint-fade-leave-active {
  transition: opacity 0.8s ease;
}
.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
}
</style>
