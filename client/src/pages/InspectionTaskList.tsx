import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { inspectionApi } from '../api';
import { Inspection, STATUS_LABELS } from '../types';

export default function InspectionTaskList() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const today = new Date().toISOString().split('T')[0];

  const fetchInspections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inspectionApi.list(filter, today);
      setInspections(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [filter, today]);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const getStatusColor = (status: string) => {
    if (status === 'pending') return 'badge-pending';
    if (status === 'in_progress') return 'badge-in_progress';
    return 'badge-completed';
  };

  return (
    <div>
      <h2 className="page-title">{'\u{1F4CB}'} 今日巡检任务</h2>
      <div className="text-muted mb-16">日期：{today}</div>

      <div className="filter-bar">
        <select
          className="form-select"
          style={{ width: 160 }}
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="completed">已完成</option>
        </select>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>加载中...</span></div>
      ) : inspections.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{'\u{2705}'}</div>
          <div className="empty-state-text">今日暂无巡检任务</div>
        </div>
      ) : (
        <div>
          {inspections.map(inspection => (
            <div key={inspection.id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/inspections/${inspection.id}`)}>
              <div className="flex-between">
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                    {inspection.station_name}
                  </div>
                  <div className="text-muted" style={{ marginBottom: 4 }}>
                    {'\u{1F4CD}'} {inspection.station_location} | {'\u{1F5C2}'} {inspection.station_region}
                  </div>
                  <div className="text-muted">
                    共 {inspection.facility_count} 项设施
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${getStatusColor(inspection.status)}`}>
                    {STATUS_LABELS[inspection.status]}
                  </span>
                  {inspection.status === 'completed' && inspection.completed_at && (
                    <div className="text-muted mt-8" style={{ fontSize: 12 }}>
                      完成于 {new Date(inspection.completed_at).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
