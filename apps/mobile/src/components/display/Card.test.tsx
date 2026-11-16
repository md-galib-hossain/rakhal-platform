import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { flatStyle } from '../../test-utils/touch-target.ts';
import { allColors, radius } from '../../theme/tokens.ts';
import { Card } from './Card.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const card = () => screen.getByTestId('c');

describe('Card', () => {
  it.each(['light', 'dark'] as const)('resolves card / border tokens and radius.lg, with no shadow or elevation (%s)', async (scheme) => {
    await mount(<Card testID="c"><Text>x</Text></Card>, { scheme });
    const style = flatStyle(card());
    expect(style).toMatchObject({
      backgroundColor: allColors[scheme].card,
      borderColor: allColors[scheme].border,
      borderWidth: 1,
      borderRadius: radius.lg,
    });
    // ADR-007: separation comes from the border and the fill, never from a shadow.
    for (const key of ['shadowColor', 'shadowOpacity', 'shadowRadius', 'shadowOffset', 'elevation']) {
      expect(style).not.toHaveProperty(key);
    }
  });

  it.each([
    ['none', 0],
    ['md', 12],
    ['lg', 16],
  ] as const)('padding %s = %s', async (padding, expected) => {
    await mount(<Card testID="c" padding={padding}><Text>x</Text></Card>);
    expect(flatStyle(card()).padding).toBe(expected);
  });

  it('defaults to padding md (12)', async () => {
    await mount(<Card testID="c"><Text>x</Text></Card>);
    expect(flatStyle(card()).padding).toBe(12);
  });

  it('is not an accessibility node without a label, and groups children with one', async () => {
    await mount(<Card testID="c"><Text>x</Text></Card>);
    expect(card().props.accessible).toBe(false);
    await mount(<Card testID="c2" accessibilityLabel="Milk summary"><Text>x</Text></Card>);
    expect(screen.getByTestId('c2').props.accessible).toBe(true);
    expect(screen.getByTestId('c2').props.accessibilityLabel).toBe('Milk summary');
  });

  it('merges a caller style after its own and adds no interactive behaviour', async () => {
    await mount(<Card testID="c" style={{ marginTop: 8 }}><Text>x</Text></Card>);
    expect(flatStyle(card()).marginTop).toBe(8);
    expect(card().props.onPress).toBeUndefined();
    expect(card().props.accessibilityRole).toBeUndefined();
  });
});
