import { kv } from '@vercel/kv';
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
      
      let finalFilePath = "";
      if (fileData) {
        // fileData is expected to be a base64 string or similar if coming from JSON
        const buffer = Buffer.from(fileData, 'base64');
        const blob = await put(`exams/${Date.now()}_${fileName}`, buffer, {
          access: 'public',
        });
        finalFilePath = blob.url;
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
        duration: 90
      };
      
      exams.push(newExam);
      await kv.set('exams_data', exams);
      return res.status(200).json({ success: true, exam: newExam });
    }

    // 3. EDIT EXAM METADATA
    if (action === 'edit' && req.method === 'POST') {
      const { id, title, category } = req.body;
      let exams = await kv.get('exams_data') || [];
      exams = exams.map(e => {
        if (String(e.id) === String(id)) {
          return { ...e, title: title || e.title, category: category || e.category };
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
      if (examToDelete && examToDelete.filePath && examToDelete.filePath.includes('public.blob.vercel-storage.com')) {
        try { await del(examToDelete.filePath); } catch (e) { console.error("Blob delete error:", e); }
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
