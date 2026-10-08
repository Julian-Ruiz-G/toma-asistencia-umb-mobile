import { showAppNotice } from '../ui/appNotice';
import { describeHoursError } from './hoursNotice.cjs';

export { AppNoticeHost as HoursNoticeHost } from '../ui/appNotice';

export function showHoursNotice(notice) {
  if (!notice) return false;
  return showAppNotice({
    ...notice,
    kicker: 'Aviso de horario',
    primaryLabel: 'Entendido',
  });
}

export { describeHoursError };

export function alertClassHoursError(json) {
  const notice = describeHoursError(json);
  if (!notice) return false;
  if (showHoursNotice(notice)) return true;
  return false;
}

export function alertAttendanceQrError(json) {
  return alertClassHoursError(json);
}
