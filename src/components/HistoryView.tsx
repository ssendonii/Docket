import React from "react";
import { Trash2 } from "lucide-react";
import type { MeetingAgenda } from "../types.ts";

interface HistoryViewProps {
  savedAgendas: MeetingAgenda[];
  activeAgendaId: string | null;
  onOpenAgenda: (agenda: MeetingAgenda) => void;
  onDeleteAgenda: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  savedAgendas,
  activeAgendaId,
  onOpenAgenda,
  onDeleteAgenda,
}) => {
  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-200 space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Saved Agendas</h1>
        <p className="text-sm text-slate-500">
          Previously crafted agendas stored locally in this browser.
        </p>
      </div>

      {savedAgendas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <p className="text-sm font-medium text-slate-800">No saved agendas yet</p>
          <p className="text-xs text-slate-500">
            Craft your first meeting agenda from any document and it will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {savedAgendas.map((item) => {
            const isCurrent = item.id === activeAgendaId;
            const totalActions = item.sections.reduce((acc, s) => acc + s.actionItems.length, 0);
            const totalMins = item.sections.reduce((acc, s) => acc + s.durationMinutes, 0);

            return (
              <div
                key={item.id}
                className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900 truncate">
                      {item.meetingTitle}
                    </h2>
                    {isCurrent && (
                      <span className="text-xs font-medium text-blue-700 shrink-0">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{item.sourceFileName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{totalMins} min</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{item.sections.length} topics</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{totalActions} action items</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenAgenda(item)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${item.meetingTitle}`}
                    onClick={() => onDeleteAgenda(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
