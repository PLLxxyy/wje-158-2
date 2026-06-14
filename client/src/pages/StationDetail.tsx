import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { stationApi } from '../api';
import { Station, Facility, FACILITY_LABELS, FACILITY_ICONS, RESULT_LABELS } from '../types';

export default function StationDetail() {
  const { id } = useParams<{ id: string }>();
  const [station, setStation] = useState<Station & { facilities: Facility[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchStation = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await stationApi.get(id);
      setStation(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStation();
  }, [fetchStation]);

  const getHealthClass = (rate: number) => {
    if (rate >= 80) return 'health-rate-good';
    if (rate >= 60) return 'health-rate-medium';
    return 'health-rate-bad';
  };

  if (loading) return <div className="loading"><div className="spinner" /><span>加载中...</span></div>;
  if (!station) return <div className="empty-state"><div className="empty-state-text">站台不存在</div></div>;

  const goodCount = station.facilities?.filter(f => f.status === 'good').length || 0;
  const damagedCount = station.facilities?.filter(f => f.status === 'damaged').length || 0;
  const missingCount = station.facilities?.filter(f => f.status === 'missing').length || 0;

  return (
    <div>
      <span className="back-link" onClick={() => navigate('/')}>{'←'} 返回站台列表</span>

      <div className="detail-header">
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>{station.name}</h2>
          <div className="text-muted">{station.location}</div>
        </div>
      </div>

      <div className="detail-info-grid">
        <div className="detail-info-item">
          <div className="detail-info-label">所属区域</div>
          <div className="detail-info-value">{station.region}</div>
        </div>
        <div className="detail-info-item">
          <div className="detail-info-label">所属线路</div>
          <div className="detail-info-value">
            {station.lines.split(',').map(line => (
              <span key={line} className="line-tag" style={{ marginRight: 4 }}>{line}</span>
            ))}
          </div>
        </div>
        <div className="detail-info-item">
          <div className="detail-info-label">设施完好率</div>
          <div className="detail-info-value" style={{ fontSize: 20 }}>
            <span className={getHealthClass(station.health_rate || 0).includes('good') ? '' : ''}>
              {station.health_rate || 0}%
            </span>
          </div>
        </div>
        <div className="detail-info-item">
          <div className="detail-info-label">设施统计</div>
          <div className="detail-info-value text-sm">
            <span style={{ color: '#2e7d32' }}>完好 {goodCount}</span>
            {' / '}
            <span style={{ color: '#e65100' }}>损坏 {damagedCount}</span>
            {' / '}
            <span style={{ color: '#c62828' }}>缺失 {missingCount}</span>
          </div>
        </div>
      </div>

      {/* Health bar */}
      <div className={`card ${getHealthClass(station.health_rate || 0)}`}>
        <div className="card-title">设施完好率</div>
        <div className="health-rate" style={{ marginTop: 8 }}>
          <div className="health-bar-bg" style={{ height: 12 }}>
            <div className="health-bar-fill" style={{ width: `${station.health_rate || 0}%` }} />
          </div>
          <span className="health-rate-text" style={{ fontSize: 18 }}>{station.health_rate || 0}%</span>
        </div>
      </div>

      {/* Facilities */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">设施清单</div>
        {station.facilities && station.facilities.length > 0 ? (
          station.facilities.map(facility => (
            <div key={facility.id} className="facility-item">
              <div className="facility-info">
                <div className="facility-icon" style={{
                  background: facility.status === 'good' ? '#e8f5e9' : facility.status === 'damaged' ? '#fff3e0' : '#ffebee'
                }}>
                  {FACILITY_ICONS[facility.type] || '\u{1F4E6}'}
                </div>
                <div>
                  <div className="facility-name">{FACILITY_LABELS[facility.type] || facility.type}</div>
                  {facility.description && <div className="text-muted">{facility.description}</div>}
                </div>
              </div>
              <span className={`badge badge-${facility.status}`}>
                {RESULT_LABELS[facility.status]}
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-state-text">暂无设施数据</div>
          </div>
        )}
      </div>
    </div>
  );
}
