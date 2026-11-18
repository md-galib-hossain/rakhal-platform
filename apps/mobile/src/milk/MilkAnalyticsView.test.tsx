import { describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { mount } from '../test-utils/mount.tsx';
import { MilkAnalyticsView } from './MilkAnalyticsView.tsx';
import type { MilkCowRow, MilkTotals } from './milk-model.ts';
import type { MilkTankOption } from './TankSelectorSheet.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockTotals: MilkTotals = {
  totalL: 44.0,
  sellableL: 44.0,
  withheldL: 0,
  loggedCount: 3,
  totalCows: 3,
};

const mockRows: MilkCowRow[] = [
  {
    cattleId: 'c1',
    tag: 'C-001',
    name: 'Bella',
    animalCategory: 'COW',
    breedName: 'Holstein',
    withholding: false,
    yieldL: 15.0,
    todayTotalL: 15.0,
    avgYield7d: 14.0,
    anomalyFlag: false,
    status: 'saved',
    baseUpdatedAt: null,
    isSubmitted: false,
    sessions: {
      MORNING: { yieldL: 8.0, tankName: 'Tank A' },
      NOON: { yieldL: 0, tankName: 'Tank A' },
      EVENING: { yieldL: 7.0, tankName: 'Tank A' },
      NIGHT: { yieldL: null, tankName: 'Tank A' },
    },
  },
  {
    cattleId: 'c2',
    tag: 'C-002',
    name: 'Daisy',
    animalCategory: 'COW',
    breedName: 'Jersey',
    withholding: false,
    yieldL: 14.0,
    todayTotalL: 14.0,
    avgYield7d: 13.0,
    anomalyFlag: false,
    status: 'saved',
    baseUpdatedAt: null,
    isSubmitted: false,
    sessions: {
      MORNING: { yieldL: 7.0, tankName: 'Tank A' },
      NOON: { yieldL: 0, tankName: 'Tank A' },
      EVENING: { yieldL: 7.0, tankName: 'Tank A' },
      NIGHT: { yieldL: null, tankName: 'Tank A' },
    },
  },
];

const mockTanks: MilkTankOption[] = [
  { id: 'tank-1', name: 'Tank A', tankType: 'SELLABLE', totalCapacityL: 1000, currentVolumeL: 44, isPrimary: true },
  { id: 'tank-2', name: 'Tank B', tankType: 'SELLABLE', totalCapacityL: 800, currentVolumeL: 0 },
];

describe('MilkAnalyticsView', () => {
  it('renders 4 key metric cards with calculations', async () => {
    await mount(
      <MilkAnalyticsView
        totals={mockTotals}
        rows={mockRows}
        tanks={mockTanks}
        date="2026-11-16"
        configuredSessions={['MORNING', 'EVENING']}
      />,
    );

    expect(screen.getByTestId('metric-today-yield')).toBeTruthy();
    expect(screen.getByTestId('metric-avg-per-cow')).toBeTruthy();
    expect(screen.getByTestId('metric-safety-status')).toBeTruthy();
    expect(screen.getByTestId('metric-market-value')).toBeTruthy();

    expect(screen.getByText('44 L')).toBeTruthy();
    expect(screen.getByText('100% Safe')).toBeTruthy();
  });

  it('renders 7-day trend card and container utilization bars', async () => {
    await mount(
      <MilkAnalyticsView
        totals={mockTotals}
        rows={mockRows}
        tanks={mockTanks}
        date="2026-11-16"
        configuredSessions={['MORNING', 'EVENING']}
      />,
    );

    expect(screen.getByTestId('analytics-trend-card')).toBeTruthy();
    expect(screen.getByTestId('analytics-containers-card')).toBeTruthy();
    expect(screen.getByTestId('analytics-sessions-card')).toBeTruthy();

    expect(screen.getByText('Tank A')).toBeTruthy();
    expect(screen.getByText('Tank B')).toBeTruthy();
  });
});
