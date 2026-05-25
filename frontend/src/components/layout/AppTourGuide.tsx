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
      { target: '[data-tour="dashboard-overview"]', content: 'Overview cards show system health, room utilization, and active conflicts.', placement: 'bottom' },
      { target: '[data-tour-nav="timetable"]', content: 'Open the Timetable editor to visually schedule classes.', placement: 'right' },
      { target: '[data-tour="timetable-toolbar"]', content: 'The toolbar lets you change days, refresh the schedule, and switch to raw view.', placement: 'bottom' },
      { target: '[data-tour="timetable-day-selector"]', content: 'Switch the active day of the week using this selector.', placement: 'bottom' },
      { target: '[data-tour="timetable-zoom-controls"]', content: 'Zoom the timetable grid layout for high-density viewing.', placement: 'left' },
      { target: '[data-tour-nav="suggestions"]', content: 'Open Suggestions to optimize class groupings and resolve issues.', placement: 'right' },
      { target: '[data-tour="suggestions-tab-suggestions"]', content: 'The Suggestions tab shows AI-driven merge candidates and conflict reports.', placement: 'bottom' },
      { target: '[data-tour="merge-candidates-header"]', content: 'Approve merge suggestions here to combine classes and free up rooms.', placement: 'bottom' },
      { target: '[data-tour="suggestions-tab-batch-analysis"]', content: 'Switch to Batch Analysis to inspect slot distributions by student groups.', placement: 'bottom' },
      { target: '[data-tour-nav="resources"]', content: 'Go to Resources to configure department and room records.', placement: 'right' },
      { target: '[data-tour="resource-tab-departments"]', content: 'Manage departments, courses, teachers, student batches, assignments, and classrooms.', placement: 'bottom' },
      { target: '[data-tour-nav="export"]', content: 'Go to Print Timetable to view or download the official schedule map.', placement: 'right' },
      { target: '[data-tour-nav="settings"]', content: 'Open system settings to adjust global configurations.', placement: 'right' },
      { target: '[data-tour="settings-save-changes"]', content: 'Save changes to organization parameters, break times, and themes here.', placement: 'left' },
      { target: '[data-tour="generate-timetable"]', content: 'Click "Generate Timetable" to trigger the AI scheduler and optimize scheduling from scratch.', placement: 'right' },
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

      const performScroll = (tgt: string | HTMLElement) => {
        if (typeof tgt === 'string') {
          const el = document.querySelector(tgt);
          if (el) {
            el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
          }
        }
      };

      if (typeof target === 'string') {
        // If the step asks us to navigate via sidebar nav, click it.
        if (target.includes('data-tour-nav')) {
          const nav = document.querySelector(target) as HTMLElement | null;
          if (nav) nav.click();

          const found = await waitForTarget(internalSteps[index].target, 2500);
          if (found) performScroll(internalSteps[index].target);
          setTimeout(() => setStepIndex(index), found ? 50 : 500);
          return;
        }

        // If the step targets an internal resource tab or suggestions tab, click the tab button
        // so that its content becomes active before the tour highlights it.
        if (target.includes('resource-tab-') || target.includes('suggestions-tab-')) {
          const tabBtn = document.querySelector(target) as HTMLElement | null;
          if (tabBtn) tabBtn.click();

          const found = await waitForTarget(target, 2000);
          if (found) performScroll(target);
          setTimeout(() => setStepIndex(index), found ? 50 : 500);
          return;
        }
      }

      const found = await waitForTarget(target, 2000);
      if (found) performScroll(target);
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
      console.warn('Tour target not found:', data.step.target);
      const nextIndex = index + 1;
      if (nextIndex >= formattedSteps.length) {
        setRun(false);
        try { localStorage.setItem(seenKey, '1'); } catch (_) {}
      } else {
        setStepIndex(nextIndex);
      }
      return;
    }
  };

  useEffect(() => {
    try {
      if (localStorage.getItem(seenKey) === '1') return;
    } catch (_) {}
    // Auto-start the tour only when the user is on the dashboard view.
    // This avoids the Joyride overlay unintentionally blocking interactive
    // pages like Suggestions where users need to click action buttons.
    if (currentView !== 'dashboard') return;
    const timer = window.setTimeout(() => startTour(true), 700);
    return () => window.clearTimeout(timer);
  }, [seenKey, currentView]);

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
        disableScrolling={true}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip'
        }}
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: '#0f766e',
            overlayColor: 'rgba(2,6,23,0.75)',
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