import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ActionPriority, MeetingAgenda } from "../types.ts";

interface ActionItemsViewProps {
  agenda: MeetingAgenda;
  onUpdateAgenda: (updated: MeetingAgenda) => void;
}

export const ActionItemsView: React.FC<ActionItemsViewProps> = ({
  agenda,
  onUpdateAgenda,
}) => {
  const [priorityFilter, setPriorityFilter] = useState<"All" | ActionPriority>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Open" | "Done">("All");
  const [query, setQuery] = useState("");

  const allItems = useMemo(() => {
    const rows: Array<{
      sectionId: string;
      sectionIndex: number;
      sectionTitle: string;
      id: string;
      task: string;
      owner: string;
      priority: ActionPriority;
      dueContext: string;
      completed: boolean;
    }> = [];

    agenda.sections.forEach((sec, idx) => {
      sec.actionItems.forEach((act) => {
        rows.push({
          sectionId: sec.id,
          sectionIndex: idx + 1,
          sectionTitle: sec.title,
          ...act,
        });
      });
    });
    return rows;
  }, [agenda.sections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((item) => {
      if (priorityFilter !== "All" && item.priority !== priorityFilter) return false;
      if (statusFilter === "Open" && item.completed) return false;
      if (statusFilter === "Done" && !item.completed) return false;
      if (
        q &&
        !item.task.toLowerCase().includes(q) &&
        !item.owner.toLowerCase().includes(q) &&
        !item.sectionTitle.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [allItems, priorityFilter, statusFilter, query]);

  const completedCount = allItems.filter((i) => i.completed).length;

  const toggleItem = (sectionId: string, actionId: string) => {
    onUpdateAgenda({
      ...agenda,
      sections: agenda.sections.map((sec) =>
        sec.id === sectionId
          ? {
              ...sec,
              actionItems: sec.actionItems.map((act) =>
                act.id === actionId ? { ...act, completed: !act.completed } : act
              ),
            }
          : sec
      ),
    });
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Action Items</h1>
          <p className="text-sm text-slate-500 font-mono tabular-nums">
            {completedCount} of {allItems.length} completed across {agenda.sections.length} agenda topics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tasks or owners..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 w-52"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(["All", "High", "Medium", "Low"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  priorityFilter === p
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(["All", "Open", "Done"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <p className="text-sm font-medium text-slate-800">No matching action items</p>
          <p className="text-xs text-slate-500">
            Adjust your filters or add tasks inside any topic on the Agenda tab.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4 w-10">Done</th>
                  <th className="py-2.5 px-4">Action Item</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Owner</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Topic</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Priority</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">Timing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-4 align-top">
                      <input
                        type="checkbox"
                        aria-label={`Mark "${item.task}" complete`}
                        checked={item.completed}
                        onChange={() => toggleItem(item.sectionId, item.id)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                      />
                    </td>
                    <td
                      className={`py-3 px-4 align-top ${
                        item.completed ? "line-through text-slate-400" : "text-slate-900"
                      }`}
                    >
                      {item.task}
                    </td>
                    <td className="py-3 px-4 align-top text-xs text-slate-700 whitespace-nowrap">
                      {item.owner}
                    </td>
                    <td className="py-3 px-4 align-top text-xs text-slate-500 max-w-[200px] truncate">
                      <span className="font-mono tabular-nums text-slate-400 mr-1.5">
                        {String(item.sectionIndex).padStart(2, "0")}
                      </span>
                      {item.sectionTitle}
                    </td>
                    <td className="py-3 px-4 align-top text-xs whitespace-nowrap">
                      <span
                        className={
                          item.priority === "High"
                            ? "text-red-700 font-semibold"
                            : item.priority === "Medium"
                            ? "text-amber-700 font-medium"
                            : "text-slate-500"
                        }
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 align-top text-xs text-slate-500 text-right whitespace-nowrap">
                      {item.dueContext}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
