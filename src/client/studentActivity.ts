import { useEffect } from 'react';

export type StudentActivityAction = 'page_view' | 'material_opened' | 'material_downloaded' | 'assignment_opened';

type ActivityDetails = {
  page?: string;
  resourceType?: string;
  resourceId?: string | number;
  resourceTitle?: string;
};

export const sendStudentActivity = (action: StudentActivityAction, details: ActivityDetails = {}) => {
  void fetch('/api/activity/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ ...details, action, resourceId: details.resourceId?.toString() }),
  }).catch(() => undefined);
};

export const useStudentActivity = (studentId: string, page: string) => {
  useEffect(() => {
    if (!studentId) return undefined;
    let disposed = false;

    const heartbeat = () => {
      if (disposed || document.visibilityState !== 'visible') return;
      void fetch('/api/activity/heartbeat', { method: 'POST', keepalive: true }).catch(() => undefined);
    };

    heartbeat();
    const intervalId = window.setInterval(heartbeat, 60_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') heartbeat();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [studentId]);

  useEffect(() => {
    if (studentId && page) sendStudentActivity('page_view', { page });
  }, [studentId, page]);
};
