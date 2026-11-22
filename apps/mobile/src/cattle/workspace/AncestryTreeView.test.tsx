import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react-native';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import type { PedigreeData } from '../cattle-detail-model.ts';
import { AncestryTreeView } from './AncestryTreeView.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(() => {
  cleanup();
  restoreMount();
});

const mockPedigree: PedigreeData = {
  self: {
    id: 'c1',
    name: 'Lokkhi',
    tag: 'GALIB_DAIRY_1-001',
    gender: 'FEMALE',
    farm_name: 'Galib Dairy Farm',
  },
  dam: {
    id: 'c-dam',
    name: 'Rani',
    tag: 'DAM_01',
    gender: 'FEMALE',
    farm_name: 'Galib Dairy Farm',
  },
  sire: null, // Unknown father
  siblings: [
    {
      id: 'c-sib-1',
      name: 'Chondro',
      tag: 'SIB_01',
      gender: 'MALE',
      farm_name: 'Galib Dairy Farm',
    },
  ],
  offspring: [
    {
      id: 'c-off-1',
      name: 'Tuni',
      tag: 'CALF_01',
      gender: 'FEMALE',
      birth_date: '2025-10-15',
      farm_name: 'Galib Dairy Farm',
    },
  ],
};

describe('AncestryTreeView', () => {
  it('renders all tree nodes and navigates on tap', async () => {
    const onNavigate = jest.fn();
    await mount(
      <AncestryTreeView
        pedigree={mockPedigree}
        onNavigateToAnimal={onNavigate}
      />
    );

    // Header title and hint
    expect(screen.getByText('Ancestry Tree')).toBeTruthy();
    expect(screen.getByText('(Drag to pan · Scroll to zoom)')).toBeTruthy();

    // Dam (Rani)
    expect(screen.getByText('Rani')).toBeTruthy();
    expect(screen.getByText('DAM_01')).toBeTruthy();
    expect(screen.getByText('Mother')).toBeTruthy();

    // Sire (Unknown)
    expect(screen.getByText('Father')).toBeTruthy();

    // Self (Lokkhi)
    expect(screen.getByText('Lokkhi')).toBeTruthy();
    expect(screen.getByText('GALIB_DAIRY_1-001')).toBeTruthy();
    expect(screen.getByText('Self')).toBeTruthy();

    // Sibling (Chondro)
    expect(screen.getByText('Chondro')).toBeTruthy();
    expect(screen.getByText('Full Sibling')).toBeTruthy();

    // Offspring (Tuni)
    expect(screen.getByText('Tuni')).toBeTruthy();
    expect(screen.getByText('Daughter')).toBeTruthy();

    // Navigation on node press
    const damNode = screen.getByTestId('pressable-node-dam');
    fireEvent.press(damNode);
    expect(onNavigate).toHaveBeenCalledWith('c-dam');

    const offspringNode = screen.getByTestId('pressable-node-child-c-off-1');
    fireEvent.press(offspringNode);
    expect(onNavigate).toHaveBeenCalledWith('c-off-1');

    // Zoom controls initial percentage and zoom in
    expect(screen.getByTestId('zoom-percentage-text').props.children).toEqual([82, '%']);

    await act(async () => {
      fireEvent.press(screen.getByTestId('zoom-in-btn'));
    });
    expect(screen.getByTestId('zoom-percentage-text').props.children).toEqual([97, '%']);
  });
});
