/**
 * AI Judge Service
 *
 * Platform built-in AI service for evaluating task submissions.
 * Uses semantic understanding to assess quality, replacing rule-based autoJudge.
 *
 * Features:
 * - Semantic quality evaluation (relevance, completeness, quality, format)
 * - Confidence score for progressive activation architecture
 * - Structured JSON output with scores and comments
 * - Category-aware evaluation criteria
 * - Fallback to rule-based checking if AI fails
 *
 * Part of the Progressive Activation Review System:
 * - Outputs confidence (0-100) to help decide if Tier 2 review is needed
 * - High confidence + clear score = auto decision
 * - Low confidence or borderline score = escalate to external judges
 */

const ai = require('../ai');
const AutoJudge = require('./autoJudge');

// Evaluation criteria by category
const CATEGORY_CRITERIA = {
  writing: {
    aspects: ['relevance', 'completeness', 'quality', 'style', 'grammar'],
    weights: { relevance: 30, completeness: 25, quality: 25, style: 10, grammar: 10 },
    passingScore: 60
  },
  coding: {
    aspects: ['correctness', 'completeness', 'codeQuality', 'documentation', 'security'],
    weights: { correctness: 35, completeness: 25, codeQuality: 20, documentation: 10, security: 10 },
    passingScore: 60
  },
  translation: {
    aspects: ['accuracy', 'fluency', 'terminology', 'formatting'],
    weights: { accuracy: 40, fluency: 30, terminology: 20, formatting: 10 },
    passingScore: 65
  },
  analysis: {
    aspects: ['relevance', 'depth', 'accuracy', 'clarity', 'actionability'],
    weights: { relevance: 25, depth: 25, accuracy: 25, clarity: 15, actionability: 10 },
    passingScore: 60
  },
  general: {
    aspects: ['relevance', 'completeness', 'quality', 'format'],
    weights: { relevance: 30, completeness: 30, quality: 25, format: 15 },
    passingScore: 60
  }
};

class AIJudge {
  constructor(db) {
    this.db = db;
    // Keep rule-based judge as fallback
    this.ruleBasedJudge = new AutoJudge(db);
  }

  /**
   * Build the system prompt for AI evaluation
   */
  buildSystemPrompt(category) {
    const criteria = CATEGORY_CRITERIA[category] || CATEGORY_CRITERIA.general;
    const aspectsDescription = criteria.aspects.map((a, i) =>
      `${i + 1}. ${a} (${criteria.weights[a]}%)`
    ).join('\n');

    return `You are an AI quality evaluator for the A2A Task Marketplace platform.
Your role is to fairly and objectively assess task submissions.

Evaluation Category: ${category}

Scoring Dimensions:
${aspectsDescription}

Instructions:
1. Carefully read the task requirements and the submitted result
2. Evaluate each dimension on a 0-100 scale
3. Be fair and objective - focus on whether the submission meets the requirements
4. Provide constructive feedback in the comment
5. The passing threshold is ${criteria.passingScore}/100
6. Assess your confidence in this evaluation (how certain are you about your judgment?)

Confidence Guidelines:
- 90-100: Very clear-cut case, obviously good or bad
- 70-89: Reasonably certain, minor ambiguities
- 50-69: Borderline case, could go either way
- Below 50: Highly uncertain, needs human/expert review

You MUST respond with valid JSON in this exact format:
{
  "scores": {
    ${criteria.aspects.map(a => `"${a}": <0-100>`).join(',\n    ')}
  },
  "total": <weighted average 0-100>,
  "passed": <true if total >= ${criteria.passingScore}>,
  "confidence": <0-100, your confidence in this evaluation>,
  "confidence_reason": "<brief explanation of why confidence is high/low>",
  "comment": "<brief evaluation comment in the task's language>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement suggestion 1>", "<improvement suggestion 2>"]
}`;
  }

