import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from '../../context/AuthContext.tsx';

interface AppTourGuideProps {
  currentView: string;
}

const seenKeyForRole = (role?: string | null) => `nexus_tour_seen_${role || 'guest'}`;

export const AppTourGuide: React.FC<AppTourGuideProps> = ({ currentView }) => {
  const { user, isAuthenticated } = useAuth();
  const driverRef = useRef<Driver | null>(null);
  const autoStartedRef = useRef(false);
  const [isStarting, setIsStarting] = useState(false);

  const seenKey = useMemo(() => seenKeyForRole(user?.role), [user?.role]);

  const steps = useMemo(() => {
    const baseSteps = [
      {
        element: '[data-tour="app-sidebar"]',
        popover: {
          title: 'App navigation',
          description: 'This sidebar is the main control surface for the app. Use it to switch between timetable, schedule, export, and settings.',
          side: 'right' as const,
        },
      },
    ];

    if (user?.role === 'TEACHER') {
      return [
        ...baseSteps,
        {
          element: '[data-tour-nav="schedule"]',
          popover: {
            title: 'My Schedule',
            description: 'This opens your weekly timetable. It is the default landing page after teacher login.',
            side: 'right' as const,
          },
        },
        {
          element: '[data-tour="teacher-schedule-page"]',
          popover: {
            title: 'Daily schedule',
            description: `You can review the classes for ${currentView === 'schedule' ? 'the selected day' : 'your day'} here and switch days from the top row.`,
            side: 'top' as const,
          },
        },
        {
          element: '[data-tour="teacher-download-schedule"]',
          popover: {
            title: 'Download week schedule',
            description: 'Use this button to export your full weekly schedule as a PDF.',
            side: 'left' as const,
          },
        },
        {
          element: '[data-tour="teacher-adjustment-form"]',
          popover: {
            title: 'Adjustment request',
            description: 'Submit a timetable adjustment request for admin review from here.',
            side: 'left' as const,
          },
        },
      ];
    }

    return [
      ...baseSteps,
      {
        element: '[data-tour-nav="dashboard"]',
        popover: {
          title: 'Dashboard',
          description: 'Open the live dashboard for efficiency, utilization, and activity logs.',
          side: 'right' as const,
        },
      },
      {
        element: '[data-tour="dashboard-overview"]',
        popover: {
          title: 'Live overview',
          description: 'These cards summarize the system health and scheduling metrics.',
          side: 'bottom' as const,
        },
      },
      {
        element: '[data-tour-nav="timetable"]',
        popover: {
          title: 'Timetable grid',
          description: 'Switch here to edit the grid and manage sessions.',
          side: 'right' as const,
        },
      },
      {
        element: '[data-tour-nav="export"]',
        popover: {
          title: 'Print timetable',
          description: 'Use this page to print the official UAF map view.',
          side: 'right' as const,
        },
      },
      {
        element: '[data-tour="generate-timetable"]',
        popover: {
          title: 'Generate timetable',
          description: 'This triggers the scheduling engine to rebuild the timetable from the current constraints.',
          side: 'top' as const,
        },
      },
    ];
  }, [currentView, user?.role]);

  const startTour = () => {
    if (!isAuthenticated || !user) return;
    if (typeof window === 'undefined') return;

    if (driverRef.current) {
      try { driverRef.current.destroy(); } catch (_) {}
      driverRef.current = null;
    }

    setIsStarting(true);
    const instance = driver({
      animate: true,
      allowClose: true,
      allowKeyboardControl: true,
      overlayOpacity: 0.55,
      smoothScroll: true,
      showProgress: true,
      progressText: 'Tour progress',
      doneBtnText: 'Finish',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      steps: steps as any,
      onDestroyed: () => {
        if (autoStartedRef.current) {
          try { localStorage.setItem(seenKey, '1'); } catch (_) {}
        }
        autoStartedRef.current = false;
        setIsStarting(false);
      },
    });
    driverRef.current = instance;
    instance.drive();
  };

  useEffect(() => {
    const onStartTour = () => startTour();
    window.addEventListener('nexus:start-tour', onStartTour as EventListener);
    return () => {
      window.removeEventListener('nexus:start-tour', onStartTour as EventListener);
      try { driverRef.current?.destroy(); } catch (_) {}
      driverRef.current = null;
    };
  }, [steps, isAuthenticated, user, seenKey]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(seenKey) === '1') return;
    } catch (_) {}

    autoStartedRef.current = true;
    const timer = window.setTimeout(() => startTour(), 700);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, user, seenKey]);

  if (!isAuthenticated || !user) return null;

  return (
    <button
      type="button"
      onClick={() => {
        autoStartedRef.current = false;
        startTour();
      }}
      disabled={isStarting}
      className="fixed bottom-6 right-6 z-[90] inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-2xl shadow-slate-900/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-60 print:hidden"
      data-tour="start-tour-button"
    >
      <Wand2 className="h-4 w-4 text-emerald-400" />
      {isStarting ? 'Starting Tour' : 'Start Tour'}
    </button>
  );
};

export default AppTourGuide;