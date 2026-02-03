/**
 * Review Orchestrator Service
 *
 * Implements the "Progressive Activation" architecture for task review.
 * Coordinates between AI Judge (Tier 1) and External Judges (Tier 2).
 *
 * Design Philosophy:
 * - Build complete skeleton now, activate progressively via config
 * - V1: Pure AI Judge (current)
 * - V2: Record external opinions
 * - V3: External opinions have weight
 * - V4: Full decentralization
 *
 * Key Principles:
 * - Never block waiting for any single agent
 * - Always have automated fallbacks
 * - Trust is earned through data, not assumed
 */

const { v4: uuidv4 } = require('uuid');
const AIJudge = require('./AIJudge');
const reviewConfig = require('../config/review');

class ReviewOrchestrator {
  constructor(db) {
    this.db = db;
    this.aiJudge = new AIJudge(db);
    this.config = reviewConfig.getConfig();
    this.configVersion = reviewConfig.current;
  }

  /**
   * Main entry point: process a task submission
   *
   * @param {string} taskId - Task ID
   * @param {string} result - Submitted result
   * @returns {Promise<Object>} Review result with decision
   */
  async processSubmission(taskId, result) {
    const startTime = Date.now();

    try {
      // Step 1: Always run AI Judge (Tier 1)
      console.log(`[ReviewOrchestrator] Processing submission for task ${taskId}`);
      const aiResult = await this.aiJudge.judge(taskId);

      // Step 2: Determine if we need Tier 2
      const needsTier2 = this.shouldEscalateToTier2(aiResult);

      // Step 3: Handle based on config and result
      let finalResult;
      let reviewTier = 'tier1';

      if (needsTier2 && this.config.tier2Enabled) {
        reviewTier = 'tier2';
        // Assign to external judges (async, non-blocking)
        await this.assignToExternalJudges(taskId, aiResult);

        // For now, still return AI result (external reviews come later)
        // In V2+, this will be updated when external reviews come in
        finalResult = this.makeDecision(aiResult, [], reviewTier);
      } else {
        // Pure AI decision
        finalResult = this.makeDecision(aiResult, [], reviewTier);
      }

      // Step 4: Save orchestration result
      await this.saveOrchestrationResult(taskId, aiResult, finalResult, reviewTier);

      const executionTime = Date.now() - startTime;
      console.log(`[ReviewOrchestrator] Completed in ${executionTime}ms | Tier: ${reviewTier} | Score: ${aiResult.score} | Confidence: ${aiResult.confidence}`);

      return {
        success: true,
        ...finalResult,
        ai_judge: aiResult,
        review_tier: reviewTier,
        execution_time: executionTime
      };

    } catch (error) {
      console.error(`[ReviewOrchestrator] Error processing task ${taskId}:`, error.message);
      return {
        success: false,
        error: error.message,
        review_tier: 'error'
      };
    }
  }

  /**
   * Determine if case should escalate to Tier 2
   */
  shouldEscalateToTier2(aiResult) {
    // Use helper from config
    return reviewConfig.shouldEscalateToTier2(aiResult.score, aiResult.confidence);
  }

  /**
   * Make final decision based on available information
   */
  makeDecision(aiResult, externalReviews = [], reviewTier = 'tier1') {
    const config = this.config;

    // V1: Pure AI decision
    if (!config.consensusEnabled || externalReviews.length === 0) {
      return {
        decision: aiResult.passed ? 'approve' : 'reject',
        score: aiResult.score,
        confidence: aiResult.confidence,
        source: 'ai_only',
        passed: aiResult.passed,
        details: aiResult.details
      };
    }

    // V3/V4: Consensus calculation
    const votes = externalReviews.map(r => ({
      decision: r.decision,
      weight: r.weight || 1.0,
      score: r.score
    }));

    const consensus = reviewConfig.calculateConsensus(votes, aiResult.score, aiResult.confidence);

    return {
      decision: consensus.decision,
      score: aiResult.score, // Still use AI score as reference
      confidence: aiResult.confidence,
      source: consensus.source,
      passed: consensus.decision === 'approve',
      consensus_details: {
        approve_ratio: consensus.approveRatio,
        consensus_reached: consensus.consensusReached,
        total_votes: consensus.totalVotes
      },
      details: aiResult.details
    };
  }

