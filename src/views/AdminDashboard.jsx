import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Icon from '../components/Icon';
import HistoryModal from '../components/admin/HistoryModal';
import AnswerConfig from '../components/admin/AnswerConfig';
import EditExamModal from '../components/admin/EditExamModal';

const CATEGORIES = {
  'chinh_thuc': 'Đề thi chính thức',
  'thi_thu': 'Đề thi thử chọn lọc',
  'truong_sgd': 'Đề các trường & SGD',
  'khac': 'Chủ đề khác'
};

const AdminDashboard = () => {
  const [exams, setExams] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [config, setConfig] = useState({ p1: 12, p2: 4, p3: 6 });
  const [uploadCategory, setUploadCategory] = useState('chinh_thuc');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [editingAnsId, setEditingAnsId] = useState(null); 
  const [showHistoryExam, setShowHistoryExam] = useState(null);
  const [editingExam, setEditingExam] = useState(null);
  const [selectedExams, setSelectedExams] = useState([]);
  
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const r = await axios.get('/api/exams?action=list');
      setExams(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error(e);
      if (e.response?.status === 401) {
        setIsLoggedIn(false);
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const r = await axios.get('/api/auth?action=auth_check');
        if (r.data.loggedIn) {
          setIsLoggedIn(true);
          loadData();
        } else {
          navigate('/login');
        }
      } catch (e) {
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate, loadData]);

  const handleLogout = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn đăng xuất?")) return;
    try {
      await axios.get('/api/auth?action=logout');
      setIsLoggedIn(false);
      navigate('/login');
    } catch (e) {}
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        const payload = {
          fileData: base64,
          fileName: file.name,
          title: file.name.replace(/\.(pdf|docx)$/i, ''),
          config: JSON.stringify(config),
          category: uploadCategory,
          type: file.name.endsWith('.pdf') ? 'pdf' : 'docx'
        };
        
        try {
          const r = await axios.post('/api/exams?action=upload', payload);
          if (r.data.success) {
            loadData();
            alert("Thành công!");
          } else {
            alert(r.data.error || "Lỗi tải lên!");
          }
        } catch (err) {
          const serverError = err.response?.data?.error;
          if (serverError) {
             alert(`Lỗi từ hệ thống: ${serverError}`);
          } else if (file.size > 4 * 1024 * 1024) {
             alert("Lỗi: File quá lớn! Vercel giới hạn file tải lên dưới 4.5MB. Vui lòng nén file PDF lại.");
          } else {
             alert("Lỗi Server! Có thể bạn chưa cấu hình Database trên Vercel Dashboard.");
          }
        } finally {
          setIsUploading(false);
          e.target.value = "";
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("Lỗi đọc file!");
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xoá đề?')) return;
    try {
      await axios.delete(`/api/exams?action=delete&id=${id}`);
      loadData();
    } catch (e) {
      alert("Lỗi!");
    }
  };

  const toggleVisibility = async (id) => {
    try {
      await axios.get(`/api/exams?action=toggle_visibility&id=${id}`);
      loadData();
    } catch (e) {
      alert("Lỗi!");
    }
  };

  const handleBulkDeleteExams = async () => {
    if (selectedExams.length === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedExams.length} đề thi đã chọn cùng với dữ liệu đi kèm không?`)) return;
    try {
      const r = await axios.post('/api/exams?action=delete_exams_bulk', { ids: selectedExams });
      if (r.data.success) { loadData(); } else { alert("Có lỗi xảy ra khi xóa!"); }
    } catch (e) { alert("Lỗi kết nối Server!"); }
  };

  const toggleSelectAllExams = () => { 
    if (selectedExams.length === exams.length) setSelectedExams([]); 
    else setSelectedExams(exams.map(e => e.id)); 
  };
  
  const toggleSelectExam = (id) => { 
    if (selectedExams.includes(id)) setSelectedExams(selectedExams.filter(item => item !== id)); 
    else setSelectedExams([...selectedExams, id]); 
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Đang kiểm tra bảo mật...</div>;

  return (
    <div className="relative h-screen bg-slate-50 flex flex-col animate-in fade-in duration-700">
      <header className="p-8 flex justify-between items-center border-b bg-white shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Hệ thống Quản trị</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
              <span>Modern Vite</span> • <a href="/" className="text-blue-500 underline flex items-center gap-1" target="_blank"><Icon name="external-link" size={10}/> Mở trang Học sinh</a>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-3xl border border-slate-200">
            <div className="flex gap-4 border-r border-slate-200 pr-4">
              <div className="text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">P.I</span>
                <input type="number" value={config.p1} onChange={e => setConfig({...config, p1: parseInt(e.target.value)||0})} className="w-8 font-black text-blue-600 outline-none bg-transparent" />
              </div>
              <div className="text-center border-l border-slate-200 pl-4">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">P.II</span>
                <input type="number" value={config.p2} onChange={e => setConfig({...config, p2: parseInt(e.target.value)||0})} className="w-8 font-black text-purple-600 outline-none bg-transparent" />
              </div>
              <div className="text-center border-l border-slate-200 pl-4">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">P.III</span>
                <input type="number" value={config.p3} onChange={e => setConfig({...config, p3: parseInt(e.target.value)||0})} className="w-8 font-black text-orange-600 outline-none bg-transparent" />
              </div>
            </div>
            <div className="border-r border-slate-200 pr-4">
              <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-blue-500 cursor-pointer">
                {Object.entries(CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <label className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest cursor-pointer transition-all flex items-center gap-2 ${isUploading ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'}`}>
              <Icon name={isUploading ? "loader" : "upload-cloud"} className={isUploading ? "animate-spin" : ""} size={18} /> {isUploading ? "..." : "TẢI ĐỀ MỚI"}
              <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} disabled={isUploading} />
            </label>
          </div>
          <button onClick={handleLogout} className="flex items-center justify-center w-12 h-12 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Icon name="log-out" size={20} /></button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto pb-20">
          <div className="flex justify-between items-center mb-6">
             {exams.length > 0 && (
                <div className="ml-4 flex items-center gap-3">
                  <input type="checkbox" className="w-5 h-5 rounded-md" checked={selectedExams.length === exams.length && exams.length > 0} onChange={toggleSelectAllExams} /> 
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chọn tất cả</span>
                </div>
             )}
             {selectedExams.length > 0 && (
                <button onClick={handleBulkDeleteExams} className="px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-2">
                  <Icon name="trash-2" size={14} /> XÓA {selectedExams.length} MỤC ĐÃ CHỌN
                </button>
             )}
          </div>
          <div className="grid gap-6">
            {exams.map(e => (
              <div key={e.id} className={`bg-white p-6 rounded-[2.5rem] border flex flex-col md:flex-row items-start md:items-center justify-between gap-5 group hover:shadow-lg transition-all ${e.visible !== false ? 'border-slate-100' : 'border-dashed border-slate-300 opacity-60'} ${selectedExams.includes(e.id) ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}`}>
                <div className="flex items-center gap-5 flex-1 min-w-0">
                  <input type="checkbox" className="w-5 h-5 rounded-md shrink-0 ml-2" checked={selectedExams.includes(e.id)} onChange={() => toggleSelectExam(e.id)} />
                  <div className={`w-14 h-14 shrink-0 rounded-[1.5rem] flex items-center justify-center shadow-inner ${e.type==='pdf'?'bg-red-50 text-red-500':'bg-blue-50 text-blue-500'}`}><Icon name={e.type==='pdf'?'file-text':'file'} size={28} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-slate-800 text-base leading-snug break-words">{e.title}</h3>
                      {e.visible === false && <span className="text-red-500 text-[9px] font-black tracking-widest whitespace-nowrap bg-red-50 px-2 py-0.5 rounded-md">ẨN</span>}
                      <span className="text-purple-600 text-[9px] font-black tracking-widest whitespace-nowrap bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md uppercase">
                        {CATEGORIES[e.category || 'khac']}
                      </span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{e.type} • {e.config.p1}I + {e.config.p2}II + {e.config.p3}III • {e.createdAt}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-black shrink-0 w-full md:w-auto">
                  <button onClick={() => setShowHistoryExam(e)} className="flex-1 md:flex-none bg-blue-50 text-blue-600 px-5 py-3 rounded-2xl hover:bg-blue-100 transition-all uppercase tracking-widest shadow-sm text-center">Kết quả</button>
                  <button onClick={() => setEditingExam(e)} className="p-3 bg-orange-50 text-orange-500 rounded-2xl hover:bg-orange-100 transition-all flex-shrink-0"><Icon name="edit-3" size={20} /></button>
                  <button onClick={() => toggleVisibility(e.id)} className={`p-3 rounded-2xl transition-all flex-shrink-0 ${e.visible !== false ? 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-50'}`}><Icon name={e.visible !== false ? "eye" : "eye-off"} size={20} /></button>
                  <button onClick={() => setEditingAnsId(e.id)} className="bg-slate-100 text-slate-600 px-5 py-3 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest flex-shrink-0"><Icon name="key" size={16} /></button>
                  <button onClick={() => handleDelete(e.id)} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all flex-shrink-0"><Icon name="trash-2" size={20}/></button>
                </div>
              </div>
            ))}
          </div>
          {exams.length === 0 && <div className="text-center py-20 text-slate-400 italic">Chưa có đề thi nào.</div>}
        </div>
      </div>

      {editingAnsId && <AnswerConfig exam={exams.find(e => String(e.id) === String(editingAnsId))} onSave={async (ans) => {
        try {
          const r = await axios.post('/api/exams?action=saveAnswers', { examId: editingAnsId, answers: ans });
          if (r.data.success) { 
            loadData(); 
            setEditingAnsId(null); 
            alert("Đã lưu đáp án và chấm lại cho " + r.data.updatedCount + " bài thi!"); 
          }
        } catch (e) { alert("Lỗi!"); }
      }} onClose={() => setEditingAnsId(null)} />}
      
      {showHistoryExam && <HistoryModal exam={showHistoryExam} onClose={() => setShowHistoryExam(null)} />}
      
      {editingExam && <EditExamModal exam={editingExam} onSave={() => { loadData(); setEditingExam(null); }} onClose={() => setEditingExam(null)} />}

    </div>
  );
};

export default AdminDashboard;
