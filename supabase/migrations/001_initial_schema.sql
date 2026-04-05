-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Classes
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Teachers
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  profile_image TEXT,
  monthly_fee_paid BOOLEAN DEFAULT false,
  last_paid_month DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Parents
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  student_id UUID UNIQUE,  -- FK to students, added later
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Students
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  class_id UUID REFERENCES classes(id),
  roll_number TEXT NOT NULL,
  father_name TEXT,
  mother_name TEXT,
  dob DATE,
  gender TEXT CHECK (gender IN ('Male','Female','Other')),
  religion TEXT,
  address TEXT,
  profile_image TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add student_id FK to parents after students table exists
ALTER TABLE parents ADD CONSTRAINT parents_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- Users (custom auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('principal','teacher','parent')),
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES parents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Class attendance teacher (which teacher is assigned to which class)
CREATE TABLE class_attendance_teacher (
  class_id UUID PRIMARY KEY REFERENCES classes(id),
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL
);

-- School settings (single row)
CREATE TABLE school_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  attendance_start_time TIME DEFAULT '07:00:00',
  logo_url TEXT,
  principal_name TEXT,
  principal_signature_text TEXT,
  school_stamp_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Attendance
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('present','absent')),
  marked_by UUID REFERENCES teachers(id) ON DELETE SET NULL,
  edited_by_principal BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, date)
);

-- Teacher attendance
CREATE TABLE teacher_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_in TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(teacher_id, date)
);

-- Fees
CREATE TABLE fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  paid BOOLEAN DEFAULT false,
  paid_date DATE,
  remarks TEXT
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  doc_type TEXT,
  file_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  target TEXT NOT NULL,
  is_holiday BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notification reads
CREATE TABLE notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Timetable
CREATE TABLE timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  day TEXT CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  period_number INTEGER CHECK (period_number BETWEEN 1 AND 8),
  subject TEXT,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  start_time TIME,
  end_time TIME,
  UNIQUE(class_id, day, period_number)
);

-- Report cards
CREATE TABLE report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),
  exam_name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  created_by UUID REFERENCES teachers(id),
  finalized BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Report card marks
CREATE TABLE report_card_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_card_id UUID REFERENCES report_cards(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  max_marks INTEGER NOT NULL,
  marks_obtained DECIMAL NOT NULL,
  grade TEXT,
  remarks TEXT
);

-- Seed Data
-- Classes
INSERT INTO classes (name) VALUES
  ('Class 1'),('Class 2'),('Class 3'),('Class 4'),('Class 5'),
  ('Class 6'),('Class 7'),('Class 8'),('Class 9'),('Class 10')
ON CONFLICT (name) DO NOTHING;

-- School settings
INSERT INTO school_settings 
  (id, attendance_start_time, principal_name, principal_signature_text, school_stamp_text)
VALUES 
  (1, '07:00:00', 'School Principal', 'Principal, SGNPS', 'Shree Guru Nanak Public School')
ON CONFLICT (id) DO NOTHING;

-- Teachers (insert first to get IDs)
INSERT INTO teachers (name, phone, email) VALUES
  ('Teacher One', '9876543210', 'teacher1@school.com'),
  ('Teacher Two', '9876543211', 'teacher2@school.com'),
  ('Teacher Three', '9876543212', 'teacher3@school.com')
ON CONFLICT DO NOTHING;

-- Users
INSERT INTO users (username, password_hash, role, teacher_id) VALUES
  ('principal', 'cHJpbmNpcGFsMTIz', 'principal', NULL),
  ('teacher1',  'dGVhY2hlcjEyMw==', 'teacher', (SELECT id FROM teachers WHERE name = 'Teacher One')),
  ('teacher2',  'dGVhY2hlcjEyMw==', 'teacher', (SELECT id FROM teachers WHERE name = 'Teacher Two')),
  ('teacher3',  'dGVhY2hlcjEyMw==', 'teacher', (SELECT id FROM teachers WHERE name = 'Teacher Three'))
ON CONFLICT (username) DO NOTHING;

-- Assign teachers to classes (example: teacher1 → Class 1,2)
INSERT INTO class_attendance_teacher (class_id, teacher_id) VALUES
  ((SELECT id FROM classes WHERE name = 'Class 1'), (SELECT id FROM teachers WHERE name = 'Teacher One')),
  ((SELECT id FROM classes WHERE name = 'Class 2'), (SELECT id FROM teachers WHERE name = 'Teacher One')),
  ((SELECT id FROM classes WHERE name = 'Class 3'), (SELECT id FROM teachers WHERE name = 'Teacher Two')),
  ((SELECT id FROM classes WHERE name = 'Class 4'), (SELECT id FROM teachers WHERE name = 'Teacher Two')),
  ((SELECT id FROM classes WHERE name = 'Class 5'), (SELECT id FROM teachers WHERE name = 'Teacher Three')),
  ((SELECT id FROM classes WHERE name = 'Class 6'), (SELECT id FROM teachers WHERE name = 'Teacher Three'))
ON CONFLICT (class_id) DO NOTHING;

