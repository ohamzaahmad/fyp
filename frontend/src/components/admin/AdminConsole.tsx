import React, { useState } from 'react';
import Departments from './Departments.tsx';
import Batches from './Batches.tsx';
import Classrooms from './Classrooms.tsx';

const AdminConsole: React.FC = () => {
  const [section, setSection] = useState<'departments' | 'batches' | 'classrooms'>('departments');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black">Admin Console</h1>
        <div className="flex gap-2">
          <button onClick={() => setSection('departments')} className={`px-3 py-1 rounded ${section==='departments' ? 'bg-emerald-500 text-white' : 'bg-slate-50'}`}>Departments</button>
          <button onClick={() => setSection('batches')} className={`px-3 py-1 rounded ${section==='batches' ? 'bg-emerald-500 text-white' : 'bg-slate-50'}`}>Batches</button>
          <button onClick={() => setSection('classrooms')} className={`px-3 py-1 rounded ${section==='classrooms' ? 'bg-emerald-500 text-white' : 'bg-slate-50'}`}>Classrooms</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border p-4">
        {section === 'departments' && <Departments />}
        {section === 'batches' && <Batches />}
        {section === 'classrooms' && <Classrooms />}
      </div>
    </div>
  );
};

export default AdminConsole;
