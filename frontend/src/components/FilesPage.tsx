import React, { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import ConfirmDialog from './ConfirmDialog';

type FileItem = { file_id: string; object_path: string; size: number; is_public: boolean; public_url?: string };

export const FilesPage: React.FC = () => {
  const API_BASE_URL = process.env.REACT_APP_API_URL || '';
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileId, setFileId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const urlInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<FileItem | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<FileItem | null>(null);

  const load = async () => {
    try { setLoading(true); setFiles(await apiService.listFiles()); } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); }, []);

  const makeUniqueId = (base: string): string => {
    const existing = new Set(files.map(f => f.file_id));
    if (!existing.has(base)) return base;
    const rand = () => String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    const withSuffix = (name: string, suffix: string) => {
      const dot = name.lastIndexOf('.');
      if (dot > 0) {
        return `${name.slice(0, dot)}_${suffix}${name.slice(dot)}`;
      }
      return `${name}_${suffix}`;
    };
    let candidate = withSuffix(base, rand());
    while (existing.has(candidate)) {
      candidate = withSuffix(base, rand());
    }
    return candidate;
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    let desiredId = fileId.trim();
    if (!desiredId && f.name) {
      desiredId = makeUniqueId(f.name);
    } else if (desiredId) {
      desiredId = makeUniqueId(desiredId);
    }
    await apiService.uploadFile(f, desiredId || undefined, isPublic);
    setFileId(''); setIsPublic(false); (e.target as any).value = '';
    await load();
  };

  const onUploadUrl = async () => {
    const url = urlInput.current?.value?.trim();
    if (!url) return;
    let desiredId = fileId.trim();
    if (!desiredId) {
      try {
        const u = new URL(url);
        const last = u.pathname.split('/').filter(Boolean).pop();
        if (last) desiredId = makeUniqueId(last);
      } catch {
        // ignore URL parse errors; fall back to undefined
      }
    } else {
      desiredId = makeUniqueId(desiredId);
    }
    await apiService.uploadFromUrl(url, desiredId || undefined, isPublic);
    if (urlInput.current) urlInput.current.value = '';
    setFileId(''); setIsPublic(false);
    await load();
  };

  const onDownload = async (item: FileItem) => {
    const blob = await apiService.downloadFile(item.file_id, item.is_public);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = item.file_id;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onRename = async () => {
    if (!selected || !renameTo.trim()) return;
    await apiService.renameFile(selected.file_id, renameTo.trim(), selected.is_public);
    setSelected(null); setRenameTo('');
    await load();
  };

  const onToggleShare = async (item: FileItem) => {
    await apiService.toggleShare(item.file_id, item.is_public);
    await load();
  };

  const toAbsolutePublicUrl = (url?: string | null) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL || window.location.origin}${url}`;
  };

  const onCopyPublicLink = async (item: FileItem) => {
    if (!item.is_public) return;
    let url = item.public_url;
    if (!url) {
      try {
        const info = await apiService.getFileInfo(item.file_id, true);
        url = info.public_url;
      } catch {
        // ignore
      }
    }
    if (url) {
      const absolute = toAbsolutePublicUrl(url);
      if (!absolute) return;
      try {
        await navigator.clipboard.writeText(absolute);
      } catch {
        const a = document.createElement('textarea');
        a.value = absolute;
        document.body.appendChild(a);
        a.select();
        document.execCommand('copy');
        document.body.removeChild(a);
      }
    }
  };

  const onDelete = async (item: FileItem) => {
    await apiService.deleteFile(item.file_id, item.is_public);
    await load();
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-gray-50 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-gray-900 dark:text-gray-100">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-sm font-medium">Optional File ID</label>
          <input className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" value={fileId} onChange={e=>setFileId(e.target.value)} placeholder="defaults to filename; ensures uniqueness" />
        </div>
        <div className="flex items-center gap-2">
          <input id="pub" type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)} />
          <label htmlFor="pub">Public</label>
        </div>
        <div>
          <label className="block text-sm font-medium">Upload File</label>
          <input type="file" onChange={onUpload} />
        </div>
        <div>
          <label className="block text-sm font-medium">Upload From URL</label>
          <div className="flex gap-2">
            <input ref={urlInput} className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 w-80 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="https://example.com/file" />
            <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={onUploadUrl}>Fetch</button>
          </div>
        </div>
        <button className="ml-auto px-3 py-2 rounded bg-gray-200 dark:bg-gray-700" onClick={load} disabled={loading}>Refresh</button>
      </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0 overflow-hidden text-gray-900 dark:text-gray-100">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-gray-900 dark:text-gray-100">
          <thead>
            <tr className="text-left border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
              <th className="p-3">File ID</th>
              <th className="p-3">Size</th>
              <th className="p-3">Visibility</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map(item => (
              <tr key={item.object_path} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60">
                <td className="p-3 font-mono">{item.file_id}</td>
                <td className="p-3">{item.size}</td>
                <td className="p-3">{item.is_public ? 'Public' : 'Private'}</td>
                <td className="p-3 space-x-2">
                  <button className="px-2 py-1 text-xs rounded bg-blue-600 text-white" onClick={()=>onDownload(item)}>Download</button>
                  <button className="px-2 py-1 text-xs rounded bg-purple-600 text-white" onClick={()=>onToggleShare(item)}>{item.is_public?'Make Private':'Make Public'}</button>
                  <button className="px-2 py-1 text-xs rounded bg-yellow-600 text-white" onClick={()=>{setSelected(item); setRenameTo(item.file_id);}}>Rename</button>
                  <button className="px-2 py-1 text-xs rounded bg-red-600 text-white" onClick={()=>setConfirmDeleteItem(item)}>Delete</button>
                  {item.is_public && (
                    <>
                      <button className="px-2 py-1 text-xs rounded bg-green-600 text-white" onClick={()=>onCopyPublicLink(item)}>Copy Link</button>
                      {item.public_url && (
                        <a
                          className="px-2 py-1 text-xs rounded bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                          href={toAbsolutePublicUrl(item.public_url) || '#'}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {files.length===0 && (
              <tr><td className="p-3 text-gray-500 dark:text-gray-400" colSpan={4}>No files</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {selected && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex items-end gap-2 text-gray-900 dark:text-gray-100">
          <div>
            <label className="block text-sm font-medium">Rename to</label>
            <input className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" value={renameTo} onChange={e=>setRenameTo(e.target.value)} />
          </div>
          <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={onRename}>Commit Rename</button>
          <button className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700" onClick={()=>{setSelected(null); setRenameTo('');}}>Cancel</button>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDeleteItem}
        title="Delete File"
        message={confirmDeleteItem ? (
          <span>Are you sure you want to delete file <span className="font-mono">{confirmDeleteItem.file_id}</span>?</span>
        ) : 'Are you sure you want to delete this file?'}
        confirmLabel="Yes"
        cancelLabel="No"
        onCancel={()=>setConfirmDeleteItem(null)}
        onConfirm={async ()=>{
          if (!confirmDeleteItem) return;
          await onDelete(confirmDeleteItem);
          setConfirmDeleteItem(null);
        }}
      />
      </div>
    </div>
  );
};