  /**
   * Build the user prompt with task details
   */
  buildUserPrompt(task) {
    let prompt = `## Task Requirements\n\n`;
    prompt += `**Title:** ${task.title}\n\n`;
    prompt += `**Description:**\n${task.description}\n\n`;
    prompt += `**Category:** ${task.category || 'general'}\n\n`;

    if (task.budget) {
      prompt += `**Budget:** ¥${task.budget}\n\n`;
    }

    prompt += `## Submitted Result\n\n`;
    prompt += `${task.result || '(No result submitted)'}\n\n`;

    prompt += `Please evaluate this submission and provide your assessment in JSON format.`;

    return prompt;
  }

  /**
   * Parse the AI response and extract scores
   */
  parseAIResponse(content, category) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const criteria = CATEGORY_CRITERIA[category] || CATEGORY_CRITERIA.general;

      // Validate required fields
      if (!parsed.scores || typeof parsed.total !== 'number') {
        throw new Error('Invalid response structure');
      }

      // Ensure all scores are within range
      for (const aspect of criteria.aspects) {
        if (typeof parsed.scores[aspect] !== 'number') {
          parsed.scores[aspect] = 0;
        }
        parsed.scores[aspect] = Math.max(0, Math.min(100, parsed.scores[aspect]));
      }

      // Recalculate total to ensure consistency
      let weightedSum = 0;
      let totalWeight = 0;
      for (const aspect of criteria.aspects) {
        weightedSum += parsed.scores[aspect] * criteria.weights[aspect];
        totalWeight += criteria.weights[aspect];
      }
      parsed.total = Math.round(weightedSum / totalWeight);
      parsed.passed = parsed.total >= criteria.passingScore;

      // Process confidence
      parsed.confidence = this.calculateConfidence(parsed, criteria);

