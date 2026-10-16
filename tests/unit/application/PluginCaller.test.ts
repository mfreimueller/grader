import {
  NotInCourseError,
  PluginCaller,
  PluginPermissionDeniedError,
  requirePermission,
} from '../../../src/application/PluginCaller';
import { PluginManifest } from '../../../src/domain/plugin/PluginManifest';
import { DomainError } from '../../../src/shared/errors';

const aCaller = (permissions: string[]): PluginCaller => {
  const manifest = PluginManifest.create({
    id: 'at.example.tool',
    name: 'Tool',
    version: '1.0.0',
    apiVersion: 1,
    entry: 'index.html',
    launch: ['course'],
    permissions,
    network: [],
  });
  if (!manifest.ok) throw manifest.error;
  return { manifest: manifest.value, courseId: 'course-1' };
};

describe('PluginCaller', () => {
  describe('requirePermission', () => {
    it('succeeds when the manifest declares the permission', () => {
      expect(requirePermission(aCaller(['storage']), 'storage').ok).toBe(true);
    });

    it('fails with a PluginPermissionDeniedError naming the permission otherwise', () => {
      const result = requirePermission(aCaller(['storage']), 'assessment:impromptu');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBeInstanceOf(PluginPermissionDeniedError);
      expect(result.error.message).toContain('assessment:impromptu');
    });
  });

  describe('errors', () => {
    it('are domain errors so they travel as Results', () => {
      expect(new PluginPermissionDeniedError('not yours')).toBeInstanceOf(DomainError);
      expect(new NotInCourseError('Student', 's-1')).toBeInstanceOf(DomainError);
    });

    it('NotInCourseError names what does not belong to the course', () => {
      expect(new NotInCourseError('Student', 's-1').message).toBe('Student s-1 does not belong to this course');
    });
  });
});
