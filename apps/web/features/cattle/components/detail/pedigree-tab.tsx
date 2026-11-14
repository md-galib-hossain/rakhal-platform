"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Baby,
  Boxes,
  Building2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Maximize2,
  Plus,
  RotateCcw,
  Sparkles,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@rakhal/ui/ui/avatar";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { FamilyCards } from "./family-cards";
import { EmptyState } from "@/components/shared/empty-state";
import { useCattleDetailModal } from "../../context/cattle-detail-modal-context";
import { avatarTint } from "../../avatar-tint";
import { useCattlePedigree } from "../../hooks/use-cattle-detail-tabs";
import { cattleApi } from "../../api";
import type {
  CattlePedigree,
  PedigreeNode,
  PedigreeOffspring,
  PedigreeSibling,
} from "../../detail-types";

const CARD_WIDTH = 210;
const CARD_HEIGHT = 130;
const GAP_X = 32;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2;

interface PositionedNode {
  key: string;
  node: PedigreeNode | PedigreeOffspring | PedigreeSibling | null;
  relationLabel: string;
  genderBadge?: "FEMALE" | "MALE" | "CASTRATED_MALE";
  x: number;
  y: number;
  highlight?: boolean;
  canExpandAncestors?: boolean;
  canExpandOffspring?: boolean;
  isExpandedAncestors?: boolean;
  isExpandedOffspring?: boolean;
}

interface SvgLine {
  id: string;
  d: string;
  dashed?: boolean;
  colorClass?: string;
}

