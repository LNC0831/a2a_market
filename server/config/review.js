/**
 * Review System Configuration
 *
 * Implements "Progressive Activation" architecture:
 * - Build the complete skeleton now
 * - Control activation level via configuration
 * - Upgrade by changing config, not code
 *
 * Philosophy: "Design for 2030, run in 2026, control time travel with config"
 */

module.exports = {
  // ===========================================
  // Version Configurations
  // ===========================================

  versions: {
    /**
     * V1: Pure AI Judge
     * - AI Judge makes all decisions
     * - External judges exist but are dormant
     * - Current production default
     */
    v1: {
      tier2Enabled: false,              // External judges not involved
      consensusEnabled: false,          // No voting/consensus
      externalJudgeImpact: 'none',      // none | advisory | voting | decisive
      confidenceThreshold: 70,          // Below this, would trigger Tier 2 (if enabled)
      autoApproveThreshold: 80,         // Score above this = auto approve
      autoRejectThreshold: 40,          // Score below this = auto reject
      timeoutHours: 24,                 // Tier 2 timeout (not used in V1)
    },

    /**
     * V2: Record External Opinions
     * - AI Judge makes decisions
     * - External judges can review, opinions are logged
     * - Used to accumulate data and validate external judge accuracy
     */
    v2: {
      tier2Enabled: true,
      consensusEnabled: false,
      externalJudgeImpact: 'advisory',  // Logged but doesn't affect outcome
      confidenceThreshold: 70,
      autoApproveThreshold: 80,
      autoRejectThreshold: 40,
      timeoutHours: 24,
      minJudgesRequired: 2,             // Min judges to assign
      maxJudgesRequired: 3,             // Max judges to assign
    },

    /**
     * V3: External Opinions Have Weight
     * - AI Judge gives initial score
     * - External judges vote on borderline cases
     * - Weighted consensus affects final decision
     */
    v3: {
      tier2Enabled: true,
      consensusEnabled: true,
      externalJudgeImpact: 'voting',
      confidenceThreshold: 70,
      autoApproveThreshold: 85,         // Stricter for auto-approve
      autoRejectThreshold: 35,          // Stricter for auto-reject
      timeoutHours: 24,
      minJudgesRequired: 2,
      maxJudgesRequired: 3,
      consensusThreshold: 0.66,         // 2/3 agreement needed
      aiJudgeWeight: 2.0,               // AI Judge counts as 2 votes
    },

    /**
     * V4: Full Decentralization
     * - AI Judge is just one vote among many
     * - External judges are the primary evaluators
     * - True multi-agent consensus
     */
    v4: {
      tier2Enabled: true,
      consensusEnabled: true,
      externalJudgeImpact: 'decisive',
      confidenceThreshold: 60,          // More cases go to Tier 2
      autoApproveThreshold: 90,         // Very strict for auto-approve
      autoRejectThreshold: 30,          // Very strict for auto-reject
      timeoutHours: 48,                 // Longer timeout for decentralized
      minJudgesRequired: 3,
      maxJudgesRequired: 5,
      consensusThreshold: 0.66,
      aiJudgeWeight: 1.0,               // AI Judge counts as 1 vote (same as others)
      aiJudgeAsOneVote: true,           // Explicit flag
    },
  },

  // ===========================================
  // Current Active Version
  // ===========================================
  current: 'v1',

  // ===========================================
  // Tier Definitions
  // ===========================================
  tiers: {
    tier1: {
      name: 'AI Judge',
      description: 'Platform built-in AI evaluation',
      handler: 'AIJudge',
    },
    tier2: {
      name: 'External Judges',
      description: 'Certified external judge agents',
      handler: 'ExternalJudgePool',
    },
    tier3: {
      name: 'Appeal / Escalation',
      description: 'Higher-level review for disputes',
      handler: 'AppealSystem',
    },
  },

  // ===========================================
  // Judge Assignment Configuration
  // ===========================================
  assignment: {
    // How to select judges
    strategy: 'reputation_weighted',    // random | round_robin | reputation_weighted

    // Reputation weight factors
    reputationWeights: {
      rating: 0.4,                      // 40% based on judge rating
      accuracy: 0.3,                    // 30% based on historical accuracy
      responseTime: 0.2,                // 20% based on avg response time
      volume: 0.1,                      // 10% based on review volume
    },

    // Avoid conflicts of interest
    exclusions: {
      excludeExecutor: true,            // Don't assign task executor as judge
      excludeCreator: true,             // Don't assign task creator as judge
      excludeRecentReviewers: true,     // Don't assign if reviewed recently
      recentReviewDays: 7,
    },
  },

  // ===========================================
  // Reward Configuration
  // ===========================================
  rewards: {
    // Base reward rate (percentage of task budget)
    baseRate: 0.05,                     // 5% of task budget per review

    // Bonuses
    fastResponseBonus: 0.01,            // +1% for responding within 2 hours
    fastResponseThresholdHours: 2,

    consensusBonus: 0.005,              // +0.5% for being in consensus

    // Penalties (reduce future assignment probability)
    timeoutPenalty: -0.1,               // -10% reputation for timeout
    wrongDecisionPenalty: -0.05,        // -5% for being overturned
  },

  // ===========================================
  // Timeout and Fallback
  // ===========================================
  fallback: {
    // What happens when Tier 2 times out
    onTimeout: 'use_tier1',             // use_tier1 | escalate_tier3 | manual_review

    // What happens when all tiers fail
    onAllFail: 'pending_manual',        // pending_manual | auto_approve | auto_reject

    // Grace period before timeout actions
    gracePeriodMinutes: 30,
  },

  // ===========================================
  // Helper Functions
  // ===========================================

  /**
   * Get the current active configuration
   */
  getConfig() {
    return this.versions[this.current];
  },

  /**
   * Check if a score should auto-approve
   */
  shouldAutoApprove(score, confidence) {
    const config = this.getConfig();
    return score >= config.autoApproveThreshold && confidence >= config.confidenceThreshold;
  },

  /**
   * Check if a score should auto-reject
   */
  shouldAutoReject(score, confidence) {
    const config = this.getConfig();
    return score <= config.autoRejectThreshold && confidence >= config.confidenceThreshold;
  },

  /**
   * Check if case should escalate to Tier 2
   */
  shouldEscalateToTier2(score, confidence) {
    const config = this.getConfig();
    if (!config.tier2Enabled) return false;

    // Escalate if confidence is low OR score is in borderline range
    const isBorderline = score > config.autoRejectThreshold && score < config.autoApproveThreshold;
    const isLowConfidence = confidence < config.confidenceThreshold;

    return isBorderline || isLowConfidence;
  },

  /**
   * Calculate weighted vote result
   */
  calculateConsensus(votes, aiScore, aiConfidence) {
    const config = this.getConfig();
    if (!config.consensusEnabled) {
      return { decision: aiScore >= 60 ? 'approve' : 'reject', source: 'ai_only' };
    }

    // Include AI as a vote
    const aiVote = {
      decision: aiScore >= 60 ? 'approve' : 'reject',
      weight: config.aiJudgeWeight || 1.0,
      score: aiScore,
    };

    const allVotes = [aiVote, ...votes];

    let approveWeight = 0;
    let rejectWeight = 0;
    let totalWeight = 0;

    for (const vote of allVotes) {
      totalWeight += vote.weight;
      if (vote.decision === 'approve') {
        approveWeight += vote.weight;
      } else {
        rejectWeight += vote.weight;
      }
    }

    const approveRatio = approveWeight / totalWeight;
    const consensusReached = approveRatio >= config.consensusThreshold ||
                             (1 - approveRatio) >= config.consensusThreshold;

    return {
      decision: approveRatio >= 0.5 ? 'approve' : 'reject',
      approveRatio,
      consensusReached,
      totalVotes: allVotes.length,
      source: 'consensus',
    };
  },
};
