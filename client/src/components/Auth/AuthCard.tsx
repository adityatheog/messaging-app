import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME } from '../../constants/config';
import { User, Lock, Shield, ArrowLeft, Eye, EyeOff, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface AuthCardProps {
  onBackToLanding?: () => void;
}

export const AuthCard: React.FC<AuthCardProps> = ({ onBackToLanding }) => {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'signin'>('create');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleCreatePrivacyIdentity = async () => {
    setError(null);
    setLoading(true);
    try {
      const randHex = Math.random().toString(36).substring(2, 8);
      const anonUsername = `user_${randHex}`;
      const anonPassword = `key_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      const anonFullName = `User ${randHex.toUpperCase()}`;
      await register(anonUsername, anonPassword, anonFullName);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Couldn't create identity. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeTab === 'create') {
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters.');
        return;
      }
      if (username.trim().length > 30) {
        setError('Username must be 30 characters or fewer.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (confirmPassword && password !== confirmPassword) {
        setError("Passwords don't match. Please check and try again.");
        return;
      }
    } else {
      if (!username.trim() || !password) {
        setError('Please enter your username and password.');
        return;
      }
    }

    setLoading(true);
    try {
      if (activeTab === 'create') {
        await register(username.trim(), password, fullName.trim());
      } else {
        await login(username.trim(), password);
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        (activeTab === 'signin' ? "Couldn't verify your account. Check your credentials and try again." : 'Registration failed. Please try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: '#0d1117' }}>
      {/* Top Bar with back link */}
      <div className="py-4 px-3 px-md-5 d-flex align-items-center justify-content-between border-bottom" style={{ borderColor: '#21262d' }}>
        <div className="d-flex align-items-center">
          <div
            className="d-flex align-items-center justify-content-center rounded-circle mr-2"
            style={{ width: '36px', height: '36px', backgroundColor: '#10b981' }}
          >
            <Shield size={20} className="text-white" />
          </div>
          <span className="h5 text-white font-weight-bold mb-0">{APP_NAME}</span>
        </div>

        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="btn btn-sm btn-outline-secondary text-light d-flex align-items-center"
            style={{ borderColor: '#30363d' }}
          >
            <ArrowLeft size={15} className="mr-1" />
            Home
          </button>
        )}
      </div>

      {/* Main Form Center */}
      <div className="container my-auto py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-5">
            <div
              className="card shadow-lg border-0"
              style={{
                backgroundColor: '#161b22',
                borderColor: '#30363d',
                borderRadius: '16px'
              }}
            >
              <div className="card-body p-4 p-md-5">
                {/* Header Copy */}
                <div className="text-center mb-4">
                  <h3 className="text-white font-weight-bold mb-2">
                    {activeTab === 'create' ? "Welcome. Let's get you connected." : 'Welcome back'}
                  </h3>
                  <p className="text-muted small mb-0">
                    {activeTab === 'create'
                      ? 'Private messaging without phone numbers or emails.'
                      : 'Sign in to access your conversations.'}
                  </p>
                </div>

                {/* Tabs switcher */}
                <div
                  className="d-flex p-1 mb-4 rounded"
                  style={{ backgroundColor: '#0d1117', border: '1px solid #30363d' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('create');
                      setError(null);
                    }}
                    className={`flex-grow-1 btn btn-sm py-2 font-weight-bold rounded ${
                      activeTab === 'create' ? 'btn-success text-white shadow-sm' : 'text-muted'
                    }`}
                    style={{ border: 'none' }}
                  >
                    Create Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setError(null);
                    }}
                    className={`flex-grow-1 btn btn-sm py-2 font-weight-bold rounded ${
                      activeTab === 'signin' ? 'btn-success text-white shadow-sm' : 'text-muted'
                    }`}
                    style={{ border: 'none' }}
                  >
                    Sign In
                  </button>
                </div>

                {/* Error Banner */}
                {error && (
                  <div
                    className="alert alert-danger py-2 px-3 small d-flex align-items-center mb-3 rounded"
                    style={{ backgroundColor: 'rgba(248, 81, 73, 0.12)', border: '1px solid #f85149', color: '#f85149' }}
                  >
                    <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* 1-Click Privacy Identity option in Create Mode */}
                {activeTab === 'create' && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={handleCreatePrivacyIdentity}
                      disabled={loading}
                      className="btn btn-outline-success btn-block py-2 font-weight-bold d-flex align-items-center justify-content-center"
                      style={{ borderRadius: '10px' }}
                    >
                      <Sparkles size={16} className="mr-2" />
                      Start with a Private Identity (1-Click)
                    </button>
                    <small className="d-block text-center text-muted mt-2">
                      Generates local keys. No personal details required.
                    </small>

                    <div className="d-flex align-items-center my-3">
                      <div className="flex-grow-1" style={{ borderTop: '1px solid #30363d' }}></div>
                      <span className="px-2 text-muted small font-weight-bold">OR CHOOSE A USERNAME</span>
                      <div className="flex-grow-1" style={{ borderTop: '1px solid #30363d' }}></div>
                    </div>
                  </div>
                )}

                {/* Form fields */}
                <form onSubmit={handleSubmit}>
                  {activeTab === 'create' && (
                    <div className="form-group mb-3">
                      <label className="text-muted small font-weight-bold mb-1">Display Name (optional)</label>
                      <input
                        className="form-control"
                        placeholder="e.g. Alex"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        style={{
                          backgroundColor: '#0d1117',
                          borderColor: '#30363d',
                          color: '#f0f6fc',
                          borderRadius: '8px'
                        }}
                      />
                    </div>
                  )}

                  <div className="form-group mb-3">
                    <label className="text-muted small font-weight-bold mb-1">Username</label>
                    <div className="input-group">
                      <div className="input-group-prepend">
                        <span
                          className="input-group-text"
                          style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#8b949e' }}
                        >
                          <User size={16} />
                        </span>
                      </div>
                      <input
                        className="form-control"
                        placeholder={activeTab === 'create' ? 'e.g. alex_r' : 'Enter your username'}
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoCapitalize="none"
                        required
                        style={{
                          backgroundColor: '#0d1117',
                          borderColor: '#30363d',
                          color: '#f0f6fc',
                          borderRadius: '0 8px 8px 0'
                        }}
                      />
                    </div>
                    {activeTab === 'create' && (
                      <small className="form-text text-muted">3 to 30 characters</small>
                    )}
                  </div>

                  <div className="form-group mb-3">
                    <label className="text-muted small font-weight-bold mb-1">Password</label>
                    <div className="input-group">
                      <div className="input-group-prepend">
                        <span
                          className="input-group-text"
                          style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#8b949e' }}
                        >
                          <Lock size={16} />
                        </span>
                      </div>
                      <input
                        className="form-control"
                        placeholder="Enter password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{
                          backgroundColor: '#0d1117',
                          borderColor: '#30363d',
                          color: '#f0f6fc'
                        }}
                      />
                      <div className="input-group-append">
                        <button
                          type="button"
                          className="btn btn-link text-muted px-3"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            backgroundColor: '#0d1117',
                            borderColor: '#30363d',
                            borderRadius: '0 8px 8px 0'
                          }}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    {activeTab === 'create' && (
                      <small className="form-text text-muted">At least 6 characters</small>
                    )}
                  </div>

                  {activeTab === 'create' && (
                    <div className="form-group mb-4">
                      <label className="text-muted small font-weight-bold mb-1">Confirm Password</label>
                      <input
                        className="form-control"
                        placeholder="Repeat password"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        style={{
                          backgroundColor: '#0d1117',
                          borderColor: '#30363d',
                          color: '#f0f6fc',
                          borderRadius: '8px'
                        }}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-success btn-block py-2 font-weight-bold mt-4"
                    style={{ borderRadius: '8px' }}
                  >
                    {loading ? 'Connecting…' : activeTab === 'create' ? 'Create Account' : 'Sign In'}
                  </button>
                </form>

                {/* Privacy footnote */}
                <div className="mt-4 pt-3 border-top text-center" style={{ borderColor: '#21262d' }}>
                  <small className="text-muted d-flex align-items-center justify-content-center">
                    <CheckCircle2 size={14} className="text-success mr-1 flex-shrink-0" />
                    Messages are end-to-end encrypted directly between devices.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
