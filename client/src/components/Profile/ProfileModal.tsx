import React, { useState, useEffect, useRef } from 'react';
import { X, Check, User as UserIcon, Palette, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { AVATAR_PALETTE, getInitials } from '../../constants/config';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser, deleteAccount } = useAuth();
  const [fullName, setFullName] = useState<string>(user?.fullName || '');
  const [selectedColor, setSelectedColor] = useState<string>(user?.avatarColor || AVATAR_PALETTE[0]);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setFullName(user.fullName || '');
      setSelectedColor(user.avatarColor || AVATAR_PALETTE[0]);
      setSuccess(false);
      setError(null);
      setConfirmDelete(false);
    }
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await authAPI.updateProfile({
        fullName: fullName.trim(),
        avatarColor: selectedColor
      });
      updateUser(res.user);
      setSuccess(true);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 800);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete account.');
      setDeleting(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1050 }}
      tabIndex={-1}
      role="dialog"
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content border-0 shadow-lg" style={{ backgroundColor: '#161b22', color: '#f0f6fc' }}>
          <div className="modal-header border-bottom py-3" style={{ borderColor: '#30363d' }}>
            <h5 className="modal-title font-weight-bold text-white mb-0">My Profile</h5>
            <button
              type="button"
              className="close text-white"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSave}>
            <div className="modal-body p-4 text-center">
              <div
                className="avatar-circle mx-auto mb-3 shadow"
                style={{
                  width: '80px',
                  height: '80px',
                  fontSize: '28px',
                  backgroundColor: selectedColor
                }}
              >
                {getInitials(fullName || user.username)}
              </div>

              <h5 className="font-weight-bold text-white mb-0">{fullName || user.username}</h5>
              <p className="text-muted small mb-4">@{user.username}</p>

              <div className="form-group text-left mb-3">
                <label className="form-control-label small font-weight-bold text-muted">
                  Full Name
                </label>
                <div className="input-group">
                  <div className="input-group-prepend">
                    <span className="input-group-text" style={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#8b949e' }}>
                      <UserIcon size={16} />
                    </span>
                  </div>
                  <input
                    type="text"
                    className="form-control"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="text-left mb-4">
                <label className="form-control-label small font-weight-bold text-muted d-flex align-items-center mb-2">
                  <Palette size={16} className="mr-1" /> Avatar Accent Color
                </label>
                <div className="d-flex flex-wrap">
                  {AVATAR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className="btn p-0 rounded-circle mr-2 mb-2 shadow-sm d-flex align-items-center justify-content-center"
                      style={{
                        width: '36px',
                        height: '36px',
                        minHeight: '36px',
                        backgroundColor: color,
                        border: selectedColor === color ? '3px solid #f0f6fc' : 'none'
                      }}
                    >
                      {selectedColor === color && <Check size={16} color="#fff" />}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="alert alert-danger py-2 small mb-3">
                  {error}
                </div>
              )}

              {success && (
                <div className="alert alert-success py-2 small mb-3">
                  Profile saved.
                </div>
              )}

              <div className="border-top pt-3 text-left" style={{ borderColor: '#30363d' }}>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteAccount}
                  className="btn btn-sm btn-outline-danger d-inline-flex align-items-center"
                >
                  <Trash2 size={14} className="mr-1" />
                  {deleting
                    ? 'Deleting account...'
                    : confirmDelete
                    ? 'Confirm permanent account deletion'
                    : 'Delete Account'}
                </button>
              </div>
            </div>

            <div className="modal-footer border-0 pt-0 px-4 pb-4">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="btn btn-primary font-weight-bold"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
