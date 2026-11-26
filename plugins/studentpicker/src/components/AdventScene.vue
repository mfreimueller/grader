<template>
  <!-- A winter night: sky, moon, snowy hills, a small village with lit windows and fir trees. Drawn at 600 x 400. -->
  <svg class="scene" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="advent-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#070d27" />
        <stop offset="0.55" stop-color="#16265a" />
        <stop offset="1" stop-color="#3b5191" />
      </linearGradient>
      <radialGradient id="advent-moon-glow">
        <stop offset="0" stop-color="#fff6cf" stop-opacity="0.55" />
        <stop offset="1" stop-color="#fff6cf" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="advent-far" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8fa6d6" />
        <stop offset="1" stop-color="#5e75ad" />
      </linearGradient>
      <linearGradient id="advent-near" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f4f8ff" />
        <stop offset="1" stop-color="#b9c8ea" />
      </linearGradient>
      <radialGradient id="advent-window">
        <stop offset="0" stop-color="#fff1b0" />
        <stop offset="1" stop-color="#ffb43d" />
      </radialGradient>
      <g id="advent-fir">
        <rect x="-2" y="0" width="4" height="7" fill="#4a3426" />
        <path d="M0 -34 L11 -12 H5 L14 4 H-14 L-5 -12 H-11 Z" fill="#12402f" />
        <path d="M0 -34 L5 -23 L0 -25 L-5 -23 Z M5 -12 L9 -4 L0 -7 L-9 -4 L-5 -12 L0 -14 Z" fill="#f4f8ff" />
      </g>
      <g id="advent-house">
        <rect x="-16" y="-18" width="32" height="18" fill="#6b3a2a" />
        <path d="M-20 -17 L0 -34 L20 -17 Z" fill="#9c2f3b" />
        <path d="M-20 -17 L-9 -26 Q0 -22 9 -26 L20 -17 Q10 -20 0 -18 Q-10 -20 -20 -17 Z" fill="#f4f8ff" />
        <rect x="-10" y="-13" width="7" height="7" rx="1" fill="url(#advent-window)" />
        <rect x="3" y="-13" width="7" height="9" rx="1" fill="url(#advent-window)" />
        <rect x="9" y="-34" width="5" height="9" fill="#4d2a20" />
        <rect x="8" y="-36" width="7" height="3" fill="#f4f8ff" />
      </g>
    </defs>

    <rect width="600" height="400" fill="url(#advent-sky)" />
    <g fill="#fff">
      <circle v-for="star in STARS" :key="`${star[0]}-${star[1]}`" :cx="star[0]" :cy="star[1]" :r="star[2]" :opacity="star[3]" />
    </g>

    <circle cx="505" cy="312" r="46" fill="url(#advent-moon-glow)" />
    <circle cx="505" cy="312" r="17" fill="#fff3c4" />
    <circle cx="499" cy="308" r="3.2" fill="#e9d79a" />
    <circle cx="510" cy="318" r="2.4" fill="#e9d79a" />
    <circle cx="511" cy="306" r="1.6" fill="#e9d79a" />

    <path d="M0 340 Q80 308 170 332 T340 326 T520 322 T600 330 V400 H0 Z" fill="url(#advent-far)" />
    <use href="#advent-fir" x="40" y="338" />
    <use href="#advent-fir" x="66" y="342" />
    <use href="#advent-house" x="130" y="346" />
    <use href="#advent-house" x="190" y="342" transform="translate(190 342) scale(0.8) translate(-190 -342)" />
    <use href="#advent-fir" x="250" y="344" />
    <use href="#advent-house" x="330" y="340" />
    <use href="#advent-fir" x="388" y="340" />
    <use href="#advent-house" x="430" y="336" transform="translate(430 336) scale(0.75) translate(-430 -336)" />
    <use href="#advent-fir" x="572" y="336" />

    <path d="M0 372 Q110 346 230 366 T430 362 T600 366 V400 H0 Z" fill="url(#advent-near)" />
    <use href="#advent-fir" x="22" y="378" transform="translate(22 378) scale(1.25) translate(-22 -378)" />
    <use href="#advent-fir" x="570" y="380" transform="translate(570 380) scale(1.3) translate(-570 -380)" />
    <use href="#advent-fir" x="548" y="384" />
  </svg>
</template>

<script setup lang="ts">
/** x, y, radius, opacity */
const STARS: readonly (readonly [number, number, number, number])[] = [
  [24, 18, 1.2, 0.9], [66, 60, 0.8, 0.6], [112, 30, 1, 0.8], [158, 84, 0.7, 0.5], [205, 22, 1.3, 0.9],
  [262, 58, 0.8, 0.6], [310, 14, 1, 0.8], [356, 72, 1.2, 0.7], [402, 30, 0.8, 0.6], [447, 90, 1, 0.8],
  [488, 20, 1.3, 0.9], [531, 66, 0.8, 0.6], [574, 34, 1.1, 0.8], [40, 140, 0.8, 0.5], [92, 196, 1, 0.7],
  [180, 150, 0.7, 0.5], [286, 120, 1, 0.7], [380, 160, 0.8, 0.5], [470, 140, 1.1, 0.8], [560, 180, 0.8, 0.6],
  [20, 250, 1, 0.7], [140, 270, 0.8, 0.5], [330, 262, 1, 0.6], [590, 255, 0.9, 0.6],
];
</script>

<style scoped>
.scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
