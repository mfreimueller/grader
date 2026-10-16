import type { GraderPluginApi } from '../../../src/shared/plugin-api';

declare global {
  interface Window {
    /** The bridge to Grader, exposed by the plugin preload. */
    grader: GraderPluginApi;
  }
}
