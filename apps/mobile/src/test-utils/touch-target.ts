/**
 * Touch-target "layout intent" assertions (spec section 4). Jest has no Yoga, so these assert the STYLE a control
 * declares; the real layout is verified on the emulator (uiautomator dump). Test-only helpers.
 */
import { StyleSheet } from 'react-native';

/** Structural subset of a rendered host element (RNTL / test-renderer). */
export interface StyledNode {
  type: unknown;
  props: Record<string, unknown>;
  children: readonly unknown[];
}

type Flat = Record<string, unknown>;

export function flatStyle(node: StyledNode): Flat {
  return (StyleSheet.flatten(node.props.style as never) ?? {}) as Flat;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

export interface TargetOptions {
  /** Also require an explicit minWidth/width (square controls such as IconButton). Default: width is only checked when declared. */
  requireWidth?: boolean;
}

/**
 * The element must declare `minHeight` (or `height`) >= target; a declared `minWidth`/`width` must be >= target too.
 * Any declared `height` below the target fails, even when a larger `minHeight` is also present.
 */
export function expectTouchTarget(node: StyledNode, target: 48 | 56, options: TargetOptions = {}): void {
  const s = flatStyle(node);
  const height = num(s.height);
  const minHeight = num(s.minHeight);
  const width = num(s.width);
  const minWidth = num(s.minWidth);
  const fail = (why: string) => {
    throw new Error(`Touch target ${target}dp not met: ${why} (style: ${JSON.stringify(s)})`);
  };
  if (height === undefined && minHeight === undefined) fail('no minHeight or height declared');
  if (height !== undefined && height < target) fail(`height ${height} is below the target`);
  if (minHeight !== undefined && minHeight < target) fail(`minHeight ${minHeight} is below the target`);
  if (options.requireWidth && width === undefined && minWidth === undefined) fail('no minWidth or width declared');
  if (width !== undefined && width < target) fail(`width ${width} is below the target`);
  if (minWidth !== undefined && minWidth < target) fail(`minWidth ${minWidth} is below the target`);
}

function isNode(value: unknown): value is StyledNode {
  return typeof value === 'object' && value !== null && 'props' in value && 'children' in value;
}

function walk(node: StyledNode, visit: (n: StyledNode) => void): void {
  visit(node);
  for (const child of node.children) if (isNode(child)) walk(child, visit);
}

/**
 * No element in the subtree that is a text node, or directly holds one, may declare a fixed `height`
 * (WP2 risk 8: Bangla ascenders and font scale clip fixed-height text holders). Use minHeight.
 */
export function expectNoFixedTextHeight(root: StyledNode): void {
  const offenders: string[] = [];
  walk(root, (n) => {
    const holdsText = n.type === 'Text' || n.children.some((c) => isNode(c) && c.type === 'Text');
    if (holdsText && num(flatStyle(n).height) !== undefined) offenders.push(`${String(n.type)} height=${String(flatStyle(n).height)}`);
  });
  if (offenders.length > 0) throw new Error(`Fixed height on a text holder: ${offenders.join(', ')}`);
}

/** Collect every host node in the subtree matching `predicate` (for tests that need nested elements). */
export function findNodes(root: StyledNode, predicate: (n: StyledNode) => boolean): StyledNode[] {
  const out: StyledNode[] = [];
  walk(root, (n) => {
    if (predicate(n)) out.push(n);
  });
  return out;
}
