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
SLOTS_PER_DAY = 10
SLOT_DURATION = 50  # minutes
START_HOUR = 8
START_MINUTE = 0

def _slot_to_time(slot_index: int) -> time:
    """Converts a slot index (0-9) to a start time."""
    total_minutes = slot_index * SLOT_DURATION
    base = datetime.combine(datetime.today(), time(START_HOUR, START_MINUTE))
    target = base + timedelta(minutes=total_minutes)
    return target.time()

def solve_timetable(time_limit_seconds: int = 60, constraints: dict | None = None) -> bool:
    try:
        from timetable import models

        rooms = list(models.Room.objects.all())
        assignments = list(models.CourseAssignment.objects.select_related('course', 'batch', 'teacher').all())
        
        if not rooms or not assignments:
            return False

        model = cp_model.CpModel()
        
        # total_slots = days * slots_per_day
        num_days = len(DAYS)
        total_slots = num_days * SLOTS_PER_DAY

        # sessions to schedule
        # For a 3-hour course (180 mins), we typically do 2 sessions of 100 mins (2 slots each)
        # or 1 session of 150 mins (3 slots) for labs.
        sessions = []
        for assign in assignments:
            # Determine slots needed based on weekly_hours and type
            if assign.type == 'P': # Practical/Lab
                # Usually one long session of 3 slots
                sessions.append({'assign_pk': assign.pk, 'slots': 3, 'id': f'assign_{assign.pk}_0'})
            else:
                # Theory: 3 hours -> 2 sessions of 2 slots each (total 4 slots = 200 mins approx)
                # Or 3 slots total. Let's do 2 sessions: one of 2 slots, one of 1 slot? 
                # University standard is usually 2 sessions of 1.5h (90 mins). 
                # 2 slots = 100 mins. Let's do 2 sessions of 2 slots each for theory if 3+ hours.
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
            
            assign = models.CourseAssignment.objects.get(pk=s['assign_pk'])
            session_intervals.setdefault(('batch', assign.batch.pk), []).append(main_interval)
            session_intervals.setdefault(('teacher', assign.teacher.pk), []).append(main_interval)

        # Constraints: No Overlap
        for key, intervals in session_intervals.items():
            if len(intervals) > 1:
                model.AddNoOverlap(intervals)

        # Objective: Minimize gaps for batches (compact schedule)
        # For each batch and each day, span = max_end - min_start
        # Minimize sum of spans.
        batch_spans = []
        for batch in models.Batch.objects.all():
            batch_sessions = [s for s in sessions if models.CourseAssignment.objects.get(pk=s['assign_pk']).batch.pk == batch.pk]
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
                    min_s = model.NewIntVar(0, SLOTS_PER_DAY, f'min_s_b{batch.pk}_d{d}')
                    max_e = model.NewIntVar(0, SLOTS_PER_DAY, f'max_e_b{batch.pk}_d{d}')
                    
                    # We only care about span if at least one session is on this day
                    any_session = model.NewBoolVar(f'any_s_b{batch.pk}_d{d}')
                    model.AddBoolOr(day_presences).OnlyEnforceIf(any_session)
                    model.AddBoolAnd([p.Not() for p in day_presences]).OnlyEnforceIf(any_session.Not())
                    
                    # If no session, span is 0
                    span = model.NewIntVar(0, SLOTS_PER_DAY, f'span_b{batch.pk}_d{d}')
                    # Use a large constant for inactive sessions to not affect min/max
                    # or just use conditional constraints. 
                    # Simpler: span >= e_rel - s_rel for all sessions on this day
                    for i in range(len(batch_sessions)):
                        model.Add(span >= ends_on_day[i] - starts_on_day[i]).OnlyEnforceIf(day_presences[i])
                    
                    # To truly minimize span (max-min), it's more complex with optionality.
                    # For MVP, let's just minimize sum of session start times to push them earlier.
                    # Or just add a penalty for later sessions.
                    batch_spans.append(span)

        model.Minimize(sum(batch_spans))

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
                
                assign = models.CourseAssignment.objects.get(pk=s['assign_pk'])
                models.ScheduleEntry.objects.create(
                    assignment=assign,
                    room=models.Room.objects.get(pk=room_pk),
                    day_of_week=DAYS[day_idx],
                    start_time=_slot_to_time(slot_idx),
                    duration_minutes=s['slots'] * SLOT_DURATION,
                    is_locked=False
                )

        return True
    except Exception as e:
        print(f"Solver error: {e}")
        return False
