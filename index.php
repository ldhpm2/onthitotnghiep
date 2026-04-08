<?php
/**
 * TRANG DÀNH CHO HỌC SINH - TƯƠNG THÍCH PHP 5.6
 * CHỨC NĂNG: XEM DANH SÁCH ĐỀ THEO CHỦ ĐỀ, LÀM BÀI VÀ XEM KẾT QUẢ
 */
ob_start();
@ini_set('upload_max_filesize', '100M');
@ini_set('post_max_size', '100M');
@ini_set('max_execution_time', '600');
@ini_set('memory_limit', '512M');
error_reporting(0); 

$dataFile = __DIR__ . DIRECTORY_SEPARATOR . 'exams_data.json';
$historyFile = __DIR__ . DIRECTORY_SEPARATOR . 'history_data.json';

if (!file_exists($dataFile)) { @file_put_contents($dataFile, json_encode(array())); }
if (!file_exists($historyFile)) { @file_put_contents($historyFile, json_encode(array())); }

// API XỬ LÝ
if (isset($_GET['action'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    $action = $_GET['action'];

    if ($action === 'list') {
        $content = @file_get_contents($dataFile);
        $data = json_decode($content, true);
        if (!is_array($data)) $data = array();
        $visible = array();
        foreach ($data as $e) {
            if (!isset($e['visible']) || $e['visible'] === true) {
                $visible[] = $e;
            }
        }
        echo json_encode($visible);
        exit;
    }

    if ($action === 'submit_attempt' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $attempt = json_decode(file_get_contents('php://input'), true);
        if ($attempt) {
            $history = json_decode(@file_get_contents($historyFile), true);
            if (!is_array($history)) $history = array();
            $history[] = $attempt;
            file_put_contents($historyFile, json_encode($history));
            echo json_encode(array('success' => true));
        }
        exit;
    }
    echo json_encode(array('error' => 'Invalid action'));
    exit;
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hệ thống Ôn tập Toán 12 - Thầy Chiến</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>

    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; overflow: hidden; background-color: #f8fafc; color: #1e293b; font-size: 14px; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        .exam-view-container { background-color: #525659; height: 100%; width: 100%; display: flex; justify-content: center; overflow-y: auto; }
        .docx-paper { background: white; width: 100%; padding: 25px; box-shadow: 0 0 30px rgba(0,0,0,0.15); min-height: 100%; box-sizing: border-box; }
        .docx-paper img, .docx-paper table { max-width: 100% !important; height: auto !important; }
        
        .bubble-btn { transition: all 0.1s ease-in-out; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; width: 30px; height: 30px; border-radius: 9999px; border-width: 2px; }
        .bubble-btn:active { transform: scale(0.9); }
        .bubble-selected { background-color: #0f172a !important; color: #ffffff !important; border-color: #0f172a !important; }
        
        /* Ẩn thanh cuộn của tab bar trên mobile nhưng vẫn vuốt được */
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
    </style>
</head>
<body>
    <div id="root"></div>

    <script>
        // TRUYỀN DỮ LIỆU TỪ SERVER SANG CLIENT
        window.__PHP_PATH = <?php echo json_encode($_SERVER['PHP_SELF']); ?>;
    </script>

    <script type="text/babel">
        const { useState, useEffect, useCallback, useMemo, useRef } = React;

        const CATEGORIES = {
            'all': 'Tất cả đề',
            'chinh_thuc': 'Đề thi chính thức',
            'thi_thu': 'Đề thi thử chọn lọc',
            'truong_sgd': 'Đề các trường & SGD',
            'khac': 'Chủ đề khác'
        };

        // LỚP BẢO VỆ ICON: Đảm bảo React không bị sập khi bộ lọc thay đổi danh sách
        const Icon = ({ name, size = 16, className = "" }) => {
            const iconRef = useRef(null);
            useEffect(() => {
                if (iconRef.current && window.lucide) {
                    iconRef.current.innerHTML = `<i data-lucide="${name}"></i>`;
                    window.lucide.createIcons({
                        root: iconRef.current,
                        attrs: { width: size, height: size }
                    });
                }
            }, [name, size]);
            return <span ref={iconRef} className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}></span>;
        };

        const Timer = ({ initialMinutes, onTimeUp }) => {
            const [seconds, setSeconds] = useState((initialMinutes || 0) * 60);
            useEffect(() => {
                const timer = setInterval(() => {
                    setSeconds(s => { if (s <= 1) { clearInterval(timer); onTimeUp(); return 0; } return s - 1; });
                }, 1000);
                return () => clearInterval(timer);
            }, [onTimeUp]);
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-[18px] font-bold text-white shadow-sm ${seconds < 300 ? 'bg-rose-500 animate-pulse' : 'bg-slate-800'}`}>
                    <Icon name="clock" size={18} /> {m}:{s.toString().padStart(2, '0')}
                </div>
            );
        };

        const ExamDisplay = ({ type, path }) => {
            const [html, setHtml] = useState(''); const [pdfPages, setPdfPages] = useState([]); const [loading, setLoading] = useState(true);
            const containerRef = useRef(null);

            useEffect(() => {
                setLoading(true); setPdfPages([]);
                if (type === 'docx') {
                    fetch(path).then(r => r.arrayBuffer()).then(b => mammoth.convertToHtml({ arrayBuffer: b })).then(res => { setHtml(res.value); setLoading(false); }).catch(() => setLoading(false));
                } else if (type === 'pdf') {
                    const loadingTask = window.pdfjsLib.getDocument(path);
                    loadingTask.promise.then(async (pdf) => {
                        const pagesArray = [];
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i); const viewport = page.getViewport({ scale: 1.5 }); 
                            const canvas = document.createElement('canvas'); const context = canvas.getContext('2d'); canvas.height = viewport.height; canvas.width = viewport.width;
                            await page.render({ canvasContext: context, viewport: viewport }).promise; pagesArray.push(canvas.toDataURL('image/webp', 0.8));
                        }
                        setPdfPages(pagesArray); setLoading(false);
                    }).catch(err => { console.error("PDF Render Error:", err); setLoading(false); });
                }
            }, [path, type]);

            return (
                <div className="exam-view-container custom-scrollbar bg-slate-700" ref={containerRef}>
                    {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-800 text-white font-bold text-[14px] uppercase italic">Đang tải tài liệu... ({type ? type.toUpperCase() : ''})</div>}
                    <div className="w-full flex flex-col items-center gap-4 py-4">
                        {type === 'docx' ? (<div className="docx-paper animate-in fade-in duration-300" dangerouslySetInnerHTML={{ __html: html }} />) : (
                            pdfPages.map((pageData, index) => (<div key={index} className="shadow-2xl bg-white leading-[0] max-w-full"><img src={pageData} alt={`Page ${index + 1}`} className="max-w-full h-auto border-b border-slate-200" loading="lazy" /></div>))
                        )}
                    </div>
                </div>
            );
        };

        const calculateAttemptScore = (userAns, correctAns, config) => {
            const details = { p1: {}, p2: {}, p3: {} }; const uAns = userAns || { p1: {}, p2: {}, p3: {} }; const cAns = correctAns || { p1: {}, p2: {}, p3: {} }; const conf = config || { p1: 0, p2: 0, p3: 0 };
            let p1c = 0; for (let i = 1; i <= conf.p1; i++) { const isCorrect = uAns.p1 && uAns.p1[i] && cAns.p1 && uAns.p1[i] === cAns.p1[i]; if (isCorrect) p1c++; details.p1[i] = isCorrect; }
            let p2p = 0; for (let i = 1; i <= conf.p2; i++) {
                let subCorrectCount = 0; const uSub = (uAns.p2 && uAns.p2[i]) ? uAns.p2[i] : {}; const cSub = (cAns.p2 && cAns.p2[i]) ? cAns.p2[i] : {}; const subDetails = {};
                ['a', 'b', 'c', 'd'].forEach(s => { const isC = uSub[s] !== undefined && cSub[s] !== undefined && uSub[s] === cSub[s]; if (isC) subCorrectCount++; subDetails[s] = isC; });
                if (subCorrectCount === 1) p2p += 0.1; else if (subCorrectCount === 2) p2p += 0.25; else if (subCorrectCount === 3) p2p += 0.5; else if (subCorrectCount === 4) p2p += 1.0; details.p2[i] = subDetails;
            }
            let p3c = 0; for (let i = 1; i <= conf.p3; i++) {
                const uA = (uAns.p3 && uAns.p3[i] ? uAns.p3[i] : '').toString().trim().replace(',','.').toLowerCase(); const cA = (cAns.p3 && cAns.p3[i] ? cAns.p3[i] : '').toString().trim().replace(',','.').toLowerCase();
                const isCorrect = uA !== '' && cA !== '' && parseFloat(uA) === parseFloat(cA); if (isCorrect) p3c++; details.p3[i] = isCorrect;
            }
            const total = ((p1c * 0.25) + p2p + (p3c * 0.5)).toFixed(2); return { total, p1c, p2p: p2p.toFixed(2), p3c, details };
        };

        const getFeedback = (score) => {
            const s = parseFloat(score);
            if (s >= 9.0) return { text: "Kết quả xuất sắc! Bạn đã nắm vững kiến thức.", color: "text-emerald-600", bg: "bg-emerald-50", icon: "award" };
            if (s >= 8.0) return { text: "Kết quả rất tốt! Hãy tiếp tục phát huy.", color: "text-blue-600", bg: "bg-blue-50", icon: "thumbs-up" };
            if (s >= 5.0) return { text: "Kết quả trung bình. Cần nỗ lực hơn nữa.", color: "text-amber-600", bg: "bg-amber-50", icon: "trending-up" };
            return { text: "Cần nỗ lực thêm để cải thiện kết quả!", color: "text-rose-600", bg: "bg-rose-50", icon: "edit-3" };
        };

        const ResultDetailView = ({ attempt, exam, onBack, onChooseOther }) => {
            const scoreData = useMemo(() => calculateAttemptScore(attempt.userAnswers, exam.correctAnswers, exam.config), [attempt, exam]);
            const feedback = useMemo(() => getFeedback(attempt.score), [attempt.score]);

            return (
                <div className="h-screen flex flex-col bg-slate-50 overflow-hidden animate-in fade-in duration-500">
                    <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0 z-20">
                         <div className="flex items-center gap-4 text-left">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${feedback.bg} ${feedback.color}`}><Icon name={feedback.icon} size={24} /></div>
                            <div>
                                <h2 className="text-[18px] font-extrabold uppercase text-slate-800 leading-tight">{attempt.name}</h2>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">{attempt.class} • {attempt.school}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-8">
                            <div className="text-center px-8 py-2 bg-blue-600 rounded-xl shadow-md">
                                <p className="text-[10px] font-bold uppercase text-white/70 mb-0.5 tracking-tighter text-center">ĐIỂM TỔNG</p>
                                <p className="text-[48px] font-black text-white leading-none tabular-nums text-center">{attempt.score}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={onChooseOther} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-[14px] uppercase hover:bg-black transition-all flex items-center justify-center gap-2"><Icon name="layout-list" size={14} /> ĐỀ KHÁC</button>
                                <button onClick={onBack} className="bg-white text-slate-500 border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-[14px] uppercase hover:bg-slate-50 transition-all flex items-center justify-center gap-2"><Icon name="home" size={14} /> TRANG CHỦ</button>
                            </div>
                         </div>
                    </header>

                    <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <div className="max-w-6xl mx-auto space-y-6 pb-12 text-left">
                            <div className={`p-5 rounded-2xl border border-white shadow-sm flex items-center justify-between gap-6 ${feedback.bg}`}>
                                <p className="text-slate-700 text-[16px] font-semibold">{feedback.text}</p>
                                <div className="flex gap-2">
                                    {[{l:'PHẦN I', v:scoreData.p1c, c:'text-blue-600'}, {l:'PHẦN II', v:scoreData.p2p, c:'text-purple-600'}, {l:'PHẦN III', v:scoreData.p3c, c:'text-orange-600'}].map(item => (
                                        <div key={item.l} className="bg-white px-4 py-2 rounded-xl text-center border border-slate-100 min-w-[80px] shadow-sm"><p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">{item.l}</p><p className={`text-[16px] font-black ${item.c} leading-none`}>{item.v}</p></div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-6">
                                <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h3 className="text-[16px] font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 italic border-b pb-2"><Icon name="list-checks" size={18} className="text-blue-500" /> PHẦN I (TRẮC NGHIỆM)</h3>
                                    <div className="grid grid-cols-2 gap-x-12 gap-y-2">
                                        {Array.from({length: exam.config.p1}, (_, i) => i + 1).map(n => (
                                            <div key={n} className={`flex items-center justify-between px-4 py-2 rounded-xl border transition-all ${scoreData.details.p1[n] ? 'border-emerald-50 bg-emerald-50 text-emerald-700' : 'border-rose-50 bg-rose-50 text-rose-700'}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[14px] font-bold opacity-30">Câu {n}:</span>
                                                    <span className="font-extrabold text-[14px] uppercase">{attempt.userAnswers.p1[n] || '—'}</span>
                                                </div>
                                                {!scoreData.details.p1[n] && <span className="text-[14px] font-bold text-blue-600 uppercase italic">Đ/Á: {exam.correctAnswers.p1[n]}</span>}
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
                                                            const uVal = attempt.userAnswers.p2?.[n]?.[s];
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
                                    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <h3 className="text-[16px] font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 italic border-b pb-2"><Icon name="edit-3" size={18} className="text-orange-500" /> PHẦN III (TRẢ LỜI NGẮN)</h3>
                                        <div className="grid grid-cols-3 gap-3">
                                            {Array.from({length: exam.config.p3}, (_, i) => i + 1).map(n => {
                                                const isCorrect = scoreData.details.p3[n];
                                                return (
                                                    <div key={n} className={`p-4 rounded-xl border flex flex-col gap-1 ${isCorrect ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                                                        <div className="flex justify-between items-start">
                                                            <span className="text-[10px] font-bold opacity-40 uppercase italic leading-none">Câu {n}</span>
                                                            {!isCorrect && <span className="text-[10px] font-bold text-blue-500 italic leading-none">Đ/A: {exam.correctAnswers.p3[n]}</span>}
                                                        </div>
                                                        <span className="text-[16px] font-bold font-mono truncate leading-tight">{attempt.userAnswers.p3[n] || '—'}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}
                            </div>
                        </div>
                    </main>
                    <footer className="bg-white border-t border-slate-200 py-3 text-center shrink-0"><p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px] italic">Trang luyện thi của thầy Nguyễn Duy Chiến</p></footer>
                </div>
            );
        };

        const App = () => {
            const [view, setView] = useState('landing');
            const [exams, setExams] = useState([]);
            const [currentExam, setCurrentExam] = useState(null);
            const [studentInfo, setStudentInfo] = useState({ name: '', class: '', school: '' });
            const [userAnswers, setUserAnswers] = useState({ p1: {}, p2: {}, p3: {} });
            const [startTime, setStartTime] = useState(null);
            const [showSubmitModal, setShowSubmitModal] = useState(false);
            
            // THÊM STATE LƯU TRỮ SỐ LẦN CHUYỂN TAB
            const [tabSwitchCount, setTabSwitchCount] = useState(0);
            
            const [activeCategory, setActiveCategory] = useState('all');

            const getApiUrl = useCallback((action) => {
                const basePath = window.__PHP_PATH || 'index.php';
                return basePath + "?action=" + action + "&t=" + Date.now();
            }, []);

            useEffect(() => {
                const loadExams = async () => {
                    try {
                        const response = await fetch(getApiUrl('list'));
                        if (!response.ok) throw new Error("Server Error");
                        const data = await response.json();
                        setExams(Array.isArray(data) ? data : []);
                    } catch (e) { console.error("Error fetching exams:", e); }
                };
                loadExams();
            }, [getApiUrl]);

            // THÊM LISTENER THEO DÕI VIỆC CHUYỂN TAB KHI ĐANG THI
            useEffect(() => {
                const handleVisibilityChange = () => {
                    if (document.hidden && view === 'quiz') {
                        setTabSwitchCount(prev => prev + 1);
                        alert("⚠️ CẢNH BÁO: Bạn vừa chuyển tab hoặc rời khỏi cửa sổ làm bài. Hệ thống đã ghi nhận hành vi này để báo cáo cho giáo viên!");
                    }
                };
                document.addEventListener("visibilitychange", handleVisibilityChange);
                return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
            }, [view]);

            const stats = useMemo(() => {
                if (!currentExam) return { done: 0, total: 0 };
                const p1Done = Object.keys(userAnswers.p1).length;
                const p2Done = Object.keys(userAnswers.p2).length;
                const p3Done = Object.keys(userAnswers.p3).filter(k => userAnswers.p3[k].trim() !== '').length;
                const total = (currentExam.config.p1 || 0) + (currentExam.config.p2 || 0) + (currentExam.config.p3 || 0);
                return { done: p1Done + p2Done + p3Done, total };
            }, [userAnswers, currentExam]);

            const handleSubmit = async () => {
                const finishTime = Date.now();
                const payload = {
                    examId: currentExam.id,
                    name: studentInfo.name,
                    class: studentInfo.class,
                    school: studentInfo.school,
                    score: resultsData.total,
                    userAnswers: JSON.parse(JSON.stringify(userAnswers)), 
                    startTime: startTime,
                    endTime: finishTime,
                    tabSwitches: tabSwitchCount // Gửi kèm số lần chuyển tab về Backend
                };
                try { 
                    await fetch(getApiUrl('submit_attempt'), { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload) 
                    });
                } catch (e) {}
                setShowSubmitModal(false);
                setView('result');
            };

            const formatTimeSpent = (ms) => {
                const s = Math.floor(ms / 1000);
                const mm = Math.floor(s / 60);
                const ss = s % 60;
                return `${mm} phút ${ss} giây`;
            };

            const resultsData = useMemo(() => {
                if (!currentExam) return { total: "0.00" };
                return calculateAttemptScore(userAnswers, currentExam.correctAnswers, currentExam.config);
            }, [currentExam, userAnswers]);

            const filteredExams = useMemo(() => {
                return exams.filter(e => {
                    if (activeCategory === 'all') return true;
                    const cat = e.category || 'khac';
                    return cat === activeCategory;
                });
            }, [exams, activeCategory]);

            if (view === 'student_form') return (
                <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-center">
                    <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl p-10 border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
                        <button onClick={() => setView('student_list')} className="text-slate-400 mb-8 flex items-center gap-2 font-bold text-[10px] uppercase hover:text-slate-600 mx-auto transition-colors"><Icon name="chevron-left" /> Quay lại</button>
                        <h2 className="text-[18px] font-black text-slate-800 uppercase mb-8 tracking-tight italic">Thông tin thí sinh</h2>
                        <div className="space-y-4">
                            <input type="text" placeholder="Họ và tên thí sinh" value={studentInfo.name} onChange={e => setStudentInfo({...studentInfo, name: e.target.value})} className="w-full p-3.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-[14px] text-center shadow-inner" />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="Lớp" value={studentInfo.class} onChange={e => setStudentInfo({...studentInfo, class: e.target.value})} className="w-full p-3.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-[14px] text-center shadow-inner" />
                                <input type="text" placeholder="Trường" value={studentInfo.school} onChange={e => setStudentInfo({...studentInfo, school: e.target.value})} className="w-full p-3.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-[14px] text-center shadow-inner" />
                            </div>
                        </div>
                        <button onClick={() => { if(studentInfo.name) { setStartTime(Date.now()); setTabSwitchCount(0); setView('quiz'); } }} disabled={!studentInfo.name} className={`w-full mt-10 py-4 rounded-xl font-bold text-[16px] shadow-lg transition-all ${studentInfo.name ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400'}`}>BẮT ĐẦU</button>
                    </div>
                </div>
            );
            
            if (view === 'student_list') return (
                <div className="max-w-4xl mx-auto p-12 text-center h-screen overflow-y-auto custom-scrollbar">
                    <button onClick={() => setView('landing')} className="text-blue-600 font-bold text-[10px] uppercase tracking-[0.4em] mb-12 mx-auto flex items-center gap-2 hover:bg-white px-6 py-2.5 rounded-xl transition-all shadow-sm"><Icon name="arrow-left" /> Quay lại trang chủ</button>
                    <h1 className="text-[24px] font-black text-slate-800 mb-10 tracking-tighter uppercase italic decoration-blue-500 underline decoration-[4px] underline-offset-4 leading-none text-center">DANH SÁCH ĐỀ THI</h1>
                    
                    {/* KHU VỰC TABS DANH MỤC */}
                    <div className="flex overflow-x-auto hide-scroll gap-3 mb-8 pb-2 shrink-0 px-2 justify-start md:justify-center">
                        {Object.keys(CATEGORIES).map(function(key) {
                            return (
                                <button 
                                    key={key}
                                    onClick={() => setActiveCategory(key)}
                                    className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-xs transition-all border ${activeCategory === key ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {CATEGORIES[key]}
                                </button>
                            );
                        })}
                    </div>

                    {/* KHU VỰC HIỂN THỊ DANH SÁCH ĐỀ (Dùng filteredExams) */}
                    {filteredExams.length === 0 ? (
                        <div className="py-20 text-slate-400 italic font-bold">Chưa có đề thi nào trong mục này.</div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-6 text-left">
                            {filteredExams.map(e => (
                                <button key={e.id} onClick={() => { setCurrentExam(e); setUserAnswers({p1:{},p2:{},p3:{}}); setView('student_form'); }} className="bg-white p-5 rounded-2xl border border-transparent hover:border-blue-500 shadow-sm hover:shadow-md transition-all group flex items-center gap-5 w-full">
                                    <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all ${e.type==='pdf'?'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                                        <Icon name={e.type==='pdf'?'file-text':'file'} size={24} />
                                    </div>
                                    <div className="flex-1 overflow-hidden text-left">
                                        <h3 className="text-[16px] font-bold text-slate-800 mb-2 leading-tight truncate block w-full">{e.title}</h3>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">{e.duration} PHÚT</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{e.config.p1+e.config.p2+e.config.p3} CÂU</span>
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

            if (view === 'quiz') return (
                <div className="h-screen flex flex-col bg-slate-100 overflow-hidden text-left">
                    <header className="bg-white border-b border-slate-200 p-2 flex justify-between items-center z-20 shadow-sm shrink-0 px-6">
                        <div className="flex items-center gap-4">
                            <button onClick={() => { if(confirm("Kết quả bài làm sẽ không được lưu. Bạn chắc chứ?")) setView('student_list') }} className="p-2 text-slate-400 hover:text-slate-600 transition-all"><Icon name="arrow-left" size={20} /></button>
                            <div className="max-w-[180px] sm:max-w-md text-left">
                                <h2 className="font-bold text-slate-800 text-[14px] uppercase truncate leading-none">{currentExam.title}</h2>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest truncate">{studentInfo.name}</p>
                                    <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold">Đã làm: {stats.done}/{stats.total} câu</span>
                                    {tabSwitchCount > 0 && <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-600 rounded-full font-bold">Chuyển tab: {tabSwitchCount}</span>}
                                </div>
                            </div>
                        </div>
                        <Timer initialMinutes={currentExam.duration} onTimeUp={() => setView('result')} />
                        <button onClick={() => setShowSubmitModal(true)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition-all uppercase tracking-widest text-[10px]">Nộp bài làm</button>
                    </header>

                    <div className="flex-1 flex overflow-hidden">
                        <div className="flex-1 bg-slate-800 overflow-hidden">
                            <ExamDisplay type={currentExam.type} path={currentExam.filePath} />
                        </div>

                        <div className="w-[280px] shrink-0 overflow-y-auto bg-[#fffbfb] custom-scrollbar shadow-inner border-l border-slate-200 flex flex-col p-5">
                            <div className="space-y-6">
                                <div className="text-center border-b-2 border-red-600 pb-3 mb-4">
                                    <h2 className="text-[12px] font-black text-red-700 uppercase tracking-widest italic leading-none text-center">PHIẾU TRẢ LỜI</h2>
                                </div>

                                {currentExam.config.p1 > 0 && (
                                    <section>
                                        <div className="flex items-center gap-2 mb-3 text-left">
                                            <div className="w-2.5 h-2.5 bg-black text-left"></div>
                                            <h3 className="font-black text-red-700 text-[10px] uppercase italic text-left">Phần I (Trắc nghiệm)</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            {Array.from({length: currentExam.config.p1}, (_, i) => i + 1).map(n => (
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

                                {currentExam.config.p2 > 0 && (
                                    <section>
                                        <div className="flex items-center gap-2 mb-3 text-left">
                                            <div className="w-2.5 h-2.5 bg-black text-left"></div>
                                            <h3 className="font-black text-red-700 text-[10px] uppercase italic">Phần II (Đúng/Sai)</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {Array.from({length: currentExam.config.p2}, (_, i) => i + 1).map(n => (
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

                                {currentExam.config.p3 > 0 && (
                                    <section className="pb-10 text-left">
                                        <div className="flex items-center gap-2 mb-3 text-left">
                                            <div className="w-2.5 h-2.5 bg-black text-left"></div>
                                            <h3 className="font-black text-red-700 text-[10px] uppercase italic">Phần III (Trả lời ngắn)</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 text-left">
                                            {Array.from({length: currentExam.config.p3}, (_, i) => i + 1).map(n => (
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
                                        <span className="text-slate-500 font-medium">Thời gian:</span>
                                        <span className="font-bold text-slate-800">{formatTimeSpent(Date.now() - startTime)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[14px]">
                                        <span className="text-slate-500 font-medium">Đã làm:</span>
                                        <span className="font-bold text-emerald-600">{stats.done}/{stats.total}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[14px]">
                                        <span className="text-slate-500 font-medium">Bỏ trống:</span>
                                        <span className={`font-bold ${stats.total - stats.done > 0 ? 'text-rose-500' : 'text-slate-400'}`}>{stats.total - stats.done} câu</span>
                                    </div>
                                    {tabSwitchCount > 0 && (
                                        <div className="flex justify-between items-center text-[14px]">
                                            <span className="text-slate-500 font-medium">Chuyển tab:</span>
                                            <span className="font-bold text-red-600">{tabSwitchCount} lần</span>
                                        </div>
                                    )}
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

            if (view === 'result') return <ResultDetailView attempt={{ name: studentInfo.name, class: studentInfo.class, school: studentInfo.school, score: resultsData.total, userAnswers: userAnswers }} exam={currentExam} onBack={() => setView('landing')} onChooseOther={() => setView('student_list')} />;

            return (
                <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-center">
                    <div className="bg-white p-12 rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
                        <div className="w-16 h-16 bg-blue-600 text-white rounded-xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-blue-100 rotate-3 transition-transform hover:rotate-0 text-center"><Icon name="graduation-cap" size={40} /></div>
                        <h1 className="text-[18px] sm:text-[24px] font-black text-slate-800 mb-4 tracking-tighter uppercase italic decoration-blue-500 underline decoration-[4px] underline-offset-4 leading-none text-center">Ôn thi Toán 12</h1>
                        <p className="text-slate-400 mb-12 text-[14px] font-medium italic border-t border-slate-100 pt-8 leading-relaxed text-center text-center">Phần mềm ôn luyện trắc nghiệm cấu trúc mới chuẩn Bộ GD&ĐT.</p>
                        <div className="flex flex-col gap-6 items-center text-center">
                            <button onClick={() => setView('student_list')} className="bg-blue-600 text-white px-12 py-3.5 rounded-xl font-bold text-[16px] shadow-lg shadow-blue-100 hover:scale-105 transition-all flex items-center justify-center gap-4 italic tracking-widest uppercase leading-none shadow-md text-center"><Icon name="play" size={20}/> BẮT ĐẦU ÔN TẬP</button>
                        </div>
                    </div>
                    {/* Footer chân trang */}
                    <div className="fixed bottom-6 left-0 w-full text-center">
                        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] italic">
                            Trang luyện thi của thầy Nguyễn Duy Chiến
                        </p>
                    </div>
                </div>
            );
        };

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>
