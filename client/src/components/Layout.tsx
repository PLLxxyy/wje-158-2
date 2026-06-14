import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  inspector: '巡检员',
  repairer: '维修员'
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const navItems: Array<{ to: string; label: string; roles?: string[] }> = [
    { to: '/', label: '站台列表' },
    { to: '/inspections', label: '巡检任务', roles: ['inspector'] },
    { to: '/repairs', label: '维修工单', roles: ['repairer', 'admin'] },
    { to: '/admin', label: '统计后台', roles: ['admin'] }
  ];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>公交站台设施维护管理系统</h1>
        <div className="header-right">
          <span className="header-user">
            {user.real_name}
            <span className="header-role">{ROLE_LABELS[user.role]}</span>
          </span>
          <button className="btn btn-sm btn-outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }} onClick={handleLogout}>
            退出
          </button>
        </div>
      </header>
      <nav className="nav-bar">
        {navItems
          .filter(item => !item.roles || item.roles.includes(user.role))
          .map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
