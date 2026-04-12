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
  getPlaybackTimeline,
  getNowPlaying
} from './schedule';

export {
  loginLocalUser,
  verifyLocalSession,
  bootstrapRootAdmin,
  listAppUsers,
  createAppUser,
  updateAppUser,
  setAppUserPassword,
  deleteAppUser,
  linkGoogleUserOnFirstLogin
} from './auth';
