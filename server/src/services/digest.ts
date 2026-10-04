import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { evaluateAtRisk, calculateImprovement } from '../insights/index.js';

export interface DigestPayload {
  trainerId: string;
  trainerName: string;
  trainerEmail: string;
  batchNames: string[];
  topImprovers: { traineeName: string; batchName: string; deltaPoints: number }[];
  atRiskTrainees: { traineeName: string; batchName: string; severity: string; reasons: string[] }[];
  sessionsPendingResults: { sessionId: string; title: string; batchName: string; heldOn: string }[];
  dashboardUrl: string;
  generatedAt: string;
}

/**
 * Builds digest data for a specific trainer
 */
export async function buildTrainerDigest(trainerId: string): Promise<DigestPayload | null> {
  const trainer = await prisma.user.findUnique({
    where: { id: trainerId },
    include: {
      batchesLed: {
        include: {
          trainees: {
            include: {
              user: true,
              results: {
                include: { session: true },
                orderBy: { session: { heldOn: 'asc' } },
              },
              attendances: {
                orderBy: { createdAt: 'desc' },
              },
            },
          },
          sessions: {
            include: { results: true },
            orderBy: { heldOn: 'desc' },
          },
        },
      },
    },
  });

  if (!trainer || trainer.batchesLed.length === 0) {
    return null;
  }

  const batchNames = trainer.batchesLed.map((b) => b.name);
  const allTrainees = trainer.batchesLed.flatMap((b) =>
    b.trainees.map((t) => ({ ...t, batchName: b.name, batchId: b.id }))
  );

  // Calculate batch averages for at-risk comparison
  const batchScoreMap = new Map<string, number>();
  for (const b of trainer.batchesLed) {
    const allResults = b.sessions.flatMap((s) => s.results);
    const avg = allResults.length ? allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length : 75;
    batchScoreMap.set(b.id, avg);
  }

  const improverList: { traineeName: string; batchName: string; deltaPoints: number }[] = [];
  const atRiskList: { traineeName: string; batchName: string; severity: string; reasons: string[] }[] = [];

  for (const t of allTrainees) {
    const scores = t.results.map((r) => r.score);
    const errors = t.results.map((r) => r.errors);
    const attendances = t.attendances.map((a) => a.status);
    const tAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const bAvg = batchScoreMap.get(t.batchId) ?? null;

    // At risk check
    const atRisk = evaluateAtRisk({
      scores,
      errors,
      traineeAverage: tAvg,
      batchAverage: bAvg,
      recentAttendance: attendances,
    });

    if (atRisk.isAtRisk) {
      atRiskList.push({
        traineeName: t.user.name,
        batchName: t.batchName,
        severity: atRisk.severity,
        reasons: atRisk.reasons,
      });
    }

    // Improvement check
    const imp = calculateImprovement(scores);
    if (imp.totalDelta > 0) {
      improverList.push({
        traineeName: t.user.name,
        batchName: t.batchName,
        deltaPoints: imp.totalDelta,
      });
    }
  }

  // Sort improvers descending
  improverList.sort((a, b) => b.deltaPoints - a.deltaPoints);

  // Sessions with 0 results
  const pendingSessions: { sessionId: string; title: string; batchName: string; heldOn: string }[] = [];
  for (const b of trainer.batchesLed) {
    for (const s of b.sessions) {
      if (s.results.length === 0) {
        pendingSessions.push({
          sessionId: s.id,
          title: s.title,
          batchName: b.name,
          heldOn: s.heldOn.toISOString().split('T')[0],
        });
      }
    }
  }

  return {
    trainerId: trainer.id,
    trainerName: trainer.name,
    trainerEmail: trainer.email,
    batchNames,
    topImprovers: improverList.slice(0, 5),
    atRiskTrainees: atRiskList,
    sessionsPendingResults: pendingSessions.slice(0, 5),
    dashboardUrl: process.env.APP_URL || 'http://localhost:3000',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Sends or previews weekly digests for all trainers
 */
export async function sendWeeklyDigests(): Promise<{ sent: number; skipped: number; previews: DigestPayload[] }> {
  const trainers = await prisma.user.findMany({
    where: {
      role: { in: ['TRAINER', 'ADMIN'] },
    },
  });

  const previewDir = path.resolve(process.cwd(), 'server/storage/email_previews');
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }

  let sent = 0;
  let skipped = 0;
  const previews: DigestPayload[] = [];

  for (const trainer of trainers) {
    if (!trainer.emailDigestEnabled) {
      logger.info({ trainerId: trainer.id }, 'Trainer opted out of weekly email digest.');
      skipped += 1;
      continue;
    }

    const digest = await buildTrainerDigest(trainer.id);
    if (!digest) {
      skipped += 1;
      continue;
    }

    previews.push(digest);

    // Render HTML content
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #4f46e5;">forma Weekly Trainer Digest</h2>
        <p>Hello <strong>${digest.trainerName}</strong>,</p>
        <p>Here is your weekly summary for your assigned cohorts (<strong>${digest.batchNames.join(', ')}</strong>).</p>
        
        <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">🚀 Top Improvers</h3>
        ${
          digest.topImprovers.length > 0
            ? `<ul>${digest.topImprovers.map((i) => `<li><strong>${i.traineeName}</strong> (${i.batchName}): <span style="color: #16a34a; font-weight: bold;">+${i.deltaPoints.toFixed(1)} pts</span></li>`).join('')}</ul>`
            : '<p>No significant score deltas recorded this past week.</p>'
        }

        <h3 style="color: #dc2626; border-bottom: 2px solid #fee2e2; padding-bottom: 4px;">⚠️ Trainees Requiring Attention</h3>
        ${
          digest.atRiskTrainees.length > 0
            ? `<ul>${digest.atRiskTrainees.map((r) => `<li><strong>${r.traineeName}</strong> (${r.batchName}) - <span style="color: #dc2626;">${r.severity} Priority</span><br/><small style="color: #64748b;">${r.reasons.join('; ')}</small></li>`).join('')}</ul>`
            : '<p style="color: #16a34a;">No trainees currently flagged at risk.</p>'
        }

        <h3 style="color: #475569; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">📝 Pending Session Grades</h3>
        ${
          digest.sessionsPendingResults.length > 0
            ? `<ul>${digest.sessionsPendingResults.map((s) => `<li><strong>${s.title}</strong> (${s.batchName}, held ${s.heldOn}) - <em>No scores submitted yet</em></li>`).join('')}</ul>`
            : '<p>All held sessions are fully evaluated!</p>'
        }

        <p style="margin-top: 32px;">
          <a href="${digest.dashboardUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Trainer Dashboard</a>
        </p>
        <hr style="margin-top: 40px; border: 0; border-top: 1px solid #e2e8f0;" />
        <p style="font-size: 12px; color: #94a3b8;">You received this because you are an active trainer on forma. You can change your notification settings at any time in your profile.</p>
      </div>
    `;

    // Save to preview folder
    const previewFilePath = path.join(previewDir, `digest_${trainer.id}_${Date.now()}.json`);
    fs.writeFileSync(
      previewFilePath,
      JSON.stringify({ ...digest, html }, null, 2),
      'utf-8'
    );

    // Try sending via SMTP if configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@forma.internal',
          to: digest.trainerEmail,
          subject: `forma Weekly Trainer Digest - ${new Date().toLocaleDateString()}`,
          html,
        });
        sent += 1;
      } catch (err) {
        logger.error({ err, trainerId: trainer.id }, 'Failed to deliver digest via SMTP; saved locally to preview.');
      }
    } else {
      sent += 1; // Count as processed preview
    }
  }

  return { sent, skipped, previews };
}
