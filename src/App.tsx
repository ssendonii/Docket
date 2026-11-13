import { useEffect, useRef, useState } from "react";
import { TopBar, type WorkspaceTab } from "./components/TopBar.tsx";
import { DocumentIntakePanel } from "./components/DocumentIntakePanel.tsx";
import { AgendaView } from "./components/AgendaView.tsx";
import { ActionItemsView } from "./components/ActionItemsView.tsx";
import { StakeholdersView } from "./components/StakeholdersView.tsx";
import { HistoryView } from "./components/HistoryView.tsx";
import { SAMPLE_DOCUMENTS } from "./utils/agendaUtils.ts";
import { safeFetchJson } from "./utils/safeFetch.ts";
import type { MeetingAgenda } from "./types.ts";

const STORAGE_KEY = "docket_saved_agendas_v1";

function loadSavedAgendas(): MeetingAgenda[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("agenda");
  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [totalMinutes, setTotalMinutes] = useState(45);
  const [startTime, setStartTime] = useState("09:00");
  const [meetingGoal, setMeetingGoal] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [savedAgendas, setSavedAgendas] = useState<MeetingAgenda[]>(() => loadSavedAgendas());
  const [activeAgenda, setActiveAgenda] = useState<MeetingAgenda | null>(() => {
    const list = loadSavedAgendas();
    return list[0] ?? null;
  });

  const fileInputFocusRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedAgendas.slice(0, 20)));
    } catch {
      // Ignore storage quota errors
    }
  }, [savedAgendas]);

  const upsertSavedAgenda = (agenda: MeetingAgenda) => {
    setSavedAgendas((prev) => {
      const idx = prev.findIndex((a) => a.id === agenda.id);
      if (idx === -1) {
        return [agenda, ...prev].slice(0, 20);
      }
      const next = [...prev];
      next[idx] = agenda;
      return next;
    });
  };

  const handleUpdateAgenda = (updated: MeetingAgenda) => {
    setActiveAgenda(updated);
    upsertSavedAgenda(updated);
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    setErrorMessage(null);
    setIsGenerating(true);
    setActiveTab("agenda");

    try {
      let data: { agenda?: MeetingAgenda; error?: string };

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("totalMinutes", String(totalMinutes));
        formData.append("startTime", startTime);
        if (meetingGoal.trim()) {
          formData.append("meetingGoal", meetingGoal.trim());
        }

        data = await safeFetchJson<{ agenda?: MeetingAgenda; error?: string }>(
          "/api/agenda/generate",
          {
            method: "POST",
            body: formData,
          }
        );
      } else {
        data = await safeFetchJson<{ agenda?: MeetingAgenda; error?: string }>(
          "/api/agenda/generate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rawText,
              fileName: sourceLabel.trim() || "Pasted Brief.txt",
              totalMinutes,
              startTime,
              meetingGoal: meetingGoal.trim(),
            }),
          }
        );
      }

      if (!data.agenda) {
        throw new Error(data.error || "Unable to craft agenda from this document.");
      }

      setActiveAgenda(data.agenda);
      upsertSavedAgenda(data.agenda);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred while analyzing the document.";
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNewAgenda = () => {
    setActiveTab("agenda");
    setInputMode("upload");
    setSelectedFile(null);
    setRawText("");
    setSourceLabel("");
    setMeetingGoal("");
    setErrorMessage(null);
    setActiveAgenda(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLoadSampleQuick = () => {
    const sample = SAMPLE_DOCUMENTS[0];
    setSelectedFile(null);
    setRawText(sample.content);
    setSourceLabel(sample.fileName);
    setTotalMinutes(sample.suggestedMinutes);
    setInputMode("paste");
    setErrorMessage(null);
  };

  const handleDeleteAgenda = (id: string) => {
    setSavedAgendas((prev) => {
      const remaining = prev.filter((a) => a.id !== id);
      if (activeAgenda?.id === id) {
        setActiveAgenda(remaining[0] ?? null);
      }
      return remaining;
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewAgenda={handleNewAgenda}
        hasActiveAgenda={Boolean(activeAgenda)}
        savedCount={savedAgendas.length}
      />

      <div className="flex-1 w-full max-w-[1440px] mx-auto flex flex-col lg:flex-row">
        <DocumentIntakePanel
          inputMode={inputMode}
          onChangeInputMode={setInputMode}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          rawText={rawText}
          onChangeRawText={setRawText}
          sourceLabel={sourceLabel}
          onChangeSourceLabel={setSourceLabel}
          totalMinutes={totalMinutes}
          onChangeTotalMinutes={setTotalMinutes}
          startTime={startTime}
          onChangeStartTime={setStartTime}
          meetingGoal={meetingGoal}
          onChangeMeetingGoal={setMeetingGoal}
          isGenerating={isGenerating}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage(null)}
          onGenerate={handleGenerate}
          inputFocusRef={fileInputFocusRef}
        />

        <main className="flex-1 min-w-0">
          {activeTab === "agenda" && (
            <AgendaView
              agenda={activeAgenda}
              isGenerating={isGenerating}
              pendingTargetMinutes={totalMinutes}
              onUpdateAgenda={handleUpdateAgenda}
              onLoadSampleQuick={handleLoadSampleQuick}
            />
          )}

          {activeTab === "actions" && activeAgenda && (
            <ActionItemsView
              agenda={activeAgenda}
              onUpdateAgenda={handleUpdateAgenda}
            />
          )}

          {activeTab === "stakeholders" && activeAgenda && (
            <StakeholdersView agenda={activeAgenda} />
          )}

          {activeTab === "history" && (
            <HistoryView
              savedAgendas={savedAgendas}
              activeAgendaId={activeAgenda?.id ?? null}
              onOpenAgenda={(item) => {
                setActiveAgenda(item);
                setTotalMinutes(item.targetDurationMinutes);
                setStartTime(item.startTime);
                setActiveTab("agenda");
              }}
              onDeleteAgenda={handleDeleteAgenda}
            />
          )}
        </main>
      </div>
    </div>
  );
}
