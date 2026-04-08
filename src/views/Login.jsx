import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Icon from '../components/Icon';

const Login = () => {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await axios.post('/api/auth?action=login', { username: u, password: p });
      if (r.data.success) {
        navigate('/admin');
      } else {
        setError(r.data.message || 'Tài khoản hoặc mật khẩu không chính xác!');
      }
    } catch (e) {
      setError('Lỗi kết nối Server!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <form onSubmit={submit} className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-sm w-full relative overflow-hidden animate-in zoom-in duration-300">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm"><Icon name="shield" size={32} /></div>
        <h2 className="text-2xl font-black text-center mb-2 uppercase tracking-tighter text-slate-800">Đăng nhập</h2>
        <p className="text-center text-slate-400 text-xs font-bold mb-8 uppercase tracking-widest">Hệ thống Quản trị</p>
        
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold text-center">{error}</div>}
        
        <div className="space-y-4">
          <input 
            type="text" 
            placeholder="Tên tài khoản" 
            value={u} 
            onChange={e => setU(e.target.value)} 
            required 
            className="w-full p-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-sm bg-slate-50 focus:bg-white transition-all text-center shadow-inner" 
          />
          <input 
            type="password" 
            placeholder="Mật khẩu" 
            value={p} 
            onChange={e => setP(e.target.value)} 
            required 
            className="w-full p-4 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-sm bg-slate-50 focus:bg-white transition-all text-center shadow-inner" 
          />
        </div>
        <button 
          type="submit" 
          disabled={loading} 
          className={`w-full mt-8 py-4 rounded-xl font-black text-[14px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${loading ? 'bg-slate-300 text-slate-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {loading ? <Icon name="loader" className="animate-spin" size={18} /> : <Icon name="log-in" size={18} />} {loading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP'}
        </button>
      </form>
    </div>
  );
};

export default Login;
