-- Gym Messages: allows gym owners to send messages to their members
-- Members see these as notifications in the mobile app

CREATE TABLE IF NOT EXISTS gym_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'individual')),
  target_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gym_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES gym_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gym_messages_gym_id ON gym_messages(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_messages_created_at ON gym_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gym_message_reads_message_id ON gym_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_gym_message_reads_user_id ON gym_message_reads(user_id);

-- RLS
ALTER TABLE gym_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_message_reads ENABLE ROW LEVEL SECURITY;

-- Gym owners can insert messages for their gyms
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gym_messages_insert_owner') THEN
    CREATE POLICY gym_messages_insert_owner ON gym_messages
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM gyms WHERE gyms.id = gym_id AND gyms.owner_id = auth.uid())
      );
  END IF;
END $$;

-- Gym owners can read messages they sent
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gym_messages_select_owner') THEN
    CREATE POLICY gym_messages_select_owner ON gym_messages
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM gyms WHERE gyms.id = gym_id AND gyms.owner_id = auth.uid())
      );
  END IF;
END $$;

-- Members can read messages for their gym (broadcast or targeted at them)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gym_messages_select_member') THEN
    CREATE POLICY gym_messages_select_member ON gym_messages
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.user_id = auth.uid()
            AND user_profiles.selected_gym_id = gym_messages.gym_id
        )
        AND (target_type = 'all' OR target_user_id = auth.uid())
      );
  END IF;
END $$;

-- Members can mark messages as read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gym_message_reads_insert') THEN
    CREATE POLICY gym_message_reads_insert ON gym_message_reads
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gym_message_reads_select') THEN
    CREATE POLICY gym_message_reads_select ON gym_message_reads
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- Admins (via user_roles) can read all messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'gym_messages_select_admin') THEN
    CREATE POLICY gym_messages_select_admin ON gym_messages
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
      );
  END IF;
END $$;
