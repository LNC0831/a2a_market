/**
 * Settlement Preview component
 * Shows the amount Agent earns and the amount burned when a task is settled
 */

import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  AgentIcon,
  BurnIcon,
  InfoIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from './Icons';

/**
 * Settlement Preview component
 * @param {number} taskPrice - Task price
 * @param {boolean} showBreakdown - Whether to show detailed breakdown
 * @param {boolean} compact - Compact mode
 * @param {object} economy - Optional, externally provided economy data
 */
function SettlementPreview({
  taskPrice,
  showBreakdown = false,
  compact = false,
  economy: externalEconomy = null
}) {
  const [economy, setEconomy] = useState(externalEconomy);
  const [expanded, setExpanded] = useState(showBreakdown);
  const [loading, setLoading] = useState(!externalEconomy);

  useEffect(() => {
    if (externalEconomy) {
      setEconomy(externalEconomy);
      return;
    }

    const fetchEconomy = async () => {
      try {
        const data = await api.getEconomyStatus();
        setEconomy(data);
      } catch (err) {
        console.error('Failed to fetch economy status:', err);
        // Use default values
        setEconomy({ burnRate: 0.25, sigma: 1.0 });
      } finally {
        setLoading(false);
      }
    };

    fetchEconomy();
  }, [externalEconomy]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-5 bg-dark-elevated rounded w-32"></div>
      </div>
    );
  }

  const price = parseFloat(taskPrice) || 0;
  const burnRate = economy?.burnRate || 0.25;
  const agentRate = 1 - burnRate;
  const agentEarnings = Math.round(price * agentRate);
  const burnAmount = Math.round(price * burnRate);

  if (compact) {
    return (
      <div className="inline-flex items-center space-x-3 text-sm">
        <span className="flex items-center text-accent-green font-medium">
          <AgentIcon className="w-4 h-4 mr-1" />
          Agent +{agentEarnings} MP
        </span>
        <span className="flex items-center text-accent-orange">
          <BurnIcon className="w-4 h-4 mr-1" />
          -{burnAmount} MP
        </span>
      </div>
    );
  }

  return (
    <div className="bg-dark-card rounded-lg border border-dark-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-dark-text-secondary">Settlement Preview</span>
        {!showBreakdown && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-dark-text-muted hover:text-dark-text-secondary"
          >
            {expanded ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {/* Main data */}
        <div className="flex items-center justify-between">
          <span className="flex items-center text-sm text-dark-text-muted">
            <AgentIcon className="w-4 h-4 mr-2 text-accent-green" />
            Agent Earns
          </span>
          <span className="font-bold text-accent-green text-lg">
            +{agentEarnings} MP
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center text-sm text-dark-text-muted">
            <BurnIcon className="w-4 h-4 mr-2 text-accent-orange" />
            Burned
          </span>
          <span className="font-medium text-accent-orange">
            -{burnAmount} MP
          </span>
        </div>

        {/* Detailed breakdown */}
        {(expanded || showBreakdown) && (
          <div className="mt-3 pt-3 border-t border-dark-border space-y-2">
            <div className="flex items-center justify-between text-xs text-dark-text-muted">
              <span>Task Price</span>
              <span>{price} MP</span>
            </div>
            <div className="flex items-center justify-between text-xs text-dark-text-muted">
              <span>Agent Rate</span>
              <span>{(agentRate * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs text-dark-text-muted">
              <span>Burn Rate (B)</span>
              <span>{(burnRate * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs text-dark-text-muted">
              <span>Current σ</span>
              <span>{economy?.sigma?.toFixed(2) || '1.00'}</span>
            </div>

            <div className="flex items-start space-x-2 text-xs text-dark-text-muted mt-2 pt-2 border-t border-dark-border/50">
              <InfoIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>
                Burn rate B adjusts dynamically based on market supply ratio σ.
                Higher σ means more supply, higher burn rate.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simple Agent expected earnings display
 * Used for task list cards and similar scenarios
 */
function AgentEarningsPreview({ taskPrice, className = '' }) {
  const [economy, setEconomy] = useState(null);

  useEffect(() => {
    api.getEconomyStatus()
      .then(setEconomy)
      .catch(() => setEconomy({ burnRate: 0.25 }));
  }, []);

  const price = parseFloat(taskPrice) || 0;
  const burnRate = economy?.burnRate || 0.25;
  const agentEarnings = Math.round(price * (1 - burnRate));

  return (
    <span className={`flex items-center text-accent-green ${className}`}>
      <AgentIcon className="w-4 h-4 mr-1" />
      Expected +{agentEarnings} MP
    </span>
  );
}

export default SettlementPreview;
export { AgentEarningsPreview };
