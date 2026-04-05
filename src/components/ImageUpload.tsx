import React, { useState } from 'react';

interface ImageUploadProps {
  onUpload: (file: File) => Promise<string>; // returns the new public URL
  existingUrl?: string;
  onDelete?: () => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onUpload, existingUrl, onDelete }) => {
  const [preview, setPreview] = useState<string | null>(existingUrl || null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    setUploading(true);
    try {
      const url = await onUpload(file);
      setPreview(url);
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete();
      setPreview(null);
    }
  };

  return (
    <div>
      {preview && (
        <div className="mb-2">
          <img src={preview} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover' }} />
          {onDelete && (
            <button type="button" className="btn btn-sm btn-danger mt-1" onClick={handleDelete}>
              Remove
            </button>
          )}
        </div>
      )}
      <input
        type="file"
        className="form-control"
        accept="image/jpeg,image/jpg,image/png"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && <div className="mt-2">Uploading...</div>}
    </div>
  );
};

export default ImageUpload;