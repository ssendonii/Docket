import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Pencil,
  Plus,
  Printer,
  Scale,
  Trash2,
  X,
} from "lucide-react";
import type {
  ActionItem,
  ActionPriority,
  AgendaSection,
  MeetingAgenda,
  SectionPurpose,
} from "../types.ts";
import {
  agendaToMarkdown,
  computeTimeline,
  formatCharCount,
  rebalanceSectionsToTarget,
} from "../utils/agendaUtils.ts";
import { exportAgendaToPdf } from "../utils/pdfExport.ts";

interface AgendaViewProps {
  agenda: MeetingAgenda | null;
  isGenerating: boolean;
  pendingTargetMinutes: number;
  onUpdateAgenda: (updated: MeetingAgenda) => void;
  onLoadSampleQuick: () => void;
}

const PURPOSES: SectionPurpose[] = ["Align", "Decide", "Review", "Brainstorm", "Update"];
const PRIORITIES: ActionPriority[] = ["High", "Medium", "Low"];

const SEGMENT_SHADES = [
  "bg-slate-900 text-white",
  "bg-blue-600 text-white",
  "bg-slate-700 text-white",
  "bg-blue-500 text-white",
  "bg-slate-500 text-white",
  "bg-slate-800 text-white",
];

export const AgendaView: React.FC<AgendaViewProps> = ({
  agenda,
  isGenerating,
  pendingTargetMinutes,
  onUpdateAgenda,
  onLoadSampleQuick,
}) => {
  const [copied, setCopied] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [newTaskDrafts, setNewTaskDrafts] = useState<
    Record<string, { task: string; owner: string; priority: ActionPriority; dueContext: string }>
  >({});

  if (isGenerating) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
        <div className="space-y-3 pb-6 border-b border-slate-200 animate-pulse">
          <div className="h-4 w-48 bg-slate-200 rounded" />
          <div className="h-8 w-3/4 bg-slate-200 rounded" />
          <div className="h-4 w-full bg-slate-100 rounded" />
          <div className="h-4 w-2/3 bg-slate-100 rounded" />
        </div>
        <div className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="p-6 bg-white border border-slate-200 rounded-xl space-y-3 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-1/2 bg-slate-200 rounded" />
              <div className="h-5 w-20 bg-slate-100 rounded" />
            </div>
            <div className="h-4 w-full bg-slate-100 rounded" />
            <div className="h-4 w-5/6 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!agenda) {
    return (
      <div className="p-8 lg:p-16 max-w-3xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-xl p-8 lg:p-10 space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium text-blue-700 tracking-wide">
              Document-to-Agenda Workspace
            </p>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight text-balance">
              Turn any document into a time-boxed meeting agenda
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              Upload a Word document (.docx), PDF, Markdown file, or plain-text brief on the left,
              specify your total meeting duration, and Docket will structure every topic with
              concise summaries, assigned stakeholders, and concrete action items.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">01. Topic Summaries</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Synthesizes dense briefs into clear discussion points grounded in your source file.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">02. Exact Time-Boxing</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Allocates minutes proportionally to decision weight and rebalances on demand.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">03. Owners &amp; Actions</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Maps topic leads, participants, and prioritized follow-up tasks automatically.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onLoadSampleQuick}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Load Sample Brief
            </button>
            <span className="text-xs text-slate-500">
              or drop a file into the panel on the left
            </span>
          </div>
        </div>
      </div>
    );
  }

  const timings = computeTimeline(agenda.sections, agenda.startTime);
  const totalAllocated = agenda.sections.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalActionItems = agenda.sections.reduce((sum, s) => sum + s.actionItems.length, 0);
  const delta = totalAllocated - agenda.targetDurationMinutes;
  const isTargetSyncedWithRail = pendingTargetMinutes === agenda.targetDurationMinutes;

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(agendaToMarkdown(agenda));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleDownloadMarkdown = () => {
    const md = agendaToMarkdown(agenda);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = agenda.meetingTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    a.href = url;
    a.download = `${slug || "meeting-agenda"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const filename = exportAgendaToPdf(agenda);
    setPdfToast(filename);
    setTimeout(() => {
      setPdfToast((current) => (current === filename ? null : current));
    }, 5000);

    if (typeof window !== "undefined" && window.self === window.top) {
      window.print();
    }
  };

  const handleRebalance = (targetMins: number) => {
    const rebalanced = rebalanceSectionsToTarget(agenda.sections, targetMins);
    onUpdateAgenda({
      ...agenda,
      targetDurationMinutes: targetMins,
      sections: rebalanced,
    });
  };

  const updateSection = (sectionId: string, patch: Partial<AgendaSection>) => {
    onUpdateAgenda({
      ...agenda,
      sections: agenda.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= agenda.sections.length) return;
    const copy = [...agenda.sections];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    onUpdateAgenda({ ...agenda, sections: copy });
  };

  const deleteSection = (sectionId: string) => {
    if (agenda.sections.length <= 1) return;
    onUpdateAgenda({
      ...agenda,
      sections: agenda.sections.filter((s) => s.id !== sectionId),
    });
  };

  const addSection = () => {
    const newId = `sec_${Date.now().toString(36)}`;
    const newSec: AgendaSection = {
      id: newId,
      title: "New Discussion Topic",
      durationMinutes: 5,
      purpose: "Align",
      summary: "Outline key context, open questions, and desired outcomes for this topic.",
      keyPoints: ["Clarify scope and open dependencies"],
      leadStakeholder: agenda.stakeholders[0]?.name || "Facilitator",
      participants: [],
      actionItems: [],
    };
    onUpdateAgenda({
      ...agenda,
      sections: [...agenda.sections, newSec],
    });
    setEditingSectionId(newId);
  };

  const toggleActionItem = (sectionId: string, actionId: string) => {
    onUpdateAgenda({
      ...agenda,
      sections: agenda.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              actionItems: s.actionItems.map((a) =>
                a.id === actionId ? { ...a, completed: !a.completed } : a
              ),
            }
          : s
      ),
    });
  };

  const removeActionItem = (sectionId: string, actionId: string) => {
    onUpdateAgenda({
      ...agenda,
      sections: agenda.sections.map((s) =>
        s.id === sectionId
          ? { ...s, actionItems: s.actionItems.filter((a) => a.id !== actionId) }
          : s
      ),
    });
  };

  const addActionItemToSection = (sectionId: string) => {
    const draft = newTaskDrafts[sectionId];
    if (!draft || !draft.task.trim()) return;
    const newItem: ActionItem = {
      id: `act_${Date.now().toString(36)}`,
      task: draft.task.trim(),
      owner: draft.owner.trim() || "Unassigned",
      priority: draft.priority || "Medium",
      dueContext: draft.dueContext.trim() || "Follow-up",
      completed: false,
    };
    onUpdateAgenda({
      ...agenda,
      sections: agenda.sections.map((s) =>
        s.id === sectionId ? { ...s, actionItems: [...s.actionItems, newItem] } : s
      ),
    });
    setNewTaskDrafts((prev) => ({
      ...prev,
      [sectionId]: { task: "", owner: "", priority: "Medium", dueContext: "" },
    }));
  };

  const priorityTextClass = (priority: ActionPriority) => {
    if (priority === "High") return "text-red-700 font-semibold";
    if (priority === "Medium") return "text-amber-700 font-medium";
    return "text-slate-500 font-medium";
  };

  return (
    <div className="print-sheet p-6 lg:p-10 max-w-4xl mx-auto space-y-8">
      {/* Executive Header */}
      <section className="space-y-4 pb-6 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Source: {agenda.sourceFileName}</span>
          <span aria-hidden="true">·</span>
          <span>{agenda.sourceFileType}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {formatCharCount(agenda.sourceCharCount, agenda.sourceFileType)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{agenda.sections.length} topics</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{totalActionItems} action items</span>
        </div>

        <input
          type="text"
          aria-label="Meeting title"
          value={agenda.meetingTitle}
          onChange={(e) => onUpdateAgenda({ ...agenda, meetingTitle: e.target.value })}
          className="w-full text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
        />

        <p className="text-base text-slate-700 leading-relaxed max-w-3xl">
          {agenda.meetingObjective}
        </p>

        {agenda.documentSummary && (
          <div className="pt-2 text-sm text-slate-600 leading-relaxed max-w-3xl">
            <span className="font-semibold text-slate-800">Document Brief: </span>
            {agenda.documentSummary}
          </div>
        )}
      </section>

      {/* Timing Allocation & Export Bar */}
      <section className="no-print flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {delta === 0 ? (
            <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-mono tabular-nums">
                {totalAllocated} / {agenda.targetDurationMinutes} min
              </span>
              <span>On target</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-mono tabular-nums">
                {totalAllocated} / {agenda.targetDurationMinutes} min (
                {delta > 0 ? `+${delta}m over` : `${Math.abs(delta)}m under`})
              </span>
              <button
                type="button"
                onClick={() => handleRebalance(agenda.targetDurationMinutes)}
                className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-900 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Fit to {agenda.targetDurationMinutes}m</span>
              </button>
            </div>
          )}

          {!isTargetSyncedWithRail && (
            <button
              type="button"
              onClick={() => handleRebalance(pendingTargetMinutes)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Rebalance to {pendingTargetMinutes}m</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Markdown"}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .md</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>

          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Topic</span>
          </button>
        </div>
      </section>

      {pdfToast && (
        <div
          role="status"
          className="no-print flex items-center justify-between gap-3 px-4 py-2.5 text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">
              Downloaded formatted PDF report: <strong className="font-mono">{pdfToast}</strong>
            </span>
          </div>
          <button
            type="button"
            aria-label="Dismiss PDF confirmation"
            onClick={() => setPdfToast(null)}
            className="p-1 text-emerald-700 hover:text-emerald-900 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Proportional Time-Box Timeline Strip */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium text-slate-700">Meeting Time Distribution</span>
          <span className="font-mono tabular-nums">
            {timings[0]?.clockRange.split("–")[0]} –{" "}
            {timings[timings.length - 1]?.clockRange.split("–")[1]} ({totalAllocated} min)
          </span>
        </div>

        <div className="flex w-full h-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
          {agenda.sections.map((sec, idx) => {
            const pct = totalAllocated > 0 ? (sec.durationMinutes / totalAllocated) * 100 : 0;
            const shade = SEGMENT_SHADES[idx % SEGMENT_SHADES.length];
            return (
              <a
                key={sec.id}
                href={`#section-${sec.id}`}
                title={`${String(idx + 1).padStart(2, "0")}. ${sec.title} (${sec.durationMinutes} min)`}
                style={{ width: `${pct}%` }}
                className={`${shade} flex items-center justify-center px-1.5 text-xs font-mono tabular-nums border-r border-white/20 last:border-r-0 hover:opacity-90 transition-opacity truncate`}
              >
                {pct >= 9 ? `${String(idx + 1).padStart(2, "0")} · ${sec.durationMinutes}m` : ""}
              </a>
            );
          })}
        </div>
      </section>

      {/* Agenda Sections List */}
      <section className="space-y-4">
        {agenda.sections.map((sec, idx) => {
          const timing = timings[idx];
          const isEditing = editingSectionId === sec.id;
          const draft = newTaskDrafts[sec.id] || {
            task: "",
            owner: "",
            priority: "Medium" as ActionPriority,
            dueContext: "",
          };

          return (
            <article
              key={sec.id}
              id={`section-${sec.id}`}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 scroll-mt-24"
            >
              {/* Section Header Row */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <span className="font-mono tabular-nums text-sm font-semibold text-slate-400 pt-0.5 shrink-0">
                    {String(idx + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono tabular-nums text-slate-700 font-medium">
                        {timing?.clockRange}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        +{timing?.relativeRange}
                      </span>
                      <span aria-hidden="true">·</span>
                      <select
                        aria-label={`Purpose for ${sec.title}`}
                        value={sec.purpose}
                        onChange={(e) =>
                          updateSection(sec.id, { purpose: e.target.value as SectionPurpose })
                        }
                        className="text-xs font-medium text-blue-700 bg-transparent border-0 p-0 cursor-pointer focus:outline-none"
                      >
                        {PURPOSES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isEditing ? (
                      <input
                        type="text"
                        value={sec.title}
                        onChange={(e) => updateSection(sec.id, { title: e.target.value })}
                        className="w-full text-lg font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:border-blue-600"
                      />
                    ) : (
                      <h3 className="text-lg font-semibold text-slate-900 leading-snug">
                        {sec.title}
                      </h3>
                    )}
                  </div>
                </div>

                {/* Duration & Section Controls */}
                <div className="no-print flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    <button
                      type="button"
                      aria-label={`Decrease duration for ${sec.title}`}
                      onClick={() =>
                        updateSection(sec.id, {
                          durationMinutes: Math.max(1, sec.durationMinutes - 1),
                        })
                      }
                      className="px-2 py-1 text-xs font-mono text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      aria-label={`Duration in minutes for ${sec.title}`}
                      min={1}
                      max={240}
                      value={sec.durationMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        updateSection(sec.id, {
                          durationMinutes: Number.isNaN(val) ? 1 : Math.max(1, Math.min(240, val)),
                        });
                      }}
                      className="w-11 py-1 text-center text-xs font-mono font-semibold tabular-nums text-slate-900 bg-white border-x border-slate-200 focus:outline-none"
                    />
                    <span className="px-1.5 text-xs text-slate-400 font-mono bg-white">m</span>
                    <button
                      type="button"
                      aria-label={`Increase duration for ${sec.title}`}
                      onClick={() =>
                        updateSection(sec.id, {
                          durationMinutes: Math.min(240, sec.durationMinutes + 1),
                        })
                      }
                      className="px-2 py-1 text-xs font-mono text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer border-l border-slate-200"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label={isEditing ? "Done editing topic" : "Edit topic"}
                    onClick={() => setEditingSectionId(isEditing ? null : sec.id)}
                    className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                      isEditing
                        ? "bg-blue-600 text-white border-blue-600"
                        : "text-slate-500 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {isEditing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    aria-label="Move topic up"
                    disabled={idx === 0}
                    onClick={() => moveSection(idx, -1)}
                    className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move topic down"
                    disabled={idx === agenda.sections.length - 1}
                    onClick={() => moveSection(idx, 1)}
                    className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete topic"
                    disabled={agenda.sections.length <= 1}
                    onClick={() => deleteSection(sec.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Print-only duration */}
                <span className="hidden print:inline font-mono tabular-nums text-sm font-semibold text-slate-800">
                  {sec.durationMinutes} min
                </span>
              </div>

              {/* Topic Summary */}
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Topic Summary
                    </label>
                    <textarea
                      rows={3}
                      value={sec.summary}
                      onChange={(e) => updateSection(sec.id, { summary: e.target.value })}
                      className="w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Lead Stakeholder
                      </label>
                      <input
                        type="text"
                        value={sec.leadStakeholder}
                        onChange={(e) => updateSection(sec.id, { leadStakeholder: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Participants (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={sec.participants.join(", ")}
                        onChange={(e) =>
                          updateSection(sec.id, {
                            participants: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full px-3 py-1.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Discussion Points (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={sec.keyPoints.join("\n")}
                      onChange={(e) =>
                        updateSection(sec.id, {
                          keyPoints: e.target.value
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700 leading-relaxed">{sec.summary}</p>

                  {sec.keyPoints.length > 0 && (
                    <ul className="space-y-1.5 pl-4 list-disc marker:text-slate-300 text-sm text-slate-600">
                      {sec.keyPoints.map((pt, kpIdx) => (
                        <li key={kpIdx} className="leading-relaxed">
                          {pt}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Stakeholders line (zero-pill unboxed typography) */}
                  <div className="pt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>
                      <strong className="font-semibold text-slate-700">Lead:</strong>{" "}
                      {sec.leadStakeholder}
                    </span>
                    {sec.participants.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          <strong className="font-semibold text-slate-700">Participants:</strong>{" "}
                          {sec.participants.join(", ")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Section Action Items */}
              {(sec.actionItems.length > 0 || isEditing) && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Action Items ({sec.actionItems.length})
                  </p>

                  <div className="divide-y divide-slate-100">
                    {sec.actionItems.map((act) => (
                      <div
                        key={act.id}
                        className="py-2 flex items-start justify-between gap-3 text-sm"
                      >
                        <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={act.completed}
                            onChange={() => toggleActionItem(sec.id, act.id)}
                            className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <span
                              className={
                                act.completed ? "line-through text-slate-400" : "text-slate-800"
                              }
                            >
                              {act.task}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <span>Owner: {act.owner}</span>
                              <span aria-hidden="true">·</span>
                              <span className={priorityTextClass(act.priority)}>
                                {act.priority} priority
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{act.dueContext}</span>
                            </div>
                          </div>
                        </label>

                        {isEditing && (
                          <button
                            type="button"
                            aria-label="Remove action item"
                            onClick={() => removeActionItem(sec.id, act.id)}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isEditing && (
                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input
                        type="text"
                        placeholder="New action item..."
                        value={draft.task}
                        onChange={(e) =>
                          setNewTaskDrafts((prev) => ({
                            ...prev,
                            [sec.id]: { ...draft, task: e.target.value },
                          }))
                        }
                        className="sm:col-span-5 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                      />
                      <input
                        type="text"
                        placeholder="Owner"
                        value={draft.owner}
                        onChange={(e) =>
                          setNewTaskDrafts((prev) => ({
                            ...prev,
                            [sec.id]: { ...draft, owner: e.target.value },
                          }))
                        }
                        className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                      />
                      <select
                        value={draft.priority}
                        onChange={(e) =>
                          setNewTaskDrafts((prev) => ({
                            ...prev,
                            [sec.id]: { ...draft, priority: e.target.value as ActionPriority },
                          }))
                        }
                        className="sm:col-span-2 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Due context"
                        value={draft.dueContext}
                        onChange={(e) =>
                          setNewTaskDrafts((prev) => ({
                            ...prev,
                            [sec.id]: { ...draft, dueContext: e.target.value },
                          }))
                        }
                        className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => addActionItemToSection(sec.id)}
                        className="sm:col-span-1 px-2 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
};
