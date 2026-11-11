import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { pressDown, pressUp } from '../../test-utils/press.ts';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { expectNoFixedTextHeight, expectTouchTarget, findNodes, flatStyle } from '../../test-utils/touch-target.ts';
import { allColors, fontFamily } from '../../theme/tokens.ts';
import { STACK_AT_FONT_SCALE } from '../internal/layout-rules.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { ListRow } from './ListRow.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const HIDDEN = { includeHiddenElements: true } as const;
const row = () => screen.getByTestId('r');
const noop = () => {};
const LONG_BN = 'সকালের দুধ দোহনের প্রথম পালা এবং বিশেষ নোট';

describe('ListRow semantics', () => {
  it('pressable: one button node with the merged text as its name, selected=false by default', async () => {
    await mount(<ListRow testID="r" title="Cow A-1204" subtitle="Milking, 12 L" onPress={noop} />);
    expect(row().props.accessibilityRole).toBe('button');
    expect(row().props.accessibilityLabel).toBeUndefined();
    expect(row().props.accessibilityState).toMatchObject({ selected: false, disabled: false });
    expect(screen.getByRole('button', { name: /Cow A-1204/ })).toBeTruthy();
    expect(screen.getByText('Cow A-1204')).toBeTruthy();
    expect(screen.getByText('Milking, 12 L')).toBeTruthy();
  });

  it('an explicit accessibilityLabel and hint are passed through', async () => {
    await mount(<ListRow testID="r" title="A-1" onPress={noop} accessibilityLabel="Open A-1" accessibilityHint="Opens the animal" />);
    expect(row().props.accessibilityLabel).toBe('Open A-1');
    expect(row().props.accessibilityHint).toBe('Opens the animal');
  });

  it('not pressable: a plain View with no role, no chevron, no press handler', async () => {
    await mount(<ListRow testID="r" title="Entry" subtitle="Morning" />);
    expect(row().props.accessibilityRole).toBeUndefined();
    expect(row().props.onPress).toBeUndefined();
    expect(screen.queryByTestId('glyph-chevronRight', HIDDEN)).toBeNull();
  });

  it('calls onPress once', async () => {
    const onPress = jest.fn();
    await mount(<ListRow testID="r" title="Entry" onPress={onPress} />);
    await fireEvent.press(row());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled: presses ignored, state reported, title muted', async () => {
    const onPress = jest.fn();
    await mount(<ListRow testID="r" title="Entry" onPress={onPress} disabled />);
    await fireEvent.press(row());
    expect(onPress).not.toHaveBeenCalled();
    expect(row().props.accessibilityState).toMatchObject({ disabled: true });
    expect(flatStyle(screen.getByText('Entry')).color).toBe(allColors.light.mutedForeground);
  });

  it('chevron is shown on a pressable row, hidden from a11y, and can be turned off', async () => {
    const view = await mount(<ListRow testID="r" title="Entry" onPress={noop} />);
    expect(screen.getByTestId('glyph-chevronRight', HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('glyph-chevronRight')).toBeNull(); // hidden by default queries
    view.unmount();
    await mount(<ListRow testID="r" title="Entry" onPress={noop} showChevron={false} />);
    expect(screen.queryByTestId('glyph-chevronRight', HIDDEN)).toBeNull();
  });

  it('selected: primaryEdge stripe + check glyph + accessibilityState.selected; the surface stays card', async () => {
    const { colors } = await mount(<ListRow testID="r" title="Entry" onPress={noop} selected />);
    expect(row().props.accessibilityState).toMatchObject({ selected: true });
    expect(flatStyle(screen.getByTestId('list-row-stripe', HIDDEN))).toMatchObject({ width: 4, backgroundColor: colors.primaryEdge });
    expect(screen.getByTestId('glyph-check', HIDDEN)).toBeTruthy();
    expect(flatStyle(row()).backgroundColor).toBe(colors.card);
  });

  it('not selected: no stripe, no check', async () => {
    await mount(<ListRow testID="r" title="Entry" onPress={noop} />);
    expect(screen.queryByTestId('list-row-stripe', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('glyph-check', HIDDEN)).toBeNull();
  });

  it('divider: a hairline border-coloured View, inset 12, hidden from a11y; absent by default', async () => {
    const { colors, unmount } = await mount(<ListRow testID="r" title="Entry" divider />);
    expect(flatStyle(screen.getByTestId('list-row-divider', HIDDEN))).toMatchObject({
      height: 1,
      marginHorizontal: 12,
      backgroundColor: colors.border,
    });
    unmount();
    await mount(<ListRow testID="r" title="Entry" />);
    expect(screen.queryByTestId('list-row-divider', HIDDEN)).toBeNull();
  });

  it('renders leading and trailing content', async () => {
    await mount(
      <ListRow testID="r" title="Entry" leading={<RNText>1204</RNText>} trailing={<StatusBadge tone="warning" label="Overdue" />} />,
    );
    expect(screen.getByText('1204')).toBeTruthy();
    expect(screen.getByText('Overdue')).toBeTruthy();
  });
});

describe('ListRow layout', () => {
  it.each([
    ['one-line', undefined, 56],
    ['two-line', 'Subtitle', 64],
  ] as const)('%s pressable row has a %sdp-class minimum and clears 48', async (_n, subtitle, min) => {
    await mount(<ListRow testID="r" title="Entry" subtitle={subtitle} onPress={noop} />);
    expectTouchTarget(row(), 48);
    expect(flatStyle(row())).toMatchObject({ minHeight: min, paddingHorizontal: 12, paddingVertical: 8, gap: 12, flexDirection: 'row' });
    expect(flatStyle(row()).height).toBeUndefined();
  });

  it('never uses numberOfLines or a fixed height on a text holder', async () => {
    await mount(<ListRow testID="r" title={LONG_BN} subtitle={LONG_BN} onPress={noop} trailing={<StatusBadge tone="info" label={LONG_BN} />} />, { locale: 'bn' });
    for (const t of findNodes(row(), (n) => n.type === 'Text')) expect(t.props.numberOfLines).toBeUndefined();
    expectNoFixedTextHeight(row());
  });

  it('one row: trailing sits beside the text at 1x and at the stack threshold', async () => {
    for (const fontScale of [1, STACK_AT_FONT_SCALE]) {
      const view = await mount(<ListRow testID="r" title="Entry" trailing={<RNText>T</RNText>} />, { fontScale });
      const trailing = screen.getByTestId('list-row-trailing');
      expect(trailing.parent?.props.testID).toBe('r');
      expect(flatStyle(trailing).flexShrink).toBe(0);
      view.unmount();
    }
  });

  it('stacks above 1.3: trailing moves inside the text column, below the title', async () => {
    await mount(<ListRow testID="r" title="Entry" subtitle="Sub" onPress={noop} trailing={<RNText>T</RNText>} />, { fontScale: 2 });
    const trailing = screen.getByTestId('list-row-trailing');
    expect(trailing.parent?.props.testID).toBe('list-row-text');
    // minHeight only, still no fixed height at 200%.
    expect(flatStyle(row()).height).toBeUndefined();
    expect(flatStyle(row()).minHeight).toBeGreaterThanOrEqual(48);
    // chevron stays in the row, right of the text column.
    expect(screen.getByTestId('glyph-chevronRight', HIDDEN).parent?.props.testID).toBe('r');
  });

  it('does not stack when there is no trailing content, even at 200%', async () => {
    await mount(<ListRow testID="r" title="Entry" />, { fontScale: 2 });
    expect(screen.queryByTestId('list-row-trailing')).toBeNull();
  });
});

describe('ListRow themes and locales', () => {
  it.each(['light', 'dark'] as const)('resolves surface and text tokens (%s)', async (scheme) => {
    const c = allColors[scheme];
    await mount(<ListRow testID="r" title="Entry" subtitle="Sub" onPress={noop} />, { scheme });
    expect(flatStyle(row()).backgroundColor).toBe(c.card);
    expect(flatStyle(screen.getByText('Entry')).color).toBe(c.foreground);
    expect(flatStyle(screen.getByText('Sub')).color).toBe(c.mutedForeground);
  });

  it('en: Latin family; bn: whole-string Bengali family, and script="latin" forces Inter', async () => {
    const en = await mount(<ListRow testID="r" title="Cow A-1204" />, { locale: 'en' });
    expect(flatStyle(screen.getByText('Cow A-1204')).fontFamily).toBe(fontFamily.latin.semibold);
    en.unmount();
    const bn = await mount(<ListRow testID="r" title="গাভী A-1204" />, { locale: 'bn' });
    expect(flatStyle(screen.getByText('গাভী A-1204')).fontFamily).toBe(fontFamily.bengali.semibold);
    bn.unmount();
    await mount(<ListRow testID="r" title="A-1204" titleScript="latin" />, { locale: 'bn' });
    expect(flatStyle(screen.getByText('A-1204')).fontFamily).toBe(fontFamily.latin.semibold);
  });
});

describe('ListRow pressed look', () => {
  it('pressed shows the 12% overlay under the content; released removes it', async () => {
    await mount(<ListRow testID="r" title="Entry" onPress={noop} />);
    expect(screen.queryByTestId('pressed-overlay', HIDDEN)).toBeNull();
    await pressDown(row());
    expect(screen.getByTestId('pressed-overlay', HIDDEN)).toBeTruthy();
    await pressUp(row());
    expect(screen.queryByTestId('pressed-overlay', HIDDEN)).toBeNull();
  });

  it('focus draws the inset ring (outlineOffset -4) and blur removes it', async () => {
    const { colors } = await mount(<ListRow testID="r" title="Entry" onPress={noop} />);
    expect(flatStyle(row()).outlineWidth).toBeUndefined();
    await fireEvent(row(), 'focus');
    expect(flatStyle(row())).toMatchObject({ outlineWidth: 2, outlineOffset: -4, outlineColor: colors.focusRing });
    await fireEvent(row(), 'blur');
    expect(flatStyle(row()).outlineWidth).toBeUndefined();
  });
});
