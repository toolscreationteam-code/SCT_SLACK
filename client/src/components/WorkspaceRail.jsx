import React from 'react';
import { Plus, Building2 } from 'lucide-react';

const palette = ['bg-[#611f69]', 'bg-[#1164A3]', 'bg-[#007A5A]', 'bg-[#E01E5A]', 'bg-[#4A154B]'];

export default function WorkspaceRail({ workspaces = [], activeId, unreadByWorkspace = {}, canManage, onSelect, onCreate }) {
  return (
    <aside className="hidden md:flex w-16 shrink-0 bg-[#1d1025] border-r border-white/10 flex-col items-center py-3 gap-3 z-30 overflow-hidden">
      <div className="w-9 h-9 rounded-xl bg-white text-[#4a154b] grid place-items-center shadow-lg"><Building2 className="w-5 h-5" /></div>
      <div className="w-8 h-px bg-white/15" />
      <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto overflow-x-hidden w-full items-center pr-1 [scrollbar-width:thin]" aria-label="Workspaces">
        {workspaces.map((workspace, index) => {
          const active = Number(workspace.id) === Number(activeId);
          const unread = unreadByWorkspace[workspace.id] || 0;
          return <button key={workspace.id} onClick={() => onSelect(workspace)} title={workspace.name}
            className="relative group w-full grid place-items-center focus:outline-none">
            {active && <span className="absolute left-0 w-1 h-8 rounded-r-full bg-white" />}
            <span className={`w-10 h-10 rounded-[13px] grid place-items-center text-[11px] font-black text-white shadow-md transition-all ${palette[index % palette.length]} ${active ? 'ring-2 ring-white scale-105' : 'group-hover:rounded-xl group-hover:scale-105'}`}>
              {workspace.icon || workspace.name?.slice(0, 3).toUpperCase()}
            </span>
            {unread > 0 && <span className="absolute -right-0.5 -top-1 min-w-4 h-4 px-1 rounded-full bg-[#e01e5a] border-2 border-[#1d1025] text-[9px] font-bold text-white grid place-items-center">{unread > 9 ? '9+' : unread}</span>}
          </button>;
        })}
      </div>
      {canManage && <button onClick={onCreate} title="Create workspace" className="shrink-0 w-9 h-9 rounded-xl border border-dashed border-white/30 text-white/75 hover:bg-white/10 hover:text-white grid place-items-center transition-colors"><Plus className="w-5 h-5" /></button>}
    </aside>
  );
}
