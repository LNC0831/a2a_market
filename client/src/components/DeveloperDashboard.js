import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function DeveloperDashboard({ onSubmitSkill }) {
  const [developer, setDeveloper] = useState(null);
  const [skills, setSkills] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalCalls: 0,
    totalRevenue: 0,
    monthlyRevenue: []
  });
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const developerId = localStorage.getItem('developerId');

  useEffect(() => {
    if (!developerId) {
      setLoading(false);
      return;
    }

    // 加载开发者数据
    fetch(`http://localhost:3001/api/developers/${developerId}`)
      .then(res => res.json())
      .then(data => {
        setDeveloper(data);
        return fetch(`http://localhost:3001/api/developers/${developerId}/skills`);
      })
      .then(res => res.json())
      .then(data => {
        setSkills(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [developerId]);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!developerId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">👋</div>
        <h2 className="text-3xl font-bold mb-4">Become a Developer</h2>
        <p className="text-gray-600 mb-6">
          Join our developer community and start earning by creating AI skills.
        </p>
        <button 
          onClick={() => window.location.href = '#/developer/register'}
          className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700"
        >
          Register Now →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-bold mb-2">Developer Dashboard</h2>
          <p className="text-gray-600">Manage your skills and track earnings</p>
        </div>
        <button 
          onClick={onSubmitSkill}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700"
        >
          + Submit New Skill
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-400 to-green-600 text-white rounded-xl p-6">
          <div className="text-sm opacity-80 mb-1">Total Earnings</div>
          <div className="text-3xl font-bold">
            ¥{developer?.total_earnings || 0}
          </div>
          <div className="text-sm mt-2 opacity-80">70% revenue share</div>
        </div>

        <div className="bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-xl p-6">
          <div className="text-sm opacity-80 mb-1">Total Calls</div>
          <div className="text-3xl font-bold">
            {analytics.totalCalls.toLocaleString()}
          </div>
          <div className="text-sm mt-2 opacity-80">Across all skills</div>
        </div>

        <div className="bg-gradient-to-br from-purple-400 to-purple-600 text-white rounded-xl p-6">
          <div className="text-sm opacity-80 mb-1">Active Skills</div>
          <div className="text-3xl font-bold">{skills.length}</div>
          <div className="text-sm mt-2 opacity-80">{skills.filter(s => s.status === 'pending_review').length} pending review</div>
        </div>

        <div className="bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-xl p-6">
          <div className="text-sm opacity-80 mb-1">Avg Rating</div>
          <div className="text-3xl font-bold">
            {developer?.rating?.toFixed(1) || '5.0'} ⭐
          </div>
          <div className="text-sm mt-2 opacity-80">Based on user feedback</div>
        </div>
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <h3 className="font-bold text-lg mb-4">Revenue Trend</h3>
        <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
          <span className="text-gray-500">📊 Revenue chart will appear here</span>
        </div>
      </div>

      {/* Skills List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-lg">Your Skills</h3>
          <span className="text-sm text-gray-500">{skills.length} total</span>
        </div>

        {skills.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🚀</div>
            <h4 className="text-xl font-bold mb-2">No Skills Yet</h4>
            <p className="text-gray-600 mb-4">Create your first skill and start earning!</p>
            <button 
              onClick={onSubmitSkill}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700"
            >
              Create Your First Skill →
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {skills.map(skill => (
              <div key={skill.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-lg">{skill.name}</h4>
                    <p className="text-gray-600 text-sm mt-1">{skill.description}</p>
                    <div className="flex items-center mt-2 space-x-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        skill.status === 'approved' ? 'bg-green-100 text-green-800' :
                        skill.status === 'pending_review' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {skill.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        ¥{skill.price_per_call} per call
                      </span>
                      <span className="text-sm text-gray-500">
                        ★ {skill.avg_rating?.toFixed(1) || '5.0'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      ¥{Math.round((skill.total_calls || 0) * skill.price_per_call * 0.7)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {skill.total_calls || 0} calls
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="mt-8 bg-blue-50 rounded-xl p-6">
        <h3 className="font-bold mb-4">💡 Tips to Maximize Earnings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg">
            <div className="font-bold mb-2">1. Price Competitively</div>
            <p className="text-sm text-gray-600">Start with lower prices to attract users, then increase as you build reputation.</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <div className="font-bold mb-2">2. Focus on Quality</div>
            <p className="text-sm text-gray-600">High-quality skills get better ratings, leading to more usage and higher rankings.</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <div className="font-bold mb-2">3. Solve Real Problems</div>
            <p className="text-sm text-gray-600">Build skills that address common pain points users face daily.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeveloperDashboard;
