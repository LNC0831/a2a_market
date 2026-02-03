/**
 * AI Interviewer Service
 *
 * Platform built-in AI service for interviewing Agents applying to become judges.
 * Conducts multi-turn conversations to assess an Agent's judgment capabilities.
 *
 * Features:
 * - Dynamic question generation based on category
 * - Multi-round interview (up to 5 rounds)
 * - Assessment of judgment skills, fairness, and domain knowledge
 * - Structured evaluation at the end
 */

const { v4: uuidv4 } = require('uuid');
const ai = require('../ai');

// Interview configuration by category
const INTERVIEW_CONFIG = {
  writing: {
    maxRounds: 5,
    passThreshold: 70,
    topics: [
      'evaluating content quality and structure',
      'assessing originality vs plagiarism',
      'judging tone and audience appropriateness',
      'handling edge cases in writing tasks',
      'dealing with disputes between clients and writers'
    ]
  },
  coding: {
    maxRounds: 5,
    passThreshold: 75,
    topics: [
      'evaluating code correctness and functionality',
      'assessing code quality and best practices',
      'identifying security vulnerabilities',
      'judging completeness of requirements',
      'handling disputes about code specifications'
    ]
  },
  translation: {
    maxRounds: 5,
    passThreshold: 70,
    topics: [
      'evaluating translation accuracy',
      'assessing fluency and naturalness',
      'handling technical terminology',
      'judging cultural adaptation',
      'resolving disputes about translation choices'
    ]
  },
  general: {
    maxRounds: 5,
    passThreshold: 65,
    topics: [
      'principles of fair evaluation',
      'handling conflict of interest',
      'understanding task requirements',
      'providing constructive feedback',
      'managing disputes and appeals'
    ]
  }
};

class AIInterviewer {
  constructor(db) {
    this.db = db;
  }

  /**
   * Build system prompt for the interviewer
   */
  buildSystemPrompt(category, round, totalRounds) {
    const config = INTERVIEW_CONFIG[category] || INTERVIEW_CONFIG.general;

    return `You are an experienced interviewer for the A2A Task Marketplace platform.
You are conducting a ${category} judge qualification interview.

Your role:
- Assess if this Agent can fairly and accurately evaluate ${category} tasks
- Ask thoughtful questions that test judgment, fairness, and domain knowledge
- Adapt your questions based on previous answers

This is round ${round} of ${totalRounds}.
${round === totalRounds ? 'This is the FINAL round. Prepare to give your assessment.' : ''}

Topics to cover: ${config.topics.join(', ')}

Guidelines:
- Ask ONE clear question per round
- Questions should be scenario-based when possible
- Evaluate both technical knowledge and judgment skills
- Be professional but conversational

You MUST respond in JSON format:
{
  "finished": <true only if round >= ${totalRounds} OR you have enough information>,
  "question": "<your next interview question - required if not finished>",
  "feedback": "<brief feedback on their previous answer - optional>",
  "currentScore": <0-100 preliminary score based on answers so far>,
  "assessment": "<your assessment - required if finished>",
  "passed": <true/false - required if finished>,
  "finalScore": <0-100 - required if finished>,
  "strengths": ["<strength 1>", "<strength 2>"] // required if finished,
  "areas_for_improvement": ["<area 1>", "<area 2>"] // required if finished
}`;
  }

  /**
   * Build user prompt with conversation history
   */
  buildUserPrompt(category, conversationHistory, round) {
    let prompt = `Interview for: ${category} judge position\n\n`;

    if (conversationHistory.length === 0) {
      prompt += `This is the START of the interview. Ask your first question to assess the candidate's qualifications.\n`;
      prompt += `The candidate is an AI Agent applying to become a ${category} judge on the platform.\n`;
    } else {
      prompt += `Conversation so far:\n\n`;
      for (const turn of conversationHistory) {
        if (turn.role === 'interviewer') {
          prompt += `Interviewer: ${turn.content}\n\n`;
        } else {
          prompt += `Candidate: ${turn.content}\n\n`;
        }
      }
      prompt += `\nBased on the conversation, ${round >= 5 ? 'provide your final assessment' : 'ask your next question'}.`;
    }

    return prompt;
  }

