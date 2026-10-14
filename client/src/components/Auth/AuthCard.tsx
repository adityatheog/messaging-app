import React, { useState } from 'react';
import { User, Lock, Mail, MessageSquare, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME } from '../../constants/config';

interface AuthCardProps {
  onBackToLanding?: () => void;
}

export const AuthCard: React.FC<AuthCardProps> = ({ onBackToLanding }) => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (username.trim().length < 3) {
          throw new Error('Username must be at least 3 characters');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        await register(username.trim(), password, fullName.trim());
      } else {
        if (!username.trim() || !password) {
          throw new Error('Username and password are required');
        }
        await login(username.trim(), password);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoUsername: string) => {
    setUsername(demoUsername);
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="min-vh-100 d-flex flex-column bg-default">
      {/* Top Header Gradient Band */}
      <div className="bg-gradient-primary py-6 py-lg-7 text-white text-center position-relative">
        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="btn btn-link text-white position-absolute"
            style={{ top: '1.5rem', left: '1.5rem' }}
          >
            <ArrowLeft size={18} className="mr-1" /> Landing Page
          </button>
        )}
        <div className="container pt-4 pb-5">
          <div
            className="d-inline-flex align-items-center justify-content-center bg-white text-primary rounded-circle mb-3 shadow"
            style={{ width: '56px', height: '56px' }}
          >
            <MessageSquare size={28} />
          </div>
          <h1 className="text-white font-weight-bold mb-1">{APP_NAME}</h1>
          <p className="text-white-50 lead mb-0">
            {isRegister ? 'Create your account to start messaging' : 'Sign in to access your conversations'}
          </p>
        </div>
      </div>

      {/* Main Container Overlapping the Gradient Band */}
      <div className="container mt-n6 pb-5 flex-grow-1">
        <div className="row justify-content-center">
          <div className="col-lg-5 col-md-7">
            <div className="card shadow-lg border-0">
              <div className="card-body px-lg-5 py-lg-5">
                <div className="text-center text-muted mb-4">
                  <h4 className="font-weight-bold text-dark mb-1">
                    {isRegister ? 'Sign Up' : 'Welcome Back'}
                  </h4>
                  <small>
                    {isRegister ? 'Enter your details below' : 'Sign in with your credentials'}
                  </small>
                </div>

                {error && (
                  <div className="alert alert-danger py-2 px-3 small d-flex align-items-center mb-3">
                    <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  {isRegister && (
                    <div className="form-group mb-3">
                      <div className="input-group input-group-alternative">
                        <div className="input-group-prepend">
                          <span className="input-group-text">
                            <Mail size={16} />
                          </span>
                        </div>
                        <input
                          className="form-control"
                          placeholder="Full Name (optional)"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="form-group mb-3">
                    <div className="input-group input-group-alternative">
                      <div className="input-group-prepend">
                        <span className="input-group-text">
                          <User size={16} />
                        </span>
                      </div>
                      <input
                        className="form-control"
                        placeholder="Username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoCapitalize="none"
                        required
                      />
                    </div>
                    {isRegister && (
                      <small className="form-text text-muted pl-2">3–30 characters, unique</small>
                    )}
                  </div>

                  <div className="form-group mb-4">
                    <div className="input-group input-group-alternative">
                      <div className="input-group-prepend">
                        <span className="input-group-text">
                          <Lock size={16} />
                        </span>
                      </div>
                      <input
                        className="form-control"
                        placeholder="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    {isRegister && (
                      <small className="form-text text-muted pl-2">Minimum 6 characters</small>
                    )}
                  </div>

                  <div className="text-center">
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn btn-primary btn-block my-4 text-white font-weight-bold"
                    >
                      {loading
                        ? 'Processing...'
                        : isRegister
                        ? 'Create Account'
                        : 'Sign In'}
                    </button>
                  </div>
                </form>

                {/* Quick Demo Access Buttons */}
                {!isRegister && (
                  <div className="pt-2 border-top text-center">
                    <span className="text-muted small d-block mb-2 font-weight-bold">
                      Quick Demo Accounts:
                    </span>
                    <div className="d-flex flex-wrap justify-content-center">
                      <button
                        type="button"
                        onClick={() => handleQuickLogin('sarah_j')}
                        className="btn btn-sm btn-outline-primary m-1"
                      >
                        @sarah_j
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickLogin('alex_r')}
                        className="btn btn-sm btn-outline-primary m-1"
                      >
                        @alex_r
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickLogin('emily_w')}
                        className="btn btn-sm btn-outline-primary m-1"
                      >
                        @emily_w
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Toggle Sign In / Sign Up Link */}
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError(null);
                }}
                className="btn btn-link text-white-50 font-weight-bold"
              >
                {isRegister
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Create One"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
