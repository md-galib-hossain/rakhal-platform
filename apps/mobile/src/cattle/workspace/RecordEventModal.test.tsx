import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { ok, type Handler } from '../../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { syncHarness } from '../../test-utils/sync-harness.tsx';
import type { CattleDetail } from '../cattle-detail-model.ts';
import { RecordEventModal } from './RecordEventModal.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
  restoreMount();
});

const mockDetail: CattleDetail = {
  id: 'c1',
  tagNumber: 'GALIB_001',
  name: 'Lokkhi',
  gender: 'FEMALE',
  animalCategory: 'COW',
  herdStatus: 'ACTIVE',
  productionStatus: 'MILKING',
  healthStatus: 'HEALTHY',
  reproductiveStatus: 'OPEN',
  lactationStage: 'LATE',
  breedName: 'Sahiwal',
  shedName: 'Main Shed',
  motherLabel: null,
  fatherLabel: null,
  dateOfBirth: '2022-08-10',
  avgDailyYield7d: 14.5,
  age: { years: 4, months: 3 },
  childrenCount: 2,
  lastWeightKg: 420,
  aqrScore: 85,
  overview: null,
  reproduction: null,
  health: null,
  pedigree: null,
  feedRequirement: null,
  finance: null,
  timelineEvents: [],
  upcomingEvents: [],
  updatedAt: new Date().toISOString(),
};

async function openModal(
  h: ReturnType<typeof syncHarness>,
  props: Partial<React.ComponentProps<typeof RecordEventModal>> = {},
) {
  return mount(
    <h.Tree>
      <RecordEventModal
        visible={true}
        detail={mockDetail}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
        {...props}
      />
    </h.Tree>,
  );
}

