"""CP-SAT solver for NexusTime University Scheduling.

Features:
- Multi-day support (Mon-Sat).
- 50-minute slot logic.
- CourseAssignment based scheduling.
- Teacher, Batch, and Room non-overlap.
- Compact batch schedules (minimizing gaps).
"""

from datetime import time, datetime, timedelta
from django.db import transaction
from ortools.sat.python import cp_model
import math

DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
SLOTS_PER_DAY = 12
SLOT_DURATION = 50  # minutes
START_HOUR = 8
START_MINUTE = 0

# Tier-based weights for satisfying preferences
# Tier 1 = Senior, gets highest priority bonus
TIER_PRIORITY = {1: 500, 2: 100, 3: 20}

# Define precise slot start times to match frontend constants.ts
# Note: Break is handled by the gap between index 5 and 6.
SLOT_START_TIMES = [
    time(8, 0), time(8, 50), time(9, 40), time(10, 30), time(11, 20), time(12, 10),
    time(13, 10), time(14, 0), time(14, 50), time(15, 40), time(16, 30), time(17, 20)
]

def _parse_preference(pref_str: str):
    """Parses 'Day-HH:MM' into (day_index, slot_index)."""
    try:
        parts = pref_str.split('-')
        day = DAYS.index(parts[0])
        # Find closest slot index for this HH:MM
        h, m = map(int, parts[1].split(':'))
        pref_time = time(h, m)
        
        for idx, t in enumerate(SLOT_START_TIMES):
            if t.hour == h and t.minute == m:
                return day, idx
        return None, None
    except:
        return None, None

def _slot_to_time(slot_index: int) -> time:
    if 0 <= slot_index < len(SLOT_START_TIMES):
        return SLOT_START_TIMES[slot_index]
    return time(8, 0)

