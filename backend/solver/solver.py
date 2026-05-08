"""CP-SAT solver for NexusTime.

This implementation is an MVP: it splits each `CourseLoad`'s `weekly_hours`
into multiple sessions (when needed), respects locked `ScheduleEntry` rows,
enforces no-overlap for teachers, batches and rooms, enforces a fixed lunch
break, minimizes per-batch span, and persists generated `ScheduleEntry` rows
back into the database.

Key behavior changes from the previous simple solver:
- A `CourseLoad` with `weekly_hours` is split into N sessions so that:
  - each session duration is between 30 and 180 minutes,
  - the sessions sum to `weekly_hours * 60` minutes,
  - N is chosen to minimize excessively long sessions (ceil by max length),
  - durations are evenly distributed (remainder distributed as +1 minute blocks).

Simplifications kept for the MVP:
- Sessions are scheduled on a single day (`day_of_week='Mon'`).
- There's a single lunch break (13:00–13:40) which sessions cannot overlap.
"""

from datetime import time
from django.db import transaction
from ortools.sat.python import cp_model
import math

# Delay importing Django models until runtime to avoid requiring DJANGO_SETTINGS_MODULE
# when this module is imported outside a configured Django context (e.g., during quick
# python -c invocations). Models are imported inside `solve_timetable`.


def _mins_to_time(mins_from_8am: int) -> time:
    base = 8 * 60
    total = base + int(mins_from_8am)
    h = total // 60
    m = total % 60
    if h >= 24:
        h = h % 24
    return time(hour=h, minute=m)


def _split_into_sessions(total_minutes: int, min_dur: int = 30, max_dur: int = 180):
    """Split total_minutes into a list of integer session durations.

    Strategy:
    - Start with the minimum number of sessions to keep each <= max_dur (ceil).
    - If that produces sessions < min_dur, reduce the number of sessions.
    - Evenly distribute the remainder minutes among the sessions.
    """
    if total_minutes <= 0:
        return [min_dur]

    n = max(1, math.ceil(total_minutes / max_dur))
    # Decrease n while base duration becomes too small
    while True:
        base = total_minutes // n
        if base < min_dur and n > 1:
            n -= 1
            continue
        if base > max_dur:
            n += 1
            continue
        break

    base = total_minutes // n
    rem = total_minutes - base * n
    durations = [base + 1] * rem + [base] * (n - rem)
    # Final safety: clamp each duration
    durations = [max(min_dur, min(max_dur, int(d))) for d in durations]
    return durations


