import React, { useEffect, useMemo, useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface AppTourGuideProps {
  currentView: string;
}

type TourStep = Step & { route?: string };

const seenKeyForRole = (role?: string | null) => `nexus_tour_seen_${role || 'guest'}`;

const AppTourGuide: React.FC<AppTourGuideProps> = ({ currentView }) => {
  const { user, isAuthenticated } = useAuth();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const seenKey = useMemo(() => seenKeyForRole(user?.role), [user?.role]);

  const internalSteps: TourStep[] = useMemo(() => {
    // If the user is not authenticated, show a login/demo + batch download tour
    if (!isAuthenticated || !user) {
      return [
        { target: '[data-tour="login-form"]', content: 'Welcome — sign in to access the full NexusTime experience.', placement: 'bottom' },
        { target: '[data-tour="login-signin"]', content: 'Enter credentials and click here to sign in.', placement: 'bottom' },
        { target: '[data-tour="login-admin-demo"]', content: 'Use this demo login to explore admin features.', placement: 'bottom' },
        { target: '[data-tour="login-teacher-demo"]', content: 'Use the teacher demo to view schedule features.', placement: 'bottom' },
        { target: '[data-tour="batch-observer"]', content: 'Or download a batch timetable directly from here (no login required).', placement: 'top' },
        { target: '[data-tour="batch-select"]', content: 'Select a batch to preview its sessions.', placement: 'bottom' },
        { target: '[data-tour="batch-download-pdf"]', content: 'Download a PDF of the selected batch timetable.', placement: 'left' },
      ];
    }

    const base: TourStep[] = [
      { target: '[data-tour="app-sidebar"]', content: 'Use this sidebar to navigate between Dashboard, Timetable, Schedule and more.', placement: 'right' },
    ];

    if (user?.role === 'TEACHER') {
      return [
        ...base,
        { target: '[data-tour-nav="schedule"]', content: 'Open your weekly schedule here.', placement: 'right' },
        { target: '[data-tour="teacher-day-selector"]', content: 'Switch days using the top-row day buttons.', placement: 'bottom' },
        { target: '[data-tour="teacher-download-schedule"]', content: 'Download your weekly schedule as PDF.', placement: 'left' },
        { target: '[data-tour="teacher-adjustment-form"]', content: 'Submit an adjustment request for admin review.', placement: 'left' },
        { target: '[data-tour="teacher-adjustment-requests"]', content: 'View pending and resolved adjustment requests here.', placement: 'bottom' },
      ];
    }

    return [
      ...base,
      { target: '[data-tour-nav="dashboard"]', content: 'Open the dashboard for system summaries and KPIs.', placement: 'right' },
      { target: '[data-tour="dashboard-overview"]', content: 'Overview cards show health, utilization and quick metrics.', placement: 'bottom' },
      { target: '[data-tour-nav="timetable"]', content: 'Open the timetable editor to manage sessions.', placement: 'right' },
      { target: '[data-tour="timetable-toolbar"]', content: 'Toolbar for the timetable with editing controls.', placement: 'bottom' },
      { target: '[data-tour="timetable-day-selector"]', content: 'Switch visible day using this selector.', placement: 'bottom' },
      { target: '[data-tour="timetable-zoom-controls"]', content: 'Use these to zoom the timetable grid.', placement: 'left' },
      // Deep timetable interactions
      { target: '[data-tour="timeslot-card"]', content: 'This is a timeslot card — it represents a scheduled class.', placement: 'top' },
      { target: '[data-tour="timeslot-conflict-tooltip"]', content: 'Hover to view conflict details and suggested fixes.', placement: 'top' },
      { target: '[data-tour="timeslot-edit"]', content: 'Admins can edit a session from this button.', placement: 'left' },
      { target: '[data-tour="timeslot-lock"]', content: 'Lock a session to prevent edits or dragging.', placement: 'left' },
      { target: '[data-tour-nav="export"]', content: 'Go to the export/print view for the official map.', placement: 'right' },
      { target: '[data-tour="print-official-map"]', content: 'Print the official UAF map view from here.', placement: 'left' },
      // Add session modal deep steps (will appear when modal is open)
      { target: '[data-tour="modal-assignment"]', content: 'Select the assignment (course · batch · teacher) for this session.', placement: 'bottom' },
      { target: '[data-tour="modal-room"]', content: 'Choose a classroom for the session.', placement: 'bottom' },
      { target: '[data-tour="modal-timeslots"]', content: 'Quick-select common timeslot ranges for convenience.', placement: 'bottom' },
      { target: '[data-tour="modal-duration"]', content: 'Pick the session duration in minutes.', placement: 'bottom' },
      { target: '[data-tour="modal-conflict-preview"]', content: 'Live conflict preview updates as you change fields.', placement: 'top' },
      { target: '[data-tour="modal-submit"]', content: 'Add or update the session using this button.', placement: 'left' },

      // Suggestions deep steps
      { target: '[data-tour-nav="suggestions"]', content: 'Open the Suggestions view to resolve duplicates & conflicts.', placement: 'right' },
      { target: '[data-tour="suggestions-tab-suggestions"]', content: 'Primary tab showing merge candidates and conflicts.', placement: 'bottom' },
      { target: '[data-tour="merge-candidates-header"]', content: 'Merge Candidates lists sections that can be combined to save rooms.', placement: 'bottom' },
      { target: '[data-tour="suggestions-tab-batch-analysis"]', content: 'Switch to Batch Analysis for per-batch metrics and quality checks.', placement: 'bottom' },
      { target: '[data-tour="suggestions-approve-merge"]', content: 'Approve merge candidates to combine overlapping sections.', placement: 'left' },
      { target: '[data-tour="suggestions-locate"]', content: 'Locate a session in the Timetable grid from here.', placement: 'left' },
      { target: '[data-tour="suggestions-conflicts"]', content: 'View detected conflicts and quick-fix suggestions here.', placement: 'bottom' },

      // Generate timetable + Resource management & settings
      { target: '[data-tour="generate-timetable"]', content: 'Click to run the AI timetable generator (admin only).', placement: 'left' },
      { target: '[data-tour-nav="resources"]', content: 'Manage master data like departments, batches and classrooms.', placement: 'right' },
      { target: '[data-tour="resource-tab-departments"]', content: 'Departments tab: manage departments.', placement: 'bottom' },
      { target: '[data-tour="resource-tab-courses"]', content: 'Courses tab: manage course records.', placement: 'bottom' },
      { target: '[data-tour="resource-tab-teachers"]', content: 'Teachers tab: add or edit faculty records.', placement: 'bottom' },
      { target: '[data-tour="resource-tab-batches"]', content: 'Batches tab: manage student groups and intake years.', placement: 'bottom' },
      { target: '[data-tour="resource-tab-assignments"]', content: 'Assignments tab: link courses to batches and teachers.', placement: 'bottom' },
      { target: '[data-tour="resource-tab-classrooms"]', content: 'Classrooms tab: manage room details and capacities.', placement: 'bottom' },
      { target: '[data-tour-nav="settings"]', content: 'Open system settings to change global preferences.', placement: 'right' },
      { target: '[data-tour="settings-save-changes"]', content: 'Save system settings and theme here.', placement: 'left' },
    ];
  }, [user?.role, currentView]);

  const formattedSteps = internalSteps.map(s => ({
    target: s.target,
    content: s.content,
    placement: s.placement,
    disableBeacon: true,
  }));

  const startTour = (auto = false) => {
    setStepIndex(0);
    setRun(true);
    if (auto) {
      try { localStorage.removeItem(seenKey); } catch (_) {}
    }
  };

  const waitForTarget = (target: string | HTMLElement | undefined | null, timeout = 3000) => {
    return new Promise<boolean>((resolve) => {
      if (!target) return resolve(false);
      if (typeof target !== 'string') return resolve(true);
      const start = Date.now();
      const attempt = () => {
        const el = document.querySelector(target as string);
        if (el) return resolve(true);
        if (Date.now() - start > timeout) return resolve(false);
        setTimeout(attempt, 150);
      };
      attempt();
    });
  };

  const handleJoyrideCallback = async (data: CallBackProps) => {
    const { status, index, type, action } = data as CallBackProps & { action?: string };
    const act = String(action);

    // End/skip the tour (user finished or skipped)
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      try { localStorage.setItem(seenKey, '1'); } catch (_) {}
      return;
    }
    // Some Joyride UI emits explicit actions like 'close' or 'skip' — treat them like skip
    if (act === 'close' || act === 'skip') {
      setRun(false);
      try { localStorage.setItem(seenKey, '1'); } catch (_) {}
      return;
    }

    // Before showing a step: ensure navigation targets are mounted
    if (type === 'step:before') {
      const next = internalSteps[index];
      if (!next) return;
      const target = next.target;

      if (typeof target === 'string') {
        // If the step asks us to navigate via sidebar nav, click it.
        if (target.includes('data-tour-nav')) {
          const nav = document.querySelector(target) as HTMLElement | null;
          if (nav) nav.click();

          const found = await waitForTarget(internalSteps[index].target, 2500);
          setTimeout(() => setStepIndex(index), found ? 50 : 500);
          return;
        }

        // If the step targets an internal resource tab or suggestions tab, click the tab button
        // so that its content becomes active before the tour highlights it.
        if (target.includes('resource-tab-') || target.includes('suggestions-tab-')) {
          const tabBtn = document.querySelector(target) as HTMLElement | null;
          if (tabBtn) tabBtn.click();

          const found = await waitForTarget(target, 2000);
          setTimeout(() => setStepIndex(index), found ? 50 : 500);
          return;
        }
      }

      const found = await waitForTarget(target, 2000);
      setTimeout(() => setStepIndex(index), found ? 50 : 500);
      return;
    }

    // After a step completes: handle next/prev (Back) navigation correctly
    if (type === 'step:after') {
      if (typeof index !== 'number') return;

      // Move backwards when user clicked the Back/Prev control
      if (act === 'prev' || act === 'back') {
        const prevIndex = Math.max(index - 1, 0);
        setStepIndex(prevIndex);
        return;
      }

      // Default: advance to next step
      const nextIndex = index + 1;
      if (nextIndex >= formattedSteps.length) {
        setRun(false);
        try { localStorage.setItem(seenKey, '1'); } catch (_) {}
        return;
      }
      setStepIndex(nextIndex);
      return;
    }

    if (type === 'error:target_not_found') {
      // Retry the same step after a short delay
      setTimeout(() => setStepIndex(index), 600);
      return;
    }
  };

  useEffect(() => {
    try {
      if (localStorage.getItem(seenKey) === '1') return;
    } catch (_) {}
    // auto-start the tour once per role after a small delay
    const timer = window.setTimeout(() => startTour(true), 700);
    return () => window.clearTimeout(timer);
  }, [seenKey]);

  return (
    <>
      <Joyride
        steps={formattedSteps}
        run={run}
        stepIndex={stepIndex}
        continuous
        showSkipButton
        showProgress
        disableCloseOnEsc={false}
        disableOverlayClose={false}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip'
        }}
        scrollToFirstStep
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: '#0f766e',
            overlayColor: 'rgba(2,6,23,0.75)',
            // keep default border radius; avoid unsupported style keys for type safety
          }
        }}
        callback={handleJoyrideCallback}
      />

      <button
        type="button"
        onClick={() => startTour(false)}
        className="fixed bottom-6 right-6 z-[90] rounded-full bg-slate-900 w-12 h-12 flex items-center justify-center text-white shadow-2xl shadow-slate-900/30 transition-transform hover:scale-105 active:scale-95 print:hidden"
        data-tour="start-tour-button"
        aria-label="Start Tour"
        title="Start Tour"
      >
        <HelpCircle className="h-5 w-5 text-emerald-400" />
      </button>
    </>
  );
};

export default AppTourGuide;