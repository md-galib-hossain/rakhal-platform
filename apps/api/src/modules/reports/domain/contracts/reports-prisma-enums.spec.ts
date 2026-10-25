import {
  ReportErrorCategory,
  ReportOrigin,
  ReportStatus,
  ReportType,
} from '@prisma/client';
import {
  REPORT_ERROR_CATEGORIES,
  REPORT_ORIGINS,
  REPORT_STATUSES,
  REPORT_TYPES,
} from './enums';

describe('Prisma report enums mirror the contracts', () => {
  const vals = (e: object): string[] => (Object.values(e) as string[]).sort();
  it.each([
    ['ReportType', ReportType, REPORT_TYPES],
    ['ReportOrigin', ReportOrigin, REPORT_ORIGINS],
    ['ReportStatus', ReportStatus, REPORT_STATUSES],
    ['ReportErrorCategory', ReportErrorCategory, REPORT_ERROR_CATEGORIES],
  ])('%s', (_n, prismaEnum, contract) => {
    expect(vals(prismaEnum)).toEqual([...contract].sort());
  });
});
