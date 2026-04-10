import { FieldValue, Timestamp, type DocumentReference, type DocumentSnapshot } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

function getDb() {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
  return admin.firestore();
}

export type ScheduleBlockStatus = 'ACTIVE' | 'INACTIVE' | 'CANCELLED';
export type ScheduleRecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY';
export type QueueItemType = 'MEDIA' | 'PROGRAM_HEADER' | 'BREAK' | 'MANUAL';

type ScopeMode = 'THIS' | 'THIS_AND_FUTURE' | 'ALL_IN_GROUP';

interface ScheduleItemInput {
  id?: string;
  itemType: QueueItemType;
  mediaId?: string | null;
  durationSeconds: number;
  notes?: string | null;
  isEnabled?: boolean;
  order?: number;
}

interface RecurrenceRule {
  interval?: number;
  byWeekDays?: number[];
  until?: string | null;
  count?: number | null;
}

interface ScheduleBlockInput {
  title: string;
  description?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  programId?: string | null;
  status?: ScheduleBlockStatus;
  recurrenceType: ScheduleRecurrenceType;
  recurrenceRule?: RecurrenceRule | null;
  items?: ScheduleItemInput[];
}

function requireAuth(auth: { uid: string } | null | undefined) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  return auth.uid;
}

async function requireAdminOrOperator(uid: string) {
  const userDoc = await getDb().collection('users').doc(uid).get();
  const role = String(userDoc.data()?.role ?? 'operador');
  if (!['admin', 'operador'].includes(role)) {
    throw new HttpsError('permission-denied', 'Perfil sem permissão para esta operação.');
  }
}

function normalizeScheduleStatus(value: unknown): ScheduleBlockStatus {
  const normalized = String(value ?? 'ACTIVE').toUpperCase();
  if (normalized === 'INACTIVE') return 'INACTIVE';
  if (normalized === 'CANCELLED') return 'CANCELLED';
  return 'ACTIVE';
}

