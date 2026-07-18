import React, { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, X } from "lucide-react";

export interface InsightFactor {
  label: string;
  value: string;
  sentiment: "positive" | "neutral" | "negative";
}

export interface InsightPanelProps {
  title: string;
  summary: string;
  factors?: InsightFactor[];
  riskNote?: string;
  variant?: "default" | "warning" | "success" | "info";
  collapsible?: boolean;
  defaultOpen?: boolean;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
}

const variantConfig = {
  default: {
    border: "border-teal-500/30",
    bg: "bg-teal-950/40",
    iconBg: "bg-teal-500/20",
    iconColor: "text-teal-400",
    titleColor: "text-teal-300",
    headerBg: "bg-teal-900/30",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-950/40",
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-400",
    titleColor: "text-amber-300",
    headerBg: "bg-amber-900/30",
  },
  success: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-950/40",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
    titleColor: "text-emerald-300",
    headerBg: "bg-emerald-900/30",
  },
  info: {
    border: "border-blue-500/30",
    bg: "bg-blue-950/40",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    titleColor: "text-blue-300",
    headerBg: "bg-blue-900/30",
  },
};

const sentimentConfig = {
  positive: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    border: "border-emerald-500/20",
    icon: TrendingUp,
  },
  neutral: {
    bg: "bg-slate-500/15",
    text: "text-slate-300",
    border: "border-slate-500/20",
    icon: Info,
  },
  negative: {
    bg: "bg-red-500/15",
    text: "text-red-300",
    border: "border-red-500/20",
    icon: TrendingDown,
  },
};

export function InsightPanel({
  title,
  summary,
  factors,
  riskNote,
  variant = "default",
  collapsible = false,
  defaultOpen = true,
  onDismiss,
  className = "",
  compact = false,
}: InsightPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const cfg = variantConfig[variant];

  return (
    <div
      className={`rounded-xl border ${cfg.border} ${cfg.bg} backdrop-blur-sm overflow-hidden transition-all duration-300 ${className}`}
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)" }}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${cfg.headerBg} ${collapsible ? "cursor-pointer select-none" : ""}`}
        onClick={collapsible ? () => setIsOpen(!isOpen) : undefined}
      >
        <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${cfg.iconBg} flex items-center justify-center`}>
          <Sparkles className={`w-4 h-4 ${cfg.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-semibold ${cfg.titleColor} tracking-wide`}>{title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {collapsible && (
            <button className={`${cfg.iconColor} opacity-60 hover:opacity-100 transition-opacity`}>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          {onDismiss && (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div className={`${compact ? "px-4 py-3" : "px-4 py-4"} space-y-3`}>
          {/* Summary */}
          <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>

          {/* Factors */}
          {factors && factors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {factors.map((factor, i) => {
                const scfg = sentimentConfig[factor.sentiment];
                const Icon = scfg.icon;
                return (
                  <div
                    key={i}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${scfg.bg} ${scfg.text} ${scfg.border}`}
                  >
                    <Icon className="w-3 h-3 flex-shrink-0" />
                    <span className="text-slate-400">{factor.label}:</span>
                    <span>{factor.value}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Risk note */}
          {riskNote && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/80 leading-relaxed">{riskNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tooltip variant (hover-triggered) ───────────────────────────────────────

interface InsightTooltipProps {
  title: string;
  summary: string;
  factors?: InsightFactor[];
  riskNote?: string;
  variant?: "default" | "warning" | "success" | "info";
  children: React.ReactNode;
}

export function InsightTooltip({ title, summary, factors, riskNote, variant = "default", children }: InsightTooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72"
          style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.5))" }}
        >
          <InsightPanel
            title={title}
            summary={summary}
            factors={factors}
            riskNote={riskNote}
            variant={variant}
            compact
          />
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-teal-500/30" />
        </div>
      )}
    </div>
  );
}

// ─── Modal variant (click-triggered) ─────────────────────────────────────────

interface InsightModalProps {
  title: string;
  summary: string;
  factors?: InsightFactor[];
  riskNote?: string;
  variant?: "default" | "warning" | "success" | "info";
  trigger: React.ReactNode;
}

export function InsightModal({ title, summary, factors, riskNote, variant = "default", trigger }: InsightModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span className="cursor-pointer" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <InsightPanel
              title={title}
              summary={summary}
              factors={factors}
              riskNote={riskNote}
              variant={variant}
              onDismiss={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Inline expandable variant ────────────────────────────────────────────────

interface InsightExpandableProps {
  title: string;
  summary: string;
  factors?: InsightFactor[];
  riskNote?: string;
  variant?: "default" | "warning" | "success" | "info";
  triggerLabel?: string;
  className?: string;
  defaultOpen?: boolean;
}

export function InsightExpandable({
  title,
  summary,
  factors,
  riskNote,
  variant = "default",
  triggerLabel = "KI-Begründung anzeigen",
  className = "",
  defaultOpen = false,
}: InsightExpandableProps) {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = variantConfig[variant];

  return (
    <div className={className}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.titleColor} hover:opacity-80 transition-opacity`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        {open ? "Begründung ausblenden" : triggerLabel}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2">
          <InsightPanel
            title={title}
            summary={summary}
            factors={factors}
            riskNote={riskNote}
            variant={variant}
            compact
          />
        </div>
      )}
    </div>
  );
}
