import React, { useState, useEffect } from 'react';
import { X, Hash, Lock, Trash2, AlertTriangle } from 'lucide-react';

export default function EditChannelModal({
  isOpen,
  onClose,
  channel,
  currentUser,
  onUpdateChannel,
  onDeleteChannel
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [postPermission, setPostPermission] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (channel) {
      setName(channel.name || '');
      setDescription(channel.description || '');
      setPostPermission(channel.post_permission || 'all');
      setError('');
    }
  }, [channel, isOpen]);

  if (!isOpen || !channel) return null;

  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'workspace_head';
  const isDefault = channel.name === 'announcements' || channel.name === 'general';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Channel name is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onUpdateChannel(channel.id, {
        name: name.trim(),
        description: description.trim(),
        post_permission: postPermission
      });
      onClose();
    } catch (err) {
      setError('Failed to update channel.');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (isDefault) {
      alert('Default channels cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete #${channel.name}? All messages will be deleted.`)) {
      return;
    }

    setLoading(true);
    try {
      await onDeleteChannel(channel.id);
      onClose();
    } catch (err) {
      setError('Failed to delete channel.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#222529] border border-[#383C40] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#383C40] flex items-center justify-between bg-[#1E2124]">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-base text-white">Edit #{channel.name}</h3>
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
              Channel Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                #
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isDefault}
                className="w-full pl-8 pr-3 py-2 bg-[#1A1D21] border border-[#383C40] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#ECB22E] disabled:opacity-50"
                required
              />
            </div>
            {isDefault && (
              <p className="text-[10px] text-gray-500 mt-1">Default channel names cannot be changed.</p>
            )}
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

          {/* Delete Channel Option (Admin Only, Non-default channels) */}
          {isAdmin && !isDefault && (
            <div className="pt-2 border-t border-[#383C40]">
              <div className="flex items-center justify-between p-3 rounded-xl bg-red-950/20 border border-red-500/20">
                <div>
                  <p className="text-xs font-semibold text-red-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Delete this channel
                  </p>
                  <p className="text-[10px] text-gray-400">Permanently remove this channel and all its messages.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600/80 hover:bg-red-600 text-white flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-3 flex justify-end gap-2 border-t border-[#383C40]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-[#007A5A] hover:bg-[#148567] text-white transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