  /**
   * Assign task to external judges for Tier 2 review
   * This is async and non-blocking
   */
  async assignToExternalJudges(taskId, aiResult) {
    const config = this.config;

    try {
      // Find eligible judges
      const judges = await this.findEligibleJudges(taskId, config.minJudgesRequired || 2);

      if (judges.length === 0) {
        console.log(`[ReviewOrchestrator] No eligible judges for task ${taskId}, will use AI decision`);
        return;
      }

      // Create assignments
      const expiresAt = new Date(Date.now() + (config.timeoutHours || 24) * 60 * 60 * 1000);

      for (const judge of judges) {
        await this.createAssignment(taskId, judge.id, expiresAt);
      }

      console.log(`[ReviewOrchestrator] Assigned task ${taskId} to ${judges.length} judges`);

    } catch (error) {
      console.error(`[ReviewOrchestrator] Failed to assign external judges:`, error.message);
      // Non-fatal: AI decision will be used
    }
  }

  /**
   * Find eligible external judges for a task
   */
  findEligibleJudges(taskId, count) {
    return new Promise((resolve, reject) => {
      // Get task info first
      this.db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
        if (err) return reject(err);
        if (!task) return resolve([]);

        const category = task.category || 'general';

        // Find judges who:
        // 1. Are certified judges
        // 2. Have the right category (or general)
        // 3. Are not the task executor
        // 4. Are not the task creator
        // 5. Are active
        this.db.all(
          `SELECT id, name, judge_rating, judge_accuracy, judge_avg_response_time
           FROM agents
           WHERE is_judge = 1
           AND status = 'active'
           AND id != ?
           AND id != COALESCE(?, '')
           AND (judge_categories LIKE ? OR judge_categories LIKE '%"general"%')
           ORDER BY judge_rating DESC, judge_accuracy DESC
           LIMIT ?`,
          [task.agent_id, task.client_id, `%"${category}"%`, count * 2], // Get more to allow filtering
          (err, judges) => {
            if (err) return reject(err);

            // For now, just take the top ones
            // In production, could use more sophisticated selection
            resolve(judges.slice(0, count));
          }
        );
      });
    });
  }

  /**
   * Create a review assignment
   */
  createAssignment(taskId, judgeId, expiresAt) {
    return new Promise((resolve, reject) => {
      const assignmentId = uuidv4();

      this.db.run(
        `INSERT INTO review_assignments
         (id, task_id, judge_id, status, assigned_at, expires_at, config_version)
         VALUES (?, ?, ?, 'assigned', NOW(), ?, ?)`,
        [assignmentId, taskId, judgeId, expiresAt.toISOString(), this.configVersion],
        (err) => {
          if (err) return reject(err);
          resolve({ id: assignmentId });
        }
      );
    });
  }

  /**
   * Handle external judge review submission
   * Called when an external judge submits their review
   */
  async onExternalReview(taskId, reviewId, judgeId, reviewData) {
    const config = this.config;

    // If external reviews don't affect outcome in current config, just save and return
    if (config.externalJudgeImpact === 'none') {
      console.log(`[ReviewOrchestrator] External review saved but not impacting decision (V1 config)`);
      return { saved: true, impact: 'none' };
    }

    // Record the review
    await this.saveExternalReview(taskId, reviewId, judgeId, reviewData);

    // If advisory only, don't recalculate
    if (config.externalJudgeImpact === 'advisory') {
      console.log(`[ReviewOrchestrator] External review saved as advisory`);
      return { saved: true, impact: 'advisory' };
    }

    // V3/V4: Recalculate decision with new review
    const allReviews = await this.getExternalReviews(taskId);
    const aiResult = await this.getAIResult(taskId);

    if (!aiResult) {
      return { saved: true, impact: 'error', error: 'AI result not found' };
    }

    // Check if we have enough reviews for consensus
    if (allReviews.length >= (config.minJudgesRequired || 2)) {
      const newDecision = this.makeDecision(aiResult, allReviews, 'tier2');

      // Update task with new decision
      await this.updateTaskDecision(taskId, newDecision);

      // Log consensus calculation
      await this.logConsensus(taskId, aiResult, allReviews, newDecision);

      return {
        saved: true,
        impact: config.externalJudgeImpact,
        new_decision: newDecision.decision,
        consensus_details: newDecision.consensus_details
      };
    }

    return {
      saved: true,
      impact: 'pending',
      reviews_received: allReviews.length,
      reviews_needed: config.minJudgesRequired || 2
    };
  }

  /**
   * Save external review to database
   */
  saveExternalReview(taskId, reviewId, judgeId, reviewData) {
    return new Promise((resolve, reject) => {
      // Calculate response time
      this.db.get(
        'SELECT assigned_at FROM review_assignments WHERE task_id = ? AND judge_id = ?',
        [taskId, judgeId],
        (err, assignment) => {
          if (err) return reject(err);

          let responseTime = null;
          if (assignment && assignment.assigned_at) {
            responseTime = Math.floor((Date.now() - new Date(assignment.assigned_at).getTime()) / 1000);
          }

          // Update the review with response time
          this.db.run(
            `UPDATE judge_reviews SET
              response_time_seconds = ?,
              config_version = ?
             WHERE id = ?`,
            [responseTime, this.configVersion, reviewId],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        }
      );
    });
  }

  /**
   * Get all external reviews for a task
   */
  getExternalReviews(taskId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT jr.*, a.judge_rating
         FROM judge_reviews jr
         JOIN agents a ON jr.judge_id = a.id
         WHERE jr.task_id = ? AND jr.decision != 'pending'`,
        [taskId],
        (err, reviews) => {
          if (err) return reject(err);

          // Calculate weight for each review based on judge reputation
          const weightedReviews = reviews.map(r => ({
            ...r,
            weight: this.calculateJudgeWeight(r)
          }));

          resolve(weightedReviews);
        }
      );
    });
  }

  /**
   * Calculate judge's vote weight based on reputation
   */
  calculateJudgeWeight(review) {
    const weights = reviewConfig.assignment.reputationWeights;

    let weight = 1.0;

    // Rating factor (0-5 scale, normalize to 0.5-1.5)
    if (review.judge_rating) {
      weight *= 0.5 + (review.judge_rating / 5);
    }

    // Could add more factors here:
    // - Historical accuracy
    // - Response time
    // - Volume

    return Math.max(0.5, Math.min(2.0, weight)); // Clamp between 0.5 and 2.0
  }

  /**
   * Get AI Judge result for a task
   */
  getAIResult(taskId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT ai_judge_score, ai_judge_passed, ai_judge_confidence, ai_judge_details
         FROM tasks WHERE id = ?`,
        [taskId],
        (err, task) => {
          if (err) return reject(err);
          if (!task || task.ai_judge_score === null) return resolve(null);

          resolve({
            score: task.ai_judge_score,
            passed: task.ai_judge_passed === 1,
            confidence: task.ai_judge_confidence || 70,
            details: task.ai_judge_details ? JSON.parse(task.ai_judge_details) : {}
          });
        }
      );
    });
  }

  /**
   * Update task with new decision after consensus
   */
  updateTaskDecision(taskId, decision) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE tasks SET
          final_decision_source = ?,
          consensus_details = ?
         WHERE id = ?`,
        [
          decision.source,
          JSON.stringify(decision.consensus_details || {}),
          taskId
        ],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * Log consensus calculation for audit
   */
  logConsensus(taskId, aiResult, externalReviews, decision) {
    return new Promise((resolve, reject) => {
      const logId = uuidv4();

      this.db.run(
        `INSERT INTO review_consensus_log
         (id, task_id, ai_score, ai_confidence, ai_decision, external_votes,
          final_decision, approve_ratio, consensus_reached, total_votes,
          config_version, config_snapshot, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          logId,
          taskId,
          aiResult.score,
          aiResult.confidence,
          aiResult.passed ? 'approve' : 'reject',
          JSON.stringify(externalReviews.map(r => ({ decision: r.decision, weight: r.weight, score: r.score }))),
          decision.decision,
          decision.consensus_details?.approve_ratio,
          decision.consensus_details?.consensus_reached ? 1 : 0,
          decision.consensus_details?.total_votes,
          this.configVersion,
          JSON.stringify(this.config)
        ],
        (err) => {
          if (err) {
            console.error('[ReviewOrchestrator] Failed to log consensus:', err.message);
            // Non-fatal
          }
          resolve();
        }
      );
    });
  }

  /**
   * Save orchestration result to task
   */
  saveOrchestrationResult(taskId, aiResult, finalResult, reviewTier) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE tasks SET
          review_tier = ?,
          final_decision_source = ?
         WHERE id = ?`,
        [reviewTier, finalResult.source, taskId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * Handle timeout for Tier 2 reviews
   * Called by background job when assignments expire
   */
  async handleTimeout(taskId) {
    const fallbackAction = reviewConfig.fallback.onTimeout;

    if (fallbackAction === 'use_tier1') {
      // AI Judge decision becomes final
      console.log(`[ReviewOrchestrator] Tier 2 timeout for task ${taskId}, using AI decision`);

      await this.updateTaskDecision(taskId, {
        source: 'timeout',
        consensus_details: { timeout: true }
      });

      return { action: 'use_tier1' };
    }

    // Could implement other fallback strategies here
    return { action: fallbackAction };
  }

  /**
   * Get current config version
   */
  getConfigVersion() {
    return this.configVersion;
  }

  /**
   * Get active configuration
   */
  getActiveConfig() {
    return {
      version: this.configVersion,
      ...this.config
    };
  }
}

module.exports = ReviewOrchestrator;
