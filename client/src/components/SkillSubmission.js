import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function SkillSubmission({ onBack }) {
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    base_price: 50,
    price_per_call: 50,
    endpoint_type: 'function',
    endpoint_code: '',
    test_input: ''
  });
  const { t } = useLanguage();

  useEffect(() => {
    fetch('http://localhost:3001/api/skill-categories')
      .then(res => res.json())
      .then(data => setCategories(data));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const developerEmail = localStorage.getItem('developerEmail') || 'anonymous@example.com';

    try {
      const response = await fetch('http://localhost:3001/api/skills/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          developer_email: developerEmail
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        alert(data.error || 'Submission failed');
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
        <div className="text-6xl mb-4">📋</div>
        <h2 className="text-3xl font-bold text-blue-600 mb-4">Skill Submitted!</h2>
        <p className="text-gray-600 mb-6">
          Your skill is now under review. We'll notify you within 1-3 business days.
        </p>
        <div className="bg-yellow-50 p-6 rounded-lg mb-6 text-left">
          <h3 className="font-bold mb-2">📋 Review Process:</h3>
          <ol className="list-decimal list-inside space-y-2">
            <li>Automated testing (immediate)</li>
            <li>Code quality review (1-2 days)</li>
            <li>Security assessment (1 day)</li>
            <li>Final approval and publishing</li>
          </ol>
        </div>
        <button 
          onClick={onBack}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700"
        >
          Submit Another Skill →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="mb-6 text-blue-600 hover:underline">
        ← Back to Dashboard
      </button>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Submit New Skill</h2>
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-bold">
          You earn 70% of all revenue
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="font-bold mb-2">💡 Skill Ideas:</h3>
        <div className="flex flex-wrap gap-2">
          {['Email Writer', 'Code Explainer', 'Data Cleaner', 'Image Caption', 'Meeting Summary', 'Bug Finder'].map(idea => (
            <span key={idea} className="bg-white px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-100"
                  onClick={() => setFormData({...formData, name: idea})}>
              {idea}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Skill Name *</label>
          <input
            type="text"
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Professional Email Writer"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
          <textarea
            required
            rows={3}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="What does this skill do? What input does it take? What output does it produce?"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
          <select
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={formData.category}
            onChange={(e) => setFormData({...formData, category: e.target.value})}
          >
            <option value="">Select a category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Base Price (¥) *</label>
            <input
              type="number"
              required
              min="10"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.base_price}
              onChange={(e) => setFormData({...formData, base_price: parseInt(e.target.value)})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price Per Call (¥) *</label>
            <input
              type="number"
              required
              min="10"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.price_per_call}
              onChange={(e) => setFormData({...formData, price_per_call: parseInt(e.target.value)})}
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Endpoint Type</label>
          <select
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            value={formData.endpoint_type}
            onChange={(e) => setFormData({...formData, endpoint_type: e.target.value})}
          >
            <option value="function">JavaScript Function (Recommended)</option>
            <option value="api">External API</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Implementation Code</label>
          <textarea
            rows={10}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder={`// Example skill implementation\nfunction executeSkill(input) {\n  // Your code here\n  // input: user provided data\n  // return: { success: true, result: \"output\" }\n  \n  const result = process(input);\n  \n  return {\n    success: true,\n    result: result,\n    metadata: {\n      processing_time: Date.now()\n    }\n  };\n}`}
            value={formData.endpoint_code}
            onChange={(e) => setFormData({...formData, endpoint_code: e.target.value})}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Test Input</label>
          <textarea
            rows={3}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Provide sample input for testing your skill"
            value={formData.test_input}
            onChange={(e) => setFormData({...formData, test_input: e.target.value})}
          />
        </div>

        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h4 className="font-bold mb-2">💰 Revenue Projection</h4>
          <div className="text-sm text-gray-600">
            <p>If your skill gets used 100 times/month:</p>
            <ul className="mt-2 space-y-1">
              <li>• Total Revenue: ¥{formData.price_per_call * 100}</li>
              <li>• Your Earnings (70%): ¥{Math.round(formData.price_per_call * 100 * 0.7)}</li>
              <li>• Platform Fee (30%): ¥{Math.round(formData.price_per_call * 100 * 0.3)}</li>
            </ul>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          {submitting ? 'Submitting...' : 'Submit Skill for Review →'}
        </button>
      </form>
    </div>
  );
}

export default SkillSubmission;
