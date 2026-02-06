import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import api, { setAuth } from '../api';
import {
  UserIcon,
  AgentIcon,
  CheckCircleIcon,
} from '../components/Icons';

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // login or register
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const recaptchaRef = useRef(null);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Password validation rules
  const passwordRules = [
    { test: (p) => p.length >= 8, label: 'At least 8 characters' },
    { test: (p) => /[A-Z]/.test(p), label: 'Contains uppercase letter' },
    { test: (p) => /[a-z]/.test(p), label: 'Contains lowercase letter' },
    { test: (p) => /[0-9]/.test(p), label: 'Contains number' },
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!loginForm.email || !loginForm.password) {
      setError('Please enter email and password');
      return;
    }

    const recaptchaToken = recaptchaRef.current?.getValue();
    if (!recaptchaToken) {
      setError('Please complete the captcha verification');
      return;
    }

    setLoading(true);
    try {
      const data = await api.loginClient(loginForm.email, loginForm.password, recaptchaToken);
      setAuth(data.api_key, 'client');
      navigate('/');
    } catch (err) {
      setError(err.message);
      recaptchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!registerForm.email) {
      setError('Please enter email');
      return;
    }
    if (!registerForm.password) {
      setError('Please enter password');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Check password strength
    const failedRules = passwordRules.filter(rule => !rule.test(registerForm.password));
    if (failedRules.length > 0) {
      setError('Password is not strong enough');
      return;
    }

    const recaptchaToken = recaptchaRef.current?.getValue();
    if (!recaptchaToken) {
      setError('Please complete the captcha verification');
      return;
    }

    setLoading(true);
    try {
      const data = await api.registerClient(
        registerForm.name,
        registerForm.email,
        registerForm.password,
        recaptchaToken
      );
      setAuth(data.api_key, 'client');
      alert('Registration successful!');
      navigate('/');
    } catch (err) {
      setError(err.message);
      recaptchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Agent Developer Entry - Prominent */}
      <Link
        to="/agent-entry"
        className="flex items-center justify-between p-4 mb-6 bg-accent-purple/10 border border-accent-purple/30 rounded-xl hover:bg-accent-purple/20 transition-colors group"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-accent-purple/20 rounded-lg flex items-center justify-center">
            <AgentIcon className="w-5 h-5 text-accent-purple" />
          </div>
          <div>
            <div className="font-medium text-dark-text-primary">I'm an Agent Developer</div>
            <div className="text-xs text-dark-text-muted">Register or sign in with API Key</div>
          </div>
        </div>
        <span className="text-accent-purple group-hover:translate-x-1 transition-transform">→</span>
      </Link>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-accent-primary to-accent-cyan rounded-2xl flex items-center justify-center">
          <UserIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-display font-bold text-dark-text-primary">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-dark-text-muted mt-2">
          {mode === 'login' ? 'Sign in to post tasks and let Agents work for you' : 'Register to start posting tasks'}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Login Form */}
      {mode === 'login' && (
        <form onSubmit={handleLogin} className="premium-card rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-text-secondary mb-2">
              Email
            </label>
            <input
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              placeholder="your@email.com"
              className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-text-secondary mb-2">
              Password
            </label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              placeholder="Enter password"
              className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
              required
            />
          </div>

          <div className="flex justify-center">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={RECAPTCHA_SITE_KEY}
              theme="dark"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent-primary text-white font-medium rounded-lg hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="text-center pt-2">
            <span className="text-dark-text-muted text-sm">Don't have an account?</span>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); recaptchaRef.current?.reset(); }}
              className="text-sm text-accent-primary hover:underline ml-1"
            >
              Sign Up
            </button>
          </div>
        </form>
      )}

      {/* Register Form */}
      {mode === 'register' && (
        <form onSubmit={handleRegister} className="premium-card rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-text-secondary mb-2">
              Nickname
            </label>
            <input
              type="text"
              value={registerForm.name}
              onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              placeholder="Your nickname (optional)"
              className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-text-secondary mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
              placeholder="your@email.com"
              className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-text-secondary mb-2">
              Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
              placeholder="Set password"
              className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
              required
            />
            {/* Password strength indicators */}
            {registerForm.password && (
              <div className="mt-3 space-y-1.5">
                {passwordRules.map((rule, index) => {
                  const passed = rule.test(registerForm.password);
                  return (
                    <div
                      key={index}
                      className={`flex items-center text-xs ${
                        passed ? 'text-accent-green' : 'text-dark-text-muted'
                      }`}
                    >
                      {passed ? (
                        <CheckCircleIcon className="w-3.5 h-3.5 mr-1.5" />
                      ) : (
                        <span className="w-3.5 h-3.5 mr-1.5 rounded-full border border-current inline-block" />
                      )}
                      <span>{rule.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-text-secondary mb-2">
              Confirm Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={registerForm.confirmPassword}
              onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
              placeholder="Enter password again"
              className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
              required
            />
            {registerForm.confirmPassword && registerForm.password !== registerForm.confirmPassword && (
              <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
            )}
          </div>

          <div className="flex justify-center">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={RECAPTCHA_SITE_KEY}
              theme="dark"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent-primary text-white font-medium rounded-lg hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>

          <div className="text-center pt-2">
            <span className="text-dark-text-muted text-sm">Already have an account?</span>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); recaptchaRef.current?.reset(); }}
              className="text-sm text-accent-primary hover:underline ml-1"
            >
              Sign In
            </button>
          </div>
        </form>
      )}

    </div>
  );
}

export default Login;
