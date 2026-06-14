import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { repairApi } from '../api';
import { RepairOrder, FACILITY_LABELS, STATUS_LABELS } from '../types';
import { useAuth } from '../App';

export default function RepairProcess() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<RepairOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairDesc, setRepairDesc] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await repairApi.get(id);
      setOrder(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleAccept = async () => {
    if (!id) return;
    try {
      await repairApi.accept(id);
      await fetchOrder();
      setAlert({ type: 'success', msg: '已接单，开始维修' });
    } catch (err: any) {
      setAlert({ type: 'error', msg: err.message });
    }
  };

  const handlePhotoChange = (file: File | null) => {
    setPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview('');
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    setSubmitting(true);
    setAlert(null);
    try {
      await repairApi.complete(id, photo, repairDesc);
      setAlert({ type: 'success', msg: '维修已完成！' });
      await fetchOrder();
    } catch (err: any) {
      setAlert({ type: 'error', msg: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /><span>加载中...</span></div>;
  if (!order) return <div className="empty-state"><div className="empty-state-text">工单不存在</div></div>;

  const isRepairer = user?.role === 'repairer';
  const isPending = order.status === 'pending';
  const isInProgress = order.status === 'in_progress';
  const isCompleted = order.status === 'completed';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div>
      <span className="back-link" onClick={() => navigate('/repairs')}>{'←'} 返回工单列表</span>

      <div className="detail-header">
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>
            {'\u{1F527}'} 维修工单
          </h2>
          <div className="text-muted">工单号：{order.id.substring(0, 8)}</div>
        </div>
        <span className={`badge badge-${order.status}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Order info */}
      <div className="card">
        <div className="card-title">工单信息</div>
        <div className="detail-info-grid">
          <div className="detail-info-item">
            <div className="detail-info-label">站台名称</div>
            <div className="detail-info-value">{order.station_name}</div>
          </div>
          <div className="detail-info-item">
            <div className="detail-info-label">位置</div>
            <div className="detail-info-value">{order.station_location}</div>
          </div>
          <div className="detail-info-item">
            <div className="detail-info-label">设施类型</div>
            <div className="detail-info-value">{FACILITY_LABELS[order.facility_type] || order.facility_type}</div>
          </div>
          <div className="detail-info-item">
            <div className="detail-info-label">损坏描述</div>
            <div className="detail-info-value">{order.damage_desc}</div>
          </div>
          <div className="detail-info-item">
            <div className="detail-info-label">创建时间</div>
            <div className="detail-info-value">{formatDate(order.created_at)}</div>
          </div>
          <div className="detail-info-item">
            <div className="detail-info-label">接单时间</div>
            <div className="detail-info-value">{formatDate(order.assigned_at)}</div>
          </div>
          {isCompleted && (
            <>
              <div className="detail-info-item">
                <div className="detail-info-label">完成时间</div>
                <div className="detail-info-value">{formatDate(order.completed_at)}</div>
              </div>
              <div className="detail-info-item">
                <div className="detail-info-label">维修耗时</div>
                <div className="detail-info-value">
                  {order.hours_taken != null ? `${order.hours_taken} 小时` : '-'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Damage photo */}
      {order.damage_photo && (
        <div className="card">
          <div className="card-title">损坏照片</div>
          <img src={order.damage_photo} alt="损坏照片" style={{ maxWidth: 300, borderRadius: 8 }} />
        </div>
      )}

      {/* Pending: accept button */}
      {isPending && isRepairer && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u{1F4CB}'}</div>
          <div style={{ fontSize: 16, marginBottom: 16, color: '#616161' }}>
            此工单等待接单处理
          </div>
          <button className="btn btn-primary" style={{ fontSize: 16, padding: '12px 32px' }} onClick={handleAccept}>
            接单并开始维修
          </button>
        </div>
      )}

      {/* In Progress: complete form */}
      {isInProgress && isRepairer && (
        <div className="card">
          <div className="card-title">完成维修</div>
          <div className="form-group">
            <label className="form-label">维修说明</label>
            <textarea
              className="form-textarea"
              placeholder="请描述维修情况..."
              value={repairDesc}
              onChange={e => setRepairDesc(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">修复照片</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden-input"
              id="repair-photo"
              onChange={e => handlePhotoChange(e.target.files?.[0] || null)}
            />
            <label htmlFor="repair-photo" className="photo-upload">
              {photoPreview ? (
                <img src={photoPreview} alt="preview" className="photo-preview" />
              ) : (
                <>
                  <div className="photo-upload-icon">{'\u{1F4F7}'}</div>
                  <div className="text-muted">点击上传修复照片</div>
                </>
              )}
            </label>
          </div>
          <button
            className="btn btn-success"
            disabled={submitting}
            onClick={handleComplete}
          >
            {submitting ? '提交中...' : '标记完成'}
          </button>
        </div>
      )}

      {/* Completed: show result */}
      {isCompleted && (
        <div className="card">
          <div className="card-title">维修结果</div>
          {order.repair_desc && (
            <div style={{ marginBottom: 12 }}>
              <div className="text-muted text-sm mb-8">维修说明：</div>
              <div>{order.repair_desc}</div>
            </div>
          )}
          {order.repair_photo && (
            <div>
              <div className="text-muted text-sm mb-8">修复照片：</div>
              <img src={order.repair_photo} alt="修复照片" style={{ maxWidth: 300, borderRadius: 8 }} />
            </div>
          )}
          <div className="alert alert-success mt-16">
            {'\u{2705}'} 维修已完成 | 完成时间：{formatDate(order.completed_at)}
          </div>
        </div>
      )}
    </div>
  );
}
