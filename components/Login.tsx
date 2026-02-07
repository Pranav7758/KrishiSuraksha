import React, { useState } from 'react';
import { Leaf, Mail, Lock, User, ArrowRight, AlertCircle, AlertTriangle } from 'lucide-react';
import { Language } from '../types';
import { getLabel } from '../translations';
import { signUp, signIn } from '../services/authService';

interface LoginProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ language, setLanguage, onLoginSuccess }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const languages = [
    { code: Language.HINDI, label: 'हिन्दी (Hindi)' },
    { code: Language.ENGLISH, label: 'English' },
    { code: Language.MARATHI, label: 'मराठी (Marathi)' },
    { code: Language.GUJARATI, label: 'ગુજરાતી (Gujarati)' },
    { code: Language.PUNJABI, label: 'ਪੰਜਾਬੀ (Punjabi)' },
    { code: Language.TAMIL, label: 'தமிழ் (Tamil)' },
    { code: Language.TELUGU, label: 'తెలుగు (Telugu)' },
    { code: Language.KANNADA, label: 'ಕನ್ನಡ (Kannada)' },
    { code: Language.MALAYALAM, label: 'മലയാളം (Malayalam)' },
    { code: Language.BENGALI, label: 'বাংলা (Bengali)' },
    { code: Language.ODIA, label: 'ଓଡ଼ିଆ (Odia)' },
  ];

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!email || !password) {
      setError(getLabel(language, 'requiredField'));
      return;
    }

    if (!validateEmail(email)) {
      setError(getLabel(language, 'invalidEmail'));
      return;
    }

    if (isSignup) {
      if (!fullName) {
        setError(getLabel(language, 'requiredField'));
        return;
      }

      if (password !== confirmPassword) {
        setError(getLabel(language, 'passwordMismatch'));
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignup) {
        await signUp(email, password, fullName);
        // After signup, automatically sign in
        await signIn(email, password);
      } else {
        await signIn(email, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(
        isSignup
          ? getLabel(language, 'signupError')
          : getLabel(language, 'loginError')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header with Language Selector */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-green-600 p-2 rounded-lg">
              <Leaf className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {getLabel(language, 'appName')}
            </h1>
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="px-3 py-1 bg-white border border-gray-300 rounded-full text-xs font-medium text-gray-700 appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-green-500"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Login/Signup Card */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8">
          {/* Title */}
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {isSignup ? getLabel(language, 'signupTitle') : getLabel(language, 'loginTitle')}
          </h2>
          <p className="text-gray-500 mb-6">
            {isSignup ? getLabel(language, 'signupDesc') : getLabel(language, 'loginDesc')}
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (Signup only) */}
            {isSignup && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {getLabel(language, 'fullName')}
                </label>
                <div className="relative">
                  <User
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={getLabel(language, 'fullName')}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {getLabel(language, 'email')}
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="farmer@example.com"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {getLabel(language, 'password')}
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Confirm Password (Signup only) */}
            {isSignup && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  {getLabel(language, 'confirmPassword')}
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {isSignup ? getLabel(language, 'signup') : getLabel(language, 'login')}
                </>
              ) : (
                <>
                  {isSignup ? getLabel(language, 'signup') : getLabel(language, 'login')}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Toggle Login/Signup */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              {isSignup ? getLabel(language, 'haveAccount') : getLabel(language, 'noAccount')}
              {' '}
              <button
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError('');
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                  setFullName('');
                }}
                className="text-green-600 font-bold hover:text-green-700 transition-colors"
              >
                {isSignup ? getLabel(language, 'login') : getLabel(language, 'signup')}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-6">
          {getLabel(language, 'appTagline')} • Secure • Offline-Ready • Free
        </p>
      </div>
    </div>
  );
};
