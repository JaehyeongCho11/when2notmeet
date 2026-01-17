import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured with valid values
const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseKey && 
  supabaseUrl.startsWith('http') && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseKey !== 'YOUR_SUPABASE_ANON_KEY' &&
  supabaseKey.length > 20;

const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export default function WhenToMeet() {
  const [view, setView] = useState('home'); // home, create, meeting
  const [meetings, setMeetings] = useState([]);
  const [currentMeeting, setCurrentMeeting] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [responses, setResponses] = useState([]);
  const [participantName, setParticipantName] = useState('');
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null); // 'select' or 'deselect'
  const [anchorRow, setAnchorRow] = useState(0);
  const [anchorCol, setAnchorCol] = useState(0);
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);
  const xMouseRef = React.useRef(0);
  const yMouseRef = React.useRef(0);
  
  // Form states
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: ''
  });
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '17:00'
  });

  useEffect(() => {
    loadMeetings();
    
    const handleGlobalMouseMove = (e) => {
      if (isDragging) {
        const xMousePos = e.pageX;
        const yMousePos = e.pageY;
        
        // Calculate which cell we're hovering over based on pixel distance
        // Each cell is approximately 30px tall and 80px wide
        const newHoverRow = Math.floor((yMousePos - yMouseRef.current) / 30);
        const newHoverCol = Math.floor((xMousePos - xMouseRef.current) / 80);
        
        setHoverRow(anchorRow + newHoverRow);
        setHoverCol(anchorCol + newHoverCol);
      }
    };
    
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, anchorRow, anchorCol]);

  const loadMeetings = async () => {
    if (!supabase) return;
    
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setMeetings(data);
    }
  };

  const loadMeetingDetails = async (meetingId) => {
    if (!supabase) {
      alert('Please configure Supabase to use this feature');
      return;
    }
    
    const { data: meeting } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    const { data: slots } = await supabase
      .from('time_slots')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('slot_time', { ascending: true });

    const { data: resps } = await supabase
      .from('responses')
      .select('*')
      .eq('meeting_id', meetingId);

    setCurrentMeeting(meeting);
    setTimeSlots(slots || []);
    setResponses(resps || []);
    
    // Pre-select user's previous UNAVAILABLE responses
    if (participantName) {
      const userResponses = resps?.filter(r => 
        r.participant_name === participantName && !r.is_available
      ) || [];
      setSelectedSlots(userResponses.map(r => r.time_slot_id));
    }
    
    setView('meeting');
  };

  const generateTimeSlots = () => {
    const slots = [];
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    
    const [startHour, startMin] = dateRange.startTime.split(':').map(Number);
    const [endHour, endMin] = dateRange.endTime.split(':').map(Number);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      for (let hour = startHour; hour < endHour; hour++) {
        for (let min = 0; min < 60; min += 30) {
          const slotDate = new Date(d);
          slotDate.setHours(hour, min, 0, 0);
          slots.push(slotDate.toISOString());
        }
      }
    }
    
    return slots;
  };

  const createMeeting = async () => {
    if (!supabase) {
      alert('Please configure Supabase to use this feature. See SETUP.md for instructions.');
      return;
    }
    
    if (!newMeeting.title || !dateRange.startDate || !dateRange.endDate) {
      alert('Please fill in the title and date range');
      return;
    }

    const slots = generateTimeSlots();
    
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert([{ 
        title: newMeeting.title, 
        description: newMeeting.description 
      }])
      .select()
      .single();

    if (meetingError) {
      alert('Error creating meeting');
      return;
    }

    const slotsToInsert = slots.map(slot => ({
      meeting_id: meeting.id,
      slot_time: slot
    }));

    await supabase.from('time_slots').insert(slotsToInsert);

    setNewMeeting({ title: '', description: '' });
    setDateRange({ startDate: '', endDate: '', startTime: '09:00', endTime: '17:00' });
    loadMeetings();
    loadMeetingDetails(meeting.id);
  };

  const submitAvailability = async () => {
    if (!supabase) {
      alert('Please configure Supabase to use this feature. See SETUP.md for instructions.');
      return;
    }
    
    if (!participantName) {
      alert('Please enter your name');
      return;
    }

    // Delete existing responses for this participant
    await supabase
      .from('responses')
      .delete()
      .eq('meeting_id', currentMeeting.id)
      .eq('participant_name', participantName);

    // Insert new responses - selected slots are UNAVAILABLE, rest are available
    const userResponses = timeSlots.map(slot => ({
      meeting_id: currentMeeting.id,
      time_slot_id: slot.id,
      participant_name: participantName,
      is_available: !selectedSlots.includes(slot.id) // INVERTED: not selected = available
    }));

    await supabase.from('responses').insert(userResponses);

    alert('Availability saved!');
    loadMeetingDetails(currentMeeting.id);
  };

  const handleSlotMouseDown = (slotId, row, col, e) => {
    setIsDragging(true);
    setAnchorRow(row);
    setAnchorCol(col);
    setHoverRow(row);
    setHoverCol(col);
    
    // Store initial mouse position
    xMouseRef.current = e.pageX;
    yMouseRef.current = e.pageY;
    
    if (selectedSlots.includes(slotId)) {
      setDragMode('deselect');
    } else {
      setDragMode('select');
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragMode) {
      // Get all slots in the selected rectangle
      const groupedSlots = groupSlotsByDate();
      const dates = Object.keys(groupedSlots);
      const hours = getUniqueHours();
      
      const minRow = Math.min(anchorRow, hoverRow);
      const maxRow = Math.max(anchorRow, hoverRow);
      const minCol = Math.min(anchorCol, hoverCol);
      const maxCol = Math.max(anchorCol, hoverCol);
      
      const slotsToUpdate = [];
      
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          if (row >= 0 && row < hours.length && col >= 0 && col < dates.length) {
            const hour = hours[row];
            const daySlots = Object.values(groupedSlots)[col];
            const slot = daySlots?.find(s => formatTime(s.slot_time) === hour);
            if (slot) {
              slotsToUpdate.push(slot.id);
            }
          }
        }
      }
      
      // Apply the selection/deselection
      setSelectedSlots(prev => {
        if (dragMode === 'select') {
          const newSelected = [...prev];
          slotsToUpdate.forEach(id => {
            if (!newSelected.includes(id)) {
              newSelected.push(id);
            }
          });
          return newSelected;
        } else {
          return prev.filter(id => !slotsToUpdate.includes(id));
        }
      });
    }
    
    setIsDragging(false);
    setDragMode(null);
    setAnchorRow(0);
    setAnchorCol(0);
    setHoverRow(0);
    setHoverCol(0);
  };

  const getAvailabilityCount = (slotId) => {
    return responses.filter(r => r.time_slot_id === slotId && r.is_available).length;
  };

  const getParticipants = () => {
    return [...new Set(responses.map(r => r.participant_name))];
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const groupSlotsByDate = () => {
    const grouped = {};
    timeSlots.forEach(slot => {
      const date = formatDate(slot.slot_time);
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(slot);
    });
    return grouped;
  };

  const getUniqueHours = () => {
    const hours = new Set();
    timeSlots.forEach(slot => {
      hours.add(formatTime(slot.slot_time));
    });
    return Array.from(hours).sort();
  };

  const getSlotColor = (slotId) => {
    const count = getAvailabilityCount(slotId);
    const totalParticipants = getParticipants().length;
    
    if (totalParticipants === 0) return '#FFB6C1';
    
    const ratio = count / totalParticipants;
    if (ratio === 1) return '#2D8A3E';
    if (ratio >= 0.75) return '#52A665';
    if (ratio >= 0.5) return '#7BC18C';
    if (ratio >= 0.25) return '#A5DCB3';
    return '#FFB6C1';
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#f5f5f5',
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    }}>
      <style>{`
        * {
          box-sizing: border-box;
        }
        
        .grid-cell {
          border: 1px solid #ccc;
          min-width: 80px;
          height: 30px;
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          touch-action: none;
          transition: none;
        }
        
        input, textarea, select {
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
        }
        
        button {
          padding: 10px 20px;
          background: #4A90E2;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        button:hover {
          background: #357ABD;
        }
        
        .meeting-card {
          background: white;
          border: 1px solid #ddd;
          padding: 15px;
          margin-bottom: 15px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .meeting-card:hover {
          background: #f9f9f9;
        }
      `}</style>

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {!isSupabaseConfigured && (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            padding: '15px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            <strong>⚠️ Supabase Not Configured</strong>
            <p style={{ margin: '5px 0 0 0' }}>
              Database features won't work until you set up Supabase. See SETUP.md for instructions.
            </p>
          </div>
        )}
        
        <header style={{ 
          background: 'white',
          padding: '20px',
          marginBottom: '20px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '32px', color: '#333' }}>
            When to Meet
          </h1>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            Find the best time for a group to get together
          </p>
        </header>

        {view === 'home' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <button onClick={() => setView('create')}>
                Create New Event
              </button>
            </div>

            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ fontSize: '20px', marginTop: 0 }}>Your Events</h2>

              {meetings.length === 0 ? (
                <p style={{ color: '#666' }}>No events yet. Create one to get started!</p>
              ) : (
                meetings.map(meeting => (
                  <div 
                    key={meeting.id} 
                    className="meeting-card"
                    onClick={() => loadMeetingDetails(meeting.id)}
                  >
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#4A90E2' }}>
                      {meeting.title}
                    </h3>
                    {meeting.description && (
                      <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
                        {meeting.description}
                      </p>
                    )}
                    <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>
                      Created {new Date(meeting.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === 'create' && (
          <div style={{ 
            background: 'white',
            padding: '20px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <button 
              onClick={() => setView('home')}
              style={{ marginBottom: '20px', background: '#666' }}
            >
              ← Back
            </button>

            <h2 style={{ fontSize: '24px', marginTop: 0 }}>Create New Event</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Event Name *
                </label>
                <input
                  type="text"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({...newMeeting, title: e.target.value})}
                  placeholder="Team Meeting"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Description (Optional)
                </label>
                <textarea
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting({...newMeeting, description: e.target.value})}
                  placeholder="Weekly sync meeting"
                  rows={3}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Earliest Time
                  </label>
                  <input
                    type="time"
                    value={dateRange.startTime}
                    onChange={(e) => setDateRange({...dateRange, startTime: e.target.value})}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Latest Time
                  </label>
                  <input
                    type="time"
                    value={dateRange.endTime}
                    onChange={(e) => setDateRange({...dateRange, endTime: e.target.value})}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <button onClick={createMeeting} style={{ marginTop: '10px' }}>
                Create Event
              </button>
            </div>
          </div>
        )}

        {view === 'meeting' && currentMeeting && (
          <div>
            <button 
              onClick={() => {
                setView('home');
                setCurrentMeeting(null);
                setSelectedSlots([]);
              }}
              style={{ marginBottom: '20px', background: '#666' }}
            >
              ← Back to Events
            </button>

            <div style={{ 
              background: 'white',
              padding: '20px',
              marginBottom: '20px',
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: '#333' }}>
                {currentMeeting.title}
              </h2>
              {currentMeeting.description && (
                <p style={{ margin: '0 0 10px 0', color: '#666' }}>
                  {currentMeeting.description}
                </p>
              )}
              <p style={{ margin: 0, fontSize: '14px', color: '#999' }}>
                {getParticipants().length} participant{getParticipants().length !== 1 ? 's' : ''} responded
              </p>
            </div>

            <div style={{ 
              background: 'white',
              padding: '20px',
              marginBottom: '20px',
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0, fontSize: '18px' }}>Your Availability</h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Your Name *
                </label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                  style={{ width: '300px' }}
                />
              </div>

              <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
                Click and drag to mark times you are <strong>UNAVAILABLE</strong>; unmarked times will be marked as available
              </p>

              <div 
                style={{ overflowX: 'auto' }}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <table style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ 
                        border: '1px solid #ccc',
                        padding: '8px',
                        background: '#f9f9f9',
                        minWidth: '60px'
                      }}>
                        Time
                      </th>
                      {Object.keys(groupSlotsByDate()).map(date => (
                        <th key={date} style={{ 
                          border: '1px solid #ccc',
                          padding: '8px',
                          background: '#f9f9f9',
                          minWidth: '80px'
                        }}>
                          {date}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getUniqueHours().map((hour, rowIndex) => (
                      <tr key={hour}>
                        <td style={{ 
                          border: '1px solid #ccc',
                          padding: '8px',
                          background: '#f9f9f9',
                          fontWeight: 'bold'
                        }}>
                          {hour}
                        </td>
                        {Object.values(groupSlotsByDate()).map((daySlots, colIndex) => {
                          const slot = daySlots.find(s => formatTime(s.slot_time) === hour);
                          
                          // Check if this cell is in the drag rectangle
                          const isInDragRect = isDragging && 
                            rowIndex >= Math.min(anchorRow, hoverRow) &&
                            rowIndex <= Math.max(anchorRow, hoverRow) &&
                            colIndex >= Math.min(anchorCol, hoverCol) &&
                            colIndex <= Math.max(anchorCol, hoverCol);
                          
                          let bgColor = slot && selectedSlots.includes(slot.id) ? '#FFB6C1' : '#7BC18C';
                          
                          // Show preview during drag
                          if (isInDragRect && slot) {
                            if (dragMode === 'select') {
                              bgColor = '#FFB6C1';
                            } else {
                              bgColor = '#7BC18C';
                            }
                          }
                          
                          return (
                            <td 
                              key={colIndex}
                              className="grid-cell"
                              style={{ 
                                background: bgColor,
                                border: isInDragRect ? '2px solid #333' : '1px solid #ccc'
                              }}
                              onMouseDown={(e) => slot && handleSlotMouseDown(slot.id, rowIndex, colIndex, e)}
                            />
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button onClick={submitAvailability} style={{ marginTop: '20px' }}>
                Submit Availability
              </button>
            </div>

            <div style={{ 
              background: 'white',
              padding: '20px',
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0, fontSize: '18px' }}>Group Availability</h3>
              
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
                Darker green = more people available. Pink = unavailable times.
              </p>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ 
                        border: '1px solid #ccc',
                        padding: '8px',
                        background: '#f9f9f9',
                        minWidth: '60px'
                      }}>
                        Time
                      </th>
                      {Object.keys(groupSlotsByDate()).map(date => (
                        <th key={date} style={{ 
                          border: '1px solid #ccc',
                          padding: '8px',
                          background: '#f9f9f9',
                          minWidth: '80px'
                        }}>
                          {date}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getUniqueHours().map(hour => (
                      <tr key={hour}>
                        <td style={{ 
                          border: '1px solid #ccc',
                          padding: '8px',
                          background: '#f9f9f9',
                          fontWeight: 'bold'
                        }}>
                          {hour}
                        </td>
                        {Object.values(groupSlotsByDate()).map((daySlots, dayIndex) => {
                          const slot = daySlots.find(s => formatTime(s.slot_time) === hour);
                          const count = slot ? getAvailabilityCount(slot.id) : 0;
                          return (
                            <td 
                              key={dayIndex}
                              className="grid-cell"
                              style={{ 
                                background: slot ? getSlotColor(slot.id) : '#FFB6C1',
                                cursor: 'default'
                              }}
                              title={slot ? `${count} / ${getParticipants().length} available` : ''}
                            />
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {getParticipants().length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ fontSize: '16px', marginBottom: '10px' }}>Participants:</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {getParticipants().map(participant => (
                      <div 
                        key={participant}
                        style={{
                          background: '#f0f0f0',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          padding: '5px 10px',
                          fontSize: '14px'
                        }}
                      >
                        {participant}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
