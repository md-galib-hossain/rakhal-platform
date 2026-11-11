import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { expectNoFixedTextHeight, expectTouchTarget, findNodes, flatStyle } from '../../test-utils/touch-target.ts';
import { messages } from '../../i18n/messages.ts';
import { allColors, fontFamily } from '../../theme/tokens.ts';
import { EmptyState, ErrorState } from './StateMessage.tsx';
import { ERROR_KINDS, errorCopy } from './state-message-style.ts';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const HIDDEN = { includeHiddenElements: true } as const;
const box = () => screen.getByTestId('s');
const noop = () => {};
const LONG_BN = 'এখনও কোনো গাভী যোগ করা হয়নি, একটি গাভী যোগ করুন এবং দুধের হিসাব শুরু করুন';

describe('EmptyState', () => {
  it('renders title, description and one action; not an alert; disc glyph hidden', async () => {
    const onPress = jest.fn();
    await mount(<EmptyState testID="s" title="No animals yet" description="Add an animal to begin." action={{ label: 'Add animal', onPress }} />);
    expect(screen.getByText('No animals yet')).toBeTruthy();
    expect(screen.getByText('Add an animal to begin.')).toBeTruthy();
    expect(box().props.accessibilityRole).toBeUndefined();
    expect(box().props.accessibilityLiveRegion).toBeUndefined();
    expect(screen.queryByTestId('glyph-info')).toBeNull();
    expect(screen.getByTestId('glyph-info', HIDDEN)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add animal' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the given icon; no action means no button; description is optional', async () => {
    await mount(<EmptyState testID="s" title="Nothing here" icon="plus" />);
    expect(screen.getByTestId('glyph-plus', HIDDEN)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('action button is 56dp, secondary variant is honoured', async () => {
    const { colors } = await mount(<EmptyState testID="s" title="T" action={{ label: 'Go', onPress: noop, variant: 'secondary' }} />);
    const button = screen.getByTestId('state-action');
    expectTouchTarget(button, 56);
    expect(flatStyle(button).backgroundColor).toBe(colors.secondary);
  });

  it.each(['light', 'dark'] as const)('disc is secondary with a secondaryForeground glyph; text tokens (%s)', async (scheme) => {
    const c = allColors[scheme];
    await mount(<EmptyState testID="s" title="T" description="D" />, { scheme });
    expect(flatStyle(screen.getByTestId('state-disc', HIDDEN))).toMatchObject({ width: 48, height: 48, backgroundColor: c.secondary });
    expect(flatStyle(screen.getByText('T')).color).toBe(c.foreground);
    expect(flatStyle(screen.getByText('D')).color).toBe(c.mutedForeground);
  });

  it('layout: centred column, 24/32 padding, 12 gap, grows to fill a ScrollView', async () => {
    await mount(<EmptyState testID="s" title="T" />);
    expect(flatStyle(box())).toMatchObject({
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 32,
      gap: 12,
    });
  });

  it('bn: a long title wraps (no numberOfLines, no fixed text height) in the Bengali family; 200% scale too', async () => {
    await mount(<EmptyState testID="s" title={LONG_BN} description={LONG_BN} action={{ label: LONG_BN, onPress: noop }} />, {
      locale: 'bn',
      fontScale: 2,
    });
    for (const t of findNodes(box(), (n) => n.type === 'Text')) expect(t.props.numberOfLines).toBeUndefined();
    expectNoFixedTextHeight(box());
    expect(flatStyle(screen.getAllByText(LONG_BN)[0]!).fontFamily).toBe(fontFamily.bengali.semibold);
    expectTouchTarget(screen.getByTestId('state-action'), 56);
  });
});

describe('ErrorState', () => {
  it('is an alert with a polite live region; disc is destructiveTint with an exclamation in destructiveText', async () => {
    const { colors } = await mount(<ErrorState testID="s" />);
    expect(box().props.accessibilityRole).toBe('alert');
    expect(box().props.accessibilityLiveRegion).toBe('polite');
    expect(flatStyle(screen.getByTestId('state-disc', HIDDEN)).backgroundColor).toBe(colors.destructiveTint);
    expect(screen.getByTestId('glyph-exclamation', HIDDEN)).toBeTruthy();
  });

  it.each(ERROR_KINDS)('kind %s renders its default title and message in en', async (kind) => {
    const copy = errorCopy(kind);
    await mount(<ErrorState kind={kind} />);
    expect(screen.getByText(messages.en[copy.titleKey])).toBeTruthy();
    expect(screen.getByText(messages.en[copy.messageKey])).toBeTruthy();
  });

  it.each(ERROR_KINDS)('kind %s renders its default title and message in bn', async (kind) => {
    const copy = errorCopy(kind);
    await mount(<ErrorState kind={kind} />, { locale: 'bn' });
    expect(screen.getByText(messages.bn[copy.titleKey])).toBeTruthy();
    expect(screen.getByText(messages.bn[copy.messageKey])).toBeTruthy();
  });

  it('defaults to the generic kind; title and message overrides win', async () => {
    const view = await mount(<ErrorState />);
    expect(screen.getByText(messages.en['state.error.generic.title'])).toBeTruthy();
    view.unmount();
    await mount(<ErrorState kind="network" title="Custom title" message="Custom message" />);
    expect(screen.getByText('Custom title')).toBeTruthy();
    expect(screen.getByText('Custom message')).toBeTruthy();
    expect(screen.queryByText(messages.en['state.error.network.title'])).toBeNull();
  });

  it('onRetry renders the primary 56dp "Try again" button (locale string) and calls it', async () => {
    const onRetry = jest.fn();
    const { colors } = await mount(<ErrorState onRetry={onRetry} />);
    const button = screen.getByRole('button', { name: messages.en['common.retry'] });
    expectTouchTarget(button, 56);
    expect(flatStyle(button).backgroundColor).toBe(colors.primary);
    await fireEvent.press(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('retry label is Bangla in bn', async () => {
    await mount(<ErrorState onRetry={noop} />, { locale: 'bn' });
    expect(screen.getByRole('button', { name: messages.bn['common.retry'] })).toBeTruthy();
  });

  it('retrying: the retry button is busy and ignores presses', async () => {
    const onRetry = jest.fn();
    await mount(<ErrorState onRetry={onRetry} retrying />);
    const button = screen.getByTestId('state-action');
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await fireEvent.press(button);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('action replaces retry (only one button), and retrying does not make it busy', async () => {
    const onRetry = jest.fn();
    const onPress = jest.fn();
    await mount(<ErrorState kind="session" onRetry={onRetry} retrying action={{ label: 'Sign in', onPress }} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText(messages.en['common.retry'])).toBeNull();
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button.props.accessibilityState).toMatchObject({ busy: false });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('no onRetry and no action: no button', async () => {
    await mount(<ErrorState kind="server" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('staleNote renders in the label role above the action', async () => {
    await mount(<ErrorState testID="s" onRetry={noop} staleNote="Showing data saved at 10:30" />);
    const note = screen.getByTestId('state-stale-note');
    expect(note).toBeTruthy();
    const children = box().children.filter((c) => typeof c === 'object');
    const order = children.map((c) => (c as { props: { testID?: string } }).props.testID);
    expect(order.indexOf('state-stale-note')).toBeLessThan(order.indexOf('state-action'));
  });

  it.each(['light', 'dark'] as const)('text tokens (%s)', async (scheme) => {
    const c = allColors[scheme];
    await mount(<ErrorState kind="network" />, { scheme });
    expect(flatStyle(screen.getByText(messages.en['state.error.network.title'])).color).toBe(c.foreground);
    expect(flatStyle(screen.getByText(messages.en['state.error.network.message'])).color).toBe(c.mutedForeground);
  });
});
