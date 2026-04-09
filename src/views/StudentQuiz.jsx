import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Icon from '../components/Icon';
import Timer from '../components/Timer';
import ExamDisplay from '../components/ExamDisplay';

const calculateAttemptScore = (userAns, correctAns, config) => {
  const details = { p1: {}, p2: {}, p3: {} };
  const uAns = userAns || { p1: {}, p2: {}, p3: {} };
  const cAns = correctAns || { p1: {}, p2: {}, p3: {} };
  const conf = config || { p1: 0, p2: 0, p3: 0 };
  
  let p1c = 0;
  for (let i = 1; i <= conf.p1; i++) {
    const isCorrect = uAns.p1 && uAns.p1[i] && cAns.p1 && uAns.p1[i] === cAns.p1[i];
    if (isCorrect) p1c++;
    details.p1[i] = isCorrect;
  }
  
  let p2p = 0;
  for (let i = 1; i <= conf.p2; i++) {
    let subCorrectCount = 0;
    const uSub = (uAns.p2 && uAns.p2[i]) ? uAns.p2[i] : {};
    const cSub = (cAns.p2 && cAns.p2[i]) ? cAns.p2[i] : {};
    const subDetails = {};
    ['a', 'b', 'c', 'd'].forEach(s => {
      const isC = uSub[s] !== undefined && cSub[s] !== undefined && uSub[s] === cSub[s];
      if (isC) subCorrectCount++;
      subDetails[s] = isC;
    });
    if (subCorrectCount === 1) p2p += 0.1;
    else if (subCorrectCount === 2) p2p += 0.25;
    else if (subCorrectCount === 3) p2p += 0.5;
    else if (subCorrectCount === 4) p2p += 1.0;
    details.p2[i] = subDetails;
  }
  
  let p3c = 0;
  for (let i = 1; i <= conf.p3; i++) {
    const uA = (uAns.p3 && uAns.p3[i] ? uAns.p3[i] : '').toString().trim().replace(',', '.').toLowerCase();
    const cA = (cAns.p3 && cAns.p3[i] ? cAns.p3[i] : '').toString().trim().replace(',', '.').toLowerCase();
    const isCorrect = uA !== '' && cA !== '' && parseFloat(uA) === parseFloat(cA);
    if (isCorrect) p3c++;
    details.p3[i] = isCorrect;
  }
  
  const total = ((p1c * 0.25) + p2p + (p3c * 0.5)).toFixed(2);
  return { total, p1c, p2p: p2p.toFixed(2), p3c, details };
};

const getFeedback = (score) => {
  const s = parseFloat(score);
  if (s >= 9.0) return { text: "Kết quả xuất sắc! Bạn đã nắm vững kiến thức.", color: "text-emerald-600", bg: "bg-emerald-50", icon: "award" };
  if (s >= 8.0) return { text: "Kết quả rất tốt! Hãy tiếp tục phát huy.", color: "text-blue-600", bg: "bg-blue-50", icon: "thumbs-up" };
  if (s >= 5.0) return { text: "Kết quả trung bình. Cần nỗ lực hơn nữa.", color: "text-amber-600", bg: "bg-amber-50", icon: "trending-up" };
  return { text: "Cần nỗ lực thêm để cải thiện kết quả!", color: "text-rose-600", bg: "bg-rose-50", icon: "edit-3" };
};

const StudentQuiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [view, setView] = useState('form'); // form, quiz, result
  const [studentInfo, setStudentInfo] = useState({ name: '', class: '', school: '' });
  const [userAnswers, setUserAnswers] = useState({ p1: {}, p2: {}, p3: {} });
  const [startTime, setStartTime] = useState(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExplanation, setShowExplanation] = useState(false);
  const [mobileActiveView, setMobileActiveView] = useState('quiz_sheet'); // 'exam_pdf' or 'quiz_sheet'

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const res = await axios.get(`/api/exams?action=list`);
        const found = res.data.find(e => String(e.id) === String(id));
        if (found) setExam(found);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    fetchExam();
  }, [id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && view === 'quiz') {
        setTabSwitchCount(prev => prev + 1);
        alert("⚠️ CẢNH BÁO: Bạn vừa chuyển tab hoặc rời khỏi cửa sổ làm bài. Hệ thống đã ghi nhận hành vi này!");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [view]);

  const stats = useMemo(() => {
    if (!exam) return { done: 0, total: 0 };
    const p1Done = Object.keys(userAnswers.p1).length;
    const p2Done = Object.keys(userAnswers.p2).length;
    const p3Done = Object.keys(userAnswers.p3).filter(k => userAnswers.p3[k].trim() !== '').length;
    const total = (exam.config.p1 || 0) + (exam.config.p2 || 0) + (exam.config.p3 || 0);
    return { done: p1Done + p2Done + p3Done, total };
  }, [userAnswers, exam]);

  const resultsData = useMemo(() => {
    if (!exam) return { total: "0.00" };
    return calculateAttemptScore(userAnswers, exam.correctAnswers, exam.config);
  }, [exam, userAnswers]);

  const handleSubmit = async () => {
    const finishTime = Date.now();
    const payload = {
      examId: exam.id,
      name: studentInfo.name,
      class: studentInfo.class,
      school: studentInfo.school,
      score: resultsData.total,
      userAnswers: userAnswers,
      startTime: startTime,
      endTime: finishTime,
      tabSwitches: tabSwitchCount
    };
    try {
      await axios.post('/api/history?action=submit_attempt', payload);
    } catch (e) {}
    setShowSubmitModal(false);
    setView('result');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;
  if (!exam) return <div className="min-h-screen flex items-center justify-center">Không tìm thấy đề thi.</div>;

  if (view === 'form') return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-center">
      <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl p-10 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
        <button onClick={() => navigate('/')} className="text-slate-400 mb-8 flex items-center gap-2 font-bold text-[10px] uppercase hover:text-slate-600 mx-auto transition-colors"><Icon name="chevron-left" /> Quay lại</button>
        <h2 className="text-[18px] font-black text-slate-800 uppercase mb-8 tracking-tight italic">Thông tin thí sinh</h2>
        <div className="space-y-4">
          <input type="text" placeholder="Họ và tên thí sinh" value={studentInfo.name} onChange={e => setStudentInfo({...studentInfo, name: e.target.value})} className="w-full p-3.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-[14px] text-center shadow-inner" />
          <div className="grid grid-cols-2 gap-4">
            <input type="text" placeholder="Lớp" value={studentInfo.class} onChange={e => setStudentInfo({...studentInfo, class: e.target.value})} className="w-full p-3.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-[14px] text-center shadow-inner" />
            <input type="text" placeholder="Trường" value={studentInfo.school} onChange={e => setStudentInfo({...studentInfo, school: e.target.value})} className="w-full p-3.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-[14px] text-center shadow-inner" />
          </div>
        </div>
        <button 
          onClick={() => { if(studentInfo.name) { setStartTime(Date.now()); setTabSwitchCount(0); setView('quiz'); } }} 
          disabled={!studentInfo.name} 
          className={`w-full mt-10 py-4 rounded-xl font-bold text-[16px] shadow-lg transition-all ${studentInfo.name ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400'}`}
        >BẮT ĐẦU</button>
      </div>
    </div>
  );

  if (view === 'quiz') return (
    <div className="h-[100dvh] flex flex-col bg-slate-100 overflow-hidden text-left safe-p-bottom">
      <header className="bg-white border-b border-slate-200 p-2 flex justify-between items-center z-20 shadow-sm shrink-0 px-4 md:px-6 safe-p-top">
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={() => { if(window.confirm("Kết quả bài làm sẽ không được lưu. Bạn chắc chứ?")) navigate('/') }} className="p-1 md:p-2 text-slate-400 hover:text-slate-600 transition-all"><Icon name="arrow-left" size={18} /></button>
          <div className="max-w-[120px] sm:max-w-md text-left">
            <h2 className="font-bold text-slate-800 text-[12px] md:text-[14px] uppercase truncate leading-none">{exam.title}</h2>
            <div className="flex items-center gap-2 md:gap-3 mt-1 md:mt-1.5">
              <p className="hidden sm:block text-[10px] text-slate-400 font-semibold uppercase tracking-widest truncate">{studentInfo.name}</p>
              <span className="text-[9px] md:text-[10px] px-1.5 md:px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold whitespace-nowrap">Đã làm: {stats.done}/{stats.total}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Timer initialMinutes={exam.duration} onTimeUp={() => setView('result')} />
          <button onClick={() => setShowSubmitModal(true)} className="bg-emerald-600 text-white px-3 md:px-6 py-2 rounded-lg md:rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition-all uppercase tracking-widest text-[9px] md:text-[10px]">Nộp bài</button>
        </div>
      </header>

      {/* Mobile view toggle */}
      <div className="md:hidden flex bg-white border-b-2 border-slate-200 shrink-0">
        <button 
          onClick={() => setMobileActiveView('exam_pdf')}
          className={`flex-1 py-3.5 text-[13px] font-black uppercase tracking-wider transition-all border-b-4 flex items-center justify-center gap-2
            ${mobileActiveView === 'exam_pdf' 
              ? 'border-blue-600 text-blue-600 bg-blue-50' 
              : 'border-transparent text-slate-400 bg-white'}`}
        >
          📄 Xem đề bài
        </button>
        <button 
          onClick={() => setMobileActiveView('quiz_sheet')}
          className={`flex-1 py-3.5 text-[13px] font-black uppercase tracking-wider transition-all border-b-4 flex items-center justify-center gap-2
            ${mobileActiveView === 'quiz_sheet' 
              ? 'border-blue-600 text-blue-600 bg-blue-50' 
              : 'border-transparent text-slate-400 bg-white'}`}
        >
          ✏️ Phiếu trả lời
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 bg-slate-800 overflow-hidden ${mobileActiveView !== 'exam_pdf' ? 'hidden md:block' : 'block'}`}>
          <ExamDisplay type={exam.type} path={exam.filePath} />
        </div>

        <div className={`w-full md:w-[280px] shrink-0 overflow-y-auto bg-[#fffbfb] custom-scrollbar shadow-inner border-l border-slate-200 flex flex-col p-4 md:p-5 ${mobileActiveView !== 'quiz_sheet' ? 'hidden md:flex' : 'flex'}`}>
          <div className="space-y-6">
            <div className="text-center border-b-2 border-red-600 pb-3 mb-4">
              <h2 className="text-[12px] font-black text-red-700 uppercase tracking-widest italic leading-none text-center">PHIẾU TRẢ LỜI</h2>
            </div>

            {exam.config.p1 > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3 text-left">
                  <div className="w-2.5 h-2.5 bg-black text-left"></div>
                  <h3 className="font-black text-red-700 text-[10px] uppercase italic text-left">Phần I (Trắc nghiệm)</h3>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {Array.from({length: exam.config.p1}, (_, i) => i + 1).map(n => (
                    <div key={n} className="flex items-center gap-2 py-1.5 border-b border-red-100">
                      <span className="w-5 text-[12px] font-bold text-slate-400 leading-none">{n}</span>
                      <div className="flex-1 flex justify-around">
                        {['A','B','C','D'].map(c => (
                          <button 
                            key={c} 
                            onClick={()=>setUserAnswers(p=>({...p, p1:{...p.p1,[n]:c}}))}
                            className={`bubble-btn transition-all
                              ${userAnswers.p1[n]===c ? 'bubble-selected' : 'bg-white text-red-600 border-red-100 hover:bg-red-50'}`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {exam.config.p2 > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3 text-left">
                  <div className="w-2.5 h-2.5 bg-black text-left"></div>
                  <h3 className="font-black text-red-700 text-[10px] uppercase italic">Phần II (Đúng/Sai)</h3>
                </div>
                <div className="space-y-3">
                  {Array.from({length: exam.config.p2}, (_, i) => i + 1).map(n => (
                    <div key={n} className="border border-red-100 p-3 bg-white rounded-xl shadow-sm text-left">
                      <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-red-50">
                        <span className="text-[12px] font-black text-red-700 italic">Câu {n}</span>
                      </div>
                      {['a','b','c','d'].map(s => (
                        <div key={s} className="flex items-center gap-4 py-1.5 text-left">
                          <span className="text-[12px] font-bold text-slate-400 w-4 uppercase">{s}</span>
                          <div className="flex gap-2">
                            {[true, false].map(val => (
                              <button 
                                key={val.toString()}
                                onClick={()=>setUserAnswers(p=>({...p, p2:{...p.p2,[n]:{...(p.p2[n]||{}),[s]:val}}}))}
                                className={`bubble-btn flex items-center justify-center transition-all
                                  ${userAnswers.p2[n]?.[s] === val ? 'bubble-selected' : 'bg-white text-rose-500 border-rose-100'}`}
                              >
                                {val ? 'Đ' : 'S'}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {exam.config.p3 > 0 && (
              <section className="pb-10 text-left">
                <div className="flex items-center gap-2 mb-3 text-left">
                  <div className="w-2.5 h-2.5 bg-black text-left"></div>
                  <h3 className="font-black text-red-700 text-[10px] uppercase italic">Phần III (Trả lời ngắn)</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 text-left">
                  {Array.from({length: exam.config.p3}, (_, i) => i + 1).map(n => (
                    <div key={n} className="flex items-center gap-3 py-2 border-b border-red-100 text-left">
                      <span className="text-[14px] font-bold text-red-700 w-12 shrink-0 italic leading-none">Câu {n}</span>
                      <input 
                        type="text"
                        value={userAnswers.p3[n] || ""}
                        onChange={(e) => setUserAnswers(p => ({...p, p3: {...p.p3, [n]: e.target.value}}))}
                        className="flex-1 bg-white border border-red-100 rounded-lg px-3 py-1.5 text-[14px] font-bold text-blue-600 focus:outline-none focus:border-blue-500 font-mono shadow-sm text-left"
                        placeholder="..."
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm text-center">
          <div className="bg-white max-w-xs w-full p-10 rounded-2xl shadow-xl text-center animate-in zoom-in duration-200">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-5 text-center"><Icon name="send" size={28} /></div>
            <h3 className="text-[18px] font-bold text-slate-800 mb-4 uppercase italic tracking-tighter leading-none text-center">Xác nhận nộp bài</h3>
            
            <div className="bg-slate-50 rounded-xl p-4 mb-8 space-y-3 text-left">
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-slate-500 font-medium">Đã làm:</span>
                <span className="font-bold text-emerald-600">{stats.done}/{stats.total}</span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-slate-500 font-medium">Bỏ trống:</span>
                <span className={`font-bold ${stats.total - stats.done > 0 ? 'text-rose-500' : 'text-slate-400'}`}>{stats.total - stats.done} câu</span>
              </div>
            </div>

            <div className="flex gap-4 text-center">
              <button onClick={()=>setShowSubmitModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-[14px] uppercase transition-all hover:bg-slate-200">Trở lại</button>
              <button onClick={handleSubmit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg text-[14px] uppercase transition-all hover:bg-blue-700">Nộp ngay</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (view === 'result') {
    const feedback = getFeedback(resultsData.total);
    const scoreData = resultsData;
    return (
      <div className="min-h-[100dvh] md:h-screen flex flex-col bg-slate-50 overflow-x-hidden md:overflow-hidden animate-in fade-in duration-500 safe-p-bottom">
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row justify-between items-center shrink-0 z-20 gap-4 safe-p-top">
          <div className="flex items-center gap-3 md:gap-4 text-left w-full sm:w-auto">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-sm ${feedback.bg} ${feedback.color}`}><Icon name={feedback.icon} size={20} /></div>
            <div>
              <h2 className="text-[16px] md:text-[18px] font-extrabold uppercase text-slate-800 leading-tight truncate max-w-[200px]">{studentInfo.name}</h2>
              <p className="text-[9px] md:text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{studentInfo.class} • {studentInfo.school}</p>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4 md:gap-8 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0">
            <div className="text-center px-4 md:px-8 py-1.5 md:py-2 bg-blue-600 rounded-lg md:rounded-xl shadow-md min-w-[100px]">
              <p className="text-[8px] md:text-[10px] font-bold uppercase text-white/70 mb-0 tracking-tighter text-center">ĐIỂM TỔNG</p>
              <p className="text-[32px] md:text-[48px] font-black text-white leading-none tabular-nums text-center">{resultsData.total}</p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {exam.explanationPath && (
                <button 
                  onClick={() => setShowExplanation(!showExplanation)} 
                  className={`px-3 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-[11px] md:text-[14px] uppercase transition-all flex items-center justify-center gap-2 border-2 ${showExplanation ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-emerald-600 text-white border-emerald-600 shadow-md hover:bg-emerald-700'}`}
                >
                  <Icon name={showExplanation ? "list-checks" : "file-text"} size={12} /> 
                  <span className="hidden xs:inline">{showExplanation ? 'XEM ĐIỂM SỐ' : 'LỜI GIẢI'}</span>
                  <span className="xs:hidden">{showExplanation ? 'ĐIỂM' : 'GIẢI'}</span>
                </button>
              )}
              <button onClick={() => navigate('/')} className="bg-slate-900 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold text-[11px] md:text-[14px] uppercase hover:bg-black transition-all flex items-center justify-center gap-2">
                <Icon name="home" size={12} /> <span className="hidden xs:inline">TRANG CHỦ</span><span className="xs:hidden">VỀ</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 pb-12 text-left">
            <div className={`p-4 md:p-5 rounded-2xl border border-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 ${feedback.bg}`}>
              <p className="text-slate-700 text-[14px] md:text-[16px] font-semibold text-center md:text-left">{feedback.text}</p>
              <div className="flex gap-2">
                {[{l:'PHẦN I', v:scoreData.p1c, c:'text-blue-600'}, {l:'PHẦN II', v:scoreData.p2p, c:'text-purple-600'}, {l:'PHẦN III', v:scoreData.p3c, c:'text-orange-600'}].map(item => (
                  <div key={item.l} className="bg-white px-2 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-center border border-slate-100 min-w-[60px] md:min-w-[80px] shadow-sm"><p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">{item.l}</p><p className={`text-[13px] md:text-[16px] font-black ${item.c} leading-none`}>{item.v}</p></div>
                ))}
              </div>
            </div>
            {showExplanation ? (
              <div className="bg-slate-800 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-700 animate-in zoom-in duration-300">
                <div className="bg-slate-700 p-4 flex justify-between items-center">
                  <span className="text-white font-black uppercase italic tracking-widest text-xs flex items-center gap-2">
                    <Icon name="file-text" size={16} className="text-orange-400" /> FILE LỜI GIẢI CHI TIẾT
                  </span>
                  <button onClick={() => setShowExplanation(false)} className="text-slate-400 hover:text-white transition-all"><Icon name="x" size={20} /></button>
                </div>
                <div className="h-[75vh]">
                   <ExamDisplay type="pdf" path={exam.explanationPath} />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <section className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-[14px] md:text-[16px] font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 italic border-b pb-2"><Icon name="list-checks" size={18} className="text-blue-500" /> PHẦN I (TRẮC NGHIỆM)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-2">
                    {Array.from({length: exam.config.p1}, (_, i) => i + 1).map(n => (
                      <div key={n} className={`flex items-center justify-between px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border transition-all ${scoreData.details.p1[n] ? 'border-emerald-50 bg-emerald-50 text-emerald-700' : 'border-rose-50 bg-rose-50 text-rose-700'}`}>
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className="text-[12px] md:text-[14px] font-bold opacity-30">Câu {n}:</span>
                          <span className="font-extrabold text-[12px] md:text-[14px] uppercase">{userAnswers.p1[n] || '—'}</span>
                        </div>
                        {!scoreData.details.p1[n] && <span className="text-[12px] md:text-[14px] font-bold text-blue-600 uppercase italic">Đ/Á: {exam.correctAnswers.p1[n]}</span>}
                      </div>
                    ))}
                  </div>
                </section>
                {exam.config.p2 > 0 && (
                  <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-[16px] font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 italic border-b pb-2"><Icon name="check-square" size={18} className="text-purple-500" /> PHẦN II (ĐÚNG / SAI)</h3>
                    <div className="grid grid-cols-2 gap-6">
                      {Array.from({length: exam.config.p2}, (_, i) => i + 1).map(n => (
                        <div key={n} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="text-[14px] font-bold text-slate-400 mb-2 uppercase italic leading-none">Câu hỏi {n}</p>
                          <div className="space-y-1.5">
                            {['a','b','c','d'].map(s => {
                              const uVal = userAnswers.p2?.[n]?.[s];
                              const cVal = exam.correctAnswers.p2?.[n]?.[s];
                              const isCorrect = (uVal === cVal);
                              return (
                                <div key={s} className={`flex items-center justify-between p-2 rounded-lg border text-[14px] transition-all ${isCorrect ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                                  <span className="font-bold uppercase italic">{s}) {uVal === true ? 'ĐÚNG' : (uVal === false ? 'SAI' : '—')}</span>
                                  {!isCorrect && <span className="font-bold text-blue-600 uppercase">Đ/A: {cVal ? 'Đ' : 'S'}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {exam.config.p3 > 0 && (
                  <section className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-[14px] md:text-[16px] font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 italic border-b pb-2"><Icon name="edit-3" size={18} className="text-orange-500" /> PHẦN III (TRẢ LỜI NGẮN)</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
                      {Array.from({length: exam.config.p3}, (_, i) => i + 1).map(n => {
                        const isCorrect = scoreData.details.p3[n];
                        return (
                          <div key={n} className={`p-3 md:p-4 rounded-lg md:rounded-xl border flex flex-col gap-0.5 md:gap-1 ${isCorrect ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                            <div className="flex justify-between items-start">
                              <span className="text-[9px] md:text-[10px] font-bold opacity-40 uppercase italic leading-none">Câu {n}</span>
                              {!isCorrect && <span className="text-[9px] md:text-[10px] font-bold text-blue-500 italic leading-none">Đ/A: {exam.correctAnswers.p3[n]}</span>}
                            </div>
                            <span className="text-[14px] md:text-[16px] font-bold font-mono truncate leading-tight">{userAnswers.p3[n] || '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return null;
};

export default StudentQuiz;
