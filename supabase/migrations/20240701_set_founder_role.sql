-- Set forgedev@forge.io as founder
-- This will run after the user signs up with that email
-- You can also run this manually in the Supabase SQL editor

-- First, find the user ID by email (you'll need to query auth.users)
-- Then update their profile role to 'founder'

-- Manual SQL to run in Supabase SQL editor:
-- UPDATE profiles 
-- SET role = 'founder' 
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'forgedev@forge.io');

-- Or if you know the user ID directly:
-- UPDATE profiles SET role = 'founder' WHERE id = 'USER_ID_HERE';
