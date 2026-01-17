# When to Meet - React + Supabase Scheduling App

A collaborative scheduling application with a bold cyberpunk aesthetic. Users can create meetings, propose time slots, and mark their availability.

## Features

- 📅 Create meetings with multiple time slots
- ✅ Mark availability for proposed times
- 👥 See who's available for each time slot
- 📊 Visual availability indicators
- 🎨 Distinctive cyberpunk UI with smooth animations

## Project Structure

```
when-to-meet/
├── src/
│   ├── WhenToMeet.jsx    # Main application component
│   ├── App.jsx           # App wrapper
│   ├── main.jsx          # React entry point
│   └── index.css         # Global styles
├── index.html            # HTML template
├── vite.config.js        # Vite configuration
├── package.json          # Dependencies and scripts
├── .env.example          # Environment variables template
├── .env                  # Your environment variables (create this)
└── README.md             # This file
```

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in your project details and create the project

### 2. Set Up Database Tables

Go to the SQL Editor in your Supabase dashboard and run this SQL:

```sql
-- Create meetings table
CREATE TABLE meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create time slots table
CREATE TABLE time_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  slot_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create responses table
CREATE TABLE responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  time_slot_id UUID REFERENCES time_slots(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(time_slot_id, participant_name)
);

-- Enable Row Level Security
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for demo purposes)
CREATE POLICY "Allow all on meetings" ON meetings FOR ALL USING (true);
CREATE POLICY "Allow all on time_slots" ON time_slots FOR ALL USING (true);
CREATE POLICY "Allow all on responses" ON responses FOR ALL USING (true);
```

### 3. Get Your Supabase Credentials

1. Go to Project Settings → API
2. Copy your:
   - Project URL (something like `https://xxxxx.supabase.co`)
   - Anon/Public Key (starts with `eyJ...`)

### 4. Configure the Application

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Then edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Run the Application

Start the development server:

```bash
npm run dev
```

Open your browser to `http://localhost:5173` (or the URL shown in your terminal).

### 7. Build for Production

When you're ready to deploy:

```bash
npm run build
```

This creates an optimized production build in the `dist` folder.

## Usage

### Creating a Meeting

1. Click "Create New Meeting"
2. Enter a title and optional description
3. Add one or more time slots using the datetime picker
4. Click "Create Meeting"

### Marking Availability

1. Click on a meeting from the list
2. Enter your name
3. Check the boxes for times you're available
4. Click "Submit Availability"

### Viewing Results

- Each time slot shows how many people are available
- A visual bar indicates the percentage of participants available
- The participants list shows everyone who has responded

## Database Schema

### meetings
- `id` (UUID, Primary Key)
- `title` (Text, Required)
- `description` (Text, Optional)
- `created_at` (Timestamp)

### time_slots
- `id` (UUID, Primary Key)
- `meeting_id` (UUID, Foreign Key → meetings)
- `slot_time` (Timestamp, Required)
- `created_at` (Timestamp)

### responses
- `id` (UUID, Primary Key)
- `meeting_id` (UUID, Foreign Key → meetings)
- `time_slot_id` (UUID, Foreign Key → time_slots)
- `participant_name` (Text, Required)
- `is_available` (Boolean)
- `created_at` (Timestamp)
- Unique constraint on (time_slot_id, participant_name)

## Security Notes

The current setup uses permissive RLS policies that allow anyone to read and write data. For production use, you should:

1. Implement authentication (Supabase Auth)
2. Update RLS policies to restrict access appropriately
3. Validate input on the server side
4. Add rate limiting

## Customization

### Changing the Design

The app uses:
- **Fonts**: Bebas Neue (headers), Space Mono (body)
- **Colors**: Cyberpunk theme with cyan/blue gradients
- **Effects**: Glow effects, backdrop blur, smooth animations

Modify the `<style>` section and inline styles to match your brand.

### Adding Features

Consider adding:
- Email notifications
- Calendar export (ICS files)
- Time zone support
- Meeting links/URLs
- Authentication
- Meeting organizer controls
- Comments/notes per time slot

## Troubleshooting

**Error: "Failed to fetch"**
- Check your Supabase credentials are correct
- Verify your Supabase project is active
- Check browser console for CORS errors

**Error: "relation does not exist"**
- Make sure you ran all the SQL setup commands
- Check table names match exactly

**Availability not showing**
- Ensure you've entered your name before submitting
- Check that time slots were created successfully
- Verify responses are being stored in Supabase (check the Table Editor)

## License

MIT
