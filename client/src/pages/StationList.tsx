import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { stationApi } from '../api';
import { Station } from '../types';
import { useAuth } from '../App';

export default function StationList() {
  const [stations, setStations] = useState<Station[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newStation, setNewStation] = useState({ name: '', location: '', region: '', lines: '' });
  const [addError, setAddError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchStations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stationApi.list(search, selectedRegion);
      setStations(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, selectedRegion]);

  const fetchRegions = useCallback(async () => {
    try {
      const data = await stationApi.regions();
      setRegions(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  useEffect(() => {
    const timer = setTimeout(fetchStations, 300);
    return () => clearTimeout(timer);
  }, [fetchStations]);

  const handleAddStation = async () => {
    setAddError('');
    if (!newStation.name || !newStation.location || !newStation.region || !newStation.lines) {
      setAddError('请填写完整信息');
      return;
    }
    try {
      await stationApi.create(newStation);
      setShowAdd(false);
      setNewStation({ name: '', location: '', region: '', lines: '' });
      fetchStations();
    } catch (err: any) {
      setAddError(err.message);
    }
  };

  const getHealthClass = (rate: number) => {
    if (rate >= 80) return 'health-rate-good';
    if (rate >= 60) return 'health-rate-medium';
    return 'health-rate-bad';
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2 className="page-title">{'\u{1F4CD}'} 站台列表</h2>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + 新增站台
          </button>
        )}
      </div>

      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="搜索站台名称..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-select"
          style={{ width: 160 }}
          value={selectedRegion}
          onChange={e => setSelectedRegion(e.target.value)}
        >
          <option value="">全部区域</option>
          {regions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>加载中...</span></div>
      ) : stations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{'\u{1F50D}'}</div>
          <div className="empty-state-text">暂无站台数据</div>
        </div>
      ) : (
        <div className="station-grid">
          {stations.map(station => (
            <div key={station.id} className="station-card" onClick={() => navigate(`/stations/${station.id}`)}>
              <div className="station-name">{station.name}</div>
              <div className="station-meta">{'\u{1F4CD}'} {station.location}</div>
              <div className="station-meta">{'\u{1F5C2}'} {station.region}</div>
              <div className="station-lines">
                {station.lines.split(',').map(line => (
                  <span key={line} className="line-tag">{line}</span>
                ))}
              </div>
              <div className={`health-rate ${getHealthClass(station.health_rate || 0)}`}>
                <span style={{ fontSize: 13, color: '#757575' }}>设施完好率</span>
                <div className="health-bar-bg">
                  <div className="health-bar-fill" style={{ width: `${station.health_rate || 0}%` }} />
                </div>
                <span className="health-rate-text">{station.health_rate || 0}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">新增站台</h3>
            {addError && <div className="alert alert-error">{addError}</div>}
            <div className="form-group">
              <label className="form-label">站台名称</label>
              <input className="form-input" value={newStation.name} onChange={e => setNewStation(s => ({ ...s, name: e.target.value }))} placeholder="如：中关村南站" />
            </div>
            <div className="form-group">
              <label className="form-label">位置</label>
              <input className="form-input" value={newStation.location} onChange={e => setNewStation(s => ({ ...s, location: e.target.value }))} placeholder="如：海淀区中关村大街路口" />
            </div>
            <div className="form-group">
              <label className="form-label">所属区域</label>
              <input className="form-input" value={newStation.region} onChange={e => setNewStation(s => ({ ...s, region: e.target.value }))} placeholder="如：海淀区" />
            </div>
            <div className="form-group">
              <label className="form-label">所属线路（逗号分隔）</label>
              <input className="form-input" value={newStation.lines} onChange={e => setNewStation(s => ({ ...s, lines: e.target.value }))} placeholder="如：4号线,10号线" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAdd(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAddStation}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
