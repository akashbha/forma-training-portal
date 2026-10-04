import { GoogleGenAI } from '@google/genai';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { calculateImprovement, calculateConsistency, rankWeakestTopics } from '../insights/index.js';

export interface TraineeFeedbackInput {
  traineeId: string;
  actorId: string;
  ip?: string;
}

export interface FeedbackDraftResponse {
  draftText: string;
  provider: 'gemini' | 'rule_based_template';
  isAiGenerated: boolean;
  disclaimer: string;
}

/**
 * Builds privacy-safe aggregated summary payload
 * Only uses first name and mathematical aggregates; strictly omits email, notes, or IDs
 */
export async function generateFeedbackDraft(
  params: TraineeFeedbackInput
): Promise<FeedbackDraftResponse> {
  const trainee = await prisma.trainee.findUnique({
    where: { id: params.traineeId },
    include: {
      user: { select: { name: true } },
      batch: { select: { name: true } },
      results: {
        include: {
          session: {
            include: { topic: true },
          },
        },
        orderBy: { session: { heldOn: 'asc' } },
      },
    },
  });

  if (!trainee) {
    throw new Error('Trainee not found');
  }

  const firstName = trainee.user.name.split(' ')[0] || 'Trainee';
  const scores = trainee.results.map((r) => r.score);
  const errors = trainee.results.map((r) => r.errors);

  const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
  const avgErrors = errors.length ? Math.round((errors.reduce((a, b) => a + b, 0) / errors.length) * 10) / 10 : 0;
  const improvement = calculateImprovement(scores);
  const consistency = calculateConsistency(scores);

  const rawTopicData = trainee.results.map((r) => ({
    traineeId: trainee.id,
    traineeName: firstName,
    topicId: r.session.topic.id,
    topicName: r.session.topic.name,
    score: r.score,
    errors: r.errors,
    passMark: r.session.passMark,
  }));

  const topicRanks = rankWeakestTopics(rawTopicData);
  const strongestTopic = topicRanks.length > 0 ? topicRanks[topicRanks.length - 1].topicName : 'Foundations';
  const weakestTopic = topicRanks.length > 0 ? topicRanks[0].topicName : 'Practice Areas';

  let draftText = '';
  let provider: 'gemini' | 'rule_based_template' = 'rule_based_template';
  let isAi = false;

  // Try Gemini API if key is present
  if (process.env.GEMINI_API_KEY && process.env.ENABLE_AI_FEEDBACK !== 'false') {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `
You are a mentor writing a supportive, objective, 3-sentence performance feedback summary for a trainee named "${firstName}".
Here are the aggregated performance metrics:
- Overall Average Score: ${avgScore}/100
- Average Error Count: ${avgErrors}
- Progression Trend: ${improvement.trendDirection} (Slope: ${improvement.slope}, Delta: +${improvement.totalDelta} pts across ${scores.length} sessions)
- Score Stability: ${consistency.consistencyScore}/100
- Strongest Subject: ${strongestTopic}
- Focus Area for Improvement: ${weakestTopic}

Guidelines:
1. Highlight ${firstName}'s strongest areas and improvement trajectory.
2. Provide constructive encouragement for ${weakestTopic}.
3. Keep it professional, concise, and motivational. Maximum 3 sentences.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      if (response.text) {
        draftText = response.text.trim();
        provider = 'gemini';
        isAi = true;
      }
    } catch (aiErr) {
      logger.warn({ aiErr }, 'Gemini generation failed; falling back to deterministic template.');
    }
  }

  // Fallback to deterministic template if Gemini wasn't used or failed
  if (!draftText) {
    const trendPhrase =
      improvement.trendDirection === 'IMPROVING'
        ? `has shown strong positive momentum with a +${improvement.totalDelta} point climb`
        : improvement.trendDirection === 'DECLINING'
        ? `has shown slight fluctuation in recent sessions`
        : `has maintained steady and consistent performance`;

    draftText = `${firstName} ${trendPhrase}, currently holding an overall score average of ${avgScore} with high proficiency in ${strongestTopic}. Continuing to build deliberate practice in ${weakestTopic} will help solidify fundamentals and lower error rates. Overall, ${firstName}'s dedication and consistency (${consistency.consistencyScore}/100) provide a solid foundation for future evaluations.`;
    provider = 'rule_based_template';
    isAi = false;
  }

  // Record audit log for AI generation
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: 'AI_GENERATE',
      entity: 'trainee_feedback',
      entityId: params.traineeId,
      after: JSON.stringify({
        traineeId: params.traineeId,
        firstName,
        provider,
        statsSummary: { avgScore, strongestTopic, weakestTopic, delta: improvement.totalDelta },
      }),
      ip: params.ip,
    },
  });

  return {
    draftText,
    provider,
    isAiGenerated: isAi,
    disclaimer: 'AI draft: review before sharing',
  };
}