function NodeCard({
  node,
  relationLabel,
  genderBadge,
  highlight = false,
  canExpandAncestors = false,
  canExpandOffspring = false,
  isLoadingMore = false,
  onExpandAncestors,
  onExpandOffspring,
}: {
  node: PedigreeNode | PedigreeOffspring | PedigreeSibling | null;
  relationLabel: string;
  genderBadge?: "FEMALE" | "MALE" | "CASTRATED_MALE";
  highlight?: boolean;
  canExpandAncestors?: boolean;
  canExpandOffspring?: boolean;
  isLoadingMore?: boolean;
  onExpandAncestors?: () => void;
  onExpandOffspring?: () => void;
}) {
  const t = useTranslations("cattle.detail.pedigree");
  const { openCattleDetail } = useCattleDetailModal();
  const label = node?.name ?? node?.tag ?? "?";
  const isClickable = Boolean(node?.id);
  const gender = genderBadge ?? (node?.gender?.toUpperCase() as "FEMALE" | "MALE" | "CASTRATED_MALE" | undefined);

  const isFemale = gender === "FEMALE";
  const isMale = gender === "MALE" || gender === "CASTRATED_MALE";

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={(e) => {
        if (node?.id) {
          e.stopPropagation();
          openCattleDetail(node.id);
        }
      }}
      onKeyDown={(e) => {
        // Only the card itself, not a control inside it.
        if (e.target !== e.currentTarget) return;
        if (node?.id && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          e.stopPropagation();
          openCattleDetail(node.id);
        }
      }}
      className={cn(
        "group relative flex w-[210px] shrink-0 flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs transition-all select-none",
        highlight
          ? "border-primary ring-2 ring-primary/40 shadow-md bg-primary/5"
          : isFemale
            ? "border-pink-500/30 hover:border-pink-500/60 dark:border-pink-500/20"
            : isMale
              ? "border-sky-500/30 hover:border-sky-500/60 dark:border-sky-500/20"
              : "border-border",
        isClickable ? "cursor-pointer hover:shadow-md" : "opacity-85",
      )}
    >
      {/* Top Expansion Button (Ancestors) */}
      {canExpandAncestors && (
        <button
          type="button"
          title={t("expandAncestors")}
          onClick={(e) => {
            e.stopPropagation();
            onExpandAncestors?.();
          }}
          disabled={isLoadingMore}
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex size-5.5 items-center justify-center rounded-full border border-border bg-card shadow-xs text-muted-foreground transition-all hover:scale-110 hover:border-primary hover:text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {isLoadingMore ? (
            <Loader2 className="size-3 animate-spin text-primary" />
          ) : (
            <ChevronUp className="size-3" />
          )}
        </button>
      )}

      {/* Card Header: Avatar, Name, Tag & Relation Badge */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Avatar
            className={cn(
              "size-8 shrink-0 rounded-full ring-2 transition-all",
              highlight
                ? "ring-primary"
                : isFemale
                  ? "ring-pink-500/40"
                  : isMale
                    ? "ring-sky-500/40"
                    : "ring-border",
            )}
          >
            <AvatarFallback className={cn("rounded-full text-xs font-bold", avatarTint(node?.id ?? relationLabel))}>
              {label.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <p className={cn("truncate text-xs font-bold text-foreground", isClickable && "group-hover:underline")}>
              {node?.id ? (node.name ?? node.tag) : t("unknown")}
            </p>
            <p className="truncate text-xs text-muted-foreground font-mono">{node?.tag ?? "—"}</p>
          </div>
        </div>

        <Badge
          variant={highlight ? "default" : "outline"}
          className={cn(
            "text-xs px-1.5 py-0 h-4 shrink-0 font-medium",
            highlight
              ? "bg-primary text-primary-foreground font-semibold"
              : isFemale
                ? "border-pink-500/30 text-pink-700 dark:text-pink-300 bg-pink-500/10"
                : isMale
                  ? "border-sky-500/30 text-sky-700 dark:text-sky-300 bg-sky-500/10"
                  : "text-muted-foreground",
          )}
        >
          {relationLabel}
        </Badge>
      </div>

      {/* Card Body: Gender & Farm */}
      <div className="flex flex-col gap-1 border-t border-border/80 pt-1.5 text-xs">
        <div className="flex items-center justify-between gap-1 text-muted-foreground">
          <span className="flex items-center gap-1 text-[10.5px]">
            <span
              className={cn(
                "text-xs font-bold",
                isFemale ? "text-pink-600 dark:text-pink-400" : isMale ? "text-sky-600 dark:text-sky-400" : "",
              )}
            >
              {isFemale ? "♀" : isMale ? "♂" : "♀/♂"}
            </span>
            {t("gender")}
          </span>
          <span className="font-semibold text-foreground text-[10.5px]">
            {gender ? t(`genderOptions.${gender}`) : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-1 text-muted-foreground">
          <span className="flex items-center gap-1 text-[10.5px]">
            <Building2 className="size-3" aria-hidden />
            {t("farm")}
          </span>
          <span
            className="font-semibold text-foreground truncate max-w-[105px] text-right text-[10.5px]"
            title={node?.farm_name ?? undefined}
          >
            {node?.farm_name || "—"}
          </span>
        </div>
      </div>

      {/* Bottom Expansion Button (Offspring) */}
      {canExpandOffspring && (
        <button
          type="button"
          title={t("expandChildren")}
          onClick={(e) => {
            e.stopPropagation();
            onExpandOffspring?.();
          }}
          disabled={isLoadingMore}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 flex size-5.5 items-center justify-center rounded-full border border-border bg-card shadow-xs text-muted-foreground transition-all hover:scale-110 hover:border-primary hover:text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {isLoadingMore ? (
            <Loader2 className="size-3 animate-spin text-primary" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Interactive Ancestry Tree Tab — renders an orthogonal genealogical tree
 * with Top: Ancestors, Middle-Top: Parents, Middle: Target Animal (Self) & Siblings,
 * Bottom: Offspring (Children).
 *
 * Includes mouse-wheel zoom isolation (prevents parent modal scrolling), pan controls,
 * and on-demand ancestor/descendant expansion.
 */
export function PedigreeTab({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.pedigree");
  const query = useCattlePedigree(cattleId);

  // State (not a ref) so the wheel / resize effects re-run once the canvas mounts: it renders only after the
  // pedigree has loaded, so a mount-time `useEffect(..., [])` would see `null` and never attach.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [view, setView] = useState({ zoom: 0.85, x: 0, y: 0 });
  const zoom = view.zoom;
  const pan = useMemo(() => ({ x: view.x, y: view.y }), [view.x, view.y]);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // On-demand expanded tree nodes state
  const [expandedAncestors, setExpandedAncestors] = useState<Record<string, CattlePedigree>>({});
  const [expandedOffspring, setExpandedOffspring] = useState<Record<string, PedigreeOffspring[]>>({});
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({});
  const [exhaustedNodes, setExhaustedNodes] = useState<Record<string, boolean>>({});

  const data = query.data;

  /** Zoom to `next(zoom)` keeping the point (cx, cy) — in container pixels — fixed under the cursor. */
  const zoomAt = useCallback((next: (z: number) => number, cx: number, cy: number) => {
    setView((v) => {
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next(v.zoom)));
      if (nz === v.zoom) return v;
      const k = nz / v.zoom;
      return { zoom: nz, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, []);

  // Wheel zoom handler attached natively with passive: false so preventDefault stops the modal/page scrolling.
  useEffect(() => {
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = container.getBoundingClientRect();
      // deltaMode 1 = lines (Firefox mouse wheels); normalise to pixels. ctrl+wheel (trackpad pinch) is sent with small deltas, so boost it.
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015));
      zoomAt((z) => z * factor, e.clientX - rect.left, e.clientY - rect.top);
    };

    container.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => container.removeEventListener("wheel", handleWheelNative);
  }, [container, zoomAt]);

  // On-demand ancestor expander
  const handleExpandAncestors = useCallback(async (ancestorId: string) => {
    if (!ancestorId || loadingNodes[ancestorId] || exhaustedNodes[ancestorId]) return;
    setLoadingNodes((prev) => ({ ...prev, [ancestorId]: true }));
    try {
      const res = await cattleApi.pedigree(ancestorId);
      if (!res.dam && !res.sire) {
        setExhaustedNodes((prev) => ({ ...prev, [ancestorId]: true }));
      } else {
        setExpandedAncestors((prev) => ({ ...prev, [ancestorId]: res }));
      }
    } catch {
      setExhaustedNodes((prev) => ({ ...prev, [ancestorId]: true }));
    } finally {
      setLoadingNodes((prev) => ({ ...prev, [ancestorId]: false }));
    }
  }, [loadingNodes, exhaustedNodes]);

  // On-demand offspring expander
  const handleExpandOffspring = useCallback(async (offspringId: string) => {
    if (!offspringId || loadingNodes[offspringId] || exhaustedNodes[offspringId]) return;
    setLoadingNodes((prev) => ({ ...prev, [offspringId]: true }));
    try {
      const res = await cattleApi.pedigree(offspringId);
      if (!res.offspring || res.offspring.length === 0) {
        setExhaustedNodes((prev) => ({ ...prev, [offspringId]: true }));
      } else {
        setExpandedOffspring((prev) => ({ ...prev, [offspringId]: res.offspring }));
      }
    } catch {
      setExhaustedNodes((prev) => ({ ...prev, [offspringId]: true }));
    } finally {
      setLoadingNodes((prev) => ({ ...prev, [offspringId]: false }));
    }
  }, [loadingNodes, exhaustedNodes]);

  // Calculate tree positions and orthogonal SVG connection paths
  const { positionedNodes, lines, bounds, content } = useMemo(() => {
    if (!data) {
      return {
        positionedNodes: [],
        lines: [],
        content: { minX: 0, maxX: 800, minY: 0, maxY: 500 },
        bounds: { minX: 0, maxX: 800, minY: 0, maxY: 500 },
      };
    }

    const nodes: PositionedNode[] = [];
    const svgLines: SvgLine[] = [];

    // Grandparents
    const maternalGrandmother = data.dam?.dam ?? null;
    const maternalGrandfather = data.dam?.sire ?? null;
    const paternalGrandmother = data.sire?.dam ?? null;
    const paternalGrandfather = data.sire?.sire ?? null;

    const hasGrandparents = Boolean(
      maternalGrandmother || maternalGrandfather || paternalGrandmother || paternalGrandfather,
    );

    // Levels Y coordinates
    const LEVEL_HEIGHT = 180;
    const yGrandparents = 20;
    const yParents = hasGrandparents ? yGrandparents + LEVEL_HEIGHT : 20;
    const ySelf = yParents + LEVEL_HEIGHT;
    const yOffspring = ySelf + LEVEL_HEIGHT;

    // Spacing between node pairs
    const PARENT_PAIR_GAP = 320;
    const GP_PAIR_GAP = 24;

    const centerX = 650;

    // ── Parents X positions ─────────────────────────────
    const motherX = centerX - PARENT_PAIR_GAP / 2 - CARD_WIDTH / 2;
    const fatherX = centerX + PARENT_PAIR_GAP / 2 - CARD_WIDTH / 2;

    // ── Grandparents X positions ────────────────────────
    const mgmX = motherX - CARD_WIDTH / 2 - GP_PAIR_GAP / 2;
    const mgfX = motherX + CARD_WIDTH / 2 + GP_PAIR_GAP / 2;
    const pgmX = fatherX - CARD_WIDTH / 2 - GP_PAIR_GAP / 2;
    const pgfX = fatherX + CARD_WIDTH / 2 + GP_PAIR_GAP / 2;

    // 1. Position Grandparents
    if (hasGrandparents) {
      // Maternal Grandparents
      if (maternalGrandmother || maternalGrandfather) {
        nodes.push({
          key: "mgm",
          node: maternalGrandmother,
          relationLabel: t("maternalGrandmother"),
          genderBadge: "FEMALE",
          x: mgmX,
          y: yGrandparents,
          canExpandAncestors: Boolean(maternalGrandmother?.id && !exhaustedNodes[maternalGrandmother.id]),
        });
        nodes.push({
          key: "mgf",
          node: maternalGrandfather,
          relationLabel: t("maternalGrandfather"),
          genderBadge: "MALE",
          x: mgfX,
          y: yGrandparents,
          canExpandAncestors: Boolean(maternalGrandfather?.id && !exhaustedNodes[maternalGrandfather.id]),
        });

        const mgmBottomX = mgmX + CARD_WIDTH / 2;
        const mgfBottomX = mgfX + CARD_WIDTH / 2;
        const mgBottomY = yGrandparents + CARD_HEIGHT;
        const mgMidY = mgBottomY + 20;
        const motherTopX = motherX + CARD_WIDTH / 2;
        const motherTopY = yParents;

        svgLines.push({
          id: "line-mg",
          d: `M ${mgmBottomX} ${mgBottomY} L ${mgmBottomX} ${mgMidY} L ${mgfBottomX} ${mgMidY} L ${mgfBottomX} ${mgBottomY} M ${motherTopX} ${mgMidY} L ${motherTopX} ${motherTopY}`,
        });
      }

      // Paternal Grandparents
      if (paternalGrandmother || paternalGrandfather) {
        nodes.push({
          key: "pgm",
          node: paternalGrandmother,
          relationLabel: t("paternalGrandmother"),
          genderBadge: "FEMALE",
          x: pgmX,
          y: yGrandparents,
          canExpandAncestors: Boolean(paternalGrandmother?.id && !exhaustedNodes[paternalGrandmother.id]),
        });
        nodes.push({
          key: "pgf",
          node: paternalGrandfather,
          relationLabel: t("paternalGrandfather"),
          genderBadge: "MALE",
          x: pgfX,
          y: yGrandparents,
          canExpandAncestors: Boolean(paternalGrandfather?.id && !exhaustedNodes[paternalGrandfather.id]),
        });

        const pgmBottomX = pgmX + CARD_WIDTH / 2;
        const pgfBottomX = pgfX + CARD_WIDTH / 2;
        const pgBottomY = yGrandparents + CARD_HEIGHT;
        const pgMidY = pgBottomY + 20;
        const fatherTopX = fatherX + CARD_WIDTH / 2;
        const fatherTopY = yParents;

        svgLines.push({
          id: "line-pg",
          d: `M ${pgmBottomX} ${pgBottomY} L ${pgmBottomX} ${pgMidY} L ${pgfBottomX} ${pgMidY} L ${pgfBottomX} ${pgBottomY} M ${fatherTopX} ${pgMidY} L ${fatherTopX} ${fatherTopY}`,
        });
      }
    }

    // 2. Position Parents
    nodes.push({
      key: "dam",
      node: data.dam,
      relationLabel: t("mother"),
      genderBadge: "FEMALE",
      x: motherX,
      y: yParents,
      canExpandAncestors: Boolean(data.dam?.id && !hasGrandparents && !exhaustedNodes[data.dam.id]),
    });
    nodes.push({
      key: "sire",
      node: data.sire,
      relationLabel: t("father"),
      genderBadge: "MALE",
      x: fatherX,
      y: yParents,
      canExpandAncestors: Boolean(data.sire?.id && !hasGrandparents && !exhaustedNodes[data.sire.id]),
    });

    // 3. Position Self & Siblings on Level 2
    const siblings = data.siblings ?? [];
    const totalSiblingsAndSelf = siblings.length + 1;
    const totalRowWidth = totalSiblingsAndSelf * CARD_WIDTH + (totalSiblingsAndSelf - 1) * GAP_X;
    const rowStartX = centerX - totalRowWidth / 2;

    // We place Self in the center of the siblings
    const selfIndex = Math.floor(siblings.length / 2);
    const selfX = rowStartX + selfIndex * (CARD_WIDTH + GAP_X);

    // Add Self node
    nodes.push({
      key: "self",
      node: data.self,
      relationLabel: t("self"),
      x: selfX,
      y: ySelf,
      highlight: true,
      canExpandOffspring: Boolean(data.self?.id && (!data.offspring || data.offspring.length === 0) && !exhaustedNodes[data.self.id]),
    });

    // Add Sibling nodes
    let siblingIdx = 0;
    const siblingPositions: { x: number; isFull: boolean }[] = [];
    for (let i = 0; i < totalSiblingsAndSelf; i++) {
      if (i === selfIndex) continue;
      const s = siblings[siblingIdx];
      const sx = rowStartX + i * (CARD_WIDTH + GAP_X);
      const isFull = s.relation === "full_sibling";
      nodes.push({
        key: `sibling-${s.id ?? siblingIdx}`,
        node: s,
        relationLabel: t(isFull ? "fullSibling" : "halfSibling"),
        x: sx,
        y: ySelf,
      });
      siblingPositions.push({ x: sx, isFull });
      siblingIdx++;
    }

    // Connect Parents to Self & Siblings
    const motherBottomX = motherX + CARD_WIDTH / 2;
    const fatherBottomX = fatherX + CARD_WIDTH / 2;
    const parentsBottomY = yParents + CARD_HEIGHT;
    const parentsMidY = parentsBottomY + 22;
    const parentsDropY = ySelf - 22;

    // Couple line between mother and father
    let parentTreePath = `M ${motherBottomX} ${parentsBottomY} L ${motherBottomX} ${parentsMidY} L ${fatherBottomX} ${parentsMidY} L ${fatherBottomX} ${parentsBottomY} M ${centerX} ${parentsMidY} L ${centerX} ${parentsDropY}`;

    // Bus connecting to Self and Full Siblings
    const dropNodesX = [selfX + CARD_WIDTH / 2, ...siblingPositions.map((sp) => sp.x + CARD_WIDTH / 2)];
    const minDropX = Math.min(...dropNodesX);
    const maxDropX = Math.max(...dropNodesX);

    parentTreePath += ` M ${minDropX} ${parentsDropY} L ${maxDropX} ${parentsDropY}`;

    // Drop vertical line into Self
    const selfTopX = selfX + CARD_WIDTH / 2;
    parentTreePath += ` M ${selfTopX} ${parentsDropY} L ${selfTopX} ${ySelf}`;

    // Drop vertical line into each sibling
    for (const sp of siblingPositions) {
      const sTopX = sp.x + CARD_WIDTH / 2;
      parentTreePath += ` M ${sTopX} ${parentsDropY} L ${sTopX} ${ySelf}`;
    }

    svgLines.push({
      id: "line-parents-family",
      d: parentTreePath,
    });

    // 4. Position Offspring on Level 3
    const offspring = data.offspring ?? [];
    if (offspring.length > 0) {
      const totalOffspringWidth = offspring.length * CARD_WIDTH + (offspring.length - 1) * GAP_X;
      const offspringStartX = selfX + CARD_WIDTH / 2 - totalOffspringWidth / 2;

      const selfBottomX = selfX + CARD_WIDTH / 2;
      const selfBottomY = ySelf + CARD_HEIGHT;
      const offspringMidY = selfBottomY + 22;

      let offspringTreePath = `M ${selfBottomX} ${selfBottomY} L ${selfBottomX} ${offspringMidY}`;

      const offspringDropXs: number[] = [];

      offspring.forEach((o: PedigreeOffspring, index: number) => {
        const ox = offspringStartX + index * (CARD_WIDTH + GAP_X);
        const oCenterX = ox + CARD_WIDTH / 2;
        offspringDropXs.push(oCenterX);

        const isDaughter = o.gender?.toUpperCase() === "FEMALE";
        const relationLabel = isDaughter ? t("daughter") : t("son");

        nodes.push({
          key: `offspring-${o.id}`,
          node: o,
          relationLabel,
          genderBadge: o.gender?.toUpperCase() as "FEMALE" | "MALE" | "CASTRATED_MALE",
          x: ox,
          y: yOffspring,
          canExpandOffspring: Boolean(o.id && !exhaustedNodes[o.id]),
        });
      });

      const minOffX = Math.min(...offspringDropXs);
      const maxOffX = Math.max(...offspringDropXs);

      offspringTreePath += ` M ${minOffX} ${offspringMidY} L ${maxOffX} ${offspringMidY}`;
      for (const ox of offspringDropXs) {
        offspringTreePath += ` M ${ox} ${offspringMidY} L ${ox} ${yOffspring}`;
      }

      svgLines.push({
        id: "line-self-offspring",
        d: offspringTreePath,
      });
    }

    // Calculate canvas bounds
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x + CARD_WIDTH > maxX) maxX = n.x + CARD_WIDTH;
      if (n.y < minY) minY = n.y;
      if (n.y + CARD_HEIGHT > maxY) maxY = n.y + CARD_HEIGHT;
    }

    return {
      positionedNodes: nodes,
      lines: svgLines,
      // Tight box around the cards (expansion buttons overhang ~12px): what "center" and "fit" work from.
      content: { minX, maxX, minY: minY - 12, maxY: maxY + 12 },
      bounds: {
        minX: Math.min(minX - 40, 0),
        maxX: Math.max(maxX + 40, 1000),
        minY: Math.min(minY - 20, 0),
        maxY: Math.max(maxY + 40, 600),
      },
    };
  }, [data, t, exhaustedNodes]);

  // Center & Fit View
  const fitView = useCallback(() => {
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw === 0 || ch === 0) return; // not laid out yet (hidden tab / modal animating): the ResizeObserver retries

    const w = content.maxX - content.minX;
    const h = content.maxY - content.minY;
    const pad = 32;
    const scale = Math.min(1.05, Math.max(MIN_ZOOM, Math.min((cw - pad * 2) / w, (ch - pad * 2) / h)));
    const targetZoom = Math.round(scale * 100) / 100;

    // Centre the content box in the viewport on both axes.
    setView({
      zoom: targetZoom,
      x: Math.round((cw - w * targetZoom) / 2 - content.minX * targetZoom),
      y: Math.round((ch - h * targetZoom) / 2 - content.minY * targetZoom),
    });
  }, [container, content]);

  // Centre on first open (and when the pedigree changes), and again whenever the canvas is resized
  // (modal open animation, window resize, breakpoint change). Observing also fires once on attach.
  const fitRef = useRef(fitView);
  useEffect(() => {
    fitRef.current = fitView;
  }, [fitView]);
  useEffect(() => {
    if (!container || !data) return;
    fitRef.current();
    const observer = new ResizeObserver(() => fitRef.current());
    observer.observe(container);
    return () => observer.disconnect();
  }, [container, data]);

  const zoomIn = () => zoomAt((z) => z + 0.15, (container?.clientWidth ?? 0) / 2, (container?.clientHeight ?? 0) / 2);
  const zoomOut = () => zoomAt((z) => z - 0.15, (container?.clientWidth ?? 0) / 2, (container?.clientHeight ?? 0) / 2);
  const resetZoom = () => fitView();

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setView((v) => ({ ...v, x: panStartRef.current.x + dx, y: panStartRef.current.y + dy }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile/tablet pinch & drag
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...pan };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    setView((v) => ({ ...v, x: panStartRef.current.x + dx, y: panStartRef.current.y + dy }));
  };

  if (query.isLoading) return <CardSkeleton lines={6} />;
  if (query.isError) {
    return <ErrorState description={t("error")} onRetry={() => query.refetch()} />;
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <FamilyCards data={data} />
      {/* ── Interactive Ancestry Tree Canvas ─────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("treeView")}</h3>
            <span className="text-xs text-muted-foreground">({t("panHint")})</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1 px-2 py-0.5">
              <Sparkles className="size-3 text-primary" />
              {t("self")} + {data.siblings?.length ?? 0} {t("selfAndSiblings").toLowerCase()}
            </Badge>
          </div>
        </div>

        <div
          ref={setContainer}
          role="presentation"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          className={cn(
            "relative h-[min(560px,60vh)] min-h-[320px] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-colors",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
          style={{
            backgroundImage: "radial-gradient(var(--border) 1.5px, transparent 1.5px)",
            backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {/* Floating Zoom & View Controls */}
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1 rounded-xl border border-border bg-card/90 p-1 backdrop-blur-sm shadow-md">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-foreground hover:bg-muted"
              onClick={zoomIn}
              title={t("zoomIn")}
            >
              <ZoomIn className="size-4" />
            </Button>
            <span className="px-1 text-xs font-mono font-medium text-muted-foreground min-w-[3.2rem] text-center select-none">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-foreground hover:bg-muted"
              onClick={zoomOut}
              title={t("zoomOut")}
            >
              <ZoomOut className="size-4" />
            </Button>
            <div className="h-4 w-px bg-border mx-0.5" />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-foreground hover:bg-muted"
              onClick={resetZoom}
              title={t("resetZoom")}
            >
              <RotateCcw className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-foreground hover:bg-muted"
              onClick={fitView}
              title={t("fitView")}
            >
              <Maximize2 className="size-3.5" />
            </Button>
          </div>

          {/* Canvas Transform Layer */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              transition: isDragging ? "none" : "transform 0.12s cubic-bezier(0.2, 0, 0, 1)",
            }}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          >
            {/* SVG Connection Lines */}
            <svg
              className="absolute top-0 left-0 overflow-visible pointer-events-none"
              style={{ width: bounds.maxX + 400, height: bounds.maxY + 400 }}
            >
              <defs>
                <filter id="line-shadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.1" />
                </filter>
              </defs>
              {lines.map((line) => (
                <path
                  key={line.id}
                  d={line.d}
                  fill="none"
                  stroke="currentColor"
                  className="text-border dark:text-muted-foreground/40 transition-all"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={line.dashed ? "4 4" : undefined}
                />
              ))}
            </svg>

            {/* Positioned Node Cards */}
            <div className="relative pointer-events-auto">
              {positionedNodes.map((pn) => (
                <div
                  key={pn.key}
                  style={{
                    position: "absolute",
                    left: `${pn.x}px`,
                    top: `${pn.y}px`,
                  }}
                >
                  <NodeCard
                    node={pn.node}
                    relationLabel={pn.relationLabel}
                    genderBadge={pn.genderBadge}
                    highlight={pn.highlight}
                    canExpandAncestors={pn.canExpandAncestors}
                    canExpandOffspring={pn.canExpandOffspring}
                    isLoadingMore={pn.node?.id ? Boolean(loadingNodes[pn.node.id]) : false}
                    onExpandAncestors={() => pn.node?.id && handleExpandAncestors(pn.node.id)}
                    onExpandOffspring={() => pn.node?.id && handleExpandOffspring(pn.node.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
