import Redis from 'ioredis';

// Initialize Redis using REDIS_URL or KV_URL
const redis = new Redis(process.env.REDIS_URL || process.env.KV_URL);

// Helper to simulate @vercel/kv's JSON handling
const kv = {
  get: async (key) => {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },
  set: async (key, value) => {
    return await redis.set(key, JSON.stringify(value));
  }
};
import { put, del } from '@vercel/blob';

export default async function handler(req, res) {
  const { action, id } = req.query;

  try {
    // 1. LIST EXAMS
    if (action === 'list') {
      const exams = await kv.get('exams_data') || [];
      // Sort by newest first
      return res.status(200).json(exams.sort((a,b) => b.id - a.id));
    }

    // 2. UPLOAD/CREATE EXAM
    if (action === 'upload' && req.method === 'POST') {
      const { title, config, category, fileName, fileData, type } = req.body;
      
      if (!fileData) return res.status(400).json({ error: 'Thiếu dữ liệu file' });

      let finalFilePath = "";
      try {
        // fileData is expected to be a base64 string
        const buffer = Buffer.from(fileData, 'base64');
        
        const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
        if (!blobToken) {
          throw new Error("Lỗi xác thực: BLOB_READ_WRITE_TOKEN bị trống hoặc chưa được Vercel nạp vào phiên bản này. Hãy thử 'Redeploy' lại bản mới nhất.");
        }

        const blob = await put(`exams/${Date.now()}_${fileName}`, buffer, {
          access: 'public',
          token: blobToken
        });
        finalFilePath = blob.url;
      } catch (blobError) {
        console.error("Blob Storage Error:", blobError);
        return res.status(500).json({ error: `Lỗi lưu trữ Blob: ${blobError.message}` });
      }

      try {
        const kvUrl = process.env.KV_URL || process.env.REDIS_URL;
        if (!kvUrl && !process.env.KV_REST_API_URL) {
          throw new Error("Chưa cấu hình KV_URL hoặc REDIS_URL trên Vercel");
        }
        
        const exams = await kv.get('exams_data') || [];
        const newExam = {
          id: Date.now().toString(),
          title: title || fileName.replace(/\.[^/.]+$/, ""),
          category: category || 'khac',
          config: typeof config === 'string' ? JSON.parse(config) : config,
          filePath: finalFilePath,
          type: type || (fileName.endsWith('.pdf') ? 'pdf' : 'docx'),
          createdAt: new Date().toLocaleString('vi-VN'),
          visible: true,
          correctAnswers: { p1: {}, p2: {}, p3: {} },
          explanationPath: "",
          duration: 90
        };
        
        exams.push(newExam);
        await kv.set('exams_data', exams);
        return res.status(200).json({ success: true, exam: newExam });
      } catch (kvError) {
        console.error("KV Database Error:", kvError);
        return res.status(500).json({ error: `Lỗi Database KV: ${kvError.message}` });
      }
    }

    // 3. EDIT EXAM METADATA
    if (action === 'edit' && req.method === 'POST') {
      const { id, title, category, explanationData, explanationFileName } = req.body;
      let exams = await kv.get('exams_data') || [];
      
      let finalExplanationPath = null;
      if (explanationData && explanationFileName) {
        try {
          const buffer = Buffer.from(explanationData, 'base64');
          const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
          const blob = await put(`explanations/${Date.now()}_${explanationFileName}`, buffer, {
            access: 'public',
            token: blobToken
          });
          finalExplanationPath = blob.url;
        } catch (e) {
          console.error("Explanation Blob Error:", e);
        }
      }

      exams = exams.map(e => {
        if (String(e.id) === String(id)) {
          const updated = { ...e, title: title || e.title, category: category || e.category };
          if (finalExplanationPath) {
            // Delete old explanation if exists
            if (e.explanationPath && e.explanationPath.includes('public.blob.vercel-storage.com')) {
              try { del(e.explanationPath); } catch (err) {}
            }
            updated.explanationPath = finalExplanationPath;
          }
          return updated;
        }
        return e;
      });
      await kv.set('exams_data', exams);
      return res.status(200).json({ success: true });
    }

    // 4. SAVE ANSWERS & RE-GRADE
    if (action === 'saveAnswers' && req.method === 'POST') {
      const { examId, answers } = req.body;
      let exams = await kv.get('exams_data') || [];
      exams = exams.map(e => {
        if (String(e.id) === String(examId)) {
          return { ...e, correctAnswers: answers };
        }
        return e;
      });
      await kv.set('exams_data', exams);

      // Re-grade logic could go here if we want to update existing scores in history
      return res.status(200).json({ success: true, updatedCount: 0 });
    }

    // 5. TOGGLE VISIBILITY
    if (action === 'toggle_visibility' && id) {
      let exams = await kv.get('exams_data') || [];
      exams = exams.map(e => {
        if (String(e.id) === String(id)) return { ...e, visible: !e.visible };
        return e;
      });
      await kv.set('exams_data', exams);
      return res.status(200).json({ success: true });
    }

    // 6. DELETE EXAM (Single)
    if (action === 'delete' && id) {
      let exams = await kv.get('exams_data') || [];
      const examToDelete = exams.find(e => String(e.id) === String(id));
      if (examToDelete) {
        if (examToDelete.filePath && examToDelete.filePath.includes('public.blob.vercel-storage.com')) {
          try { await del(examToDelete.filePath); } catch (e) { console.error("Blob delete error:", e); }
        }
        if (examToDelete.explanationPath && examToDelete.explanationPath.includes('public.blob.vercel-storage.com')) {
          try { await del(examToDelete.explanationPath); } catch (e) { console.error("Explanation blob delete error:", e); }
        }
      }
      exams = exams.filter(e => String(e.id) !== String(id));
      await kv.set('exams_data', exams);
      return res.status(200).json({ success: true });
    }

    // 7. BULK DELETE EXAMS
    if (action === 'delete_exams_bulk' && req.method === 'POST') {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ error: 'Invalid IDs' });
      
      let exams = await kv.get('exams_data') || [];
      const toDelete = exams.filter(e => ids.includes(String(e.id)));
      
      for (const item of toDelete) {
        if (item.filePath && item.filePath.includes('public.blob.vercel-storage.com')) {
          try { await del(item.filePath); } catch (e) {}
        }
        if (item.explanationPath && item.explanationPath.includes('public.blob.vercel-storage.com')) {
          try { await del(item.explanationPath); } catch (e) {}
        }
      }
      
      exams = exams.filter(e => !ids.includes(String(e.id)));
      await kv.set('exams_data', exams);
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
