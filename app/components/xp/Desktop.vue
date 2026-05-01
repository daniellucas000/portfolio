<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';

import XpIeBrowser from '~/components/xp/apps/ie/IeBrowser.vue';
import XpMsnChatWindow from '~/components/xp/apps/msn/ChatWindow.vue';
import { useWindowlessApps } from '~/composables/useWindowlessApps';
import {
  useDesktopIcons,
  useDesktopSelection,
  useDesktopRename,
  useDesktopTrash,
  useDesktopShortcuts,
} from '~/composables/desktop';

const store = useWindowsStore();
const { isWindowlessAppOpen, openWindowlessApp } = useWindowlessApps();

const desktopRef = ref<HTMLElement | null>(null);

const renameInputs = new Map<number, HTMLInputElement>();

function getCurrentRenameInput() {
  if (!renamingItem.value) return null;
  return renameInputs.get(renamingItem.value) || null;
}

const iconClasses = computed(() => (item, index) => [
  'desktop__icons--icon',
  {
    'desktop__icons--icon-renaming': renamingItem.value === item?.id,
    'desktop__icons--icon-focused': focusedIconIndex.value === index,
    'desktop__icons--icon-selected': selectedIcons.value.has(item?.id),
  },
]);

const {
  desktopIcons,
  visibleIcons,
  contextMenu,
  loadFromStorage,
  saveToStorage,
  onRightClick,
  onIconRightClick,
  openItem,
  createFolder,
  createTextDocument,
  sortByName,
  sortByType,
  sortBySize,
  sortByModified,
  currentSort,
} = useDesktopIcons({ store, openWindowlessApp });

const { renamingItem, renameInput, startRename, saveRename, cancelRename } =
  useDesktopRename({
    desktopIcons,
    saveToStorage,
    getInputElement: getCurrentRenameInput,
    onCancel: () => {
      focusedIconIndex.value = null;
    },
  });

const {
  selectedIcons,
  focusedIconIndex,
  iconElements,
  selectionBox,
  toggleIconSelection,
  onDesktopMouseDown,
  onDesktopMouseMove,
  onDesktopMouseUp,
  handleDesktopKeydown,
} = useDesktopSelection({
  visibleIcons,
  renamingItem,
  contextMenu,
  openItem,
  startRename,
});

const { deleteIcon, restoreFromTrash, emptyTrash } = useDesktopTrash({
  desktopIcons,
  saveToStorage,
  selectedIcons,
});

useDesktopShortcuts({
  selectedIcons,
  focusedIconIndex,
  visibleIcons,
  deleteIcon,
});

onMounted(() => {
  loadFromStorage();
});

onBeforeUnmount(() => {
  renameInputs.clear();
});

function handleDesktopClick() {
  contextMenu.value.open = false;
}
</script>

<template>
  <div
    ref="desktopRef"
    class="desktop"
    role="application"
    aria-label="Área de trabalho"
    tabindex="-1"
    @contextmenu="onRightClick"
    @click="handleDesktopClick"
    @keydown="handleDesktopKeydown"
    @mousedown="onDesktopMouseDown($event, desktopRef)"
    @mousemove="onDesktopMouseMove($event)"
    @mouseup="onDesktopMouseUp"
  >
    <div class="desktop__wallpaper" />

    <div
      class="desktop__icons"
      role="toolbar"
      aria-label="Ícones da área de trabalho"
    >
      <button
        v-for="(item, index) in visibleIcons"
        :key="item?.id"
        :ref="
          (el) => {
            if (el) iconElements.set(item?.id, el as HTMLElement);
          }
        "
        :class="iconClasses(item, index)"
        :data-desktop-icon-id="item?.id"
        :aria-label="`${item?.label}, clique duas vezes para abrir`"
        :tabindex="
          focusedIconIndex === index ||
          (focusedIconIndex === null && index === 0)
            ? 0
            : -1
        "
        @dblclick="openItem(item)"
        @contextmenu="onIconRightClick($event, item)"
        @click="toggleIconSelection(item?.id, $event)"
        @focus="focusedIconIndex = index"
      >
        <span
          class="desktop__icons--icon-img-wrapper"
          :style="{ '--icon-mask': `url(${item?.icon})` }"
        >
          <img
            :src="item?.icon"
            class="desktop__icons--icon-img"
            :alt="item?.label"
          />
        </span>

        <template v-if="renamingItem === item?.id">
          <label :for="`desktop-rename-${item?.id}`" class="visually-hidden">
            Renomear {{ item?.label }}
          </label>

          <input
            :ref="
              (el) => {
                if (el) renameInputs.set(item.id, el as HTMLInputElement);
                else renameInputs.delete(item.id);
              }
            "
            :id="`desktop-rename-${item?.id}`"
            v-model="renameInput"
            class="desktop__icons--icon-input"
            :aria-label="`Renomear para ${item?.label}`"
            @blur="saveRename(item?.id)"
            @keyup.enter="saveRename(item.id)"
            @keyup.escape="cancelRename"
          />
        </template>

        <span v-else class="desktop__icons--icon-label">
          {{ item?.label }}
        </span>
      </button>
    </div>

    <div
      v-if="selectionBox && (selectionBox.width > 2 || selectionBox.height > 2)"
      class="selection-box"
      :style="{
        left: `${selectionBox.x}px`,
        top: `${selectionBox.y}px`,
        width: `${selectionBox.width}px`,
        height: `${selectionBox.height}px`,
      }"
    />

    <XpWindow
      v-for="win in store.openWindows"
      :key="win?.id"
      :window-id="win?.id"
    >
      <XpAppsNotepad v-if="win?.app === 'notepad'" :win="win" />
      <XpAppsPaint v-if="win?.app === 'paint'" :win="win" />
      <XpIeBrowser v-if="win?.app === 'ie'" :win="win" />
      <XpAppsExplorer v-if="win?.app === 'explorer'" :win="win" />
      <XpAppsMsn v-if="win?.app === 'msn'" :win="win" />
      <XpMsnChatWindow v-if="win?.app === 'msn-chat'" :win="win" />
    </XpWindow>

    <XpAppsMediaPlayer v-if="isWindowlessAppOpen('mediaplayer')" />

    <XpContextMenu
      v-if="contextMenu.open"
      v-model="contextMenu.open"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :selected-icon="contextMenu.selectedIcon"
      :on-create-folder="createFolder"
      :on-create-text-document="createTextDocument"
      :on-sort-by-name="sortByName"
      :on-sort-by-size="sortBySize"
      :on-sort-by-type="sortByType"
      :on-sort-by-modified="sortByModified"
      :current-sort="currentSort"
      :on-delete="deleteIcon"
      :on-restore="restoreFromTrash"
      :on-empty-trash="emptyTrash"
      :on-rename="startRename"
    />
  </div>
</template>

<style lang="scss" scoped>
@import '~/assets/css/components/xp/Desktop.scss';
</style>
