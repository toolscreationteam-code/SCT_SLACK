import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Users,
  Key,
  Trash2,
  Edit2,
  Crown,
  Shield,
  Check,
  AlertCircle,
  AtSign
} from 'lucide-react';

export default function UserManagementModal({
  isOpen,
  onClose,
  users = [],
  currentUser,
  onRefreshUsers
}) {
  const [tab, setTab] = useState('list');
  const [editingUser, setEditingUser] = useState(null);

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [teamName, setTeamName] = useState('Team 1');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'super_admin';
  const safeUsers = Array.isArray(users) ? users : [];

  const resetForm = () => {
    setUsername('');
    setName('');
    setPassword('');
    setRole('member');
    setTeamName('Team 1');
    setError('');
    setSuccess('');
    setEditingUser(null);
  };

  const handleStartEdit = (user) => {
    setEditingUser(user);
    setUsername(user.username || '');
    setName(user.name);
    setPassword('');
    setRole(user.role);
    setTeamName(user.team_name || 'Team 1');
    setError('');
    setSuccess('');
    setTab('edit');
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim()) {
      setError('Username, Display Name and Password are required.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_by: currentUser.id,
          username: username.trim(),
          name: name.trim(),
          password: password.trim(),
          role,
          team_name: teamName
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add user.');
      } else {
        setSuccess(`Member "${data.name}" (@${data.username}) added successfully!`);
        resetForm();
        onRefreshUsers();
        setTab('list');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    }
    setLoading(false);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_by: currentUser.id,
          username: username.trim() || undefined,
          name: name.trim(),
          password: password.trim() ? password.trim() : undefined,
          role,
          team_name: teamName
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update member.');
      } else {
        setSuccess('Member details updated successfully!');
        resetForm();
        onRefreshUsers();
        setTab('list');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    }
    setLoading(false);
  };

  const handleDeleteUser = async (userId, userName) => {
    if (userId === 1) {
      alert('The primary HOD account cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete "${userName}"?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}?requestedBy=${currentUser.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete member.');
      } else {
        onRefreshUsers();
      }
    } catch (err) {
      alert('Error deleting member.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" data-lenis-prevent>
      <div className="bg-[#222529] border border-[#383C40] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" data-lenis-prevent>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#383C40] flex items-center justify-between bg-[#1E2124] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Admin Control</h3>
              <p className="text-xs text-gray-400">{safeUsers.length} total members registered</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-[#383C40] px-5 bg-[#1A1D21] gap-4 shrink-0">
          <button
            onClick={() => { resetForm(); setTab('list'); }}
            className={`py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'list'
                ? 'border-[#ECB22E] text-[#ECB22E]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> All Members ({safeUsers.length})
          </button>
          <button
            onClick={() => { resetForm(); setTab('add'); }}
            className={`py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'add'
                ? 'border-[#ECB22E] text-[#ECB22E]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" /> + Add New Member
          </button>
          {tab === 'edit' && (
            <button
              className="py-2.5 text-xs font-bold border-b-2 border-blue-400 text-blue-400 flex items-center gap-1.5"
            >
              <Edit2 className="w-4 h-4" /> Edit Member ({editingUser?.name})
            </button>
          )}
        </div>

        {/* Modal Body with guaranteed smooth native scrolling */}
        <div 
          className="flex-1 min-h-0 overflow-y-auto p-5 pr-4 overscroll-contain select-text" 
          data-lenis-prevent
          style={{ scrollbarGutter: 'stable', WebkitOverflowScrolling: 'touch' }}
        >
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" /> {success}
            </div>
          )}

          {/* TAB 1: LIST */}
          {tab === 'list' && (
            <div className="space-y-2">
              {safeUsers.map((u) => {
                const isHod = u.role === 'super_admin' || u.role === 'hod_admin';
                const isLeader = u.role === 'team_leader';

                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#1A1D21] border border-[#2D3136] hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gray-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {u.avatar || u.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-white truncate">{u.name}</p>
                          <span className="font-mono text-xs text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            @{u.username || u.name}
                          </span>
                          {isHod && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5" /> Super Admin
                            </span>
                          )}
                          {isLeader && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-0.5">
                              <Shield className="w-2.5 h-2.5" /> Leader
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {u.team_name} • Login ID: <span className="font-mono text-gray-200 font-semibold">{u.username}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleStartEdit(u)}
                        className="p-1.5 rounded-lg bg-[#2C3136] hover:bg-[#383C40] text-gray-300 hover:text-white transition-colors"
                        title="Edit member / Reset password"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {!isHod && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 transition-colors"
                          title="Delete member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2 & 3: ADD / EDIT FORM */}
          {(tab === 'add' || tab === 'edit') && (
            <form onSubmit={tab === 'add' ? handleAddUser : handleUpdateUser} className="space-y-4 max-w-md mx-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Display Name (Full Name) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Parthiv Maharaj"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1A1D21] border border-[#383C40] rounded-lg text-sm text-white focus:outline-none focus:border-[#ECB22E]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Username (Login ID) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <AtSign className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. s120"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#1A1D21] border border-[#383C40] rounded-lg text-sm text-white focus:outline-none focus:border-[#ECB22E]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  {tab === 'edit' ? 'Change Password (leave empty to keep current)' : 'Password'} <span className="text-red-400">{tab === 'add' ? '*' : ''}</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. s120"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#1A1D21] border border-[#383C40] rounded-lg text-sm text-white focus:outline-none focus:border-[#ECB22E]"
                    required={tab === 'add'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A1D21] border border-[#383C40] rounded-lg text-xs text-white focus:outline-none focus:border-[#ECB22E]"
                  >
                    <option value="member">Member</option>
                    <option value="team_leader">Team Leader</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Team
                  </label>
                  <select
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A1D21] border border-[#383C40] rounded-lg text-xs text-white focus:outline-none focus:border-[#ECB22E]"
                  >
                    <option value="Team 1">Team 1</option>
                    <option value="Team 2">Team 2</option>
                    <option value="Management">Management (HOD)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { resetForm(); setTab('list'); }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#007A5A] hover:bg-[#148567] text-white transition-colors"
                >
                  {loading ? 'Saving...' : tab === 'add' ? 'Add Member' : 'Update Member'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#383C40] bg-[#1E2124] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#2C3136] hover:bg-[#383C40] text-gray-300 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
