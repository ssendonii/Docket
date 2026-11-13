import React, { useRef, useState } from "react";
import { AlertCircle, Clock, FileText, Loader2, Upload, X } from "lucide-react";
import { SAMPLE_DOCUMENTS } from "../utils/agendaUtils.ts";
import type { SampleDocument } from "../types.ts";

interface DocumentIntakePanelProps {
  inputMode: "upload" | "paste";
  onChangeInputMode: (mode: "upload" | "paste") => void;
  selectedFile: File | null;
  onSelectFile: (file: File | null) => void;
  rawText: string;
  onChangeRawText: (text: string) => void;
  sourceLabel: string;
  onChangeSourceLabel: (label: string) => void;
  totalMinutes: number;
  onChangeTotalMinutes: (minutes: number) => void;
  startTime: string;
  onChangeStartTime: (time: string) => void;
  meetingGoal: string;
  onChangeMeetingGoal: (goal: string) => void;
  isGenerating: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  onGenerate: () => void;
  inputFocusRef: React.RefObject<HTMLInputElement | null>;
}

const PRESET_DURATIONS = [15, 30, 45, 60, 90];

const ACCEPTED_EXTENSIONS =
  ".docx,.pdf,.md,.markdown,.txt,.csv,.tsv,.json,.html,.htm,.xml,.log,.yaml,.yml,.rtf,.rst";

export const DocumentIntakePanel: React.FC<DocumentIntakePanelProps> = ({
  inputMode,
  onChangeInputMode,
  selectedFile,
  onSelectFile,
  rawText,
  onChangeRawText,
  sourceLabel,
  onChangeSourceLabel,
  totalMinutes,
  onChangeTotalMinutes,
  startTime,
  onChangeStartTime,
  meetingGoal,
  onChangeMeetingGoal,
  isGenerating,
  errorMessage,
  onClearError,
  onGenerate,
  inputFocusRef,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChosen = (file: File | null) => {
    onClearError();
    if (!file) return;
    onSelectFile(file);
    onChangeSourceLabel(file.name);
    onChangeInputMode("upload");
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChosen(file);
    }
  };

  const handleLoadSample = (sample: SampleDocument) => {
    onClearError();
    onSelectFile(null);
    onChangeRawText(sample.content);
    onChangeSourceLabel(sample.fileName);
    onChangeTotalMinutes(sample.suggestedMinutes);
    onChangeInputMode("paste");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canSubmit =
    !isGenerating &&
    totalMinutes >= 5 &&
    totalMinutes <= 480 &&
    (Boolean(selectedFile) || rawText.trim().length > 0);

  return (
    <aside className="no-print w-full lg:w-[400px] xl:w-[420px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white">
      <div className="p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">
            Source Document &amp; Timing
          </h2>
          <p className="text-sm text-slate-500">
            Upload a DOCX, PDF, Markdown, or text file and set your meeting length.
          </p>
        </div>

        {/* Input Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              onChangeInputMode("upload");
              onClearError();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              inputMode === "upload"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => {
              onChangeInputMode("paste");
              onClearError();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              inputMode === "paste"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Paste Text
          </button>
        </div>

        {/* Upload or Paste Area */}
        {inputMode === "upload" ? (
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`border border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isDragging
                  ? "border-blue-600 bg-blue-50/50"
                  : selectedFile
                  ? "border-slate-300 bg-slate-50/70"
                  : "border-slate-300 hover:border-slate-400 bg-slate-50/40"
              }`}
            >
              <input
                ref={(el) => {
                  fileInputRef.current = el;
                  inputFocusRef.current = el;
                }}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="sr-only"
                onChange={(e) => handleFileChosen(e.target.files?.[0] ?? null)}
              />

              {selectedFile ? (
                <div className="flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {formatFileSize(selectedFile.size)}
                        <span aria-hidden="true"> · </span>
                        {(selectedFile.name.split(".").pop() || "FILE").toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove selected file"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <div className="w-9 h-9 mx-auto rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-slate-800">
                      Drop a document or browse
                    </p>
                    <p className="text-xs text-slate-500">
                      DOCX, PDF, Markdown, TXT, CSV, JSON up to 20 MB
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="source-label" className="text-xs font-medium text-slate-600">
                Document Title
              </label>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {rawText.length.toLocaleString()} chars
              </span>
            </div>
            <input
              id="source-label"
              type="text"
              value={sourceLabel}
              onChange={(e) => onChangeSourceLabel(e.target.value)}
              placeholder="e.g., Q4 Migration Brief.md"
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
            <textarea
              id="raw-doc-text"
              rows={7}
              value={rawText}
              onChange={(e) => {
                onChangeRawText(e.target.value);
                onClearError();
              }}
              placeholder="Paste meeting notes, project spec, RFC, or brief..."
              className="w-full px-3 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg resize-y leading-relaxed focus:outline-none focus:border-blue-600"
            />
          </div>
        )}

        {/* Quick Sample Briefs */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500">
            Try a sample document
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {SAMPLE_DOCUMENTS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleLoadSample(sample)}
                className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-800 group-hover:text-blue-700 truncate">
                    {sample.title}
                  </span>
                  <span className="text-xs text-slate-400 font-mono tabular-nums shrink-0">
                    {sample.suggestedMinutes}m
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {sample.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Duration & Start Time */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label
              htmlFor="total-minutes-input"
              className="text-sm font-medium text-slate-800"
            >
              Total Meeting Time
            </label>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              5–480 min
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_DURATIONS.map((mins) => {
              const active = totalMinutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => onChangeTotalMinutes(mins)}
                  className={`py-2 text-xs font-mono font-medium tabular-nums rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {mins}m
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="total-minutes-input"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Custom Minutes
              </label>
              <div className="relative">
                <input
                  id="total-minutes-input"
                  type="number"
                  min={5}
                  max={480}
                  value={totalMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onChangeTotalMinutes(Number.isNaN(val) ? 30 : Math.max(5, Math.min(480, val)));
                  }}
                  className="w-full pl-3 pr-10 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                  min
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="start-time-input"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Start Time
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="start-time-input"
                  type="time"
                  value={startTime}
                  onChange={(e) => onChangeStartTime(e.target.value || "09:00")}
                  className="w-full pl-8 pr-2.5 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Optional Focus / Goal */}
        <div className="space-y-1.5">
          <label
            htmlFor="meeting-goal-input"
            className="block text-sm font-medium text-slate-800"
          >
            Facilitator Focus <span className="text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="meeting-goal-input"
            type="text"
            value={meetingGoal}
            onChange={(e) => onChangeMeetingGoal(e.target.value)}
            placeholder="e.g., Resolve blockers and confirm launch sign-off"
            className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Error Display */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Primary CTA */}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onGenerate}
          className="w-full py-2.5 px-4 flex items-center justify-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Crafting Agenda…</span>
            </>
          ) : (
            <span>Craft Agenda</span>
          )}
        </button>
      </div>
    </aside>
  );
};
