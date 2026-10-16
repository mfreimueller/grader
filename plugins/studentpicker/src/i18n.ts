import type { PluginErrorCode } from '../../../src/shared/plugin-api';

// German only for now; a plain lookup is enough, keys are written exactly as they appear here.
const de = {
  app: { title: 'Zufallsauswahl' },
  loading: 'Lade Kurs …',
  loadFailed: 'Der Kurs konnte nicht geladen werden.',
  machine: {
    label: 'Schülerauswahl',
    brand: 'GLÜCKSRAD',
    spin: 'Hebel ziehen',
    statusIdle: 'Hebel ziehen, um zu starten',
    statusSpinning: 'Die Walzen drehen sich …',
    fair: 'Fair-Modus',
    hint: 'Auf den Hebel klicken, um zu starten. Fair-Modus: nur Schüler/innen mit den wenigsten Aufrufen.',
    noStudents: 'Heute ist niemand anwesend, der ausgewählt werden kann.',
    specials: 'Spezialfelder…',
    reset: 'Zähler zurücksetzen',
    resetConfirm: 'Alle Aufrufzähler dieses Kurses auf 0 zurücksetzen?',
    noStudentToPick: 'Es gibt niemanden, der ausgewählt werden kann.',
    countInvalid: 'Die Anzahl muss eine ganze Zahl ab 0 sein.',
  },
  wheel: {
    label: 'Glücksrad',
    spin: '🎲 Zufällig auswählen',
    statusIdle: 'Bereit zum Drehen',
    statusSpinning: 'Das Rad dreht sich …',
    hint: 'Auf das Rad klicken, um zu drehen. Fair-Modus: nur Schüler/innen mit den wenigsten Aufrufen.',
  },
  skin: {
    label: 'Aussehen',
    slotmachine: 'Spielautomat',
    wheel: 'Glücksrad',
  },
  specials: {
    title: 'Spezialfelder',
    intro:
      'Zusätzliche Felder auf dem Automaten, die nichts zählen oder speichern, z. B. „Nochmal drehen“. Die Wahrscheinlichkeit gilt für jeden Dreh.',
    empty: 'Noch keine Spezialfelder.',
    add: 'Spezialfeld hinzufügen',
    remove: 'Entfernen',
    label: 'Bezeichnung',
    color: 'Farbe',
    kind: 'Art',
    kinds: { 'spin-again': 'Nochmal drehen', message: 'Nachricht' },
    message: 'Text, der angezeigt wird (optional)',
    probability: 'Wahrscheinlichkeit in Prozent',
    showIn: 'Anzeigen in',
    always: 'Immer',
    freeOnly: 'Nur im freien Modus',
    share: 'Anteil für Schüler/innen: {n} %',
    save: 'Speichern',
    errors: {
      label: 'Jedes Spezialfeld braucht eine Bezeichnung.',
      'invalid-probability': 'Die Wahrscheinlichkeit muss zwischen 0 und 100 liegen.',
      'sum-too-high': 'Die Wahrscheinlichkeiten müssen zusammen unter 100 % bleiben.',
    },
  },
  table: {
    name: 'Name',
    count: 'Aufrufe',
    pick: 'Aufrufen',
    countFor: 'Aufrufe für {name}',
  },
  result: {
    selected: '{name} wurde ausgewählt',
    count: 'Aufruf Nr. {n}',
    gradeOptional: 'Leistung eintragen (optional)',
    symbol: { PLUS: 'Plus', WELLE: 'Welle', MINUS: 'Minus' },
    undoHint: 'Aktives Symbol erneut klicken = zurücksetzen',
    saved: 'Gespeichert.',
    noCategory: 'Dieser Kurs hat keine Kategorie, in der sich + ~ − eintragen lassen.',
  },
  common: { cancel: 'Abbrechen', close: 'Schließen' },
  errors: {
    PERMISSION_DENIED: 'Das Plugin darf das nicht.',
    NOT_FOUND: 'Der Kurs wurde nicht gefunden. Wurde er gelöscht?',
    VALIDATION: 'Grader hat die Eingabe abgelehnt.',
    NOT_IN_COURSE: 'Diese Person gehört nicht (mehr) zum Kurs.',
    INTERNAL: 'In Grader ist ein Fehler aufgetreten.',
  },
} as const;

type Params = Readonly<Record<string, string | number>>;

/** The text for a key like `result.count`; the key itself when there is none, so a gap is visible. */
export function t(key: string, params: Params = {}): string {
  let node: unknown = de;
  for (const part of key.split('.')) {
    node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }
  if (typeof node !== 'string') return key;
  return node.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(params[name] ?? placeholder));
}

/** What the teacher reads when the bridge refused something. */
export function describeError(error: { code: PluginErrorCode; message: string }): string {
  const text = t(`errors.${error.code}`);
  return text === `errors.${error.code}` ? error.message : text;
}
