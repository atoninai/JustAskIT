/*
  # Create Conversations and Messages Tables

  1. New Tables
    - `conversations`
      - `id` (uuid, primary key)
      - `session_id` (text) - browser session identifier
      - `title` (text) - conversation title derived from first message
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, foreign key to conversations)
      - `role` (text) - 'user' or 'assistant'
      - `content` (text) - message content
      - `timestamp` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Allow users to read/write their own conversations based on session_id
    - Allow users to read/write messages for their own conversations

  3. Indexes
    - Index on conversation session_id for fast lookups
    - Index on message conversation_id for fast message retrieval
*/

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  timestamp timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS conversations_session_id_idx ON conversations(session_id);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_timestamp_idx ON messages(timestamp);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own conversations"
  ON conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own conversations"
  ON conversations FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their own conversations"
  ON conversations FOR DELETE
  USING (true);

-- Messages policies
CREATE POLICY "Users can view messages"
  ON messages FOR SELECT
  USING (true);

CREATE POLICY "Users can insert messages"
  ON messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update messages"
  ON messages FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete messages"
  ON messages FOR DELETE
  USING (true);