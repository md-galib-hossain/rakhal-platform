import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { DatePickerSheet } from './DatePickerSheet.tsx';
import { DateRangePicker } from './DateRangePicker.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

function withSafeFrame(children: ReactElement) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 800 },
        insets: { top: 24, left: 0, right: 0, bottom: 0 },
      }}
    >
      {children}
    </SafeAreaProvider>
  );
}

describe('DateRangePicker', () => {
  it('renders month and year header and navigates months', async () => {
    await mount(
      <DateRangePicker
        mode="range"
        initialYear={2026}
        initialMonth={11}
      />,
      { locale: 'en' },
    );

    expect(screen.getByTestId('picker-month-year')).toHaveTextContent('November 2026');

    // Navigate to next month (December 2026)
    await act(async () => {
      fireEvent.press(screen.getByTestId('picker-next-month'));
    });
    await waitFor(() => expect(screen.getByTestId('picker-month-year')).toHaveTextContent('December 2026'));

    // Navigate back to previous month (November 2026)
    await act(async () => {
      fireEvent.press(screen.getByTestId('picker-prev-month'));
    });
    await waitFor(() => expect(screen.getByTestId('picker-month-year')).toHaveTextContent('November 2026'));
  });

  it('renders Bangla month and year in bn locale', async () => {
    await mount(
      <DateRangePicker
        mode="range"
        initialYear={2026}
        initialMonth={11}
      />,
      { locale: 'bn', digits: 'beng' },
    );

    expect(screen.getByTestId('picker-month-year')).toHaveTextContent('নভেম্বর ২০২৬');
    expect(screen.getByText('র')).toBeTruthy();
    expect(screen.getByText('সো')).toBeTruthy();
  });

  it('handles single date selection mode', async () => {
    const onSelect = jest.fn();
    await mount(
      <DateRangePicker
        mode="single"
        value="2026-11-15"
        onChangeSingle={onSelect}
        initialYear={2026}
        initialMonth={11}
      />,
    );

    const day15 = screen.getByTestId('day-2026-11-15');
    expect(day15.props.accessibilityState).toMatchObject({ selected: true });

    fireEvent.press(screen.getByTestId('day-2026-11-20'));
    expect(onSelect).toHaveBeenCalledWith('2026-11-20');
  });

  it('handles range selection mode with start and end dates and range connectors', async () => {
    const onChangeRange = jest.fn();
    await mount(
      <DateRangePicker
        mode="range"
        range={{ startDate: '2026-11-10', endDate: '2026-11-14' }}
        onChangeRange={onChangeRange}
        initialYear={2026}
        initialMonth={11}
      />,
    );

    // Selected state on start and end
    expect(screen.getByTestId('day-2026-11-10').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('day-2026-11-14').props.accessibilityState).toMatchObject({ selected: true });

    // Connectors on in-between and boundary days
    expect(screen.getByTestId('range-connector-right-2026-11-10')).toBeTruthy();
    expect(screen.getByTestId('range-connector-left-2026-11-14')).toBeTruthy();
    expect(screen.getByTestId('range-connector-left-2026-11-12')).toBeTruthy();
    expect(screen.getByTestId('range-connector-right-2026-11-12')).toBeTruthy();

    // Tapping a new day triggers onChangeRange
    fireEvent.press(screen.getByTestId('day-2026-11-18'));
    expect(onChangeRange).toHaveBeenCalledWith({ startDate: '2026-11-18', endDate: null });
  });

  it('respects minDate and maxDate limits by disabling out-of-range dates', async () => {
    await mount(
      <DateRangePicker
        mode="range"
        minDate="2026-11-05"
        maxDate="2026-11-25"
        initialYear={2026}
        initialMonth={11}
      />,
    );

    expect(screen.getByTestId('day-2026-11-02').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('day-2026-11-10').props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.getByTestId('day-2026-11-28').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('every interactive navigation button and day cell meets >= 48dp touch target', async () => {
    await mount(
      <DateRangePicker
        mode="range"
        initialYear={2026}
        initialMonth={11}
      />,
    );

    const prevBtn = screen.getByTestId('picker-prev-month');
    const prevStyle = Object.assign({}, ...[prevBtn.props.style].flat(5).filter(Boolean)) as { minHeight?: number; minWidth?: number };
    expect(prevStyle.minHeight).toBeGreaterThanOrEqual(48);
    expect(prevStyle.minWidth).toBeGreaterThanOrEqual(48);

    const dayCell = screen.getByTestId('day-2026-11-15');
    const dayStyle = Object.assign({}, ...[dayCell.props.style].flat(5).filter(Boolean)) as { height?: number; width?: number };
    expect(dayStyle.height).toBeGreaterThanOrEqual(48);
  });
});

describe('DatePickerSheet', () => {
  it('renders bottom sheet presentation with title, close button, and action buttons', async () => {
    const onClose = jest.fn();
    const onConfirmRange = jest.fn();

    const view = await mount(
      withSafeFrame(
        <DatePickerSheet
          visible={true}
          onClose={onClose}
          mode="range"
          range={{ startDate: '2026-11-10', endDate: '2026-11-15' }}
          onConfirmRange={onConfirmRange}
        />,
      ),
      { locale: 'en' },
    );

    expect(screen.getByText('Select Date Range')).toBeTruthy();
    expect(screen.getByTestId('picker-close')).toBeTruthy();
    expect(screen.getByTestId('picker-apply')).toBeTruthy();
    expect(screen.getByTestId('picker-cancel')).toBeTruthy();
    expect(screen.getByTestId('picker-clear')).toBeTruthy();

    // Close button triggers onClose
    await act(async () => {
      fireEvent.press(screen.getByTestId('picker-close'));
    });
    expect(onClose).toHaveBeenCalled();

    // Cancel button triggers onClose
    await act(async () => {
      fireEvent.press(screen.getByTestId('picker-cancel'));
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    // Apply button triggers onConfirmRange
    await act(async () => {
      fireEvent.press(screen.getByTestId('picker-apply'));
    });
    expect(onConfirmRange).toHaveBeenCalledWith({ startDate: '2026-11-10', endDate: '2026-11-15' });
    view.unmount();
  });

  it('clears selection when clear button is pressed', async () => {
    const onConfirmRange = jest.fn();
    const onClose = jest.fn();

    const view = await mount(
      withSafeFrame(
        <DatePickerSheet
          visible={true}
          onClose={onClose}
          mode="range"
          range={{ startDate: '2026-11-10', endDate: '2026-11-15' }}
          onConfirmRange={onConfirmRange}
        />,
      ),
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('picker-clear'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('picker-apply'));
    });
    expect(onConfirmRange).toHaveBeenCalledWith({ startDate: null, endDate: null });
    view.unmount();
  });
});
