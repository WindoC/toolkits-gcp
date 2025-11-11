import React, { useEffect, useRef, useState } from 'react';
import './notes.css';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiService } from '../services/api';
import EncryptionService from '../services/encryptionService';
import { AESKeyModal } from './AESKeyModal';
import NotesHeader from './NotesHeader';

type Note = { note_id: string; title: string; content?: string };

const NoteEditorPage: React.FC = () => {
  const { noteId } = useParams();
  const location = useLocation() as { state?: { title?: string; content?: string } };
  const navigate = useNavigate();
  const isNew = !noteId;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyModalMessage, setKeyModalMessage] = useState('');

  const ensureKey = (): Promise<boolean> => new Promise((resolve) => {
    if (EncryptionService.isAvailable()) return resolve(true);
    setKeyModalMessage('Enter your AES encryption key to access Notes:');
    setShowKeyModal(true);
    const check = () => { if (EncryptionService.isAvailable()) { setShowKeyModal(false); resolve(true); } else setTimeout(check, 100); };
    check();
  });

  useEffect(() => {
    const load = async () => {
      if (!noteId) return;
      try {
        setLoading(true);
        const ok = await ensureKey(); if (!ok) return;
        const n = await apiService.getNote(noteId);
        setTitle(n.title || '');
        setContent(n.content || '');
      } finally { setLoading(false); }
    };
    load();
  }, [noteId]);

  useEffect(() => {
    if (!noteId && location.state) {
      if (location.state.title) setTitle(location.state.title);
      if (location.state.content) setContent(location.state.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (file: File) => {
    const text = await file.text();
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
    setContent(text);
  };

  const autosize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    autosize();
  }, [content]);

  const save = async () => {
    const ok = await ensureKey(); if (!ok) return;
    if (isNew) {
      const res = await apiService.createNote(title, content);
      navigate(`/note/${res.note_id}/preview`);
    } else if (noteId) {
      await apiService.updateNote(noteId, { title, content });
      navigate(`/note/${noteId}/preview`);
    }
  };

  const right = (
    <>
      <button className="btn-sm btn-blue" onClick={save} disabled={!title.trim() || loading}>{isNew ? 'Create' : 'Save'}</button>
      <label className="btn-sm btn-gray" style={{display:'inline-flex',alignItems:'center',gap:'.25rem',cursor:'pointer'}}>
        <input type="file" accept=".md,.txt" style={{display:'none'}} onChange={async e=>{const f=e.target.files?.[0]; if(f) await handleUpload(f); (e.target as HTMLInputElement).value='';}} />
        Upload
      </label>
      <button className="btn-sm btn-gray" onClick={() => noteId ? navigate(`/note/${noteId}/preview`) : navigate('/note')}>Back</button>
      <button className="btn-sm btn-transparent bg-transparent hover:border-transparent disable">Logout</button>
    </>
  );

  return (
    <div className="notes-theme">
      <NotesHeader rightActions={right} />
      <div className="notes-root">
        <div className="notes-grid" style={{gridTemplateColumns:'1fr'}}>
          <div className="notes-modal-body" style={{display:'grid', gap:'.75rem', gridTemplateColumns:'1fr', background:'transparent', border:'0', padding:0}}>
            <div className="notes-group">
              <label className="notes-label">Title</label>
              <input className="notes-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Note title" />
            </div>
            <div className="notes-group">
              <label className="notes-label">Content</label>
              <textarea
                ref={textareaRef}
                className="notes-textarea"
                value={content}
                onChange={e=>{ setContent(e.target.value); /* autosize in next effect */ }}
                placeholder="Write your note..."
              />
            </div>
            {/* <div className="notes-preview markdown" aria-label="Markdown preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || ''}
              </ReactMarkdown>
            </div> */}
          </div>
        </div>
      </div>
      <AESKeyModal isOpen={showKeyModal} onSubmit={async (k)=>{ await EncryptionService.setupEncryptionKey(k); setShowKeyModal(false); }} onCancel={()=>setShowKeyModal(false)} message={keyModalMessage} />
    </div>
  );
};

export default NoteEditorPage;
