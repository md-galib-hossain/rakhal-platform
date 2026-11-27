import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { syncHarness } from '../../test-utils/sync-harness.tsx';
import type { CattleDetail } from '../cattle-detail-model.ts';
import { MoneyTab } from './MoneyTab.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const mockDetail: CattleDetail = {
  id: 'c-001',
  tagNumber: 'BD-001',
  name: 'Rupa',
  breedName: 'Holstein Friesian',
  gender: 'female',
  animalCategory: 'cow',
  dateOfBirth: '2022-01-01',
  age: { years: 2, months: 10 },
  shedName: 'Shed A',
  herdStatus: 'lactating',
  productionStatus: 'milking',
  healthStatus: 'healthy',
  reproductiveStatus: null,
  motherLabel: null,
  fatherLabel: null,
  childrenCount: 0,
  avgDailyYield7d: 22,
  lastWeightKg: 420,
  aqrScore: 80,
  updatedAt: null,
  finance: {
    period: '2026-11',
    total_income: 18500,
    total_cost: 9200,
    net_profit: 9300,
    expense_breakdown: {
      feed: 6000,
      health: 1200,
      breeding: 1000,
      others: 1000,
    },
    income_breakdown: {
      milk_sales: 18500,
      calf_sales: 0,
    },
    monthly_chart: [],
  },
};

async function open(detail: CattleDetail = mockDetail) {
  const h = syncHarness();
  await mount(
    <h.Tree>
      <MoneyTab detail={detail} />
    </h.Tree>,
  );
  await waitFor(() => expect(h.sync().ready).toBe(true));
}

describe('MoneyTab', () => {
  it('renders financial KPIs and breakdown cards', async () => {
    await open();

    expect(screen.getByTestId('tab-money')).toBeTruthy();
    expect(screen.getByTestId('card-expense-breakdown')).toBeTruthy();
    expect(screen.getByTestId('card-income-breakdown')).toBeTruthy();
  });

  it('renders date picker trigger and opens DatePickerSheet on tap', async () => {
    await open();

    const trigger = screen.getByTestId('money-date-picker-trigger');
    expect(trigger).toBeTruthy();
    expect(screen.getByText('November 2026')).toBeTruthy();

    // Tap trigger to open DatePickerSheet
    fireEvent.press(trigger);
    await waitFor(() => expect(screen.getByTestId('money-date-picker-sheet')).toBeTruthy());
  });
});
