import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';

interface Document {
  id: string;
  student_id: string;
  student_name: string;
  doc_type: string;
  original_filename: string;
  file_path: string;
  uploaded_at: string;
}

const PrincipalDocuments: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        student_id,
        doc_type,
        original_filename,
        file_path,
        uploaded_at,
        students:student_id (name)
      `)
      .order('uploaded_at', { ascending: false });
    if (!error && data) {
      const formatted = data.map((d: any) => ({
        id: d.id,
        student_id: d.student_id,
        student_name: d.students?.name || 'Unknown',
        doc_type: d.doc_type,
        original_filename: d.original_filename,
        file_path: d.file_path,
        uploaded_at: d.uploaded_at,
      }));
      setDocuments(formatted);
    }
    setLoading(false);
  };

  const handleView = (doc: Document) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(doc.file_path);
    window.open(data.publicUrl, '_blank');
  };

  const handleDownload = (doc: Document) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(doc.file_path);
    const link = document.createElement('a');
    link.href = data.publicUrl;
    link.download = doc.original_filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Delete from storage
      await supabase.storage.from('documents').remove([deleteTarget.file_path]);
      // Delete from DB
      const { error } = await supabase.from('documents').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setToast({ message: 'Document deleted', type: 'success' });
      fetchDocuments();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <h2>All Documents</h2>
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Student</th>
              <th>Type</th>
              <th>Filename</th>
              <th>Uploaded At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map(doc => (
              <tr key={doc.id}>
                <td>{doc.student_name}</td>
                <td>{doc.doc_type}</td>
                <td>{doc.original_filename}</td>
                <td>{new Date(doc.uploaded_at).toLocaleString()}</td>
                <td>
                  <button className="btn btn-sm btn-info me-1" onClick={() => handleView(doc)}>View</button>
                  <button className="btn btn-sm btn-secondary me-1" onClick={() => handleDownload(doc)}>Download</button>
                  <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(doc)}>Delete</button>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr><td colSpan={5} className="text-center">No documents found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        show={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteTarget?.original_filename}"?`}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default PrincipalDocuments;