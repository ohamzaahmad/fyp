import React, { useState } from 'react';
import Departments from './Departments.tsx';
import Batches from './Batches.tsx';
import Classrooms from './Classrooms.tsx';
import Courses from './Courses.tsx';
import Teachers from './Teachers.tsx';
import Assignments from './Assignments.tsx';

const ResourceManagement: React.FC = () => {
  const [section, setSection] = useState<'departments' | 'batches' | 'classrooms' | 'courses' | 'teachers' | 'assignments'>('departments');

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      {/* Page header with tab switcher */}
      <div className="flex items-center gap-1 px-8 pt-6 pb-0 border-b border-slate-200 bg-white">
        <div className="mr-4">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Resource Management</h1>
          <p className="text-xs text-slate-400 font-medium">Manage master data entities</p>
        </div>
        <div className="flex items-end gap-1 ml-auto">
          {([
            { id: 'departments', label: 'Departments' },
            { id: 'courses', label: 'Courses' },
            { id: 'teachers', label: 'Teachers' },
            { id: 'batches', label: 'Batches' },
            { id: 'assignments', label: 'Assignments' },
            { id: 'classrooms', label: 'Classrooms' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setSection(tab.id as any)}
              data-tour={`resource-tab-${tab.id}`}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-xs font-bold transition-all border border-b-0 ${
                section === tab.id
                  ? 'bg-slate-50 border-slate-200 text-slate-900'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        {section === 'departments' && <Departments />}
        {section === 'courses' && <Courses />}
        {section === 'teachers' && <Teachers />}
        {section === 'batches' && <Batches />}
        {section === 'assignments' && <Assignments />}
        {section === 'classrooms' && <Classrooms />}
      </div>
    </div>
  );
};

export default ResourceManagement;
