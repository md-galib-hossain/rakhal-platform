import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ok, sessionReply, type Handler } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { syncHarness } from '../test-utils/sync-harness.tsx';
import { AddAnimalModal } from './AddAnimalModal.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn<() => Promise<{ granted: boolean }>>().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn<() => Promise<{ canceled: boolean; assets: Array<{ uri: string }> }>>().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://test-image.jpg' }],
  }),
}));

afterEach(() => {
  cleanup();
  restoreMount();
});

function server(onPost?: (body: unknown) => void): Handler {
  return (url, body, method) => {
    if (url.endsWith('/auth/refresh')) return sessionReply(1);
    if (url.endsWith('/auth/me')) return ok({ permissions: ['*'] });
    if (url.endsWith('/farms')) return ok([{ id: 'farm-1', name: 'Demo Farm', slug: 'df', role: 'OWNER' }]);
    if (url.endsWith('/breeds')) {
      return ok([
        { id: 'b1', name: 'Holstein-Friesian' },
        { id: 'b2', name: 'Sahiwal' },
      ]);
    }
    if (method === 'POST' && url.endsWith('/cattle')) {
      onPost?.(body);
      return ok({ id: 'cattle-123', tagNumber: 'COW-001' });
    }
    return ok({ ok: true });
  };
}

describe('AddAnimalModal', () => {
  it('renders Step 1 with basic info form and photo toggle', async () => {
    const h = syncHarness({ handler: server() });
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    await mount(
      <h.Tree>
        <AddAnimalModal visible onClose={onClose} onSuccess={onSuccess} />
      </h.Tree>,
    );

    await waitFor(() => expect(screen.getByText('Add New Animal')).toBeTruthy());
    expect(screen.getByText('Basic Information')).toBeTruthy();
    expect(screen.getByText('Additional Information')).toBeTruthy();
    expect(screen.getByTestId('add-animal-tag-input')).toBeTruthy();
    expect(screen.getByTestId('add-animal-photo-box')).toBeTruthy();

    // Pick photo
    await fireEvent.press(screen.getByTestId('add-animal-photo-box'));
    await waitFor(() => expect(screen.getByTestId('add-animal-photo-preview')).toBeTruthy());
    expect(screen.getByTestId('add-animal-photo-remove')).toBeTruthy();

    // Remove photo
    await fireEvent.press(screen.getByTestId('add-animal-photo-remove'));
    await waitFor(() => expect(screen.getByTestId('add-animal-photo-box')).toBeTruthy());
  });

  it('validates Tag ID requirement before advancing to Step 2', async () => {
    const h = syncHarness({ handler: server() });
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    await mount(
      <h.Tree>
        <AddAnimalModal visible onClose={onClose} onSuccess={onSuccess} />
      </h.Tree>,
    );

    await waitFor(() => expect(screen.getByTestId('add-animal-next-btn')).toBeTruthy());

    // Press next without tag ID
    await fireEvent.press(screen.getByTestId('add-animal-next-btn'));

    // Validation error shown
    await waitFor(() => expect(screen.getByText('Tag ID is required')).toBeTruthy());
  });

  it('navigates to Step 2 when Tag ID is valid, and allows going back to Step 1', async () => {
    const h = syncHarness({ handler: server() });
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    await mount(
      <h.Tree>
        <AddAnimalModal visible onClose={onClose} onSuccess={onSuccess} />
      </h.Tree>,
    );

    await waitFor(() => expect(screen.getByTestId('add-animal-tag-input')).toBeTruthy());

    // Enter Tag ID
    await fireEvent.changeText(screen.getByTestId('add-animal-tag-input'), 'COW-999');

    // Press Next
    await fireEvent.press(screen.getByTestId('add-animal-next-btn'));

    // Step 2 is shown
    await waitFor(() => {
      expect(screen.getByText('Her history (optional)')).toBeTruthy();
    });
    expect(screen.getByText('Has she calved before?')).toBeTruthy();
    expect(screen.getByText('Is she pregnant?')).toBeTruthy();
    expect(screen.getByTestId('add-animal-history-preview')).toBeTruthy();

    // Press Back to Step 1
    await fireEvent.press(screen.getByTestId('add-animal-back-btn'));

    // Returns to Step 1 preserving Tag ID
    await waitFor(() => {
      expect(screen.getByText('Add New Animal')).toBeTruthy();
    });
    expect(screen.getByDisplayValue('COW-999')).toBeTruthy();
  });

  it('submits animal with history and invokes onSuccess', async () => {
    let submittedPayload: unknown = null;
    const h = syncHarness({ handler: server((body) => { submittedPayload = body; }) });
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    await mount(
      <h.Tree>
        <AddAnimalModal visible onClose={onClose} onSuccess={onSuccess} />
      </h.Tree>,
    );

    await waitFor(() => expect(screen.getByTestId('add-animal-tag-input')).toBeTruthy());

    // Fill Step 1
    await fireEvent.changeText(screen.getByTestId('add-animal-tag-input'), 'COW-777');
    await fireEvent.changeText(screen.getByTestId('add-animal-name-input'), 'Rani');
    await fireEvent.press(screen.getByTestId('add-animal-next-btn'));

    // Step 2
    await waitFor(() => {
      expect(screen.getByText('Her history (optional)')).toBeTruthy();
    });

    // Toggle calved before -> Yes
    await fireEvent.press(screen.getByTestId('history-calved-yes'));
    await waitFor(() =>
      expect(screen.getByText(/Last calving/, { includeHiddenElements: true })).toBeTruthy(),
    );

    // Toggle pregnant -> Yes
    await fireEvent.press(screen.getByTestId('history-pregnant-yes'));
    await waitFor(() =>
      expect(screen.getByText(/Months pregnant/, { includeHiddenElements: true })).toBeTruthy(),
    );

    // Submit with history
    await fireEvent.press(screen.getByTestId('add-animal-history-save-btn'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(submittedPayload).toBeTruthy();
    const p = submittedPayload as Record<string, unknown>;
    expect(p.tagNumber).toBe('COW-777');
    expect(p.name).toBe('Rani');
    expect(p.gender).toBe('FEMALE');
  });

  it('submits immediately from Step 1 with save without history', async () => {
    let submittedPayload: unknown = null;
    const h = syncHarness({ handler: server((body) => { submittedPayload = body; }) });
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    await mount(
      <h.Tree>
        <AddAnimalModal visible onClose={onClose} onSuccess={onSuccess} />
      </h.Tree>,
    );

    await waitFor(() => expect(screen.getByTestId('add-animal-tag-input')).toBeTruthy());

    // Fill Step 1 Tag
    await fireEvent.changeText(screen.getByTestId('add-animal-tag-input'), 'COW-333');

    // Click "Save without history"
    await fireEvent.press(screen.getByTestId('add-animal-save-without-history-btn'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    const p = submittedPayload as Record<string, unknown>;
    expect(p.tagNumber).toBe('COW-333');
    expect(p.history).toBeUndefined();
  });
});
