import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inspectionApi } from '../api';
import { Inspection, FACILITY_LABELS, FACILITY_ICONS, RESULT_LABELS } from '../types';

interface ItemState {
  result: 'good' | 'damaged' | 'missing' | null;
  damage_desc: string;
  photo: File | null;
  photoPreview: string;
}

export default function InspectionCheck() {
  const { id } = useParams<{ id: string }>();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const navigate = useNavigate();

  const fetchInspection = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await inspectionApi.get(id);
      setInspection(data);

      // Initialize item states
      const states: Record<string, ItemState> = {};
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          states[item.facility_id] = {
            result: item.result || null,
            damage_desc: item.damage_desc || '',
            photo: null,
            photoPreview: ''
          };
        }
      } else if (data.status === 'pending' && data.facilities) {
        for (const f of data.facilities) {
          states[f.id] = { result: null, damage_desc: '', photo: null, photoPreview: '' };
        }
      }
      setItemStates(states);
    } catch {} finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInspection();
  }, [fetchInspection]);

  const handleStart = async () => {
    if (!id) return;
    try {
      await inspectionApi.start(id);
      await fetchInspection();
    } catch (err: any) {
      setAlert({ type: 'error', msg: err.message });
    }
  };

  const updateItemResult = (facilityId: string, result: 'good' | 'damaged' | 'missing') => {
    setItemStates(prev => ({
      ...prev,
      [facilityId]: { ...prev[facilityId], result }
    }));
  };

  const updateItemDesc = (facilityId: string, desc: string) => {
    setItemStates(prev => ({
      ...prev,
      [facilityId]: { ...prev[facilityId], damage_desc: desc }
    }));
  };

  const handlePhotoChange = (facilityId: string, file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setItemStates(prev => ({
          ...prev,
          [facilityId]: {
            ...prev[facilityId],
            photo: file,
            photoPreview: e.target?.result as string
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!id || !inspection) return;
    setSaving(true);
    setAlert(null);

    try {
      // Update each item
      const items = inspection.items || [];
      for (const item of items) {
        const state = itemStates[item.facility_id];
        if (state && state.result) {
          await inspectionApi.updateItem(id, item.id, state.result, state.damage_desc);
        }
      }

      const result = await inspectionApi.submit(id);
      setAlert({
        type: 'success',
        msg: `巡检已完成！已生成 ${result.repair_orders_created} 个维修工单`
      });

      setTimeout(() => navigate('/inspections'), 2000);
    } catch (err: any) {
      setAlert({ type: 'error', msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /><span>加载中...</span></div>;
  if (!inspection) return <div className="empty-state"><div className="empty-state-text">巡检任务不存在</div></div>;

  const facilities = inspection.facilities || [];
  const items = inspection.items || [];
  const isChecked = (facilityId: string) => itemStates[facilityId]?.result != null;
  const allChecked = facilities.every(f => isChecked(f.id));
  const isPending = inspection.status === 'pending';
  const isInProgress = inspection.status === 'in_progress';
  const isCompleted = inspection.status === 'completed';

  return (
    <div>
      <span className="back-link" onClick={() => navigate('/inspections')}>{'←'} 返回巡检列表</span>

      <div className="detail-header">
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>
            {'\u{1F50D}'} {inspection.station_name} - 巡检
          </h2>
          <div className="text-muted">
            {'\u{1F4CD}'} {inspection.station_location} | 日期：{inspection.date}
          </div>
        </div>
        <span className={`badge badge-${inspection.status}`}>
          {isPending ? '待开始' : isInProgress ? '进行中' : '已完成'}
        </span>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {isPending && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F68C}'}</div>
          <div style={{ fontSize: 16, marginBottom: 16, color: '#616161' }}>
            此巡检任务尚未开始，共 {facilities.length} 项设施需要检查
          </div>
          <button className="btn btn-primary" onClick={handleStart} style={{ fontSize: 16, padding: '12px 32px' }}>
            开始巡检
          </button>
        </div>
      )}

      {(isInProgress || isCompleted) && (
        <div>
          {facilities.map(facility => {
            const item = items.find(i => i.facility_id === facility.id);
            const state = itemStates[facility.id];

            return (
              <div key={facility.id} className="card" style={{ marginBottom: 12 }}>
                <div className="flex-between mb-8">
                  <div className="facility-info">
                    <div className="facility-icon" style={{ background: '#e3f2fd' }}>
                      {FACILITY_ICONS[facility.type] || '\u{1F4E6}'}
                    </div>
                    <div>
                      <div className="facility-name">{FACILITY_LABELS[facility.type] || facility.type}</div>
                      <div className="text-muted text-sm">当前状态：{RESULT_LABELS[facility.status]}</div>
                    </div>
                  </div>
                </div>

                {/* Inspection options */}
                <div className="inspection-options mb-8">
                  {(['good', 'damaged', 'missing'] as const).map(result => (
                    <div
                      key={result}
                      className={`inspection-option ${state?.result === result ? `selected-${result}` : ''}`}
                      onClick={() => !isCompleted && updateItemResult(facility.id, result)}
                      style={{ cursor: isCompleted ? 'default' : 'pointer' }}
                    >
                      {RESULT_LABELS[result]}
                    </div>
                  ))}
                </div>

                {/* Damage description & photo for damaged/missing */}
                {state?.result && state.result !== 'good' && (
                  <div style={{ marginTop: 12 }}>
                    {isCompleted && item && (
                      <div style={{ marginBottom: 12 }}>
                        {item.repaired ? (
                          <span className="badge badge-completed" style={{ background: '#2e7d32' }}>
                            {'\u{2705}'} 已修复
                          </span>
                        ) : (
                          <span className="badge badge-pending" style={{ background: '#e65100' }}>
                            {'\u{23F3}'} 待修复
                          </span>
                        )}
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">损坏描述</label>
                      <textarea
                        className="form-textarea"
                        placeholder="请描述损坏情况..."
                        value={state.damage_desc}
                        onChange={e => updateItemDesc(facility.id, e.target.value)}
                        disabled={isCompleted}
                      />
                    </div>
                    {!isCompleted && (
                      <div className="form-group">
                        <label className="form-label">拍照上传</label>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden-input"
                          id={`photo-${facility.id}`}
                          onChange={e => handlePhotoChange(facility.id, e.target.files?.[0] || null)}
                        />
                        <label htmlFor={`photo-${facility.id}`} className="photo-upload">
                          {state.photoPreview ? (
                            <img src={state.photoPreview} alt="preview" className="photo-preview" />
                          ) : (
                            <>
                              <div className="photo-upload-icon">{'\u{1F4F7}'}</div>
                              <div className="text-muted">点击拍照或选择图片</div>
                            </>
                          )}
                        </label>
                      </div>
                    )}
                    {isCompleted && item?.photo && (
                      <div className="form-group">
                        <label className="form-label">损坏照片</label>
                        <img src={item.photo} alt="损坏照片" className="photo-preview" style={{ maxWidth: 300 }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isInProgress && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button
                className="btn btn-success"
                style={{ fontSize: 16, padding: '12px 40px' }}
                disabled={!allChecked || saving}
                onClick={handleSubmit}
              >
                {saving ? '提交中...' : '提交巡检'}
              </button>
              {!allChecked && (
                <div className="text-muted mt-8">
                  请完成所有设施检查后再提交
                </div>
              )}
            </div>
          )}

          {isCompleted && (
            <div className="card" style={{ textAlign: 'center', background: '#e8f5e9' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{'\u{2705}'}</div>
              <div style={{ fontWeight: 600, color: '#2e7d32' }}>巡检已完成</div>
              {inspection.completed_at && (
                <div className="text-muted mt-8">
                  完成时间：{new Date(inspection.completed_at).toLocaleString()}
                </div>
              )}
              {items.length > 0 && (() => {
                const damagedItems = items.filter(i => i.result === 'damaged' || i.result === 'missing');
                const repairedCount = damagedItems.filter(i => i.repaired).length;
                const pendingCount = damagedItems.length - repairedCount;
                return damagedItems.length > 0 ? (
                  <div className="mt-12" style={{ fontSize: 14 }}>
                    <span style={{ marginRight: 16 }}>
                      发现问题：<strong>{damagedItems.length}</strong> 项
                    </span>
                    <span style={{ marginRight: 16, color: '#2e7d32' }}>
                      {'\u{2705}'} 已修复：<strong>{repairedCount}</strong> 项
                    </span>
                    <span style={{ color: '#e65100' }}>
                      {'\u{23F3}'} 待修复：<strong>{pendingCount}</strong> 项
                    </span>
                  </div>
                ) : (
                  <div className="mt-12" style={{ fontSize: 14, color: '#2e7d32' }}>
                    所有设施完好，无问题
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
