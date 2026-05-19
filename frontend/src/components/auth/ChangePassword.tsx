import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext.tsx';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

const ChangePassword: React.FC = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { logout } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('nexus_token');
      await axios.post(`${API_BASE_URL}/auth/change-password/`, {
        old_password: oldPassword,
        new_password: newPassword,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setMessage('Password changed — please sign in again.');
      // Clear auth and redirect to login
      setTimeout(() => {
        logout();
        window.location.hash = '#login';
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setMessage(err?.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-lg">
      <h2 className="text-xl font-bold mb-4">Change Password</h2>
      {message && <div className="mb-4 text-sm text-rose-600">{message}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold mb-1">Current Password</label>
          <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full px-4 py-3 border rounded-lg" required />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">New Password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 border rounded-lg" required />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1">Confirm New Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 border rounded-lg" required />
        </div>
        <div className="flex items-center justify-between">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-slate-900 text-white rounded-lg">{loading ? 'Saving...' : 'Change Password'}</button>
        </div>
      </form>
    </div>
  );
};

export default ChangePassword;
