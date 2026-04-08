import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const ExamDisplay = ({ type, path }) => {
  const [html, setHtml] = useState('');
  const [pdfPages, setPdfPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setPdfPages([]);
    setHtml('');
    
    if (!path) {
      setLoading(false);
      const msg = '<div style="text-align:center; padding: 40px; color: #94a3b8; font-style: italic;">(Chưa đính kèm file PDF tài liệu)</div>';
      setHtml(msg);
      return;
    }

    if (type === 'pdf') {
      const loadingTask = pdfjsLib.getDocument(path);
      loadingTask.promise.then(async (pdf) => {
        const pagesArray = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport: viewport }).promise;
          pagesArray.push(canvas.toDataURL('image/webp', 0.8));
        }
        setPdfPages(pagesArray);
        setLoading(false);
      }).catch(err => {
        console.error("PDF Render Error:", err);
        setLoading(false);
      });
    }
  }, [path, type]);

  return (
    <div className="exam-view-container custom-scrollbar bg-slate-700" ref={containerRef}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-800 text-white font-bold text-[14px] uppercase italic">
          Đang tải tài liệu PDF...
        </div>
      )}
      <div className="w-full flex flex-col items-center gap-4 py-4">
        {html ? (
          <div className="animate-in fade-in duration-300 flex items-center justify-center w-full min-h-[50vh]" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          pdfPages.map((pageData, index) => (
            <div key={index} className="shadow-2xl bg-white leading-[0] max-w-full">
              <img src={pageData} alt={`Page ${index + 1}`} className="max-w-full h-auto border-b border-slate-200" loading="lazy" />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ExamDisplay;
