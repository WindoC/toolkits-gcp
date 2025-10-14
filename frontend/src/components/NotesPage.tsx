import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';

type Note = { note_id: string; title: string; content?: string; created_at?: string; updated_at?: string };

export const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiService.getNotes();
      setNotes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSelect = async (n: Note) => {
    try {
      const full = await apiService.getNote(n.note_id);
      setSelected(full);
      setTitle(full.title || '');
      setContent(full.content || '');
    } catch (e) { console.error(e); }
  };

  const resetForm = () => {
    setSelected(null);
    setTitle('');
    setContent('');
  };

  const onCreate = async () => {
    if (!title.trim()) return;
    try {
      await apiService.createNote(title, content);
      resetForm();
      await load();
    } catch (e) { console.error(e); }
  };

  const onUpdate = async () => {
    if (!selected) return;
    try {
      await apiService.updateNote(selected.note_id, { title, content });
      await load();
    } catch (e) { console.error(e); }
  };

  const onDelete = async (noteId: string) => {
    try {
      await apiService.deleteNote(noteId);
      if (selected?.note_id === noteId) resetForm();
      await load();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-3 flex items-center justify-between">
          <h2 className="font-semibold">Notes</h2>
          <button className="px-2 py-1 text-sm rounded bg-blue-600 text-white" onClick={load} disabled={loading}>Refresh</button>
        </div>
        <ul>
          {notes.map(n => (
            <li key={n.note_id} className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${selected?.note_id===n.note_id?'bg-gray-100 dark:bg-gray-800':''}`}
                onClick={() => onSelect(n)}>
              <div className="flex items-center justify-between">
                <span className="truncate">{n.title}</span>
                <button onClick={(e)=>{e.stopPropagation(); onDelete(n.note_id);}} className="text-xs text-red-600">Delete</button>
              </div>
            </li>
          ))}
          {notes.length===0 && <li className="px-3 py-2 text-gray-500">No notes yet</li>}
        </ul>
      </div>
      <div className="flex-1 p-4">
        <div className="max-w-2xl">
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input className="w-full rounded border px-3 py-2 dark:bg-gray-800" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Note title" />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Content</label>
            <textarea className="w-full h-64 rounded border px-3 py-2 dark:bg-gray-800" value={content} onChange={e=>setContent(e.target.value)} placeholder="Write your note..." />
          </div>
          <div className="flex gap-2">
            {selected ? (
              <>
                <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={onUpdate}>Save</button>
                <button className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700" onClick={resetForm}>New</button>
              </>
            ) : (
              <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={onCreate}>Create</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

