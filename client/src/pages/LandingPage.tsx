import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Smartphone,
  Laptop,
  Apple,
  Globe,
  ShieldCheck,
  Zap,
  Users,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { APP_NAME, DOWNLOAD_URLS } from '../constants/config';

interface LandingPageProps {
  onOpenApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenApp }) => {
  const [detectedOS, setDetectedOS] = useState<string>('web');
  const [showPwaHelp, setShowPwaHelp] = useState<boolean>(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/android/.test(userAgent)) {
      setDetectedOS('android');
    } else if (/iphone|ipad|ipod/.test(userAgent)) {
      setDetectedOS('ios');
    } else if (/win/.test(userAgent)) {
      setDetectedOS('windows');
    } else if (/mac/.test(userAgent)) {
      setDetectedOS('macos');
    } else {
      setDetectedOS('web');
    }
  }, []);

  return (
    <div className="landing-page bg-page min-vh-100 d-flex flex-column" style={{ backgroundColor: '#0d1117' }}>
      <nav className="navbar navbar-expand-lg navbar-dark py-3 border-bottom" style={{ borderColor: '#21262d' }}>
        <div className="container">
          <div className="d-flex align-items-center">
            <div
              className="d-flex align-items-center justify-content-center rounded-circle mr-2"
              style={{ width: '38px', height: '38px', backgroundColor: '#10b981' }}
            >
              <MessageSquare size={20} className="text-white" />
            </div>
            <span className="h4 text-white font-weight-bold mb-0">{APP_NAME}</span>
          </div>
          <div>
            <button onClick={onOpenApp} className="btn btn-success font-weight-bold">
              Open Web App <ArrowRight size={16} className="ml-1" />
            </button>
          </div>
        </div>
      </nav>

      <header className="text-white py-5 py-md-6 position-relative text-center">
        <div className="container py-4">
          <h1 className="display-4 text-white font-weight-bold mb-3">
            Private messaging, made simple.
          </h1>
          <p className="lead text-muted mx-auto mb-4" style={{ maxWidth: '600px' }}>
            Stay in touch with self-hosted real-time chats, attachments, and voice notes. No phone number or email required.
          </p>

          <div className="d-flex flex-wrap justify-content-center align-items-center mb-4">
            <button
              onClick={onOpenApp}
              className="btn btn-success font-weight-bold btn-lg mr-2 mb-2"
              style={{ borderRadius: '10px' }}
            >
              <Globe size={18} className="mr-2" />
              Open Web App
            </button>
            <a
              href={DOWNLOAD_URLS.android}
              className={`btn btn-secondary font-weight-bold btn-lg mr-2 mb-2 ${
                detectedOS === 'android' ? 'border border-success' : ''
              }`}
              style={{ backgroundColor: '#21262d', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: '10px' }}
            >
              <Smartphone size={18} className="mr-2" />
              Android {detectedOS === 'android' && '(Detected)'}
            </a>
            <a
              href={DOWNLOAD_URLS.ios}
              className={`btn btn-secondary font-weight-bold btn-lg mr-2 mb-2 ${
                detectedOS === 'ios' ? 'border border-success' : ''
              }`}
              style={{ backgroundColor: '#21262d', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: '10px' }}
            >
              <Apple size={18} className="mr-2" />
              iOS {detectedOS === 'ios' && '(Detected)'}
            </a>
            <a
              href={DOWNLOAD_URLS.windows}
              className={`btn btn-secondary font-weight-bold btn-lg mr-2 mb-2 ${
                detectedOS === 'windows' ? 'border border-success' : ''
              }`}
              style={{ backgroundColor: '#21262d', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: '10px' }}
            >
              <Laptop size={18} className="mr-2" />
              Windows {detectedOS === 'windows' && '(Detected)'}
            </a>
            <a
              href={DOWNLOAD_URLS.macos}
              className={`btn btn-secondary font-weight-bold btn-lg mb-2 ${
                detectedOS === 'macos' ? 'border border-success' : ''
              }`}
              style={{ backgroundColor: '#21262d', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: '10px' }}
            >
              <Apple size={18} className="mr-2" />
              macOS {detectedOS === 'macos' && '(Detected)'}
            </a>
          </div>

          <div>
            <button
              onClick={() => setShowPwaHelp(!showPwaHelp)}
              className="btn btn-link text-muted p-0 font-weight-bold text-decoration-none small"
            >
              <HelpCircle size={15} className="mr-1" />
              Install as a Web App (PWA) on your home screen or desktop
            </button>
          </div>

          {showPwaHelp && (
            <div
              className="card text-left mx-auto mt-4 p-4 text-light shadow-lg"
              style={{ maxWidth: '580px', backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '14px' }}
            >
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0 text-success font-weight-bold">How to install SimpleLink</h6>
                <button
                  type="button"
                  className="close text-muted"
                  onClick={() => setShowPwaHelp(false)}
                >
                  &times;
                </button>
              </div>
              <p className="text-muted small mb-3">
                You can add {APP_NAME} directly to your device home screen or computer without an app store:
              </p>
              <ul className="pl-3 mb-0 small text-muted">
                <li className="mb-2">
                  <strong>Chrome / Edge:</strong> Click the install icon in the address bar or choose <em>Add to Home Screen</em>.
                </li>
                <li className="mb-2">
                  <strong>Safari (iOS):</strong> Tap the <em>Share</em> button and choose <em>Add to Home Screen</em>.
                </li>
                <li>
                  <strong>macOS:</strong> In Safari, select <em>File &gt; Add to Dock</em>.
                </li>
              </ul>
            </div>
          )}
        </div>
      </header>

      <section className="container py-5 position-relative">
        <div className="row">
          <div className="col-md-4 mb-4">
            <div
              className="card h-100 p-4 border-0"
              style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '14px' }}
            >
              <div
                className="d-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '44px', height: '44px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}
              >
                <ShieldCheck size={22} />
              </div>
              <h5 className="font-weight-bold text-white mb-2">Self-hosted ownership</h5>
              <p className="text-muted small mb-0">
                Your accounts, conversations, and files live in a local SQLite database on infrastructure you control. No phone number or email required.
              </p>
            </div>
          </div>

          <div className="col-md-4 mb-4">
            <div
              className="card h-100 p-4 border-0"
              style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '14px' }}
            >
              <div
                className="d-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '44px', height: '44px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}
              >
                <Zap size={22} />
              </div>
              <h5 className="font-weight-bold text-white mb-2">Fast & reliable</h5>
              <p className="text-muted small mb-0">
                Delivered in real-time with offline queueing, delivery indicators, and read receipts across your sessions.
              </p>
            </div>
          </div>

          <div className="col-md-4 mb-4">
            <div
              className="card h-100 p-4 border-0"
              style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '14px' }}
            >
              <div
                className="d-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{ width: '44px', height: '44px', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}
              >
                <Users size={22} />
              </div>
              <h5 className="font-weight-bold text-white mb-2">Direct & group chats</h5>
              <p className="text-muted small mb-0">
                Connect with contacts through invitation links and QR codes, or message peers across web and Android.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto py-4 border-top text-center text-muted small" style={{ borderColor: '#21262d' }}>
        <div className="container">
          <p className="mb-0 text-muted">
            &copy; {new Date().getFullYear()} {APP_NAME}. Simple, private communication.
          </p>
        </div>
      </footer>
    </div>
  );
};
