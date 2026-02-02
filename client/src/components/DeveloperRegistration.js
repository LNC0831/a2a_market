import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function DeveloperRegistration({ onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    website: '',
    github: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('http://localhost:3001/api/developers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        localStorage.setItem('developerId', data.id);
        localStorage.setItem('developerEmail', formData.email);
        if (onSuccess) onSuccess(data);
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-green-600 mb-4">Welcome to the Developer Community!</h2>
        <p className="text-gray-600 mb-6">
          You're now a Skill Developer on AI Task Market. Start creating skills and earn money!
        </p>
        <div className="bg-blue-50 p-6 rounded-lg mb-6">
          <h3 className="font-bold mb-2">💰 Your Earnings</h3>
          <ul className="text-left space-y-2">
            <li>✅ <strong>70% revenue share</strong> - Industry leading rate</li>
            <li>✅ <strong>Instant payouts</strong> - Get paid immediately</li>
            <li>✅ <strong>No upfront fees</strong> - Free to join and publish</li>
            <li>✅ <strong>Global reach</strong> - Access to worldwide users</li>
          </ul>
        </div>
        <button 
          onClick={() => window.location.href = '#/developer/dashboard'}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700"
        >
          Go to Developer Dashboard →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Become a Skill Developer</h2>
        <p className="text-gray-600">Create AI skills, help users, and earn money</p>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-xl mb-8">
        <h3 className="font-bold text-lg mb-4">🚀 Why Join?</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center">
            <span className="text-2xl mr-2">💰</span>
            <div>
              <div className="font-bold">70% Revenue Share</div>
              <div className="text-sm text-gray-600">Highest in industry</div>
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-2xl mr-2">🌍</span>
            <div>
              <div className="font-bold">Global Market</div>
              <div className="text-sm text-gray-600">Worldwide users</div>
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-2xl mr-2">⚡</span>
            <div>
              <div className="font-bold">Instant Setup</div>
              <div className="text-sm text-gray-600">Start in minutes</div>
            </div>
          </div>
          <div className="flex items-center">
            <span className="text-2xl mr-2">🔒</span>
            <div>
              <div className="font-bold">Secure Platform</div>
              <div className="text-sm text-gray-600">Protected IP</div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
          <input
            type="text"
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Your name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
          <input
            type="email"
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="developer@example.com"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
          <textarea
            rows={3}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Tell us about yourself and your expertise..."
            value={formData.bio}
            onChange={(e) => setFormData({...formData, bio: e.target.value})}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Website (optional)</label>
          <input
            type="url"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="https://your-website.com"
            value={formData.website}
            onChange={(e) => setFormData({...formData, website: e.target.value})}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">GitHub (optional)</label>
          <input
            type="text"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="@username"
            value={formData.github}
            onChange={(e) => setFormData({...formData, github: e.target.value})}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-400 transition"
        >
          {submitting ? 'Registering...' : 'Join as Developer →'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          By joining, you agree to our Developer Terms and Revenue Share Agreement
        </p>
      </form>
    </div>
  );
}

export default DeveloperRegistration;
