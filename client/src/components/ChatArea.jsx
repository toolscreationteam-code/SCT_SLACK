import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Hash,
  Megaphone,
  Send,
  Paperclip,
  AtSign,
  Link,
  Users,
  FileText,
  Download,
  ExternalLink,
  Menu,
  Crown,
  Shield,
  X,
  Lock,
  Settings,
  Circle,
  MessageSquare,
  Trash2,
  Edit3,
  Check,
  CheckCheck,
  Info,
  CornerDownLeft,
  Sparkles,
  Smile,
  Plus
} from 'lucide-react';

import { AVATAR_COLORS } from '../constants/members';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function ChatArea({
  currentUser,
  activeChannel,
  messages = [],
  channelMembers = [],
  onlineUsers = [],
  users = [],
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  onToggleReaction,
  onOpenMembersModal,
  onOpenEditChannel,
  onToggleMobileSidebar,
  typingUser
}) {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveUrl, setDriveUrl] = useState('');

  // Floating reaction picker menu state
  const [activeReactionMenuMsgId, setActiveReactionMenuMsgId] = useState(null);

  // Reaction details modal state (who reacted with which emoji)
  const [reactionModalMsg, setReactionModalMsg] = useState(null);
  const [selectedReactionTab, setSelectedReactionTab] = useState('all');

  // WhatsApp-style message info / read receipts modal
  const [infoModalMsg, setInfoModalMsg] = useState(null);

  // Inline message editing state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');

  // Mentions auto-complete state
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mentionItemRefs = useRef([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isAdmin = !currentUser?.isMasterAdmin && ['super_admin', 'workspace_head', 'team_leader'].includes(currentUser?.role);
  const isLeader = currentUser?.role === 'team_leader';
  const isDM = Boolean(activeChannel?.is_direct);
  const isAnnouncement = Boolean(activeChannel?.is_announcement);
  const safeMembers = Array.isArray(channelMembers) ? channelMembers : [];

  // `users` is workspace-scoped by the API, so mentions cannot leak across workspaces.
  const allKnownMembers = useMemo(() => {
    const map = new Map();
    (channelMembers || []).forEach((m) => {
      if (m?.id) map.set(Number(m.id), m);
    });
    (users || []).forEach((u) => {
      if (u?.id && !map.has(Number(u.id))) map.set(Number(u.id), u);
    });
    return Array.from(map.values());
  }, [channelMembers, users]);

  const mentionCandidates = useMemo(() => {
    const list = [];
    if (!isDM) {
      list.push({
        id: 'all',
        name: 'all',
        username: 'all',
        role: 'channel_broadcast',
        team_name: 'Announcement',
        desc: `Notify everyone in #${activeChannel?.name || 'this channel'}`
      });
    }

    allKnownMembers.forEach((m) => {
      const nameStr = String(m?.name || '');
      const userStr = String(m?.username || '');
      const teamStr = String(m?.team_name || '');
      list.push({
        id: m.id,
        name: nameStr,
        username: userStr,
        role: m.role,
        team_name: teamStr,
        avatar: m.avatar || nameStr.slice(0, 2),
        isOnline: (onlineUsers || []).map(Number).includes(Number(m.id)),
        desc: userStr
          ? `@${userStr} • ${m.role === 'hod_admin' ? 'HOD' : teamStr || 'Member'}`
          : (m.role === 'hod_admin' ? 'HOD' : teamStr || 'Member')
      });
    });

    const filter = String(mentionFilter || '').trim().toLowerCase();
    if (!filter) return list;

    return list.filter((c) =>
      String(c.name || '').toLowerCase().includes(filter) ||
      String(c.username || '').toLowerCase().includes(filter) ||
      String(c.team_name || '').toLowerCase().includes(filter)
    );
  }, [allKnownMembers, mentionFilter, isDM, activeChannel?.name, onlineUsers]);

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionFilter]);

  // Keep highlighted item visible
  useEffect(() => {
    if (showMentionMenu && mentionItemRefs.current[selectedMentionIndex]) {
      mentionItemRefs.current[selectedMentionIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedMentionIndex, showMentionMenu]);

  if (!activeChannel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen bg-[#1A1D21] text-gray-400 p-6 text-center select-none">
        <button
          onClick={onToggleMobileSidebar}
          className="p-2 mb-4 rounded-lg bg-[#222529] md:hidden text-gray-300 hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-16 h-16 rounded-2xl bg-[#222529] border border-[#383C40] flex items-center justify-center text-[#ECB22E] mb-4 shadow-xl">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Welcome to AVK Workspace!</h3>
        <p className="text-xs text-gray-400 max-w-sm">
          Please select a channel (#announcements, #general) or a team member from the sidebar to start chatting.
        </p>
      </div>
    );
  }

  // Safely resolve DM partner even if dm_user is not directly present
  const dmPartner = isDM
    ? activeChannel.dm_user ||
      (users || []).find((u) => {
        const parts = activeChannel.name?.split('_');
        if (parts?.length === 3) {
          const otherId = Number(parts[1]) === Number(currentUser?.id) ? Number(parts[2]) : Number(parts[1]);
          return Number(u.id) === otherId;
        }
        return false;
      })
    : null;

  const isDMPartnerOnline = isDM && dmPartner ? (onlineUsers || []).map(Number).includes(Number(dmPartner.id)) : false;

  // Check posting permissions
  let canPost = true;
  let permissionReason = '';

  if (!isDM) {
    if (currentUser?.isMasterAdmin) {
      canPost = false;
      permissionReason = 'Master Admin is limited to workspace and user administration.';
    } else if (activeChannel.post_permission === 'admin_only' && !isAdmin) {
      canPost = false;
      permissionReason = '🔒 Only HOD / Admin can post in this channel (Read-only).';
    } else if (activeChannel.post_permission === 'leaders_only' && !isAdmin && !isLeader) {
      canPost = false;
      permissionReason = '🔒 Only HOD and Team Leaders can post in this channel.';
    }
  }

  const handleTextChange = (e) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(val);

    const lastAtIdx = val.lastIndexOf('@', cursorPos - 1);
    if (lastAtIdx !== -1) {
      const charBeforeAt = lastAtIdx > 0 ? val[lastAtIdx - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIdx === 0) {
        const textAfterAt = val.slice(lastAtIdx + 1, cursorPos);
        if (!textAfterAt.includes(' ') && textAfterAt.length < 25) {
          setMentionFilter(textAfterAt.toLowerCase());
          setMentionCursorPos(lastAtIdx);
          setShowMentionMenu(true);
          return;
        }
      }
    }
    setShowMentionMenu(false);
  };

  const handleSelectMention = (name) => {
    const textarea = textareaRef.current;
    const cursorPos = textarea ? textarea.selectionStart : content.length;
    const before = content.slice(0, mentionCursorPos);
    const after = content.slice(cursorPos);
    const insertText = `@${name} `;
    const newText = `${before}${insertText}${after}`;
    setContent(newText);
    setShowMentionMenu(false);
    setMentionFilter('');
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = before.length + insertText.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 50);
  };

  const handleTriggerMention = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(start);
    const newContent = `${before}@${after}`;
    setContent(newContent);
    setMentionFilter('');
    setMentionCursorPos(start);
    setShowMentionMenu(true);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1);
    }, 50);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!canPost || (!content.trim() && !selectedFile)) return;

    let fileData = null;

    if (selectedFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        fileData = await res.json();
      } catch (err) {
        alert('File upload failed.');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    onSendMessage({
      content: content.trim(),
      file_url: fileData?.url || null,
      file_name: fileData?.fileName || null,
      file_type: fileData?.fileType || null,
      drive_link: null
    });

    setContent('');
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddDriveLink = () => {
    if (!driveUrl.trim()) return;
    onSendMessage({
      content: content.trim() ? `${content}\n${driveUrl.trim()}` : driveUrl.trim(),
      file_url: null,
      file_name: null,
      file_type: null,
      drive_link: driveUrl.trim()
    });
    setDriveUrl('');
    setShowDriveModal(false);
    setContent('');
  };

  const handleDeleteMsg = (msgId) => {
    if (window.confirm('Are you sure you want to delete this message permanently?')) {
      onDeleteMessage(activeChannel.id, msgId);
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content || '');
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (msgId) => {
    if (!editContent.trim()) return;
    if (onEditMessage) {
      await onEditMessage(activeChannel.id, msgId, editContent.trim());
    }
    setEditingMessageId(null);
    setEditContent('');
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#1A1D21] text-gray-200 overflow-hidden">
      {/* 1. Header */}
      <div className="h-14 px-4 border-b border-[#2C3136] bg-[#222529]/80 backdrop-blur flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleMobileSidebar}
            className="p-1.5 rounded-md hover:bg-white/10 md:hidden text-gray-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>

          {isDM ? (
            /* Direct Message Header */
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow shrink-0 ${
                  AVATAR_COLORS[dmPartner?.id] || 'bg-gray-600'
                }`}
              >
                {dmPartner?.avatar || dmPartner?.name?.slice(0, 2) || 'DM'}
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                  {dmPartner?.name || 'Direct Message'}
                  {dmPartner?.role === 'hod_admin' && (
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  {dmPartner?.role === 'team_leader' && (
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                  )}
                </h2>
                <p className="text-[11px] flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isDMPartnerOnline ? 'bg-emerald-400' : 'bg-gray-500'
                    }`}
                  />
                  <span className={isDMPartnerOnline ? 'text-emerald-400' : 'text-gray-400'}>
                    {isDMPartnerOnline ? 'Online' : 'Offline'} • {dmPartner?.team_name || 'Team Member'}
                  </span>
                </p>
              </div>
            </div>
          ) : (
            /* Regular Channel Header */
            <div className="flex items-center gap-2 min-w-0">
              {isAnnouncement ? (
                <Megaphone className="w-5 h-5 text-amber-400 shrink-0" />
              ) : (
                <Hash className="w-5 h-5 text-gray-400 shrink-0" />
              )}
              <div className="min-w-0">
                <h2 className="font-bold text-sm text-white truncate flex items-center gap-2">
                  {`#${activeChannel.name}`}
                  {activeChannel.post_permission && activeChannel.post_permission !== 'all' && (
                    <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.2 rounded font-normal flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      {activeChannel.post_permission === 'admin_only' ? 'Admin only' : 'Leaders only'}
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-gray-400 truncate hidden sm:block">
                  {activeChannel.description || 'AVK Workspace Channel'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isDM && (
            <>
              {/* Edit Channel Button (HOD / Admin or Creator) */}
              {(isAdmin || activeChannel.created_by === currentUser.id) && (
                <button
                  onClick={onOpenEditChannel}
                  className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
                  title="Edit Channel Details"
                >
                  <Edit3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              )}

              {/* Member count button */}
              <button
                onClick={onOpenMembersModal}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2C3136] hover:bg-[#383C40] text-gray-300 hover:text-white text-xs font-medium border border-[#3E4247] transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>{safeMembers.length} {safeMembers.length === 1 ? 'Member' : 'Members'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Messages List (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Welcome Banner */}
        <div className="p-4 rounded-xl bg-[#222529]/40 border border-[#2C3136] mb-4">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            {isDM ? (
              <>
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <span>Direct conversation with {dmPartner?.name || activeChannel.dm_user?.name || 'Direct Message'}</span>
              </>
            ) : isAnnouncement ? (
              <>
                <Megaphone className="w-5 h-5 text-amber-400" />
                <span>Welcome to #{activeChannel.name}!</span>
              </>
            ) : (
              <>
                <Hash className="w-5 h-5 text-gray-400" />
                <span>Welcome to #{activeChannel.name}!</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {isDM
              ? `This is a private conversation between you and ${dmPartner?.name || 'this member'}.`
              : isAnnouncement
              ? 'This is the official announcements channel.'
              : activeChannel.description || 'AVK team coordination channel.'}
          </p>
        </div>

        {/* Message Items */}
        <AnimatePresence initial={false}>
          {(messages || []).map((msg, index) => {
            const isAdminMsg = msg.user_role === 'hod_admin';
            const isLeaderMsg = msg.user_role === 'team_leader';
            const isMe = Number(msg.user_id) === Number(currentUser?.id);
            const canDelete = isMe; // ONLY author who sent this message can delete it, not even admin
            const canEdit = isMe;   // author can always edit their message
            const isCurrentlyEditing = editingMessageId === msg.id;

            // Check if current user is mentioned in this message
            const contentLower = String(msg.content || '').toLowerCase();
            const currentNameLower = String(currentUser?.name || '').toLowerCase();
            const currentUsernameLower = String(currentUser?.username || '').toLowerCase();
            const mentionsMe = !isMe && Boolean(msg.content) && (
              (currentNameLower && contentLower.includes(`@${currentNameLower}`)) ||
              (currentUsernameLower && contentLower.includes(`@${currentUsernameLower}`)) ||
              /@all\b/i.test(msg.content) ||
              /@everyone\b/i.test(msg.content)
            );

            return (
              <motion.div
                key={msg.id || index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`w-full flex ${isMe ? 'justify-end' : 'justify-start'} my-2 select-text`}
              >
                <div
                  className={`group relative flex items-end gap-2 max-w-[85%] sm:max-w-[75%] ${
                    isMe ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* User Avatar */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white shadow-sm shrink-0 mb-1 ${
                      AVATAR_COLORS[msg.user_id] || 'bg-gray-600'
                    }`}
                    title={isMe ? 'You' : msg.user_name}
                  >
                    {msg.avatar || (isMe ? 'You' : msg.user_name?.slice(0, 2))}
                  </div>

                  {/* WhatsApp-Style Chat Bubble */}
                  <div
                    className={`relative rounded-2xl px-3.5 py-2 shadow-md border transition-all ${
                      isMe
                        ? 'bg-[#005C4B] border-[#007A5A]/30 text-white rounded-br-xs'
                        : mentionsMe
                        ? 'bg-[#222E35] border-l-4 border-l-amber-400 border-t-[#383C40] border-r-[#383C40] border-b-[#383C40] text-gray-100 rounded-bl-xs shadow-lg shadow-amber-500/5 ring-1 ring-amber-400/20'
                        : 'bg-[#202C33] border-[#2A3942] text-gray-100 rounded-bl-xs'
                    }`}
                  >
                    {/* Sender Header */}
                    <div className={`flex items-baseline gap-2 mb-1 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className={`font-bold text-xs flex items-center gap-1 ${isMe ? 'text-[#6ee7b7]' : 'text-[#ECB22E]'}`}>
                        {isMe ? 'You' : msg.user_name}
                        {isAdminMsg && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                            <Crown className="w-2.5 h-2.5" /> HOD
                          </span>
                        )}
                        {isLeaderMsg && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                            <Shield className="w-2.5 h-2.5" /> Leader
                          </span>
                        )}
                      </span>

                      {mentionsMe && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <AtSign className="w-2.5 h-2.5" /> Mentioned you
                        </span>
                      )}
                      {Boolean(msg.is_global_broadcast) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wide bg-gradient-to-r from-amber-500/30 to-yellow-400/20 text-amber-200 border border-amber-400/50">
                          <Megaphone className="w-2.5 h-2.5" /> GLOBAL ANNOUNCEMENT
                        </span>
                      )}
                    </div>

                    {/* Inline Message Editing or Display */}
                    {isCurrentlyEditing ? (
                      <div className="mt-1 min-w-[220px]">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveEdit(msg.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          rows={2}
                          className="w-full bg-[#1A1D21] text-white text-sm p-2 rounded-lg border border-emerald-400 focus:outline-none resize-none"
                          autoFocus
                        />
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <button
                            onClick={() => handleSaveEdit(msg.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-2.5 py-1 rounded bg-[#2C3136] hover:bg-[#383C40] text-gray-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            Cancel
                          </button>
                          <span className="text-[10px] text-gray-300">
                            Press Enter to save, Esc to cancel
                          </span>
                        </div>
                      </div>
                    ) : (
                      msg.content && (
                        <div className="text-sm leading-relaxed break-words whitespace-pre-wrap text-gray-100">
                          <RenderMessageText
                            text={msg.content}
                            currentUserName={currentUser?.name}
                            currentUsername={currentUser?.username}
                            members={allKnownMembers}
                          />
                        </div>
                      )
                    )}

                    {/* Attached Image */}
                    {msg.file_url && msg.file_type?.startsWith('image/') && (
                      <div className="mt-2 max-w-sm rounded-lg overflow-hidden border border-black/20 bg-black/20">
                        <a href={msg.file_url.startsWith('http') ? msg.file_url : `${window.BACKEND_URL || ''}${msg.file_url}`} target="_blank" rel="noreferrer">
                          <img
                            src={msg.file_url.startsWith('http') ? msg.file_url : `${window.BACKEND_URL || ''}${msg.file_url}`}
                            alt={msg.file_name || 'Attachment'}
                            className="w-full max-h-72 object-cover hover:opacity-90 transition-opacity cursor-pointer rounded-lg"
                          />
                        </a>
                      </div>
                    )}

                    {/* Attached Document */}
                    {msg.file_url && !msg.file_type?.startsWith('image/') && (
                      <div className="mt-2 inline-flex items-center gap-2.5 p-2 rounded-lg border border-black/20 bg-black/20 hover:bg-black/30 transition-colors max-w-md">
                        <FileText className="w-4 h-4 text-emerald-300 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">
                            {msg.file_name || 'Document'}
                          </p>
                        </div>
                        <a
                          href={msg.file_url.startsWith('http') ? msg.file_url : `${window.BACKEND_URL || ''}${msg.file_url}`}
                          download={msg.file_name}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}

                    {/* Timestamp & Edited Indicator inside bubble + WhatsApp Double Ticks */}
                    <div className={`flex items-center gap-1.5 mt-1 text-[10px] select-none ${isMe ? 'text-emerald-100 justify-end' : 'text-gray-400 justify-start'}`}>
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {Boolean(msg.is_edited) && (
                        <span className="italic text-gray-300">
                          • (edited)
                        </span>
                      )}

                      {/* WhatsApp-Style Read Receipts (Double Ticks) */}
                      {isMe && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInfoModalMsg(msg);
                          }}
                          className="inline-flex items-center cursor-pointer hover:opacity-80 transition-opacity ml-0.5"
                          title={
                            msg.is_read_all
                              ? (isDM
                                  ? `Read by recipient at ${msg.read_by?.[0]?.read_at ? new Date(msg.read_by[0].read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}`
                                  : `Read by all members: ${(msg.read_by || []).map((u) => u.user_name).join(', ')}`)
                              : msg.is_read
                              ? `Read by: ${(msg.read_by || []).map((u) => u.user_name).join(', ')} (Click for details)`
                              : 'Delivered (Click for details)'
                          }
                        >
                          {msg.is_read_all ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB] drop-shadow-xs" />
                          ) : msg.is_read ? (
                            <span className="inline-flex items-center gap-0.5">
                              <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]/80" />
                              {(msg.read_by || []).length > 1 && (
                                <span className="text-[9px] text-[#53BDEB] font-bold">
                                  {msg.read_by.length}
                                </span>
                              )}
                            </span>
                          ) : (
                            <CheckCheck className="w-3.5 h-3.5 text-gray-300/60" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Reactions Display beneath message bubble with Instant Tooltip & Details Click */}
                    {Array.isArray(msg.reactions) && msg.reactions.length > 0 && (
                      <div
                        className={`flex items-center gap-1.5 mt-1.5 flex-wrap ${
                          isMe ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.reactions.map((r) => {
                          const myReaction = r.users?.includes(currentUser?.id);
                          const namesList = (r.user_names || []).join(', ');
                          return (
                            <div key={r.emoji} className="relative group/rx">
                              <button
                                type="button"
                                onClick={() => {
                                  setReactionModalMsg(msg);
                                  setSelectedReactionTab(r.emoji);
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-all select-none cursor-pointer ${
                                  myReaction
                                    ? 'bg-[#007A5A] border border-emerald-400 text-white shadow-sm ring-1 ring-emerald-400/30'
                                    : 'bg-[#181D20]/95 border border-[#3A454D] text-gray-200 hover:bg-[#2A373F] hover:text-white'
                                }`}
                              >
                                <span className="text-xs leading-none">{r.emoji}</span>
                                <span className="text-[10px] leading-none font-bold">{r.count}</span>
                              </button>

                              {/* Zero-delay instant hover tooltip showing names */}
                              <div className="pointer-events-none opacity-0 group-hover/rx:opacity-100 transition-opacity duration-150 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#121517] border border-[#3E454D] px-2.5 py-1 rounded-lg text-[11px] text-white shadow-2xl z-40">
                                <span className="mr-1">{r.emoji}</span>
                                <span className="font-semibold text-gray-200">{namesList || '1 person'}</span>
                                <div className="text-[9px] text-[#ECB22E] mt-0.5">Click to view who reacted</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* WhatsApp-Style Floating Reaction Picker */}
                  <AnimatePresence>
                    {activeReactionMenuMsgId === msg.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 6 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute z-30 -top-10 ${
                          isMe ? 'right-2' : 'left-2'
                        } bg-[#202C33] border border-[#3E4A52] rounded-full px-2 py-1 shadow-2xl flex items-center gap-1 backdrop-blur-md`}
                      >
                        {QUICK_REACTIONS.map((emoji) => {
                          const hasReacted = (msg.reactions || []).some(
                            (r) => r.emoji === emoji && r.users?.includes(currentUser?.id)
                          );
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                onToggleReaction && onToggleReaction(msg.id, emoji);
                                setActiveReactionMenuMsgId(null);
                              }}
                              className={`text-lg p-1 rounded-full transition-transform hover:scale-130 active:scale-90 ${
                                hasReacted ? 'bg-white/20' : 'hover:bg-white/10'
                              }`}
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Floating Action Buttons (Visible on hover) */}
                  {!isCurrentlyEditing && (
                    <div
                      className={`flex items-center gap-1 opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity self-center shrink-0 ${
                        isMe ? 'order-first mr-1' : 'order-last ml-1'
                      }`}
                    >
                      {/* Emoji Reaction Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReactionMenuMsgId(
                            activeReactionMenuMsgId === msg.id ? null : msg.id
                          )
                        }
                        className={`p-1.5 rounded-lg border transition-all shadow-sm ${
                          activeReactionMenuMsgId === msg.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-[#2A2E33]/90 hover:bg-white/10 text-gray-400 hover:text-amber-300 border-[#383C40]'
                        }`}
                        title="React with emoji"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>

                      {/* Message Info (Read receipts) button */}
                      {isMe && (
                        <button
                          type="button"
                          onClick={() => setInfoModalMsg(msg)}
                          className="p-1.5 rounded-lg bg-[#2A2E33]/90 hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-300 border border-[#383C40] transition-all shadow-sm"
                          title="Message Info / Read by"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canEdit && (
                        <button
                          onClick={() => handleStartEdit(msg)}
                          className="p-1.5 rounded-lg bg-[#2A2E33]/90 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 border border-[#383C40] transition-all shadow-sm"
                          title="Edit message"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteMsg(msg.id)}
                          className="p-1.5 rounded-lg bg-[#2A2E33]/90 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-[#383C40] transition-all shadow-sm"
                          title="Delete message permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {typingUser && (
          <div className="text-xs text-gray-400 italic flex items-center gap-1.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{typingUser} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Modern Floating Mention Auto-complete Dropdown */}
      <AnimatePresence>
        {showMentionMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="mx-4 mb-2 bg-[#222529]/95 backdrop-blur-xl border border-[#383C40] rounded-2xl shadow-2xl overflow-hidden flex flex-col z-30"
          >
            {/* Header bar with keyboard guidance */}
            <div className="px-3.5 py-2 border-b border-[#2C3136] bg-[#1E2124]/90 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-[#1164A3]/30 border border-[#1164A3]/50 flex items-center justify-center text-sky-400">
                  <AtSign className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Mention Member
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#181A1D] text-[10px] text-gray-400 font-mono">
                  {mentionCandidates.length}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-gray-400 select-none">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-[#181A1D] border border-gray-700 text-gray-300 font-mono text-[9px]">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-[#181A1D] border border-gray-700 text-gray-300 font-mono text-[9px]">↵ Enter</kbd> select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-[#181A1D] border border-gray-700 text-gray-300 font-mono text-[9px]">Esc</kbd>
                </span>
              </div>
            </div>

            {/* Candidates list */}
            <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
              {mentionCandidates.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-1">
                  <Users className="w-5 h-5 text-gray-500 mb-1" />
                  <span>No members match "<strong className="text-white">@{mentionFilter}</strong>"</span>
                </div>
              ) : (
                mentionCandidates.map((c, idx) => {
                  const isSelected = idx === selectedMentionIndex;
                  const isAll = c.id === 'all';

                  return (
                    <button
                      key={c.id}
                      ref={(el) => (mentionItemRefs.current[idx] = el)}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectMention(c.name);
                      }}
                      onMouseEnter={() => setSelectedMentionIndex(idx)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-[#1164A3] text-white shadow-md'
                          : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isAll ? (
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow shrink-0">
                            <Megaphone className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="relative shrink-0">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow ${
                                AVATAR_COLORS[c.id] || 'bg-gray-600'
                              }`}
                            >
                              {c.avatar || c.name?.slice(0, 2)}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ${
                                isSelected ? 'ring-[#1164A3]' : 'ring-[#222529]'
                              } ${c.isOnline ? 'bg-emerald-400' : 'bg-gray-500'}`}
                            />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-semibold text-sm truncate ${isSelected ? 'text-white' : 'text-gray-100'}`}>
                              {isAll ? '@all' : c.name}
                            </span>
                            {c.role === 'hod_admin' && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                isSelected ? 'bg-amber-400/30 text-amber-100' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}>
                                <Crown className="w-2.5 h-2.5" /> HOD
                              </span>
                            )}
                            {c.role === 'team_leader' && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                isSelected ? 'bg-blue-400/30 text-blue-100' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}>
                                <Shield className="w-2.5 h-2.5" /> Leader
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] truncate flex items-center gap-2 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                            {c.desc}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 ml-2">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-white/20 text-white font-mono">
                            <CornerDownLeft className="w-3 h-3" /> Select
                          </span>
                        ) : (
                          c.team_name && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#181A1D]/60 text-gray-400 border border-[#383C40]/50">
                              {c.team_name}
                            </span>
                          )
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Selected File Badge Preview */}
      {selectedFile && (
        <div className="mx-4 mb-2 p-2 bg-[#222529] border border-[#383C40] rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {filePreview ? (
              <img src={filePreview} alt="Preview" className="w-8 h-8 rounded object-cover" />
            ) : (
              <FileText className="w-6 h-6 text-blue-400" />
            )}
            <span className="text-xs text-gray-200 truncate">{selectedFile.name}</span>
          </div>
          <button onClick={handleRemoveFile} className="p-1 text-gray-400 hover:text-red-400 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5. Message Input Bar or Permission Lock Banner */}
      <div className="p-4 pt-1 border-t border-[#2C3136] bg-[#1A1D21]">
        {!canPost ? (
          <div className="p-3.5 bg-[#222529] border border-[#383C40] rounded-xl flex items-center justify-center gap-2 text-gray-400 text-xs">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{permissionReason}</span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="border border-[#383C40] focus-within:border-[#ECB22E] bg-[#222529] rounded-xl shadow-sm transition-all"
          >
            <textarea
              ref={textareaRef}
              rows={2}
              placeholder={
                isDM
                  ? `Message ${dmPartner?.name || activeChannel.dm_user?.name || 'member'}...`
                  : isAnnouncement
                  ? 'Write an announcement... (use @all or @name to mention)'
                  : `Message #${activeChannel.name || 'channel'}... (@name)`
              }
              value={content}
              onChange={handleTextChange}
              onKeyDown={(e) => {
                if (showMentionMenu) {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowMentionMenu(false);
                    return;
                  }
                  if (mentionCandidates.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
                      return;
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      const candidate = mentionCandidates[selectedMentionIndex];
                      if (candidate) {
                        handleSelectMention(candidate.name);
                      }
                      return;
                    }
                  }
                }

                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="w-full bg-transparent px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none resize-none leading-relaxed"
            />

            <div className="px-2.5 py-1.5 flex items-center justify-between border-t border-[#2C3136]/60 bg-[#1E2124]/40 rounded-b-xl">
              <div className="flex items-center gap-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  title="Attach file or photo"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowDriveModal(true)}
                  className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-emerald-400 transition-colors"
                  title="Attach Google Drive link"
                >
                  <Link className="w-4 h-4" />
                </button>

                {!isDM && (
                  <button
                    type="button"
                    onClick={handleTriggerMention}
                    className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-[#ECB22E] transition-colors"
                    title="Mention someone (@)"
                  >
                    <AtSign className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isUploading || (!content.trim() && !selectedFile)}
                className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold text-xs transition-all ${
                  content.trim() || selectedFile
                    ? 'bg-[#007A5A] hover:bg-[#148567] text-white shadow'
                    : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 6. Google Drive Link Modal */}
      {showDriveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#222529] border border-[#383C40] rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Link className="w-5 h-5 text-emerald-400" /> Add Google Drive Link
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Paste your Google Drive file or folder share URL below.
            </p>
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#1A1D21] border border-[#383C40] text-sm text-white focus:outline-none focus:border-emerald-400 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDriveModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddDriveLink}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Insert Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. WhatsApp-Style Reaction Details Modal (Who reacted with what) */}
      {reactionModalMsg && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <div className="bg-[#222529] border border-[#383C40] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#383C40] flex items-center justify-between bg-[#1E2124] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">Message Reactions</h3>
                  <p className="text-[11px] text-gray-400">
                    {(reactionModalMsg.reactions || []).reduce((sum, r) => sum + r.count, 0)} total reactions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReactionModalMsg(null)}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reaction Tabs */}
            <div className="flex border-b border-[#383C40] px-4 bg-[#1A1D21] gap-2 overflow-x-auto shrink-0 py-2.5">
              <button
                type="button"
                onClick={() => setSelectedReactionTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedReactionTab === 'all'
                    ? 'bg-[#350d36] text-[#ECB22E] border border-[#ECB22E]/40 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                All ({(reactionModalMsg.reactions || []).reduce((sum, r) => sum + r.count, 0)})
              </button>

              {(reactionModalMsg.reactions || []).map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => setSelectedReactionTab(r.emoji)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedReactionTab === r.emoji
                      ? 'bg-[#350d36] text-[#ECB22E] border border-[#ECB22E]/40 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="text-sm">{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              ))}
            </div>

            {/* Member Reactions List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[50vh]">
              {(() => {
                // Gather list of reacted users for the active tab
                const reactionsList = reactionModalMsg.reactions || [];
                const targetReactions =
                  selectedReactionTab === 'all'
                    ? reactionsList
                    : reactionsList.filter((r) => r.emoji === selectedReactionTab);

                const usersList = [];
                targetReactions.forEach((r) => {
                  if (Array.isArray(r.users_detail) && r.users_detail.length > 0) {
                    r.users_detail.forEach((u) => {
                      usersList.push({ ...u, emoji: r.emoji });
                    });
                  } else {
                    // Fallback to user_names if users_detail not populated
                    (r.user_names || []).forEach((name, idx) => {
                      usersList.push({
                        user_id: r.users?.[idx],
                        user_name: name,
                        emoji: r.emoji
                      });
                    });
                  }
                });

                if (usersList.length === 0) {
                  return (
                    <div className="text-center py-6 text-gray-500 text-xs">
                      No reactions found for this tab.
                    </div>
                  );
                }

                return usersList.map((item, idx) => {
                  const isMeItem = Number(item.user_id) === Number(currentUser?.id);
                  return (
                    <div
                      key={`${item.user_id}_${item.emoji}_${idx}`}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#1A1D21] border border-[#2D3136] hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                            AVATAR_COLORS[item.user_id] || 'bg-gray-700'
                          }`}
                        >
                          {item.avatar || item.user_name?.slice(0, 2) || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs sm:text-sm text-white truncate flex items-center gap-1.5">
                            {item.user_name}
                            {isMeItem && (
                              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                You
                              </span>
                            )}
                            {item.user_role === 'hod_admin' && (
                              <span className="text-[9px] text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 flex items-center gap-0.5">
                                <Crown className="w-2.5 h-2.5" /> HOD
                              </span>
                            )}
                            {item.user_role === 'team_leader' && (
                              <span className="text-[9px] text-blue-300 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20 flex items-center gap-0.5">
                                <Shield className="w-2.5 h-2.5" /> Leader
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Reacted with {item.emoji}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xl p-1 rounded-lg bg-black/30 border border-white/5 shadow-xs">
                          {item.emoji}
                        </span>
                        {isMeItem && (
                          <button
                            type="button"
                            onClick={() => {
                              onToggleReaction && onToggleReaction(reactionModalMsg.id, item.emoji);
                              setReactionModalMsg(null);
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/60 px-2 py-1 rounded-lg border border-red-500/30 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Quick react bar at bottom */}
            <div className="px-4 py-3 border-t border-[#383C40] bg-[#1E2124] flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Quick React:</span>
              <div className="flex items-center gap-1.5">
                {QUICK_REACTIONS.map((emoji) => {
                  const hasMyReaction = (reactionModalMsg.reactions || []).some(
                    (r) => r.emoji === emoji && r.users?.includes(currentUser?.id)
                  );
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onToggleReaction && onToggleReaction(reactionModalMsg.id, emoji);
                        setReactionModalMsg(null);
                      }}
                      className={`text-lg p-1.5 rounded-xl transition-all ${
                        hasMyReaction
                          ? 'bg-amber-500/20 border border-amber-500/50 scale-110'
                          : 'hover:bg-white/10 opacity-75 hover:opacity-100 hover:scale-110'
                      }`}
                      title={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. WhatsApp-Style Message Info Modal (Read Receipts & Double Ticks) */}
      {infoModalMsg && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <div className="bg-[#222529] border border-[#383C40] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#383C40] flex items-center justify-between bg-[#1E2124] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-[#53BDEB] flex items-center justify-center">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">Message Info</h3>
                  <p className="text-[11px] text-gray-400">
                    {infoModalMsg.is_read_all
                      ? 'Read by everyone'
                      : infoModalMsg.is_read
                      ? `Read by ${infoModalMsg.read_by?.length || 0} members`
                      : 'Delivered to members'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInfoModalMsg(null)}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Message Preview */}
            <div className="p-4 border-b border-[#383C40] bg-[#1A1D21]">
              <p className="text-[11px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">
                Message Preview
              </p>
              <div className="p-3 rounded-xl bg-[#005C4B] border border-[#007A5A]/40 text-white text-xs leading-relaxed max-h-24 overflow-y-auto">
                {infoModalMsg.content ||
                  (infoModalMsg.file_name ? `📎 Attachment: ${infoModalMsg.file_name}` : 'Message')}
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2.5">
                <span>
                  Sent: {new Date(infoModalMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(infoModalMsg.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 font-semibold text-[#53BDEB]">
                  {infoModalMsg.is_read_all ? (
                    <>
                      <CheckCheck className="w-4 h-4 text-[#53BDEB]" /> Read by all
                    </>
                  ) : infoModalMsg.is_read ? (
                    <>
                      <CheckCheck className="w-4 h-4 text-[#53BDEB]" /> Seen
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4 text-gray-400" /> Delivered
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Read / Delivered Lists */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[45vh]">
              {/* SECTION: Read By */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#53BDEB] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCheck className="w-4 h-4 text-[#53BDEB]" />
                    Read by ({infoModalMsg.read_by?.length || 0})
                  </span>
                </div>

                {(infoModalMsg.read_by || []).length > 0 ? (
                  <div className="space-y-1.5">
                    {infoModalMsg.read_by.map((u) => (
                      <div
                        key={u.user_id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#1A1D21] border border-[#2D3136]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                              AVATAR_COLORS[u.user_id] || 'bg-gray-700'
                            }`}
                          >
                            {u.avatar || u.user_name?.slice(0, 2) || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                              {u.user_name}
                              {u.user_role === 'hod_admin' && (
                                <span className="text-[9px] text-amber-300">HOD</span>
                              )}
                              {u.user_role === 'team_leader' && (
                                <span className="text-[9px] text-blue-300">Leader</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="text-[10px] text-emerald-400 font-mono text-right shrink-0">
                          {u.read_at
                            ? new Date(u.read_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Seen'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic p-2 bg-[#1A1D21]/40 rounded-xl border border-white/5">
                    No one has read this message yet.
                  </p>
                )}
              </div>

              {/* SECTION: Delivered To */}
              {Array.isArray(infoModalMsg.delivered_to) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-gray-400" />
                      Delivered to ({
                        infoModalMsg.delivered_to.filter(
                          (d) => !(infoModalMsg.read_by || []).some((r) => r.user_id === d.user_id)
                        ).length
                      })
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {infoModalMsg.delivered_to
                      .filter((d) => !(infoModalMsg.read_by || []).some((r) => r.user_id === d.user_id))
                      .map((u) => (
                        <div
                          key={u.user_id}
                          className="flex items-center justify-between p-2 rounded-xl bg-[#1A1D21]/60 border border-[#2D3136]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 ${
                                AVATAR_COLORS[u.user_id] || 'bg-gray-700'
                              }`}
                            >
                              {u.avatar || u.user_name?.slice(0, 2) || 'U'}
                            </div>
                            <p className="text-xs text-gray-300 truncate">{u.user_name}</p>
                          </div>
                          <span className="text-[10px] text-gray-500">Delivered</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#383C40] bg-[#1E2124] flex justify-end">
              <button
                type="button"
                onClick={() => setInfoModalMsg(null)}
                className="px-4 py-1.5 rounded-lg bg-[#2C3136] hover:bg-[#383C40] text-gray-200 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RenderMessageText({ text, currentUserName, currentUsername, members = [] }) {
  if (!text) return null;

  // Build list of valid mention names/usernames sorted by length descending
  const candidateNames = ['all', 'everyone'];
  (members || []).forEach((m) => {
    if (m?.name) candidateNames.push(String(m.name).trim());
    if (m?.username) candidateNames.push(String(m.username).trim());
  });

  const uniqueNames = Array.from(new Set(candidateNames.filter(Boolean)));
  uniqueNames.sort((a, b) => b.length - a.length);

  const escapedNames = uniqueNames
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  // Match URLs, @(knownName)\b, or fallback @[a-zA-Z0-9_\u0A80-\u0AFF]+
  const tokenRegex = new RegExp(
    `(https?:\\/\\/[^\\s]+|@(?:${escapedNames})\\b|@[a-zA-Z0-9_\\u0A80-\\u0AFF]+)`,
    'gi'
  );

  const parts = [];
  let lastIndex = 0;
  let match;

  const targetMyName = String(currentUserName || '').trim().toLowerCase();
  const targetMyUsername = String(currentUsername || '').trim().toLowerCase();

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${match.index}-${token}`;

    if (token.startsWith('@')) {
      const mentionTarget = token.slice(1).trim().toLowerCase();
      const isMentionMe =
        (targetMyName && mentionTarget === targetMyName) ||
        (targetMyUsername && mentionTarget === targetMyUsername);
      const isMentionAll = mentionTarget === 'all' || mentionTarget === 'everyone';

      if (isMentionMe) {
        parts.push(
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-lg bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-200 border border-amber-400/50 font-bold text-xs shadow-sm tracking-wide select-all"
            title="You were mentioned!"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-amber-400/30 flex items-center justify-center text-amber-200 text-[10px] font-bold">
              @
            </span>
            <span>{token.slice(1)}</span>
            <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-amber-400/30 text-amber-100 font-extrabold tracking-tighter">
              YOU
            </span>
          </span>
        );
      } else if (isMentionAll) {
        parts.push(
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-lg bg-gradient-to-r from-orange-500/25 to-amber-500/20 text-orange-200 border border-orange-400/50 font-bold text-xs shadow-sm tracking-wide"
            title="Broadcast to channel"
          >
            <Megaphone className="w-3 h-3 text-orange-300 shrink-0" />
            <span>all</span>
          </span>
        );
      } else {
        parts.push(
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-lg bg-[#1164A3]/25 hover:bg-[#1164A3]/45 text-sky-200 border border-sky-400/30 font-semibold text-xs transition-colors cursor-pointer"
          >
            <span className="text-sky-400 font-bold">@</span>
            <span>{token.slice(1)}</span>
          </span>
        );
      }
    } else if (token.startsWith('http')) {
      const isDrive = token.includes('drive.google.com');
      parts.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-1 font-medium hover:underline mx-0.5 ${
            isDrive ? 'text-emerald-400' : 'text-blue-400'
          }`}
        >
          {token}
          <ExternalLink className="w-3 h-3" />
        </a>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
