import { prisma } from "../../db";
import { sendEmail, getEmailRuntimeConfig } from "../../notifications/email/send-email";
import { writeAuditLog } from "../audit/write-audit-log";
import {
  formatReportGeneratedAt,
  renderReportPdf,
} from "../reports/pdf";
import {
  getPtoLiabilityExportRows,
  getPtoLiabilityFilters,
} from "../reports/pto-liability";
import { ptoLiabilityReportNotes } from "../reports/report-notes";
import { getScheduledJobRunActorId } from "./runs";
import { runTrackedInternalJob } from "./execute";

function toSnapshotDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

async function getAdminRecipients() {
  const assignments = await prisma.employeeRoleAssignment.findMany({
    where: {
      isActive: true,
      role: {
        code: {
          in: ["SITE_ADMIN", "HR_ADMIN"],
        },
      },
      employee: {
        status: "ACTIVE",
      },
    },
    select: {
      employee: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const recipientsByEmail = new Map<
    string,
    { employeeId: string; email: string; name: string }
  >();

  for (const assignment of assignments) {
    const email = assignment.employee.email.trim().toLowerCase();

    if (!email) {
      continue;
    }

    if (!recipientsByEmail.has(email)) {
      recipientsByEmail.set(email, {
        employeeId: assignment.employee.id,
        email,
        name: `${assignment.employee.firstName} ${assignment.employee.lastName}`.trim(),
      });
    }
  }

  return Array.from(recipientsByEmail.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

function buildPdfForSnapshot(input: {
  snapshotDate: Date;
  rows: Awaited<ReturnType<typeof getPtoLiabilityExportRows>>;
}) {
  const filters = getPtoLiabilityFilters({
    status: "ACTIVE",
    asOfDate: toSnapshotDateString(input.snapshotDate),
    page: "1",
    pageSize: "10000",
  });

  return renderReportPdf({
    title: ptoLiabilityReportNotes.title,
    subtitle: ptoLiabilityReportNotes.subtitle,
    generatedAt: formatReportGeneratedAt(input.snapshotDate),
    notes: ptoLiabilityReportNotes,
    appliedFilters: [
      { label: "Status", value: "ACTIVE" },
      { label: "As of Date", value: filters.asOfDate },
      { label: "Department", value: "All departments" },
      { label: "Payroll Frequency", value: "All payroll frequencies" },
      { label: "Work Location", value: "All work locations" },
      { label: "Liability Status", value: "ALL" },
      { label: "Sort", value: `${filters.sort} (${filters.direction})` },
    ],
    columns: [
      { label: "Employee", width: 15 },
      { label: "Emp ID", width: 10 },
      { label: "Dept", width: 10 },
      { label: "Status", width: 8 },
      { label: "Title", width: 12 },
      { label: "Location", width: 10 },
      { label: "Pay Freq", width: 12 },
      { label: "Liability", width: 12 },
      { label: "Liability Status", width: 16 },
      { label: "Snapshot", width: 10 },
    ],
    rows: input.rows.map((row) => [
      row.employeeName,
      row.employeeIdentifier,
      row.department ?? "",
      row.employeeStatus,
      row.jobTitle ?? "",
      row.workLocation ?? "",
      row.payrollFrequency,
      `$${row.estimatedPtoLiability.toFixed(2)}`,
      row.liabilityStatusLabel,
      row.snapshotDate,
    ]),
  });
}

export async function runMonthlyPtoLiabilitySnapshotJob(input?: {
  runKey?: string;
  runDate?: Date | null;
}) {
  return runTrackedInternalJob({
    jobName: "report-pto-liability-month-end",
    runKey: input?.runKey,
    execute: async () => {
      const snapshotDate = input?.runDate ? new Date(input.runDate) : new Date();
      const filters = getPtoLiabilityFilters({
        status: "ACTIVE",
        asOfDate: toSnapshotDateString(snapshotDate),
        page: "1",
        pageSize: "10000",
      });
      const rows = await getPtoLiabilityExportRows(filters);
      const pdf = buildPdfForSnapshot({ snapshotDate, rows });
      const totalPtoLiability = rows.reduce(
        (sum, row) => sum + row.estimatedPtoLiability,
        0
      );
      const negativeBalanceReviewCount = rows.filter(
        (row) => row.liabilityStatus === "NEGATIVE_BALANCE_REVIEW"
      ).length;
      const recipients = await getAdminRecipients();

      await writeAuditLog(prisma, {
        userId: getScheduledJobRunActorId(),
        action: "REPORT_PTO_LIABILITY_SNAPSHOT_GENERATED",
        entityType: "Report",
        entityId: "pto-liability",
        newValue: {
          snapshotDate: snapshotDate.toISOString(),
          rowCount: rows.length,
          totalPtoLiability: Number(totalPtoLiability.toFixed(2)),
          negativeBalanceReviewCount,
          filters: {
            status: filters.status,
            asOfDate: filters.asOfDate,
          },
        },
      });

      if (recipients.length === 0) {
        await writeAuditLog(prisma, {
          userId: getScheduledJobRunActorId(),
          action: "REPORT_PTO_LIABILITY_EMAIL_FAILED",
          entityType: "Report",
          entityId: "pto-liability",
          newValue: {
            snapshotDate: snapshotDate.toISOString(),
            reason: "No active admin recipients were found.",
          },
        });

        throw new Error("No active admin recipients were found for PTO liability delivery.");
      }

      const runtimeConfig = getEmailRuntimeConfig();
      const subject = `MFN HR PTO Liability Report - ${toSnapshotDateString(snapshotDate)}`;
      const reportUrl = runtimeConfig.appBaseUrl
        ? `${runtimeConfig.appBaseUrl.replace(/\/$/, "")}/reports/pto-liability`
        : null;

      try {
        const sendResult = await sendEmail({
          to: recipients.map((recipient) => recipient.email),
          subject,
          text: [
            "Attached is the month-end PTO liability report PDF for internal HR/admin review.",
            reportUrl ? `MFN HR report link: ${reportUrl}` : null,
          ]
            .filter(Boolean)
            .join("\n\n"),
          attachments: [
            {
              filename: `pto_liability_${toSnapshotDateString(snapshotDate)}.pdf`,
              contentType: "application/pdf",
              contentBase64: pdf.toString("base64"),
            },
          ],
        });

        if (!sendResult.sent) {
          throw new Error(sendResult.reason);
        }

        await writeAuditLog(prisma, {
          userId: getScheduledJobRunActorId(),
          action: "REPORT_PTO_LIABILITY_EMAIL_SENT",
          entityType: "Report",
          entityId: "pto-liability",
          newValue: {
            snapshotDate: snapshotDate.toISOString(),
            recipientCount: recipients.length,
            recipientEmployeeIds: recipients.map((recipient) => recipient.employeeId),
            recipientEmails: recipients.map((recipient) => recipient.email),
            rowCount: rows.length,
            provider: sendResult.provider,
            messageId: sendResult.messageId ?? null,
          },
        });

        return {
          result: {
            snapshotDate: snapshotDate.toISOString(),
            rowCount: rows.length,
            recipientCount: recipients.length,
            totalPtoLiability: Number(totalPtoLiability.toFixed(2)),
          },
          recordsProcessed: rows.length,
        };
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }

        await writeAuditLog(prisma, {
          userId: getScheduledJobRunActorId(),
          action: "REPORT_PTO_LIABILITY_EMAIL_FAILED",
          entityType: "Report",
          entityId: "pto-liability",
          newValue: {
            snapshotDate: snapshotDate.toISOString(),
            recipientCount: recipients.length,
            reason: error.message,
          },
        });

        throw error;
      }
    },
  });
}
