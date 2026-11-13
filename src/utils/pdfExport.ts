import { jsPDF } from "jspdf";
import type { MeetingAgenda } from "../types.ts";
import { computeTimeline, formatCharCount } from "./agendaUtils.ts";

export function exportAgendaToPdf(agenda: MeetingAgenda): string {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 18;
  let y = 20;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > bottomLimit) {
      doc.addPage();
      y = 20;
    }
  };

  const writeWrapped = (
    text: string,
    options: {
      fontSize?: number;
      fontStyle?: "normal" | "bold" | "italic";
      color?: [number, number, number];
      indent?: number;
      lineHeight?: number;
      spaceAfter?: number;
    } = {}
  ) => {
    const {
      fontSize = 10,
      fontStyle = "normal",
      color = [30, 41, 59],
      indent = 0,
      lineHeight = 4.6,
      spaceAfter = 2,
    } = options;

    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);

    const lines = doc.splitTextToSize(text, contentWidth - indent) as string[];
    for (const line of lines) {
      ensureSpace(lineHeight + 1);
      doc.text(line, marginX + indent, y);
      y += lineHeight;
    }
    y += spaceAfter;
  };

  const timings = computeTimeline(agenda.sections, agenda.startTime);
  const totalAllocated = agenda.sections.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalActions = agenda.sections.reduce((sum, s) => sum + s.actionItems.length, 0);

  // Header metadata
  writeWrapped(
    `MEETING AGENDA  |  ${totalAllocated} min (Target ${agenda.targetDurationMinutes} min)  |  Start ${agenda.startTime}`,
    { fontSize: 8.5, fontStyle: "bold", color: [71, 85, 105], lineHeight: 4, spaceAfter: 2 }
  );

  // Title
  writeWrapped(agenda.meetingTitle, {
    fontSize: 18,
    fontStyle: "bold",
    color: [15, 23, 42],
    lineHeight: 7,
    spaceAfter: 2,
  });

  // Source metadata line
  writeWrapped(
    `Source: ${agenda.sourceFileName} (${agenda.sourceFileType}, ${formatCharCount(
      agenda.sourceCharCount,
      agenda.sourceFileType
    )})  •  ${agenda.sections.length} Topics  •  ${totalActions} Action Items`,
    { fontSize: 8.5, color: [100, 116, 139], lineHeight: 4, spaceAfter: 4 }
  );

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5;

  // Objective
  if (agenda.meetingObjective) {
    writeWrapped("Objective", {
      fontSize: 10.5,
      fontStyle: "bold",
      color: [15, 23, 42],
      lineHeight: 5,
      spaceAfter: 1,
    });
    writeWrapped(agenda.meetingObjective, {
      fontSize: 10,
      color: [51, 65, 85],
      lineHeight: 4.8,
      spaceAfter: 3,
    });
  }

  // Source Summary
  if (agenda.documentSummary) {
    writeWrapped("Document Brief", {
      fontSize: 10.5,
      fontStyle: "bold",
      color: [15, 23, 42],
      lineHeight: 5,
      spaceAfter: 1,
    });
    writeWrapped(agenda.documentSummary, {
      fontSize: 9.5,
      color: [71, 85, 105],
      lineHeight: 4.5,
      spaceAfter: 4,
    });
  }

  // Stakeholders Roster
  if (agenda.stakeholders.length > 0) {
    ensureSpace(14);
    writeWrapped(`Stakeholders (${agenda.stakeholders.length})`, {
      fontSize: 11,
      fontStyle: "bold",
      color: [15, 23, 42],
      lineHeight: 5.5,
      spaceAfter: 2,
    });
    for (const stk of agenda.stakeholders) {
      writeWrapped(`${stk.name} (${stk.role}) — ${stk.responsibility}`, {
        fontSize: 9,
        color: [51, 65, 85],
        indent: 3,
        lineHeight: 4.2,
        spaceAfter: 1.5,
      });
    }
    y += 3;
  }

  // Time-Boxed Agenda Sections
  ensureSpace(14);
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  writeWrapped("Time-Boxed Agenda", {
    fontSize: 12,
    fontStyle: "bold",
    color: [15, 23, 42],
    lineHeight: 6,
    spaceAfter: 3,
  });

  agenda.sections.forEach((sec, idx) => {
    const timing = timings[idx];
    ensureSpace(22);

    const numLabel = String(idx + 1).padStart(2, "0");
    writeWrapped(
      `${numLabel}. ${sec.title}   [${sec.durationMinutes} min  |  ${timing?.clockRange ?? ""}  |  ${sec.purpose}]`,
      {
        fontSize: 11,
        fontStyle: "bold",
        color: [15, 23, 42],
        lineHeight: 5.2,
        spaceAfter: 1.5,
      }
    );

    const participantLine = sec.participants.length
      ? `Lead: ${sec.leadStakeholder}   |   Participants: ${sec.participants.join(", ")}`
      : `Lead: ${sec.leadStakeholder}`;
    writeWrapped(participantLine, {
      fontSize: 8.5,
      fontStyle: "bold",
      color: [71, 85, 105],
      indent: 4,
      lineHeight: 4,
      spaceAfter: 2,
    });

    if (sec.summary) {
      writeWrapped(sec.summary, {
        fontSize: 9.5,
        color: [51, 65, 85],
        indent: 4,
        lineHeight: 4.5,
        spaceAfter: 2,
      });
    }

    if (sec.keyPoints.length > 0) {
      for (const pt of sec.keyPoints) {
        writeWrapped(`• ${pt}`, {
          fontSize: 9,
          color: [71, 85, 105],
          indent: 7,
          lineHeight: 4.3,
          spaceAfter: 1,
        });
      }
      y += 1;
    }

    if (sec.actionItems.length > 0) {
      writeWrapped(`Action Items (${sec.actionItems.length}):`, {
        fontSize: 9,
        fontStyle: "bold",
        color: [30, 41, 59],
        indent: 4,
        lineHeight: 4.3,
        spaceAfter: 1,
      });
      for (const act of sec.actionItems) {
        const mark = act.completed ? "[Done]" : "[Open]";
        writeWrapped(
          `${mark} ${act.task} — Owner: ${act.owner} (${act.priority} priority, ${act.dueContext})`,
          {
            fontSize: 8.8,
            color: act.completed ? [148, 163, 184] : [51, 65, 85],
            indent: 7,
            lineHeight: 4.2,
            spaceAfter: 1,
          }
        );
      }
    }

    y += 3;
    ensureSpace(4);
    doc.setDrawColor(241, 245, 249);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5;
  });

  // Page footers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Docket v${typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.1.0"}  •  ${agenda.meetingTitle}`,
      marginX,
      pageHeight - 10
    );
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - marginX, pageHeight - 10, {
      align: "right",
    });
  }

  const slug = agenda.meetingTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${slug || "meeting-agenda"}.pdf`;
  doc.save(filename);
  return filename;
}
