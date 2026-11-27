/**
 * AncestryTreeView: Interactive genealogical ancestry tree for Animal Workspace (FamilyTab).
 * Mirrors the web app's interactive ancestry tree:
 * - Orthogonal SVG connector lines (Parents -> Self & Siblings -> Offspring)
 * - 2D Pan and Zoom controls (+, -, %, Reset, Fit View)
 * - Node cards with avatar, relation badge, gender icon, and farm name
 * - Tappable node cards to navigate to related cattle
 * - Strictly zero drop shadows (ADR-007 compliant).
 */
import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { PressableSurface } from '../../components/internal/PressableSurface.tsx';
import { Text } from '../../components/primitives/Text.tsx';
import type { MessageKey } from '../../i18n/messages.ts';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius, type ColorTokens } from '../../theme/tokens.ts';
import type { PedigreeData } from '../cattle-detail-model.ts';
import {
  MarsIcon,
  Maximize2Icon,
  RotateCcwIcon,
  VenusIcon,
  WarehouseIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../CattleIcons.tsx';

export interface AncestryTreeViewProps {
  pedigree: PedigreeData | null | undefined;
  onNavigateToAnimal?: (id: string) => void;
  onInnerScrollActiveChange?: (active: boolean) => void;
  testID?: string;
}

const CARD_WIDTH = 180;
const CARD_HEIGHT = 110;
const GAP_X = 20;
const LEVEL_HEIGHT = 140;
const PARENT_PAIR_GAP = 220;
const CANVAS_CENTER_X = 500;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.6;
const DEFAULT_ZOOM = 0.82;
const CANVAS_HEIGHT = 500;

interface InternalNode {
  key: string;
  id?: string | null;
  name?: string | null;
  tag?: string | null;
  relationLabel: string;
  relationType: 'mother' | 'father' | 'self' | 'daughter' | 'son' | 'sibling' | 'other';
  gender?: string | null;
  farmName?: string | null;
  x: number;
  y: number;
  highlight?: boolean;
}

export function AncestryTreeView({
  pedigree,
  onNavigateToAnimal,
  onInnerScrollActiveChange,
  testID = 'ancestry-tree-view',
}: AncestryTreeViewProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const patternId = useId();

  const [containerSize, setContainerSize] = useState({ width: 360, height: CANVAS_HEIGHT });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const dragStartPanRef = useRef({ x: 0, y: 0 });

  // 1. Calculate positions and connections
  const { nodes, lines, selfPos, bounds } = useMemo(() => {
    if (!pedigree) {
      return { nodes: [], lines: [], selfPos: { x: CANVAS_CENTER_X - CARD_WIDTH / 2, y: 160 }, bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 500 } };
    }

    const calculatedNodes: InternalNode[] = [];
    const calculatedLines: { id: string; d: string }[] = [];

    const yParents = 20;
    const ySelf = yParents + LEVEL_HEIGHT;
    const yOffspring = ySelf + LEVEL_HEIGHT;

    // --- Parents ---
    const motherX = CANVAS_CENTER_X - PARENT_PAIR_GAP / 2 - CARD_WIDTH / 2;
    const fatherX = CANVAS_CENTER_X + PARENT_PAIR_GAP / 2 - CARD_WIDTH / 2;

    calculatedNodes.push({
      key: 'dam',
      id: pedigree.dam?.id,
      name: pedigree.dam?.name,
      tag: pedigree.dam?.tag,
      relationLabel: t('cattle.workspace.family.mother'),
      relationType: 'mother',
      gender: 'FEMALE',
      farmName: pedigree.dam?.farm_name,
      x: motherX,
      y: yParents,
    });

    calculatedNodes.push({
      key: 'sire',
      id: pedigree.sire?.id,
      name: pedigree.sire?.name,
      tag: pedigree.sire?.tag,
      relationLabel: t('cattle.workspace.family.father'),
      relationType: 'father',
      gender: 'MALE',
      farmName: pedigree.sire?.farm_name,
      x: fatherX,
      y: yParents,
    });

    // --- Self & Siblings ---
    const siblings = pedigree.siblings ?? [];
    const totalRow = siblings.length + 1;
    const totalRowWidth = totalRow * CARD_WIDTH + (totalRow - 1) * GAP_X;
    const rowStartX = CANVAS_CENTER_X - totalRowWidth / 2;
    const selfIndex = Math.floor(siblings.length / 2);
    const selfX = rowStartX + selfIndex * (CARD_WIDTH + GAP_X);

    calculatedNodes.push({
      key: 'self',
      id: pedigree.self.id,
      name: pedigree.self.name,
      tag: pedigree.self.tag,
      relationLabel: t('cattle.workspace.family.self'),
      relationType: 'self',
      gender: pedigree.self.gender ?? 'FEMALE',
      farmName: pedigree.self.farm_name,
      x: selfX,
      y: ySelf,
      highlight: true,
    });

    let sIdx = 0;
    const siblingPositions: number[] = [];
    for (let i = 0; i < totalRow; i++) {
      if (i === selfIndex) continue;
      const s = siblings[sIdx];
      const sx = rowStartX + i * (CARD_WIDTH + GAP_X);
      calculatedNodes.push({
        key: `sib-${s.id ?? sIdx}`,
        id: s.id,
        name: s.name,
        tag: s.tag,
        relationLabel: t('cattle.workspace.family.fullSibling'),
        relationType: 'sibling',
        gender: s.gender,
        farmName: s.farm_name,
        x: sx,
        y: ySelf,
      });
      siblingPositions.push(sx);
      sIdx++;
    }

    // Connect Parents to Self & Siblings
    const motherBottomX = motherX + CARD_WIDTH / 2;
    const fatherBottomX = fatherX + CARD_WIDTH / 2;
    const parentsBottomY = yParents + CARD_HEIGHT;
    const parentsMidY = parentsBottomY + 15;
    const parentsDropY = ySelf - 15;

    let parentPath = `M ${motherBottomX} ${parentsBottomY} L ${motherBottomX} ${parentsMidY} L ${fatherBottomX} ${parentsMidY} L ${fatherBottomX} ${parentsBottomY} M ${CANVAS_CENTER_X} ${parentsMidY} L ${CANVAS_CENTER_X} ${parentsDropY}`;

    const selfAndSiblingsCenters = [selfX + CARD_WIDTH / 2, ...siblingPositions.map((x) => x + CARD_WIDTH / 2)];
    const minSelfSibX = Math.min(...selfAndSiblingsCenters);
    const maxSelfSibX = Math.max(...selfAndSiblingsCenters);

    parentPath += ` M ${minSelfSibX} ${parentsDropY} L ${maxSelfSibX} ${parentsDropY}`;
    for (const cx of selfAndSiblingsCenters) {
      parentPath += ` M ${cx} ${parentsDropY} L ${cx} ${ySelf}`;
    }

    calculatedLines.push({ id: 'parents-family-line', d: parentPath });

    // --- Offspring ---
    const offspring = pedigree.offspring ?? [];
    if (offspring.length > 0) {
      const totalOffWidth = offspring.length * CARD_WIDTH + (offspring.length - 1) * GAP_X;
      const selfCenterX = selfX + CARD_WIDTH / 2;
      const offStartX = selfCenterX - totalOffWidth / 2;

      const selfBottomY = ySelf + CARD_HEIGHT;
      const offMidY = selfBottomY + 15;

      let offPath = `M ${selfCenterX} ${selfBottomY} L ${selfCenterX} ${offMidY}`;
      const offCenters: number[] = [];

      offspring.forEach((child, idx) => {
        const cx = offStartX + idx * (CARD_WIDTH + GAP_X);
        const isDaughter = (child.gender || '').toUpperCase() === 'FEMALE';
        calculatedNodes.push({
          key: `child-${child.id}`,
          id: child.id,
          name: child.name,
          tag: child.tag,
          relationLabel: isDaughter ? t('cattle.workspace.family.daughter') : t('cattle.workspace.family.son'),
          relationType: isDaughter ? 'daughter' : 'son',
          gender: child.gender,
          farmName: child.farm_name,
          x: cx,
          y: yOffspring,
        });
        offCenters.push(cx + CARD_WIDTH / 2);
      });

      const minOffX = Math.min(...offCenters);
      const maxOffX = Math.max(...offCenters);
      offPath += ` M ${minOffX} ${offMidY} L ${maxOffX} ${offMidY}`;
      for (const cx of offCenters) {
        offPath += ` M ${cx} ${offMidY} L ${cx} ${yOffspring}`;
      }

      calculatedLines.push({ id: 'self-offspring-line', d: offPath });
    }

    // Bounds
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of calculatedNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x + CARD_WIDTH > maxX) maxX = n.x + CARD_WIDTH;
      if (n.y < minY) minY = n.y;
      if (n.y + CARD_HEIGHT > maxY) maxY = n.y + CARD_HEIGHT;
    }

    return {
      nodes: calculatedNodes,
      lines: calculatedLines,
      selfPos: { x: selfX, y: ySelf },
      bounds: { minX, maxX, minY, maxY },
    };
  }, [pedigree, t]);

  // Center on Self node on initial mount / layout
  const hasInitializedPan = useRef(false);
  const centerOnSelf = useCallback(
    (currentZoom = zoom) => {
      const selfCenterX = selfPos.x + CARD_WIDTH / 2;
      const selfCenterY = selfPos.y + CARD_HEIGHT / 2;
      setPan({
        x: containerSize.width / 2 - selfCenterX * currentZoom,
        y: containerSize.height / 2 - selfCenterY * currentZoom,
      });
    },
    [selfPos, containerSize, zoom]
  );

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.layout;
      if (width > 0 && height > 0) {
        setContainerSize({ width, height });
        if (!hasInitializedPan.current) {
          hasInitializedPan.current = true;
          const selfCenterX = selfPos.x + CARD_WIDTH / 2;
          const selfCenterY = selfPos.y + CARD_HEIGHT / 2;
          setPan({
            x: width / 2 - selfCenterX * DEFAULT_ZOOM,
            y: height / 2 - selfCenterY * DEFAULT_ZOOM,
          });
        }
      }
    },
    [selfPos]
  );

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => {
      const next = Math.min(MAX_ZOOM, +(prev + 0.15).toFixed(2));
      return next;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, +(prev - 0.15).toFixed(2));
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    centerOnSelf(DEFAULT_ZOOM);
  }, [centerOnSelf]);

  const handleFitView = useCallback(() => {
    const contentW = bounds.maxX - bounds.minX + 60;
    const contentH = bounds.maxY - bounds.minY + 60;
    const scaleX = containerSize.width / contentW;
    const scaleY = containerSize.height / contentH;
    const fitScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)));
    setZoom(+fitScale.toFixed(2));
    const contentCenterX = (bounds.minX + bounds.maxX) / 2;
    const contentCenterY = (bounds.minY + bounds.maxY) / 2;
    setPan({
      x: containerSize.width / 2 - contentCenterX * fitScale,
      y: containerSize.height / 2 - contentCenterY * fitScale,
    });
  }, [bounds, containerSize]);

  // Pan Responder for dragging canvas
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
        onPanResponderGrant: () => {
          onInnerScrollActiveChange?.(true);
          dragStartPanRef.current = { ...panRef.current };
        },
        onPanResponderMove: (_, gesture) => {
          setPan({
            x: dragStartPanRef.current.x + gesture.dx,
            y: dragStartPanRef.current.y + gesture.dy,
          });
        },
        onPanResponderRelease: () => {
          onInnerScrollActiveChange?.(false);
        },
        onPanResponderTerminate: () => {
          onInnerScrollActiveChange?.(false);
        },
      }),
    [onInnerScrollActiveChange]
  );

  return (
    <View testID={testID} style={{ gap: 8 }}>
      {/* ── Top Header Bar ── */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text role="caption" style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('cattle.workspace.family.treeView')}
        </Text>
        <Text role="caption" style={{ color: colors.mutedForeground, fontSize: 11 }}>
          ({t('cattle.workspace.family.panHint')})
        </Text>
      </View>

      {/* ── Canvas Viewport ── */}
      <View
        testID="ancestry-canvas-container"
        onLayout={handleLayout}
        {...panResponder.panHandlers}
        style={{
          height: CANVAS_HEIGHT,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Floating Zoom & View Controls Toolbar */}
        <View
          testID="ancestry-zoom-toolbar"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 30,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            padding: 2,
          }}
        >
          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            accessibilityLabel={t('cattle.workspace.family.zoomIn')}
            testID="zoom-in-btn"
            onPress={handleZoomIn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <ZoomInIcon size={16} color={colors.foreground} />
          </PressableSurface>

          <Text
            role="caption"
            testID="zoom-percentage-text"
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: '600',
              color: colors.mutedForeground,
              minWidth: 36,
              textAlign: 'center',
            }}
          >
            {Math.round(zoom * 100)}%
          </Text>

          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            accessibilityLabel={t('cattle.workspace.family.zoomOut')}
            testID="zoom-out-btn"
            onPress={handleZoomOut}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <ZoomOutIcon size={16} color={colors.foreground} />
          </PressableSurface>

          <View style={{ width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 2 }} />

          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            accessibilityLabel={t('cattle.workspace.family.resetZoom')}
            testID="zoom-reset-btn"
            onPress={handleResetZoom}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <RotateCcwIcon size={14} color={colors.foreground} />
          </PressableSurface>

          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            accessibilityLabel={t('cattle.workspace.family.fitView')}
            testID="zoom-fit-btn"
            onPress={handleFitView}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <Maximize2Icon size={14} color={colors.foreground} />
          </PressableSurface>
        </View>

        {/* Scaled & Panned Content Surface */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: zoom },
            ],
            transformOrigin: 'top left',
          }}
        >
          {/* SVG Dotted Grid Background & Connector Lines */}
          <Svg width={1400} height={800} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
              <Pattern
                id={`grid-pattern-${patternId}`}
                width={20}
                height={20}
                patternUnits="userSpaceOnUse"
              >
                <Circle cx={10} cy={10} r={1.2} fill={colors.border} />
              </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#grid-pattern-${patternId})`} />

            {/* Orthogonal Line Connections */}
            {lines.map((line) => (
              <Path
                key={line.id}
                d={line.d}
                stroke={colors.inputBorder}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>

          {/* Render Positioned Node Cards */}
          {nodes.map((node) => (
            <NodeCard
              key={node.key}
              node={node}
              colors={colors}
              t={t}
              onPress={node.id && onNavigateToAnimal ? () => onNavigateToAnimal(node.id!) : undefined}
            />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

interface NodeCardProps {
  node: InternalNode;
  colors: ColorTokens;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  onPress?: () => void;
}

function NodeCard({ node, colors, t, onPress }: NodeCardProps) {
  const isSelf = node.highlight || node.relationType === 'self';
  const isFemale = node.gender?.toUpperCase() === 'FEMALE' || node.relationType === 'mother' || node.relationType === 'daughter';
  const isMale = node.gender?.toUpperCase() === 'MALE' || node.relationType === 'father' || node.relationType === 'son';
  const isKnown = Boolean(node.id || node.name || node.tag);

  // Border & Accent Color
  const borderColor = isSelf
    ? colors.primary
    : isFemale
      ? colors.accentPink
      : isMale
        ? colors.info
        : colors.border;

  const borderWidth = isSelf ? 2 : 1;

  // Avatar tint
  const avatarBg = isSelf
    ? colors.successTint
    : isFemale
      ? colors.accentPinkTint
      : isMale
        ? colors.infoTint
        : colors.muted;

  const avatarTextColor = isSelf
    ? colors.success
    : isFemale
      ? colors.accentPink
      : isMale
        ? colors.info
        : colors.mutedForeground;

  const initial = isKnown
    ? (node.name || node.tag || '?').charAt(0).toUpperCase()
    : '?';

  const cardContent = (
    <View
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        padding: 10,
        borderRadius: radius.lg,
        borderWidth,
        borderColor,
        backgroundColor: colors.card,
        justifyContent: 'space-between',
      }}
    >
      {/* 1. Card Top: Avatar, Name & Tag, Relation Badge */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {/* Avatar Circle */}
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.full,
              backgroundColor: avatarBg,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor,
            }}
          >
            <Text role="caption" style={{ fontWeight: '700', fontSize: 13, color: avatarTextColor }}>
              {initial}
            </Text>
          </View>

          {/* Name & Tag */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text role="caption" style={{ fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
              {isKnown ? (node.name || node.tag) : t('cattle.workspace.family.unknownShort')}
            </Text>
            <Text
              role="caption"
              style={{
                fontSize: 10,
                color: colors.mutedForeground,
                fontFamily: 'monospace',
              }}
              numberOfLines={1}
            >
              {node.tag || '—'}
            </Text>
          </View>
        </View>

        {/* Relation Badge */}
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: radius.full,
            borderWidth: isSelf ? 0 : 1,
            borderColor,
            backgroundColor: isSelf
              ? colors.primary
              : isFemale
                ? colors.accentPinkTint
                : isMale
                  ? colors.infoTint
                  : colors.muted,
          }}
        >
          <Text
            role="caption"
            style={{
              fontSize: 9,
              fontWeight: '700',
              color: isSelf
                ? colors.primaryForeground
                : isFemale
                  ? colors.accentPink
                  : isMale
                    ? colors.info
                    : colors.mutedForeground,
            }}
          >
            {node.relationLabel}
          </Text>
        </View>
      </View>

      {/* 2. Divider */}
      <View style={{ height: 1, backgroundColor: colors.border }} />

      {/* 3. Card Bottom: Gender & Farm */}
      <View style={{ gap: 3 }}>
        {/* Gender row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {isFemale ? (
              <VenusIcon size={12} color={colors.accentPink} />
            ) : isMale ? (
              <MarsIcon size={12} color={colors.info} />
            ) : null}
            <Text role="caption" style={{ fontSize: 10, color: colors.mutedForeground }}>
              {t('cattle.workspace.family.gender')}
            </Text>
          </View>
          <Text role="caption" style={{ fontSize: 10, fontWeight: '600' }}>
            {isFemale ? t('cattle.gender.female') : isMale ? t('cattle.gender.male') : '—'}
          </Text>
        </View>

        {/* Farm row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <WarehouseIcon size={12} color={colors.mutedForeground} />
            <Text role="caption" style={{ fontSize: 10, color: colors.mutedForeground }}>
              {t('cattle.workspace.family.farm')}
            </Text>
          </View>
          <Text
            role="caption"
            style={{ fontSize: 10, fontWeight: '600', maxWidth: 90 }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {node.farmName || '—'}
          </Text>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <View
        testID={`node-${node.key}`}
        style={{
          position: 'absolute',
          left: node.x,
          top: node.y,
        }}
      >
        <PressableSurface
          accessibilityRole="button"
          pressedStyle="overlay"
          onPress={onPress}
          testID={`pressable-node-${node.key}`}
        >
          {cardContent}
        </PressableSurface>
      </View>
    );
  }

  return (
    <View
      testID={`node-${node.key}`}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
      }}
    >
      {cardContent}
    </View>
  );
}