function combineDateAndTimeToDate(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError('invalid-argument', 'Data inválida. Use YYYY-MM-DD.');
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new HttpsError('invalid-argument', 'Horário inválido. Use HH:mm.');
  }

  const parsed = new Date(`${date}T${time}:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpsError('invalid-argument', 'Data/hora inválida.');
  }

  return parsed;
}

function parseDateValue(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpsError('invalid-argument', 'Data inválida para recorrência.');
  }
  return parsed;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function detectScheduleConflict(
  targetStart: Date,
  targetEnd: Date,
  others: Array<{ id: string; startsAt: Date; endsAt: Date; status: ScheduleBlockStatus }>,
  ignoreIds = new Set<string>()
) {
  return others.find((candidate) => {
    if (ignoreIds.has(candidate.id)) return false;
    if (candidate.status !== 'ACTIVE') return false;
    return targetStart < candidate.endsAt && targetEnd > candidate.startsAt;
  }) ?? null;
}

function buildRecurrenceDates(date: string, recurrenceType: ScheduleRecurrenceType, rule: RecurrenceRule | null | undefined): string[] {
  const startDate = parseDateValue(date);

  if (recurrenceType === 'NONE') {
    return [date];
  }

  const interval = Math.max(1, Number(rule?.interval ?? 1));
  const untilDate = rule?.until ? parseDateValue(rule.until) : null;
  const countLimit = Math.max(1, Math.min(366, Number(rule?.count ?? 30)));

  if (recurrenceType === 'DAILY') {
    const dates: string[] = [];
    let cursor = new Date(startDate);

    while (dates.length < countLimit) {
      if (untilDate && cursor > untilDate) break;
      dates.push(formatDate(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + interval);
    }

    return dates;
  }

  const byWeekDays = Array.isArray(rule?.byWeekDays) && rule.byWeekDays.length
    ? rule.byWeekDays.map((weekday) => Number(weekday)).filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)
    : [startDate.getUTCDay()];

  if (!byWeekDays.length) {
    throw new HttpsError('invalid-argument', 'Recorrência semanal requer dias da semana válidos (0-6).');
  }

  const allowed = new Set(byWeekDays);
  const dates: string[] = [];
  let cursor = new Date(startDate);
  let weeksElapsed = 0;

  while (dates.length < countLimit) {
    if (untilDate && cursor > untilDate) break;

    const dayDiff = Math.floor((cursor.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    weeksElapsed = Math.floor(dayDiff / 7);

    if (weeksElapsed % interval === 0 && allowed.has(cursor.getUTCDay())) {
      dates.push(formatDate(cursor));
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

async function resolveProgramTitle(programId?: string | null) {
  if (!programId) return null;
  const snapshot = await getDb().collection('programs').doc(programId).get();
  if (!snapshot.exists) return null;
  return String(snapshot.data()?.title ?? '').trim() || null;
}

async function resolveMediaMaps(items: ScheduleItemInput[]) {
  const ids = Array.from(new Set(items.map((item) => item.mediaId).filter((id): id is string => Boolean(id))));
  const mediaMap = new Map<string, { title: string | null; sourceType: string | null; mediaType: string | null }>();

  await Promise.all(ids.map(async (id) => {
    const mediaDoc = await getDb().collection('media').doc(id).get();
    if (!mediaDoc.exists) return;
    const data = mediaDoc.data() ?? {};
    mediaMap.set(id, {
      title: typeof data.title === 'string' ? data.title : null,
      sourceType: typeof data.sourceType === 'string' ? data.sourceType : null,
      mediaType: typeof data.mediaType === 'string' ? data.mediaType : null
    });
  }));

  return mediaMap;
}

function normalizeItems(items: unknown, includeOrder = false): ScheduleItemInput[] {
  if (!Array.isArray(items)) return [];

  return items.map((raw, index) => {
    const item = raw as ScheduleItemInput;
    const durationSeconds = Number(item.durationSeconds ?? 0);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new HttpsError('invalid-argument', `Item ${index + 1} possui duração inválida.`);
    }

    const itemType = String(item.itemType ?? 'MEDIA').toUpperCase() as QueueItemType;
    if (!['MEDIA', 'PROGRAM_HEADER', 'BREAK', 'MANUAL'].includes(itemType)) {
      throw new HttpsError('invalid-argument', `Item ${index + 1} possui tipo inválido.`);
    }

    return {
      id: item.id,
      itemType,
      mediaId: item.mediaId ? String(item.mediaId) : null,
      durationSeconds,
      notes: item.notes ? String(item.notes) : null,
      isEnabled: item.isEnabled !== false,
      order: includeOrder ? Number(item.order ?? index + 1) : index + 1
    };
  });
}

async function validateNoConflicts(dates: string[], startTime: string, endTime: string, ignoreByDate = new Map<string, Set<string>>()) {
  await Promise.all(dates.map(async (date) => {
    const targetStart = combineDateAndTimeToDate(date, startTime);
    const targetEnd = combineDateAndTimeToDate(date, endTime);

    const daySnapshot = await getDb().collection('scheduleBlocks').where('date', '==', date).get();
    const existing = daySnapshot.docs.map((doc) => {
      const data = doc.data() ?? {};
      return {
        id: doc.id,
        startsAt: (data.startsAt as Timestamp)?.toDate?.() ?? combineDateAndTimeToDate(String(data.date ?? date), String(data.startTime ?? '00:00')),
        endsAt: (data.endsAt as Timestamp)?.toDate?.() ?? combineDateAndTimeToDate(String(data.date ?? date), String(data.endTime ?? '00:00')),
        status: normalizeScheduleStatus(data.status)
      };
    });

    const conflict = detectScheduleConflict(targetStart, targetEnd, existing, ignoreByDate.get(date) ?? new Set<string>());
    if (conflict) {
      throw new HttpsError('already-exists', `Conflito de horário detectado em ${date}.`);
    }
  }));
}

function validateScheduleBlockPayload(payload: ScheduleBlockInput) {
  if (!payload.title?.trim()) {
    throw new HttpsError('invalid-argument', 'Título é obrigatório.');
  }

  combineDateAndTimeToDate(payload.date, payload.startTime);
  const end = combineDateAndTimeToDate(payload.date, payload.endTime);
  const start = combineDateAndTimeToDate(payload.date, payload.startTime);

  if (end <= start) {
    throw new HttpsError('invalid-argument', 'O horário final deve ser maior que o inicial.');
  }
}

async function writeItems(blockRef: DocumentReference, items: ScheduleItemInput[], mediaMap: Map<string, { title: string | null; sourceType: string | null; mediaType: string | null }>) {
  const snapshot = await blockRef.collection('items').get();
  const batch = getDb().batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));

  items
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .forEach((item, index) => {
      const itemRef = item.id ? blockRef.collection('items').doc(item.id) : blockRef.collection('items').doc();
      const media = item.mediaId ? mediaMap.get(item.mediaId) : null;
      batch.set(itemRef, {
        blockId: blockRef.id,
        order: index + 1,
        itemType: item.itemType,
        mediaId: item.mediaId ?? null,
        mediaTitle: media?.title ?? null,
        durationSeconds: item.durationSeconds,
        sourceType: media?.sourceType ?? null,
        mediaType: media?.mediaType ?? null,
        notes: item.notes ?? null,
        isEnabled: item.isEnabled !== false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });

  await batch.commit();
}

function getScopeDocs(
  baseDoc: DocumentSnapshot,
  scope: ScopeMode,
  groupDocs: DocumentSnapshot[]
) {
  const baseDate = String(baseDoc.data()?.date ?? '');
  if (scope === 'THIS') return [baseDoc];
  if (scope === 'ALL_IN_GROUP') return groupDocs;
  return groupDocs.filter((doc) => String(doc.data()?.date ?? '') >= baseDate);
}

export const createScheduleBlock = onCall(async (request: CallableRequest<unknown>) => {
  const uid = requireAuth(request.auth);
  await requireAdminOrOperator(uid);

  const data = request.data as ScheduleBlockInput;
  validateScheduleBlockPayload(data);

  const recurrenceType = (String(data.recurrenceType ?? 'NONE').toUpperCase() as ScheduleRecurrenceType);
  const items = normalizeItems(data.items, false);
  const dates = buildRecurrenceDates(data.date, recurrenceType, data.recurrenceRule ?? null);

  await validateNoConflicts(dates, data.startTime, data.endTime);

  const recurrenceGroupId = recurrenceType === 'NONE' ? null : getDb().collection('_').doc().id;
  const programTitle = await resolveProgramTitle(data.programId ?? null);
  const mediaMap = await resolveMediaMaps(items);

  const createdBlockIds: string[] = [];
  for (const date of dates) {
    const startsAt = combineDateAndTimeToDate(date, data.startTime);
    const endsAt = combineDateAndTimeToDate(date, data.endTime);

    const blockRef = getDb().collection('scheduleBlocks').doc();
    await blockRef.set({
      title: data.title.trim(),
      description: data.description ? String(data.description).trim() : null,
      date,
      startTime: data.startTime,
      endTime: data.endTime,
      startsAt: Timestamp.fromDate(startsAt),
      endsAt: Timestamp.fromDate(endsAt),
      programId: data.programId ?? null,
      programTitle,
      recurrenceType,
      recurrenceGroupId,
      recurrenceRule: data.recurrenceRule ?? null,
      status: 'ACTIVE',
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      updatedBy: uid
    });

    await writeItems(blockRef, items, mediaMap);
    createdBlockIds.push(blockRef.id);
  }

  return {
    ok: true,
    createdBlockIds,
    recurrenceGroupId
  };
});

export const updateScheduleBlock = onCall(async (request: CallableRequest<unknown>) => {
  const uid = requireAuth(request.auth);
  await requireAdminOrOperator(uid);

  const data = request.data as ScheduleBlockInput & { blockId: string; applyScope?: ScopeMode; status: ScheduleBlockStatus; items: ScheduleItemInput[] };
  if (!data.blockId) {
    throw new HttpsError('invalid-argument', 'blockId é obrigatório.');
  }

  validateScheduleBlockPayload(data);
  const items = normalizeItems(data.items, true);
  const status = normalizeScheduleStatus(data.status);

  const baseRef = getDb().collection('scheduleBlocks').doc(data.blockId);
  const baseDoc = await baseRef.get();
  if (!baseDoc.exists) {
    throw new HttpsError('not-found', 'Bloco não encontrado.');
  }

  const baseData = baseDoc.data() ?? {};
  const groupId = typeof baseData.recurrenceGroupId === 'string' ? baseData.recurrenceGroupId : null;
  const scope = (data.applyScope ?? 'THIS') as ScopeMode;

  let groupDocs: DocumentSnapshot[] = [baseDoc];
  if (groupId && scope !== 'THIS') {
    const snapshot = await getDb().collection('scheduleBlocks').where('recurrenceGroupId', '==', groupId).get();
    groupDocs = snapshot.docs;
  }

  const targetDocs = getScopeDocs(baseDoc, scope, groupDocs);
  const affectedDates = Array.from(new Set(targetDocs.map((doc) => String(doc.data()?.date ?? ''))));
  const ignoreByDate = new Map<string, Set<string>>();
  targetDocs.forEach((doc) => {
    const date = String(doc.data()?.date ?? '');
    if (!ignoreByDate.has(date)) ignoreByDate.set(date, new Set());
    ignoreByDate.get(date)?.add(doc.id);
  });

  const datesToValidate = scope === 'THIS' ? [data.date] : affectedDates;
  await validateNoConflicts(datesToValidate, data.startTime, data.endTime, ignoreByDate);

  const programTitle = await resolveProgramTitle(data.programId ?? null);
  const mediaMap = await resolveMediaMaps(items);
  const updatedBlockIds: string[] = [];

  for (const targetDoc of targetDocs) {
    const targetData = targetDoc.data() ?? {};
    const targetDate = scope === 'THIS' ? data.date : String(targetData.date ?? data.date);

    const startsAt = combineDateAndTimeToDate(targetDate, data.startTime);
    const endsAt = combineDateAndTimeToDate(targetDate, data.endTime);

    await targetDoc.ref.set({
      title: data.title.trim(),
      description: data.description ? String(data.description).trim() : null,
      date: targetDate,
      startTime: data.startTime,
      endTime: data.endTime,
      startsAt: Timestamp.fromDate(startsAt),
      endsAt: Timestamp.fromDate(endsAt),
      programId: data.programId ?? null,
      programTitle,
      status,
      isActive: status === 'ACTIVE',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid
    }, { merge: true });

    await writeItems(targetDoc.ref, items, mediaMap);
    updatedBlockIds.push(targetDoc.id);
  }

  return { ok: true, updatedBlockIds };
});

export const deleteScheduleBlock = onCall(async (request: CallableRequest<unknown>) => {
  const uid = requireAuth(request.auth);
  await requireAdminOrOperator(uid);

  const data = request.data as { blockId: string; deleteScope?: ScopeMode };
  if (!data.blockId) {
    throw new HttpsError('invalid-argument', 'blockId é obrigatório.');
  }

  const baseRef = getDb().collection('scheduleBlocks').doc(data.blockId);
  const baseDoc = await baseRef.get();
  if (!baseDoc.exists) {
    throw new HttpsError('not-found', 'Bloco não encontrado.');
  }

  const baseData = baseDoc.data() ?? {};
  const groupId = typeof baseData.recurrenceGroupId === 'string' ? baseData.recurrenceGroupId : null;
  const scope = (data.deleteScope ?? 'THIS') as ScopeMode;

  let groupDocs: DocumentSnapshot[] = [baseDoc];
  if (groupId && scope !== 'THIS') {
    const snapshot = await getDb().collection('scheduleBlocks').where('recurrenceGroupId', '==', groupId).get();
    groupDocs = snapshot.docs;
  }

  const targetDocs = getScopeDocs(baseDoc, scope, groupDocs);

  for (const doc of targetDocs) {
    const itemsSnapshot = await doc.ref.collection('items').get();
    const batch = getDb().batch();
    itemsSnapshot.docs.forEach((item) => batch.delete(item.ref));
    batch.delete(doc.ref);
    await batch.commit();
  }

  return { ok: true, deletedBlockIds: targetDocs.map((doc) => doc.id), deletedBy: uid };
});

export const reorderScheduleBlockItems = onCall(async (request: CallableRequest<unknown>) => {
  const uid = requireAuth(request.auth);
  await requireAdminOrOperator(uid);

  const data = request.data as { blockId: string; items: Array<{ id: string; order: number }> };
  if (!data.blockId || !Array.isArray(data.items) || !data.items.length) {
    throw new HttpsError('invalid-argument', 'blockId e items são obrigatórios.');
  }

  const orders = data.items.map((item) => Number(item.order));
  const unique = new Set(orders);
  if (orders.some((order) => !Number.isInteger(order) || order <= 0) || unique.size !== orders.length) {
    throw new HttpsError('invalid-argument', 'A ordenação enviada é inválida ou contém duplicidade.');
  }

  const batch = getDb().batch();
  data.items.forEach((item) => {
    const ref = getDb().collection('scheduleBlocks').doc(data.blockId).collection('items').doc(item.id);
    batch.set(ref, { order: item.order, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid }, { merge: true });
  });
  await batch.commit();

  return { ok: true };
});

async function loadBlockItems(blockId: string) {
  const snapshot = await getDb().collection('scheduleBlocks').doc(blockId).collection('items').orderBy('order', 'asc').get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() ?? {};
    return {
      id: doc.id,
      order: Number(data.order ?? 0),
      itemType: String(data.itemType ?? 'MANUAL') as QueueItemType,
      mediaId: typeof data.mediaId === 'string' ? data.mediaId : null,
      mediaTitle: typeof data.mediaTitle === 'string' ? data.mediaTitle : null,
      durationSeconds: Number(data.durationSeconds ?? 0),
      notes: typeof data.notes === 'string' ? data.notes : null,
      isEnabled: data.isEnabled !== false
    };
  });
}

function sumDuration(items: Array<{ durationSeconds: number; isEnabled: boolean }>) {
  return items.filter((item) => item.isEnabled).reduce((acc, item) => acc + Number(item.durationSeconds ?? 0), 0);
}

export async function resolveScheduleDayView(date: string) {
  if (!date) {
    throw new HttpsError('invalid-argument', 'A data é obrigatória.');
  }

  const snapshot = await getDb().collection('scheduleBlocks').where('date', '==', date).get();
  const sortedDocs = snapshot.docs.sort((a, b) => String(a.data().startTime ?? '').localeCompare(String(b.data().startTime ?? '')));

  const blocks = await Promise.all(sortedDocs.map(async (doc) => {
    const blockData = doc.data() ?? {};
    const items = await loadBlockItems(doc.id);

    return {
      id: doc.id,
      title: String(blockData.title ?? 'Bloco sem título'),
      description: typeof blockData.description === 'string' ? blockData.description : null,
      date: String(blockData.date ?? date),
      startTime: String(blockData.startTime ?? '00:00'),
      endTime: String(blockData.endTime ?? '00:00'),
      status: normalizeScheduleStatus(blockData.status),
      isActive: blockData.isActive !== false,
      programId: typeof blockData.programId === 'string' ? blockData.programId : null,
      programTitle: typeof blockData.programTitle === 'string' ? blockData.programTitle : null,
      recurrenceType: (String(blockData.recurrenceType ?? 'NONE').toUpperCase()) as ScheduleRecurrenceType,
      recurrenceGroupId: typeof blockData.recurrenceGroupId === 'string' ? blockData.recurrenceGroupId : null,
      items,
      totalDurationSeconds: sumDuration(items)
    };
  }));

  return { date, blocks };
}

export const getScheduleDayView = onCall(async (request: CallableRequest<unknown>) => {
  const data = request.data as { date: string };
  return resolveScheduleDayView(data?.date);
});

export const getScheduleWeekView = onCall(async (request: CallableRequest<unknown>) => {
  const data = request.data as { weekStartDate: string };
  if (!data?.weekStartDate) {
    throw new HttpsError('invalid-argument', 'weekStartDate é obrigatório.');
  }

  const start = parseDateValue(data.weekStartDate);
  const days: Array<{ date: string; blocks: Array<Record<string, unknown>> }> = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + offset);
    const date = formatDate(current);

    const snapshot = await getDb().collection('scheduleBlocks').where('date', '==', date).get();
    const blocks = await Promise.all(snapshot.docs
      .sort((a, b) => String(a.data().startTime ?? '').localeCompare(String(b.data().startTime ?? '')))
      .map(async (doc) => {
        const blockData = doc.data() ?? {};
        const items = await loadBlockItems(doc.id);
        return {
          id: doc.id,
          title: String(blockData.title ?? 'Bloco sem título'),
          startTime: String(blockData.startTime ?? '00:00'),
          endTime: String(blockData.endTime ?? '00:00'),
          status: normalizeScheduleStatus(blockData.status),
          isActive: blockData.isActive !== false,
          programTitle: typeof blockData.programTitle === 'string' ? blockData.programTitle : null,
          totalDurationSeconds: sumDuration(items)
        };
      }));

    days.push({ date, blocks });
  }

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return {
    weekStartDate: formatDate(start),
    weekEndDate: formatDate(end),
    days
  };
});

export async function resolvePlaybackTimeline(nowIso?: string | null) {
  const now = nowIso ? new Date(nowIso) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new HttpsError('invalid-argument', 'Campo now inválido. Use ISO-8601.');
  }

  const date = now.toISOString().slice(0, 10);
  const dayView = await resolveScheduleDayView(date);

  const timeline: Array<{
    blockId: string;
    blockTitle: string;
    programId: string | null;
    programTitle: string | null;
    itemId: string | null;
    itemTitle: string | null;
    startsAt: Date;
    endsAt: Date;
  }> = [];

  for (const block of dayView.blocks.filter((item) => item.status === 'ACTIVE' && item.isActive)) {
    const blockStart = combineDateAndTimeToDate(block.date, block.startTime);
    const blockEnd = combineDateAndTimeToDate(block.date, block.endTime);
    const enabledItems = block.items.filter((item) => item.isEnabled);

    if (!enabledItems.length) {
      timeline.push({
        blockId: block.id,
        blockTitle: block.title,
        programId: block.programId ?? null,
        programTitle: block.programTitle ?? null,
        itemId: null,
        itemTitle: null,
        startsAt: blockStart,
        endsAt: blockEnd
      });
      continue;
    }

    let cursor = new Date(blockStart);
    for (const item of enabledItems) {
      const durationMs = Math.max(1, Number(item.durationSeconds ?? 0)) * 1000;
      const itemStart = new Date(cursor);
      let itemEnd = new Date(itemStart.getTime() + durationMs);
      if (itemEnd > blockEnd) {
        itemEnd = blockEnd;
      }

      timeline.push({
        blockId: block.id,
        blockTitle: block.title,
        programId: block.programId ?? null,
        programTitle: block.programTitle ?? null,
        itemId: item.id,
        itemTitle: item.mediaTitle ?? item.notes ?? item.itemType,
        startsAt: itemStart,
        endsAt: itemEnd
      });

      cursor = new Date(itemEnd);
      if (cursor >= blockEnd) break;
    }
  }

  const sorted = timeline.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const current = sorted.find((entry) => now >= entry.startsAt && now < entry.endsAt) ?? null;
  const next = sorted.filter((entry) => entry.startsAt > now).slice(0, 10);

  return {
    now: now.toISOString(),
    current: current ? {
      blockId: current.blockId,
      blockTitle: current.blockTitle,
      programId: current.programId,
      programTitle: current.programTitle,
      itemId: current.itemId,
      itemTitle: current.itemTitle,
      startedAt: current.startsAt.toISOString(),
      endsAt: current.endsAt.toISOString()
    } : null,
    next: next.map((item) => ({
      blockId: item.blockId,
      blockTitle: item.blockTitle,
      itemId: item.itemId,
      itemTitle: item.itemTitle,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt.toISOString()
    }))
  };
}

export const getPlaybackTimeline = onCall(async (request: CallableRequest<unknown>) => {
  const data = request.data as { now?: string | null };
  return resolvePlaybackTimeline(data?.now ?? null);
});
