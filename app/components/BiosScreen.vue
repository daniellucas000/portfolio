<script setup lang="ts">
const emit = defineEmits<{ done: [] }>();

const lines = [
  { text: 'Daniel Dev BIOS (C)2026' },
  { text: 'Released: 15/05/2026' },
  { text: '' },
  { text: 'HSP S13 2000-2025 Special UC131S' },
  { text: '' },
  { text: 'HSP Showcase(tm) XX 113' },
  { text: 'Checking RAM : 14000 OK' },
  { text: '' },
  { text: 'LOADING RESOURCES (19/19)' },
  { text: '' },
];

const resourceLines = [
  'Loaded threeJS           ... 12%',
  'Loaded GLTFLoader        ... 24%',
  'Loaded OrbitControls     ... 35%',
  'Loaded CSS3DRenderer     ... 47%',
  'Loaded sceneGeometry     ... 58%',
  'Loaded monitorMesh       ... 67%',
  'Loaded keyboardMesh      ... 74%',
  'Loaded deskTextures      ... 81%',
  'Loaded iframeScreen      ... 89%',
  'Loaded startup           ... 95%',
];

const biosLines = [
  ...lines.map((l) => l.text),
  ...resourceLines,
  '',
  'Press DEL to enter SETUP , ESC to skip memory test',
  new Date().toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }),
];

const visibleLines = ref<string[]>([]);
const showCursor = ref(true);
const done = ref(false);

let cursorInterval: ReturnType<typeof setInterval>;

async function typeLines() {
  for (const line of biosLines) {
    await new Promise((r) => setTimeout(r, 50));
    visibleLines.value.push(line);
  }
  await new Promise((r) => setTimeout(r, 600));
  done.value = true;
  await new Promise((r) => setTimeout(r, 300));
  emit('done');
}

onMounted(() => {
  cursorInterval = setInterval(() => {
    showCursor.value = !showCursor.value;
  }, 530);
  typeLines();
});

onUnmounted(() => clearInterval(cursorInterval));
</script>

<template>
  <div class="bios-wrap" :class="{ 'bios-out': done }">
    <div class="bios-screen">
      <p v-for="(line, i) in visibleLines" :key="i" class="bios-line">
        <span v-if="line === ''">&nbsp;</span>
        <span v-else>{{ line }}</span>
      </p>
      <span v-if="!done" class="bios-cursor" :class="{ hidden: !showCursor }"
        >_</span
      >
    </div>
  </div>
</template>

<style scoped>
.bios-wrap {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: #000;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 28px 36px;
  transition: opacity 0.5s ease;
}

.bios-out {
  opacity: 0;
  pointer-events: none;
}

.bios-screen {
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  line-height: 1.55;
  color: #ccc;
  white-space: pre;
}

.bios-line {
  margin: 0;
}

.bios-cursor {
  display: inline-block;
  color: #ccc;
  margin-left: 1px;
}

.bios-cursor.hidden {
  opacity: 0;
}
</style>
