<script setup lang="ts">
import type { AppName } from '~/stores/windows';
import StartMenuItem from './StartMenuItem.vue';

defineProps<{
  items: {
    id: string;
    label: string;
    icon: string;
    app: AppName;
  }[];
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'open'): void;
  (e: 'close'): void;
  (e: 'select', data: { app: AppName; icon: string }): void;
}>();
</script>

<template>
  <div
    class="start-menu__all-programs"
    :class="{ 'start-menu__item--active': open }"
    @mouseenter="emit('open')"
    @mouseleave="emit('close')"
  >
    <button
      class="start-menu__all-programs--trigger"
      :aria-expanded="open"
      aria-haspopup="true"
    >
      <span>Todos os programas</span>
      <img src="/images/xp/icons/program-arrow.png" alt="" aria-hidden="true" />
    </button>

    <div v-if="open" class="start-menu__all-programs--submenu" role="menu">
      <StartMenuItem
        v-for="item in items"
        :key="item.id"
        v-bind="item"
        @click="emit('select', { app: item.app, icon: item.icon })"
      />
    </div>
  </div>
</template>
