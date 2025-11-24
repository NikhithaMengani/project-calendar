// src/App.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";

import eventsData from './data/events.json';

const PALETTE = [
  'bg-indigo-100 text-indigo-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-sky-100 text-sky-800',
];

function hashToIndex(str, max) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h) % max;
}

export default function App() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);

  const [staticEvents, setStaticEvents] = useState([]);
  const [userEvents, setUserEvents] = useState([]);

  // modal & form state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    date: format(today, 'yyyy-MM-dd'),
    start: '09:00',
    durationMinutes: 60,
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setStaticEvents(eventsData || []);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('calendar_user_events');
      if (raw) setUserEvents(JSON.parse(raw));
    } catch (e) {
      console.error('Failed to parse localStorage events', e);
      setUserEvents([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('calendar_user_events', JSON.stringify(userEvents));
    } catch (e) {
      console.error('Failed to persist user events', e);
    }
  }, [userEvents]);

  const allEvents = useMemo(() => {
    const merged = [...(staticEvents || []), ...(userEvents || [])];
    return merged.map((e) => {
      try {
        const startIso = parseISO(e.date + 'T' + e.start + ':00');
        const endIso = new Date(startIso.getTime() + (e.durationMinutes || 60) * 60000);
        return { ...e, startDate: startIso, endDate: endIso };
      } catch (err) {
        const fallback = new Date(e.date + 'T12:00:00');
        return { ...e, startDate: fallback, endDate: new Date(fallback.getTime() + 3600000) };
      }
    });
  }, [staticEvents, userEvents]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of allEvents) {
      const key = format(ev.startDate, 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.startDate - b.startDate));
    return map;
  }, [allEvents]);

  function prevMonth() {
    setCurrentMonth((m) => subMonths(m, 1));
  }
  function nextMonth() {
    setCurrentMonth((m) => addMonths(m, 1));
  }

  function buildCalendarGrid() {
    const startMonth = startOfMonth(currentMonth);
    const endMonth = endOfMonth(currentMonth);
    const startDate = startOfWeek(startMonth, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(endMonth, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        days.push(day);
        day = addDays(day, 1);
      }
      rows.push(days);
      days = [];
    }
    return rows;
  }

  function layoutEventsForDay(evts) {
    const cols = [];
    const assignments = [];
    for (const ev of evts) {
      let placed = false;
      for (let c = 0; c < cols.length; c++) {
        const last = cols[c][cols[c].length - 1];
        if (ev.startDate >= last.endDate) {
          cols[c].push(ev);
          assignments.push({ ev, col: c });
          placed = true;
          break;
        }
      }
      if (!placed) {
        cols.push([ev]);
        assignments.push({ ev, col: cols.length - 1 });
      }
    }
    return { assignments, columnCount: cols.length };
  }

  function handleCreateEvent(e) {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim()) {
      setFormError('Title is required');
      return;
    }
    if (!form.date) {
      setFormError('Date is required');
      return;
    }
    if (!form.start) {
      setFormError('Start time required');
      return;
    }
    const newEvent = {
      id: Date.now(),
      title: form.title.trim(),
      date: form.date,
      start: form.start,
      durationMinutes: Number(form.durationMinutes) || 60,
    };
    setUserEvents((s) => [...s, newEvent]);
    setShowModal(false);
    setForm({ title: '', date: format(selectedDate, 'yyyy-MM-dd'), start: '09:00', durationMinutes: 60 });
  }

  // --- UPDATED renderDayCell: stronger, unique today styling ---
  function renderDayCell(day) {
    const dayKey = format(day, 'yyyy-MM-dd');
    const isToday = isSameDay(day, today);
    const inMonth = isSameMonth(day, currentMonth);
    const evts = eventsByDate[dayKey] || [];
    const { assignments, columnCount } = layoutEventsForDay(evts);

    // classes for the cell root
    const cellBase = `relative border rounded-md p-2 min-h-[120px] flex flex-col gap-2 ${inMonth ? 'bg-white' : 'bg-gray-50'}`;
    const todayWrapper = isToday ? 'today-glow ring-2 ring-indigo-200' : '';

    return (
      <div
        key={dayKey}
        className={`${cellBase} ${todayWrapper}`}
        onClick={() => setSelectedDate(day)}
        aria-current={isToday ? 'date' : undefined}
      >
        <div className="flex items-start justify-between">
          {/* left: day number (enhanced for today) */}
          <div className="flex items-center gap-2">
            {isToday ? (
              <div className="flex items-center gap-2">
                <div className="today-number bg-gradient-to-r from-indigo-500 to-indigo-400 text-white shadow-md">
                  {format(day, 'd')}
                </div>
                <div className="flex flex-col">
                  <div className="text-xs text-indigo-600 font-semibold today-pill hidden sm:inline">Today</div>
                  <div className="mt-1 today-dot bg-indigo-500"></div>
                </div>
              </div>
            ) : (
              <div className={`text-sm font-medium ${inMonth ? 'text-gray-800' : 'text-gray-400'}`}>{format(day, 'd')}</div>
            )}
          </div>

          {/* right: weekday short */}
          <div className="text-xs text-gray-400">{format(day, 'EEE')}</div>
        </div>

        {/* events area */}
        <div className="flex-1">
          {assignments.slice(0, 3).map(({ ev }) => {
            const colorCls = PALETTE[hashToIndex(String(ev.title) + String(ev.id), PALETTE.length)];
            return (
              <div
                key={ev.id}
                className={`rounded-md px-2 py-1 text-xs font-semibold truncate ${colorCls} mb-1`}
                title={`${ev.title} • ${format(ev.startDate, 'HH:mm')}`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{ev.title}</span>
                  <span className="ml-2 text-[10px] opacity-80">{format(ev.startDate, 'HH:mm')}</span>
                </div>
              </div>
            );
          })}
          {evts.length > 3 && <div className="text-[11px] text-gray-500">+{evts.length - 3} more</div>}
        </div>

        {/* overlap indicator */}
        {columnCount > 1 && <div className="text-[11px] text-gray-500 mt-auto">Overlaps: {columnCount}</div>}
      </div>
    );
  }

  const weeks = buildCalendarGrid();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl shadow p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold">{format(currentMonth, 'MMM yyyy')}</h2>
            <div className="text-sm text-gray-500">{format(currentMonth, 'LLLL yyyy')}</div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="px-3 py-2 rounded-md bg-white shadow-sm hover:shadow">
              ◀
            </button>
            <button
              onClick={() => {
                setCurrentMonth(startOfMonth(today));
                setSelectedDate(today);
              }}
              className="px-3 py-2 rounded-md bg-white shadow-sm hover:shadow"
            >
              Today
            </button>
            <button onClick={nextMonth} className="px-3 py-2 rounded-md bg-white shadow-sm hover:shadow">
              ▶
            </button>
            <button onClick={() => setShowModal(true)} className="ml-3 px-3 py-2 rounded-md bg-indigo-600 text-white">
              Add Event
            </button>
          </div>
        </div>

        {/* Weekdays */}
        <div className="grid grid-cols-7 gap-3 text-center text-sm text-gray-500 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-3">{weeks.map((week, i) => <React.Fragment key={i}>{week.map((day) => renderDayCell(day))}</React.Fragment>)}</div>

        {/* Selected day details */}
        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{format(selectedDate, 'PPP')}</h3>
              <div className="text-sm text-gray-600">Events on this day</div>
            </div>
            <div className="text-sm text-gray-600">{(eventsByDate[format(selectedDate, 'yyyy-MM-dd')] || []).length} events</div>
          </div>

          <div className="mt-3 space-y-2">
            {(eventsByDate[format(selectedDate, 'yyyy-MM-dd')] || []).length === 0 && <div className="text-gray-500">No events scheduled.</div>}

            {(eventsByDate[format(selectedDate, 'yyyy-MM-dd')] || []).map((ev) => {
              const colorCls = PALETTE[hashToIndex(String(ev.title) + String(ev.id), PALETTE.length)];
              const duration = Math.max(1, Math.round((ev.endDate - ev.startDate) / 60000));
              return (
                <div key={ev.id} className={`p-3 rounded-md ${colorCls} flex items-center justify-between`}>
                  <div>
                    <div className="font-semibold">{ev.title}</div>
                    <div className="text-xs">{format(ev.startDate, 'HH:mm')} • {duration} min</div>
                  </div>
                  <div className="text-xs text-gray-700">ID: {ev.id}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend / tips */}
        <div className="mt-4 flex items-center gap-4">
          <div className="text-sm text-gray-600">Legend:</div>
          <div className="flex gap-2 items-center">
            {PALETTE.slice(0, 3).map((c, i) => <div key={i} className={`px-2 py-1 rounded ${c} text-[12px]`}>Event type {i + 1}</div>)}
          </div>
          <div className="ml-auto text-sm text-gray-500">Tip: Click any date cell to see event details.</div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-4">
            <h3 className="text-lg font-semibold mb-2">Create Event</h3>
            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full p-2 border rounded" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm text-gray-600">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full p-2 border rounded" />
                </div>

                <div>
                  <label className="block text-sm text-gray-600">Start</label>
                  <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="w-full p-2 border rounded" />
                </div>

                <div>
                  <label className="block text-sm text-gray-600">Duration (min)</label>
                  <input type="number" min={1} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="w-full p-2 border rounded" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-red-600">{formError}</div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-3 py-2 rounded bg-gray-200">
                    Cancel
                  </button>
                  <button type="submit" className="px-3 py-2 rounded bg-indigo-600 text-white">
                    Create
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Implementation notes */}
      <div className="mt-6 text-sm text-gray-500">
        <strong>Implementation notes:</strong>
        <ul className="list-disc ml-5 mt-2">
          <li>Static events are loaded from <code>src/data/events.json</code>.</li>
          <li>User-created events are stored in <code>localStorage</code> so they persist between refreshes.</li>
          <li>Overlapping events are assigned columns via a greedy packing algorithm and color-coded for clarity.</li>
          <li>Current date is highlighted with a distinct gradient badge and soft glowing animation.</li>
        </ul>
      </div>
    </div>
  );
}
