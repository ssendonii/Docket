import type { AgendaSection, MeetingAgenda, SampleDocument } from "../types.ts";

export interface SectionTiming {
  sectionId: string;
  startOffsetMin: number;
  endOffsetMin: number;
  relativeRange: string;
  clockRange: string;
}

export function formatMinutesOffset(totalMins: number): string {
  const mins = Math.max(0, Math.round(totalMins));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseClockToMinutes(clock: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((clock || "").trim());
  if (!match) return 9 * 60;
  const h = Math.min(23, Math.max(0, Number(match[1])));
  const m = Math.min(59, Math.max(0, Number(match[2])));
  return h * 60 + m;
}

export function formatClockMinutes(totalMins: number): string {
  const normalized = ((Math.round(totalMins) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function computeTimeline(sections: AgendaSection[], startTime: string): SectionTiming[] {
  const baseMinutes = parseClockToMinutes(startTime);
  let cursor = 0;
  return sections.map((sec) => {
    const dur = Math.max(1, Math.round(sec.durationMinutes || 1));
    const startOffsetMin = cursor;
    const endOffsetMin = cursor + dur;
    cursor = endOffsetMin;
    return {
      sectionId: sec.id,
      startOffsetMin,
      endOffsetMin,
      relativeRange: `${formatMinutesOffset(startOffsetMin)}–${formatMinutesOffset(endOffsetMin)}`,
      clockRange: `${formatClockMinutes(baseMinutes + startOffsetMin)}–${formatClockMinutes(baseMinutes + endOffsetMin)}`,
    };
  });
}

export function rebalanceSectionsToTarget(
  sections: AgendaSection[],
  targetMinutes: number
): AgendaSection[] {
  if (sections.length === 0) return sections;
  const safeTarget = Math.max(sections.length, Math.round(targetMinutes));
  const rawTotal = sections.reduce(
    (sum, s) => sum + Math.max(1, Math.round(s.durationMinutes || 1)),
    0
  );
  if (rawTotal === safeTarget) return sections;

  const exact = sections.map(
    (s) => (Math.max(1, Math.round(s.durationMinutes || 1)) / rawTotal) * safeTarget
  );
  const floored = exact.map((val) => Math.max(1, Math.floor(val)));
  let remainder = safeTarget - floored.reduce((a, b) => a + b, 0);

  if (remainder > 0) {
    const order = exact
      .map((val, idx) => ({ idx, frac: val - Math.floor(val) }))
      .sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < order.length && remainder > 0; i++) {
      floored[order[i].idx] += 1;
      remainder--;
    }
  } else if (remainder < 0) {
    const order = floored
      .map((val, idx) => ({ idx, val }))
      .sort((a, b) => b.val - a.val);
    let guard = 0;
    while (remainder < 0 && guard < 500) {
      let changed = false;
      for (const item of order) {
        if (floored[item.idx] > 1 && remainder < 0) {
          floored[item.idx] -= 1;
          remainder++;
          changed = true;
        }
      }
      if (!changed) break;
      guard++;
    }
  }

  return sections.map((sec, idx) => ({
    ...sec,
    durationMinutes: floored[idx],
  }));
}

export function agendaToMarkdown(agenda: MeetingAgenda): string {
  const timings = computeTimeline(agenda.sections, agenda.startTime);
  const totalAllocated = agenda.sections.reduce((sum, s) => sum + s.durationMinutes, 0);
  const lines: string[] = [];

  lines.push(`# ${agenda.meetingTitle}`);
  lines.push("");
  lines.push(
    `**Duration:** ${totalAllocated} min (Target: ${agenda.targetDurationMinutes} min) | **Start:** ${agenda.startTime} | **Source:** ${agenda.sourceFileName}`
  );
  lines.push("");
  lines.push(`## Objective`);
  lines.push(agenda.meetingObjective);
  lines.push("");

  if (agenda.documentSummary) {
    lines.push(`## Source Context`);
    lines.push(agenda.documentSummary);
    lines.push("");
  }

  if (agenda.stakeholders.length > 0) {
    lines.push(`## Stakeholders`);
    lines.push(`| Stakeholder | Role | Responsibility |`);
    lines.push(`| --- | --- | --- |`);
    for (const s of agenda.stakeholders) {
      lines.push(`| ${s.name} | ${s.role} | ${s.responsibility} |`);
    }
    lines.push("");
  }

  lines.push(`## Time-Boxed Agenda`);
  lines.push("");
  agenda.sections.forEach((sec, idx) => {
    const t = timings[idx];
    lines.push(
      `### ${String(idx + 1).padStart(2, "0")}. ${sec.title} (${sec.durationMinutes} min · ${t.clockRange} · ${sec.purpose})`
    );
    lines.push(`**Lead:** ${sec.leadStakeholder}${sec.participants.length ? ` | **Participants:** ${sec.participants.join(", ")}` : ""}`);
    lines.push("");
    if (sec.summary) {
      lines.push(sec.summary);
      lines.push("");
    }
    if (sec.keyPoints.length > 0) {
      lines.push(`**Discussion Points:**`);
      for (const kp of sec.keyPoints) {
        lines.push(`- ${kp}`);
      }
      lines.push("");
    }
    if (sec.actionItems.length > 0) {
      lines.push(`**Action Items:**`);
      for (const act of sec.actionItems) {
        lines.push(
          `- [${act.completed ? "x" : " "}] ${act.task} — *${act.owner}* (${act.priority} · ${act.dueContext})`
        );
      }
      lines.push("");
    }
  });

  return lines.join("\n");
}

export function formatCharCount(count: number, fileType: string): string {
  if (fileType === "PDF") {
    const kb = Math.max(1, Math.round(count / 1024));
    return `${kb.toLocaleString()} KB`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k chars`;
  }
  return `${count} chars`;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: "sample_billing",
    title: "Q4 Billing Migration Readiness Brief",
    fileName: "q4_billing_migration_brief.md",
    suggestedMinutes: 45,
    description: "Cross-functional launch readiness doc with risk items, owners, and go/no-go checkpoints.",
    content: `# Q4 Enterprise Billing Engine Migration — Readiness Brief

**Prepared by:** Elena Rostova (Program Lead)
**Target Cutover Window:** November 22, 02:00 UTC

## 1. Executive Context
We are migrating 1,420 enterprise accounts from the legacy invoice processor (v1) to the real-time usage metering ledger (v2). Shadow-mode reconciliation has run for 18 days. Current variance across 99.4% of invoices is $0.00, while 8 accounts exhibit rounding discrepancies on tiered overages.

## 2. Engineering & Data Integrity Status
- **Marcus Vance (Platform Engineering):** Database dual-write latency is steady at 14ms p95. Rollback toggle requires 90 seconds to drain active webhook queues.
- **Open Blocker:** The 8 tiered-overage accounts use custom anniversary proration rules not yet covered by the automated test suite. Patch PR #4182 is under review.
- **Data Engineering (Priya Nair):** Historical invoice backfill for 2024-2025 completes Thursday at 18:00 UTC. Spot-check audit scripts need sign-off from Finance before production switch.

## 3. Customer Operations & Support Readiness
- **Devon Brooks (Customer Success):** Top 25 strategic accounts have been briefed. Three accounts requested dedicated sandbox verification before cutover.
- **Support Runbooks:** Tier-1 escalation macros are drafted, but billing dispute refund thresholds ($500 vs $2,500 self-serve limit) need approval from Finance.

## 4. Finance & Legal Compliance
- **Claire Lin (VP Finance):** Requires a signed reconciliation certificate from Data Engineering 24 hours prior to cutover. Needs final decision on whether to defer the 8 custom-proration accounts to Cohort 2 (December 6).
- **Legal (Samir Patel):** Updated MSA billing-cycle addendum applies only to renewals; no customer notification is legally required for infrastructure migration unless invoice PDF layout changes.

## 5. Decisions Needed in This Meeting
1. Approve or defer the 8 custom-proration accounts to Cohort 2.
2. Ratify the $1,000 Support self-serve credit threshold for migration-related disputes.
3. Lock the final go/no-go checkpoint schedule for November 20.`,
  },
  {
    id: "sample_sso",
    title: "Enterprise SSO & SCIM Rollout Proposal",
    fileName: "enterprise_sso_scim_proposal.txt",
    suggestedMinutes: 30,
    description: "Security and product engineering spec covering SAML rollout, customer beta, and documentation.",
    content: `ENTERPRISE SSO & SCIM PROVISIONING ROLLOUT MEMO
Author: Jordan Alvarez, Product Security
Reviewers: Hana Kim (Product), Theo Wright (Backend), Nina Kapoor (Solutions Engineering)

SUMMARY
Fourteen enterprise prospects have requested SAML 2.0 single sign-on and automated SCIM user deprovisioning as prerequisites for Q1 contract signatures ($680k ARR pipeline). Core SAML assertion validation is complete in staging. SCIM group-sync edge cases remain open.

KEY TOPICS TO REVIEW
1. IdP Compatibility Scope
   - Okta and Microsoft Entra ID pass 100% of integration tests.
   - PingFederate shows intermittent attribute mapping failures when custom role claims exceed 12 attributes. Need decision on whether PingFederate ships in GA or Phase 2.

2. JIT Provisioning vs. Strict SCIM Enforcement
   - Solutions Engineering reports that mid-market customers want Just-In-Time (JIT) user creation enabled by default, whereas regulated banking clients demand strict SCIM-only membership.
   - Theo Wright estimates 3 days of backend work to support per-workspace policy toggles.

3. Security Audit & Penetration Test Findings
   - External pen-test flagged missing replay-attack cache expiration bounds on IdP-initiated SAML flows (Medium severity). Fix requires Redis TTL enforcement before GA.
   - Session revocation latency when an employee is deactivated via SCIM currently averages 4 minutes; target SLA is under 30 seconds.

4. Beta Launch & Enablement
   - Nina Kapoor has lined up 4 design-partner accounts for a 2-week private beta starting Monday.
   - Documentation needs step-by-step Okta and Entra ID setup guides plus fallback break-glass admin recovery instructions.`,
  },
];
