import React, { useEffect, useState } from 'react';
import { Building2, Crown, Plus, Trash2, Users, X } from 'lucide-react';

const blank = { name:'', slug:'', icon:'', description:'', head_user_id:'' };

export default function WorkspaceSettingsModal({ isOpen, onClose, currentUser, workspaces=[], users=[], onChanged }) {
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blank);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = currentUser?.role === 'super_admin' && currentUser?.isMasterAdmin;

  const choose = async ws => {
    setSelected(ws); setError('');
    setForm({ name:ws.name||'', slug:ws.slug||'', icon:ws.icon||'', description:ws.description||'', head_user_id:ws.head_user_id||'' });
    const response = await fetch(`/api/workspaces/${ws.id}/members?userId=${currentUser.id}`);
    if (response.ok) setMembers(await response.json()); else setMembers([]);
  };
  useEffect(() => { if (isOpen && workspaces.length && !selected) choose(workspaces[0]); }, [isOpen, workspaces]);

  const save = async event => {
    event.preventDefault(); if (!form.name.trim()) return setError('Workspace name is required.');
    setBusy(true); const isNew = !selected;
    const response = await fetch(isNew ? '/api/workspaces' : `/api/workspaces/${selected.id}`, { method:isNew?'POST':'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...form, head_user_id:Number(form.head_user_id)||null, requested_by:currentUser.id}) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return setError(data.error || 'Unable to save workspace.');
    await onChanged(data, isNew); choose(data);
  };
  const remove = async () => {
    if (!selected || !confirm(`Delete ${selected.name}? This removes its channels and memberships.`)) return;
    const response = await fetch(`/api/workspaces/${selected.id}?requestedBy=${currentUser.id}`, {method:'DELETE'}); const data = await response.json();
    if (!response.ok) return setError(data.error || 'Unable to delete workspace.');
    setSelected(null); setForm(blank); setMembers([]); await onChanged();
  };
  const updateMember = async (userId, workspace_role) => {
    const response = await fetch(`/api/workspaces/${selected.id}/members`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:userId, workspace_role, requested_by:currentUser.id})});
    const data = await response.json(); if (!response.ok) return setError(data.error || 'Unable to update member.');
    await onChanged(); await choose(data.workspace || selected);
  };
  const removeMember = async userId => {
    const response = await fetch(`/api/workspaces/${selected.id}/members/${userId}?requestedBy=${currentUser.id}`, {method:'DELETE'});
    if (response.ok) choose(selected);
  };
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm p-4 grid place-items-center"><div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-[#222529] border border-[#4b5056] shadow-2xl flex flex-col">
    <header className="flex items-center justify-between px-5 py-4 border-b border-[#383c40]"><div><h2 className="text-white font-bold flex gap-2 items-center"><Crown className="w-5 h-5 text-amber-400" />{isAdmin ? 'Master Admin Control' : 'Workspace control'}</h2><p className="text-xs text-gray-400 mt-1">{isAdmin ? 'Manage every workspace, its leaders, members and access.' : 'Manage members and teams in your workspace.'}</p></div><button onClick={onClose} className="p-2 text-gray-400 hover:text-white"><X /></button></header>
    <div className="flex min-h-0 flex-1"><section className="w-56 shrink-0 p-3 border-r border-[#383c40] overflow-y-auto">{isAdmin && <button onClick={() => { setSelected(null); setForm(blank); setMembers([]); }} className="w-full mb-2 px-3 py-2 rounded-lg bg-[#007a5a] hover:bg-[#148567] text-xs font-bold text-white flex gap-2"><Plus className="w-4 h-4" />New workspace</button>}{workspaces.map(ws => <button key={ws.id} onClick={() => choose(ws)} className={`w-full px-3 py-2 text-left rounded-lg mb-1 flex gap-2 items-center ${selected?.id===ws.id?'bg-[#1164a3] text-white':'text-gray-300 hover:bg-white/10'}`}><span className="w-7 h-7 grid place-items-center rounded-lg bg-[#4a154b] text-[10px] font-black">{ws.icon}</span><span className="truncate text-xs font-semibold">{ws.name}</span></button>)}</section>
    <main className="p-5 overflow-y-auto flex-1 grid lg:grid-cols-2 gap-6">{isAdmin ? <form onSubmit={save} className="space-y-3"><h3 className="font-bold text-white flex gap-2 items-center"><Building2 className="w-4 h-4 text-emerald-400" />{selected?'Workspace details':'Create department'}</h3>{error && <p className="text-xs text-red-300 bg-red-950/40 p-2 rounded">{error}</p>}<Field label="Name" value={form.name} onChange={value=>setForm({...form,name:value})}/><Field label="Short code" value={form.icon} placeholder="e.g. AVK" onChange={value=>setForm({...form,icon:value.toUpperCase().slice(0,4)})}/><Field label="Slug" value={form.slug} placeholder="e.g. creative-team" onChange={value=>setForm({...form,slug:value})}/><label className="block text-xs text-gray-300">Description<textarea value={form.description} onChange={event=>setForm({...form,description:event.target.value})} className="mt-1 w-full p-2 rounded bg-[#1a1d21] border border-[#383c40] text-white" rows="3"/></label><label className="block text-xs text-gray-300">Workspace head<select value={form.head_user_id||''} onChange={event=>setForm({...form,head_user_id:event.target.value})} className="mt-1 w-full p-2 rounded bg-[#1a1d21] border border-[#383c40] text-white"><option value="">Choose a head</option>{users.map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select></label><div className="flex gap-2"><button disabled={busy} className="px-4 py-2 bg-[#007a5a] text-white rounded-lg text-xs font-bold">{busy?'Saving…':selected?'Save changes':'Create workspace'}</button>{selected && <button type="button" onClick={remove} className="px-3 py-2 text-red-300 border border-red-500/30 rounded-lg" title="Delete workspace"><Trash2 className="w-4 h-4" /></button>}</div></form> : <section className="space-y-3"><h3 className="font-bold text-white flex gap-2 items-center"><Building2 className="w-4 h-4 text-emerald-400" />Workspace details</h3><p className="text-sm text-gray-300">Workspace name, code and leader are managed by Master Admin. You can manage members here and create teams/channels from the sidebar.</p></section>}
    {selected && <section><h3 className="font-bold text-white flex gap-2 items-center mb-3"><Users className="w-4 h-4 text-sky-400" />Members ({members.length})</h3><div className="space-y-2 max-h-[390px] overflow-y-auto">{members.map(member=><div key={member.id} className="p-2 rounded-lg bg-[#1a1d21] flex items-center gap-2"><span className="w-7 h-7 rounded bg-[#4a154b] text-[10px] font-bold grid place-items-center text-white">{member.avatar||member.name?.slice(0,2)}</span><span className="flex-1 min-w-0 text-xs text-white truncate">{member.name}</span><select value={member.workspace_role} onChange={event=>updateMember(member.id,event.target.value)} className="bg-[#2c3136] text-xs text-white rounded p-1"><option value="member">Member</option><option value="team_leader">Team leader</option>{isAdmin && <option value="workspace_head">Workspace leader</option>}</select>{member.id!==currentUser.id && <button onClick={()=>removeMember(member.id)} className="text-red-300 p-1"><X className="w-4 h-4" /></button>}</div>)}</div><label className="mt-3 block text-xs text-gray-400">Add a person<select defaultValue="" onChange={event=>{if(event.target.value)updateMember(Number(event.target.value),'member');event.target.value='';}} className="mt-1 w-full p-2 rounded bg-[#1a1d21] border border-[#383c40] text-white"><option value="">Select a user…</option>{users.filter(user=>!members.some(member=>member.id===user.id)).map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select></label></section>}</main></div></div></div>;
}

function Field({label,value,onChange,placeholder}) { return <label className="block text-xs text-gray-300">{label}<input value={value} placeholder={placeholder} onChange={event=>onChange(event.target.value)} className="mt-1 w-full p-2 rounded bg-[#1a1d21] border border-[#383c40] text-white"/></label>; }
