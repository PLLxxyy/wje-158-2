import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { repairApi } from '../api';
import { RepairOrder, FACILITY_LABELS, STATUS_LABELS } from '../types';
import { useAuth } from '../App';

export default function RepairOrderList() {
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await repairApi.list(filter);
      setOrders(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusColor = (status: string) => {
    if (status === 'pending') return 'badge-pending';
    if (status === 'in_progress') return 'badge-in_progress';
    return 'badge-completed';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <h2 className="page-title">{'\u{1F527}'} 维修工单</h2>

      <div className="filter-bar">
        <select
          className="form-select"
          style={{ width: 160 }}
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="in_progress">处理中</option>
          <option value="completed">已完成</option>
        </select>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>加载中...</span></div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{'\u{1F4ED}'}</div>
          <div className="empty-state-text">暂无维修工单</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>站台</th>
                <th>设施类型</th>
                <th>损坏描述</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 600 }}>{order.station_name}</td>
                  <td>{FACILITY_LABELS[order.facility_type] || order.facility_type}</td>
                  <td>
                    <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.damage_desc}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusColor(order.status)}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="text-muted">{formatDate(order.created_at)}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => navigate(`/repairs/${order.id}`)}
                    >
                      {order.status === 'pending' ? '接单处理' : order.status === 'in_progress' ? '处理' : '查看'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
