import React, { useMemo } from "react";
import type { MeetingAgenda } from "../types.ts";

interface StakeholdersViewProps {
  agenda: MeetingAgenda;
}

export const StakeholdersView: React.FC<StakeholdersViewProps> = ({ agenda }) => {
  const stakeholderMetrics = useMemo(() => {
    return agenda.stakeholders.map((stk) => {
      const nameLower = stk.name.toLowerCase();
      let leadingCount = 0;
      let participatingCount = 0;
      let activeMinutes = 0;
      let actionCount = 0;

      agenda.sections.forEach((sec) => {
        const isLead = sec.leadStakeholder.toLowerCase().includes(nameLower) ||
          nameLower.includes(sec.leadStakeholder.toLowerCase());
        const isParticipant = sec.participants.some(
          (p) => p.toLowerCase().includes(nameLower) || nameLower.includes(p.toLowerCase())
        );

        if (isLead) leadingCount += 1;
        else if (isParticipant) participatingCount += 1;

        if (isLead || isParticipant) {
          activeMinutes += sec.durationMinutes;
        }

        sec.actionItems.forEach((act) => {
          if (
            act.owner.toLowerCase().includes(nameLower) ||
            nameLower.includes(act.owner.toLowerCase())
          ) {
            actionCount += 1;
          }
        });
      });

      return {
        ...stk,
        leadingCount,
        participatingCount,
        activeMinutes,
        actionCount,
      };
    });
  }, [agenda]);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-200 space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Stakeholders</h1>
        <p className="text-sm text-slate-500 font-mono tabular-nums">
          {agenda.stakeholders.length} stakeholders identified from {agenda.sourceFileName}
        </p>
      </div>

      {stakeholderMetrics.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <p className="text-sm font-medium text-slate-800">No stakeholders listed</p>
          <p className="text-xs text-slate-500">
            The source document did not specify individual owners or teams.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Stakeholder</th>
                  <th className="py-2.5 px-4">Role / Team</th>
                  <th className="py-2.5 px-4">Meeting Responsibility</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Topics Led</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Active Time</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Action Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stakeholderMetrics.map((stk) => (
                  <tr key={stk.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {stk.name}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {stk.role}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-sm leading-relaxed">
                      {stk.responsibility}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {stk.leadingCount}
                      {stk.participatingCount > 0 && (
                        <span className="text-slate-400"> (+{stk.participatingCount})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                      {stk.activeMinutes} min
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {stk.actionCount}
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
