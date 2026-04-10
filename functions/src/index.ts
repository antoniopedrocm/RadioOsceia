import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export {
  createScheduleBlock,
  updateScheduleBlock,
  deleteScheduleBlock,
  reorderScheduleBlockItems,
  getScheduleDayView,
  getScheduleWeekView,
  getPlaybackTimeline
} from './schedule';

export { loginLocalUser, linkGoogleUserOnFirstLogin } from './auth';
