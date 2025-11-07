import React, { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';

type FileItem = { file_id: string; object_path: string; size: number; is_public: boolean };

export const FilesPage: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileId, setFileId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const urlInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<FileItem | null>(null);
  const [renameTo, setRenameTo] = useState('');

  const load = async () => {
    try { setLoading(true); setFiles(await apiService.listFiles()); } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); }, []);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await apiService.uploadFile(f, fileId || undefined, isPublic);
    setFileId(''); setIsPublic(false); (e.target as any).value = '';
    await load();
  };

  const onUploadUrl = async () => {
    const url = urlInput.current?.value?.trim();
    if (!url) return;
    await apiService.uploadFromUrl(url, fileId || undefined, isPublic);
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
          <input className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" value={fileId} onChange={e=>setFileId(e.target.value)} placeholder="auto-generate if blank" />
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
                  <button className="px-2 py-1 text-xs rounded bg-red-600 text-white" onClick={()=>onDelete(item)}>Delete</button>
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
      </div>
    </div>
  );
};
