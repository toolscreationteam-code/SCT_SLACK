import React, { useState } from 'react';
import { X, Hash, Megaphone, Users, Check, Lock } from 'lucide-react';

export default function CreateChannelModal({
  isOpen,
  onClose,
  onCreate,
  currentUser,
  users = []
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [postPermission, setPostPermission] = useState('all');
  const [teamLeaderId, setTeamLeaderId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'workspace_head';
  const safeUsers = Array.isArray(users) ? users : [];

  const toggleMember = (id) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === safeUsers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(safeUsers.map((u) => u.id));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Channel name is required.');
      return;
    }

    onCreate({
      name: name.trim(),
      description: description.trim(),
      is_announcement: isAnnouncement,
      post_permission: isAnnouncement ? 'admin_only' : postPermission,
      created_by: currentUser.id,
      member_ids: selectedMembers,
      team_leader_id: teamLeaderId ? Number(teamLeaderId) : null
    });

    setName('');
    setDescription('');
    setIsAnnouncement(false);
    setPostPermission('all');
    setSelectedMembers([]);
    setTeamLeaderId('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#222529] border border-[#383C40] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#383C40] flex items-center justify-between bg-[#1E2124]">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-base text-white">Create Team / Channel</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-red-950/60 border border-red-500/40 text-red-300 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* Channel Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Team / Channel Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                #
              </span>
              <input
                type="text"
                placeholder="e.g. project-updates, editing-room"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[#1A1D21] border border-[#383C40] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ECB22E]"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              placeholder="What is this channel for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-[#1A1D21] border border-[#383C40] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ECB22E]"
            />
          </div>

          {/* Posting Permissions */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-amber-400" /> Posting Permission
            </label>
            <select
              value={postPermission}
              onChange={(e) => setPostPermission(e.target.value)}
              className="w-full px-3 py-2 bg-[#1A1D21] border border-[#383C40] rounded-lg text-xs text-white focus:outline-none focus:border-[#ECB22E]"
            >
              <option value="all">Everyone in channel can post (All Members)</option>
              <option value="leaders_only">HOD and Team Leaders only</option>
              <option value="admin_only">HOD / Admin only (Read-only for others)</option>
            </select>
          </div>

          {/* Announcement Option (Admin Only) */}
          {isAdmin && (
            <div className="flex items-center gap-2 p-3 bg-[#1A1D21] border border-[#383C40] rounded-lg">
              <input
                type="checkbox"
                id="isAnnouncement"
                checked={isAnnouncement}
                onChange={(e) => {
                  setIsAnnouncement(e.target.checked);
                  if (e.target.checked) setPostPermission('admin_only');
                }}
                className="rounded text-[#ECB22E] focus:ring-0 w-4 h-4"
              />
              <label
                htmlFor="isAnnouncement"
                className="text-xs text-gray-300 cursor-pointer flex items-center gap-1.5"
              >
                <Megaphone className="w-4 h-4 text-amber-400" />
                Make this an official Announcement channel
              </label>
            </div>
          )}

          {/* Assign Members */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Team leader <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <select value={teamLeaderId} onChange={(e) => setTeamLeaderId(e.target.value)} className="w-full px-3 py-2 bg-[#1A1D21] border border-[#383C40] rounded-lg text-xs text-white focus:outline-none focus:border-[#ECB22E]">
              <option value="">Workspace leader manages this channel</option>
              {safeUsers.filter((u) => Number(u.id) !== Number(currentUser?.id)).map((u) => <option key={u.id} value={u.id}>{u.name} — make team leader</option>)}
            </select>
            <p className="mt-1 text-[10px] text-gray-500">A team leader can only add or remove members from this team.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Select Members ({selectedMembers.length}/{safeUsers.length})
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-blue-400 hover:underline"
              >
                {selectedMembers.length === safeUsers.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-[#1A1D21] border border-[#383C40] rounded-lg">
              {safeUsers.map((u) => {
                const isSelected = selectedMembers.includes(u.id);
                const isMe = u.id === currentUser?.id;

                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => toggleMember(u.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#1164A3]/20 text-blue-300 font-semibold'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <span>
                      {u.name} ({u.team_name}) {isMe && '(You)'}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-[#383C40]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-bold bg-[#007A5A] hover:bg-[#148567] text-white transition-colors"
            >
              Create Team / Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
