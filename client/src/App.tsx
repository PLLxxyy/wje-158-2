import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User } from './types';
import { getStoredUser, clearAuth } from './api';
import Login from './pages/Login';
import Layout from './components/Layout';
import StationList from './pages/StationList';
import StationDetail from './pages/StationDetail';
import InspectionTaskList from './pages/InspectionTaskList';
import InspectionCheck from './pages/InspectionCheck';
import RepairOrderList from './pages/RepairOrderList';
import RepairProcess from './pages/RepairProcess';
import AdminDashboard from './pages/AdminDashboard';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: () => {}
});

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored && !user) {
      setUser(stored);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleRoute({ children, roles }: { children: ReactNode; roles: string[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRedirect />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<StationList />} />
            <Route path="stations/:id" element={<StationDetail />} />
            <Route path="inspections" element={<RoleRoute roles={['inspector']}><InspectionTaskList /></RoleRoute>} />
            <Route path="inspections/:id" element={<RoleRoute roles={['inspector']}><InspectionCheck /></RoleRoute>} />
            <Route path="repairs" element={<RoleRoute roles={['repairer', 'admin']}><RepairOrderList /></RoleRoute>} />
            <Route path="repairs/:id" element={<RoleRoute roles={['repairer', 'admin']}><RepairProcess /></RoleRoute>} />
            <Route path="admin" element={<RoleRoute roles={['admin']}><AdminDashboard /></RoleRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function LoginRedirect() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}
