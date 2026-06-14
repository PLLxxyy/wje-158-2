import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, setAuth } from '../api';
import { useAuth } from '../App';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { token, user } = await authApi.login(username, password);
      setAuth(token, user);
      setUser(user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-icon">{'\u{1F68C}'}</div>
        <h1 className="login-title">公交站台维护系统</h1>
        <p className="login-subtitle">设施维护 · 巡检管理 · 维修跟踪</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">用户名</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8, fontSize: 13, color: '#666' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>测试账号</div>
          <div>管理员: admin / 123456</div>
          <div>巡检员: inspector / 123456</div>
          <div>维修员: repairer / 123456</div>
        </div>
      </div>
    </div>
  );
}
