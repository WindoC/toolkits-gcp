import React, { useEffect, useState } from 'react';
import './notes.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import EncryptionService from '../services/encryptionService';
import { AESKeyModal } from './AESKeyModal';
import ConfirmDialog from './ConfirmDialog';
import NotesHeader from './NotesHeader';

type Note = { note_id: string; title: string; content?: string; created_at?: string; updated_at?: string };

const NotePreviewPage: React.FC = () => {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyModalMessage, setKeyModalMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Preview page only; editing lives at /note/:id

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

  useEffect(() => {
    const load = async () => {
      if (!noteId) return;
      try {
        setLoading(true);
        const hasKey = await ensureKey(); if (!hasKey) return;
        const full = await apiService.getNote(noteId);
        setNote(full);
        // data hydrated in note
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [noteId]);

  const onDelete = async () => {
    if (!noteId) return;
    await apiService.deleteNote(noteId);
    navigate('/note');
  };

  const onEdit = async () => {
    if (!noteId) return;
    const ok = await ensureKey(); if (!ok) return;
    navigate(`/note/${noteId}`);
  };

  const onDownload = () => {
    if (!note) return;
    const blob = new Blob([note.content || ''], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(note.title || 'note').replace(/[^a-z0-9_-]+/gi,'_')}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="notes-theme">
      <NotesHeader rightActions={
        <>
          <button className="btn-sm btn-blue" onClick={onEdit}>Edit</button>
          <button className="btn-sm btn-gray" onClick={onDownload}>Download</button>
          <button className="btn-sm btn-gray" onClick={()=>navigate('/note')}>Back</button>
          <button className="btn-sm btn-red" onClick={()=>setShowDeleteConfirm(true)}>Delete</button>
        </>
      }/>
      <div className="notes-root" style={{paddingTop: '1rem'}}>
        <div className="notes-grid" style={{gridTemplateColumns:'1fr'}}>
          <div className="note-card">
            <div className="note-title" style={{fontSize:'1.4rem'}}>{note?.title || (loading ? 'Loading...' : 'Untitled')}</div>
            <div className="note-updated">Updated: {note?.updated_at ? new Date(note.updated_at).toLocaleString() : ''}</div>
            <div className="markdown" style={{marginTop: '.5rem'}}>
              {note && (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {note.content || ''}
                </ReactMarkdown>
              )}
            </div>
            <div className="note-buttons"></div>
          </div>
        </div>
      </div>

      {/* Edit handled by /note/:id */}

      <AESKeyModal isOpen={showKeyModal} onSubmit={async (k)=>{ await EncryptionService.setupEncryptionKey(k); setShowKeyModal(false); }} onCancel={()=>setShowKeyModal(false)} message={keyModalMessage} />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Note"
        message="Are you sure you want to delete this note?"
        confirmLabel="Yes"
        cancelLabel="No"
        onCancel={()=>setShowDeleteConfirm(false)}
        onConfirm={async ()=>{ await onDelete(); setShowDeleteConfirm(false); }}
      />
    </div>
  );
};

export default NotePreviewPage;
