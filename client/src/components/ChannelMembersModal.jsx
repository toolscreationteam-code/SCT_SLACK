import React, { useState } from 'react';
import { X, Users, UserPlus, Trash2, Crown, Shield } from 'lucide-react';

const AVATAR_COLORS = {
  1: 'bg-amber-600',
  2: 'bg-emerald-600',
  3: 'bg-teal-600',
  4: 'bg-blue-600',
  5: 'bg-indigo-600',
  6: 'bg-purple-600',
  7: 'bg-pink-600',
  8: 'bg-rose-600',
  9: 'bg-cyan-600',
};

export default function ChannelMembersModal({
  isOpen,
  onClose,
  channel,
  members = [],
  allUsers = [],
  currentUser,
  onAddMember,
  onRemoveMember
}) {
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

  if (!isOpen || !channel) return null;

  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'workspace_head';
  const isLeader = currentUser?.role === 'team_leader';
  const canManage = isAdmin || isLeader;

  const safeMembers = Array.isArray(members) ? members : [];
  const safeAllUsers = Array.isArray(allUsers) ? allUsers : [];

  const memberIds = new Set(safeMembers.map((m) => m.id));
  const nonMembers = safeAllUsers.filter((u) => !memberIds.has(u.id));

  const handleAdd = (e) => {
    e.preventDefault();
    if (!selectedUserToAdd) return;
    onAddMember(Number(selectedUserToAdd));
    setSelectedUserToAdd('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#222529] border border-[#383C40] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#383C40] flex items-center justify-between bg-[#1E2124]">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-base text-white">#{channel.name} Members</h3>
              <p className="text-[11px] text-gray-400">{safeMembers.length} {safeMembers.length === 1 ? 'member' : 'members'} in channel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Add member row (If Admin or Leader) */}
          {canManage && nonMembers.length > 0 && (
            <form onSubmit={handleAdd} className="flex gap-2">
              <select
                value={selectedUserToAdd}
                onChange={(e) => setSelectedUserToAdd(e.target.value)}
                className="flex-1 bg-[#1A1D21] border border-[#383C40] text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              >
                <option value="">+ Add a team member...</option>
                {nonMembers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.team_name})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!selectedUserToAdd}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add
              </button>
            </form>
          )}

          {/* Members List */}
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {safeMembers.map((member) => {
              const isMemberAdmin = member.role === 'hod_admin';
              const isMemberLeader = member.role === 'team_leader';
              const isMe = member.id === currentUser?.id;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#1A1D21] border border-[#2D3136]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                        AVATAR_COLORS[member.id] || 'bg-gray-600'
                      }`}
                    >
                      {member.avatar || member.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate flex items-center gap-1">
                        {member.name}
                        {isMe && <span className="text-[10px] text-gray-400 font-normal">(You)</span>}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {member.team_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isMemberAdmin && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">
                        <Crown className="w-3 h-3" /> HOD
                      </span>
                    )}
                    {isMemberLeader && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300">
                        <Shield className="w-3 h-3" /> Leader
                      </span>
                    )}

                    {isAdmin && !isMemberAdmin && !isMe && (
                      <button
                        onClick={() => onRemoveMember(member.id)}
                        className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                        title="Remove member from channel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
