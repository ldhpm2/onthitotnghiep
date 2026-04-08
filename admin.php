<?php
/**
 * TRANG DÀNH CHO GIÁO VIÊN - TƯƠNG THÍCH PHP 5.6
 * CHỨC NĂNG: QUẢN LÝ ĐỀ, ĐÁP ÁN, LỊCH SỬ, CHẤM LẠI ĐIỂM, XÓA HÀNG LOẠT VÀ ĐĂNG NHẬP BẢO MẬT
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
ob_start();
@ini_set('upload_max_filesize', '100M');
@ini_set('post_max_size', '100M');
@ini_set('max_execution_time', '600');
@ini_set('memory_limit', '512M');
error_reporting(0); 

// THÔNG TIN ĐĂNG NHẬP
$ADMIN_USER = '';
$ADMIN_PASS = '';

$uploadFolderName = 'uploads';
$uploadDir = __DIR__ . DIRECTORY_SEPARATOR . $uploadFolderName . DIRECTORY_SEPARATOR;
$dataFile = __DIR__ . DIRECTORY_SEPARATOR . 'exams_data.json';
$historyFile = __DIR__ . DIRECTORY_SEPARATOR . 'history_data.json';

if (!is_dir($uploadDir)) { @mkdir($uploadDir, 0777, true); }
if (!file_exists($dataFile)) { @file_put_contents($dataFile, json_encode(array())); }
if (!file_exists($historyFile)) { @file_put_contents($historyFile, json_encode(array())); }

/**
 * Hàm chấm điểm dùng cho Backend để chấm lại lịch sử (Chuẩn PHP 5.6)
 */
function calculateScoreBackend($userAns, $correctAns, $config) {
    $p1c = 0;
    $p1_count = isset($config['p1']) ? (int)$config['p1'] : 0;
    $uP1 = isset($userAns['p1']) ? $userAns['p1'] : array();
    $cP1 = isset($correctAns['p1']) ? $correctAns['p1'] : array();
    for ($i = 1; $i <= $p1_count; $i++) {
        if (isset($uP1[$i]) && isset($cP1[$i]) && (string)$uP1[$i] == (string)$cP1[$i]) { $p1c++; }
    }
    $p2p = 0;
    $p2_count = isset($config['p2']) ? (int)$config['p2'] : 0;
    $uP2 = isset($userAns['p2']) ? $userAns['p2'] : array();
    $cP2 = isset($correctAns['p2']) ? $correctAns['p2'] : array();
    for ($i = 1; $i <= $p2_count; $i++) {
        $subCorrect = 0;
        $options = array('a', 'b', 'c', 'd');
        foreach ($options as $s) {
            $uVal = (isset($uP2[$i]) && isset($uP2[$i][$s])) ? $uP2[$i][$s] : null;
            $cVal = (isset($cP2[$i]) && isset($cP2[$i][$s])) ? $cP2[$i][$s] : null;
            if ($uVal !== null && $cVal !== null && $uVal === $cVal) { $subCorrect++; }
        }
        if ($subCorrect == 1) $p2p += 0.1;
        else if ($subCorrect == 2) $p2p += 0.25;
        else if ($subCorrect == 3) $p2p += 0.5;
        else if ($subCorrect == 4) $p2p += 1.0;
    }
    $p3c = 0;
    $p3_count = isset($config['p3']) ? (int)$config['p3'] : 0;
    $uP3 = isset($userAns['p3']) ? $userAns['p3'] : array();
    $cP3 = isset($correctAns['p3']) ? $correctAns['p3'] : array();
    for ($i = 1; $i <= $p3_count; $i++) {
        $uA = isset($uP3[$i]) ? trim(strtolower($uP3[$i])) : '';
        $cA = isset($cP3[$i]) ? trim(strtolower($cP3[$i])) : '';
        if ($uA !== '' && $cA !== '' && $uA === $cA) { $p3c++; }
    }
    $total = ($p1c * 0.25) + $p2p + ($p3c * 0.5);
    return number_format($total, 2, '.', '');
}

