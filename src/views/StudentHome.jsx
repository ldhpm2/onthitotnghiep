import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Icon from '../components/Icon';

const CATEGORIES = {
  'all': 'Tất cả đề',
  'chinh_thuc': 'Đề thi chính thức',
  'thi_thu': 'Đề thi thử chọn lọc',
  'truong_sgd': 'Đề các trường & SGD',
  'khac': 'Chủ đề khác'
};

const StudentHome = () => {
  const [view, setView] = useState('landing');
  const [exams, setExams] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const loadExams = async () => {
      try {
        const response = await axios.get('/api/exams?action=list');
        setExams(Array.isArray(response.data) ? response.data : []);
      } catch (e) {
        console.error("Error fetching exams:", e);
      }
    };
    loadExams();
  }, []);

  const filteredExams = useMemo(() => {
    return exams.filter(e => {
      if (activeCategory === 'all') return true;
      const cat = e.category || 'khac';
      return cat === activeCategory;
    });
  }, [exams, activeCategory]);

  if (view === 'student_list') return (
    <div className="max-w-4xl mx-auto p-12 text-center h-screen overflow-y-auto custom-scrollbar">
      <button onClick={() => setView('landing')} className="text-blue-600 font-bold text-[10px] uppercase tracking-[0.4em] mb-12 mx-auto flex items-center gap-2 hover:bg-white px-6 py-2.5 rounded-xl transition-all shadow-sm">
        <Icon name="arrow-left" /> Quay lại trang chủ
      </button>
      <h1 className="text-[24px] font-black text-slate-800 mb-10 tracking-tighter uppercase italic decoration-blue-500 underline decoration-[4px] underline-offset-4 leading-none text-center">DANH SÁCH ĐỀ THI</h1>
      
      <div className="flex overflow-x-auto hide-scroll gap-3 mb-8 pb-2 shrink-0 px-2 justify-start md:justify-center">
        {Object.keys(CATEGORIES).map((key) => (
          <button 
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-xs transition-all border ${activeCategory === key ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            {CATEGORIES[key]}
          </button>
        ))}
      </div>

      {filteredExams.length === 0 ? (
        <div className="py-20 text-slate-400 italic font-bold">Chưa có đề thi nào trong mục này.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 text-left">
          {filteredExams.map(e => (
            <button 
              key={e.id} 
              onClick={() => navigate(`/quiz/${e.id}`)} 
              className="bg-white p-5 rounded-2xl border border-transparent hover:border-blue-500 shadow-sm hover:shadow-md transition-all group flex items-center gap-5 w-full"
            >
              <div className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all bg-rose-50 text-rose-600">
                <Icon name="file-text" size={24} />
              </div>
              <div className="flex-1 overflow-hidden text-left">
                <h3 className="text-[16px] font-bold text-slate-800 mb-2 leading-tight truncate block w-full">{e.title}</h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">{e.duration} PHÚT</span>
                  <span className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{e.config.p1 + e.config.p2 + e.config.p3} CÂU</span>
                  <span className="text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-md">{CATEGORIES[e.category || 'khac']}</span>
                </div>
              </div>
              <Icon name="chevron-right" size={18} className="text-slate-200 group-hover:text-blue-500 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-blue-50 text-center font-sans relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-100 opacity-50 blur-3xl mix-blend-multiply"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-100 opacity-50 blur-3xl mix-blend-multiply"></div>
      
      <div className="bg-white/80 backdrop-blur-xl p-12 sm:p-16 rounded-[2rem] shadow-2xl border border-white max-w-2xl w-full text-center relative z-10">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
        <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-200/50 rotate-3 transition-transform hover:rotate-0 text-center hover:scale-105 duration-300">
          <Icon name="graduation-cap" size={40} />
        </div>
        <h1 className="text-[28px] sm:text-[36px] font-black text-slate-800 mb-6 tracking-tight">
          HỆ THỐNG ÔN TẬP
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mt-2">TOÁN 12</span>
        </h1>
        <p className="text-slate-500 mb-12 text-[16px] font-medium leading-relaxed max-w-md mx-auto">
          Nền tảng ôn luyện trắc nghiệm hiện đại bám sát cấu trúc đề thi mới nhất của Bộ Giáo dục & Đào tạo.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <button onClick={() => setView('student_list')} className="group flex items-center justify-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-[15px] shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-1 transition-all w-full sm:w-auto">
            BẮT ĐẦU NGAY 
            <Icon name="arrow-right" size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
      <div className="fixed bottom-6 left-0 w-full text-center z-10">
        <p className="text-slate-400/80 font-bold uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-4">
          <span>Hệ thống Ôn tập Toán 12 - Thầy Hùng</span>
          <span className="opacity-20">|</span>
          <a href="/admin" className="hover:text-blue-500 transition-colors flex items-center gap-1">
            <Icon name="lock" size={10} /> QUẢN TRỊ
          </a>
        </p>
      </div>
    </div>
  );
};

export default StudentHome;
