from celery import shared_task


@shared_task(bind=True)
def generate_timetable(self, constraints=None):
    """Celery task wrapper for the solver.

    `constraints` is expected to be a JSON-serializable dict with optional
    keys like `breakStart`, `breakEnd`, `maxDailyClasses`, `gapPenalty`.
    """
    try:
        from solver.solver import solve_timetable
        try:
            from .sse import emit_analytics_event
        except Exception:
            emit_analytics_event = None

        task_id = getattr(self.request, 'id', None)
        try:
            if emit_analytics_event:
                emit_analytics_event('solver_started', f'Solver task started: {task_id}', {'task_id': task_id})
        except Exception:
            pass

        result = solve_timetable(constraints=constraints)

        try:
            if emit_analytics_event:
                emit_analytics_event('solver_finished', f'Solver task finished: {task_id}', {'task_id': task_id, 'ok': bool(result)})
        except Exception:
            pass

        return {'ok': bool(result)}
    except Exception as e:
        try:
            if 'emit_analytics_event' in locals() and emit_analytics_event:
                emit_analytics_event('solver_failed', 'Solver task failed', {'error': str(e)})
        except Exception:
            pass
        return {'ok': False, 'error': str(e)}


def _compute_compact_plan(batch_pk, day=None, settings_obj=None):
    """Compute a compacting plan for a batch (and optional day) without applying changes.

    Returns a dict with keys: affected_entries, proposals: [{entry_pk, orig_start, new_start, duration}]
    """
    from . import models
    from django.conf import settings as djsettings

    sc = settings_obj or models.SystemConfiguration.objects.first()
    day_start_min = int(getattr(djsettings, 'ANALYTICS_DAY_START_HOUR', 8)) * 60
    day_end_min = int(getattr(djsettings, 'ANALYTICS_DAY_END_HOUR', 18)) * 60
    break_start_min = None
    break_end_min = None
    if sc and sc.break_start:
        break_start_min = sc.break_start.hour * 60 + sc.break_start.minute
    if sc and sc.break_end:
        break_end_min = sc.break_end.hour * 60 + sc.break_end.minute

    entries_qs = models.ScheduleEntry.objects.select_related('assignment__teacher', 'room').filter(assignment__batch__pk=batch_pk)
    if day:
        entries_qs = entries_qs.filter(day_of_week=day)

    other_day_entries = models.ScheduleEntry.objects.select_related('assignment__teacher', 'room')
    if day:
        other_day_entries = other_day_entries.filter(day_of_week=day)
    else:
        other_day_entries = other_day_entries.filter(day_of_week__in=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])

    teacher_busy = {}
    room_busy = {}

    for oe in other_day_entries:
        # Skip unlocked entries from our target batch (they are movable)
        if oe.assignment and oe.assignment.batch and oe.assignment.batch.pk == batch_pk and not oe.is_locked:
            continue
        try:
            st = oe.start_time.hour * 60 + oe.start_time.minute
            en = st + (oe.duration_minutes or 0)
        except Exception:
            continue
        if oe.assignment and oe.assignment.teacher:
            teacher_busy.setdefault(oe.assignment.teacher.pk, []).append((st, en))
        if oe.room:
            room_busy.setdefault(oe.room.pk, []).append((st, en))

    for k in teacher_busy:
        teacher_busy[k].sort()
    for k in room_busy:
        room_busy[k].sort()

    target_entries = list(entries_qs.order_by('start_time'))

    def overlaps(intervals, s, e):
        for a, b in intervals:
            if s < b and a < e:
                return True
        return False

    def add_interval(mapping, key, s, e):
        if key is None: return
        lst = mapping.setdefault(key, [])
        lst.append((s, e))

    proposals = []
    prev_end = day_start_min
    for ent in target_entries:
        try:
            orig_start = ent.start_time.hour * 60 + ent.start_time.minute
        except Exception:
            continue
        duration = ent.duration_minutes or 0
        orig_end = orig_start + duration

        if ent.is_locked:
            prev_end = max(prev_end, orig_end)
            if ent.assignment and ent.assignment.teacher:
                add_interval(teacher_busy, ent.assignment.teacher.pk, orig_start, orig_end)
            if ent.room:
                add_interval(room_busy, ent.room.pk, orig_start, orig_end)
            continue

        candidate = max(prev_end, day_start_min)
        found = False
        step = 5
        while candidate + duration <= day_end_min:
            cand_end = candidate + duration
            if break_start_min is not None and break_end_min is not None and candidate < break_end_min and break_start_min < cand_end:
                candidate = break_end_min
                continue
            tid = ent.assignment.teacher.pk if ent.assignment and ent.assignment.teacher else None
            if tid is not None and overlaps(teacher_busy.get(tid, []), candidate, cand_end):
                candidate += step
                continue
            rid = ent.room.pk if ent.room else None
            if rid is not None and overlaps(room_busy.get(rid, []), candidate, cand_end):
                candidate += step
                continue
            found = True
            break

        if not found:
            prev_end = max(prev_end, orig_end)
            if ent.assignment and ent.assignment.teacher:
                add_interval(teacher_busy, ent.assignment.teacher.pk, orig_start, orig_end)
            if ent.room:
                add_interval(room_busy, ent.room.pk, orig_start, orig_end)
            continue

        proposals.append({
            'entry_pk': ent.pk,
            'orig_start': orig_start,
            'new_start': candidate,
            'duration': duration,
        })

        add_interval(teacher_busy, ent.assignment.teacher.pk if ent.assignment and ent.assignment.teacher else None, candidate, candidate + duration)
        add_interval(room_busy, ent.room.pk if ent.room else None, candidate, candidate + duration)
        prev_end = max(prev_end, candidate + duration)

    return {'affected_entries': len(target_entries), 'proposals': proposals}


@shared_task(bind=True)
def compact_schedule_task(self, batch_pk, day=None, user_id=None):
    """Run compacting in background and apply moves to ScheduleEntry rows.

    Returns a summary dict.
    """
    try:
        from .sse import emit_analytics_event
    except Exception:
        emit_analytics_event = None

    plan = _compute_compact_plan(batch_pk, day)
    updated_ids = []
    moved = 0

    from django.db import transaction
    from . import models
    from datetime import time as dt_time

    with transaction.atomic():
        for p in plan['proposals']:
            try:
                ent = models.ScheduleEntry.objects.select_for_update().get(pk=p['entry_pk'])
            except Exception:
                continue
            orig_start = ent.start_time.hour * 60 + ent.start_time.minute
            if orig_start == p['new_start']:
                continue
            new_time = dt_time(hour=(p['new_start'] // 60) % 24, minute=(p['new_start'] % 60))
            ent.start_time = new_time
            ent.save()
            updated_ids.append(ent.pk)
            moved += 1

    try:
        if emit_analytics_event:
            emit_analytics_event('compact_applied', f'Compact applied for batch {batch_pk}', {'moved': moved, 'updated_ids': updated_ids}, user_id=user_id)
    except Exception:
        pass

    return {'moved': moved, 'affected_entries': plan['affected_entries'], 'updated_ids': updated_ids, 'task_id': getattr(self.request, 'id', None)}
