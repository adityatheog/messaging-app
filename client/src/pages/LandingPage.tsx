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
  Download,
  ArrowRight,
  CheckCircle2,
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
    <div className="landing-page bg-page min-vh-100 d-flex flex-column">
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-gradient-primary py-3">
        <div className="container">
          <div className="d-flex align-items-center">
            <div
              className="d-flex align-items-center justify-content-center bg-white text-primary rounded-circle mr-2"
              style={{ width: '38px', height: '38px' }}
            >
              <MessageSquare size={20} />
            </div>
            <span className="h4 text-white font-weight-bold mb-0">{APP_NAME}</span>
          </div>
          <div>
            <button onClick={onOpenApp} className="btn btn-white text-primary font-weight-bold">
              Open Web App <ArrowRight size={16} className="ml-1" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section with Argon Gradient */}
      <header className="bg-gradient-primary text-white py-5 py-md-6 position-relative">
        <div className="container py-4 text-center">
          <span className="badge badge-pill badge-secondary text-primary font-weight-bold px-3 py-2 mb-3">
            Cross-Platform Real-Time Chat
          </span>
          <h1 className="display-4 text-white font-weight-bold mb-3">
            Connect Instantly on Any Device
          </h1>
          <p className="lead text-white-50 mx-auto mb-4" style={{ maxWidth: '640px' }}>
            A modern real-time messaging platform with instant synchronization across Web, Android, iOS, Windows, and macOS with the elegant Argon Dashboard design.
          </p>

          {/* Primary Action Buttons */}
          <div className="d-flex flex-wrap justify-content-center align-items-center mb-4">
            <button
              onClick={onOpenApp}
              className="btn btn-white text-primary font-weight-bold btn-lg mr-2 mb-2"
            >
              <Globe size={18} className="mr-2" />
              Open Web App
            </button>
            <a
              href={DOWNLOAD_URLS.android}
              className={`btn btn-secondary font-weight-bold btn-lg mr-2 mb-2 ${
                detectedOS === 'android' ? 'border border-warning' : ''
              }`}
            >
              <Smartphone size={18} className="mr-2" />
              Android {detectedOS === 'android' && '(Detected)'}
            </a>
            <a
              href={DOWNLOAD_URLS.ios}
              className={`btn btn-secondary font-weight-bold btn-lg mr-2 mb-2 ${
                detectedOS === 'ios' ? 'border border-warning' : ''
              }`}
            >
              <Apple size={18} className="mr-2" />
              iOS {detectedOS === 'ios' && '(Detected)'}
            </a>
            <a
              href={DOWNLOAD_URLS.windows}
              className={`btn btn-secondary font-weight-bold btn-lg mr-2 mb-2 ${
                detectedOS === 'windows' ? 'border border-warning' : ''
              }`}
            >
              <Laptop size={18} className="mr-2" />
              Windows {detectedOS === 'windows' && '(Detected)'}
            </a>
            <a
              href={DOWNLOAD_URLS.macos}
              className={`btn btn-secondary font-weight-bold btn-lg mb-2 ${
                detectedOS === 'macos' ? 'border border-warning' : ''
              }`}
            >
              <Apple size={18} className="mr-2" />
              macOS {detectedOS === 'macos' && '(Detected)'}
            </a>
          </div>

          <div>
            <button
              onClick={() => setShowPwaHelp(!showPwaHelp)}
              className="btn btn-link text-white-50 p-0 font-weight-bold text-decoration-none"
            >
              <HelpCircle size={16} className="mr-1" />
              How to install as a Progressive Web App (PWA)
            </button>
          </div>

          {/* PWA Install Modal / Collapsible Guide */}
          {showPwaHelp && (
            <div className="card text-left mx-auto mt-4 p-4 text-dark shadow-lg" style={{ maxWidth: '600px' }}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0 text-primary font-weight-bold">Install as PWA</h5>
                <button
                  type="button"
                  className="close"
                  onClick={() => setShowPwaHelp(false)}
                >
                  &times;
                </button>
              </div>
              <p className="text-muted small mb-3">
                You can install {APP_NAME} directly to your device home screen or desktop without an app store:
              </p>
              <ul className="pl-3 mb-0 small text-muted">
                <li className="mb-2">
                  <strong>Chrome / Edge (Desktop & Android):</strong> Tap the install icon in the URL address bar or select <em>Add to Home Screen</em>.
                </li>
                <li className="mb-2">
                  <strong>Safari (iOS):</strong> Tap the <em>Share</em> button at the bottom and select <em>Add to Home Screen</em>.
                </li>
                <li>
                  <strong>macOS Safari:</strong> Click <em>File &gt; Add to Dock</em> to run as a native window.
                </li>
              </ul>
            </div>
          )}
        </div>
      </header>

      {/* Feature Cards Section */}
      <section className="container py-5 mt-n5 position-relative" style={{ zIndex: 10 }}>
        <div className="row">
          <div className="col-md-4 mb-4">
            <div className="card h-100 p-4">
              <div
                className="d-flex align-items-center justify-content-center bg-gradient-primary text-white rounded-circle mb-3"
                style={{ width: '48px', height: '48px' }}
              >
                <Zap size={24} />
              </div>
              <h5 className="font-weight-bold mb-2">Instant Real-Time Chat</h5>
              <p className="text-muted mb-0">
                Messages, delivery receipts, typing indicators, and read states are synchronized across all your devices in real time.
              </p>
            </div>
          </div>

          <div className="col-md-4 mb-4">
            <div className="card h-100 p-4">
              <div
                className="d-flex align-items-center justify-content-center bg-success text-white rounded-circle mb-3"
                style={{ width: '48px', height: '48px' }}
              >
                <ShieldCheck size={24} />
              </div>
              <h5 className="font-weight-bold mb-2">Production Security</h5>
              <p className="text-muted mb-0">
                JWT authentication, bcryptjs password hashing, strict request validation, and zero-trust security rules.
              </p>
            </div>
          </div>

          <div className="col-md-4 mb-4">
            <div className="card h-100 p-4">
              <div
                className="d-flex align-items-center justify-content-center bg-info text-white rounded-circle mb-3"
                style={{ width: '48px', height: '48px' }}
              >
                <Users size={24} />
              </div>
              <h5 className="font-weight-bold mb-2">Direct Directory & Presence</h5>
              <p className="text-muted mb-0">
                Live search through teammate directory, presence indicators, conversation history, and unread badges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-4 bg-white border-top text-center text-muted small">
        <div className="container">
          <p className="mb-0">
            &copy; {new Date().getFullYear()} {APP_NAME}. Styled with the Argon Dashboard design system.
          </p>
        </div>
      </footer>
    </div>
  );
};
