import React, { useEffect, useState } from 'react';
import './notes.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiService } from '../services/api';
import EncryptionService from '../services/encryptionService';
import { AESKeyModal } from './AESKeyModal';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import NotesHeader from './NotesHeader';

type Note = { note_id: string; title: string; content?: string; created_at?: string; updated_at?: string };

export const NotesPage: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filtered, setFiltered] = useState<Note[]>([]);
  // Editing handled on dedicated routes; keep only list state here
  const [loading, setLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyModalMessage, setKeyModalMessage] = useState('');
  const [query, setQuery] = useState('');
  // editor is handled on dedicated pages now

  const ensureKey = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (EncryptionService.isAvailable()) return resolve(true);
      setKeyModalMessage('Enter your AES encryption key to access Notes:');
      setShowKeyModal(true);
      const check = () => {
        if (EncryptionService.isAvailable()) { setShowKeyModal(false); resolve(true); }
        else setTimeout(check, 100);
      };
      check();
    });
  };

  const load = async () => {
    try {
      setLoading(true);
      const hasKey = await ensureKey();
      if (!hasKey) return;
      const data = await apiService.getNotes();
      // Try to hydrate content for previews
      const withContent = await Promise.all(
        data.map(async (n) => {
          if (n.content) return n;
          try { const full = await apiService.getNote(n.note_id); return { ...n, content: full.content }; } catch { return n; }
        })
      );
      setNotes(withContent);
      setFiltered(applyFilter(withContent, query));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const applyFilter = (items: Note[], q: string) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(n =>
      (n.title || '').toLowerCase().includes(needle) ||
      (n.content || '').toLowerCase().includes(needle)
    );
  };

  useEffect(() => {
    setFiltered(applyFilter(notes, query));
  }, [query, notes]);

  const onEdit = async (n?: Note) => {
    try {
      const hasKey = await ensureKey(); if (!hasKey) return;
      if (n) {
        navigate(`/note/${n.note_id}`);
      } else {
        navigate('/note/new');
      }
    } catch (e) { console.error(e); }
  };

  // Creation/Update handled in NoteEditorPage

  const onDelete = async (noteId: string) => {
    try {
      const hasKey = await ensureKey(); if (!hasKey) return;
      await apiService.deleteNote(noteId);
      await load();
    } catch (e) { console.error(e); }
  };

  const onDownload = (n: Note) => {
    const blob = new Blob([n.content || ''], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(n.title || 'note').replace(/[^a-z0-9_-]+/gi,'_')}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="notes-theme">
      <NotesHeader rightActions={
        <>
          <button className="btn-sm btn-blue" onClick={() => onEdit(undefined)}>Create</button>
          <label className="btn-sm btn-gray" style={{display:'inline-flex', alignItems:'center', gap:'.25rem', cursor:'pointer'}}>
            <input type="file" accept=".md,.txt" style={{display:'none'}} onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const text = await f.text();
              navigate('/note/new', { state: { title: f.name.replace(/\.[^/.]+$/, ''), content: text } });
              (e.target as HTMLInputElement).value = '';
            }} />
            Upload
          </label>
          <button className="btn-sm btn-red" onClick={logout}>Logout</button>
        </>
      } />

      {/* Search */}
      <div className="notes-root">
        <div className="notes-search">
          <input className="notes-search-input" placeholder="Search notes..." value={query} onChange={e=>setQuery(e.target.value)} />
          <button className="btn-sm btn-blue" onClick={()=>setFiltered(applyFilter(notes, query))}>Search</button>
        </div>

        {/* Grid */}
        <div className="notes-grid">
          {filtered.map(n => (
            <div key={n.note_id} className="note-card">
              <div className="note-title">
                <a href={`/note/${n.note_id}/preview`} style={{textDecoration:'none', color:'inherit'}}>{n.title || 'Untitled'}</a>
              </div>
              <div className="note-updated">Updated: {n.updated_at ? new Date(n.updated_at).toLocaleString() : ''}</div>
              {n.content && (
                <div className="note-preview markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {(n.content || '').slice(0, 200)}
                  </ReactMarkdown>
                </div>
              )}
              <div className="note-buttons">
                <button className="btn-sm btn-blue" onClick={()=>onEdit(n)}>Edit</button>
                <button className="btn-sm btn-gray" onClick={()=>onDownload(n)}>Download</button>
                <button className="btn-sm btn-red" onClick={()=>onDelete(n.note_id)}>Delete</button>
              </div>
            </div>
          ))}
          {filtered.length===0 && (
            <div className="note-card" style={{gridColumn: '1 / -1', textAlign:'center', color:'var(--text-muted)'}}>No notes found</div>
          )}
        </div>
      </div>

      {/* Editor Modal removed; use /note/new and /note/:id */}
      <AESKeyModal isOpen={showKeyModal} onSubmit={async (k)=>{ await EncryptionService.setupEncryptionKey(k); setShowKeyModal(false); }} onCancel={()=>setShowKeyModal(false)} message={keyModalMessage} />
    </div>
  );
};
