import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const schedule = require('./schedule');

export const createScheduleBlock = schedule.createScheduleBlock;
export const updateScheduleBlock = schedule.updateScheduleBlock;
export const deleteScheduleBlock = schedule.deleteScheduleBlock;
export const getScheduleDayView = schedule.getScheduleDayView;