-- Students for Class 1
INSERT INTO students (name, class_id, roll_number, father_name, mother_name, dob, gender, religion, address) VALUES
  ('Arjun Sharma', (SELECT id FROM classes WHERE name='Class 1'), '1', 'Ramesh Sharma', 'Sunita Sharma', '2015-04-10', 'Male', 'Hindu', '12 MG Road Amritsar'),
  ('Priya Kaur', (SELECT id FROM classes WHERE name='Class 1'), '2', 'Gurpreet Singh', 'Harpreet Kaur', '2015-07-22', 'Female', 'Sikh', '45 Civil Lines Ludhiana'),
  ('Rohit Verma', (SELECT id FROM classes WHERE name='Class 1'), '3', 'Sunil Verma', 'Meena Verma', '2015-03-15', 'Male', 'Hindu', '7 Nehru Nagar Jalandhar'),
  ('Simran Gill', (SELECT id FROM classes WHERE name='Class 1'), '4', 'Manjit Gill', 'Paramjit Kaur', '2015-09-05', 'Female', 'Sikh', '23 Model Town Patiala'),
  ('Amit Patel', (SELECT id FROM classes WHERE name='Class 1'), '5', 'Dinesh Patel', 'Rekha Patel', '2015-11-18', 'Male', 'Hindu', '56 Sadar Bazar Amritsar')
ON CONFLICT DO NOTHING;

-- Students for Class 2
INSERT INTO students (name, class_id, roll_number, father_name, mother_name, dob, gender, religion, address) VALUES
  ('Neha Singh', (SELECT id FROM classes WHERE name='Class 2'), '1', 'Vikram Singh', 'Anita Singh', '2014-02-28', 'Female', 'Sikh', '34 Gandhi Nagar Ludhiana'),
  ('Karan Malhotra', (SELECT id FROM classes WHERE name='Class 2'), '2', 'Rajiv Malhotra', 'Pooja Malhotra', '2014-06-14', 'Male', 'Hindu', '89 Ranjit Avenue Amritsar'),
  ('Anjali Rao', (SELECT id FROM classes WHERE name='Class 2'), '3', 'Suresh Rao', 'Lakshmi Rao', '2014-08-30', 'Female', 'Hindu', '11 Tagore Nagar Jalandhar'),
  ('Harpreet Sandhu', (SELECT id FROM classes WHERE name='Class 2'), '4', 'Baldev Sandhu', 'Navneet Kaur', '2014-01-19', 'Male', 'Sikh', '67 Urban Estate Patiala'),
  ('Deepak Joshi', (SELECT id FROM classes WHERE name='Class 2'), '5', 'Mohan Joshi', 'Kavita Joshi', '2014-05-07', 'Male', 'Hindu', '28 Lawrence Road Amritsar')
ON CONFLICT DO NOTHING;

-- Students for Class 3
INSERT INTO students (name, class_id, roll_number, father_name, mother_name, dob, gender, religion, address) VALUES
  ('Manpreet Bhatia', (SELECT id FROM classes WHERE name='Class 3'), '1', 'Ashok Bhatia', 'Suman Bhatia', '2013-03-25', 'Male', 'Sikh', '15 BRS Nagar Ludhiana'),
  ('Ritika Chopra', (SELECT id FROM classes WHERE name='Class 3'), '2', 'Sanjeev Chopra', 'Nisha Chopra', '2013-10-11', 'Female', 'Hindu', '42 Shakti Nagar Delhi'),
  ('Gurjot Dhillon', (SELECT id FROM classes WHERE name='Class 3'), '3', 'Narinder Dhillon', 'Jaswinder Kaur', '2013-07-03', 'Male', 'Sikh', '9 Focal Point Ludhiana'),
  ('Sakshi Bansal', (SELECT id FROM classes WHERE name='Class 3'), '4', 'Anil Bansal', 'Seema Bansal', '2013-12-20', 'Female', 'Hindu', '31 Haibowal Ludhiana'),
  ('Tarun Khanna', (SELECT id FROM classes WHERE name='Class 3'), '5', 'Deepak Khanna', 'Ritu Khanna', '2013-04-17', 'Male', 'Hindu', '73 Dugri Phase 2 Ludhiana')
ON CONFLICT DO NOTHING;

-- Parents linked to specific students (must be inserted after students exist)
INSERT INTO parents (name, phone, email, student_id) VALUES
  ('Parent One', '9988776655', 'parent1@example.com', (SELECT id FROM students WHERE name='Arjun Sharma' AND class_id=(SELECT id FROM classes WHERE name='Class 1'))),
  ('Parent Two', '9988776656', 'parent2@example.com', (SELECT id FROM students WHERE name='Priya Kaur' AND class_id=(SELECT id FROM classes WHERE name='Class 1'))),
  ('Parent Three', '9988776657', 'parent3@example.com', (SELECT id FROM students WHERE name='Neha Singh' AND class_id=(SELECT id FROM classes WHERE name='Class 2')))
ON CONFLICT DO NOTHING;

-- Add parent users
INSERT INTO users (username, password_hash, role, parent_id) VALUES
  ('parent1', 'cGFyZW50MTIz', 'parent', (SELECT id FROM parents WHERE name='Parent One')),
  ('parent2', 'cGFyZW50MTIz', 'parent', (SELECT id FROM parents WHERE name='Parent Two')),
  ('parent3', 'cGFyZW50MTIz', 'parent', (SELECT id FROM parents WHERE name='Parent Three'))
ON CONFLICT (username) DO NOTHING;

-- Sample attendance for last 5 days (for Class 1,2,3)
-- (We'll generate dynamic dates; but for simplicity we can insert static dates)
-- Since dates need to be actual, we'll use today-4 days through today.
-- We'll generate this later in code seed; but for migration, we can insert with specific dates if needed.
-- For now, we'll skip to keep migration simple. We'll add a seed script later.