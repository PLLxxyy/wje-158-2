import { useState, useEffect } from 'react';
import { statsApi } from '../api';
import { HealthRanking, RepairTimeliness, InspectionCompletion } from '../types';

export default function AdminDashboard() {
  const [healthRanking, setHealthRanking] = useState<HealthRanking[]>([]);
  const [repairTimeliness, setRepairTimeliness] = useState<RepairTimeliness | null>(null);
  const [inspectionCompletion, setInspectionCompletion] = useState<InspectionCompletion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [health, repair, inspection] = await Promise.all([
          statsApi.healthRanking(),
          statsApi.repairTimeliness(),
          statsApi.inspectionCompletion()
        ]);
        setHealthRanking(health);
        setRepairTimeliness(repair);
        setInspectionCompletion(inspection);
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /><span>加载统计数据...</span></div>;

  const repairSummary = repairTimeliness?.summary;
  const inspectionSummary = inspectionCompletion?.summary;

  const getHealthClass = (rate: number) => {
    if (rate >= 80) return 'health-rate-good';
    if (rate >= 60) return 'health-rate-medium';
    return 'health-rate-bad';
  };

  const getRankClass = (index: number) => {
    if (index === 0) return 'rank-1';
    if (index === 1) return 'rank-2';
    if (index === 2) return 'rank-3';
    return 'rank-other';
  };

  return (
    <div>
      <h2 className="page-title">{'\u{1F4CA}'} 统计后台</h2>

      {/* Summary cards */}
      <div className="stats-grid">
        <div className="stat-card stat-card-blue">
          <div className="stat-value">{healthRanking.length}</div>
          <div className="stat-label">站台总数</div>
        </div>
        <div className="stat-card stat-card-green">
          <div className="stat-value">{healthRanking.filter(h => h.health_rate >= 80).length}</div>
          <div className="stat-label">优良站台 (&gt;=80%)</div>
        </div>
        <div className="stat-card stat-card-orange">
          <div className="stat-value">{repairSummary?.pending || 0}</div>
          <div className="stat-label">待处理工单</div>
        </div>
        <div className="stat-card stat-card-red">
          <div className="stat-value">{repairSummary?.in_progress || 0}</div>
          <div className="stat-label">处理中工单</div>
        </div>
      </div>

      {/* More stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card stat-card-green">
          <div className="stat-value">{repairSummary?.timeliness_rate || 0}%</div>
          <div className="stat-label">维修及时率 (24h内)</div>
        </div>
        <div className="stat-card stat-card-blue">
          <div className="stat-value">{inspectionSummary?.completion_rate || 0}%</div>
          <div className="stat-label">月度巡检完成率</div>
        </div>
        <div className="stat-card stat-card-orange">
          <div className="stat-value">{repairSummary?.completed || 0}</div>
          <div className="stat-label">已完成工单</div>
        </div>
        <div className="stat-card stat-card-blue">
          <div className="stat-value">{inspectionSummary?.completed || 0}/{inspectionSummary?.total || 0}</div>
          <div className="stat-label">本月巡检完成/总数</div>
        </div>
      </div>

      {/* Health Ranking */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>{'\u{1F3C6}'} 站台设施完好率排行</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>排名</th>
              <th>站台名称</th>
              <th>区域</th>
              <th>设施总数</th>
              <th>完好</th>
              <th>损坏</th>
              <th>缺失</th>
              <th>完好率</th>
            </tr>
          </thead>
          <tbody>
            {healthRanking.map((item, index) => (
              <tr key={item.station_id}>
                <td>
                  <span className={`rank-number ${getRankClass(index)}`}>
                    {index + 1}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{item.station_name}</td>
                <td>{item.region}</td>
                <td>{item.total_facilities}</td>
                <td><span style={{ color: '#2e7d32' }}>{item.good_count}</span></td>
                <td><span style={{ color: '#e65100' }}>{item.damaged_count}</span></td>
                <td><span style={{ color: '#c62828' }}>{item.missing_count}</span></td>
                <td>
                  <div className={`health-rate ${getHealthClass(item.health_rate)}`}>
                    <div className="health-bar-bg">
                      <div className="health-bar-fill" style={{ width: `${item.health_rate}%` }} />
                    </div>
                    <span className="health-rate-text">{item.health_rate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Repair timeliness detail */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>{'\u{1F527}'} 维修工单及时率详情</div>
        </div>
        {repairTimeliness?.recent_orders && repairTimeliness.recent_orders.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>站台</th>
                <th>设施类型</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>耗时(h)</th>
                <th>及时</th>
              </tr>
            </thead>
            <tbody>
              {repairTimeliness.recent_orders.map(order => {
                const timely = order.hours_taken != null && order.hours_taken <= 24;
                return (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 600 }}>{order.station_name}</td>
                    <td>{order.facility_type}</td>
                    <td>
                      <span className={`badge badge-${order.status}`}>
                        {order.status === 'pending' ? '待处理' : order.status === 'in_progress' ? '处理中' : '已完成'}
                      </span>
                    </td>
                    <td className="text-muted">{new Date(order.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{order.hours_taken != null ? order.hours_taken : '-'}</td>
                    <td>
                      {order.status === 'completed' ? (
                        timely ? (
                          <span style={{ color: '#2e7d32', fontWeight: 600 }}>{'\u{2705}'} 及时</span>
                        ) : (
                          <span style={{ color: '#c62828', fontWeight: 600 }}>{'\u{274C}'} 超时</span>
                        )
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-text">暂无维修工单数据</div>
          </div>
        )}
      </div>

      {/* Inspection completion by station */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>{'\u{1F4CB}'} 月度巡检完成率 - 按站台</div>
          <div className="text-muted text-sm">{inspectionSummary?.month}</div>
        </div>
        {inspectionCompletion?.station_breakdown && inspectionCompletion.station_breakdown.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>站台名称</th>
                <th>总任务数</th>
                <th>已完成</th>
                <th>完成率</th>
              </tr>
            </thead>
            <tbody>
              {inspectionCompletion.station_breakdown.map(item => {
                const rate = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
                return (
                  <tr key={item.station_name}>
                    <td style={{ fontWeight: 600 }}>{item.station_name}</td>
                    <td>{item.total}</td>
                    <td>{item.completed}</td>
                    <td>
                      <div className={`health-rate ${getHealthClass(rate)}`}>
                        <div className="health-bar-bg">
                          <div className="health-bar-fill" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="health-rate-text">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-text">本月暂无巡检数据</div>
          </div>
        )}
      </div>
    </div>
  );
}
