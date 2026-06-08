import { useRef, useState } from 'react';
import type { ReactNode, DragEvent, ChangeEvent } from 'react';

/**
 * Shared file drop zone (ported from the Control Room). Handles the drag-drop
 * traps that otherwise reload the page: preventDefault + stopPropagation on
 * every handler, no <label> around the input (opened via ref + .click()), and
 * the input value is cleared after a pick so the same file can be re-picked.
 * Visuals are entirely the caller's via the `render` prop.
 */
export interface FileDropzoneProps {
  accept: string;
  maxSizeMb?: number;
  allowedExtensions?: string[];
  onFileSelected: (file: File) => void;
  onValidationError?: (errorTitle: string, errorMessage: string) => void;
  render: (state: { isDragging: boolean }) => ReactNode;
  className?: string;
  disabled?: boolean;
}

export default function FileDropzone({
  accept,
  maxSizeMb,
  allowedExtensions,
  onFileSelected,
  onValidationError,
  render,
  className = '',
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validate = (file: File): string | null => {
    if (allowedExtensions && allowedExtensions.length > 0) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!allowedExtensions.includes(ext)) {
        return `Allowed types: ${allowedExtensions.map((e) => '.' + e).join(', ')}`;
      }
    }
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      return `File must be under ${maxSizeMb}MB`;
    }
    return null;
  };

  const take = (file: File) => {
    const err = validate(file);
    if (err) { onValidationError?.('File rejected', err); return; }
    onFileSelected(file);
  };

  const handleClick = () => { if (!disabled) inputRef.current?.click(); };
  const stop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragOver = (e: DragEvent) => { stop(e); if (!disabled) setIsDragging(true); };
  const handleDragEnter = (e: DragEvent) => { stop(e); if (!disabled) setIsDragging(true); };
  const handleDragLeave = (e: DragEvent) => { stop(e); setIsDragging(false); };
  const handleDrop = (e: DragEvent) => {
    stop(e); setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) take(file);
  };
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) take(file);
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${className}${isDragging ? ' dragging' : ''}${disabled ? ' fdz-disabled' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      {render({ isDragging })}
      <input ref={inputRef} type="file" accept={accept} onChange={handleInputChange} style={{ display: 'none' }} />
    </div>
  );
}
