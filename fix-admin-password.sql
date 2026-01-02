-- Fix super admin password hash
-- This updates the password hash for admin@octonix.com to the correct bcrypt hash for 'admin123'

-- Delete existing admin if exists (to ensure clean state)
delete from public.admins where email = 'admin@octonix.com';

-- Insert with correct hash
insert into public.admins (email, password_hash, role, name, is_active)
values ('admin@octonix.com', '$2b$10$lbEVGEtiDhjnfjvjRovBxuRUTEJmEuEMqtRJSxScfV5uhZEQNoofS', 'super_admin', 'Super Admin', true);
