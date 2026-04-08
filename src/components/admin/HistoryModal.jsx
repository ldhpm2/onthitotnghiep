import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import Icon from '../Icon';
import { DetailView, calculateAttemptScore } from './DetailView';

const formatDateTime = (ts) => {
  if (!ts) return '---'; 
  const d = new Date(parseInt(ts)); 
  if (isNaN(d.getTime())) return '---';
  return d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit', second:'2-digit'}) + ' ' + d.toLocaleDateString('vi-VN');
};

const formatDuration = (start, end) => {
  if (!start || !end) return '---';
  const diff = Math.max(0, parseInt(end) - parseInt(start));
  const s = Math.floor(diff / 1000); 
  const m = Math.floor(s / 60); 
  const sec = s % 60;
  return `${m} phút ${sec} giây`;
};

const HistoryModal = ({ exam, onClose }) => {
  const [history, setHistory] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [viewing, setViewing] = useState(null); 
  const [tab, setTab] = useState('list');
  const [selectedAttempts, setSelectedAttempts] = useState([]);

  const loadHistory = useCallback(async () => {
    setLoading(true); 
    setSelectedAttempts([]);
    try {
      const r = await axios.get(`/api/history?action=get_history&examId=${exam.id}&t=${Date.now()}`);
      setHistory(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [exam.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleDeleteAttempt = async (attempt) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa kết quả của học sinh ${attempt.name}?`)) return;
    try {
      const r = await axios.delete(`/api/history?action=delete_attempt&examId=${exam.id}&startTime=${attempt.startTime}`);
      if (r.data.success) { 
        loadHistory(); 
      } else { 
        alert("Lỗi khi xóa!"); 
      }
    } catch (e) { 
        alert("Lỗi kết nối!"); 
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAttempts.length === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedAttempts.length} kết quả bài làm đã chọn?`)) return;
    try {
      const payload = { items: selectedAttempts.map(h => ({ examId: h.examId, startTime: h.startTime })) };
      const r = await axios.post('/api/history?action=delete_history_bulk', payload);
      if (r.data.success) { 
        loadHistory(); 
      } else { 
        alert("Lỗi khi xóa!"); 
      }
    } catch (e) { 
        alert("Lỗi kết nối!"); 
    }
  };

  const exportToExcel = () => {
    if (!history || history.length === 0) { alert("Không có dữ liệu để xuất!"); return; }
    let csvContent = "\uFEFFSTT,Họ và tên,Lớp,Trường,Trạng thái,Bắt đầu,Nộp bài,Thời gian làm,Điểm\n";
    history.forEach((h, idx) => {
        const name = `"${(h.name || '').replace(/"/g, '""')}"`; 
        const className = `"${(h.class || '').replace(/"/g, '""')}"`;
        const school = `"${(h.school || '').replace(/"/g, '""')}"`; 
        const status = h.tabSwitches > 0 ? `"Chuyển tab ${h.tabSwitches} lần"` : `"Hợp lệ"`;
        const startTimeStr = `"${formatDateTime(h.startTime)}"`; 
        const endTimeStr = `"${formatDateTime(h.endTime)}"`;
        const durationStr = `"${formatDuration(h.startTime, h.endTime)}"`; 
        const score = `"${h.score || 0}"`;
        csvContent += `${idx + 1},${name},${className},${school},${status},${startTimeStr},${endTimeStr},${durationStr},${score}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); 
    link.href = URL.createObjectURL(blob);
    link.download = `ket_qua_${exam.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    if (!history || history.length === 0) return { p1: {}, p2: {}, p3: {} }; 
    const p1 = {}; const p2 = {}; const p3 = {};
    history.forEach(h => { 
        const sd = calculateAttemptScore(h.userAnswers, exam.correctAnswers, exam.config);
        for (let i=1; i<=exam.config.p1; i++) { if(!p1[i]) p1[i]=0; if(sd.details.p1[i]) p1[i]++; }
        for (let i=1; i<=exam.config.p2; i++) { 
            if(!p2[i]) p2[i]=0; 
            let allC = true; 
            ['a','b','c','d'].forEach(s => { if(!sd.details.p2[i][s]) allC = false; }); 
            if(allC) p2[i]++; 
        }
        for (let i=1; i<=exam.config.p3; i++) { if(!p3[i]) p3[i]=0; if(sd.details.p3[i]) p3[i]++; }
    }); 
    return { p1, p2, p3 };
  }, [history, exam]);

  const toggleSelectAll = () => { 
      if (selectedAttempts.length === history.length) setSelectedAttempts([]); 
      else setSelectedAttempts([...history]); 
  };
  
  const toggleSelect = (h) => { 
      const idx = selectedAttempts.findIndex(s => s.startTime === h.startTime); 
      if (idx >= 0) { 
          const newSel = [...selectedAttempts]; 
          newSel.splice(idx, 1); 
          setSelectedAttempts(newSel); 
      } else { 
          setSelectedAttempts([...selectedAttempts, h]); 
      } 
  };

  if (viewing) return <DetailView attempt={viewing} exam={exam} onBack={() => setViewing(null)} />;
  
  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in">
        <div className="p-8 border-b flex justify-between bg-slate-50">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase leading-none">Kết quả ôn tập</h2>
            <p className="text-slate-500 text-sm mt-2 italic">{exam.title}</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-full transition-all"><Icon name="x" size={24} /></button>
        </div>
        <div className="flex border-b bg-slate-50/50 px-6 justify-between items-center">
          <div className="flex">
            <button onClick={() => setTab('list')} className={`px-8 py-4 font-black text-[10px] uppercase border-b-4 transition-all ${tab === 'list' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Danh sách bài làm</button>
            <button onClick={() => setTab('stats')} className={`px-8 py-4 font-black text-[10px] uppercase border-b-4 transition-all ${tab === 'stats' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-400'}`}>Thống kê chi tiết</button>
          </div>
          <div className="flex items-center gap-3">
            {tab === 'list' && (<button onClick={exportToExcel} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-100 transition-all"><Icon name="download" size={14} /> Xuất Excel</button>)}
            {tab === 'list' && selectedAttempts.length > 0 && (<button onClick={handleBulkDelete} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-red-100 transition-all"><Icon name="trash-2" size={14} /> Xóa {selectedAttempts.length} mục</button>)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {loading ? <p className="py-20 text-center font-bold text-slate-400 italic">Đang tải dữ liệu...</p> : history.length === 0 ? <p className="text-center py-20 italic font-black uppercase text-slate-300">Trống</p> : (
            tab === 'list' ? (
              <table className="w-full text-left border-collapse">
                <thead><tr className="border-b text-[10px] font-black text-slate-400 uppercase"><th className="pb-4 px-2 w-10"><input type="checkbox" className="w-5 h-5 rounded-md" checked={selectedAttempts.length === history.length && history.length > 0} onChange={toggleSelectAll} /></th><th className="pb-4 px-2">Học sinh</th><th className="pb-4 px-2 text-center">Thời gian</th><th className="pb-4 px-2 text-center">Trạng thái</th><th className="pb-4 px-2 text-center">Điểm</th><th className="pb-4 px-2 text-right">Thao tác</th></tr></thead>
                <tbody className="divide-y">{history.map((h, i) => (
                  <tr key={i} className={`transition-colors ${selectedAttempts.find(s => s.startTime === h.startTime) ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                    <td className="py-4 px-2"><input type="checkbox" className="w-5 h-5 rounded-md" checked={!!selectedAttempts.find(s => s.startTime === h.startTime)} onChange={() => toggleSelect(h)} /></td>
                    <td className="py-4 px-2 font-bold text-slate-700 leading-tight uppercase tracking-tighter text-sm">{h.name}<br/><span className="text-[10px] font-medium text-slate-400 italic">{h.class}</span></td>
                    <td className="py-4 px-2 text-[10px] text-slate-500 text-center whitespace-nowrap"><div>BĐ: <span className="font-bold text-slate-700">{formatDateTime(h.startTime)}</span></div><div>Nộp: <span className="font-bold text-slate-700">{formatDateTime(h.endTime)}</span></div><div className="mt-1 font-black text-blue-600">Làm: {formatDuration(h.startTime, h.endTime)}</div></td>
                    <td className="py-4 px-2 text-center">{h.tabSwitches > 0 ? <span className="bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-md text-[10px] font-bold"><Icon name="alert-triangle" size={10} className="inline mr-1 mb-0.5" />Chuyển tab {h.tabSwitches} lần</span> : <span className="text-emerald-500 text-[10px] font-bold">Hợp lệ</span>}</td>
                    <td className="py-4 px-2 text-center font-black text-blue-600 text-xl">{h.score}</td>
                    <td className="py-4 px-2 text-right flex items-center justify-end gap-2"><button onClick={() => setViewing(h)} className="bg-blue-600 text-white px-5 py-2 rounded-2xl font-black text-[9px] uppercase transition-all shadow-lg shadow-blue-100 hover:bg-blue-700">Chi tiết</button><button onClick={() => handleDeleteAttempt(h)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all" title="Xóa"><Icon name="trash-2" size={16} /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            ) : (
              <div className="space-y-12 pb-10">
                <div><h4 className="text-[10px] font-black text-blue-500 uppercase mb-6 tracking-[0.2em] italic">Phần I: Trắc nghiệm (% làm đúng)</h4><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">{Array.from({length: exam.config.p1}, (_, i) => i + 1).map(n => { const pct = Math.round(((stats.p1[n] || 0) / history.length) * 100); return (<div key={n} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm text-center transition-all hover:scale-105"><p className="text-[9px] font-black text-slate-300 mb-1 uppercase">Câu {n}</p><p className={`text-2xl font-black ${pct >= 50 ? 'text-emerald-500' : 'text-orange-500'}`}>{pct}%</p><div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden"><div className="bg-blue-500 h-full transition-all duration-1000" style={{width: pct+'%'}}></div></div></div>);})}</div></div>
                <div><h4 className="text-[10px] font-black text-purple-500 uppercase mb-6 tracking-[0.2em] italic">Phần II: Đúng/Sai (% đúng cả 4 ý)</h4><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">{Array.from({length: exam.config.p2}, (_, i) => i + 1).map(n => { const pct = Math.round(((stats.p2[n] || 0) / history.length) * 100); return (<div key={n} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm text-center transition-all hover:scale-105"><p className="text-[9px] font-black text-slate-300 mb-1">Câu {n}</p><p className="text-2xl font-black text-slate-700">{pct}%</p></div>);})}</div></div>
                <div><h4 className="text-[10px] font-black text-orange-500 uppercase mb-6 tracking-[0.2em] italic">Phần III: Trả lời ngắn (% làm đúng)</h4><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">{Array.from({length: exam.config.p3}, (_, i) => i + 1).map(n => { const pct = Math.round(((stats.p3[n] || 0) / history.length) * 100); return (<div key={n} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm text-center transition-all hover:scale-105"><p className="text-[9px] font-black text-slate-300 mb-1">Câu {n}</p><p className="text-2xl font-black text-slate-700">{pct}%</p></div>);})}</div></div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