def solve_timetable(time_limit_seconds: int = 60, constraints: dict | None = None) -> bool:
    try:
        from timetable import models

        rooms = list(models.Room.objects.all())
        rooms_map = {r.pk: r for r in rooms}
        # Pre-fetch everything to avoid N+1 queries
        assignments_list = list(models.CourseAssignment.objects.select_related('course', 'batch', 'teacher').all())
        assignments_map = {a.pk: a for a in assignments_list}
        batches = list(models.Batch.objects.all())
        
        if not rooms or not assignments_list:
            return False

        model = cp_model.CpModel()
        num_days = len(DAYS)
        total_slots = num_days * SLOTS_PER_DAY

        sessions = []
        for assign in assignments_list:
            if assign.type == 'P': # Practical
                sessions.append({'assign_pk': assign.pk, 'slots': 3, 'id': f'assign_{assign.pk}_0'})
            else:
                num_sessions = 2 if assign.weekly_hours >= 3 else 1
                slots_per_session = 2
                for i in range(num_sessions):
                    sessions.append({'assign_pk': assign.pk, 'slots': slots_per_session, 'id': f'assign_{assign.pk}_{i}'})

        # Variables
        session_starts = {}
        session_day_vars = {}
        session_intervals = {}
        room_presences = {} # (sid, room_pk) -> bool

        for s in sessions:
            sid = s['id']
            num_s = s['slots']
            
            # Start variable: must start and end on the same day
            # We constrain this later. For now, 0 to total_slots - num_s
            start_var = model.NewIntVar(0, total_slots - num_s, f'start_{sid}')
            session_starts[sid] = start_var
            
            # Ensure session doesn't cross day boundaries
            day_var = model.NewIntVar(0, num_days - 1, f'day_{sid}')
            model.AddDivisionEquality(day_var, start_var, SLOTS_PER_DAY)
            session_day_vars[sid] = day_var
            
            end_slot = start_var + num_s - 1
            end_day_var = model.NewIntVar(0, num_days - 1, f'end_day_{sid}')
            model.AddDivisionEquality(end_day_var, end_slot, SLOTS_PER_DAY)
            model.Add(day_var == end_day_var)

            # Room assignment
            pres_list = []
            for r in rooms:
                p = model.NewBoolVar(f'pres_{sid}_r{r.pk}')
                room_presences[(sid, r.pk)] = p
                pres_list.append(p)
                
                # Optional interval for this room
                interval = model.NewOptionalIntervalVar(start_var, num_s, start_var + num_s, p, f'interval_{sid}_r{r.pk}')
                session_intervals.setdefault(('room', r.pk), []).append(interval)
            
            model.Add(sum(pres_list) == 1)

            # Batch and Teacher intervals (global intervals for overlap check)
            # Since a session can only be in ONE room, we can't use optional intervals directly for batch/teacher
            # because they might overlap across different rooms.
            # Instead, we use a single interval per session for batch/teacher non-overlap.
            main_interval = model.NewIntervalVar(start_var, num_s, start_var + num_s, f'main_interval_{sid}')
            
            assign = assignments_map[s['assign_pk']]
            session_intervals.setdefault(('batch', assign.batch.pk), []).append(main_interval)
            session_intervals.setdefault(('teacher', assign.teacher.pk), []).append(main_interval)
            
            # ─── Preference Optimization ──────────────────────────────────────
            # If this session starts at a preferred slot, add a bonus to the objective
            teacher = assign.teacher
            tier_bonus = TIER_PRIORITY.get(teacher.tier, 10)
            prefs = teacher.requested_slots or []
            
            for pref in prefs:
                p_day, p_slot = _parse_preference(pref)
                if p_day is not None:
                    # Boolean: Does this session occupy the preferred slot?
                    # Slot is preferred if start_var <= (p_day*SLOTS + p_slot) < start_var + slots
                    pref_abs_slot = p_day * SLOTS_PER_DAY + p_slot
                    is_pref = model.NewBoolVar(f'pref_{sid}_slot_{p_day}_{p_slot}')
                    
                    # session_starts[sid] <= pref_abs_slot AND session_starts[sid] + slots > pref_abs_slot
                    c1 = model.NewBoolVar(f'c1_{sid}_{pref}')
                    model.Add(start_var <= pref_abs_slot).OnlyEnforceIf(c1)
                    model.Add(start_var > pref_abs_slot).OnlyEnforceIf(c1.Not())
                    
                    c2 = model.NewBoolVar(f'c2_{sid}_{pref}')
                    model.Add(start_var + num_s > pref_abs_slot).OnlyEnforceIf(c2)
                    model.Add(start_var + num_s <= pref_abs_slot).OnlyEnforceIf(c2.Not())
                    
                    model.AddBoolAnd([c1, c2]).OnlyEnforceIf(is_pref)
                    model.AddBoolOr([c1.Not(), c2.Not()]).OnlyEnforceIf(is_pref.Not())
                    
                    # Weight by tier
                    s.setdefault('pref_vars', []).append((is_pref, tier_bonus))

        # Constraints: No Overlap
        for key, intervals in session_intervals.items():
            if len(intervals) > 1:
                model.AddNoOverlap(intervals)

        # Objective: Minimize gaps for batches (compact schedule)
        batch_spans = []
        for batch in batches:
            batch_sessions = [s for s in sessions if assignments_map[s['assign_pk']].batch.pk == batch.pk]
            if not batch_sessions: continue
            
            for d in range(num_days):
                # Is session sid on day d?
                # presence_on_day[sid, d] = (session_starts[sid] // SLOTS_PER_DAY == d)
                day_presences = []
                starts_on_day = []
                ends_on_day = []
                
                for s in batch_sessions:
                    sid = s['id']
                    is_on_day = model.NewBoolVar(f'batch_{batch.pk}_s{sid}_d{d}')
                    day_var = session_day_vars[sid]
                    start_var = session_starts[sid]
                    
                    model.Add(day_var == d).OnlyEnforceIf(is_on_day)
                    model.Add(day_var != d).OnlyEnforceIf(is_on_day.Not())
                    day_presences.append(is_on_day)
                    
                    s_rel = model.NewIntVar(0, SLOTS_PER_DAY, f'rel_start_{sid}_d{d}')
                    model.Add(s_rel == start_var - day_var * SLOTS_PER_DAY).OnlyEnforceIf(is_on_day)
                    starts_on_day.append(s_rel)
                    
                    e_rel = model.NewIntVar(0, SLOTS_PER_DAY, f'rel_end_{sid}_d{d}')
                    model.Add(e_rel == start_var + s['slots'] - day_var * SLOTS_PER_DAY).OnlyEnforceIf(is_on_day)
                    ends_on_day.append(e_rel)

                # span for this batch on this day
                if starts_on_day:
                    # span = max(ends) - min(starts)
                    # We minimize this to push sessions together
                    span = model.NewIntVar(0, SLOTS_PER_DAY, f'span_b{batch.pk}_d{d}')
                    
                    # To minimize span correctly:
                    # For all pairs i, j: span >= end[i] - start[j] (if both present)
                    for i in range(len(batch_sessions)):
                        for j in range(len(batch_sessions)):
                            is_both = model.NewBoolVar(f'both_{batch.pk}_d{d}_i{i}_j{j}')
                            model.AddBoolAnd([day_presences[i], day_presences[j]]).OnlyEnforceIf(is_both)
                            model.Add(span >= ends_on_day[i] - starts_on_day[j]).OnlyEnforceIf(is_both)
                    
                    batch_spans.append(span)

        # Objective Part 2: Maximize preferred slots (negative penalty)
        pref_bonuses = []
        for s in sessions:
            for var, weight in s.get('pref_vars', []):
                pref_bonuses.append(var * weight)

        # Minimize (Batch Spans - Teacher Preference Bonuses)
        # Note: we use points, so we'll subtract preferences from the "cost"
        model.Minimize(sum(batch_spans) * 10 - sum(pref_bonuses))

        # Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_seconds)
        status = solver.Solve(model)

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return False

        # Save results
        with transaction.atomic():
            models.ScheduleEntry.objects.filter(is_locked=False).delete()
            for s in sessions:
                sid = s['id']
                start_val = solver.Value(session_starts[sid])
                day_idx = start_val // SLOTS_PER_DAY
                slot_idx = start_val % SLOTS_PER_DAY
                
                room_pk = None
                for r in rooms:
                    if solver.Value(room_presences[(sid, r.pk)]) == 1:
                        room_pk = r.pk
                        break
                
                assign = assignments_map[s['assign_pk']]
                models.ScheduleEntry.objects.create(
                    assignment=assign,
                    room=rooms_map[room_pk],
                    day_of_week=DAYS[day_idx],
                    start_time=_slot_to_time(slot_idx),
                    duration_minutes=s['slots'] * SLOT_DURATION,
                    is_locked=False
                )

        return True
    except Exception as e:
        print(f"Solver error: {e}")
        return False
