import { ReportRepository } from '../../../../src/domain/report/ReportRepository';

describe('ReportRepository', () => {
  it('is a valid interface (compilation check)', () => {
    const repo: ReportRepository = {
      findCourseReportData: async () => null,
    };
    expect(typeof repo.findCourseReportData).toBe('function');
  });
});
