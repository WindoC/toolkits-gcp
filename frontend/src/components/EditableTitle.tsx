import React, { useState, useRef, useEffect } from 'react';

interface EditableTitleProps {
  title: string | null;
  onSave: (newTitle: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const EditableTitle: React.FC<EditableTitleProps> = ({
  title,
  onSave,
  placeholder = "Untitled Conversation",
  className = "",
  disabled = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const displayTitle = title || placeholder;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (disabled) return;
    setEditValue(title || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== title) {
      onSave(trimmedValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue('');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`bg-transparent border-b border-primary-500 focus:outline-none ${className}`}
        maxLength={100}
      />
    );
  }

  return (
    <button
      onClick={handleStartEdit}
      disabled={disabled}
      className={`text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors ${
        disabled ? 'cursor-default' : 'cursor-pointer'
      } ${className}`}
      title={disabled ? displayTitle : "Click to edit title"}
    >
      {displayTitle}
    </button>
  );
};