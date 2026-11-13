import React from "react";

export type WorkspaceTab = "agenda" | "actions" | "stakeholders" | "history";

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onNewAgenda: () => void;
  hasActiveAgenda: boolean;
  savedCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onNewAgenda,
  hasActiveAgenda,
  savedCount,
}) => {
  const navItems: Array<{ id: WorkspaceTab; label: string; disabled?: boolean }> = [
    { id: "agenda", label: "Agenda" },
    { id: "actions", label: "Action Items", disabled: !hasActiveAgenda },
    { id: "stakeholders", label: "Stakeholders", disabled: !hasActiveAgenda },
    { id: "history", label: savedCount > 0 ? `Saved (${savedCount})` : "Saved" },
  ];

  return (
    <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark + Active Version */}
        <div className="flex items-baseline gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab("agenda")}
            className="text-xl font-bold tracking-tight text-slate-900 font-[var(--font-display)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 rounded"
          >
            Docket
          </button>
          <span className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap shrink-0">
            v{typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.1.0"}
          </span>
        </div>

        {/* Zone 2: Concise single-line navigation links */}
        <nav aria-label="Workspace views" className="flex items-center gap-6 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => onSelectTab(item.id)}
                className={`relative py-5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isActive
                    ? "text-slate-900"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onNewAgenda}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            New Agenda
          </button>
        </div>
      </div>
    </header>
  );
};
