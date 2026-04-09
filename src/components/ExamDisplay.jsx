import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker setup - Using .js for better compatibility with older iOS
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.js`;

const ExamDisplay = ({ type, path }) => {
  const [pdfPages, setPdfPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.5); // Base rendering scale
  const [zoom, setZoom] = useState(1); // Visual zoom factor
  
  const containerRef = useRef(null);
  const touchStartDist = useRef(null);
  const startZoom = useRef(1);

  // Load PDF and render pages
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setPdfPages([]);
    
    if (!path) {
      setLoading(false);
      return;
    }

    if (type === 'pdf') {
      const loadingTask = pdfjsLib.getDocument(path);
      loadingTask.promise.then(async (pdf) => {
        const pagesArray = [];
        // Rendering at a slightly higher scale for clarity when zooming
        const renderScale = scale; 
        
        for (let i = 1; i <= pdf.numPages; i++) {
          if (!isMounted) break;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: renderScale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { alpha: false });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({ canvasContext: context, viewport: viewport }).promise;
          // Using image/jpeg for iOS 14 compatibility (WebP support was spotty in older Safari)
          pagesArray.push(canvas.toDataURL('image/jpeg', 0.8));
          
          // Free memory
          canvas.width = 0;
          canvas.height = 0;
        }
        
        if (isMounted) {
          setPdfPages(pagesArray);
          setLoading(false);
        }
      }).catch(err => {
        console.error("PDF Render Error:", err);
        if (isMounted) {
          setError("Không thể tải tài liệu. Vui lòng kiểm tra kết nối mạng.");
          setLoading(false);
        }
      });
    }

    return () => { isMounted = false; };
  }, [path, type, scale]);

  // Handle Pinch-to-Zoom
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      touchStartDist.current = dist;
      startZoom.current = zoom;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && touchStartDist.current) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const ratio = dist / touchStartDist.current;
      const newZoom = Math.min(Math.max(startZoom.current * ratio, 1), 3);
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
  };

  const resetZoom = () => setZoom(1);
  const zoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.2, 1));

  if (!path) return (
    <div className="flex items-center justify-center p-20 text-slate-400 italic">
      (Chưa đính kèm tài liệu)
    </div>
  );

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden">
      {/* Zoom Controls */}
      <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2">
        <button onClick={zoomIn} className="w-10 h-10 bg-white/90 backdrop-blur shadow-lg rounded-full flex items-center justify-center text-slate-800 font-bold text-xl">+</button>
        <button onClick={zoomOut} className="w-10 h-10 bg-white/90 backdrop-blur shadow-lg rounded-full flex items-center justify-center text-slate-800 font-bold text-xl">-</button>
        {zoom > 1 && (
          <button onClick={resetZoom} className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-full shadow-lg uppercase tracking-tight">Đặt lại</button>
        )}
      </div>

      <div 
        className="exam-view-container flex-1 custom-scrollbar bg-slate-700 overflow-auto touch-none" 
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-800/80 backdrop-blur-sm text-white gap-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="font-bold text-[12px] uppercase tracking-widest italic">Đang hiển thị đề bài...</span>
          </div>
        )}
        
        {error ? (
          <div className="flex flex-col items-center justify-center p-20 text-white gap-4">
             <div className="text-rose-500 font-bold">{error}</div>
             <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-600 rounded-xl text-xs font-bold uppercase">Thử lại</button>
          </div>
        ) : (
          <div 
            className="w-full flex flex-col items-center gap-4 py-8 transition-transform duration-100 ease-out origin-top"
            style={{ 
              transform: `scale(${zoom})`,
              width: zoom > 1 ? `${100 * zoom}%` : '100%'
            }}
          >
            {pdfPages.map((pageData, index) => (
              <div key={index} className="shadow-2xl bg-white leading-[0] max-w-[95%] md:max-w-[800px]">
                <img src={pageData} alt={`Page ${index + 1}`} className="w-full h-auto border-b border-slate-200" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamDisplay;