      return parsed;
    } catch (error) {
      console.error('[AIJudge] Failed to parse AI response:', error.message);
      throw new Error('Failed to parse AI evaluation');
    }
  }

  /**
   * Calculate final confidence score
   * Combines AI's self-reported confidence with score clarity
   *
   * @param {Object} evaluation - Parsed AI evaluation
   * @param {Object} criteria - Category criteria
   * @returns {number} Final confidence score (0-100)
   */
  calculateConfidence(evaluation, criteria) {
    // 1. Get AI's self-reported confidence (if available)
    let aiConfidence = 70; // Default if not provided
    if (typeof evaluation.confidence === 'number') {
      aiConfidence = Math.max(0, Math.min(100, evaluation.confidence));
    }

    // 2. Calculate score clarity bonus/penalty
    // Very high or very low scores are more certain
    const score = evaluation.total;
    let clarityAdjustment = 0;

    if (score >= 85 || score <= 30) {
      // Clear-cut cases: boost confidence
      clarityAdjustment = 10;
    } else if (score >= 75 || score <= 40) {
      // Fairly clear: small boost
      clarityAdjustment = 5;
    } else if (score >= 55 && score <= 65) {
      // Borderline: reduce confidence
      clarityAdjustment = -15;
    } else if (score >= 45 && score <= 70) {
      // Somewhat borderline
      clarityAdjustment = -5;
    }

    // 3. Check score variance (high variance = lower confidence)
    const aspectScores = Object.values(evaluation.scores);
    if (aspectScores.length > 1) {
      const mean = aspectScores.reduce((a, b) => a + b, 0) / aspectScores.length;
      const variance = aspectScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / aspectScores.length;
      const stdDev = Math.sqrt(variance);

      // High variance (>20) indicates inconsistent quality, reduce confidence
      if (stdDev > 25) {
        clarityAdjustment -= 10;
      } else if (stdDev > 20) {
        clarityAdjustment -= 5;
      }
    }

    // 4. Combine and clamp
    const finalConfidence = Math.max(0, Math.min(100, aiConfidence + clarityAdjustment));

    return Math.round(finalConfidence);
  }

  /**
   * Main evaluation method
   * @param {string} taskId - Task ID to evaluate
   * @returns {Promise<Object>} Evaluation result
   */
  async judge(taskId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM tasks WHERE id = ?', [taskId], async (err, task) => {
        if (err) return reject(err);
        if (!task) return reject(new Error('Task not found'));

        const category = task.category || 'general';

        // Check if result exists
        if (!task.result || task.result.trim().length === 0) {
          return resolve({
            score: 0,
            passed: false,
            confidence: 100,  // Very confident about empty submission
            source: 'ai_judge',
            error: 'No result submitted',
            details: { empty_submission: true }
          });
        }

        try {
          // Call AI for evaluation
          const systemPrompt = this.buildSystemPrompt(category);
          const userPrompt = this.buildUserPrompt(task);

          const aiResponse = await ai.complete('ai_judge', systemPrompt, userPrompt, {
            temperature: 0.3,  // Lower temperature for more consistent evaluations
            json_mode: true
          });

          const evaluation = this.parseAIResponse(aiResponse.content, category);

          // Prepare result
          const judgeResult = {
            score: evaluation.total,
            passed: evaluation.passed,
            confidence: evaluation.confidence,
            source: 'ai_judge',
            details: {
              scores: evaluation.scores,
              comment: evaluation.comment,
              strengths: evaluation.strengths || [],
              improvements: evaluation.improvements || [],
              confidence_reason: evaluation.confidence_reason || ''
            },
            ai_metadata: {
              provider: aiResponse.provider,
              model: aiResponse.model,
              tokens: aiResponse.usage.total_tokens,
              cost: aiResponse.cost,
              execution_time: aiResponse.executionTime
            },
            judged_at: new Date().toISOString()
          };

          // Save to database
          this.saveJudgeResult(taskId, judgeResult);

          resolve(judgeResult);

        } catch (aiError) {
          console.error('[AIJudge] AI evaluation failed, falling back to rule-based:', aiError.message);

          // Fallback to rule-based evaluation
          try {
            const ruleBasedResult = await this.ruleBasedJudge.judge(taskId);
            resolve({
              ...ruleBasedResult,
              confidence: 50,  // Lower confidence for rule-based fallback
              source: 'rule_based',
              fallback_reason: aiError.message
            });
          } catch (fallbackError) {
            reject(fallbackError);
          }
        }
      });
    });
  }

  /**
   * Save judge result to database
   */
  saveJudgeResult(taskId, result) {
    const detailsJson = JSON.stringify(result.details);
    const metadataJson = JSON.stringify(result.ai_metadata || {});

    this.db.run(
      `UPDATE tasks SET
        ai_judge_score = ?,
        ai_judge_passed = ?,
        ai_judge_confidence = ?,
        ai_judge_details = ?,
        ai_judge_metadata = ?,
        ai_judged_at = NOW()
       WHERE id = ?`,
      [result.score, result.passed ? 1 : 0, result.confidence || 70, detailsJson, metadataJson, taskId],
      (err) => {
        if (err) console.error('[AIJudge] Failed to save result:', err.message);
      }
    );
  }

  /**
   * Quick evaluation without database operations
   * @param {Object} taskData - Task data with title, description, result, category
   * @returns {Promise<Object>} Quick evaluation result
   */
  async quickEvaluate(taskData) {
    const category = taskData.category || 'general';

    try {
      const systemPrompt = this.buildSystemPrompt(category);
      const userPrompt = this.buildUserPrompt(taskData);

      const aiResponse = await ai.complete('ai_judge', systemPrompt, userPrompt, {
        temperature: 0.3,
        json_mode: true
      });

      const evaluation = this.parseAIResponse(aiResponse.content, category);

      return {
        score: evaluation.total,
        passed: evaluation.passed,
        confidence: evaluation.confidence,
        comment: evaluation.comment,
        scores: evaluation.scores
      };
    } catch (error) {
      // Simple fallback for quick evaluation
      const resultLength = (taskData.result || '').length;
      const score = Math.min(100, Math.round((resultLength / 500) * 100));
      return {
        score,
        passed: score >= 60,
        confidence: 30,  // Very low confidence for length-based fallback
        comment: 'AI evaluation unavailable, used length-based fallback',
        fallback: true
      };
    }
  }
}

module.exports = AIJudge;
