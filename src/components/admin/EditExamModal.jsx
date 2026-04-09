import React, { useState } from 'react';
import axios from 'axios';
import Icon from '../Icon';

const CATEGORIES = {
  'chinh_thuc': 'Đề thi chính thức',
  'thi_thu': 'Đề thi thử chọn lọc',
  'truong_sgd': 'Đề các trường & SGD',
  'khac': 'Chủ đề khác'
};

const EditExamModal = ({ exam, onSave, onClose }) => {
  const [title, setTitle] = useState(exam.title);
  const [category, setCategory] = useState(exam.category || 'khac');
  const [explanationFile, setExplanationFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setExplanationFile(file);
    } else if (file) {
      alert("Vui lòng chọn file PDF!");
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return alert("Tên đề thi không được để trống!");
    setIsSaving(true);
    
    try {
      const payload = {
        id: exam.id,
        title: title.trim(),
        category: category
      };

      if (explanationFile) {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(explanationFile);
        });
        payload.explanationData = await base64Promise;
        payload.explanationFileName = explanationFile.name;
      }

      const r = await axios.post('/api/exams?action=edit', payload);
      if (r.data.success) { 
        onSave(); 
      } else { 
        alert(r.data.error || "Lỗi khi lưu!"); 
      }
    } catch (e) {
      console.error("Edit Exam Error:", e);
      alert(e.response?.data?.error || "Lỗi kết nối Server!");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Sửa Thông Tin Đề Thi</h2></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-500"><Icon name="x" size={20} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Danh mục</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-blue-600 outline-none focus:border-blue-500 transition-all shadow-inner appearance-none cursor-pointer">
              {Object.entries(CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên đề thi</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-inner" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">File Lời giải PDF (Tùy chọn)</label>
            <div className="relative group">
              <input 
                type="file" 
                accept=".pdf" 
                onChange={handleFileChange} 
                className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 font-bold text-slate-500 outline-none focus:border-blue-500 transition-all hover:bg-slate-100 cursor-pointer text-xs" 
              />
              {exam.explanationPath && !explanationFile && (
                <p className="mt-2 text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <Icon name="check-circle" size={12} /> Đã có file lời giải trên hệ thống
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all text-xs uppercase tracking-widest">Huỷ</button>
          <button onClick={handleSave} disabled={isSaving} className={`px-8 py-3 text-white rounded-xl font-black shadow-lg shadow-blue-100 transition-all uppercase tracking-widest text-xs flex items-center gap-2 ${isSaving ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isSaving ? <Icon name="loader" className="animate-spin" size={16} /> : <Icon name="save" size={16} />} Lưu
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditExamModal;
