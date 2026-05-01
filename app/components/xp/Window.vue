<script setup lang="ts">
import { useDrag } from '~/composables/useDrag';
import { useResize, type ResizeDirection } from '~/composables/useResize';

const props = defineProps<{ windowId: string }>();

const windowsStore = useWindowsStore();

provide('windowId', props.windowId);

const win = computed(() =>
  windowsStore.windows.find((w) => w.id === props.windowId)
);

const { start: startDrag } = useDrag((x, y) =>
  windowsStore.updatePosition(props.windowId, x, y)
);

const { start: startResize } = useResize((x, y, w, h) =>
  windowsStore.updatePositionAndSize(props.windowId, x, y, w, h)
);

const maximizeIcon = computed(() =>
  win.value?.maximized
    ? '/images/xp/icons/maximized.png'
    : '/images/xp/icons/maximize.png'
);

const resizeDirections: ResizeDirection[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
];

function onTitlebarMousedown(e: MouseEvent) {
  if (!win.value || win.value.maximized) return;
  e.stopPropagation();
  windowsStore.focusWindow(props.windowId);
  startDrag(e, win.value.x, win.value.y);
}

function onResizeMousedown(e: MouseEvent, dir: ResizeDirection) {
  if (!win.value) return;
  e.stopPropagation();
  windowsStore.focusWindow(props.windowId);
  startResize(
    e,
    dir,
    win.value.x,
    win.value.y,
    win.value.width,
    win.value.height
  );
}

function onClose() {
  windowsStore.close(props.windowId);
}
</script>

<template>
  <Transition name="window">
    <div
      v-if="win && !win.minimized"
      :class="[
        'window',
        {
          'window--maximized': win.maximized,
          'window--focused': win.focused,
        },
      ]"
      role="dialog"
      :aria-label="win.title"
      :style="{
        left: win.maximized ? '0' : `${win.x}px`,
        top: win.maximized ? '0' : `${win.y}px`,
        width: win.maximized ? '100vw' : `${win.width}px`,
        height: win.maximized ? 'calc(100vh - 30px)' : `${win.height}px`,
        zIndex: win.zIndex,
      }"
      @mousedown="windowsStore.focusWindow(win.id)"
    >
      <div
        class="window__titlebar"
        :class="
          win.focused
            ? 'window__titlebar--active'
            : 'window__titlebar--inactive'
        "
        @mousedown="onTitlebarMousedown"
        @dblclick="windowsStore.maximize(props.windowId)"
      >
        <h4 class="window__titlebar--title">
          <img :src="win.icon" alt="" aria-hidden="true" />
          {{ win.title }}
        </h4>

        <div class="window__titlebar--controls">
          <button
            class="window__titlebar--controls-btn"
            aria-label="Minimizar"
            @click.stop="windowsStore.minimize(props.windowId)"
          >
            <img
              src="/images/xp/icons/minimize.png"
              alt=""
              aria-hidden="true"
            />
          </button>
          <button
            class="window__titlebar--controls-btn"
            :aria-label="win.maximized ? 'Restaurar' : 'Maximizar'"
            @click.stop="windowsStore.maximize(props.windowId)"
          >
            <img :src="maximizeIcon" alt="" aria-hidden="true" />
          </button>
          <button
            class="window__titlebar--controls-btn close"
            aria-label="Fechar"
            @click.stop="onClose"
          >
            <img src="/images/xp/icons/close.png" alt="" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="window__body">
        <slot />
      </div>

      <div v-if="win.progress !== undefined" class="window__progress">
        <div
          class="window__progress--progress-bar"
          :style="{ width: `${win.progress}%` }"
        />
      </div>

      <template v-if="!win.maximized">
        <div
          v-for="dir in resizeDirections"
          :key="dir"
          :class="`window__resize window__resize--${dir}`"
          @mousedown="onResizeMousedown($event, dir)"
        />
      </template>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
@import '~/assets/css/components/xp/Window.scss';
</style>
