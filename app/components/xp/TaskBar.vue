<script setup lang="ts">
const winStore = useWindowsStore();
const startMenuOpen = ref(false);
const currentTime = ref('');

let clockInterval: ReturnType<typeof setInterval> | null = null;

function updateTime() {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(() => {
  updateTime();
  clockInterval = setInterval(updateTime, 1000);
});

onUnmounted(() => {
  if (clockInterval !== null) {
    clearInterval(clockInterval);
  }
});
</script>

<template>
  <div class="taskbar" @click.stop>
    <button
      class="taskbar__start"
      aria-label="Menu Iniciar"
      :aria-expanded="startMenuOpen"
      @click="startMenuOpen = !startMenuOpen"
    />

    <button
      class="taskbar__show-desktop"
      aria-label="Mostrar desktop"
      title="Mostrar desktop"
      @click="winStore.toggleShowDesktop"
    >
      <img src="/images/xp/icons/desktop.png" alt="" aria-hidden="true" />
    </button>

    <div class="taskbar__windows" role="toolbar" aria-label="Janelas abertas">
      <button
        v-for="win in winStore.taskbarWindows"
        :key="win.id"
        :class="[
          'taskbar__windows--btn',
          {
            'taskbar__windows--btn-active': true,
          },
        ]"
        :aria-label="`${win.title}, clique para minimizar`"
        @click="winStore.minimize(win.id)"
      >
        <span class="taskbar__windows--btn-title">{{ win.title }}</span>
        <div
          v-if="win.progress !== undefined"
          class="taskbar__windows--btn-progress"
        >
          <div
            class="taskbar__windows--btn-progress-bar"
            :style="{ width: `${win.progress}%` }"
          />
        </div>
      </button>
    </div>

    <div class="taskbar__tray" aria-label="Área de notificação">
      <img
        src="/images/xp/icons/sound-small.png"
        class="taskbar__tray--icon"
        alt=""
        aria-hidden="true"
      />
      <time
        class="taskbar__tray--time"
        :datetime="currentTime"
        :aria-label="`Hora atual: ${currentTime}`"
      >
        {{ currentTime }}
      </time>
    </div>
  </div>

  <Teleport to="body">
    <Transition name="start-menu">
      <XpStartMenu v-if="startMenuOpen" v-model="startMenuOpen" />
    </Transition>
    <div
      v-if="startMenuOpen"
      class="start-overlay"
      aria-hidden="true"
      @click="startMenuOpen = false"
    />
  </Teleport>
</template>

<style lang="scss" scoped>
@import '~/assets/css/components/xp/TaskBar.scss';
</style>
