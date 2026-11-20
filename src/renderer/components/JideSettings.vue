<template>
  <section class="jide-settings" aria-labelledby="jide-settings-label" data-testid="jide-settings">
    <label id="jide-settings-label" class="form-label">J;DE</label>
    <p class="hint">
      Verbindung zu J;DE. Gradeflow holt damit Aufgaben und Abgaben und sendet die Bewertungen zurück.
      Den API-Schlüssel erstellen Sie in der J;DE-Lehrer-Webapp unter „API-Schlüssel“.
    </p>
    <p v-if="!s.stored.value.encryptionAvailable" class="error-msg">
      Dieses System bietet keine sichere Ablage; der API-Schlüssel kann hier nicht gespeichert werden.
    </p>

    <div class="row">
      <label class="field wide">
        Adresse
        <input v-model="s.form.baseUrl" type="url" placeholder="https://…" autocomplete="off" data-testid="jide-url" />
      </label>
      <label class="field wide">
        API-Schlüssel
        <input
          v-model="s.form.apiKey"
          type="password"
          autocomplete="off"
          :placeholder="s.stored.value.hasKey ? 'gespeichert – leer lassen, um ihn zu behalten' : 'jide_…'"
          data-testid="jide-key"
        />
      </label>
    </div>
    <div class="row actions">
      <button type="button" class="btn btn-secondary" :disabled="s.busy.value" data-testid="jide-test" @click="s.test()">Verbindung testen</button>
      <button type="button" class="btn btn-secondary" :disabled="s.busy.value" data-testid="jide-save" @click="s.save()">Speichern</button>
      <button v-if="s.stored.value.hasKey" type="button" class="btn btn-secondary" :disabled="s.busy.value" data-testid="jide-clear" @click="s.clear()">
        Verbindung entfernen
      </button>
    </div>

    <p v-if="s.message.value" class="success-msg" data-testid="jide-message">{{ s.message.value }}</p>
    <p v-if="s.error.value" class="error-msg" data-testid="jide-error">{{ s.error.value }}</p>
  </section>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useJideSettings } from '../controllers/useJideSettings';

const props = defineProps<{ visible: boolean }>();

const s = useJideSettings(window.grdr.jide);

watch(
  () => props.visible,
  (open) => {
    if (open) void s.load();
  },
  { immediate: true },
);
</script>

<style scoped>
.form-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--color-text); }
.hint { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px; }
.row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 8px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.field.wide { flex: 1; min-width: 220px; }
.field input { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; font-size: 14px; background: var(--color-bg); color: var(--color-text); }
.btn { padding: 8px 16px; border-radius: 6px; border: 1px solid var(--color-border); background: transparent; color: var(--color-text); font-size: 14px; cursor: pointer; font-weight: 500; }
.error-msg { color: var(--color-danger); font-size: 12px; }
.success-msg { color: var(--color-success); margin-top: 8px; font-size: 13px; }
</style>
