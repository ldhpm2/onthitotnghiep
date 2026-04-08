import React, { useMemo } from 'react';
import Icon from '../Icon';

const calculateAttemptScore = (userAns, correctAns, config) => {
  const details = { p1: {}, p2: {}, p3: {} };
  const uAns = userAns || {}; 
  const cAns = correctAns || {}; 
  const conf = config || { p1: 0, p2: 0, p3: 0 };
  
  let p1c = 0; 
  for (let i = 1; i <= conf.p1; i++) { 
    const isC = uAns.p1 && uAns.p1[i] && cAns.p1 && uAns.p1[i] === cAns.p1[i]; 
    if (isC) p1c++; 
    details.p1[i] = isC; 
  }
  
  let p2p = 0; 
  for (let i = 1; i <= conf.p2; i++) {
    let subC = 0; 
    const uS = (uAns.p2 && uAns.p2[i]) ? uAns.p2[i] : {}; 
    const cS = (cAns.p2 && cAns.p2[i]) ? cAns.p2[i] : {}; 
    const subD = {};
    ['a','b','c','d'].forEach(s => { 
      const isC = uS[s] !== undefined && cS[s] !== undefined && uS[s] === cS[s]; 
      if (isC) subC++; 
      subD[s] = isC; 
    });
    if (subC === 1) p2p += 0.1; 
    else if (subC === 2) p2p += 0.25; 
    else if (subC === 3) p2p += 0.5; 
    else if (subC === 4) p2p += 1.0;
    details.p2[i] = subD;
  }
  
  let p3c = 0; 
  for (let i = 1; i <= conf.p3; i++) {
    const uA = (uAns.p3 && uAns.p3[i] ? uAns.p3[i] : '').toString().trim().toLowerCase();
    const cA = (cAns.p3 && cAns.p3[i] ? cAns.p3[i] : '').toString().trim().toLowerCase();
    const isC = uA !== '' && cA !== '' && uA === cA; 
    if (isC) p3c++; 
    details.p3[i] = isC;
  }
  
  return { total: ((p1c * 0.25) + p2p + (p3c * 0.5)).toFixed(2), p1c, p2p: p2p.toFixed(2), p3c, details };
};

const DetailView = ({ attempt, exam, onBack }) => {
  const scoreData = useMemo(() => calculateAttemptScore(attempt.userAnswers, exam.correctAnswers, exam.config), [attempt, exam]);
  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden animate-in fade-in">
      <header className="bg-slate-800 p-6 text-white flex justify-between items-center shadow-xl shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl"><Icon name="chevron-left" /></button>
          <div>
            <h2 className="text-xl font-black uppercase">{attempt.name}</h2>
            <p className="text-[10px] opacity-60 uppercase">{attempt.class} • {attempt.school}</p>
          </div>
        </div>
        <div className="text-center px-6 py-2 bg-white/10 rounded-2xl border border-white/10">
          <p className="text-[10px] uppercase opacity-70">Điểm</p>
          <p className="text-3xl font-black text-emerald-400">{attempt.score}</p>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-10 pb-20">
          {attempt.tabSwitches > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center gap-3">
              <Icon name="alert-triangle" />
              <div><p className="font-bold">Cảnh báo gian lận</p><p className="text-xs">Học sinh này đã chuyển tab hoặc thoát khỏi màn hình làm bài <b>{attempt.tabSwitches} lần</b>.</p></div>
            </div>
          )}
          <section>
            <h3 className="text-sm font-black text-slate-400 uppercase mb-6 tracking-widest">Phần I: Trắc nghiệm ({scoreData.p1c} câu đúng)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Array.from({length: exam.config.p1}, (_, i) => i + 1).map(n => (
                <div key={n} className={`bg-white p-3 rounded-2xl border-2 flex flex-col items-center gap-1 ${scoreData.details.p1[n] ? 'border-emerald-400' : 'border-red-400'}`}>
                  <span className="text-[9px] font-black text-slate-300">CÂU {n}</span>
                  <span className={`text-lg font-black ${scoreData.details.p1[n] ? 'text-emerald-600' : 'text-red-600'}`}>{attempt.userAnswers?.p1?.[n] || '—'}</span>
                  {!scoreData.details.p1[n] && <span className="text-[8px] font-bold text-slate-400">Đúng: {exam.correctAnswers?.p1?.[n] || '?'}</span>}
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-black text-slate-400 uppercase mb-6 tracking-widest">Phần II: Đúng / Sai ({scoreData.p2p} điểm)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({length: exam.config.p2}, (_, i) => i + 1).map(n => (
                <div key={n} className="bg-white p-5 rounded-3xl border border-slate-100">
                  <p className="font-black text-slate-400 text-[10px] mb-4 uppercase italic">Câu {n}</p>
                  <div className="space-y-2">
                    {['a','b','c','d'].map(s => { 
                      const isC = scoreData.details.p2[n][s]; 
                      const uV = attempt.userAnswers?.p2?.[n]?.[s]; 
                      const cV = exam.correctAnswers?.p2?.[n]?.[s];
                      return (
                        <div key={s} className={`flex justify-between items-center px-4 py-2 rounded-xl text-[10px] font-bold ${isC ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          <span>{s}) {uV === true ? 'ĐÚNG' : (uV === false ? 'SAI' : '—')}</span>
                          {!isC && <span>Đáp án: {cV === true ? 'Đúng' : 'Sai'}</span>}
                        </div>
                      ); 
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-black text-slate-400 uppercase mb-6 tracking-widest">Phần III: Trả lời ngắn ({scoreData.p3c} câu đúng)</h3>
            <div className="space-y-3">
              {Array.from({length: exam.config.p3}, (_, i) => i + 1).map(n => (
                <div key={n} className={`bg-white p-4 rounded-2xl border-2 flex items-center justify-between ${scoreData.details.p3[n] ? 'border-emerald-400' : 'border-red-400'}`}>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-slate-300 italic">C{n}</span>
                    <span className={`font-black ${scoreData.details.p3[n] ? 'text-emerald-600' : 'text-red-600'}`}>{attempt.userAnswers?.p3?.[n] || '(Trống)'}</span>
                  </div>
                  {!scoreData.details.p3[n] && (
                    <div className="text-right">
                      <p className="text-[8px] font-bold text-slate-400">ĐÁP ÁN: <span className="text-blue-600 ml-1">{exam.correctAnswers?.p3?.[n] || '?'}</span></p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export { DetailView, calculateAttemptScore };
