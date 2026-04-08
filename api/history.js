import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { action, examId, startTime } = req.query;

  try {
    // 1. SUBMIT ATTEMPT
    if (action === 'submit_attempt' && req.method === 'POST') {
      const attempt = req.body;
      if (attempt) {
        const history = await kv.get('history_data') || [];
        history.push({
          ...attempt,
          timestamp: Date.now()
        });
        await kv.set('history_data', history);
        return res.status(200).json({ success: true });
      }
      return res.status(400).json({ error: 'Invalid data' });
    }

    // 2. GET HISTORY FOR EXAM
    if (action === 'get_history' && examId) {
      const history = await kv.get('history_data') || [];
      const filtered = history.filter(h => String(h.examId) === String(examId));
      // Newest first
      return res.status(200).json(filtered.sort((a,b) => b.startTime - a.startTime));
    }

    // 3. DELETE SINGLE ATTEMPT
    if (action === 'delete_attempt' && examId && startTime) {
      let history = await kv.get('history_data') || [];
      history = history.filter(h => !(String(h.examId) === String(examId) && String(h.startTime) === String(startTime)));
      await kv.set('history_data', history);
      return res.status(200).json({ success: true });
    }

    // 4. BULK DELETE HISTORY
    if (action === 'delete_history_bulk' && req.method === 'POST') {
      const { items } = req.body; // Array of {examId, startTime}
      if (!Array.isArray(items)) return res.status(400).json({ error: 'Invalid items' });
      
      let history = await kv.get('history_data') || [];
      const keysToDelete = items.map(item => `${item.examId}_${item.startTime}`);
      
      history = history.filter(h => !keysToDelete.includes(`${h.examId}_${h.startTime}`));
      await kv.set('history_data', history);
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (error) {
    console.error("History API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
