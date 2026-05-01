<script setup lang="ts">
import ContextMenuSubmenu from './ContextMenuSubmenu.vue';
import { useContextMenuSections } from '~/composables/useContextMenuSections';
import type {
  DesktopIconInfo as DesktopIcon,
  MenuItem,
} from '~/data/contextMenu';

interface Props {
  x: number;
  y: number;
  selectedIcon?: DesktopIcon | null;
  onCreateFolder?: () => void;
  onCreateTextDocument?: () => void;
  onSortByName?: () => void;
  onSortBySize?: () => void;
  onSortByType?: () => void;
  onSortByModified?: () => void;
  currentSort?: string | null;
  onDelete?: (id: number) => void;
  onRestore?: (id: number) => void;
  onEmptyTrash?: () => void;
  onRename?: (id: number) => void;
}

const props = defineProps<Props>();
const open = defineModel<boolean>('modelValue');

const menuRef = ref<HTMLElement | null>(null);
const focusedIndex = ref(0);

const sections = useContextMenuSections(
  computed(() => props.selectedIcon),
  {
    onCreateFolder: props.onCreateFolder,
    onCreateTextDocument: props.onCreateTextDocument,
    onSortByName: props.onSortByName,
    onSortBySize: props.onSortBySize,
    onSortByType: props.onSortByType,
    onSortByModified: props.onSortByModified,
    onDelete: props.onDelete,
    onRestore: props.onRestore,
    onEmptyTrash: props.onEmptyTrash,
    onRename: props.onRename,
  },
  computed(() => props.currentSort)
);

const flatItems = computed(() => sections.value.flat());

const sortLabelMap: Record<string, string> = {
  name: 'Nome',
  size: 'Tamanho',
  type: 'Tipo',
  modified: 'Modificado',
};

const selectedSortLabel = computed(() =>
  props.currentSort ? sortLabelMap[props.currentSort] : null
);

function close() {
  open.value = false;
}

function selectItem(item: MenuItem) {
  if (item.disabled || !item.action) return;
  item.action();
  close();
}

function handleClickOutside(e: MouseEvent) {
  if (!menuRef.value?.contains(e.target as Node)) close();
}

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<template>
  <div
    ref="menuRef"
    class="context-menu"
    role="menu"
    aria-label="Menu de contexto"
    :style="{ top: `${y}px`, left: `${x}px` }"
    tabindex="-1"
    @click.stop
  >
    <template v-for="(section, sectionIndex) in sections" :key="sectionIndex">
      <div
        v-if="sectionIndex > 0"
        class="context-menu__divider"
        role="separator"
      />

      <button
        v-for="item in section"
        :key="item.label"
        class="context-menu__item"
        role="menuitem"
        :class="{
          'context-menu__item--disabled': item.disabled,
          'context-menu__item--focused':
            flatItems.indexOf(item) === focusedIndex,
        }"
        :disabled="item.disabled"
        :aria-disabled="item.disabled"
        :tabindex="flatItems.indexOf(item) === focusedIndex ? 0 : -1"
        @click="selectItem(item)"
        @focus="focusedIndex = flatItems.indexOf(item)"
      >
        <span class="context-menu__item--label">{{ item.label }}</span>
        <span
          v-if="item.hasSubmenu"
          class="context-menu__item--arrow"
          aria-hidden="true"
          >▶</span
        >

        <ContextMenuSubmenu
          v-if="item.submenu"
          :items="item.submenu"
          :selected-label="
            item.label === 'Organizar ícones por' ? selectedSortLabel : null
          "
          @select="
            (sub) => {
              sub.action?.();
              close();
            }
          "
        />
      </button>
    </template>
  </div>
</template>

<style lang="scss" scoped>
@import '~/assets/css/components/xp/ContextMenu.scss';
</style>