// API XỬ LÝ
if (isset($_GET['action'])) {
    $action = $_GET['action'];

    if ($action === 'auth_check') {
        ob_clean(); header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('loggedIn' => (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true)));
        exit;
    }

    if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $u = isset($input['username']) ? $input['username'] : '';
        $p = isset($input['password']) ? $input['password'] : '';

        if ($u === $ADMIN_USER && $p === $ADMIN_PASS) {
            $_SESSION['admin_logged_in'] = true;
            ob_clean(); header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('success' => true));
        } else {
            ob_clean(); header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('success' => false, 'message' => 'Tài khoản hoặc mật khẩu không chính xác!'));
        }
        exit;
    }

    if ($action === 'logout') {
        session_destroy();
        ob_clean(); header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('success' => true));
        exit;
    }

    if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
        ob_clean(); header('HTTP/1.1 401 Unauthorized'); header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('error' => 'Unauthorized access'));
        exit;
    }

    if ($action === 'server_check') {
        ob_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('upload_max' => ini_get('upload_max_filesize'), 'writable' => is_writable($uploadDir)));
        exit;
    }

    if ($action === 'list') {
        ob_clean();
        header('Content-Type: application/json; charset=utf-8');
        $content = @file_get_contents($dataFile);
        echo json_encode(json_decode($content, true) ? : array());
        exit;
    }

    if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            ob_clean(); header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('success' => false, 'error' => "Lỗi upload.")); exit;
        }
        $file = $_FILES['file'];
        $config = json_decode($_POST['config'], true);
        $category = isset($_POST['category']) ? $_POST['category'] : 'khac'; // Lấy danh mục
        
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $id = time() . '_' . bin2hex(openssl_random_pseudo_bytes(2));
        $fileName = $id . '.' . $ext;
        $targetPath = $uploadDir . $fileName;
        $webPath = $uploadFolderName . '/' . $fileName;

        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            $exams = json_decode(@file_get_contents($dataFile), true) ? : array();
            $newExam = array(
                'id' => (string)$id, 'title' => $_POST['title'], 'type' => ($ext === 'pdf') ? 'pdf' : 'docx',
                'category' => $category, // Lưu danh mục
                'filePath' => $webPath, 'config' => $config, 'visible' => true,
                'correctAnswers' => array('p1' => (object)array(), 'p2' => (object)array(), 'p3' => (object)array()),
                'duration' => 90, 'createdAt' => date('d/m/Y H:i')
            );
            $exams[] = $newExam;
            file_put_contents($dataFile, json_encode($exams));
            ob_clean(); header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('success' => true, 'exam' => $newExam));
        }
        exit;
    }

    if ($action === 'edit' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $examId = $_POST['id'];
        $newTitle = $_POST['title'];
        $newCategory = isset($_POST['category']) ? $_POST['category'] : 'khac';
        $exams = json_decode(@file_get_contents($dataFile), true) ? : array();
        
        $updated = false;
        foreach ($exams as &$e) {
            if ((string)$e['id'] === (string)$examId) {
                $e['title'] = $newTitle;
                $e['category'] = $newCategory; // Cập nhật danh mục
                
                if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
                    $file = $_FILES['file'];
                    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
                    $newFileName = time() . '_' . bin2hex(openssl_random_pseudo_bytes(2)) . '.' . $ext;
                    $targetPath = $uploadDir . $newFileName;
                    $webPath = $uploadFolderName . '/' . $newFileName;

                    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                        $oldFilePath = __DIR__ . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $e['filePath']);
                        @unlink($oldFilePath);
                        $e['filePath'] = $webPath;
                        $e['type'] = ($ext === 'pdf') ? 'pdf' : 'docx';
                    }
                }
                $updated = true;
                break;
            }
        }
        
        if ($updated) {
            file_put_contents($dataFile, json_encode($exams));
            ob_clean(); header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('success' => true));
        } else {
            ob_clean(); header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('success' => false, 'error' => 'Không tìm thấy đề thi'));
        }
        exit;
    }

    if ($action === 'saveAnswers' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if ($input) {
            $examId = (string)$input['examId']; $newAnswers = $input['answers'];
            $exams = json_decode(@file_get_contents($dataFile), true) ? : array();
            $targetConfig = array();
            foreach ($exams as &$e) { if ((string)$e['id'] === $examId) { $e['correctAnswers'] = $newAnswers; $targetConfig = $e['config']; break; } }
            file_put_contents($dataFile, json_encode($exams));

            $history = json_decode(@file_get_contents($historyFile), true) ? : array();
            $updatedCount = 0;
            foreach ($history as &$attempt) {
                if ((string)$attempt['examId'] === $examId && isset($attempt['userAnswers'])) {
                    $attempt['score'] = calculateScoreBackend($attempt['userAnswers'], $newAnswers, $targetConfig);
                    $updatedCount++;
                }
            }
            file_put_contents($historyFile, json_encode($history));
            ob_clean(); header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('success' => true, 'updatedCount' => $updatedCount));
        }
        exit;
    }

    if ($action === 'get_history' && isset($_GET['examId'])) {
        ob_clean(); header('Content-Type: application/json; charset=utf-8');
        $history = json_decode(@file_get_contents($historyFile), true) ? : array();
        $filtered = array(); $eid = (string)$_GET['examId'];
        foreach ($history as $h) { if ((string)$h['examId'] === $eid) $filtered[] = $h; }
        echo json_encode($filtered); exit;
    }

    if ($action === 'delete_attempt' && isset($_GET['examId']) && isset($_GET['startTime'])) {
        $history = json_decode(@file_get_contents($historyFile), true) ? : array();
        $newHistory = array();
        $eid = (string)$_GET['examId'];
        $stime = (string)$_GET['startTime'];
        $deleted = false;
        foreach ($history as $h) {
            if ((string)$h['examId'] === $eid && (string)$h['startTime'] === $stime && !$deleted) {
                $deleted = true; 
                continue;
            }
            $newHistory[] = $h;
        }
        file_put_contents($historyFile, json_encode($newHistory));
        ob_clean(); header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('success' => true)); exit;
    }

    if ($action === 'delete_history_bulk' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['items']) && is_array($input['items'])) {
            $history = json_decode(@file_get_contents($historyFile), true) ? : array();
            $newHistory = array();
            foreach ($history as $h) {
                $shouldDelete = false;
                foreach ($input['items'] as $item) {
                    if ((string)$h['examId'] === (string)$item['examId'] && (string)$h['startTime'] === (string)$item['startTime']) {
                        $shouldDelete = true; break;
                    }
                }
                if (!$shouldDelete) { $newHistory[] = $h; }
            }
            file_put_contents($historyFile, json_encode($newHistory));
            ob_clean(); header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('success' => true));
        }
        exit;
    }

    if ($action === 'toggle_visibility' && isset($_GET['id'])) {
        $exams = json_decode(@file_get_contents($dataFile), true) ? : array();
        $tid = (string)$_GET['id'];
        foreach ($exams as &$e) { if ((string)$e['id'] === $tid) { $e['visible'] = (isset($e['visible']) && $e['visible']) ? false : true; break; } }
        file_put_contents($dataFile, json_encode($exams));
        ob_clean(); header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('success' => true)); exit;
    }

    if ($action === 'delete' && isset($_GET['id'])) {
        $exams = json_decode(@file_get_contents($dataFile), true) ? : array();
        $newExams = array(); $did = (string)$_GET['id'];
        foreach ($exams as $e) {
            if ((string)$e['id'] === $did) { @unlink(__DIR__ . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $e['filePath'])); }
            else { $newExams[] = $e; }
        }
        file_put_contents($dataFile, json_encode($newExams));
        ob_clean(); header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('success' => true)); exit;
    }

    if ($action === 'delete_exams_bulk' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['ids']) && is_array($input['ids'])) {
            $exams = json_decode(@file_get_contents($dataFile), true) ? : array();
            $newExams = array();
            $idsToDelete = $input['ids'];
            foreach ($exams as $e) {
                if (in_array((string)$e['id'], $idsToDelete)) {
                    @unlink(__DIR__ . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $e['filePath']));
                } else { $newExams[] = $e; }
            }
            file_put_contents($dataFile, json_encode($newExams));
            ob_clean(); header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('success' => true));
        }
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quản trị Hệ thống Ôn tập</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .admin-checkbox { width: 20px; height: 20px; border-radius: 6px; border: 2px solid #cbd5e1; appearance: none; cursor: pointer; transition: all 0.2s; position: relative; }
        .admin-checkbox:checked { background-color: #3b82f6; border-color: #3b82f6; }
        .admin-checkbox:checked::after { content: '✔'; color: white; position: absolute; font-size: 12px; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel">
        const { useState, useEffect, memo, useCallback, useMemo } = React;
        
        // ĐỊNH NGHĨA DANH MỤC
        const CATEGORIES = {
            'chinh_thuc': 'Đề thi chính thức',
            'thi_thu': 'Đề thi thử chọn lọc',
            'truong_sgd': 'Đề các trường & SGD',
            'khac': 'Chủ đề khác'
        };

        const Icon = memo(({ name, size = 20, className = "" }) => {
            const spanRef = React.useRef(null);
            useEffect(() => {
                if (spanRef.current && window.lucide) {
                    spanRef.current.innerHTML = `<i data-lucide="${name}"></i>`;
                    window.lucide.createIcons({ root: spanRef.current, attrs: { width: size, height: size } });
                }
            }, [name, size]);
            return <span ref={spanRef} className={`inline-flex items-center justify-center shrink-0 ${className}`}></span>;
        });

        const calculateAttemptScore = (userAns, correctAns, config) => {
            const details = { p1: {}, p2: {}, p3: {} };
            const uAns = userAns || {}; const cAns = correctAns || {}; const conf = config || { p1: 0, p2: 0, p3: 0 };
            let p1c = 0; for (let i = 1; i <= conf.p1; i++) { const isC = uAns.p1 && uAns.p1[i] && cAns.p1 && uAns.p1[i] === cAns.p1[i]; if (isC) p1c++; details.p1[i] = isC; }
            let p2p = 0; for (let i = 1; i <= conf.p2; i++) {
                let subC = 0; const uS = (uAns.p2 && uAns.p2[i]) ? uAns.p2[i] : {}; const cS = (cAns.p2 && cAns.p2[i]) ? cAns.p2[i] : {}; const subD = {};
                ['a','b','c','d'].forEach(s => { const isC = uS[s] !== undefined && cS[s] !== undefined && uS[s] === cS[s]; if (isC) subC++; subD[s] = isC; });
                if (subC === 1) p2p += 0.1; else if (subC === 2) p2p += 0.25; else if (subC === 3) p2p += 0.5; else if (subC === 4) p2p += 1.0;
                details.p2[i] = subD;
            }
            let p3c = 0; for (let i = 1; i <= conf.p3; i++) {
                const uA = (uAns.p3 && uAns.p3[i] ? uAns.p3[i] : '').toString().trim().toLowerCase();
                const cA = (cAns.p3 && cAns.p3[i] ? cAns.p3[i] : '').toString().trim().toLowerCase();
                const isC = uA !== '' && cA !== '' && uA === cA; if (isC) p3c++; details.p3[i] = isC;
            }
            return { total: ((p1c * 0.25) + p2p + (p3c * 0.5)).toFixed(2), p1c, p2p: p2p.toFixed(2), p3c, details };
        };

        const DetailView = ({ attempt, exam, onBack }) => {
            const scoreData = useMemo(() => calculateAttemptScore(attempt.userAnswers, exam.correctAnswers, exam.config), [attempt, exam]);
            return (
                <div className="h-full flex flex-col bg-slate-50 overflow-hidden animate-in fade-in">
                    <header className="bg-slate-800 p-6 text-white flex justify-between items-center shadow-xl shrink-0">
                         <div className="flex items-center gap-4"><button onClick={onBack} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl"><Icon name="chevron-left" /></button>
                            <div><h2 className="text-xl font-black uppercase">{attempt.name}</h2><p className="text-[10px] opacity-60 uppercase">{attempt.class} • {attempt.school}</p></div></div>
                         <div className="text-center px-6 py-2 bg-white/10 rounded-2xl border border-white/10"><p className="text-[10px] uppercase opacity-70">Điểm</p><p className="text-3xl font-black text-emerald-400">{attempt.score}</p></div>
                    </header>
                    <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="max-w-5xl mx-auto space-y-10 pb-20">
                            {attempt.tabSwitches > 0 && (
                                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center gap-3">
                                    <Icon name="alert-triangle" />
                                    <div><p className="font-bold">Cảnh báo gian lận</p><p className="text-xs">Học sinh này đã chuyển tab hoặc thoát khỏi màn hình làm bài <b>{attempt.tabSwitches} lần</b>.</p></div>
                                </div>
                            )}
                            <section><h3 className="text-sm font-black text-slate-400 uppercase mb-6 tracking-widest">Phần I: Trắc nghiệm ({scoreData.p1c} câu đúng)</h3><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {Array.from({length: exam.config.p1}, (_, i) => i + 1).map(n => (<div key={n} className={`bg-white p-3 rounded-2xl border-2 flex flex-col items-center gap-1 ${scoreData.details.p1[n] ? 'border-emerald-400' : 'border-red-400'}`}><span className="text-[9px] font-black text-slate-300">CÂU {n}</span><span className={`text-lg font-black ${scoreData.details.p1[n] ? 'text-emerald-600' : 'text-red-600'}`}>{attempt.userAnswers.p1[n] || '—'}</span>{!scoreData.details.p1[n] && <span className="text-[8px] font-bold text-slate-400">Đúng: {exam.correctAnswers?.p1?.[n] || '?'}</span>}</div>))}
                            </div></section>
                            <section><h3 className="text-sm font-black text-slate-400 uppercase mb-6 tracking-widest">Phần II: Đúng / Sai ({scoreData.p2p} điểm)</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Array.from({length: exam.config.p2}, (_, i) => i + 1).map(n => (<div key={n} className="bg-white p-5 rounded-3xl border border-slate-100"><p className="font-black text-slate-400 text-[10px] mb-4 uppercase italic">Câu {n}</p><div className="space-y-2">
                                    {['a','b','c','d'].map(s => { const isC = scoreData.details.p2[n][s]; const uV = attempt.userAnswers.p2?.[n]?.[s]; const cV = exam.correctAnswers?.p2?.[n]?.[s];
                                        return (<div key={s} className={`flex justify-between items-center px-4 py-2 rounded-xl text-[10px] font-bold ${isC ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}><span>{s}) {uV === true ? 'ĐÚNG' : (uV === false ? 'SAI' : '—')}</span>{!isC && <span>Đáp án: {cV === true ? 'Đúng' : 'Sai'}</span>}</div>); })}
                                </div></div>))}
                            </div></section>
                            <section><h3 className="text-sm font-black text-slate-400 uppercase mb-6 tracking-widest">Phần III: Trả lời ngắn ({scoreData.p3c} câu đúng)</h3><div className="space-y-3">
                                {Array.from({length: exam.config.p3}, (_, i) => i + 1).map(n => (<div key={n} className={`bg-white p-4 rounded-2xl border-2 flex items-center justify-between ${scoreData.details.p3[n] ? 'border-emerald-400' : 'border-red-400'}`}><div className="flex items-center gap-4"><span className="text-[10px] font-black text-slate-300 italic">C{n}</span><span className={`font-black ${scoreData.details.p3[n] ? 'text-emerald-600' : 'text-red-600'}`}>{attempt.userAnswers.p3[n] || '(Trống)'}</span></div>{!scoreData.details.p3[n] && <div className="text-right"><p className="text-[8px] font-bold text-slate-400">ĐÁP ÁN: <span className="text-blue-600 ml-1">{exam.correctAnswers?.p3?.[n] || '?'}</span></p></div>}</div>))}
                            </div></section>
                        </div>
                    </main>
                </div>
            );
        };

        const formatDateTime = (ts) => {
            if (!ts) return '---'; const d = new Date(parseInt(ts)); if (isNaN(d.getTime())) return '---';
            return d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit', second:'2-digit'}) + ' ' + d.toLocaleDateString('vi-VN');
        };

        const formatDuration = (start, end) => {
            if (!start || !end) return '---';
            const diff = Math.max(0, parseInt(end) - parseInt(start));
            const s = Math.floor(diff / 1000); const m = Math.floor(s / 60); const sec = s % 60;
            return `${m} phút ${sec} giây`;
        };

        const HistoryModal = ({ exam, onClose }) => {
            const [history, setHistory] = useState([]); const [loading, setLoading] = useState(true); const [viewing, setViewing] = useState(null); const [tab, setTab] = useState('list');
            const [selectedAttempts, setSelectedAttempts] = useState([]);

            const loadHistory = useCallback(() => {
                setLoading(true); setSelectedAttempts([]);
                fetch('admin.php?action=get_history&examId=' + exam.id + '&t=' + Date.now())
                    .then(r => r.json()).then(d => { setHistory(Array.isArray(d) ? d : []); setLoading(false); });
            }, [exam.id]);
            useEffect(() => { loadHistory(); }, [loadHistory]);

            const handleDeleteAttempt = async (attempt) => {
                if (!confirm(`Bạn có chắc chắn muốn xóa kết quả của học sinh ${attempt.name}?`)) return;
                try {
                    const r = await fetch(`admin.php?action=delete_attempt&examId=${exam.id}&startTime=${attempt.startTime}`);
                    const res = await r.json(); if (res.success) { loadHistory(); } else { alert("Lỗi khi xóa!"); }
                } catch (e) { alert("Lỗi kết nối!"); }
            };

            const handleBulkDelete = async () => {
                if (selectedAttempts.length === 0) return;
                if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedAttempts.length} kết quả bài làm đã chọn?`)) return;
                try {
                    const payload = { items: selectedAttempts.map(h => ({ examId: h.examId, startTime: h.startTime })) };
                    const r = await fetch('admin.php?action=delete_history_bulk', { method: 'POST', body: JSON.stringify(payload) });
                    const res = await r.json(); if (res.success) { loadHistory(); } else { alert("Lỗi khi xóa!"); }
                } catch (e) { alert("Lỗi kết nối!"); }
            };

            const exportToExcel = () => {
                if (!history || history.length === 0) { alert("Không có dữ liệu để xuất!"); return; }
                let csvContent = "\uFEFFSTT,Họ và tên,Lớp,Trường,Trạng thái,Bắt đầu,Nộp bài,Thời gian làm,Điểm\n";
                history.forEach((h, idx) => {
                    const name = `"${(h.name || '').replace(/"/g, '""')}"`; const className = `"${(h.class || '').replace(/"/g, '""')}"`;
                    const school = `"${(h.school || '').replace(/"/g, '""')}"`; const status = h.tabSwitches > 0 ? `"Chuyển tab ${h.tabSwitches} lần"` : `"Hợp lệ"`;
                    const startTimeStr = `"${formatDateTime(h.startTime)}"`; const endTimeStr = `"${formatDateTime(h.endTime)}"`;
                    const durationStr = `"${formatDuration(h.startTime, h.endTime)}"`; const score = `"${h.score || 0}"`;
                    csvContent += `${idx + 1},${name},${className},${school},${status},${startTimeStr},${endTimeStr},${durationStr},${score}\n`;
                });
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
                link.download = `ket_qua_${exam.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.csv`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
            };

            const stats = useMemo(() => {
                if (!history || history.length === 0) return null; const p1 = {}; const p2 = {}; const p3 = {};
                history.forEach(h => { const sd = calculateAttemptScore(h.userAnswers, exam.correctAnswers, exam.config);
                    for (let i=1; i<=exam.config.p1; i++) { if(!p1[i]) p1[i]=0; if(sd.details.p1[i]) p1[i]++; }
                    for (let i=1; i<=exam.config.p2; i++) { if(!p2[i]) p2[i]=0; let allC = true; ['a','b','c','d'].forEach(s => { if(!sd.details.p2[i][s]) allC = false; }); if(allC) p2[i]++; }
                    for (let i=1; i<=exam.config.p3; i++) { if(!p3[i]) p3[i]=0; if(sd.details.p3[i]) p3[i]++; }
                }); return { p1, p2, p3 };
            }, [history, exam]);

            const toggleSelectAll = () => { if (selectedAttempts.length === history.length) setSelectedAttempts([]); else setSelectedAttempts([...history]); };
            const toggleSelect = (h) => { const idx = selectedAttempts.findIndex(s => s.startTime === h.startTime); if (idx >= 0) { const newSel = [...selectedAttempts]; newSel.splice(idx, 1); setSelectedAttempts(newSel); } else { setSelectedAttempts([...selectedAttempts, h]); } };

            if (viewing) return <DetailView attempt={viewing} exam={exam} onBack={() => setViewing(null)} />;
            return (
                <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in">
                        <div className="p-8 border-b flex justify-between bg-slate-50"><div><h2 className="text-2xl font-black text-slate-800 uppercase leading-none">Kết quả ôn tập</h2><p className="text-slate-500 text-sm mt-2 italic">{exam.title}</p></div><button onClick={onClose} className="p-3 hover:bg-white rounded-full transition-all"><Icon name="x" size={24} /></button></div>
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
                                        <thead><tr className="border-b text-[10px] font-black text-slate-400 uppercase"><th className="pb-4 px-2 w-10"><input type="checkbox" className="admin-checkbox" checked={selectedAttempts.length === history.length && history.length > 0} onChange={toggleSelectAll} /></th><th className="pb-4 px-2">Học sinh</th><th className="pb-4 px-2 text-center">Thời gian</th><th className="pb-4 px-2 text-center">Trạng thái</th><th className="pb-4 px-2 text-center">Điểm</th><th className="pb-4 px-2 text-right">Thao tác</th></tr></thead>
                                        <tbody className="divide-y">{history.map((h, i) => (
                                            <tr key={i} className={`transition-colors ${selectedAttempts.find(s => s.startTime === h.startTime) ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                                                <td className="py-4 px-2"><input type="checkbox" className="admin-checkbox" checked={!!selectedAttempts.find(s => s.startTime === h.startTime)} onChange={() => toggleSelect(h)} /></td>
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

        const AnswerConfig = ({ exam, onSave, onClose }) => {
            const [localAns, setLocalAns] = useState(() => { const ans = exam.correctAnswers || {}; return { p1: ans.p1 || {}, p2: ans.p2 || {}, p3: ans.p3 || {} }; });
            const setP1 = (n, c) => setLocalAns(prev => { const p1 = {...prev.p1}; p1[n] = c; return { ...prev, p1: p1 }; });
            const setP2 = (n, s, v) => setLocalAns(prev => { const p2 = {...prev.p2}; if (!p2[n]) p2[n] = {}; p2[n][s] = v; return { ...prev, p2: p2 }; });
            const setP3 = (n, v) => setLocalAns(prev => { const p3 = {...prev.p3}; p3[n] = v; return { ...prev, p3: p3 }; });
            return (
                <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-8 border-b flex justify-between bg-slate-50"><div><h2 className="text-2xl font-black text-slate-800 uppercase leading-none">Cấu hình Đáp án chuẩn</h2><p className="text-slate-500 text-sm mt-2 italic tracking-tight font-medium">Đề: {exam.title}</p></div><button onClick={onClose} className="p-3 hover:bg-white rounded-full transition-all"><Icon name="x" size={24} /></button></div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
                            <div><h4 className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase mb-6 inline-block tracking-[0.2em] shadow-lg">Phần I</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({length: exam.config.p1}, (_, i) => i + 1).map(num => (<div key={num} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 shadow-sm"><span className="w-8 font-black text-slate-400 text-[10px]">C{num}</span><div className="flex gap-1">{['A', 'B', 'C', 'D'].map(c => (<button key={c} onClick={() => setP1(num, c)} className={`w-7 h-7 rounded-full text-[10px] font-black border-2 transition-all ${localAns.p1[num] === c ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>{c}</button>))}</div></div>))}</div></div>
                            <div><h4 className="bg-purple-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase mb-6 inline-block tracking-[0.2em] shadow-lg">Phần II</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{Array.from({length: exam.config.p2}, (_, i) => i + 1).map(num => (<div key={num} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm"><p className="font-black text-slate-400 text-[10px] mb-3 uppercase tracking-tighter italic">Câu {num}</p>{['a', 'b', 'c', 'd'].map(sub => (<div key={sub} className="flex items-center justify-between mb-2 last:mb-0"><span className="font-bold text-slate-500 text-xs uppercase">{sub})</span><div className="flex gap-1"><button onClick={() => setP2(num, sub, true)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black border-2 transition-all ${localAns.p2[num] && localAns.p2[num][sub] === true ? 'bg-emerald-50 border-emerald-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}>ĐÚNG</button><button onClick={() => setP2(num, sub, false)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black border-2 transition-all ${localAns.p2[num] && localAns.p2[num][sub] === false ? 'bg-red-50 border-red-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400'}`}>SAI</button></div></div>))}</div>))}</div></div>
                            <div><h4 className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase mb-6 inline-block tracking-[0.2em] shadow-lg">Phần III</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({length: exam.config.p3}, (_, i) => i + 1).map(num => (<div key={num} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm"><span className="font-black text-slate-400 text-[10px] w-10 text-center italic">C{num}</span><input type="text" value={localAns.p3[num] || ''} onChange={(e) => setP3(num, e.target.value)} className="flex-1 bg-white border-2 border-slate-100 rounded-xl p-3 font-bold text-orange-600 outline-none focus:border-orange-500 transition-all shadow-inner" placeholder="Đáp số..." /></div>))}</div></div>
                        </div>
                        <div className="p-8 border-t bg-slate-50 flex justify-end gap-4"><button onClick={onClose} className="px-8 py-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all">HUỶ BỎ</button><button onClick={() => onSave(localAns)} className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest text-[11px]">LƯU ĐÁP ÁN</button></div>
                    </div>
                </div>
            );
        };

        const EditExamModal = ({ exam, onSave, onClose }) => {
            const [title, setTitle] = useState(exam.title);
            const [category, setCategory] = useState(exam.category || 'khac');
            const [file, setFile] = useState(null);
            const [isSaving, setIsSaving] = useState(false);

            const handleSave = async () => {
                if (!title.trim()) return alert("Tên đề thi không được để trống!");
                setIsSaving(true);
                const fd = new FormData();
                fd.append('id', exam.id);
                fd.append('title', title);
                fd.append('category', category); // Thêm category vào FormData
                if (file) fd.append('file', file);

                try {
                    const r = await fetch('admin.php?action=edit', { method: 'POST', body: fd });
                    const res = await r.json();
                    if (res.success) { onSave(); } else { alert(res.error || "Lỗi khi lưu!"); }
                } catch (e) { alert("Lỗi kết nối Server!"); } finally { setIsSaving(false); }
            };

            return (
                <div className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Sửa Đề Thi</h2></div>
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
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">File đề thi mới (Tùy chọn)</label>
                                <input type="file" accept=".pdf,.docx" onChange={e => setFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 transition-all cursor-pointer bg-slate-50 rounded-2xl border-2 border-slate-100 p-2" />
                                <p className="text-[9px] font-bold text-slate-400 mt-2 italic">* Bỏ trống nếu chỉ muốn đổi tên/danh mục.</p>
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

        const LoginScreen = ({ onLogin }) => {
            const [u, setU] = useState(''); const [p, setP] = useState(''); const [loading, setLoading] = useState(false);
            const submit = async (e) => { e.preventDefault(); setLoading(true); await onLogin(u, p); setLoading(false); };
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
                    <form onSubmit={submit} className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-sm w-full relative overflow-hidden animate-in zoom-in duration-300">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm"><Icon name="shield" size={32} /></div>
                        <h2 className="text-2xl font-black text-center mb-2 uppercase tracking-tighter text-slate-800">Đăng nhập</h2>
                        <p className="text-center text-slate-400 text-xs font-bold mb-8 uppercase tracking-widest">Hệ thống Quản trị</p>
                        <div className="space-y-4">
                            <input type="text" placeholder="Tên tài khoản" value={u} onChange={e=>setU(e.target.value)} required className="w-full p-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-sm bg-slate-50 focus:bg-white transition-all text-center shadow-inner" />
                            <input type="password" placeholder="Mật khẩu" value={p} onChange={e=>setP(e.target.value)} required className="w-full p-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-sm bg-slate-50 focus:bg-white transition-all text-center shadow-inner" />
                        </div>
                        <button type="submit" disabled={loading} className={`w-full mt-8 py-4 rounded-xl font-black text-[14px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${loading ? 'bg-slate-300 text-slate-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                            {loading ? <Icon name="loader" className="animate-spin" size={18} /> : <Icon name="log-in" size={18} />} {loading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP'}
                        </button>
                    </form>
                </div>
            );
        };

        const App = () => {
            const [exams, setExams] = useState([]); const [isUploading, setIsUploading] = useState(false); const [config, setConfig] = useState({ p1: 12, p2: 4, p3: 6 });
            const [uploadCategory, setUploadCategory] = useState('chinh_thuc'); // Thêm state danh mục khi upload
            const [editingAnsId, setEditingAnsId] = useState(null); const [showHistoryExam, setShowHistoryExam] = useState(null);
            const [editingExam, setEditingExam] = useState(null);
            const [selectedExams, setSelectedExams] = useState([]);
            const [isLoggedIn, setIsLoggedIn] = useState(false);
            const [authChecking, setAuthChecking] = useState(true);

            useEffect(() => {
                fetch('admin.php?action=auth_check&t=' + Date.now()).then(r => r.json()).then(d => {
                    setIsLoggedIn(d.loggedIn); setAuthChecking(false); if (d.loggedIn) loadData();
                }).catch(() => setAuthChecking(false));
            }, []);

            const loadData = useCallback(() => { 
                fetch('admin.php?action=list&t=' + Date.now()).then(r => r.json()).then(d => {
                    if (d.error) { setIsLoggedIn(false); return; }
                    setExams(Array.isArray(d) ? d : []); setSelectedExams([]);
                }).catch(e => console.error(e)); 
            }, []);

            const handleLogin = async (username, password) => {
                try {
                    const r = await fetch('admin.php?action=login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
                    const d = await r.json(); if (d.success) { setIsLoggedIn(true); loadData(); } else { alert(d.message); }
                } catch (e) { alert("Lỗi kết nối Server!"); }
            };

            const handleLogout = async () => {
                if(!confirm("Bạn có chắc chắn muốn đăng xuất?")) return;
                try { await fetch('admin.php?action=logout'); setIsLoggedIn(false); setExams([]); } catch(e) {}
            };

            const handleBulkDeleteExams = async () => {
                if (selectedExams.length === 0) return;
                if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedExams.length} đề thi đã chọn cùng với dữ liệu đi kèm không?`)) return;
                try {
                    const r = await fetch('admin.php?action=delete_exams_bulk', { method: 'POST', body: JSON.stringify({ ids: selectedExams }) });
                    const res = await r.json(); if (res.success) { loadData(); } else { alert("Có lỗi xảy ra khi xóa!"); }
                } catch (e) { alert("Lỗi kết nối Server!"); }
            };

            const toggleSelectAllExams = () => { if (selectedExams.length === exams.length) setSelectedExams([]); else setSelectedExams(exams.map(e => e.id)); };
            const toggleSelectExam = (id) => { if (selectedExams.includes(id)) setSelectedExams(selectedExams.filter(item => item !== id)); else setSelectedExams([...selectedExams, id]); };

            if (authChecking) return (<div className="h-screen bg-slate-50 flex items-center justify-center flex-col gap-4"><Icon name="loader" className="animate-spin text-blue-500" size={40} /><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Đang kiểm tra bảo mật...</p></div>);
            if (!isLoggedIn) return <LoginScreen onLogin={handleLogin} />;

            return (
                <div className="relative h-screen bg-slate-50 flex flex-col animate-in fade-in duration-700">
                    <header className="p-8 flex justify-between items-center border-b bg-white shrink-0 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Hệ thống Quản trị</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                                    <span>PHP 5.6</span> • <a href="index.php" className="text-blue-500 underline flex items-center gap-1" target="_blank"><Icon name="external-link" size={10}/> Mở trang Học sinh</a>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {selectedExams.length > 0 && (<button onClick={handleBulkDeleteExams} className="px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-2"><Icon name="trash-2" size={16} /> XÓA {selectedExams.length} ĐỀ</button>)}
                            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-3xl border border-slate-200">
                                 <div className="flex gap-4 border-r border-slate-200 pr-4">
                                    <div className="text-center"><span className="text-[10px] font-bold text-slate-400 block uppercase">P.I</span><input type="number" value={config.p1} onChange={e => setConfig({...config, p1: parseInt(e.target.value)||0})} className="w-8 font-black text-blue-600 outline-none bg-transparent" /></div>
                                    <div className="text-center border-l border-slate-200 pl-4"><span className="text-[10px] font-bold text-slate-400 block uppercase">P.II</span><input type="number" value={config.p2} onChange={e => setConfig({...config, p2: parseInt(e.target.value)||0})} className="w-8 font-black text-purple-600 outline-none bg-transparent" /></div>
                                    <div className="text-center border-l border-slate-200 pl-4"><span className="text-[10px] font-bold text-slate-400 block uppercase">P.III</span><input type="number" value={config.p3} onChange={e => setConfig({...config, p3: parseInt(e.target.value)||0})} className="w-8 font-black text-orange-600 outline-none bg-transparent" /></div>
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
                                    <input type="file" className="hidden" accept=".docx,.pdf" onChange={async (e) => {
                                        const file = e.target.files[0]; if (!file) return; setIsUploading(true); 
                                        const fd = new FormData(); fd.append('file', file); fd.append('title', file.name.replace(/\.(pdf|docx)$/i, '')); fd.append('config', JSON.stringify(config)); fd.append('category', uploadCategory); // Thêm category
                                        try { const r = await fetch('admin.php?action=upload', { method: 'POST', body: fd }); const res = await r.json(); if (res.success) { loadData(); alert("Thành công!"); } else { alert(res.error); } } 
                                        catch (err) { alert("Lỗi Server!"); } finally { setIsUploading(false); e.target.value = ""; }
                                    }} disabled={isUploading} />
                                </label>
                            </div>
                            <button onClick={handleLogout} className="flex items-center justify-center w-12 h-12 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Icon name="log-out" size={20} /></button>
                        </div>
                    </header>
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="max-w-5xl mx-auto pb-20">
                            {exams.length > 0 && (
                                <div className="mb-4 ml-4 flex items-center gap-3"><input type="checkbox" className="admin-checkbox" checked={selectedExams.length === exams.length} onChange={toggleSelectAllExams} /> <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chọn tất cả</span></div>
                            )}
                            <div className="grid gap-6">
                                {exams.map(e => (
                                    <div key={e.id} className={`bg-white p-6 rounded-[2.5rem] border flex flex-col md:flex-row items-start md:items-center justify-between gap-5 group hover:shadow-lg transition-all ${e.visible !== false ? 'border-slate-100' : 'border-dashed border-slate-300 opacity-60'} ${selectedExams.includes(e.id) ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}`}>
                                        <div className="flex items-center gap-5 flex-1 min-w-0">
                                            <input type="checkbox" className="admin-checkbox ml-2 shrink-0" checked={selectedExams.includes(e.id)} onChange={() => toggleSelectExam(e.id)} />
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
                                            <button onClick={async () => { try { await fetch('admin.php?action=toggle_visibility&id='+e.id); loadData(); } catch (e) { alert("Lỗi!"); } }} className={`p-3 rounded-2xl transition-all flex-shrink-0 ${e.visible !== false ? 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-50'}`}><Icon name={e.visible !== false ? "eye" : "eye-off"} size={20} /></button>
                                            <button onClick={() => setEditingAnsId(e.id)} className="bg-slate-100 text-slate-600 px-5 py-3 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest flex-shrink-0"><Icon name="key" size={16} /></button>
                                            <button onClick={async () => { if(confirm('Xoá đề?')) { await fetch('admin.php?action=delete&id='+e.id); loadData(); } }} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all flex-shrink-0"><Icon name="trash-2" size={20}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {editingAnsId && <AnswerConfig exam={exams.find(e => String(e.id) === String(editingAnsId))} onSave={async (ans) => {
                        try {
                            const r = await fetch('admin.php?action=saveAnswers', { method: 'POST', body: JSON.stringify({ examId: editingAnsId, answers: ans }) });
                            const res = await r.json(); if (res.success) { loadData(); setEditingAnsId(null); alert("Đã lưu đáp án và chấm lại cho " + res.updatedCount + " bài thi!"); }
                        } catch (e) { alert("Lỗi!"); }
                    }} onClose={() => setEditingAnsId(null)} />}
                    {showHistoryExam && <HistoryModal exam={showHistoryExam} onClose={() => setShowHistoryExam(null)} />}
                    {editingExam && <EditExamModal exam={editingExam} onSave={() => { loadData(); setEditingExam(null); }} onClose={() => setEditingExam(null)} />}
                </div>
            );
        };
        const root = ReactDOM.createRoot(document.getElementById('root')); root.render(<App />);
    </script>
</body>
</html>