describe('RecordEventModal', () => {
  it('renders category picker by default and allows navigating to event form and back', async () => {
    const h = syncHarness();
    await openModal(h);

    expect(screen.getByText('Record Event')).toBeTruthy();
    expect(screen.getByTestId('category-chip-all')).toBeTruthy();
    expect(screen.getByTestId('event-option-calving')).toBeTruthy();

    // Select Calving event
    await fireEvent.press(screen.getByTestId('event-option-calving'));
    await waitFor(() => expect(screen.getByTestId('event-form-save')).toBeTruthy());
    expect(screen.getByTestId('form-back-to-picker')).toBeTruthy();

    // Click back to picker
    await fireEvent.press(screen.getByTestId('form-back-to-picker'));
    await waitFor(() => expect(screen.getByTestId('event-option-calving')).toBeTruthy());
  });

  it('records HEAT observation with symptoms and sends to API', async () => {
    let capturedBody: unknown = null;

    const handler: Handler = (url, body, method) => {
      if (url.includes('/cattle/c1/events') && method === 'POST') {
        capturedBody = body;
        return ok({ id: 'ev-heat-1', type: 'HEAT' });
      }
      return ok({ ok: true });
    };

    const h = syncHarness({ handler });
    const onSuccess = jest.fn();
    await openModal(h, { initialEventKey: 'HEAT', onSuccess });

    await waitFor(() => expect(screen.getByTestId('heat-symptom-mucus')).toBeTruthy());

    // Toggle symptom
    await fireEvent.press(screen.getByTestId('heat-symptom-mucus'));

    // Save
    await fireEvent.press(screen.getByTestId('event-form-save'));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(onSuccess).toHaveBeenCalledTimes(1);

    const payload = capturedBody as { type: string; payload: Record<string, unknown> };
    expect(payload.type).toBe('HEAT');
    expect(payload.payload.detectionMethod).toBe('VISUAL');
    expect(payload.payload.mucusDischarge).toBe(true);
  });

  it('validates WEIGHT input before sending', async () => {
    let capturedBody: unknown = null;
    const handler: Handler = (url, body, method) => {
      if (url.includes('/cattle/c1/events') && method === 'POST') {
        capturedBody = body;
        return ok({ id: 'ev-w-1', type: 'WEIGHT' });
      }
      return ok({ ok: true });
    };

    const h = syncHarness({ handler });
    await openModal(h, { initialEventKey: 'WEIGHT' });

    await waitFor(() => expect(screen.getByTestId('input-weight-kg')).toBeTruthy());

    // Submit with empty weight -> error appears
    await fireEvent.press(screen.getByTestId('event-form-save'));
    await waitFor(() => expect(screen.getByTestId('event-form-error')).toBeTruthy());
    expect(capturedBody).toBeNull();

    // Type valid weight and submit
    await fireEvent.changeText(screen.getByTestId('input-weight-kg'), '445.5');
    await fireEvent.press(screen.getByTestId('event-form-save'));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    const payload = capturedBody as { type: string; payload: Record<string, unknown> };
    expect(payload.type).toBe('WEIGHT');
    expect(payload.payload.weightKg).toBe(445.5);
  });

  it('records SERVICE / BREEDING event with AI details', async () => {
    let capturedBody: unknown = null;
    const handler: Handler = (url, body, method) => {
      if (url.includes('/cattle/c1/events') && method === 'POST') {
        capturedBody = body;
        return ok({ id: 'ev-srv-1', type: 'BREEDING' });
      }
      return ok({ ok: true });
    };

    const h = syncHarness({ handler });
    await openModal(h, { initialEventKey: 'SERVICE' });

    await waitFor(() => expect(screen.getByTestId('input-service-sire')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('input-service-sire'), 'Bull Sahiwal #9');
    await fireEvent.changeText(screen.getByTestId('input-service-inseminator'), 'Dr. Kabir');
    await fireEvent.changeText(screen.getByTestId('input-service-cost'), '500');
    await fireEvent.press(screen.getByTestId('event-form-save'));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    const payload = capturedBody as { type: string; payload: Record<string, unknown> };
    expect(payload.type).toBe('BREEDING');
    expect(payload.payload.breedingMethod).toBe('AI');
    expect(payload.payload.semenSource).toBe('EXTERNAL');
    expect(payload.payload.sireNameOrCode).toBe('Bull Sahiwal #9');
    expect(payload.payload.inseminator).toBe('Dr. Kabir');
    expect(payload.payload.serviceCost).toBe(500);
  });

  it('maps technician button to EXTERNAL when free-text inseminator is entered', async () => {
    let capturedBody: unknown = null;
    const handler: Handler = (url, body, method) => {
      if (url.includes('/cattle/c1/events') && method === 'POST') {
        capturedBody = body;
        return ok({ id: 'ev-srv-2', type: 'BREEDING' });
      }
      return ok({ ok: true });
    };

    const h = syncHarness({ handler });
    await openModal(h, { initialEventKey: 'SERVICE' });

    await waitFor(() => expect(screen.getByTestId('semen-source-technician_supplied')).toBeTruthy());

    // Select Technician source
    await fireEvent.press(screen.getByTestId('semen-source-technician_supplied'));
    await fireEvent.changeText(screen.getByTestId('input-service-sire'), 'Friesian-102');
    await fireEvent.changeText(screen.getByTestId('input-service-inseminator'), 'Dr. Alam');
    await fireEvent.changeText(screen.getByTestId('input-service-cost'), '333');
    await fireEvent.press(screen.getByTestId('event-form-save'));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    const payload = capturedBody as { type: string; payload: Record<string, unknown> };
    expect(payload.payload.breedingMethod).toBe('AI');
    // Mapped to EXTERNAL to prevent "serviceProviderId is required" backend crash
    expect(payload.payload.semenSource).toBe('EXTERNAL');
    expect(payload.payload.inseminator).toBe('Dr. Alam');
    expect(payload.payload.serviceCost).toBe(333);
  });

  it('records ILLNESS report with severity and symptoms', async () => {
    let capturedBody: unknown = null;
    const handler: Handler = (url, body, method) => {
      if (url.includes('/cattle/c1/events') && method === 'POST') {
        capturedBody = body;
        return ok({ id: 'ev-ill-1', type: 'ILLNESS' });
      }
      return ok({ ok: true });
    };

    const h = syncHarness({ handler });
    await openModal(h, { initialEventKey: 'ILLNESS' });

    await waitFor(() => expect(screen.getByTestId('input-illness-symptoms')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('input-illness-symptoms'), 'Loss of appetite, swollen udder');
    await fireEvent.press(screen.getByTestId('event-form-save'));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    const payload = capturedBody as { type: string; payload: Record<string, unknown> };
    expect(payload.type).toBe('ILLNESS');
    expect(payload.payload.symptoms).toBe('Loss of appetite, swollen udder');
  });
});
