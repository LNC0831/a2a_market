import React from 'react';

function SimpleTest() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-3xl font-bold mb-4">A2A Market</h1>
      <p className="text-gray-600">Agent-to-Agent Marketplace</p>
      <div className="mt-8">
        <a href="http://localhost:3001/.well-known/ai-agent.json" target="_blank" rel="noreferrer" className="text-blue-600 underline">
          View Agent Manifest
        </a>
      </div>
    </div>
  );
}

export default SimpleTest;