  /**
   * Parse AI interviewer response
   */
  parseResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (parsed.finished) {
        if (typeof parsed.passed !== 'boolean' || typeof parsed.finalScore !== 'number') {
          throw new Error('Invalid finished response');
        }
      } else {
        if (!parsed.question) {
          throw new Error('No question provided');
        }
      }

      return parsed;
    } catch (error) {
      console.error('[AIInterviewer] Failed to parse response:', error.message);
      throw new Error('Failed to parse interviewer response');
    }
  }

  /**
   * Start a new interview session
   * @param {string} agentId - Agent ID
   * @param {string} category - Judge category
   * @returns {Promise<Object>} Interview session with first question
   */
  async startInterview(agentId, category) {
    const config = INTERVIEW_CONFIG[category] || INTERVIEW_CONFIG.general;
    const interviewId = uuidv4();

    try {
      // Generate first question
      const systemPrompt = this.buildSystemPrompt(category, 1, config.maxRounds);
      const userPrompt = this.buildUserPrompt(category, [], 1);

      const aiResponse = await ai.complete('ai_interviewer', systemPrompt, userPrompt, {
        temperature: 0.7
      });

      const parsed = this.parseResponse(aiResponse.content);

      // Create interview session
      const session = {
        id: interviewId,
        agent_id: agentId,
        category,
        status: 'in_progress',
        current_round: 1,
        max_rounds: config.maxRounds,
        conversation: [
          { role: 'interviewer', content: parsed.question, round: 1 }
        ],
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      // Save to database
      await this.saveSession(session);

      return {
        success: true,
        interview_id: interviewId,
        category,
        current_round: 1,
        max_rounds: config.maxRounds,
        question: parsed.question,
        feedback: parsed.feedback,
        expires_at: session.expires_at
      };

    } catch (error) {
      console.error('[AIInterviewer] Failed to start interview:', error.message);
      throw error;
    }
  }

  /**
   * Submit an answer and get the next question (or final result)
   * @param {string} interviewId - Interview ID
   * @param {string} agentId - Agent ID
   * @param {string} answer - Agent's answer
   * @returns {Promise<Object>} Next question or final assessment
   */
  async submitAnswer(interviewId, agentId, answer) {
    const session = await this.getSession(interviewId, agentId);

    if (!session) {
      throw new Error('Interview session not found');
    }

    if (session.status !== 'in_progress') {
      throw new Error(`Interview already ${session.status}`);
    }

    if (new Date(session.expires_at) < new Date()) {
      await this.updateSessionStatus(interviewId, 'expired');
      throw new Error('Interview has expired');
    }

    const config = INTERVIEW_CONFIG[session.category] || INTERVIEW_CONFIG.general;
    const conversation = JSON.parse(session.conversation || '[]');

    // Add candidate's answer
    conversation.push({
      role: 'candidate',
      content: answer,
      round: session.current_round
    });

    const nextRound = session.current_round + 1;

    try {
      // Generate next question or final assessment
      const systemPrompt = this.buildSystemPrompt(session.category, nextRound, config.maxRounds);
      const userPrompt = this.buildUserPrompt(session.category, conversation, nextRound);

      const aiResponse = await ai.complete('ai_interviewer', systemPrompt, userPrompt, {
        temperature: 0.7
      });

      const parsed = this.parseResponse(aiResponse.content);

      if (parsed.finished || nextRound > config.maxRounds) {
        // Interview finished
        const finalScore = parsed.finalScore || parsed.currentScore || 0;
        const passed = parsed.passed ?? (finalScore >= config.passThreshold);

        // Update session
        await this.updateSession(interviewId, {
          status: passed ? 'passed' : 'failed',
          current_round: nextRound,
          conversation: JSON.stringify(conversation),
          final_score: finalScore,
          assessment: parsed.assessment,
          completed_at: new Date().toISOString()
        });

        // If passed, grant judge qualification
        if (passed) {
          await this.grantJudgeQualification(agentId, session.category);
        }

        return {
          success: true,
          interview_id: interviewId,
          finished: true,
          passed,
          score: finalScore,
          pass_threshold: config.passThreshold,
          assessment: parsed.assessment,
          strengths: parsed.strengths || [],
          areas_for_improvement: parsed.areas_for_improvement || [],
          message: passed
            ? `Congratulations! You are now qualified as a ${session.category} judge.`
            : `Interview not passed. You may reapply after 7 days.`
        };
      } else {
        // Continue interview
        conversation.push({
          role: 'interviewer',
          content: parsed.question,
          round: nextRound
        });

        await this.updateSession(interviewId, {
          current_round: nextRound,
          conversation: JSON.stringify(conversation)
        });

        return {
          success: true,
          interview_id: interviewId,
          finished: false,
          current_round: nextRound,
          max_rounds: config.maxRounds,
          question: parsed.question,
          feedback: parsed.feedback,
          preliminary_score: parsed.currentScore
        };
      }

    } catch (error) {
      console.error('[AIInterviewer] Failed to process answer:', error.message);
      throw error;
    }
  }

  /**
   * Save interview session to database
   */
  async saveSession(session) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO ai_interviews
         (id, agent_id, category, status, current_round, max_rounds, conversation, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.agent_id,
          session.category,
          session.status,
          session.current_round,
          session.max_rounds,
          JSON.stringify(session.conversation),
          session.created_at,
          session.expires_at
        ],
        (err) => {
          if (err) return reject(err);
          resolve(session);
        }
      );
    });
  }

  /**
   * Get interview session
   */
  async getSession(interviewId, agentId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM ai_interviews WHERE id = ? AND agent_id = ?',
        [interviewId, agentId],
        (err, session) => {
          if (err) return reject(err);
          resolve(session);
        }
      );
    });
  }

  /**
   * Update session status
   */
  async updateSessionStatus(interviewId, status) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE ai_interviews SET status = ? WHERE id = ?',
        [status, interviewId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * Update session
   */
  async updateSession(interviewId, updates) {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), interviewId];

    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE ai_interviews SET ${fields} WHERE id = ?`,
        values,
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * Grant judge qualification to an agent
   */
  async grantJudgeQualification(agentId, category) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, agent) => {
        if (err) return reject(err);
        if (!agent) return reject(new Error('Agent not found'));

        const categories = JSON.parse(agent.judge_categories || '[]');
        if (!categories.includes(category)) {
          categories.push(category);
        }

        this.db.run(
          `UPDATE agents SET
           is_judge = 1,
           judge_categories = ?,
           judge_qualified_at = COALESCE(judge_qualified_at, NOW())
           WHERE id = ?`,
          [JSON.stringify(categories), agentId],
          (err) => {
            if (err) return reject(err);
            console.log(`[AIInterviewer] Granted ${category} judge qualification to agent ${agentId}`);
            resolve({ success: true });
          }
        );
      });
    });
  }

  /**
   * Get interview status
   */
  async getInterviewStatus(interviewId, agentId) {
    const session = await this.getSession(interviewId, agentId);

    if (!session) {
      return { exists: false };
    }

    const conversation = JSON.parse(session.conversation || '[]');

    return {
      exists: true,
      interview_id: session.id,
      category: session.category,
      status: session.status,
      current_round: session.current_round,
      max_rounds: session.max_rounds,
      conversation_length: conversation.length,
      final_score: session.final_score,
      assessment: session.assessment,
      created_at: session.created_at,
      expires_at: session.expires_at,
      completed_at: session.completed_at
    };
  }

  /**
   * Check if agent has a pending interview
   */
  async hasPendingInterview(agentId, category) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM ai_interviews
         WHERE agent_id = ? AND category = ? AND status = 'in_progress'
         ORDER BY created_at DESC LIMIT 1`,
        [agentId, category],
        (err, interview) => {
          if (err) return reject(err);
          resolve(interview);
        }
      );
    });
  }
}

module.exports = AIInterviewer;
