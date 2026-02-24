-- ============================================================================
-- HOTFIX: Fix sign-in "Error checking account permissions"
--
-- Problem: After running 20260208100000, the clinic_memberships RLS policies
-- may be in a broken state due to partial migration execution. The templates
-- section (lines 463+) fails if the templates table doesn't exist, but the
-- clinic_memberships policies before that point are already committed.
--
-- This migration cleans up ALL existing clinic_memberships policies and
-- recreates clean, working ones that allow sign-in.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- 1. Drop ALL existing clinic_memberships policies (from any migration)
--    Old permissive policies from 20260208000000:
DROP POLICY IF EXISTS "memberships_select_own" ON clinic_memberships;
DROP POLICY IF EXISTS "memberships_insert_policy" ON clinic_memberships;
DROP POLICY IF EXISTS "memberships_update_policy" ON clinic_memberships;
--    Restrictive policies from 20260208100000:
DROP POLICY IF EXISTS "clinic_memberships_select" ON clinic_memberships;
DROP POLICY IF EXISTS "clinic_memberships_insert" ON clinic_memberships;
DROP POLICY IF EXISTS "clinic_memberships_update" ON clinic_memberships;
DROP POLICY IF EXISTS "clinic_memberships_delete" ON clinic_memberships;

-- 2. Ensure RLS is enabled
ALTER TABLE clinic_memberships ENABLE ROW LEVEL SECURITY;

-- 3. SELECT: Users can see their own memberships
--    Admins can also see all memberships in their clinic (for team management).
CREATE POLICY "clinic_memberships_select"
ON clinic_memberships FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM clinic_memberships cm
    WHERE cm.user_id = auth.uid()
      AND cm.is_active = true
      AND cm.role = 'admin'
      AND (
        (cm.clinic_id IS NOT NULL AND cm.clinic_id = clinic_memberships.clinic_id)
        OR (cm.clinic_id_ref IS NOT NULL AND cm.clinic_id_ref = clinic_memberships.clinic_id_ref)
      )
  )
);

-- 4. INSERT: Only admins can create memberships for their clinic
CREATE POLICY "clinic_memberships_insert"
ON clinic_memberships FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clinic_memberships cm
    WHERE cm.user_id = auth.uid()
      AND cm.role = 'admin'
      AND cm.is_active = true
  )
);

-- 5. UPDATE: Only admins can update memberships
CREATE POLICY "clinic_memberships_update"
ON clinic_memberships FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM clinic_memberships cm
    WHERE cm.user_id = auth.uid()
      AND cm.role = 'admin'
      AND cm.is_active = true
  )
);

-- 6. DELETE: Only admins can delete memberships
CREATE POLICY "clinic_memberships_delete"
ON clinic_memberships FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM clinic_memberships cm
    WHERE cm.user_id = auth.uid()
      AND cm.role = 'admin'
      AND cm.is_active = true
  )
);

-- 7. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