def solve_timetable(time_limit_seconds: int = 60, horizon: int = 12 * 60) -> bool:
    """Solve and persist timetable entries.

    Returns True if a feasible/optimal solution was found and persisted,
    otherwise False.
    """
    try:
        # Import models here so the module can be imported without Django settings.
        from timetable import models

        rooms = list(models.Room.objects.select_related('floor__building').all())
        if not rooms:
            return False

        # Collect locked schedule entries (treated as fixed intervals)
        locked_entries = list(
            models.ScheduleEntry.objects.filter(is_locked=True)
            .select_related('room', 'course_load__faculty')
        )

        # Build sessions to schedule: include CourseLoads that do NOT have a
        # locked ScheduleEntry. Locked entries are added as "fixed" sessions
        # to the constraint model so they block resources.
        course_loads = list(models.CourseLoad.objects.select_related('faculty').all())

        sessions = []

        # Add locked schedule entries as fixed sessions
        for ent in locked_entries:
            start_m = ent.start_time.hour * 60 + ent.start_time.minute - 8 * 60
            if start_m < 0:
                start_m = 0
            sessions.append(
                {
                    'kind': 'locked',
                    'id': f'locked_{ent.pk}',
                    'dur': int(ent.duration_minutes),
                    'fixed_start': int(start_m),
                    'faculty_pk': ent.course_load.faculty.pk if ent.course_load and ent.course_load.faculty else None,
                    'batch_id': ent.course_load.batch_id if ent.course_load else None,
                    'room_pk': ent.room.pk if ent.room else None,
                    'entry_pk': ent.pk,
                }
            )

        # Add CourseLoads to be scheduled (skip those with locked entries)
        course_load_pks_to_schedule = []
        for cl in course_loads:
            if cl.entries.filter(is_locked=True).exists():
                continue
            total_minutes = max(30, int(cl.weekly_hours * 60))
            durations = _split_into_sessions(total_minutes)
            course_load_pks_to_schedule.append(cl.pk)
            for i, dur in enumerate(durations):
                sessions.append(
                    {
                        'kind': 'courseload',
                        'id': f'cl_{cl.pk}_{i}',
                        'dur': int(dur),
                        'faculty_pk': cl.faculty.pk if cl.faculty else None,
                        'batch_id': cl.batch_id,
                        'course_load_pk': cl.pk,
                    }
                )

        model = cp_model.CpModel()

        # Containers
        start_vars = {}
        end_vars = {}
        common_intervals = {}
        presence = {}  # (session_id, room_pk) -> BoolVar
        room_intervals = {r.pk: [] for r in rooms}
        courseload_intervals = {}

        # Create variables and intervals
        for s in sessions:
            sid = s['id']
            dur = int(s['dur'])
            if dur <= 0 or dur > horizon:
                dur = min(max(30, dur), horizon)

            start = model.NewIntVar(0, horizon - dur, f'start_{sid}')
            end = model.NewIntVar(0, horizon, f'end_{sid}')
            interval = model.NewIntervalVar(start, dur, end, f'interval_{sid}')

            start_vars[sid] = start
            end_vars[sid] = end
            common_intervals[sid] = interval

            # Track per-courseload intervals for non-overlap
            if s.get('kind') == 'courseload' and s.get('course_load_pk'):
                courseload_intervals.setdefault(s['course_load_pk'], []).append(interval)

            # If the session is locked, fix the start time
            if s.get('kind') == 'locked' and s.get('fixed_start') is not None:
                model.Add(start == int(s['fixed_start']))

            # Room assignment via optional intervals (one presence boolean per room)
            pres_list = []
            for r in rooms:
                p = model.NewBoolVar(f'pres_{sid}_r{r.pk}')
                presence[(sid, r.pk)] = p
                opt_interval = model.NewOptionalIntervalVar(start, dur, end, p, f'room_interval_{sid}_r{r.pk}')
                room_intervals[r.pk].append(opt_interval)
                pres_list.append(p)

            # Exactly one room must be chosen
            model.Add(sum(pres_list) == 1)

            # If session already locked to a room, force the presence
            if s.get('kind') == 'locked' and s.get('room_pk'):
                for r in rooms:
                    p = presence[(sid, r.pk)]
                    if r.pk == s['room_pk']:
                        model.Add(p == 1)
                    else:
                        model.Add(p == 0)

        # Room non-overlap
        for r in rooms:
            model.AddNoOverlap(room_intervals[r.pk])

        # Teacher and batch non-overlap (use the common intervals)
        teachers = {}
        batches = {}
        for s in sessions:
            sid = s['id']
            interval = common_intervals[sid]
            fk = s.get('faculty_pk')
            if fk:
                teachers.setdefault(fk, []).append(interval)
            bid = s.get('batch_id')
            if bid:
                batches.setdefault(bid, []).append(interval)

        for intervals in teachers.values():
            if len(intervals) > 1:
                model.AddNoOverlap(intervals)

        for intervals in batches.values():
            if len(intervals) > 1:
                model.AddNoOverlap(intervals)

        # Ensure multiple sessions of the same CourseLoad do not overlap
        for intervals in courseload_intervals.values():
            if len(intervals) > 1:
                model.AddNoOverlap(intervals)

        # Fixed lunch break(s) - prevent overlap with these intervals
        # (minutes from 8:00). Default: 13:00 - 13:40 -> 300..340
        breaks = [(300, 40)]
        for s in sessions:
            sid = s['id']
            for bstart, bdur in breaks:
                bend = bstart + bdur
                before = model.NewBoolVar(f'before_{sid}_b{bstart}')
                after = model.NewBoolVar(f'after_{sid}_b{bstart}')
                model.Add(end_vars[sid] <= bstart).OnlyEnforceIf(before)
                model.Add(start_vars[sid] >= bend).OnlyEnforceIf(after)
                model.AddBoolOr([before, after])

        # Gap minimizer: for each batch, minimize span = max_end - min_start
        span_vars = []
        for idx, (bid, intervals) in enumerate(batches.items()):
            if not intervals:
                continue
            # Gather start/end vars for sessions in this batch
            starts = []
            ends = []
            for s in sessions:
                if s.get('batch_id') == bid:
                    starts.append(start_vars[s['id']])
                    ends.append(end_vars[s['id']])

            if not starts:
                continue

            min_start = model.NewIntVar(0, horizon, f'min_start_{idx}')
            max_end = model.NewIntVar(0, horizon, f'max_end_{idx}')
            model.AddMinEquality(min_start, starts)
            model.AddMaxEquality(max_end, ends)

            span = model.NewIntVar(0, horizon, f'span_{idx}')
            model.Add(span == max_end - min_start)
            span_vars.append(span)

        # Objective: minimize sum of spans (encourages compact schedules per batch)
        if span_vars:
            model.Minimize(sum(span_vars))

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_seconds)
        solver.parameters.num_search_workers = 8

        status = solver.Solve(model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return False

        # Persist results: update/create ScheduleEntry rows for CourseLoads
        with transaction.atomic():
            # Remove unlocked entries for the course loads we replaced
            if course_load_pks_to_schedule:
                models.ScheduleEntry.objects.filter(course_load__pk__in=course_load_pks_to_schedule, is_locked=False).delete()

            for s in sessions:
                sid = s['id']
                # Determine assigned room
                assigned_room_pk = None
                for r in rooms:
                    p = presence[(sid, r.pk)]
                    if solver.Value(p) == 1:
                        assigned_room_pk = r.pk
                        break

                assigned_start = solver.Value(start_vars[sid])

                if s.get('kind') == 'courseload' and s.get('course_load_pk'):
                    cl_pk = s['course_load_pk']
                    cl = models.CourseLoad.objects.get(pk=cl_pk)

                    room_obj = models.Room.objects.get(pk=assigned_room_pk) if assigned_room_pk else None
                    start_time = _mins_to_time(assigned_start)
                    entry = models.ScheduleEntry.objects.create(
                        course_load=cl,
                        room=room_obj,
                        day_of_week='Mon',
                        start_time=start_time,
                        duration_minutes=int(s['dur']),
                        is_locked=False,
                    )
                    entry.save()

        return True
    except Exception:
        return False
