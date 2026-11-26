import { ref, shallowRef } from 'vue';
import { ADVENT_KEY, createCalendar, doorContent, openDoor, parseCalendar, type AdventCalendar, type DoorContent } from '../core/advent';
import { toPlain, unwrap } from '../core/bridgeError';
import type { DrawResult } from '../core/draw';
import type { Student } from '../core/types';

/** How long a door takes to open, wobble included. */
export const DOOR_MS = 1500;

/** The Adventkalender of the course: which doors are open, and how a draw is played back on one of them. */
export function useAdventCalendar() {
  const calendar = shallowRef<AdventCalendar>(createCalendar(Math.random));
  /** The calendar component, once it is on screen. */
  const stage = ref<{ reveal: (door: number, content: DoorContent, durationMs: number) => Promise<void> } | null>(null);

  async function load(): Promise<void> {
    calendar.value = parseCalendar(unwrap(await window.grader.storage.get(ADVENT_KEY)), Math.random);
  }

  function isOpen(door: number): boolean {
    return calendar.value.doors[door] !== undefined;
  }

  /**
   * A way to play one draw back on that door. Like the pick counts, the calendar is saved up front;
   * the door only shows what was decided, and the calendar on screen follows once it is open.
   */
  function playback(door: number, students: readonly Student[]): (step: DrawResult) => Promise<void> {
    return async (step) => {
      const content = doorContent(step, students);
      const opened = openDoor(calendar.value, door, content);
      if (!opened.ok) throw new Error(opened.error);
      unwrap(await window.grader.storage.set(ADVENT_KEY, toPlain(opened.calendar)));
      await stage.value?.reveal(door, content, DOOR_MS);
      calendar.value = opened.calendar;
    };
  }

  return { calendar, stage, load, isOpen, playback };
}
