import React, { useState } from 'react';
import Icon from '../Icon';

const AnswerConfig = ({ exam, onSave, onClose }) => {
  const [localAns, setLocalAns] = useState(() => { 
    const ans = exam.correctAnswers || {}; 
    return { p1: ans.p1 || {}, p2: ans.p2 || {}, p3: ans.p3 || {} }; 
  });
  const [clearEx, setClearEx] = useState(false);

  const handleClearAll = () => {
    if (window.confirm("BẠN CÓ CHẮC CHẮN? Thao tác này sẽ xoá sạch bộ đáp án chuẩn VÀ file PDF lời giải của đề thi này!")) {
      setLocalAns({ p1: {}, p2: {}, p3: {} });
      setClearEx(true);
    }
  };

  const setP1 = (n, c) => { setLocalAns(prev => { const p1 = {...prev.p1}; p1[n] = c; return { ...prev, p1 }; }); setClearEx(false); };
  const setP2 = (n, s, v) => { setLocalAns(prev => { const p2 = {...prev.p2}; if (!p2[n]) p2[n] = {}; p2[n][s] = v; return { ...prev, p2 }; }); setClearEx(false); };
  const setP3 = (n, v) => { setLocalAns(prev => { const p3 = {...prev.p3}; p3[n] = v; return { ...prev, p3 }; }); setClearEx(false); };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-200">
        <div className="p-8 border-b flex justify-between bg-slate-50">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase leading-none">Cấu hình Đáp án chuẩn</h2>
            <p className="text-slate-500 text-sm mt-2 italic tracking-tight font-medium">Đề: {exam.title}</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleClearAll} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-[10px] uppercase hover:bg-red-100 transition-all flex items-center gap-2 tracking-widest"><Icon name="trash-2" size={14} /> XOÁ ĐÁP ÁN & LỜI GIẢI</button>
            <button onClick={onClose} className="p-3 hover:bg-white rounded-full transition-all">
              <Icon name="x" size={24} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
          {clearEx && (
            <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
              <Icon name="alert-circle" className="text-red-600" size={24} />
              <p className="text-red-700 font-bold text-sm uppercase italic">Cảnh báo: Bạn vừa chọn xoá sạch dữ liệu. Nhấn "LƯU ĐÁP ÁN" để thực hiện.</p>
            </div>
          )}
          <div>
            <h4 className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase mb-6 inline-block tracking-[0.2em] shadow-lg">Phần I</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({length: exam.config.p1}, (_, i) => i + 1).map(num => (
                <div key={num} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="w-8 font-black text-slate-400 text-[10px]">C{num}</span>
                  <div className="flex gap-1">
                    {['A', 'B', 'C', 'D'].map(c => (
                      <button key={c} onClick={() => setP1(num, c)} className={`w-7 h-7 rounded-full text-[10px] font-black border-2 transition-all ${localAns.p1[num] === c ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>{c}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="bg-purple-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase mb-6 inline-block tracking-[0.2em] shadow-lg">Phần II</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({length: exam.config.p2}, (_, i) => i + 1).map(num => (
                <div key={num} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="font-black text-slate-400 text-[10px] mb-3 uppercase tracking-tighter italic">Câu {num}</p>
                  {['a', 'b', 'c', 'd'].map(sub => (
                    <div key={sub} className="flex items-center justify-between mb-2 last:mb-0">
                      <span className="font-bold text-slate-500 text-xs uppercase">{sub})</span>
                      <div className="flex gap-1">
                        <button onClick={() => setP2(num, sub, true)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black border-2 transition-all ${localAns.p2[num] && localAns.p2[num][sub] === true ? 'bg-emerald-50 border-emerald-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}>ĐÚNG</button>
                        <button onClick={() => setP2(num, sub, false)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black border-2 transition-all ${localAns.p2[num] && localAns.p2[num][sub] === false ? 'bg-red-50 border-red-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}>SAI</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase mb-6 inline-block tracking-[0.2em] shadow-lg">Phần III</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({length: exam.config.p3}, (_, i) => i + 1).map(num => (
                <div key={num} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="font-black text-slate-400 text-[10px] w-10 text-center italic">C{num}</span>
                  <input type="text" value={localAns.p3[num] || ''} onChange={(e) => setP3(num, e.target.value)} className="flex-1 bg-white border-2 border-slate-100 rounded-xl p-3 font-bold text-orange-600 outline-none focus:border-orange-500 transition-all shadow-inner" placeholder="Đáp số..." />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-8 border-t bg-slate-50 flex justify-end gap-4">
          <button onClick={onClose} className="px-8 py-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all text-xs uppercase">HUỶ BỎ</button>
          <button onClick={() => onSave(localAns, clearEx)} className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest text-[11px]">LƯU ĐÁP ÁN</button>
        </div>
      </div>
    </div>
  );
};

export default AnswerConfig;
