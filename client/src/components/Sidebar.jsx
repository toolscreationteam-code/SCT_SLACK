import React, { useState } from 'react';
import {
  Hash,
  Megaphone,
  Plus,
  Users,
  LogOut,
  Crown,
  Shield,
  Bell,
  Search,
  MessageSquare,
  Lock
} from 'lucide-react';
import { AVATAR_COLORS } from '../constants/members';

export default function Sidebar({
  workspace,
  currentUser,
  channels = [],
  activeChannel,
  onSelectChannel,
  onStartDM,
  users = [],
  onlineUsers = [],
  unreadCounts = {},
  onOpenCreateChannel,
  onOpenUserManagement,
  onLogout,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  isOpenMobile,
  onCloseMobile
}) {
  const [filterText, setFilterText] = useState('');

  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'workspace_head';
  const isLeader = currentUser?.role === 'team_leader';
  const canCreateChannel = !currentUser?.isMasterAdmin && (isAdmin || isLeader);

  const safeChannels = Array.isArray(channels) ? channels : [];
  // The parent supplies only the active workspace's directory. Never fall back to
  // a static directory, because that could expose another workspace's members.
  const safeUsers = Array.isArray(users) ? users : [];
  const safeOnlineUsers = (Array.isArray(onlineUsers) ? onlineUsers : []).map(Number);

  const regularChannels = safeChannels.filter((c) => !c.is_direct);
  const filteredChannels = regularChannels.filter((c) =>
    (c.name || '').toLowerCase().includes(filterText.toLowerCase())
  );

  const otherUsers = currentUser?.isMasterAdmin ? [] : safeUsers.filter((u) => Number(u.id) !== Number(currentUser?.id));
  const filteredOtherUsers = otherUsers.filter((u) =>
    (u.name || '').toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#3F0E40] text-gray-300 flex flex-col border-r border-[#522653] transition-transform duration-300 md:relative md:translate-x-0 ${
        isOpenMobile ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* 1. Workspace Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#522653] bg-[#350d36]/70 backdrop-blur-sm select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#ECB22E] text-[#3F0E40] flex items-center justify-center font-black text-sm shadow-sm shrink-0">
            AVK
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-sm text-white truncate flex items-center gap-1">
              {workspace?.name || 'AVK Workspace'}
            </h2>
            <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {safeOnlineUsers.length} Online
            </p>
          </div>
        </div>
      </div>

      {/* 2. Quick Search Bar */}
      <div className="p-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search channels or members..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full bg-[#350d36]/80 text-white placeholder-gray-400 text-xs pl-8 pr-3 py-1.5 rounded-md border border-[#522653] focus:outline-none focus:border-[#ECB22E]"
          />
        </div>
      </div>

      {/* 3. Navigation List (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 text-xs font-medium">
        {/* CHANNELS SECTION */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-gray-400 select-none">
            <span className="font-semibold tracking-wider uppercase text-[11px] flex items-center gap-1.5">
              Channels
            </span>
            {canCreateChannel && (
              <button
                onClick={onOpenCreateChannel}
                className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                title="Create team or channel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-1 space-y-0.5">
            {filteredChannels.map((channel) => {
              const isActive = activeChannel?.id === channel.id;
              const unreadCount = unreadCounts[channel.id] || 0;
              const isAnnouncement = Boolean(channel.is_announcement);
              const isRestricted = channel.post_permission !== 'all';

              return (
                <button
                  key={channel.id}
                  onClick={() => {
                    onSelectChannel(channel);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors text-left group ${
                    isActive
                      ? 'bg-[#1164A3] text-white font-semibold shadow-sm'
                      : 'hover:bg-[#350d36] text-gray-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isAnnouncement ? (
                      <Megaphone
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-amber-300' : 'text-amber-400'
                        }`}
                      />
                    ) : (
                      <Hash
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-white' : 'text-gray-400'
                        }`}
                      />
                    )}
                    <span className="truncate">{channel.name}</span>
                    {isRestricted && (
                      <Lock className="w-3 h-3 text-amber-300/70 shrink-0" title="Restricted posting" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Slack & WhatsApp style unread badge */}
                    {unreadCount > 0 && (
                      <span className="min-w-[19px] h-[19px] px-1.5 rounded-full bg-[#E01E5A] text-white font-bold text-[11px] flex items-center justify-center shadow-sm">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* DIRECT MESSAGES (DMs) SECTION */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-gray-400 select-none">
            <span className="font-semibold tracking-wider uppercase text-[11px] flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Direct Messages
            </span>
          </div>

          <div className="mt-1 space-y-0.5">
            {filteredOtherUsers.map((user) => {
              const isOnline = safeOnlineUsers.includes(Number(user.id));
              const minId = Math.min(Number(currentUser?.id || 0), Number(user.id));
              const maxId = Math.max(Number(currentUser?.id || 0), Number(user.id));
              const expectedDmName = `dm_${minId}_${maxId}`;

              // Find if this DM channel already exists
              const dmChannel = safeChannels.find(
                (c) => c.is_direct && (Number(c.dm_user?.id) === Number(user.id) || c.name === expectedDmName)
              );

              const isSelectedDM =
                Boolean(activeChannel?.is_direct) &&
                (Number(activeChannel?.dm_user?.id) === Number(user.id) || activeChannel?.name === expectedDmName);

              // Find if this DM has an unread count
              const unreadCount = dmChannel
                ? (unreadCounts[dmChannel.id] || unreadCounts[`user_${user.id}`] || 0)
                : (unreadCounts[`user_${user.id}`] || 0);

              return (
                <button
                  key={user.id}
                  onClick={() => {
                    if (dmChannel) {
                      onSelectChannel({ ...dmChannel, dm_user: dmChannel.dm_user || user });
                    } else {
                      onStartDM(user);
                    }
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors text-left group ${
                    isSelectedDM
                      ? 'bg-[#1164A3] text-white font-semibold shadow-sm'
                      : 'hover:bg-[#350d36] text-gray-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${
                        isOnline
                          ? 'bg-emerald-400 ring-2 ring-emerald-900 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse'
                          : 'bg-gray-500/60'
                      }`}
                      title={isOnline ? 'Online' : 'Offline'}
                    />
                    <span className={`truncate ${isOnline ? 'font-semibold text-white' : ''}`}>
                      {user.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Slack & WhatsApp style unread badge for Direct Messages */}
                    {unreadCount > 0 ? (
                      <span className="min-w-[19px] h-[19px] px-1.5 rounded-full bg-[#E01E5A] text-white font-bold text-[11px] flex items-center justify-center shadow-sm">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : (
                      <>
                        {user.role === 'hod_admin' && (
                          <Crown className="w-3 h-3 text-amber-400" />
                        )}
                        {user.role === 'team_leader' && (
                          <Shield className="w-3 h-3 text-blue-400" />
                        )}
                        <span className="text-[9px] text-gray-400 group-hover:text-gray-200">
                          {user.team_name}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* HOD / Admin Team Management Shortcut */}
        {currentUser?.role === 'super_admin' && (
          <div className="pt-2 border-t border-[#522653]/60">
            <button
              onClick={onOpenUserManagement}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-xs transition-colors"
            >
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Master Admin Control</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Bottom Current User Bar */}
      <div className="p-3 border-t border-[#522653] bg-[#350d36]/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow shrink-0 ${
              AVATAR_COLORS[currentUser?.id] || 'bg-gray-600'
            }`}
          >
            {currentUser?.avatar || currentUser?.name?.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs text-white truncate flex items-center gap-1">
              {currentUser?.name}
              {isAdmin && (
                <Crown className="w-3 h-3 text-amber-400 shrink-0" />
              )}
            </p>
            <p className="text-[10px] text-gray-400 truncate">
              {isAdmin
                ? currentUser?.role === 'super_admin' ? 'Master Admin' : 'Workspace Leader'
                : currentUser?.role === 'team_leader'
                ? `Leader (${currentUser?.team_name})`
                : currentUser?.team_name}
            </p>
          </div>
        </div>

        {/* Logout Action */}
        <div className="flex items-center gap-1">
          <button
            onClick={onLogout}
            className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-400 hover:text-red-300 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
