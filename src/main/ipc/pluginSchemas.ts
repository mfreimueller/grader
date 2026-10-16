import { z } from 'zod';

/** Everything a plugin sends is untrusted. Unknown fields are dropped, so a plugin cannot smuggle in a course or plugin id. */

const scope = z.enum(['course', 'global']);

export const storageKeySchema = z.object({ scope, key: z.string() });

// A missing value reaches the service, which explains that undefined cannot be stored.
export const storageSetSchema = z.object({ scope, key: z.string(), value: z.unknown().optional() });

export const storageKeysSchema = z.object({ scope, prefix: z.string().optional() });

const sessionTarget = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('today') }),
  z.object({ kind: z.literal('date'), date: z.string() }),
  z.object({ kind: z.literal('session'), sessionId: z.string().min(1) }),
]);

export const createImpromptuSchema = z.object({
  studentId: z.string().min(1),
  categoryId: z.string().min(1),
  session: sessionTarget.optional(),
  title: z.string().optional(),
  symbol: z.string().optional(),
  score: z.number().optional(),
  maxPoints: z.number().optional(),
});

export const secretKeySchema = z.object({ key: z.string() });

// A value that is not a string reaches the service, which explains what a secret has to be.
export const secretSetSchema = z.object({ key: z.string(), value: z.unknown().optional() });

export const deleteImpromptuSchema = z.object({ assessmentId: z.string().min(1) });

/** The Grader UI managing plugins. */
export const setPluginEnabledSchema = z.object({
  pluginId: z.string().min(1),
  enabled: z.boolean(),
  acceptedPermissions: z.array(z.string()),
  acceptedNetwork: z.array(z.string()).default([]),
});

export const launchPluginSchema = z.object({
  pluginId: z.string().min(1),
  courseId: z.string().min(1),
});
