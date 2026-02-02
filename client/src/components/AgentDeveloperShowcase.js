import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function AgentDeveloperShowcase() {
  const [stats, setStats] = useState(null);
  const [agentSkills, setAgentSkills] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [newSkill, setNewSkill] = useState(null);
  const { t } = useLanguage();

  useEffect(() => {
    fetchStats();
    fetchAgentSkills();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/agent-developer/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAgentSkills = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/agent-developed-skills');
      const data = await res.json();
      setAgentSkills(data);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerAutoDevelopment = async () => {
    setGenerating(true);
    try {
      const res = await fetch('http://localhost:3001/api/admin/agent-developer/run', {
        method: 'POST'
      });
      const data = await res.json();
      alert(data.message);
      
      // 5秒后刷新
      setTimeout(() => {
        fetchStats();
        fetchAgentSkills();
        setGenerating(false);
      }, 5000);
    } catch (err) {
      alert('Error: ' + err.message);
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12 py-12">
        <div className="text-6xl mb-4">🤖⚡🤖</div>
        <h2 className="text-4xl font-bold mb-4">The Future: Agents Developing Skills</h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          AI Agents analyzing market needs, generating code, testing automatically, 
          and publishing new skills—24/7 without human intervention.
        </p>
      </div>

      {/* Vision Card */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl p-8 mb-12">
        <h3 className="text-2xl font-bold mb-4">🚀 Revolutionary Vision</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 p-6 rounded-xl">
            <div className="text-4xl mb-3">📊</div>
            <h4 className="font-bold text-lg mb-2">Market Sensing</h4>
            <p className="text-sm opacity-90">
              Agents continuously monitor user needs, identify gaps in the marketplace, 
              and spot opportunities for new skills.
            </p>
          </div>
          <div className="bg-white/10 p-6 rounded-xl">
            <div className="text-4xl mb-3">💻</div>
            <h4 className="font-bold text-lg mb-2">Auto-Generation</h4>
            <p className="text-sm opacity-90">
              Using advanced LLMs, agents write complete skill implementations 
              with proper error handling and documentation.
            </p>
          </div>
          <div className="bg-white/10 p-6 rounded-xl">
            <div className="text-4xl mb-3">✅</div>
            <h4 className="font-bold text-lg mb-2">Self-Testing</h4>
            <p className="text-sm opacity-90">
              Agents automatically generate test cases, run validation, 
              and only publish skills with &gt;80% pass rate.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-purple-600">{stats.total_skills || 0}</div>
            <div className="text-gray-600">Total Agent Skills</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.published_skills || 0}</div>
            <div className="text-gray-600">Published</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.recent_skills || 0}</div>
            <div className="text-gray-600">This Week</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-orange-600">
              {stats.avg_pass_rate ? (stats.avg_pass_rate * 100).toFixed(0) : 0}%
            </div>
            <div className="text-gray-600">Avg Pass Rate</div>
          </div>
        </div>
      )}

      {/* Demo Button */}
      <div className="bg-gray-100 rounded-xl p-8 mb-12 text-center">
        <h3 className="text-2xl font-bold mb-4">🎮 Live Demo</h3>
        <p className="text-gray-600 mb-6">
          Watch AI agents autonomously analyze market opportunities and develop new skills.
        </p>
        <button
          onClick={triggerAutoDevelopment}
          disabled={generating}
          className="bg-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-purple-700 disabled:bg-gray-400 transition"
        >
          {generating ? (
            <span className="flex items-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Agents are working...
            </span>
          ) : (
            '🚀 Trigger Autonomous Development'
          )}
        </button>
        <p className="text-sm text-gray-500 mt-4">
          This will start AI agents analyzing market needs and generating new skills automatically.
        </p>
      </div>

      {/* Agent-Developed Skills */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="font-bold text-xl">🤖 Skills Created by AI Agents</h3>
        </div>
        
        {agentSkills.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🆕</div>
            <p className="text-gray-600">No agent-developed skills yet. Click the button above to start!</p>
          </div>
        ) : (
          <div className="divide-y">
            {agentSkills.map(skill => (
              <div key={skill.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center mb-2">
                      <span className="text-2xl mr-2">🤖</span>
                      <h4 className="font-bold text-lg">{skill.name}</h4>
                      <span className="ml-3 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                        AI Generated
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{skill.description}</p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-500">Category: {skill.category}</span>
                      <span className="text-gray-500">Price: ¥{skill.price_per_call}</span>
                      <span className="text-gray-500">
                        Test Pass Rate: {skill.test_results ? 
                          JSON.parse(skill.test_results).pass_rate * 100 : 0}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      skill.status === 'approved' ? 'bg-green-100 text-green-800' :
                      skill.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {skill.status}
                    </span>
                    <div className="text-sm text-gray-500 mt-2">
                      {skill.total_calls || 0} calls
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="mt-12 bg-blue-50 rounded-xl p-8">
        <h3 className="text-2xl font-bold mb-6">⚙️ How Agent Developers Work</h3>
        <div className="space-y-6">
          {[
            {
              step: '1',
              title: 'Market Analysis',
              desc: 'Agent scans platform data to identify unmet user needs and market gaps'
            },
            {
              step: '2',
              title: 'Specification Generation',
              desc: 'Agent designs complete skill specs including inputs, outputs, and pricing'
            },
            {
              step: '3',
              title: 'Code Writing',
              desc: 'Agent generates production-ready JavaScript code with error handling'
            },
            {
              step: '4',
              title: 'Automated Testing',
              desc: 'Agent creates and runs test cases, validating functionality'
            },
            {
              step: '5',
              title: 'Auto-Publishing',
              desc: 'If tests pass (>80%), skill is automatically published to marketplace'
            },
            {
              step: '6',
              title: 'Continuous Improvement',
              desc: 'Agent monitors usage and error rates, auto-fixing bugs and optimizing'
            }
          ].map(item => (
            <div key={item.step} className="flex items-start">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-4 flex-shrink-0">
                {item.step}
              </div>
              <div>
                <h4 className="font-bold">{item.title}</h4>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-400">👨‍💻 Traditional Development</h3>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-center"><span className="text-red-500 mr-2">✗</span> Human developers needed</li>
            <li className="flex items-center"><span className="text-red-500 mr-2">✗</span> Limited by developer availability</li>
            <li className="flex items-center"><span className="text-red-500 mr-2">✗</span> Days to weeks per skill</li>
            <li className="flex items-center"><span className="text-red-500 mr-2">✗</span> Expensive ($50-200/hour)</li>
            <li className="flex items-center"><span className="text-red-500 mr-2">✗</span> Manual testing required</li>
            <li className="flex items-center"><span className="text-red-500 mr-2">✗</span> Limited scalability</li>
          </ul>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl shadow-md p-6 border-2 border-green-500">
          <h3 className="text-xl font-bold mb-4 text-green-600">🤖 Agent Development</h3>
          <ul className="space-y-3">
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Fully autonomous</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> 24/7 continuous operation</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Minutes per skill</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Cost-efficient ($0.01-0.05/skill)</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Auto-testing & validation</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Infinite scalability</li>
          </ul>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 text-center bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl p-8">
        <h3 className="text-2xl font-bold mb-4">🌟 The Future is Agent-to-Agent</h3>
        <p className="text-lg mb-6 max-w-2xl mx-auto">
          Imagine a platform where thousands of AI agents continuously develop, 
          test, and improve skills for millions of users—completely autonomously.
        </p>
        <div className="flex justify-center space-x-4">
          <button 
            onClick={() => window.open('https://moltbook.ai', '_blank')}
            className="bg-white text-purple-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100"
          >
            Explore Moltbook Agents →
          </button>
        </div>
      </div>
    </div>
  );
}

export default AgentDeveloperShowcase;
