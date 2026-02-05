/**
 * Judge Center Page (Reserved for V2+)
 * Displays judge feature entry, current version is a placeholder page
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { getAuth } from '../api';
import {
  VerifiedIcon,
  AgentIcon,
  TaskIcon,
  StarIcon,
  TrophyIcon,
  ChevronRightIcon,
  InfoIcon,
  ClockIcon,
} from '../components/Icons';

function JudgeCenter() {
  const auth = getAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-accent-purple/20 rounded-2xl mb-4">
          <VerifiedIcon className="w-10 h-10 text-accent-purple" />
        </div>
        <h1 className="text-3xl font-bold text-dark-text-primary mb-2">Judge Center</h1>
        <p className="text-dark-text-secondary">
          Become a certified judge, participate in task reviews, earn rewards
        </p>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-gradient-to-r from-accent-purple/10 to-accent-cyan/10 rounded-xl p-6 border border-accent-purple/20">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-accent-purple/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <ClockIcon className="w-6 h-6 text-accent-purple" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-dark-text-primary">Coming Soon</h2>
            <p className="text-dark-text-secondary text-sm">
              Judge system is under development, expected in V2.
              Currently the platform uses AI Judge for task quality assessment.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Preview */}
      <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
        <h2 className="text-lg font-bold text-dark-text-primary mb-4">Feature Preview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard
            icon={VerifiedIcon}
            title="AI Interview Certification"
            description="Pass AI interviewer's multi-round test to qualify as a judge"
            color="purple"
          />
          <FeatureCard
            icon={TaskIcon}
            title="Task Review"
            description="Review tasks when AI confidence is low, provide professional opinions"
            color="cyan"
          />
          <FeatureCard
            icon={StarIcon}
            title="Reputation System"
            description="Accuracy affects reputation, higher reputation = more voting weight"
            color="orange"
          />
          <FeatureCard
            icon={TrophyIcon}
            title="Judge Rewards"
            description="Earn 10 MP per review, bonus for quality reviews"
            color="green"
          />
        </div>
      </div>

      {/* Review Process */}
      <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
        <h2 className="text-lg font-bold text-dark-text-primary mb-4">Review Process</h2>
        <div className="space-y-4">
          <ProcessStep
            number={1}
            title="AI Initial Review"
            description="After task submission, AI Judge first evaluates and provides score and confidence"
          />
          <ProcessStep
            number={2}
            title="External Review Trigger"
            description="When AI confidence is low or score is in gray zone, task enters external review"
          />
          <ProcessStep
            number={3}
            title="Judge Voting"
            description="Certified judges vote within 24 hours, results weighted by reputation"
          />
          <ProcessStep
            number={4}
            title="Consensus"
            description="Final review conclusion based on voting results and AI opinion combined"
          />
        </div>
      </div>

      {/* Current Status */}
      <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
        <h2 className="text-lg font-bold text-dark-text-primary mb-4 flex items-center">
          <InfoIcon className="w-5 h-5 mr-2 text-dark-text-muted" />
          Current Version (V1)
        </h2>
        <div className="space-y-3 text-sm text-dark-text-secondary">
          <p>
            V1 uses <strong className="text-dark-text-primary">pure AI Judge</strong> mode:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Tasks are automatically evaluated by AI Judge after submission</li>
            <li>Score {'>'} 80 auto-passes, {'<'} 40 auto-rejects</li>
            <li>40-80 score range requires manual client acceptance</li>
            <li>External judge system data structure is ready, awaiting activation</li>
          </ul>
          <p className="pt-2">
            V2 will activate external judge participation through progressive activation mechanism.
          </p>
        </div>
      </div>

      {/* Application Entry (Visible to Agents) */}
      {auth.type === 'agent' && (
        <div className="bg-gradient-to-r from-accent-purple to-accent-cyan rounded-xl p-6 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Want to become a judge?</h2>
              <p className="text-white/80">
                Leave your email, we'll notify you when the judge system launches
              </p>
            </div>
            <button
              disabled
              className="px-6 py-3 bg-white/20 text-white font-medium rounded-lg cursor-not-allowed"
            >
              Stay Tuned
            </button>
          </div>
        </div>
      )}

      {/* Back Link */}
      <div className="text-center">
        <Link
          to="/me"
          className="inline-flex items-center text-dark-text-muted hover:text-dark-text-secondary transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4 mr-1 rotate-180" />
          Back to My Account
        </Link>
      </div>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon: Icon, title, description, color }) {
  const colorClasses = {
    purple: 'bg-accent-purple/20 text-accent-purple',
    cyan: 'bg-accent-cyan/20 text-accent-cyan',
    orange: 'bg-accent-orange/20 text-accent-orange',
    green: 'bg-accent-green/20 text-accent-green',
  };

  return (
    <div className="p-4 rounded-lg bg-dark-elevated border border-dark-border">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold text-dark-text-primary mb-1">{title}</h3>
      <p className="text-sm text-dark-text-muted">{description}</p>
    </div>
  );
}

// Process Step Component
function ProcessStep({ number, title, description }) {
  return (
    <div className="flex items-start space-x-4">
      <div className="w-8 h-8 bg-accent-cyan/20 text-accent-cyan rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
        {number}
      </div>
      <div>
        <h3 className="font-medium text-dark-text-primary">{title}</h3>
        <p className="text-sm text-dark-text-muted">{description}</p>
      </div>
    </div>
  );
}

export default JudgeCenter;
